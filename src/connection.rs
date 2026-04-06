use napi::Env;
use napi_derive::napi;
use rusqlite::OpenFlags;

use crate::errors::RusqliteError;

#[napi]
pub struct RusqliteConnection {
  connection: rusqlite::Connection,
}

#[napi(object)]
pub struct RusqliteConnectionOptions {
  pub flags: i64,
  pub vfs: String,
}

#[napi]
impl RusqliteConnection {
  #[napi]
  pub fn open(path: String, options: Option<RusqliteConnectionOptions>) -> napi::Result<Self> {
    let connection = rusqlite::Connection::open(&path).map_err(RusqliteError::from)?;
    Ok(Self { connection })
  }
  #[napi]
  pub fn open_in_memory(options: Option<RusqliteConnectionOptions>) -> napi::Result<Self> {
    let connection = rusqlite::Connection::open_in_memory().map_err(RusqliteError::from)?;
    Ok(Self { connection })
  }
}
