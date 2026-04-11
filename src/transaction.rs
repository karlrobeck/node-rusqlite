use std::ops::Deref;

use napi::{
  Env,
  bindgen_prelude::{Function, Reference, SharedReference},
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
pub struct ScopedTransaction {
  pub(crate) transaction: SharedReference<RusqliteConnection, Transaction<'static>>,
}

#[napi]
impl ScopedTransaction {
  /// savepoint
  #[napi]
  pub fn savepoint(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
    callback: Function<ScopedSavepoint>,
  ) -> napi::Result<()> {
    let savepoint = self
      .transaction
      .savepoint()
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedSavepoint {
      savepoint: reference.share_with(env, |conn| {
        Ok(
          conn
            .connection
            .savepoint()
            .map_err(NodeRusqliteError::from)?,
        )
      })?,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.finish().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi]
  pub fn savepoint_with_name(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
    name: String,
    callback: Function<ScopedSavepoint>,
  ) -> napi::Result<()> {
    let savepoint = self
      .transaction
      .savepoint_with_name(name.clone())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedSavepoint {
      savepoint: reference.share_with(env, |conn| {
        Ok(
          conn
            .connection
            .savepoint_with_name(name.clone())
            .map_err(NodeRusqliteError::from)?,
        )
      })?,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.finish().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi(getter)]
  pub fn connection(&self) -> napi::Result<ScopedConnection<'_>> {
    Ok(ScopedConnection {
      connection: self.transaction.deref(),
    })
  }
}

impl Deref for ScopedTransaction {
  type Target = Connection;

  fn deref(&self) -> &Self::Target {
    &self.transaction
  }
}

#[napi]
pub struct ScopedSavepoint {
  pub(crate) savepoint: SharedReference<RusqliteConnection, rusqlite::Savepoint<'static>>,
}

#[napi]
impl ScopedSavepoint {
  #[napi]
  pub fn savepoint(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
  ) -> napi::Result<ScopedSavepoint> {
    // Ok(ScopedSavepoint {
    //   savepoint: reference.share_with(env, |conn| {
    //     Ok(
    //       conn
    //         .connection
    //         .savepoint()
    //         .map_err(NodeRusqliteError::from)?,
    //     )
    //   })?,
    //   name: Some("_rusqlite_sp".to_string()),
    //   commited: self.commited,
    // })
    todo!("")
  }

  #[napi]
  pub fn savepoint_with_name(
    &mut self,
    env: Env,
    reference: Reference<RusqliteConnection>,
    name: String,
  ) -> napi::Result<ScopedSavepoint> {
    // Ok(ScopedSavepoint {
    //   savepoint: reference.share_with(env, |conn| {
    //     Ok(
    //       conn
    //         .connection
    //         .savepoint_with_name(name.clone())
    //         .map_err(NodeRusqliteError::from)?,
    //     )
    //   })?,
    //   name: Some(name),
    //   commited: self.commited,
    // })
    todo!("")
  }

  #[napi(getter)]
  pub fn connection(&self) -> napi::Result<ScopedConnection<'_>> {
    Ok(ScopedConnection {
      connection: self.savepoint.deref(),
    })
  }
}
