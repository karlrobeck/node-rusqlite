use std::collections::HashMap;

use rusqlite::ToSql;
use serde::Deserialize;

use crate::row::{Value, ValueRef};

impl ToSql for Value {
  fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
    match self {
      Value::Null => Ok(rusqlite::types::ToSqlOutput::Owned(
        rusqlite::types::Value::Null,
      )),
      Value::Integer(i) => Ok(rusqlite::types::ToSqlOutput::Owned(
        rusqlite::types::Value::Integer(*i),
      )),
      Value::Real(f) => Ok(rusqlite::types::ToSqlOutput::Owned(
        rusqlite::types::Value::Real(*f),
      )),
      Value::Text(s) => Ok(rusqlite::types::ToSqlOutput::Owned(
        rusqlite::types::Value::Text(s.to_owned()),
      )),
      Value::Blob(b) => Ok(rusqlite::types::ToSqlOutput::Owned(
        rusqlite::types::Value::Blob(b.to_owned()),
      )),
    }
  }
}

pub fn row_to_unknown(row: &rusqlite::Row) -> Result<Vec<u8>, rusqlite::Error> {
  let mut map = HashMap::new();

  for column in row.as_ref().column_names() {
    let value = row.get_ref(column)?;
    map.insert(column.to_string(), Value::from(ValueRef(value)));
  }

  serde_json::to_vec(&map).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))
}
