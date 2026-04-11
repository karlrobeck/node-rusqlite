use std::ops::Deref;

use napi::{
  Env,
  bindgen_prelude::{Reference, SharedReference},
};
use napi_derive::napi;
use rusqlite::{Connection, Transaction};

use crate::{
  connection::{RusqliteConnection, ScopedConnection},
  errors::NodeRusqliteError,
};

#[napi]
pub enum TransactionState {
  None,
  Read,
  Write,
}

#[napi]
pub enum TransactionBehavior {
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

#[napi]
pub struct ScopedTransaction<'a> {
  pub(crate) transaction: &'a Transaction<'a>,
}

#[napi]
impl ScopedTransaction<'_> {
  /// savepoint
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
      name: Some("_rusqlite_sp".to_string()),
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

  #[napi(getter)]
  pub fn connection(&self) -> napi::Result<ScopedConnection<'_>> {
    Ok(ScopedConnection {
      connection: self.transaction.deref(),
    })
  }
}

impl Deref for ScopedTransaction<'_> {
  type Target = Connection;

  fn deref(&self) -> &Self::Target {
    &self.transaction
  }
}

#[napi]
pub struct ScopedSavepoint {
  pub(crate) savepoint: SharedReference<RusqliteConnection, rusqlite::Savepoint<'static>>,
  pub(crate) name: Option<String>,
  pub(crate) commited: bool,
}

#[napi]
impl ScopedSavepoint {
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
      name: Some("_rusqlite_sp".to_string()),
      commited: self.commited,
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
      .map_err(NodeRusqliteError::from)?;
    self.commited = true;
    Ok(())
  }

  #[napi]
  pub fn rollback(&mut self) -> napi::Result<()> {
    self.savepoint.rollback().map_err(NodeRusqliteError::from)?;
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
  pub fn connection(&self) -> napi::Result<ScopedConnection<'_>> {
    Ok(ScopedConnection {
      connection: self.savepoint.deref(),
    })
  }
}
