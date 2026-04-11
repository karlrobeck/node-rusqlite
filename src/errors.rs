use napi::Env;

pub trait ThrowNapiError {
  fn throw(&self, env: &Env) -> napi::Result<()>;
}

pub struct NodeRusqliteError(pub(crate) rusqlite::Error);

impl From<rusqlite::Error> for NodeRusqliteError {
  fn from(value: rusqlite::Error) -> Self {
    Self(value)
  }
}

impl From<serde_json::Error> for NodeRusqliteError {
  fn from(value: serde_json::Error) -> Self {
    Self(rusqlite::Error::ToSqlConversionFailure(Box::new(value)))
  }
}

impl From<NodeRusqliteError> for napi::Error {
  fn from(value: NodeRusqliteError) -> Self {
    let message = value.0.to_string();
    Self::new(napi::Status::GenericFailure, message)
  }
}
