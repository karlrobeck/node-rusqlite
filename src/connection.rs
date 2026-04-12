use std::{collections::HashMap, ops::Deref};

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
  transaction::{TransactionBehavior, TransactionState},
  utils::parse_rows,
};

/// SQLite database configuration switches exposed to JavaScript.
#[napi]
pub enum DbConfig {
  SqliteDbconfigEnableFkey = 1_002,
  SqliteDbconfigEnableTrigger = 1_003,
  SqliteDbconfigEnableFts3Tokenizer = 1_004,
  SqliteDbconfigNoCkptOnClose = 1_006,
  SqliteDbconfigEnableQpsg = 1_007,
  SqliteDbconfigTriggerEqp = 1_008,
  SqliteDbconfigResetDatabase = 1_009,
  SqliteDbconfigDefensive = 1_010,
  SqliteDbconfigWritableSchema = 1_011,
  SqliteDbconfigLegacyAlterTable = 1_012,
  SqliteDbconfigDqsDml = 1_013,
  SqliteDbconfigDqsDdl = 1_014,
  SqliteDbconfigEnableView = 1_015,
  SqliteDbconfigLegacyFileFormat = 1_016,
  SqliteDbconfigTrustedSchema = 1_017,
  SqliteDbconfigStmtScanStatus = 1_018,
  SqliteDbconfigReverseScanOrder = 1_019,
  SqliteDbconfigEnableAttachCreate = 1_020,
  SqliteDbconfigEnableAttachWrite = 1_021,
  SqliteDbconfigEnableComments = 1_022,
}

impl From<DbConfig> for rusqlite::config::DbConfig {
  fn from(value: DbConfig) -> Self {
    match value {
      DbConfig::SqliteDbconfigEnableFkey => Self::SQLITE_DBCONFIG_ENABLE_FKEY,
      DbConfig::SqliteDbconfigEnableTrigger => Self::SQLITE_DBCONFIG_ENABLE_TRIGGER,
      DbConfig::SqliteDbconfigEnableFts3Tokenizer => Self::SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER,
      DbConfig::SqliteDbconfigNoCkptOnClose => Self::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
      DbConfig::SqliteDbconfigEnableQpsg => Self::SQLITE_DBCONFIG_ENABLE_QPSG,
      DbConfig::SqliteDbconfigTriggerEqp => Self::SQLITE_DBCONFIG_TRIGGER_EQP,
      DbConfig::SqliteDbconfigResetDatabase => Self::SQLITE_DBCONFIG_RESET_DATABASE,
      DbConfig::SqliteDbconfigDefensive => Self::SQLITE_DBCONFIG_DEFENSIVE,
      DbConfig::SqliteDbconfigWritableSchema => Self::SQLITE_DBCONFIG_WRITABLE_SCHEMA,
      DbConfig::SqliteDbconfigLegacyAlterTable => Self::SQLITE_DBCONFIG_LEGACY_ALTER_TABLE,
      DbConfig::SqliteDbconfigDqsDml => Self::SQLITE_DBCONFIG_DQS_DML,
      DbConfig::SqliteDbconfigDqsDdl => Self::SQLITE_DBCONFIG_DQS_DDL,
      DbConfig::SqliteDbconfigEnableView => Self::SQLITE_DBCONFIG_ENABLE_VIEW,
      DbConfig::SqliteDbconfigLegacyFileFormat => Self::SQLITE_DBCONFIG_LEGACY_FILE_FORMAT,
      DbConfig::SqliteDbconfigTrustedSchema => Self::SQLITE_DBCONFIG_TRUSTED_SCHEMA,
      DbConfig::SqliteDbconfigStmtScanStatus => Self::SQLITE_DBCONFIG_STMT_SCANSTATUS,
      DbConfig::SqliteDbconfigReverseScanOrder => Self::SQLITE_DBCONFIG_REVERSE_SCANORDER,
      DbConfig::SqliteDbconfigEnableAttachCreate => Self::SQLITE_DBCONFIG_ENABLE_ATTACH_CREATE,
      DbConfig::SqliteDbconfigEnableAttachWrite => Self::SQLITE_DBCONFIG_ENABLE_ATTACH_WRITE,
      DbConfig::SqliteDbconfigEnableComments => Self::SQLITE_DBCONFIG_ENABLE_COMMENTS,
    }
  }
}

/// A live SQLite connection exposed to JavaScript.
#[napi(custom_finalize)]
pub struct Connection {
  pub(crate) connection: rusqlite::Connection,
}

impl Deref for Connection {
  type Target = rusqlite::Connection;

  fn deref(&self) -> &Self::Target {
    &self.connection
  }
}

/// A borrowed SQLite connection used inside transaction and savepoint callbacks.
#[napi]
pub struct ScopedConnection<'a> {
  pub(crate) connection: &'a rusqlite::Connection,
}

/// Progress information returned by long-running SQLite operations.
#[napi(object)]
pub struct Progress {
  pub remaining: i32,
  pub page_count: i32,
}

/// Options for opening a SQLite connection.
#[napi(object)]
pub struct ConnectionOptions {
  pub flags: Option<i32>,
  pub vfs: Option<String>,
}

/// Flags that control how a SQLite database is opened.
#[napi]
pub enum OpenFlags {
  SqliteOpenReadonly = 0x00000001,      /* Ok for sqlite3_open_v2() */
  SqliteOpenReadwrite = 0x00000002,     /* Ok for sqlite3_open_v2() */
  SqliteOpenCreate = 0x00000004,        /* Ok for sqlite3_open_v2() */
  SqliteOpenDELETEONCLOSE = 0x00000008, /* VFS only */
  SqliteOpenEXCLUSIVE = 0x00000010,     /* VFS only */
  SqliteOpenAUTOPROXY = 0x00000020,     /* VFS only */
  SqliteOpenURI = 0x00000040,           /* Ok for sqlite3_open_v2() */
  SqliteOpenMEMORY = 0x00000080,        /* Ok for sqlite3_open_v2() */
  SqliteOpenMainDb = 0x00000100,        /* VFS only */
  SqliteOpenTempDb = 0x00000200,        /* VFS only */
  SqliteOpenTransientDb = 0x00000400,   /* VFS only */
  SqliteOpenMainJournal = 0x00000800,   /* VFS only */
  SqliteOpenTempJournal = 0x00001000,   /* VFS only */
  SqliteOpenSubjournal = 0x00002000,    /* VFS only */
  SqliteOpenSuperJournal = 0x00004000,  /* VFS only */
  SqliteOpenNomutex = 0x00008000,       /* Ok for sqlite3_open_v2() */
  SqliteOpenFullmutex = 0x00010000,     /* Ok for sqlite3_open_v2() */
  SqliteOpenSharedcache = 0x00020000,   /* Ok for sqlite3_open_v2() */
  SqliteOpenPrivatecache = 0x00040000,  /* Ok for sqlite3_open_v2() */
  SqliteOpenWal = 0x00080000,           /* VFS only */
  SqliteOpenNofollow = 0x01000000,      /* Ok for sqlite3_open_v2() */
  SqliteOpenExrescode = 0x02000000,     /* Extended result codes */
}

/// Handle that can be used to interrupt a running SQLite operation.
#[napi]
pub struct InterruptHandle {
  pub(crate) handle: rusqlite::InterruptHandle,
}

#[napi]
impl InterruptHandle {
  /// Interrupts the associated SQLite connection.
  #[napi]
  pub fn interrupt(&self) {
    self.handle.interrupt();
  }
}

#[napi]
impl ScopedConnection<'_> {
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
        .connection
        .column_exists(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_exists(None, &*table_name, &*column_name),
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
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
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
        .connection
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_metadata(None, &*table_name, &*column_name),
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
  pub fn db_config(&self, config: DbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Sets a SQLite database configuration flag.
  ///
  /// @param config - The configuration flag to change.
  /// @param on - Whether the flag should be enabled.
  #[napi]
  pub fn set_db_config(&self, config: DbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
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
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, parse_rows)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, parse_rows),
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
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
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
    pragma_value: Array,
    #[napi(ts_arg_type = "(value: Record<string, unknown>) => void")] callback: Function<
      Unknown<'_>,
    >,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            value = parse_rows(row)?;
            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
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
    pragma_value: Array,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .connection
        .pragma_update(None, &pragma_name, &sql_value),
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
    pragma_value: Array,
  ) -> napi::Result<Unknown<'_>> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        parse_rows,
      ),
      None => self
        .connection
        .pragma_update_and_check(None, &pragma_name, &sql_value, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  /// Runs a transaction and commits on success or rolls back on error.
  ///
  /// @param callback - Called with a scoped connection inside the transaction.
  #[napi(ts_args_type = "callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  /// Runs a named savepoint and commits on success or rolls back on error.
  ///
  /// @param name - The savepoint name.
  /// @param callback - Called with a scoped connection inside the savepoint.
  #[napi(ts_args_type = "name: string, callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint_with_name(
    &mut self,
    name: String,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint_with_name(&name)
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  /// Returns the current transaction state for the given database.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @returns The current transaction state.
  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
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
      .connection
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
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  /// Returns the filesystem path for the connection, if any.
  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  /// Asks SQLite to release as much memory as possible.
  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns the most recent inserted row id.
  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
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
      .connection
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
      .connection
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
    let statement = self
      .connection
      .prepare(&sql)
      .map_err(NodeRusqliteError::from)?;

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
      .connection
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  /// Returns a handle that can interrupt long-running database work.
  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<InterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(InterruptHandle { handle })
  }

  /// Returns the number of changes made by the most recent operation.
  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  /// Returns the total number of changes made on the connection.
  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  /// Returns whether the connection is currently in autocommit mode.
  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  /// Returns whether the connection is busy.
  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  /// Flushes the SQLite cache.
  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns whether the specified database is read-only.
  ///
  /// @param dbName - The database name to inspect.
  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
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
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  /// Returns whether the connection has been interrupted.
  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl Connection {
  /// Opens a SQLite database at the given path.
  ///
  /// @param path - The database file path.
  /// @param options - Optional open flags and VFS settings.
  /// @returns A new connection.
  #[napi(factory)]
  pub fn open(path: String, options: Option<ConnectionOptions>) -> napi::Result<Connection> {
    let connection = match options {
      Some(option) => match (option.flags, option.vfs) {
        (Some(flags), Some(vfs)) => rusqlite::Connection::open_with_flags_and_vfs(
          &path,
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (Some(flags), None) => rusqlite::Connection::open_with_flags(
          &path,
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
        )
        .map_err(NodeRusqliteError::from)?,
        (None, Some(vfs)) => {
          rusqlite::Connection::open_with_flags_and_vfs(&path, rusqlite::OpenFlags::empty(), &*vfs)
            .map_err(NodeRusqliteError::from)?
        }
        (None, None) => rusqlite::Connection::open(&path).map_err(NodeRusqliteError::from)?,
      },
      None => rusqlite::Connection::open(&path).map_err(NodeRusqliteError::from)?,
    };

    Ok(Self { connection })
  }

  /// Opens an in-memory SQLite database.
  ///
  /// @param options - Optional open flags and VFS settings.
  /// @returns A new in-memory connection.
  #[napi(factory)]
  pub fn open_in_memory(options: Option<ConnectionOptions>) -> napi::Result<Connection> {
    let connection = match options {
      Some(option) => match (option.flags, option.vfs) {
        (Some(flags), Some(vfs)) => rusqlite::Connection::open_in_memory_with_flags_and_vfs(
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (Some(flags), None) => rusqlite::Connection::open_in_memory_with_flags(
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
        )
        .map_err(NodeRusqliteError::from)?,
        (None, Some(vfs)) => rusqlite::Connection::open_in_memory_with_flags_and_vfs(
          rusqlite::OpenFlags::empty(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (None, None) => rusqlite::Connection::open_in_memory().map_err(NodeRusqliteError::from)?,
      },
      None => rusqlite::Connection::open_in_memory().map_err(NodeRusqliteError::from)?,
    };

    Ok(Self { connection })
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
        .connection
        .column_exists(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_exists(None, &*table_name, &*column_name),
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
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
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
        .connection
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_metadata(None, &*table_name, &*column_name),
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
  pub fn db_config(&self, config: DbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Sets a SQLite database configuration flag.
  ///
  /// @param config - The configuration flag to change.
  /// @param on - Whether the flag should be enabled.
  #[napi]
  pub fn set_db_config(&self, config: DbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
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
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, parse_rows)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, parse_rows),
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
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
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
    pragma_value: Array,
    #[napi(ts_arg_type = "(value:Record<string,unknown>) => void")] callback: Function<Unknown<'_>>,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            value = parse_rows(row)?;

            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          value = parse_rows(row)?;

          Ok(())
        }),
    }
    .map_err(NodeRusqliteError::from)?;

    callback.call(env.to_js_value(&value)?)?;

    Ok(())
  }

  /// Updates a PRAGMA value without returning the resulting row.
  ///
  /// @param schemaName - The schema name, or `null` to use the default schema.
  /// @param pragmaName - The PRAGMA name to execute.
  /// @param pragmaValue - The PRAGMA value to send.
  #[napi(ts_return_type = "Promise<void>")]
  pub fn pragma_update(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .connection
        .pragma_update(None, &pragma_name, &sql_value),
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
    pragma_value: Array,
  ) -> napi::Result<Unknown<'_>> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        parse_rows,
      ),
      None => self
        .connection
        .pragma_update_and_check(None, &pragma_name, &sql_value, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  /// Runs a transaction and commits on success or rolls back on error.
  ///
  /// @param callback - Called with a scoped connection inside the transaction.
  #[napi(ts_args_type = "callback: (connection: ScopedConnection) => void")]
  pub fn transaction(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  /// Runs a transaction with the specified behavior.
  ///
  /// @param behavior - The transaction behavior to use.
  /// @param callback - Called with a scoped connection inside the transaction.
  #[napi(
    ts_args_type = "behavior: TransactionBehavior, callback: (connection: ScopedConnection) => void"
  )]
  pub fn transaction_with_behavior(
    &mut self,
    behavior: TransactionBehavior,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction_with_behavior(behavior.into())
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  /// Runs a transaction without extra checks and commits or rolls back based on the callback.
  ///
  /// @param callback - Called with a scoped connection inside the transaction.
  #[napi(ts_args_type = "callback: (connection: ScopedConnection) => void")]
  pub fn unchecked_transaction(
    &mut self,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .unchecked_transaction()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  /// Runs a savepoint and commits on success or rolls back on error.
  ///
  /// @param callback - Called with a scoped connection inside the savepoint.
  #[napi(ts_args_type = "callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  /// Runs a named savepoint and commits on success or rolls back on error.
  ///
  /// @param name - The savepoint name.
  /// @param callback - Called with a scoped connection inside the savepoint.
  #[napi(ts_args_type = "name: String, callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint_with_name(
    &mut self,
    name: String,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint_with_name(&name)
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  /// Returns the current transaction state for the given database.
  ///
  /// @param dbName - The database name, or `null` to use the main database.
  /// @returns The current transaction state.
  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  /// Sets the default transaction behavior for future transactions.
  ///
  /// @param behavior - The transaction behavior to use.
  #[napi]
  pub fn set_transaction_behavior(&mut self, behavior: TransactionBehavior) -> napi::Result<()> {
    self.connection.set_transaction_behavior(behavior.into());
    Ok(())
  }

  /// Executes a batch of SQL statements.
  ///
  /// @param sql - The SQL batch to execute.
  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .connection
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
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  /// Returns the filesystem path for the connection, if any.
  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  /// Asks SQLite to release as much memory as possible.
  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns the most recent inserted row id.
  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
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
      .connection
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
  pub fn query_one(&self, env: Env, sql: String, params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(params)
      .unwrap_or_default();

    let row = self
      .connection
      .query_one(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  /// Prepares a SQL statement and passes it to a callback.
  ///
  /// @param sql - The SQL statement to prepare.
  /// @param callback - Called with the prepared statement.
  #[napi(ts_args_type = "sql: String, callback: (statement: ScopedStatement) => void")]
  pub fn prepare(&self, sql: String, callback: Function<ScopedStatement>) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare(&sql)
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  /// Prepares a SQL statement with explicit SQLite prepare flags.
  ///
  /// @param sql - The SQL statement to prepare.
  /// @param flags - The SQLite prepare flags to use.
  /// @param callback - Called with the prepared statement.
  #[napi(
    ts_args_type = "sql:string, flags: RusqlitePrepFlags, callback: (statement: ScopedStatement) => void"
  )]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
    callback: Function<ScopedStatement>,
  ) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  /// Returns a handle that can interrupt long-running database work.
  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<InterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(InterruptHandle { handle })
  }

  /// Returns the number of changes made by the most recent operation.
  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  /// Returns the total number of changes made on the connection.
  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  /// Returns whether the connection is currently in autocommit mode.
  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  /// Returns whether the connection is busy.
  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  /// Flushes the SQLite cache.
  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  /// Returns whether the specified database is read-only.
  ///
  /// @param dbName - The database name to inspect.
  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
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
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  /// Returns whether the connection has been interrupted.
  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl ObjectFinalize for Connection {
  /// Closes the connection when the JavaScript object is finalized.
  fn finalize(self, _env: Env) -> napi::Result<()> {
    self
      .connection
      .close()
      .map_err(|(_, err)| NodeRusqliteError::from(err))?;
    Ok(())
  }
}
