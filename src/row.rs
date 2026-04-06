use napi::{
  bindgen_prelude::{Buffer, Either5, Null},
  Either,
};
use napi_derive::napi;

use crate::errors::RusqliteError;

#[napi]
pub struct RusqliteRow<'a> {
  row: rusqlite::Row<'a>,
}

#[napi]
impl<'a> RusqliteRow<'a> {
  #[napi]
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
