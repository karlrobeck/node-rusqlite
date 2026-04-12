use napi_derive::napi;

/// The current SQLite transaction state for a connection.
#[napi]
pub enum TransactionState {
  /// No active transaction.
  None,
  /// An active read transaction.
  Read,
  /// An active write transaction.
  Write,
}

/// How a transaction should begin.
#[napi]
pub enum TransactionBehavior {
  /// Begin the transaction only when needed.
  Deferred,
  /// Begin the transaction immediately.
  Immediate,
  /// Begin the transaction exclusively.
  Exclusive,
}

/// What should happen when a transaction is dropped without being completed.
#[napi]
pub enum DropBehavior {
  /// Roll back the transaction on drop.
  Rollback,
  /// Commit the transaction on drop.
  Commit,
  /// Ignore the drop and leave the transaction state alone.
  Ignore,
  /// Panic if the transaction is dropped without being completed.
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
