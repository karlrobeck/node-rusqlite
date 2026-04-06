use napi::{
  bindgen_prelude::{Buffer, Either5, Null, Object},
  iterator::{Generator, ScopedGenerator},
  Either,
};
use napi_derive::napi;

use crate::errors::RusqliteError;

#[napi]
pub struct RusqliteRow<'a> {
  pub(crate) row: &'a rusqlite::Row<'a>,
}

#[napi]
impl<'a> RusqliteRow<'a> {
  #[napi(ts_return_type = "string | number | Uint8Array | null")]
  pub fn get(
    &self,
    index: Either<String, i64>,
  ) -> napi::Result<Either5<String, i64, f64, Buffer, Null>> {
    let result = match index {
      Either::A(string) => self.row.get_ref(&*string),
      Either::B(number) => self.row.get_ref(number as usize),
    }
    .map_err(RusqliteError::from)?;

    let r#type = result.data_type();

    let value = match r#type {
      rusqlite::types::Type::Text => Either5::A(result.as_str().unwrap().to_string()),
      rusqlite::types::Type::Integer => Either5::B(result.as_i64().unwrap()),
      rusqlite::types::Type::Real => Either5::C(result.as_f64().unwrap()),
      rusqlite::types::Type::Blob => Either5::D(Buffer::from(result.as_blob().unwrap())),
      rusqlite::types::Type::Null => Either5::E(Null),
    };

    Ok(value)
  }
}

#[napi(iterator)]
pub struct RusqliteRows<'a> {
  pub(crate) rows: rusqlite::Rows<'a>,
  pub(crate) columns: Vec<String>,
}

#[napi]
impl<'a> ScopedGenerator<'a> for RusqliteRows<'a> {
  type Next = ();
  type Return = ();
  type Yield = Object<'a>;

  fn next(&mut self, env: &'a napi::Env, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let next_row = self.rows.next().ok().unwrap_or_default()?;

    let mut js_object = Object::new(env).unwrap();

    for column in &self.columns {
      let raw_value = next_row.get_ref(&**column).unwrap();

      let r#type = raw_value.data_type();

      let value = match r#type {
        rusqlite::types::Type::Text => Either5::A(raw_value.as_str().unwrap().to_string()),
        rusqlite::types::Type::Integer => Either5::B(raw_value.as_i64().unwrap()),
        rusqlite::types::Type::Real => Either5::C(raw_value.as_f64().unwrap()),
        rusqlite::types::Type::Blob => Either5::D(Buffer::from(raw_value.as_blob().unwrap())),
        rusqlite::types::Type::Null => Either5::E(Null),
      };

      js_object.set(column, value).unwrap();
    }

    Some(js_object)
  }
}
