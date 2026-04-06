use napi::{
  bindgen_prelude::{JsValuesTupleIntoVec, ToNapiValue},
  Env, JsValue, Status, Unknown,
};
use rusqlite::{types::Value, ToSql};

pub fn napi_value_to_sql_param(env: &Env, value: Unknown) -> napi::Result<impl ToSql> {
  let r#type = value.get_type()?;

  let value = match r#type {
    napi::ValueType::Boolean => {
      if value.coerce_to_bool()? == true {
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
