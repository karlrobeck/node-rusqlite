use napi::bindgen_prelude::Buffer;
use napi_derive::napi;
use rusqlite::{params_from_iter, StatementStatus};

use crate::{
  column::{RusqliteColumn, RusqliteColumnMetadata},
  errors::RusqliteError,
  row::RusqliteRows,
  utils::RusqliteValue,
};

#[napi]
pub enum RusqliteStatementStatus {
  FullscanStep = 1,
  Sort = 2,
  AutoIndex = 3,
  VmStep = 4,
  RePrepare = 5,
  Run = 6,
  FilterMiss = 7,
  FilterHit = 8,
  MemUsed = 99,
}

#[napi]
pub enum RusqlitePrepFlags {
  SqlitePreparePersistent = 0x01,
  SqlitePrepareNoVtab = 0x04,
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
pub struct RusqliteDetailedColumnMetadata {
  pub database_name: String,
  pub table_name: String,
  pub column_name: String,
  pub r#type: Option<String>,
  pub collation_sequence: Option<String>,
  pub not_null: bool,
  pub primary_key: bool,
  pub auto_increment: bool,
}

#[napi]
pub struct RusqliteStatement<'a> {
  pub(crate) statement: rusqlite::Statement<'a>,
}

#[napi]
impl<'a> RusqliteStatement<'a> {
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

  #[napi]
  pub fn column_count(&self) -> napi::Result<i64> {
    Ok(self.statement.column_count() as i64)
  }

  #[napi]
  pub fn column_name(&self, col: i64) -> napi::Result<String> {
    Ok(
      self
        .statement
        .column_name(col as usize)
        .map_err(RusqliteError::from)?
        .to_string(),
    )
  }

  #[napi]
  pub fn column_index(&self, name: String) -> napi::Result<i64> {
    Ok(
      self
        .statement
        .column_index(&name)
        .map_err(RusqliteError::from)? as i64,
    )
  }

  #[napi]
  pub fn columns(&'a self) -> napi::Result<Vec<RusqliteColumn<'a>>> {
    Ok(
      self
        .statement
        .columns()
        .into_iter()
        .map(|col| RusqliteColumn { column: col })
        .collect::<Vec<_>>(),
    )
  }

  #[napi]
  pub fn columns_with_metadata(&'a self) -> napi::Result<Vec<RusqliteColumnMetadata<'a>>> {
    Ok(
      self
        .statement
        .columns_with_metadata()
        .into_iter()
        .map(|metadata| RusqliteColumnMetadata { metadata })
        .collect::<Vec<_>>(),
    )
  }

  #[napi]
  pub fn column_metadata(
    &'a self,
    col: i64,
  ) -> napi::Result<Option<RusqliteDetailedColumnMetadata>> {
    let metadata = self
      .statement
      .column_metadata(col as usize)
      .map_err(RusqliteError::from)?;

    if let Some(metadata) = metadata {
      let metadata = RusqliteDetailedColumnMetadata {
        database_name: metadata
          .0
          .to_str()
          .map_err(|err| RusqliteError(rusqlite::Error::Utf8Error(0, err)))?
          .to_string(),
        table_name: metadata
          .1
          .to_str()
          .map_err(|err| RusqliteError(rusqlite::Error::Utf8Error(0, err)))?
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

  #[napi]
  pub fn execute(&mut self, params: &[u8]) -> napi::Result<i64> {
    let params = serde_json::from_slice::<Vec<RusqliteValue>>(params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let result = self
      .statement
      .execute(params_from_iter(params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn insert(&mut self, params: &[u8]) -> napi::Result<i64> {
    let params = serde_json::from_slice::<Vec<RusqliteValue>>(params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let result = self
      .statement
      .insert(params_from_iter(params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(result)
  }

  #[napi]
  pub fn query(&mut self, params: &[u8]) -> napi::Result<RusqliteRows<'_>> {
    let params = serde_json::from_slice::<Vec<RusqliteValue>>(params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let rows = self
      .statement
      .query(params_from_iter(params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(RusqliteRows { rows })
  }

  #[napi]
  pub fn exists(&mut self, params: &[u8]) -> napi::Result<bool> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let result = self
      .statement
      .exists(params_from_iter(sql_params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(result)
  }

  #[napi]
  pub fn parameter_index(&self, name: String) -> napi::Result<Option<i64>> {
    let index = self
      .statement
      .parameter_index(&name)
      .map_err(RusqliteError::from)?;

    Ok(index.map(|v| v as i64))
  }

  #[napi]
  pub fn parameter_name(&self, index: i64) -> napi::Result<Option<String>> {
    let index = self.statement.parameter_name(index as usize);

    Ok(index.map(|v| v.to_string()))
  }

  #[napi]
  pub fn parameter_count(&self) -> napi::Result<i64> {
    Ok(self.statement.parameter_count() as i64)
  }

  #[napi]
  pub fn expanded_sql(&self) -> napi::Result<Option<String>> {
    Ok(self.statement.expanded_sql())
  }

  #[napi]
  pub fn get_status(&self, status: RusqliteStatementStatus) -> napi::Result<i32> {
    Ok(self.statement.get_status(StatementStatus::from(status)))
  }

  #[napi]
  pub fn reset_status(&self, status: RusqliteStatementStatus) -> napi::Result<i32> {
    Ok(self.statement.reset_status(StatementStatus::from(status)))
  }

  #[napi]
  pub fn is_explain(&self) -> napi::Result<i32> {
    Ok(self.statement.is_explain())
  }

  #[napi]
  pub fn readonly(&self) -> napi::Result<bool> {
    Ok(self.statement.readonly())
  }

  #[napi]
  pub fn clear_bindings(&mut self) -> napi::Result<()> {
    self.statement.clear_bindings();
    Ok(())
  }
}
