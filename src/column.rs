use napi_derive::napi;

#[napi]
pub struct RusqliteColumnMetadata<'a> {
  pub(crate) metadata: rusqlite::ColumnMetadata<'a>,
}

#[napi]
impl<'a> RusqliteColumnMetadata<'a> {
  #[napi]
  pub fn name(&self) -> napi::Result<String> {
    Ok(self.metadata.name().to_string())
  }
  #[napi]
  pub fn database_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.database_name().map(|val| val.to_string()))
  }
  #[napi]
  pub fn table_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.table_name().map(|val| val.to_string()))
  }
  #[napi]
  pub fn origin_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.origin_name().map(|val| val.to_string()))
  }
}

#[napi]
pub struct RusqliteColumn<'a> {
  pub(crate) column: rusqlite::Column<'a>,
}

#[napi]
impl<'a> RusqliteColumn<'a> {
  #[napi]
  pub fn name(&self) -> napi::Result<String> {
    Ok(self.column.name().to_string())
  }
  #[napi]
  pub fn decl_type(&self) -> napi::Result<Option<String>> {
    Ok(self.column.decl_type().map(|val| val.to_string()))
  }
}
