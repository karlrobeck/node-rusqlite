use napi::Env;

/// A helper for surfacing a Rust error as a JavaScript exception.
pub trait ThrowNapiError {
  /// Throws the error into the provided N-API environment.
  fn throw(&self, env: &Env) -> napi::Result<()>;
}

/// Wrapper around `rusqlite::Error` used for converting errors into N-API errors.
pub struct NodeRusqliteError(pub(crate) rusqlite::Error);

/// Converts a SQLite error into the internal Node-Rusqlite error wrapper.
impl From<rusqlite::Error> for NodeRusqliteError {
  fn from(value: rusqlite::Error) -> Self {
    Self(value)
  }
}

/// Converts a JSON serialization error into a SQLite-compatible conversion error.
impl From<serde_json::Error> for NodeRusqliteError {
  fn from(value: serde_json::Error) -> Self {
    Self(rusqlite::Error::ToSqlConversionFailure(Box::new(value)))
  }
}

/// Converts a Node-Rusqlite error into a N-API error.
impl From<NodeRusqliteError> for napi::Error {
  fn from(value: NodeRusqliteError) -> Self {
    let message = value.0.to_string();
    Self::new(napi::Status::GenericFailure, message)
  }
}
