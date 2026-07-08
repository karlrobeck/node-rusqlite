use std::collections::HashMap;

use napi::{
  Env, Unknown,
  bindgen_prelude::{Array, Function, ObjectFinalize},
};
use napi_derive::napi;
use rusqlite::{PrepFlags, params_from_iter};

use crate::{
  column::ConnectionColumnMetadata,
  errors::NodeRusqliteError,
  row::Value,
  statement::{RusqlitePrepFlags, ScopedStatement},
  utils::parse_rows,
};

use crate::connection::InterruptHandle;

/// The current SQLite transaction state for a connection.
#[napi]
pub enum TransactionState {
  /// No active transaction.
  None,
  /// An active read transaction.
  Read,
  /// An active write transaction.
  Write,
}

/// How a transaction should begin.
#[napi]
#[derive(Clone)]
pub enum TransactionBehavior {
  /// Begin the transaction only when needed.
  Deferred,
  /// Begin the transaction immediately.
  Immediate,
  /// Begin the transaction exclusively.
  Exclusive,
}

/// What should happen when a transaction is dropped without being completed.
#[napi]
#[derive(Clone)]
pub enum DropBehavior {
  /// Roll back the transaction on drop.
  Rollback,
  /// Commit the transaction on drop.
  Commit,
  /// Ignore the drop and leave the transaction state alone.
  Ignore,
  /// Panic if the transaction is dropped without being completed.
  Panic,
}

impl From<TransactionBehavior> for rusqlite::TransactionBehavior {
  fn from(value: TransactionBehavior) -> Self {
    match value {
      TransactionBehavior::Deferred => Self::Deferred,
      TransactionBehavior::Exclusive => Self::Exclusive,
      TransactionBehavior::Immediate => Self::Immediate,
    }
  }
}

impl From<DropBehavior> for rusqlite::DropBehavior {
  fn from(value: DropBehavior) -> Self {
    match value {
      DropBehavior::Commit => Self::Commit,
      DropBehavior::Ignore => Self::Ignore,
      DropBehavior::Panic => Self::Panic,
      DropBehavior::Rollback => Self::Rollback,
    }
  }
}

impl From<rusqlite::DropBehavior> for DropBehavior {
  fn from(value: rusqlite::DropBehavior) -> Self {
    match value {
      rusqlite::DropBehavior::Rollback => DropBehavior::Rollback,
      rusqlite::DropBehavior::Commit => DropBehavior::Commit,
      rusqlite::DropBehavior::Ignore => DropBehavior::Ignore,
      rusqlite::DropBehavior::Panic => DropBehavior::Panic,
      _ => DropBehavior::Rollback,
    }
  }
}

impl From<rusqlite::TransactionState> for TransactionState {
  fn from(value: rusqlite::TransactionState) -> Self {
    match value {
      rusqlite::TransactionState::None => Self::None,
      rusqlite::TransactionState::Read => Self::Read,
      rusqlite::TransactionState::Write => Self::Write,
      _ => panic!("undefined transaction state"),
    }
  }
}

#[napi(custom_finalize)]
pub struct Transaction<'a> {
  pub(crate) conn: &'a rusqlite::Connection,
  pub(crate) drop_behavior: rusqlite::DropBehavior,
  pub(crate) finished: bool,
}

#[napi]
impl<'a> Transaction<'a> {
  #[napi]
  pub fn commit(&mut self) -> napi::Result<()> {
    if self.finished {
      return Err(napi::Error::from_reason(
        "Transaction already completed".to_string(),
      ));
    }
    self
      .conn
      .execute_batch("COMMIT")
      .map_err(NodeRusqliteError::from)?;
    self.finished = true;
    Ok(())
  }

  #[napi]
  pub fn rollback(&mut self) -> napi::Result<()> {
    if self.finished {
      return Err(napi::Error::from_reason(
        "Transaction already completed".to_string(),
      ));
    }
    self
      .conn
      .execute_batch("ROLLBACK")
      .map_err(NodeRusqliteError::from)?;
    self.finished = true;
    Ok(())
  }

  #[napi]
  pub fn drop_behavior(&self) -> DropBehavior {
    self.drop_behavior.into()
  }

  #[napi]
  pub fn set_drop_behavior(&mut self, behavior: DropBehavior) {
    self.drop_behavior = behavior.into();
  }

  #[napi]
  pub fn dispose(&mut self) -> napi::Result<()> {
    if self.finished {
      return Ok(());
    }
    match self.drop_behavior {
      rusqlite::DropBehavior::Rollback => self.rollback(),
      rusqlite::DropBehavior::Commit => self.commit(),
      rusqlite::DropBehavior::Ignore => {
        self.finished = true;
        Ok(())
      }
      rusqlite::DropBehavior::Panic => Err(napi::Error::from_reason(
        "Transaction dropped unexpectedly".to_string(),
      )),
      _ => {
        self.finished = true;
        Ok(())
      }
    }
  }

  /// Returns whether a column exists in the given table.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @param tableName - The table name to inspect.
  /// @param columnName - The column name to look for.
  /// @returns `true` when the column exists, otherwise `false`.
  #[napi]
  pub fn column_exists(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self
        .conn
        .column_exists(Some(&*db_name), &table_name, &column_name),
      None => self.conn.column_exists(None, &*table_name, &*column_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  /// Returns whether a table exists in the given database.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @param tableName - The table name to look for.
  /// @returns `true` when the table exists, otherwise `false`.
  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.conn.table_exists(Some(&*db_name), &table_name),
      None => self.conn.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  /// Returns detailed metadata for a column in a table.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @param tableName - The table name to inspect.
  /// @param columnName - The column name to inspect.
  /// @returns Column metadata for the requested column.
  #[napi]
  pub fn column_metadata(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<ConnectionColumnMetadata> {
    let metadata = match db_name {
      Some(db_name) => self
        .conn
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self.conn.column_metadata(None, &*table_name, &*column_name),
    };

    let metadata = metadata.map_err(NodeRusqliteError::from)?;

    Ok(ConnectionColumnMetadata {
      r#type: metadata.0.map(|val| val.to_str().unwrap().to_string()),
      collation_sequence: metadata.1.map(|val| val.to_str().unwrap().to_string()),
      not_null: metadata.2,
      primary_key: metadata.3,
      auto_increment: metadata.4,
    })
  }

  /// Reads a SQLite database configuration flag.
  ///
  /// @param config - The configuration flag to query.
  #[napi]
  pub fn db_config(&self, config: crate::connection::DbConfig) -> napi::Result<()> {
    self
      .conn
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Sets a SQLite database configuration flag.
  ///
  /// @param config - The configuration flag to change.
  /// @param on - Whether the flag should be enabled.
  #[napi]
  pub fn set_db_config(&self, config: crate::connection::DbConfig, on: bool) -> napi::Result<()> {
    self
      .conn
      .set_db_config(config.into(), on)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Reads a PRAGMA value and returns the parsed result.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to query.
  /// @returns The PRAGMA result as a JavaScript value.
  #[napi(ts_return_type = "unknown")]
  pub fn pragma_query_value(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .conn
          .pragma_query_value(Some(&*schema_name), &pragma_name, parse_rows)
      }
      None => self.conn.pragma_query_value(None, &pragma_name, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  /// Runs a PRAGMA query and returns the row as a plain object.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to query.
  /// @returns The PRAGMA row as a JavaScript object.
  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_query(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => self
        .conn
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.conn.pragma_query(None, &pragma_name, |row| {
        value = parse_rows(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  /// Runs a PRAGMA statement and invokes a callback with the resulting row.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to execute.
  /// @param pragmaValue - The PRAGMA value to send.
  /// @param callback - Called with the resulting PRAGMA row.
  #[napi]
  pub fn pragma(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
    #[napi(ts_arg_type = "(value: Record<string, unknown>) => void")] callback: Function<
      Unknown<'_>,
    >,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => self
        .conn
        .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.conn.pragma(None, &pragma_name, &sql_value, |row| {
        value = parse_rows(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    callback.call(env.to_js_value(&value).expect("Unable to convert value"))?;

    Ok(())
  }

  /// Updates a PRAGMA value without returning the resulting row.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to execute.
  /// @param pragmaValue - The PRAGMA value to send.
  #[napi]
  pub fn pragma_update(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    match schema_name {
      Some(schema_name) => self
        .conn
        .pragma_update(Some(&*schema_name), &pragma_name, &sql_value),
      None => self.conn.pragma_update(None, &pragma_name, &sql_value),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(())
  }

  /// Updates a PRAGMA value and returns the resulting row as an object.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to execute.
  /// @param pragmaValue - The PRAGMA value to send.
  /// @returns The resulting PRAGMA row as a JavaScript object.
  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_update_and_check(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
  ) -> napi::Result<Unknown<'_>> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => {
        self
          .conn
          .pragma_update_and_check(Some(&*schema_name), &pragma_name, &sql_value, parse_rows)
      }
      None => self
        .conn
        .pragma_update_and_check(None, &pragma_name, &sql_value, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  /// Returns the current transaction state for the given database.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @returns The current transaction state.
  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .conn
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  /// Executes a batch of SQL statements.
  ///
  /// @param sql - The SQL batch to execute.
  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .conn
      .execute_batch(&sql)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Executes a single SQL statement with positional parameters.
  ///
  /// @param sql - The SQL statement to execute.
  /// @param sqlParams - The ordered parameter values.
  /// @returns The number of rows affected.
  #[napi]
  pub fn execute(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<i64> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let result = self
      .conn
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  /// Returns the filesystem path for the connection, if any.
  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.conn.path().unwrap_or("").to_string())
  }

  /// Asks SQLite to release as much memory as possible.
  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .conn
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns the most recent inserted row id.
  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.conn.last_insert_rowid())
  }

  /// Executes a query and returns the first row as an object.
  ///
  /// @param sql - The SQL query to execute.
  /// @param sqlParams - The ordered parameter values.
  /// @returns The first matching row as a JavaScript object.
  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_row(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let row = self
      .conn
      .query_row(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  /// Executes a query and returns a single row as an object.
  ///
  /// @param sql - The SQL query to execute.
  /// @param params - The ordered parameter values.
  /// @returns A single row as a JavaScript object.
  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_one(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let row = self
      .conn
      .query_one(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  /// Prepares a SQL statement and passes it to a callback.
  ///
  /// @param sql - The SQL statement to prepare.
  /// @param callback - Called with the prepared statement.
  #[napi(ts_args_type = "sql:string, callback: (statement: ScopedStatement) => void")]
  pub fn prepare(&self, sql: String, callback: Function<ScopedStatement>) -> napi::Result<()> {
    let statement = self.conn.prepare(&sql).map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  #[napi(
    ts_args_type = "sql:string, flags: RusqlitePrepFlags, callback: (statement: ScopedStatement) => void"
  )]
  /// Prepares a SQL statement with explicit SQLite prepare flags.
  ///
  /// @param sql - The SQL statement to prepare.
  /// @param flags - The SQLite prepare flags to use.
  /// @param callback - Called with the prepared statement.
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
    callback: Function<ScopedStatement>,
  ) -> napi::Result<()> {
    let statement = self
      .conn
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  /// Returns a handle that can interrupt long-running database work.
  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<InterruptHandle> {
    let handle = self.conn.get_interrupt_handle();
    Ok(InterruptHandle { handle })
  }

  /// Returns the number of changes made by the most recent operation.
  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.conn.changes() as i64)
  }

  /// Returns the total number of changes made on the connection.
  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.conn.total_changes() as i64)
  }

  /// Returns whether the connection is currently in autocommit mode.
  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.conn.is_autocommit())
  }

  /// Returns whether the connection is busy.
  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.conn.is_busy())
  }

  /// Flushes the SQLite cache.
  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self.conn.cache_flush().map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns whether the specified database is read-only.
  ///
  /// @param dbName - The database name to inspect.
  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .conn
        .is_readonly(&*db_name)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  /// Returns the name of the attached database at the given index.
  ///
  /// @param index - The zero-based database index.
  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .conn
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  /// Returns whether the connection has been interrupted.
  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.conn.is_interrupted())
  }
}

impl<'a> ObjectFinalize for Transaction<'a> {
  fn finalize(self, _env: napi::Env) -> napi::Result<()> {
    if !self.finished && !self.conn.is_autocommit() {
      match self.drop_behavior {
        rusqlite::DropBehavior::Commit => {
          self.conn.execute_batch("COMMIT").map_err(|e| {
            self.conn.execute_batch("ROLLBACK").ok();
            NodeRusqliteError::from(e)
          })?;
        }
        rusqlite::DropBehavior::Rollback => {
          self.conn.execute_batch("ROLLBACK").ok();
        }
        rusqlite::DropBehavior::Ignore => {}
        rusqlite::DropBehavior::Panic => {
          panic!("Transaction dropped unexpectedly.");
        }
        _ => {}
      }
    }
    Ok(())
  }
}
