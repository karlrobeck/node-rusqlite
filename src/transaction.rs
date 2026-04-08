use std::sync::Arc;

use napi_derive::napi;
use rusqlite::Transaction;

use crate::errors::RusqliteError;

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

#[napi]
pub struct RusqliteTransaction<'a> {
  pub(crate) transaction: Transaction<'a>,
}

#[napi]
impl RusqliteTransaction<'_> {
  #[napi]
  pub fn savepoint(&mut self) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self.transaction.savepoint().map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint { savepoint })
  }

  #[napi]
  pub fn savepoint_with_name(&mut self, name: String) -> napi::Result<RusqliteSavepoint<'_>> {
    let savepoint = self
      .transaction
      .savepoint_with_name(name)
      .map_err(RusqliteError::from)?;
    Ok(RusqliteSavepoint { savepoint })
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
  pub fn finish(&self) -> napi::Result<()> {
    self
      .transaction
      .execute_batch("FINISH")
      .map_err(RusqliteError::from)?;
    Ok(())
  }
}

#[napi]
pub struct RusqliteSavepoint<'a> {
  pub(crate) savepoint: rusqlite::Savepoint<'a>,
}
