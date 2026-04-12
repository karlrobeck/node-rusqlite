use napi_derive::napi;

/// Metadata about the origin of a column of a SQLite query
#[napi]
pub struct ColumnMetadata<'a> {
  pub(crate) metadata: rusqlite::ColumnMetadata<'a>,
}

#[napi]
impl<'a> ColumnMetadata<'a> {
  /// Returns the name of the column in the query results
  #[napi]
  pub fn name(&self) -> napi::Result<String> {
    Ok(self.metadata.name().to_string())
  }

  /// Returns the database name from which the column originates
  #[napi]
  pub fn database_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.database_name().map(|val| val.to_string()))
  }

  /// Returns the table name from which the column originates
  #[napi]
  pub fn table_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.table_name().map(|val| val.to_string()))
  }

  /// Returns the column name from which the column originates
  #[napi]
  pub fn origin_name(&self) -> napi::Result<Option<String>> {
    Ok(self.metadata.origin_name().map(|val| val.to_string()))
  }
}

/// Information about a column of a SQLite query.
#[napi]
pub struct Column<'a> {
  pub(crate) column: rusqlite::Column<'a>,
}

#[napi]
impl<'a> Column<'a> {
  /// Returns the name of the column.
  #[napi]
  pub fn name(&self) -> napi::Result<String> {
    Ok(self.column.name().to_string())
  }
  /// Returns the type of the column (`null` for expression).
  #[napi]
  pub fn decl_type(&self) -> napi::Result<Option<String>> {
    Ok(self.column.decl_type().map(|val| val.to_string()))
  }
}

#[napi(object)]
pub struct ConnectionColumnMetadata {
  /// declared data type
  pub r#type: Option<String>,
  /// name of default collation sequence
  pub collation_sequence: Option<String>,
  /// `true` if column has a NOT NULL constraint
  pub not_null: bool,
  /// `true` if column is part of the PRIMARY KEY
  pub primary_key: bool,
  /// `true` if column is AUTOINCREMENT
  pub auto_increment: bool,
}
