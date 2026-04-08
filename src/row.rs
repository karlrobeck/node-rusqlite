use napi::{
  bindgen_prelude::{Buffer, Either5, Null, Object},
  iterator::{Generator, ScopedGenerator},
  Either,
};
use napi_derive::napi;
use rusqlite::types::{Type, ValueRef};

use crate::errors::RusqliteError;

#[napi]
pub struct RusqliteRow<'a> {
  pub(crate) row: &'a rusqlite::Row<'a>,
}

fn to_raw_bytes(value: ValueRef<'_>, r#type: Type) -> Vec<u8> {
  let bytes = match r#type {
    rusqlite::types::Type::Text => value.as_str().unwrap().as_bytes().to_vec(),
    rusqlite::types::Type::Integer => value.as_i64().unwrap().to_be_bytes().to_vec(),
    rusqlite::types::Type::Real => value.as_i64().unwrap().to_be_bytes().to_vec(),
    rusqlite::types::Type::Blob => value.as_blob().unwrap().to_vec(),
    rusqlite::types::Type::Null => b"\0".to_vec(),
  };

  bytes
}

#[napi]
impl<'a> RusqliteRow<'a> {
  #[napi(ts_return_type = "string | number | Uint8Array | null")]
  pub fn get(&self, index: Either<String, i64>) -> napi::Result<Buffer> {
    let result = match index {
      Either::A(string) => self.row.get_ref(&*string),
      Either::B(number) => self.row.get_ref(number as usize),
    }
    .map_err(RusqliteError::from)?;

    let r#type = result.data_type();

    Ok(to_raw_bytes(result, r#type).into())
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
  type Yield = Buffer;

  fn next(&mut self, _value: Option<Self::Next>) -> Option<Self::Yield> {
    let next_row = self.rows.next().ok().unwrap_or_default()?;

    let mut values = vec![];

    for column in &self.columns {
      let raw_value = next_row.get_ref(&**column).unwrap();

      let r#type = raw_value.data_type();

      let value = to_raw_bytes(raw_value, r#type);

      values.push(value);
    }

    let buffer = values
      .into_iter()
      .flat_map(|col| {
        let len = col.len() as u32;
        len
          .to_le_bytes()
          .iter()
          .copied()
          .chain(col)
          .collect::<Vec<_>>()
      })
      .collect::<Vec<_>>();

    Some(buffer.into())
  }
}
