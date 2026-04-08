use napi::Env;

pub trait ThrowNapiError {
  fn throw(&self, env: &Env) -> napi::Result<()>;
}

pub struct RusqliteError(pub(crate) rusqlite::Error);

impl From<rusqlite::Error> for RusqliteError {
  fn from(value: rusqlite::Error) -> Self {
    Self(value)
  }
}

impl From<serde_json::Error> for RusqliteError {
  fn from(value: serde_json::Error) -> Self {
    Self(rusqlite::Error::ToSqlConversionFailure(Box::new(value)))
  }
}

impl From<RusqliteError> for napi::Error {
  fn from(value: RusqliteError) -> Self {
    let message = value.0.to_string();
    Self::new(napi::Status::GenericFailure, message)
  }
}
