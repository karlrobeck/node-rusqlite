use std::{ops::Deref, sync::Arc, thread, time::Duration};

use napi::{
  Env,
  bindgen_prelude::{Buffer, External, Function, ObjectFinalize, Reference},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use napi_derive::napi;
use rusqlite::{
  Connection, InterruptHandle, PrepFlags,
  backup::{Backup, StepResult},
  params_from_iter,
};

use crate::{
  column::ConnectionColumnMetadata,
  errors::NodeRusqliteError,
  statement::{RusqlitePrepFlags, ScopedStatement},
  transaction::{ScopedSavepoint, ScopedTransaction, TransactionBehavior, TransactionState},
  utils::{Value, row_to_buffer},
};

#[napi]
pub enum RusqliteDbConfig {
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

impl From<RusqliteDbConfig> for rusqlite::config::DbConfig {
  fn from(value: RusqliteDbConfig) -> Self {
    match value {
      RusqliteDbConfig::SqliteDbconfigEnableFkey => Self::SQLITE_DBCONFIG_ENABLE_FKEY,
      RusqliteDbConfig::SqliteDbconfigEnableTrigger => Self::SQLITE_DBCONFIG_ENABLE_TRIGGER,
      RusqliteDbConfig::SqliteDbconfigEnableFts3Tokenizer => {
        Self::SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER
      }
      RusqliteDbConfig::SqliteDbconfigNoCkptOnClose => Self::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
      RusqliteDbConfig::SqliteDbconfigEnableQpsg => Self::SQLITE_DBCONFIG_ENABLE_QPSG,
      RusqliteDbConfig::SqliteDbconfigTriggerEqp => Self::SQLITE_DBCONFIG_TRIGGER_EQP,
      RusqliteDbConfig::SqliteDbconfigResetDatabase => Self::SQLITE_DBCONFIG_RESET_DATABASE,
      RusqliteDbConfig::SqliteDbconfigDefensive => Self::SQLITE_DBCONFIG_DEFENSIVE,
      RusqliteDbConfig::SqliteDbconfigWritableSchema => Self::SQLITE_DBCONFIG_WRITABLE_SCHEMA,
      RusqliteDbConfig::SqliteDbconfigLegacyAlterTable => Self::SQLITE_DBCONFIG_LEGACY_ALTER_TABLE,
      RusqliteDbConfig::SqliteDbconfigDqsDml => Self::SQLITE_DBCONFIG_DQS_DML,
      RusqliteDbConfig::SqliteDbconfigDqsDdl => Self::SQLITE_DBCONFIG_DQS_DDL,
      RusqliteDbConfig::SqliteDbconfigEnableView => Self::SQLITE_DBCONFIG_ENABLE_VIEW,
      RusqliteDbConfig::SqliteDbconfigLegacyFileFormat => Self::SQLITE_DBCONFIG_LEGACY_FILE_FORMAT,
      RusqliteDbConfig::SqliteDbconfigTrustedSchema => Self::SQLITE_DBCONFIG_TRUSTED_SCHEMA,
      RusqliteDbConfig::SqliteDbconfigStmtScanStatus => Self::SQLITE_DBCONFIG_STMT_SCANSTATUS,
      RusqliteDbConfig::SqliteDbconfigReverseScanOrder => Self::SQLITE_DBCONFIG_REVERSE_SCANORDER,
      RusqliteDbConfig::SqliteDbconfigEnableAttachCreate => {
        Self::SQLITE_DBCONFIG_ENABLE_ATTACH_CREATE
      }
      RusqliteDbConfig::SqliteDbconfigEnableAttachWrite => {
        Self::SQLITE_DBCONFIG_ENABLE_ATTACH_WRITE
      }
      RusqliteDbConfig::SqliteDbconfigEnableComments => Self::SQLITE_DBCONFIG_ENABLE_COMMENTS,
    }
  }
}

#[napi(custom_finalize)]
pub struct RusqliteConnection {
  pub(crate) connection: rusqlite::Connection,
}

impl Deref for RusqliteConnection {
  type Target = rusqlite::Connection;

  fn deref(&self) -> &Self::Target {
    &self.connection
  }
}

#[napi]
pub struct ScopedConnection<'a> {
  pub(crate) connection: &'a rusqlite::Connection,
}

#[napi(object)]
pub struct Progress {
  pub remaining: i32,
  pub page_count: i32,
}

#[napi(object)]
pub struct RusqliteConnectionOptions {
  pub flags: i64,
  pub vfs: Option<String>,
}

#[napi]
pub struct RusqliteInterruptHandle {
  pub(crate) handle: InterruptHandle,
}

#[napi]
impl RusqliteInterruptHandle {
  #[napi]
  pub fn interrupt(&self) {
    self.handle.interrupt();
  }
}

#[napi]
pub fn execute_batch(external: &External<RusqliteConnection>, sql: String) -> napi::Result<()> {
  external
    .connection
    .execute_batch(&sql)
    .map_err(NodeRusqliteError::from)?;
  Ok(())
}

#[napi]
impl ScopedConnection<'_> {
  #[napi]
  pub fn backup(
    &self,
    name: String,
    dst_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(dst_path).map_err(NodeRusqliteError::from)?;

    let backup = Backup::new_with_names(
      self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(NodeRusqliteError::from)?;

    let callback = Arc::new(callback);

    loop {
      let progress = {
        let raw = backup.progress();
        Progress {
          page_count: raw.pagecount,
          remaining: raw.remaining,
        }
      };

      callback.call(Ok(progress), ThreadsafeFunctionCallMode::NonBlocking);

      match backup.step(2).map_err(NodeRusqliteError::from)? {
        StepResult::Busy | StepResult::More | StepResult::Locked => {
          thread::sleep(Duration::from_millis(100))
        }
        StepResult::Done => break,
        _ => panic!(""),
      }
    }

    Ok(())
  }

  #[napi]
  pub fn restore(
    &self,
    name: String,
    src_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(src_path).map_err(NodeRusqliteError::from)?;

    let backup = Backup::new_with_names(
      self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(NodeRusqliteError::from)?;

    let callback = Arc::new(callback);

    loop {
      let progress = {
        let raw = backup.progress();
        Progress {
          page_count: raw.pagecount,
          remaining: raw.remaining,
        }
      };

      callback.call(Ok(progress), ThreadsafeFunctionCallMode::NonBlocking);

      match backup.step(2).map_err(NodeRusqliteError::from)? {
        StepResult::Busy | StepResult::More | StepResult::Locked => {
          thread::sleep(Duration::from_millis(100))
        }
        StepResult::Done => break,
        _ => panic!(""),
      }
    }

    Ok(())
  }

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

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

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

  #[napi]
  pub fn db_config(&self, config: RusqliteDbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
      .set_db_config(config.into(), on)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn pragma_query_value(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Buffer> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, row_to_buffer)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, row_to_buffer),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(value.into())
  }

  #[napi]
  pub fn pragma_query(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Buffer> {
    let mut buffer = vec![];

    match schema_name {
      Some(schema_name) => self
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          buffer = row_to_buffer(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
        buffer = row_to_buffer(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(buffer.into())
  }

  #[napi]
  pub fn pragma(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
    callback: ThreadsafeFunction<Buffer>,
  ) -> napi::Result<()> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            let value_buffer = row_to_buffer(row)?;

            callback.call(
              Ok(value_buffer.into()),
              ThreadsafeFunctionCallMode::NonBlocking,
            );
            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          let value_buffer = row_to_buffer(row)?;

          callback.call(
            Ok(value_buffer.into()),
            ThreadsafeFunctionCallMode::NonBlocking,
          );

          Ok(())
        }),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(())
  }

  #[napi]
  pub fn pragma_update(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
  ) -> napi::Result<()> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

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

  #[napi]
  pub fn pragma_update_and_check(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
  ) -> napi::Result<Buffer> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
      None => {
        self
          .connection
          .pragma_update_and_check(None, &pragma_name, &sql_value, row_to_buffer)
      }
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(value.into())
  }

  #[napi]
  pub fn unchecked_transaction(
    &mut self,
    callback: Function<ScopedTransaction>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .unchecked_transaction()
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedTransaction {
      transaction: &transaction,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .connection
      .execute_batch(&sql)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, sql: String, sql_params: &[u8]) -> napi::Result<i64> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let result = self
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
  }

  #[napi]
  pub fn query_row(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let row = self
      .connection
      .query_row(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(NodeRusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn query_one(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let row = self
      .connection
      .query_one(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(NodeRusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn prepare(&self, sql: String) -> napi::Result<ScopedStatement<'_>> {
    Ok(ScopedStatement {
      statement: self
        .connection
        .prepare(&sql)
        .map_err(NodeRusqliteError::from)?,
    })
  }

  #[napi]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
  ) -> napi::Result<ScopedStatement<'_>> {
    Ok(ScopedStatement {
      statement: self
        .connection
        .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
        .map_err(NodeRusqliteError::from)?,
    })
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<RusqliteInterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(RusqliteInterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
        .is_readonly(&*db_name)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl RusqliteConnection {
  #[napi]
  pub fn open(
    path: String,
    options: Option<RusqliteConnectionOptions>,
  ) -> napi::Result<RusqliteConnection> {
    let connection = rusqlite::Connection::open(&path).map_err(NodeRusqliteError::from)?;
    Ok(Self { connection })
  }
  #[napi]
  pub fn open_in_memory(
    options: Option<RusqliteConnectionOptions>,
  ) -> napi::Result<RusqliteConnection> {
    let connection = rusqlite::Connection::open_in_memory().map_err(NodeRusqliteError::from)?;
    Ok(Self { connection })
  }

  #[napi]
  pub fn backup(
    &self,
    name: String,
    dst_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(dst_path).map_err(NodeRusqliteError::from)?;

    let backup = Backup::new_with_names(
      &self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(NodeRusqliteError::from)?;

    let callback = Arc::new(callback);

    loop {
      let progress = {
        let raw = backup.progress();
        Progress {
          page_count: raw.pagecount,
          remaining: raw.remaining,
        }
      };

      callback.call(Ok(progress), ThreadsafeFunctionCallMode::NonBlocking);

      match backup.step(2).map_err(NodeRusqliteError::from)? {
        StepResult::Busy | StepResult::More | StepResult::Locked => {
          thread::sleep(Duration::from_millis(100))
        }
        StepResult::Done => break,
        _ => panic!(""),
      }
    }

    Ok(())
  }

  #[napi]
  pub fn restore(
    &self,
    name: String,
    src_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(src_path).map_err(NodeRusqliteError::from)?;

    let backup = Backup::new_with_names(
      &self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(NodeRusqliteError::from)?;

    let callback = Arc::new(callback);

    loop {
      let progress = {
        let raw = backup.progress();
        Progress {
          page_count: raw.pagecount,
          remaining: raw.remaining,
        }
      };

      callback.call(Ok(progress), ThreadsafeFunctionCallMode::NonBlocking);

      match backup.step(2).map_err(NodeRusqliteError::from)? {
        StepResult::Busy | StepResult::More | StepResult::Locked => {
          thread::sleep(Duration::from_millis(100))
        }
        StepResult::Done => break,
        _ => panic!(""),
      }
    }

    Ok(())
  }

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

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

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

  #[napi]
  pub fn db_config(&self, config: RusqliteDbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
      .set_db_config(config.into(), on)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn pragma_query_value(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Buffer> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, row_to_buffer)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, row_to_buffer),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(value.into())
  }

  #[napi]
  pub fn pragma_query(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Buffer> {
    let mut buffer = vec![];

    match schema_name {
      Some(schema_name) => self
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          buffer = row_to_buffer(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
        buffer = row_to_buffer(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(buffer.into())
  }

  #[napi]
  pub fn pragma(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
    callback: ThreadsafeFunction<Buffer>,
  ) -> napi::Result<()> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            let value_buffer = row_to_buffer(row)?;

            callback.call(
              Ok(value_buffer.into()),
              ThreadsafeFunctionCallMode::NonBlocking,
            );
            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          let value_buffer = row_to_buffer(row)?;

          callback.call(
            Ok(value_buffer.into()),
            ThreadsafeFunctionCallMode::NonBlocking,
          );

          Ok(())
        }),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(())
  }

  #[napi]
  pub fn pragma_update(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
  ) -> napi::Result<()> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

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

  #[napi]
  pub fn pragma_update_and_check(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: &[u8],
  ) -> napi::Result<Buffer> {
    let sql_value =
      serde_json::from_slice::<Value>(pragma_value).map_err(NodeRusqliteError::from)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
      None => {
        self
          .connection
          .pragma_update_and_check(None, &pragma_name, &sql_value, row_to_buffer)
      }
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(value.into())
  }

  #[napi(ts_args_type = "callback: (transaction: ScopedTransaction) => void")]
  pub fn transaction(&mut self, callback: Function<ScopedTransaction>) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction()
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedTransaction {
      transaction: &transaction,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi(
    ts_args_type = "behavior: TransactionBehavior, callback: (transaction: ScopedTransaction) => void"
  )]
  pub fn transaction_with_behavior(
    &mut self,
    behavior: TransactionBehavior,
    callback: Function<ScopedTransaction>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction_with_behavior(behavior.into())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedTransaction {
      transaction: &transaction,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi(ts_args_type = "callback: (transaction: ScopedTransaction) => void")]
  pub fn unchecked_transaction(
    &mut self,
    callback: Function<ScopedTransaction>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .unchecked_transaction()
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedTransaction {
      transaction: &transaction,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi]
  pub fn savepoint(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
  ) -> napi::Result<ScopedSavepoint> {
    Ok(ScopedSavepoint {
      savepoint: reference.share_with(env, |conn| {
        Ok(
          conn
            .connection
            .savepoint()
            .map_err(NodeRusqliteError::from)?,
        )
      })?,
      name: None,
      commited: false,
    })
  }

  #[napi]
  pub fn savepoint_with_name(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
    name: String,
  ) -> napi::Result<ScopedSavepoint> {
    Ok(ScopedSavepoint {
      savepoint: reference.share_with(env, |conn| {
        Ok(
          conn
            .connection
            .savepoint_with_name(name.clone())
            .map_err(NodeRusqliteError::from)?,
        )
      })?,
      name: Some(name),
      commited: false,
    })
  }

  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn set_transaction_behavior(&mut self, behavior: TransactionBehavior) -> napi::Result<()> {
    self.connection.set_transaction_behavior(behavior.into());
    Ok(())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .connection
      .execute_batch(&sql)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, sql: String, sql_params: &[u8]) -> napi::Result<i64> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let result = self
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
  }

  #[napi]
  pub fn query_row(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let row = self
      .connection
      .query_row(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(NodeRusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn query_one(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<Value>>(sql_params)
      .map_err(NodeRusqliteError::from)
      .unwrap_or_default();

    let row = self
      .connection
      .query_one(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(NodeRusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn prepare(&self, sql: String) -> napi::Result<ScopedStatement<'_>> {
    Ok(ScopedStatement {
      statement: self
        .connection
        .prepare(&sql)
        .map_err(NodeRusqliteError::from)?,
    })
  }

  #[napi]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
  ) -> napi::Result<ScopedStatement<'_>> {
    Ok(ScopedStatement {
      statement: self
        .connection
        .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
        .map_err(NodeRusqliteError::from)?,
    })
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<RusqliteInterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(RusqliteInterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
        .is_readonly(&*db_name)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl ObjectFinalize for RusqliteConnection {
  fn finalize(self, _env: Env) -> napi::Result<()> {
    self
      .connection
      .close()
      .map_err(|(_, err)| NodeRusqliteError::from(err))?;
    Ok(())
  }
}
