use std::{ops::Deref, sync::Arc, thread, time::Duration};

use napi::{
  bindgen_prelude::{Buffer, ObjectFinalize},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use napi_derive::napi;
use rusqlite::{
  Connection, PrepFlags, Transaction,
  backup::{Backup, StepResult},
  params_from_iter,
};

use crate::{
  column::RusqliteConnectionColumnMetadata,
  connection::{Progress, RusqliteDbConfig, RusqliteInterruptHandle},
  errors::RusqliteError,
  statement::{RusqlitePrepFlags, RusqliteStatement},
  utils::{RusqliteValue, row_to_buffer},
};

#[napi]
pub enum RusqliteTransactionState {
  None,
  Read,
  Write,
}

#[napi]
pub enum RusqliteTransactionBehavior {
  Deferred,
  Immediate,
  Exclusive,
}

#[napi]
pub enum DropBehavior {
  Rollback,
  Commit,
  Ignore,
  Panic,
}

impl From<RusqliteTransactionBehavior> for rusqlite::TransactionBehavior {
  fn from(value: RusqliteTransactionBehavior) -> Self {
    match value {
      RusqliteTransactionBehavior::Deferred => Self::Deferred,
      RusqliteTransactionBehavior::Exclusive => Self::Exclusive,
      RusqliteTransactionBehavior::Immediate => Self::Immediate,
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

impl From<rusqlite::TransactionState> for RusqliteTransactionState {
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
pub struct RusqliteTransaction<'a> {
  pub(crate) transaction: Transaction<'a>,
}

#[napi]
impl RusqliteTransaction<'_> {
  /// savepoint
  #[napi]
  pub fn savepoint(&mut self) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self.transaction.savepoint().map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint {
      savepoint,
      name: Some("_rusqlite_sp".to_string()),
      commited: false,
    })
  }

  #[napi]
  pub fn savepoint_with_name(&mut self, name: String) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self
      .transaction
      .savepoint_with_name(name.clone())
      .map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint {
      savepoint,
      name: Some(name),
      commited: false,
    })
  }

  #[napi]
  pub fn drop_behavior(&self) -> napi::Result<DropBehavior> {
    let behavior = match self.transaction.drop_behavior() {
      rusqlite::DropBehavior::Commit => DropBehavior::Commit,
      rusqlite::DropBehavior::Ignore => DropBehavior::Ignore,
      rusqlite::DropBehavior::Panic => DropBehavior::Panic,
      rusqlite::DropBehavior::Rollback => DropBehavior::Rollback,
      _ => panic!("undefined behavior"),
    };

    Ok(behavior)
  }

  #[napi]
  pub fn set_drop_behavior(&mut self, drop_behavior: DropBehavior) -> napi::Result<()> {
    self.transaction.set_drop_behavior(drop_behavior.into());
    Ok(())
  }

  #[napi]
  pub fn commit(&mut self) -> napi::Result<()> {
    self
      .transaction
      .execute_batch("COMMIT")
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn rollback(&self) -> napi::Result<()> {
    self
      .transaction
      .execute_batch("ROLLBACK")
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn finish(&mut self) -> napi::Result<()> {
    if self.transaction.is_autocommit() {
      return Ok(());
    }

    match self.drop_behavior()? {
      DropBehavior::Commit => self.commit().or_else(|_| self.rollback()),
      DropBehavior::Rollback => self.rollback(),
      DropBehavior::Ignore => Ok(()),
      DropBehavior::Panic => panic!("Transaction dropped unexpectedly."),
    }
  }
}

// --- deref connection
#[napi]
impl RusqliteTransaction<'_> {
  #[napi]
  pub fn backup(
    &self,
    name: String,
    dst_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(dst_path).map_err(RusqliteError::from)?;

    let backup = Backup::new_with_names(
      self.transaction.deref(),
      self.transaction.deref().path().unwrap(),
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
      self.transaction.deref(),
      self.transaction.deref().path().unwrap(),
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
  pub fn column_exists(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => {
        self
          .transaction
          .deref()
          .column_exists(Some(&*db_name), &table_name, &column_name)
      }
      None => self
        .transaction
        .deref()
        .column_exists(None, &*table_name, &*column_name),
    };

    Ok(exists.map_err(RusqliteError::from)?)
  }

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self
        .transaction
        .deref()
        .table_exists(Some(&*db_name), &table_name),
      None => self.transaction.deref().table_exists(None, &*table_name),
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
      Some(db_name) => {
        self
          .transaction
          .deref()
          .column_metadata(Some(&*db_name), &table_name, &column_name)
      }
      None => self
        .transaction
        .deref()
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
      .transaction
      .deref()
      .db_config(config.into())
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .transaction
      .deref()
      .set_db_config(config.into(), on)
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn pragma_query_value(
    &self,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Buffer> {
    let value = match schema_name {
      Some(schema_name) => self.transaction.deref().pragma_query_value(
        Some(&*schema_name),
        &pragma_name,
        row_to_buffer,
      ),
      None => self
        .transaction
        .deref()
        .pragma_query_value(None, &pragma_name, row_to_buffer),
    }
    .map_err(RusqliteError::from)?;

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
      Some(schema_name) => {
        self
          .transaction
          .deref()
          .pragma_query(Some(&*schema_name), &pragma_name, |row| {
            buffer = row_to_buffer(row)?;
            Ok(())
          })
      }
      None => self
        .transaction
        .deref()
        .pragma_query(None, &pragma_name, |row| {
          buffer = row_to_buffer(row)?;
          Ok(())
        }),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .transaction
          .deref()
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
        .transaction
        .deref()
        .pragma(None, &pragma_name, &sql_value, |row| {
          let value_buffer = row_to_buffer(row)?;

          callback.call(
            Ok(value_buffer.into()),
            ThreadsafeFunctionCallMode::NonBlocking,
          );

          Ok(())
        }),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .transaction
          .deref()
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .transaction
        .deref()
        .pragma_update(None, &pragma_name, &sql_value),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    let value = match schema_name {
      Some(schema_name) => self.transaction.deref().pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
      None => self.transaction.deref().pragma_update_and_check(
        None,
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
    }
    .map_err(RusqliteError::from)?;

    Ok(value.into())
  }

  #[napi]
  pub fn unchecked_transaction(&mut self) -> napi::Result<RusqliteTransaction<'_>> {
    let transaction = self
      .transaction
      .deref()
      .unchecked_transaction()
      .map_err(RusqliteError::from)?;
    Ok(RusqliteTransaction { transaction })
  }

  #[napi]
  pub fn transaction_state(
    &self,
    db_name: Option<String>,
  ) -> napi::Result<RusqliteTransactionState> {
    let state = self
      .transaction
      .deref()
      .transaction_state(db_name.as_deref())
      .map_err(RusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .transaction
      .deref()
      .execute_batch(&sql)
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, sql: String, sql_params: &[u8]) -> napi::Result<i64> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let result = self
      .transaction
      .deref()
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.transaction.deref().path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .transaction
      .deref()
      .release_memory()
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.transaction.deref().last_insert_rowid())
  }

  #[napi]
  pub fn query_row(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let row = self
      .transaction
      .deref()
      .query_row(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(RusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn query_one(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let row = self
      .transaction
      .deref()
      .query_one(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(RusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn prepare(&self, sql: String) -> napi::Result<RusqliteStatement<'_>> {
    let statement = self
      .transaction
      .deref()
      .prepare(&sql)
      .map_err(RusqliteError::from)?;
    Ok(RusqliteStatement { statement })
  }

  #[napi]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
  ) -> napi::Result<RusqliteStatement<'_>> {
    let statement = self
      .transaction
      .deref()
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(RusqliteError::from)?;
    Ok(RusqliteStatement { statement })
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<RusqliteInterruptHandle> {
    let handle = self.transaction.deref().get_interrupt_handle();
    Ok(RusqliteInterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.transaction.deref().changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.transaction.deref().total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.transaction.deref().is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.transaction.deref().is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .transaction
      .deref()
      .cache_flush()
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .transaction
        .deref()
        .is_readonly(&*db_name)
        .map_err(RusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .transaction
        .deref()
        .db_name(index as usize)
        .map_err(RusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.transaction.deref().is_interrupted())
  }
}
// --- deref connection

impl<'a> Deref for RusqliteTransaction<'a> {
  type Target = Connection;

  fn deref(&self) -> &Self::Target {
    &self.transaction
  }
}

#[napi]
impl ObjectFinalize for RusqliteTransaction<'_> {
  fn finalize(self, _env: napi::Env) -> napi::Result<()> {
    Ok(self.transaction.finish().map_err(RusqliteError::from)?)
  }
}

#[napi(custom_finalize)]
pub struct RusqliteSavepoint<'a> {
  pub(crate) savepoint: rusqlite::Savepoint<'a>,
  pub(crate) name: Option<String>,
  pub(crate) commited: bool,
}

#[napi]
impl RusqliteSavepoint<'_> {
  #[napi]
  pub fn savepoint(&mut self) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self.savepoint.savepoint().map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint {
      savepoint,
      name: Some("_rusqlite_sp".to_string()),
      commited: self.commited,
    })
  }

  #[napi]
  pub fn savepoint_with_name(&mut self, name: String) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self
      .savepoint
      .savepoint_with_name(name.clone())
      .map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint {
      savepoint,
      name: Some(name),
      commited: self.commited,
    })
  }

  #[napi]
  pub fn drop_behavior(&self) -> napi::Result<DropBehavior> {
    let behavior = match self.savepoint.drop_behavior() {
      rusqlite::DropBehavior::Commit => DropBehavior::Commit,
      rusqlite::DropBehavior::Ignore => DropBehavior::Ignore,
      rusqlite::DropBehavior::Panic => DropBehavior::Panic,
      rusqlite::DropBehavior::Rollback => DropBehavior::Rollback,
      _ => panic!("undefined behavior"),
    };

    Ok(behavior)
  }

  #[napi]
  pub fn set_drop_behavior(&mut self, drop_behavior: DropBehavior) -> napi::Result<()> {
    self.savepoint.set_drop_behavior(drop_behavior.into());
    Ok(())
  }

  #[napi]
  pub fn commit(&mut self) -> napi::Result<()> {
    self
      .savepoint
      .execute_batch(&format!(
        "RELEASE {}",
        self.name.as_ref().map_or("_rusqlite_sp", |v| v)
      ))
      .map_err(RusqliteError::from)?;
    self.commited = true;
    Ok(())
  }

  #[napi]
  pub fn rollback(&mut self) -> napi::Result<()> {
    self.savepoint.rollback().map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn finish(&mut self) -> napi::Result<()> {
    if self.commited {
      return Ok(());
    }

    match self.drop_behavior()? {
      DropBehavior::Commit => self
        .commit()
        .or_else(|_| self.rollback().and_then(|()| self.commit())),
      DropBehavior::Ignore => Ok(()),
      DropBehavior::Panic => panic!("savepoint was not committed or rolled back"),
      DropBehavior::Rollback => self.rollback().and_then(|()| self.commit()),
    }
  }
}

// --- deref connection savepoint
#[napi]
impl RusqliteSavepoint<'_> {
  #[napi]
  pub fn backup(
    &self,
    name: String,
    dst_path: String,
    callback: ThreadsafeFunction<Progress>,
  ) -> napi::Result<()> {
    let mut new_connection = Connection::open(dst_path).map_err(RusqliteError::from)?;

    let backup = Backup::new_with_names(
      self.savepoint.deref(),
      self.savepoint.deref().path().unwrap(),
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
      self.savepoint.deref(),
      self.savepoint.deref().path().unwrap(),
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
  pub fn column_exists(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => {
        self
          .savepoint
          .deref()
          .column_exists(Some(&*db_name), &table_name, &column_name)
      }
      None => self
        .savepoint
        .deref()
        .column_exists(None, &*table_name, &*column_name),
    };

    Ok(exists.map_err(RusqliteError::from)?)
  }

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self
        .savepoint
        .deref()
        .table_exists(Some(&*db_name), &table_name),
      None => self.savepoint.deref().table_exists(None, &*table_name),
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
      Some(db_name) => {
        self
          .savepoint
          .deref()
          .column_metadata(Some(&*db_name), &table_name, &column_name)
      }
      None => self
        .savepoint
        .deref()
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
      .savepoint
      .deref()
      .db_config(config.into())
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .savepoint
      .deref()
      .set_db_config(config.into(), on)
      .map_err(RusqliteError::from)?;
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
          .savepoint
          .deref()
          .pragma_query_value(Some(&*schema_name), &pragma_name, row_to_buffer)
      }
      None => self
        .savepoint
        .deref()
        .pragma_query_value(None, &pragma_name, row_to_buffer),
    }
    .map_err(RusqliteError::from)?;

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
      Some(schema_name) => {
        self
          .savepoint
          .deref()
          .pragma_query(Some(&*schema_name), &pragma_name, |row| {
            buffer = row_to_buffer(row)?;
            Ok(())
          })
      }
      None => self
        .savepoint
        .deref()
        .pragma_query(None, &pragma_name, |row| {
          buffer = row_to_buffer(row)?;
          Ok(())
        }),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .savepoint
          .deref()
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
        .savepoint
        .deref()
        .pragma(None, &pragma_name, &sql_value, |row| {
          let value_buffer = row_to_buffer(row)?;

          callback.call(
            Ok(value_buffer.into()),
            ThreadsafeFunctionCallMode::NonBlocking,
          );

          Ok(())
        }),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    match schema_name {
      Some(schema_name) => {
        self
          .savepoint
          .deref()
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .savepoint
        .deref()
        .pragma_update(None, &pragma_name, &sql_value),
    }
    .map_err(RusqliteError::from)?;

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
      serde_json::from_slice::<RusqliteValue>(pragma_value).map_err(RusqliteError::from)?;

    let value = match schema_name {
      Some(schema_name) => self.savepoint.deref().pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
      None => self.savepoint.deref().pragma_update_and_check(
        None,
        &pragma_name,
        &sql_value,
        row_to_buffer,
      ),
    }
    .map_err(RusqliteError::from)?;

    Ok(value.into())
  }

  #[napi]
  pub fn unchecked_transaction(&mut self) -> napi::Result<RusqliteTransaction<'_>> {
    let transaction = self
      .savepoint
      .deref()
      .unchecked_transaction()
      .map_err(RusqliteError::from)?;
    Ok(RusqliteTransaction { transaction })
  }

  #[napi]
  pub fn transaction_state(
    &self,
    db_name: Option<String>,
  ) -> napi::Result<RusqliteTransactionState> {
    let state = self
      .savepoint
      .deref()
      .transaction_state(db_name.as_deref())
      .map_err(RusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .savepoint
      .deref()
      .execute_batch(&sql)
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, sql: String, sql_params: &[u8]) -> napi::Result<i64> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let result = self
      .savepoint
      .deref()
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(RusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.savepoint.deref().path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .savepoint
      .deref()
      .release_memory()
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.savepoint.deref().last_insert_rowid())
  }

  #[napi]
  pub fn query_row(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let row = self
      .savepoint
      .deref()
      .query_row(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(RusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn query_one(&self, sql: String, sql_params: &[u8]) -> napi::Result<Buffer> {
    let sql_params = serde_json::from_slice::<Vec<RusqliteValue>>(sql_params)
      .map_err(RusqliteError::from)
      .unwrap_or_default();

    let row = self
      .savepoint
      .deref()
      .query_one(&sql, params_from_iter(sql_params.iter()), row_to_buffer)
      .map_err(RusqliteError::from)?;

    Ok(row.into())
  }

  #[napi]
  pub fn prepare(&self, sql: String) -> napi::Result<RusqliteStatement<'_>> {
    let statement = self
      .savepoint
      .deref()
      .prepare(&sql)
      .map_err(RusqliteError::from)?;
    Ok(RusqliteStatement { statement })
  }

  #[napi]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
  ) -> napi::Result<RusqliteStatement<'_>> {
    let statement = self
      .savepoint
      .deref()
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(RusqliteError::from)?;
    Ok(RusqliteStatement { statement })
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<RusqliteInterruptHandle> {
    let handle = self.savepoint.deref().get_interrupt_handle();
    Ok(RusqliteInterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.savepoint.deref().changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.savepoint.deref().total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.savepoint.deref().is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.savepoint.deref().is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .savepoint
      .deref()
      .cache_flush()
      .map_err(RusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .savepoint
        .deref()
        .is_readonly(&*db_name)
        .map_err(RusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .savepoint
        .deref()
        .db_name(index as usize)
        .map_err(RusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.savepoint.deref().is_interrupted())
  }
}
// --- deref connection savepoint

#[napi]
impl ObjectFinalize for RusqliteSavepoint<'_> {
  fn finalize(self, _env: napi::Env) -> napi::Result<()> {
    Ok(self.savepoint.finish().map_err(RusqliteError::from)?)
  }
}
