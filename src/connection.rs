use std::{
  sync::{Arc, Mutex, RwLock},
  thread,
  time::Duration,
};

use napi::{
  bindgen_prelude::{Buffer, ObjectFinalize},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
  Env, Unknown,
};
use napi_derive::napi;
use rusqlite::{
  backup::{Backup, StepResult},
  Connection,
};

use crate::{
  column::RusqliteConnectionColumnMetadata,
  errors::RusqliteError,
  row::{RusqliteRow, RusqliteValueRef},
  statement::{RusqliteDetailedColumnMetadata, RusqliteStatement},
  transaction::{
    RusqliteSavepoint, RusqliteTransaction, RusqliteTransactionBehavior, RusqliteTransactionState,
  },
  utils::napi_value_to_sql_param,
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

fn progress_callback(progress: Progress, callback: ThreadsafeFunction<Progress>) {
  callback.call(Ok(progress), ThreadsafeFunctionCallMode::NonBlocking);
}

#[napi]
impl RusqliteConnection {
  #[napi]
  pub fn open(path: String, options: Option<RusqliteConnectionOptions>) -> napi::Result<Self> {
    let connection = rusqlite::Connection::open(&path).map_err(RusqliteError::from)?;
    Ok(Self { connection })
  }
  #[napi]
  pub fn open_in_memory(options: Option<RusqliteConnectionOptions>) -> napi::Result<Self> {
    let connection = rusqlite::Connection::open_in_memory().map_err(RusqliteError::from)?;
    Ok(Self { connection })
  }

  #[napi]
  pub fn backup(
    &self,
    name: String,
    dst_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(dst_path).map_err(RusqliteError::from)?;

    let backup = Backup::new_with_names(
      &self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(RusqliteError::from)?;

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

      match backup.step(2).map_err(RusqliteError::from)? {
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
    let mut new_connection = Connection::open(src_path).map_err(RusqliteError::from)?;

    let backup = Backup::new_with_names(
      &self.connection,
      self.connection.path().unwrap(),
      &mut new_connection,
      &*name,
    )
    .map_err(RusqliteError::from)?;

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

      match backup.step(2).map_err(RusqliteError::from)? {
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
  pub fn prepare(&self, sql: String) -> napi::Result<RusqliteStatement<'_>> {
    let statement = self.connection.prepare(&sql).map_err(RusqliteError::from)?;
    Ok(RusqliteStatement { statement })
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

    Ok(exists.map_err(RusqliteError::from)?)
  }

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(RusqliteError::from)?)
  }

  #[napi]
  pub fn column_metadata(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<RusqliteConnectionColumnMetadata> {
    let metadata = match db_name {
      Some(db_name) => self
        .connection
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_metadata(None, &*table_name, &*column_name),
    };

    let metadata = metadata.map_err(RusqliteError::from)?;

    Ok(RusqliteConnectionColumnMetadata {
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
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
      .set_db_config(config.into(), on)
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn pragma_query_value(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<String> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, |row| {
            let value_ref = row.get_ref(0).unwrap();
            let value = RusqliteValueRef(value_ref);
            Ok(serde_json::to_string(&value).unwrap())
          })
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, |row| {
          let value_ref = row.get_ref(0).unwrap();
          let value = RusqliteValueRef(value_ref);
          Ok(serde_json::to_string(&value).unwrap())
        }),
    };

    Ok(value.map_err(RusqliteError::from)?)
  }

  #[napi]
  pub fn pragma_query(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Vec<String>> {
    let mut values = Vec::new();

    match schema_name {
      Some(schema_name) => self
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          let value_ref = row.get_ref(0).unwrap();
          let value = RusqliteValueRef(value_ref);
          values.push(serde_json::to_string(&value).unwrap());
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
        let value_ref = row.get_ref(0).unwrap();
        let value = RusqliteValueRef(value_ref);
        values.push(serde_json::to_string(&value).unwrap());
        Ok(())
      }),
    }
    .map_err(RusqliteError::from)?;

    Ok(values)
  }

  #[napi]
  pub fn pragma(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
    callback: ThreadsafeFunction<Buffer>,
  ) -> napi::Result<()> {
    let sql_value = napi_value_to_sql_param(&env, pragma_value)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            let value_ref = row.get_ref(0).unwrap();
            let value = RusqliteValueRef(value_ref);
            let json_string = serde_json::to_string(&value).unwrap();
            let buffer = Buffer::from(json_string.as_bytes());

            callback.call(Ok(buffer), ThreadsafeFunctionCallMode::NonBlocking);
            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          let value_ref = row.get_ref(0).unwrap();
          let value = RusqliteValueRef(value_ref);
          let json_string = serde_json::to_string(&value).unwrap();
          let buffer = Buffer::from(json_string.as_bytes());

          callback.call(Ok(buffer), ThreadsafeFunctionCallMode::NonBlocking);

          Ok(())
        }),
    }
    .map_err(RusqliteError::from)?;

    Ok(())
  }

  #[napi]
  pub fn pragma_update(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
  ) -> napi::Result<()> {
    let sql_value = napi_value_to_sql_param(&env, pragma_value)?;

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
    .map_err(RusqliteError::from)?;

    Ok(())
  }

  #[napi]
  pub fn pragma_update_and_check(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Unknown,
  ) -> napi::Result<String> {
    let sql_value = napi_value_to_sql_param(&env, pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        |row| {
          let value_ref = row.get_ref(0).unwrap();
          let value = RusqliteValueRef(value_ref);
          Ok(serde_json::to_string(&value).unwrap())
        },
      ),
      None => self
        .connection
        .pragma_update_and_check(None, &pragma_name, &sql_value, |row| {
          let value_ref = row.get_ref(0).unwrap();
          let value = RusqliteValueRef(value_ref);
          Ok(serde_json::to_string(&value).unwrap())
        }),
    }
    .map_err(RusqliteError::from)?;

    Ok(value)
  }

  #[napi]
  pub fn transaction(&mut self) -> napi::Result<RusqliteTransaction<'_>> {
    let transaction = self.connection.transaction().map_err(RusqliteError::from)?;
    Ok(RusqliteTransaction { transaction })
  }

  #[napi]
  pub fn transaction_with_behavior(
    &mut self,
    behavior: RusqliteTransactionBehavior,
  ) -> napi::Result<RusqliteTransaction<'_>> {
    let transaction = self
      .connection
      .transaction_with_behavior(behavior.into())
      .map_err(RusqliteError::from)?;
    Ok(RusqliteTransaction { transaction })
  }

  #[napi]
  pub fn unchecked_transaction(&mut self) -> napi::Result<RusqliteTransaction<'_>> {
    let transaction = self
      .connection
      .unchecked_transaction()
      .map_err(RusqliteError::from)?;
    Ok(RusqliteTransaction { transaction })
  }

  #[napi]
  pub fn savepoint(&mut self) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self.connection.savepoint().map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint { savepoint })
  }

  #[napi]
  pub fn savepoint_with_name(&mut self, name: String) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self
      .connection
      .savepoint_with_name(name)
      .map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint { savepoint })
  }

  #[napi]
  pub fn transaction_state(
    &self,
    db_name: Option<String>,
  ) -> napi::Result<RusqliteTransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(RusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn set_transaction_behavior(
    &mut self,
    behavior: RusqliteTransactionBehavior,
  ) -> napi::Result<()> {
    self.connection.set_transaction_behavior(behavior.into());
    Ok(())
  }
}

#[napi]
impl ObjectFinalize for RusqliteConnection {
  fn finalize(self, _env: Env) -> napi::Result<()> {
    self
      .connection
      .close()
      .map_err(|(_, err)| RusqliteError::from(err))?;
    Ok(())
  }
}
