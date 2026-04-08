use std::collections::HashMap;

use napi::{Env, JsValue, Status, Unknown};
use rusqlite::{types::Value, ToSql};

use crate::row::RusqliteValueRef;

pub fn napi_value_to_sql_param(value: Unknown) -> napi::Result<impl ToSql> {
  let r#type = value.get_type()?;

  let value = match r#type {
    napi::ValueType::Boolean => {
      if value.coerce_to_bool()? {
        Value::Integer(1)
      } else {
        Value::Integer(0)
      }
    }
    napi::ValueType::Null => Value::Null,
    napi::ValueType::Number => Value::Integer(value.coerce_to_number()?.get_int64()?),
    napi::ValueType::String => Value::Text(
      value
        .coerce_to_string()?
        .into_utf8()?
        .as_str()
        .unwrap()
        .to_string(),
    ),
    _ => {
      return Err(napi::Error::new(
        Status::GenericFailure,
        "Unsupported data type",
      ))
    }
  };

  Ok(value)
}

pub fn row_to_buffer(row: &rusqlite::Row) -> Result<Vec<u8>, rusqlite::Error> {
  let mut map = HashMap::new();

  for column in row.as_ref().column_names() {
    let value = row.get_ref(column)?;
    map.insert(column.to_string(), RusqliteValueRef(value));
  }

  serde_json::to_vec(&map).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))
}
