use std::collections::HashMap;

use napi::{JsValue, Status, Unknown};
use rusqlite::{types::Value, ToSql};
use serde::Deserialize;

use crate::row::RusqliteValueRef;

#[derive(Deserialize)]
pub enum RusqliteValue {
  Null,
  Integer(i64),
  Real(f64),
  Text(String),
  Blob(Vec<u8>),
}

impl ToSql for RusqliteValue {
  fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
    match self {
      RusqliteValue::Null => Ok(rusqlite::types::ToSqlOutput::Owned(Value::Null)),
      RusqliteValue::Integer(i) => Ok(rusqlite::types::ToSqlOutput::Owned(Value::Integer(*i))),
      RusqliteValue::Real(f) => Ok(rusqlite::types::ToSqlOutput::Owned(Value::Real(*f))),
      RusqliteValue::Text(s) => Ok(rusqlite::types::ToSqlOutput::Owned(Value::Text(
        s.to_owned(),
      ))),
      RusqliteValue::Blob(b) => Ok(rusqlite::types::ToSqlOutput::Owned(Value::Blob(
        b.to_owned(),
      ))),
    }
  }
}

pub fn row_to_buffer(row: &rusqlite::Row) -> Result<Vec<u8>, rusqlite::Error> {
  let mut map = HashMap::new();

  for column in row.as_ref().column_names() {
    let value = row.get_ref(column)?;
    map.insert(column.to_string(), RusqliteValueRef(value));
  }

  serde_json::to_vec(&map).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))
}
