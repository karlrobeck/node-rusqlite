use std::collections::HashMap;

use napi::{Env, Unknown, iterator::ScopedGenerator};
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use crate::errors::NodeRusqliteError;

/// A borrowed SQLite value used while converting query results into JavaScript-friendly data.
pub struct ValueRef<'a>(pub(crate) rusqlite::types::ValueRef<'a>);

/// A single SQLite value converted into a JSON-serializable shape for JavaScript.
#[derive(Deserialize, Serialize)]
#[serde(untagged)]
pub enum Value {
  /// A SQL `NULL` value.
  Null,
  /// A signed integer value.
  Integer(i64),
  /// A floating-point value.
  Real(f64),
  /// UTF-8 text.
  Text(String),
  /// A binary blob.
  Blob(Vec<u8>),
}

impl From<ValueRef<'_>> for Value {
  fn from(value_ref: ValueRef) -> Self {
    match value_ref.0 {
      rusqlite::types::ValueRef::Real(float) => Value::Real(float),
      rusqlite::types::ValueRef::Integer(integer) => Value::Integer(integer),
      rusqlite::types::ValueRef::Blob(bytes) => Value::Blob(bytes.to_vec()),
      rusqlite::types::ValueRef::Text(string) => {
        Value::Text(String::from_utf8(string.to_vec()).expect("Unable to parse utf-8 text string"))
      }
      rusqlite::types::ValueRef::Null => Value::Null,
    }
  }
}

/// A collection of query result rows, stored in a JavaScript-friendly format.
#[napi]
pub struct Rows {
  pub(crate) rows: Vec<HashMap<String, Value>>,
}

#[napi]
impl Rows {
  /// Reads all rows from a SQLite cursor and stores them in memory.
  /// @returns A `Rows` value containing every row as a map of column names to values.
  pub fn new(mut rows: rusqlite::Rows<'_>) -> Self {
    let mut value_rows = vec![];

    while let Some(row) = rows.next().ok().unwrap_or_default() {
      let mut value_map = HashMap::new();

      let columns = row.as_ref().columns();

      for column in columns {
        let raw_value = row
          .get_ref(column.name())
          .map_err(NodeRusqliteError::from)
          .unwrap_or(rusqlite::types::ValueRef::Null);

        value_map.insert(column.name().to_string(), Value::from(ValueRef(raw_value)));
      }
      value_rows.push(value_map);
    }

    Self { rows: value_rows }
  }

  /// Converts the rows collection into a JavaScript value.
  /// @returns A JavaScript representation of all rows.
  #[napi(js_name = "toJSON", ts_return_type = "Record<string, unknown>[]")]
  pub fn to_json(&mut self, env: Env) -> napi::Result<Unknown<'_>> {
    env.to_js_value(&self.rows)
  }

  /// Creates an iterator that yields each row one at a time.
  #[napi]
  pub fn iterate(&mut self) -> RowIterator<'_> {
    RowIterator {
      rows: &self.rows,
      next: 0,
    }
  }

  /// Returns the row at the provided zero-based index.
  /// @param index - The zero-based row index.
  /// @returns The row at `index`, or `undefined` when the index is out of bounds.
  #[napi]
  pub fn get(&self, env: Env, index: i64) -> napi::Result<Option<Unknown<'_>>> {
    let row = self.rows.get(index as usize);

    if let Some(row) = row {
      let metadata = env.to_js_value(&row)?;
      Ok(Some(metadata))
    } else {
      Ok(None)
    }
  }
}

/// An iterator over a `Rows` collection for JavaScript consumers.
#[napi(iterator)]
pub struct RowIterator<'a> {
  next: usize,
  pub(crate) rows: &'a Vec<HashMap<String, Value>>,
}

#[napi]
impl<'a> ScopedGenerator<'a> for RowIterator<'a> {
  type Next = ();
  type Return = i64;
  type Yield = Unknown<'a>;

  /// Returns the next row from the iterator.
  /// @returns The next row as a JavaScript value, or `undefined` when iteration is complete.
  fn next(&mut self, env: &'a napi::Env, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let row = self.rows.get(self.next)?;

    self.next += 1;

    env.to_js_value(&row).ok()
  }
}
