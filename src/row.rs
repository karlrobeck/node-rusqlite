use std::collections::HashMap;

use napi::{iterator::Generator, Either};
use napi_derive::napi;
use rusqlite::types::ValueRef;
use serde::Serialize;

use crate::errors::RusqliteError;

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
      ValueRef::Text(string) => serializer.serialize_str(core::str::from_utf8(string).unwrap()),
      ValueRef::Null => serializer.serialize_none(),
    }
  }
}

#[napi]
pub struct RusqliteRow<'a> {
  pub(crate) row: &'a rusqlite::Row<'a>,
}

#[napi]
impl<'a> RusqliteRow<'a> {
  pub fn get(&self, index: Either<String, i64>) -> napi::Result<String> {
    let result = match index {
      Either::A(string) => self.row.get_ref(&*string),
      Either::B(number) => self.row.get_ref(number as usize),
    }
    .map_err(RusqliteError::from)?;

    Ok(serde_json::to_string(&RusqliteValueRef(result)).unwrap())
  }
}

#[napi(iterator)]
pub struct RusqliteRows<'a> {
  pub(crate) rows: rusqlite::Rows<'a>,
  pub(crate) columns: Vec<String>,
}

#[napi]
impl<'a> Generator for RusqliteRows<'a> {
  type Next = ();
  type Return = ();
  type Yield = String;

  fn next(&mut self, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let next_row = self.rows.next().ok().unwrap_or_default()?;

    let mut value_map = HashMap::new();

    for column in &self.columns {
      let raw_value = next_row.get_ref(&**column).unwrap();

      value_map.insert(column, RusqliteValueRef(raw_value));
    }

    let json_string = serde_json::to_string(&value_map).unwrap();

    Some(json_string)
  }
}
