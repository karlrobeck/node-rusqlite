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
  connection::{
    Progress, RusqliteConnection, RusqliteDbConfig, RusqliteInterruptHandle,
    RusqliteSharedConnection,
  },
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

  #[napi(getter)]
  pub fn connection(&'_ self) -> napi::Result<RusqliteSharedConnection<'_>> {
    Ok(RusqliteSharedConnection {
      connection: self.transaction.deref(),
    })
  }
}

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

  #[napi(getter)]
  pub fn connection(&'_ self) -> napi::Result<RusqliteSharedConnection<'_>> {
    Ok(RusqliteSharedConnection {
      connection: self.savepoint.deref(),
    })
  }
}

#[napi]
impl ObjectFinalize for RusqliteSavepoint<'_> {
  fn finalize(self, _env: napi::Env) -> napi::Result<()> {
    Ok(self.savepoint.finish().map_err(RusqliteError::from)?)
  }
}
