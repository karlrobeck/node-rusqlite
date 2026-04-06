use napi::Env;

pub trait ThrowNapiError {
  fn throw(&self, env: &Env) -> napi::Result<()>;
}

pub struct RusqliteError(rusqlite::Error);

impl From<rusqlite::Error> for RusqliteError {
  fn from(value: rusqlite::Error) -> Self {
    Self(value)
  }
}

impl From<RusqliteError> for napi::Error {
  fn from(value: RusqliteError) -> Self {
    let message = value.0.to_string();
    Self::new(napi::Status::GenericFailure, message)
  }
}
