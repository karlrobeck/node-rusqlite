use napi::{
  Env,
  bindgen_prelude::{Array, ObjectFinalize},
};
use napi_derive::napi;
use rusqlite::{StatementStatus, params_from_iter};

use crate::{
  column::{Column, ColumnMetadata},
  errors::NodeRusqliteError,
  row::{Rows, Value},
};

/// Status counters that can be read from a prepared SQLite statement.
#[napi]
pub enum RusqliteStatementStatus {
  /// Number of rows processed by a full table scan.
  FullscanStep = 1,
  /// Number of sort operations performed.
  Sort = 2,
  /// Number of automatic indexes created or used.
  AutoIndex = 3,
  /// Number of virtual machine steps executed.
  VmStep = 4,
  /// Number of statements that had to be re-prepared.
  RePrepare = 5,
  /// Number of times the statement was run.
  Run = 6,
  /// Number of rows filtered out by a WHERE clause.
  FilterMiss = 7,
  /// Number of rows that matched the filter.
  FilterHit = 8,
  /// Approximate memory used by the statement.
  MemUsed = 99,
}

/// Flags that control how SQLite prepares SQL text.
#[napi]
pub enum RusqlitePrepFlags {
  /// Keep the prepared statement around for reuse.
  SqlitePreparePersistent = 0x01,
  /// Disable virtual table support while preparing.
  SqlitePrepareNoVtab = 0x04,
  /// Prevent SQLite from emitting prepare-time log messages.
  SqlitePrepareDontLog = 0x10,
}

impl From<RusqliteStatementStatus> for StatementStatus {
  fn from(value: RusqliteStatementStatus) -> Self {
    match value {
      RusqliteStatementStatus::FullscanStep => StatementStatus::AutoIndex,
      RusqliteStatementStatus::Sort => StatementStatus::Sort,
      RusqliteStatementStatus::AutoIndex => StatementStatus::AutoIndex,
      RusqliteStatementStatus::VmStep => StatementStatus::VmStep,
      RusqliteStatementStatus::RePrepare => StatementStatus::RePrepare,
      RusqliteStatementStatus::Run => StatementStatus::Run,
      RusqliteStatementStatus::FilterMiss => StatementStatus::FilterMiss,
      RusqliteStatementStatus::FilterHit => StatementStatus::FilterHit,
      RusqliteStatementStatus::MemUsed => StatementStatus::MemUsed,
    }
  }
}

#[napi(object)]
/// Detailed column metadata returned by `column_metadata`.
pub struct RusqliteDetailedColumnMetadata {
  /// The database name the column comes from.
  pub database_name: String,
  /// The table name the column comes from.
  pub table_name: String,
  /// The column name.
  pub column_name: String,
  /// The declared SQLite type, if available.
  pub r#type: Option<String>,
  /// The default collation sequence, if available.
  pub collation_sequence: Option<String>,
  /// Whether the column has a `NOT NULL` constraint.
  pub not_null: bool,
  /// Whether the column is part of the primary key.
  pub primary_key: bool,
  /// Whether the column uses autoincrement.
  pub auto_increment: bool,
}

/// A prepared SQLite statement that is scoped to the lifetime of the underlying connection.
#[napi(custom_finalize)]
pub struct ScopedStatement<'a> {
  pub(crate) statement: rusqlite::Statement<'a>,
}

#[napi]
impl ScopedStatement<'_> {
  /// Returns the names of all result columns in order.
  #[napi]
  pub fn column_names(&self) -> napi::Result<Vec<String>> {
    Ok(
      self
        .statement
        .column_names()
        .iter()
        .map(|row| row.to_string())
        .collect::<Vec<_>>(),
    )
  }

  /// Returns the number of result columns in the statement.
  #[napi]
  pub fn column_count(&self) -> napi::Result<i64> {
    Ok(self.statement.column_count() as i64)
  }

  /// Returns the name of a result column by zero-based index.
  ///
  /// @param col - The zero-based column index.
  /// @returns The column name.
  #[napi]
  pub fn column_name(&self, col: i64) -> napi::Result<String> {
    Ok(
      self
        .statement
        .column_name(col as usize)
        .map_err(NodeRusqliteError::from)?
        .to_string(),
    )
  }

  /// Returns the zero-based index of a named result column.
  ///
  /// @param name - The column name to look up.
  /// @returns The column index.
  #[napi]
  pub fn column_index(&self, name: String) -> napi::Result<i64> {
    Ok(
      self
        .statement
        .column_index(&name)
        .map_err(NodeRusqliteError::from)? as i64,
    )
  }

  /// Returns all result columns as lightweight metadata objects.
  #[napi]
  pub fn columns(&self) -> napi::Result<Vec<Column<'_>>> {
    Ok(
      self
        .statement
        .columns()
        .into_iter()
        .map(|col| Column { column: col })
        .collect::<Vec<_>>(),
    )
  }

  /// Returns all result columns with detailed metadata attached.
  #[napi]
  pub fn columns_with_metadata(&self) -> napi::Result<Vec<ColumnMetadata<'_>>> {
    Ok(
      self
        .statement
        .columns_with_metadata()
        .into_iter()
        .map(|metadata| ColumnMetadata { metadata })
        .collect::<Vec<_>>(),
    )
  }

  /// Returns detailed metadata for a single result column.
  ///
  /// @param col - The zero-based column index.
  /// @returns Detailed metadata for the column, or `undefined` if unavailable.
  #[napi]
  pub fn column_metadata(&self, col: i64) -> napi::Result<Option<RusqliteDetailedColumnMetadata>> {
    let metadata = self
      .statement
      .column_metadata(col as usize)
      .map_err(NodeRusqliteError::from)?;

    if let Some(metadata) = metadata {
      let metadata = RusqliteDetailedColumnMetadata {
        database_name: metadata
          .0
          .to_str()
          .map_err(|err| NodeRusqliteError(rusqlite::Error::Utf8Error(0, err)))?
          .to_string(),
        table_name: metadata
          .1
          .to_str()
          .map_err(|err| NodeRusqliteError(rusqlite::Error::Utf8Error(0, err)))?
          .to_string(),
        column_name: metadata.2.to_string_lossy().to_string(),
        collation_sequence: metadata.3.map(|v| v.to_string_lossy().to_string()),
        r#type: metadata.4.map(|v| v.to_string_lossy().to_string()),
        not_null: metadata.5,
        primary_key: metadata.6,
        auto_increment: metadata.7,
      };

      Ok(Some(metadata))
    } else {
      Ok(None)
    }
  }

  /// Executes the statement with the provided SQL parameters.
  ///
  /// @param params - The ordered parameter values for the SQL statement.
  /// @returns The number of rows affected.
  #[napi]
  pub fn execute(&mut self, env: Env, params: Array) -> napi::Result<i64> {
    let params = env.from_js_value::<Vec<Value>, _>(params)?;

    let result = self
      .statement
      .execute(params_from_iter(params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  /// Executes an INSERT statement with the provided SQL parameters.
  ///
  /// @param params - The ordered parameter values for the SQL statement.
  /// @returns The inserted rowid.
  #[napi]
  pub fn insert(&mut self, env: Env, params: Array) -> napi::Result<i64> {
    let params = env.from_js_value::<Vec<Value>, _>(params)?;

    let result = self
      .statement
      .insert(params_from_iter(params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result)
  }

  /// Runs a query and collects the full result set.
  ///
  /// @param params - The ordered parameter values for the SQL statement.
  /// @returns All rows returned by the query.
  #[napi]
  pub fn query(&mut self, env: Env, params: Array) -> napi::Result<Rows> {
    let params = env.from_js_value::<Vec<Value>, _>(params)?;

    let rows = self
      .statement
      .query(params_from_iter(params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(Rows::new(rows))
  }

  /// Checks whether the query returns at least one row.
  ///
  /// @param params - The ordered parameter values for the SQL statement.
  /// @returns `true` when the query returns a row, otherwise `false`.
  #[napi]
  pub fn exists(&mut self, env: Env, params: Array) -> napi::Result<bool> {
    let sql_params = env.from_js_value::<Vec<Value>, _>(params)?;

    let result = self
      .statement
      .exists(params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result)
  }

  /// Returns the zero-based index for a named statement parameter.
  ///
  /// @param name - The parameter name, such as `$name` or `:name`.
  /// @returns The parameter index, or `undefined` when the parameter is not found.
  #[napi]
  pub fn parameter_index(&self, name: String) -> napi::Result<Option<i64>> {
    let index = self
      .statement
      .parameter_index(&name)
      .map_err(NodeRusqliteError::from)?;

    Ok(index.map(|v| v as i64))
  }

  /// Returns the parameter name for a zero-based parameter index.
  ///
  /// @param index - The zero-based parameter index.
  /// @returns The parameter name, or `undefined` when the parameter is anonymous.
  #[napi]
  pub fn parameter_name(&self, index: i64) -> napi::Result<Option<String>> {
    let index = self.statement.parameter_name(index as usize);

    Ok(index.map(|v| v.to_string()))
  }

  /// Returns the number of parameters accepted by the statement.
  #[napi]
  pub fn parameter_count(&self) -> napi::Result<i64> {
    Ok(self.statement.parameter_count() as i64)
  }

  /// Returns the SQL text after parameter expansion, if available.
  #[napi]
  pub fn expanded_sql(&self) -> napi::Result<Option<String>> {
    Ok(self.statement.expanded_sql())
  }

  /// Returns the value of a statement status counter.
  ///
  /// @param status - The status counter to read.
  /// @returns The current counter value.
  #[napi]
  pub fn get_status(&self, status: RusqliteStatementStatus) -> napi::Result<i32> {
    Ok(self.statement.get_status(StatementStatus::from(status)))
  }

  /// Resets a statement status counter and returns its previous value.
  ///
  /// @param status - The status counter to reset.
  /// @returns The previous counter value.
  #[napi]
  pub fn reset_status(&self, status: RusqliteStatementStatus) -> napi::Result<i32> {
    Ok(self.statement.reset_status(StatementStatus::from(status)))
  }

  /// Returns whether the statement is an `EXPLAIN` statement.
  #[napi]
  pub fn is_explain(&self) -> napi::Result<i32> {
    Ok(self.statement.is_explain())
  }

  /// Returns whether the statement is read-only.
  #[napi]
  pub fn readonly(&self) -> napi::Result<bool> {
    Ok(self.statement.readonly())
  }

  /// Clears all bound parameter values from the statement.
  #[napi]
  pub fn clear_bindings(&mut self) -> napi::Result<()> {
    self.statement.clear_bindings();
    Ok(())
  }
}

#[napi]
impl ObjectFinalize for ScopedStatement<'_> {
  fn finalize(self, _env: napi::Env) -> napi::Result<()> {
    self.statement.finalize().map_err(NodeRusqliteError::from)?;
    Ok(())
  }
}
