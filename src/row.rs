use std::collections::HashMap;

use napi::{Env, Unknown, bindgen_prelude::FromNapiValue, iterator::ScopedGenerator};
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use crate::errors::NodeRusqliteError;

pub struct ValueRef<'a>(pub(crate) rusqlite::types::ValueRef<'a>);

#[derive(Deserialize)]
#[serde(untagged)]
pub enum Value {
  Null,
  Integer(i64),
  Real(f64),
  Text(String),
  Blob(Vec<u8>),
}

impl Serialize for Value {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    match &self {
      Value::Null => serializer.serialize_none(),
      Value::Integer(i) => serializer.serialize_i64(*i),
      Value::Real(f) => serializer.serialize_f64(*f),
      Value::Text(s) => serializer.serialize_str(&s),
      Value::Blob(b) => serializer.serialize_bytes(&b),
    }
  }
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

#[napi]
pub struct Rows {
  pub(crate) rows: Vec<HashMap<String, Value>>,
}

#[napi]
impl Rows {
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

  #[napi(js_name = "toJSON")]
  pub fn to_json(&mut self, env: Env) -> napi::Result<Unknown<'_>> {
    env.to_js_value(&self.rows)
  }

  #[napi]
  pub fn iterate(&mut self) -> RowIterator<'_> {
    RowIterator { rows: &self.rows }
  }
}

#[napi(iterator)]
pub struct RowIterator<'a> {
  pub(crate) rows: &'a Vec<HashMap<String, Value>>,
}

#[napi]
impl<'a> ScopedGenerator<'a> for RowIterator<'a> {
  type Next = i64;
  type Return = ();
  type Yield = Unknown<'a>;

  fn next(&mut self, env: &'a napi::Env, value: Option<Self::Next>) -> Option<Self::Yield> {
    let row = self.rows.get(value.unwrap() as usize)?.clone();
    env.to_js_value(&row).ok()
  }
}
