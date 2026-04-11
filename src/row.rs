use std::collections::HashMap;

use napi::{Unknown, iterator::ScopedGenerator};
use napi_derive::napi;
use serde::Serialize;

use crate::errors::NodeRusqliteError;

pub struct ValueRef<'a>(pub(crate) rusqlite::types::ValueRef<'a>);

impl Serialize for ValueRef<'_> {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    match self.0 {
      rusqlite::types::ValueRef::Real(float) => serializer.serialize_f64(float),
      rusqlite::types::ValueRef::Integer(integer) => serializer.serialize_i64(integer),
      rusqlite::types::ValueRef::Blob(bytes) => serializer.serialize_bytes(bytes),
      rusqlite::types::ValueRef::Text(string) => {
        serializer.serialize_str(core::str::from_utf8(string).map_err(serde::ser::Error::custom)?)
      }
      rusqlite::types::ValueRef::Null => serializer.serialize_none(),
    }
  }
}

#[napi(iterator)]
pub struct Rows<'a> {
  pub(crate) rows: rusqlite::Rows<'a>,
}

#[napi]
impl<'a> Rows<'a> {
  #[napi(js_name = "toJSON")]
  pub fn to_json(&mut self) -> napi::Result<String> {
    let mut rows = vec![];

    while let Some(row) = self.rows.next().map_err(NodeRusqliteError::from)? {
      let mut value_map = HashMap::new();

      let columns = row.as_ref().columns();

      for column in columns {
        let raw_value = row
          .get_ref(column.name())
          .map_err(NodeRusqliteError::from)?;

        let value = serde_json::to_value(ValueRef(raw_value))
          .map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))
          .map_err(NodeRusqliteError::from)?;
        value_map.insert(column.name().to_string(), value);
      }
      rows.push(value_map);
    }

    serde_json::to_string(&rows).map_err(|err| napi::Error::from_reason(err.to_string()))
  }
}

#[napi]
impl<'a> ScopedGenerator<'a> for Rows<'a> {
  type Next = ();
  type Return = ();
  type Yield = Unknown<'a>;

  fn next(&mut self, env: &'a napi::Env, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let next_row = self.rows.next().ok().unwrap_or_default()?;

    let mut value_map = HashMap::new();

    let columns = next_row.as_ref().columns();

    for column in &columns {
      let raw_value = next_row.get_ref(column.name()).ok()?;
      value_map.insert(column.name(), ValueRef(raw_value));
    }

    env.to_js_value(&value_map).ok()
  }
}
