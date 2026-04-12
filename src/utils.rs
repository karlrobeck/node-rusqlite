use std::collections::HashMap;

use rusqlite::ToSql;

use crate::row::{Value, ValueRef};

/// Converts a JS-friendly [`Value`] into a SQLite parameter value.
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

/// Parses a SQLite row into a map of column names to JS-friendly values.
///
/// Each column is read by name and converted into the shared [`Value`] enum used
/// by the N-API layer.
pub fn parse_rows(row: &rusqlite::Row) -> Result<HashMap<String, Value>, rusqlite::Error> {
  let mut map = HashMap::new();

  for column in row.as_ref().column_names() {
    let value = row.get_ref(column)?;
    map.insert(column.to_string(), Value::from(ValueRef(value)));
  }

  Ok(map)
}
