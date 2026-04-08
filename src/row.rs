use std::collections::HashMap;

use napi::{bindgen_prelude::Buffer, iterator::Generator};
use napi_derive::napi;
use rusqlite::types::ValueRef;
use serde::Serialize;

pub struct RusqliteValueRef<'a>(pub(crate) rusqlite::types::ValueRef<'a>);

impl Serialize for RusqliteValueRef<'_> {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    match self.0 {
      ValueRef::Real(float) => serializer.serialize_f64(float),
      ValueRef::Integer(integer) => serializer.serialize_i64(integer),
      ValueRef::Blob(bytes) => serializer.serialize_bytes(bytes),
      ValueRef::Text(string) => {
        serializer.serialize_str(core::str::from_utf8(string).map_err(serde::ser::Error::custom)?)
      }
      ValueRef::Null => serializer.serialize_none(),
    }
  }
}

#[napi(iterator)]
pub struct RusqliteRows<'a> {
  pub(crate) rows: rusqlite::Rows<'a>,
}

#[napi]
impl<'a> Generator for RusqliteRows<'a> {
  type Next = ();
  type Return = ();
  type Yield = Buffer;

  fn next(&mut self, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let next_row = self.rows.next().ok().unwrap_or_default()?;

    let mut value_map = HashMap::new();

    let columns = next_row.as_ref().columns();

    for column in &columns {
      let raw_value = next_row.get_ref(column.name()).ok()?;
      value_map.insert(column.name(), RusqliteValueRef(raw_value));
    }

    serde_json::to_vec(&value_map).ok().map(Buffer::from)
  }
}
