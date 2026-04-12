use std::{collections::HashMap, ops::Deref};

use napi::{
  Env, Unknown,
  bindgen_prelude::{Array, Function, ObjectFinalize},
};
use napi_derive::napi;
use rusqlite::{PrepFlags, params_from_iter};

use crate::{
  column::ConnectionColumnMetadata,
  errors::NodeRusqliteError,
  row::Value,
  statement::{RusqlitePrepFlags, ScopedStatement},
  transaction::{TransactionBehavior, TransactionState},
  utils::parse_rows,
};

#[napi]
pub enum RusqliteDbConfig {
  SqliteDbconfigEnableFkey = 1_002,
  SqliteDbconfigEnableTrigger = 1_003,
  SqliteDbconfigEnableFts3Tokenizer = 1_004,
  SqliteDbconfigNoCkptOnClose = 1_006,
  SqliteDbconfigEnableQpsg = 1_007,
  SqliteDbconfigTriggerEqp = 1_008,
  SqliteDbconfigResetDatabase = 1_009,
  SqliteDbconfigDefensive = 1_010,
  SqliteDbconfigWritableSchema = 1_011,
  SqliteDbconfigLegacyAlterTable = 1_012,
  SqliteDbconfigDqsDml = 1_013,
  SqliteDbconfigDqsDdl = 1_014,
  SqliteDbconfigEnableView = 1_015,
  SqliteDbconfigLegacyFileFormat = 1_016,
  SqliteDbconfigTrustedSchema = 1_017,
  SqliteDbconfigStmtScanStatus = 1_018,
  SqliteDbconfigReverseScanOrder = 1_019,
  SqliteDbconfigEnableAttachCreate = 1_020,
  SqliteDbconfigEnableAttachWrite = 1_021,
  SqliteDbconfigEnableComments = 1_022,
}

impl From<RusqliteDbConfig> for rusqlite::config::DbConfig {
  fn from(value: RusqliteDbConfig) -> Self {
    match value {
      RusqliteDbConfig::SqliteDbconfigEnableFkey => Self::SQLITE_DBCONFIG_ENABLE_FKEY,
      RusqliteDbConfig::SqliteDbconfigEnableTrigger => Self::SQLITE_DBCONFIG_ENABLE_TRIGGER,
      RusqliteDbConfig::SqliteDbconfigEnableFts3Tokenizer => {
        Self::SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER
      }
      RusqliteDbConfig::SqliteDbconfigNoCkptOnClose => Self::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
      RusqliteDbConfig::SqliteDbconfigEnableQpsg => Self::SQLITE_DBCONFIG_ENABLE_QPSG,
      RusqliteDbConfig::SqliteDbconfigTriggerEqp => Self::SQLITE_DBCONFIG_TRIGGER_EQP,
      RusqliteDbConfig::SqliteDbconfigResetDatabase => Self::SQLITE_DBCONFIG_RESET_DATABASE,
      RusqliteDbConfig::SqliteDbconfigDefensive => Self::SQLITE_DBCONFIG_DEFENSIVE,
      RusqliteDbConfig::SqliteDbconfigWritableSchema => Self::SQLITE_DBCONFIG_WRITABLE_SCHEMA,
      RusqliteDbConfig::SqliteDbconfigLegacyAlterTable => Self::SQLITE_DBCONFIG_LEGACY_ALTER_TABLE,
      RusqliteDbConfig::SqliteDbconfigDqsDml => Self::SQLITE_DBCONFIG_DQS_DML,
      RusqliteDbConfig::SqliteDbconfigDqsDdl => Self::SQLITE_DBCONFIG_DQS_DDL,
      RusqliteDbConfig::SqliteDbconfigEnableView => Self::SQLITE_DBCONFIG_ENABLE_VIEW,
      RusqliteDbConfig::SqliteDbconfigLegacyFileFormat => Self::SQLITE_DBCONFIG_LEGACY_FILE_FORMAT,
      RusqliteDbConfig::SqliteDbconfigTrustedSchema => Self::SQLITE_DBCONFIG_TRUSTED_SCHEMA,
      RusqliteDbConfig::SqliteDbconfigStmtScanStatus => Self::SQLITE_DBCONFIG_STMT_SCANSTATUS,
      RusqliteDbConfig::SqliteDbconfigReverseScanOrder => Self::SQLITE_DBCONFIG_REVERSE_SCANORDER,
      RusqliteDbConfig::SqliteDbconfigEnableAttachCreate => {
        Self::SQLITE_DBCONFIG_ENABLE_ATTACH_CREATE
      }
      RusqliteDbConfig::SqliteDbconfigEnableAttachWrite => {
        Self::SQLITE_DBCONFIG_ENABLE_ATTACH_WRITE
      }
      RusqliteDbConfig::SqliteDbconfigEnableComments => Self::SQLITE_DBCONFIG_ENABLE_COMMENTS,
    }
  }
}

#[napi(custom_finalize)]
pub struct Connection {
  pub(crate) connection: rusqlite::Connection,
}

impl Deref for Connection {
  type Target = rusqlite::Connection;

  fn deref(&self) -> &Self::Target {
    &self.connection
  }
}

#[napi]
pub struct ScopedConnection<'a> {
  pub(crate) connection: &'a rusqlite::Connection,
}

#[napi(object)]
pub struct Progress {
  pub remaining: i32,
  pub page_count: i32,
}

#[napi(object)]
pub struct ConnectionOptions {
  pub flags: Option<i32>,
  pub vfs: Option<String>,
}

#[napi]
pub enum OpenFlags {
  SqliteOpenReadonly = 0x00000001,      /* Ok for sqlite3_open_v2() */
  SqliteOpenReadwrite = 0x00000002,     /* Ok for sqlite3_open_v2() */
  SqliteOpenCreate = 0x00000004,        /* Ok for sqlite3_open_v2() */
  SqliteOpenDELETEONCLOSE = 0x00000008, /* VFS only */
  SqliteOpenEXCLUSIVE = 0x00000010,     /* VFS only */
  SqliteOpenAUTOPROXY = 0x00000020,     /* VFS only */
  SqliteOpenURI = 0x00000040,           /* Ok for sqlite3_open_v2() */
  SqliteOpenMEMORY = 0x00000080,        /* Ok for sqlite3_open_v2() */
  SqliteOpenMainDb = 0x00000100,        /* VFS only */
  SqliteOpenTempDb = 0x00000200,        /* VFS only */
  SqliteOpenTransientDb = 0x00000400,   /* VFS only */
  SqliteOpenMainJournal = 0x00000800,   /* VFS only */
  SqliteOpenTempJournal = 0x00001000,   /* VFS only */
  SqliteOpenSubjournal = 0x00002000,    /* VFS only */
  SqliteOpenSuperJournal = 0x00004000,  /* VFS only */
  SqliteOpenNomutex = 0x00008000,       /* Ok for sqlite3_open_v2() */
  SqliteOpenFullmutex = 0x00010000,     /* Ok for sqlite3_open_v2() */
  SqliteOpenSharedcache = 0x00020000,   /* Ok for sqlite3_open_v2() */
  SqliteOpenPrivatecache = 0x00040000,  /* Ok for sqlite3_open_v2() */
  SqliteOpenWal = 0x00080000,           /* VFS only */
  SqliteOpenNofollow = 0x01000000,      /* Ok for sqlite3_open_v2() */
  SqliteOpenExrescode = 0x02000000,     /* Extended result codes */
}

#[napi]
pub struct InterruptHandle {
  pub(crate) handle: rusqlite::InterruptHandle,
}

#[napi]
impl InterruptHandle {
  #[napi]
  pub fn interrupt(&self) {
    self.handle.interrupt();
  }
}

#[napi]
impl ScopedConnection<'_> {
  #[napi]
  pub fn column_exists(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self
        .connection
        .column_exists(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_exists(None, &*table_name, &*column_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  #[napi]
  pub fn column_metadata(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<ConnectionColumnMetadata> {
    let metadata = match db_name {
      Some(db_name) => self
        .connection
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_metadata(None, &*table_name, &*column_name),
    };

    let metadata = metadata.map_err(NodeRusqliteError::from)?;

    Ok(ConnectionColumnMetadata {
      r#type: metadata.0.map(|val| val.to_str().unwrap().to_string()),
      collation_sequence: metadata.1.map(|val| val.to_str().unwrap().to_string()),
      not_null: metadata.2,
      primary_key: metadata.3,
      auto_increment: metadata.4,
    })
  }

  #[napi]
  pub fn db_config(&self, config: RusqliteDbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
      .set_db_config(config.into(), on)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi(ts_return_type = "unknown")]
  pub fn pragma_query_value(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, parse_rows)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_query(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => self
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
        value = parse_rows(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi]
  pub fn pragma(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
    #[napi(ts_arg_type = "(value: Record<string, unknown>) => void")] callback: Function<
      Unknown<'_>,
    >,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            value = parse_rows(row)?;
            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
    }
    .map_err(NodeRusqliteError::from)?;

    callback.call(env.to_js_value(&value).expect("Unable to convert value"))?;

    Ok(())
  }

  #[napi]
  pub fn pragma_update(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .connection
        .pragma_update(None, &pragma_name, &sql_value),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(())
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_update_and_check(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
  ) -> napi::Result<Unknown<'_>> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        parse_rows,
      ),
      None => self
        .connection
        .pragma_update_and_check(None, &pragma_name, &sql_value, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi(ts_args_type = "callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi(ts_args_type = "name: string, callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint_with_name(
    &mut self,
    name: String,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint_with_name(&name)
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .connection
      .execute_batch(&sql)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<i64> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let result = self
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_row(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let row = self
      .connection
      .query_row(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_one(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let row = self
      .connection
      .query_one(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  #[napi(ts_args_type = "sql:string, callback: (statement: ScopedStatement) => void")]
  pub fn prepare(&self, sql: String, callback: Function<ScopedStatement>) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare(&sql)
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  #[napi(
    ts_args_type = "sql:string, flags: RusqlitePrepFlags, callback: (statement: ScopedStatement) => void"
  )]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
    callback: Function<ScopedStatement>,
  ) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<InterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(InterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
        .is_readonly(&*db_name)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl Connection {
  #[napi(factory)]
  pub fn open(path: String, options: Option<ConnectionOptions>) -> napi::Result<Connection> {
    let connection = match options {
      Some(option) => match (option.flags, option.vfs) {
        (Some(flags), Some(vfs)) => rusqlite::Connection::open_with_flags_and_vfs(
          &path,
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (Some(flags), None) => rusqlite::Connection::open_with_flags(
          &path,
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
        )
        .map_err(NodeRusqliteError::from)?,
        (None, Some(vfs)) => {
          rusqlite::Connection::open_with_flags_and_vfs(&path, rusqlite::OpenFlags::empty(), &*vfs)
            .map_err(NodeRusqliteError::from)?
        }
        (None, None) => rusqlite::Connection::open(&path).map_err(NodeRusqliteError::from)?,
      },
      None => rusqlite::Connection::open(&path).map_err(NodeRusqliteError::from)?,
    };

    Ok(Self { connection })
  }

  #[napi(factory)]
  pub fn open_in_memory(options: Option<ConnectionOptions>) -> napi::Result<Connection> {
    let connection = match options {
      Some(option) => match (option.flags, option.vfs) {
        (Some(flags), Some(vfs)) => rusqlite::Connection::open_in_memory_with_flags_and_vfs(
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (Some(flags), None) => rusqlite::Connection::open_in_memory_with_flags(
          rusqlite::OpenFlags::from_bits(flags).unwrap(),
        )
        .map_err(NodeRusqliteError::from)?,
        (None, Some(vfs)) => rusqlite::Connection::open_in_memory_with_flags_and_vfs(
          rusqlite::OpenFlags::empty(),
          &*vfs,
        )
        .map_err(NodeRusqliteError::from)?,
        (None, None) => rusqlite::Connection::open_in_memory().map_err(NodeRusqliteError::from)?,
      },
      None => rusqlite::Connection::open_in_memory().map_err(NodeRusqliteError::from)?,
    };

    Ok(Self { connection })
  }

  #[napi]
  pub fn column_exists(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self
        .connection
        .column_exists(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_exists(None, &*table_name, &*column_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  #[napi]
  pub fn table_exists(&self, db_name: Option<String>, table_name: String) -> napi::Result<bool> {
    let exists = match db_name {
      Some(db_name) => self.connection.table_exists(Some(&*db_name), &table_name),
      None => self.connection.table_exists(None, &*table_name),
    };

    Ok(exists.map_err(NodeRusqliteError::from)?)
  }

  #[napi]
  pub fn column_metadata(
    &self,
    db_name: Option<String>,
    table_name: String,
    column_name: String,
  ) -> napi::Result<ConnectionColumnMetadata> {
    let metadata = match db_name {
      Some(db_name) => self
        .connection
        .column_metadata(Some(&*db_name), &table_name, &column_name),
      None => self
        .connection
        .column_metadata(None, &*table_name, &*column_name),
    };

    let metadata = metadata.map_err(NodeRusqliteError::from)?;

    Ok(ConnectionColumnMetadata {
      r#type: metadata.0.map(|val| val.to_str().unwrap().to_string()),
      collation_sequence: metadata.1.map(|val| val.to_str().unwrap().to_string()),
      not_null: metadata.2,
      primary_key: metadata.3,
      auto_increment: metadata.4,
    })
  }

  #[napi]
  pub fn db_config(&self, config: RusqliteDbConfig) -> napi::Result<()> {
    self
      .connection
      .db_config(config.into())
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn set_db_config(&self, config: RusqliteDbConfig, on: bool) -> napi::Result<()> {
    self
      .connection
      .set_db_config(config.into(), on)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi(ts_return_type = "unknown")]
  pub fn pragma_query_value(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let value = match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_query_value(Some(&*schema_name), &pragma_name, parse_rows)
      }
      None => self
        .connection
        .pragma_query_value(None, &pragma_name, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_query(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
  ) -> napi::Result<Unknown<'_>> {
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => self
        .connection
        .pragma_query(Some(&*schema_name), &pragma_name, |row| {
          value = parse_rows(row)?;
          Ok(())
        }),
      None => self.connection.pragma_query(None, &pragma_name, |row| {
        value = parse_rows(row)?;
        Ok(())
      }),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi]
  pub fn pragma(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
    #[napi(ts_arg_type = "(value:Record<string,unknown>) => void")] callback: Function<Unknown<'_>>,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;
    let mut value = HashMap::new();

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma(Some(&*schema_name), &pragma_name, &sql_value, |row| {
            value = parse_rows(row)?;

            Ok(())
          })
      }
      None => self
        .connection
        .pragma(None, &pragma_name, &sql_value, |row| {
          value = parse_rows(row)?;

          Ok(())
        }),
    }
    .map_err(NodeRusqliteError::from)?;

    callback.call(env.to_js_value(&value)?)?;

    Ok(())
  }

  #[napi(ts_return_type = "Promise<void>")]
  pub fn pragma_update(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
  ) -> napi::Result<()> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    match schema_name {
      Some(schema_name) => {
        self
          .connection
          .pragma_update(Some(&*schema_name), &pragma_name, &sql_value)
      }
      None => self
        .connection
        .pragma_update(None, &pragma_name, &sql_value),
    }
    .map_err(NodeRusqliteError::from)?;

    Ok(())
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn pragma_update_and_check(
    &self,
    env: Env,
    schema_name: Option<String>,
    pragma_name: String,
    pragma_value: Array,
  ) -> napi::Result<Unknown<'_>> {
    let sql_value = env.from_js_value::<Value, _>(pragma_value)?;

    let value = match schema_name {
      Some(schema_name) => self.connection.pragma_update_and_check(
        Some(&*schema_name),
        &pragma_name,
        &sql_value,
        parse_rows,
      ),
      None => self
        .connection
        .pragma_update_and_check(None, &pragma_name, &sql_value, parse_rows),
    }
    .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&value)
  }

  #[napi(ts_args_type = "callback: (connection: ScopedConnection) => void")]
  pub fn transaction(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    }

    Ok(())
  }

  #[napi(
    ts_args_type = "behavior: TransactionBehavior, callback: (connection: ScopedConnection) => void"
  )]
  pub fn transaction_with_behavior(
    &mut self,
    behavior: TransactionBehavior,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .transaction_with_behavior(behavior.into())
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi(ts_args_type = "callback: (connection: ScopedConnection) => void")]
  pub fn unchecked_transaction(
    &mut self,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let transaction = self
      .connection
      .unchecked_transaction()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = transaction.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => transaction.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => transaction.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi(ts_args_type = "callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint(&mut self, callback: Function<ScopedConnection>) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint()
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi(ts_args_type = "name: String, callback: (transaction: ScopedConnection) => void")]
  pub fn savepoint_with_name(
    &mut self,
    name: String,
    callback: Function<ScopedConnection>,
  ) -> napi::Result<()> {
    let mut savepoint = self
      .connection
      .savepoint_with_name(&name)
      .map_err(NodeRusqliteError::from)?;

    let deref_conn = savepoint.deref();

    let scoped = ScopedConnection {
      connection: deref_conn,
    };

    match callback.call(scoped) {
      Ok(_) => savepoint.commit().map_err(NodeRusqliteError::from)?,
      Err(_) => savepoint.rollback().map_err(NodeRusqliteError::from)?,
    };

    Ok(())
  }

  #[napi]
  pub fn transaction_state(&self, db_name: Option<String>) -> napi::Result<TransactionState> {
    let state = self
      .connection
      .transaction_state(db_name.as_deref())
      .map_err(NodeRusqliteError::from)?;

    Ok(state.into())
  }

  #[napi]
  pub fn set_transaction_behavior(&mut self, behavior: TransactionBehavior) -> napi::Result<()> {
    self.connection.set_transaction_behavior(behavior.into());
    Ok(())
  }

  #[napi]
  pub fn execute_batch(&self, sql: String) -> napi::Result<()> {
    self
      .connection
      .execute_batch(&sql)
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn execute(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<i64> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let result = self
      .connection
      .execute(&sql, params_from_iter(sql_params.iter()))
      .map_err(NodeRusqliteError::from)?;

    Ok(result as i64)
  }

  #[napi]
  pub fn path(&self) -> napi::Result<String> {
    Ok(self.connection.path().unwrap_or("").to_string())
  }

  #[napi]
  pub fn release_memory(&self) -> napi::Result<()> {
    self
      .connection
      .release_memory()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn last_insert_rowid(&self) -> napi::Result<i64> {
    Ok(self.connection.last_insert_rowid())
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_row(&self, env: Env, sql: String, sql_params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(sql_params)
      .unwrap_or_default();

    let row = self
      .connection
      .query_row(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  #[napi(ts_return_type = "Record<string,unknown>")]
  pub fn query_one(&self, env: Env, sql: String, params: Array) -> napi::Result<Unknown<'_>> {
    let sql_params = env
      .from_js_value::<Vec<Value>, _>(params)
      .unwrap_or_default();

    let row = self
      .connection
      .query_one(&sql, params_from_iter(sql_params.iter()), parse_rows)
      .map_err(NodeRusqliteError::from)?;

    env.to_js_value(&row)
  }

  #[napi(ts_args_type = "sql: String, callback: (statement: ScopedStatement) => void")]
  pub fn prepare(&self, sql: String, callback: Function<ScopedStatement>) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare(&sql)
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  #[napi]
  pub fn prepare_with_flags(
    &self,
    sql: String,
    flags: RusqlitePrepFlags,
    callback: Function<ScopedStatement>,
  ) -> napi::Result<()> {
    let statement = self
      .connection
      .prepare_with_flags(&sql, PrepFlags::from_bits(flags as u32).unwrap())
      .map_err(NodeRusqliteError::from)?;

    let scoped = ScopedStatement { statement };

    callback.call(scoped)?;

    Ok(())
  }

  #[napi]
  pub fn get_interrupt_handle(&self) -> napi::Result<InterruptHandle> {
    let handle = self.connection.get_interrupt_handle();
    Ok(InterruptHandle { handle })
  }

  #[napi]
  pub fn changes(&self) -> napi::Result<i64> {
    Ok(self.connection.changes() as i64)
  }

  #[napi]
  pub fn total_changes(&self) -> napi::Result<i64> {
    Ok(self.connection.total_changes() as i64)
  }

  #[napi]
  pub fn is_autocommit(&self) -> napi::Result<bool> {
    Ok(self.connection.is_autocommit())
  }

  #[napi]
  pub fn is_busy(&self) -> napi::Result<bool> {
    Ok(self.connection.is_busy())
  }

  #[napi]
  pub fn cache_flush(&self) -> napi::Result<()> {
    self
      .connection
      .cache_flush()
      .map_err(NodeRusqliteError::from)?;
    Ok(())
  }

  #[napi]
  pub fn is_readonly(&self, db_name: String) -> napi::Result<bool> {
    Ok(
      self
        .connection
        .is_readonly(&*db_name)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn db_name(&self, index: i32) -> napi::Result<String> {
    Ok(
      self
        .connection
        .db_name(index as usize)
        .map_err(NodeRusqliteError::from)?,
    )
  }

  #[napi]
  pub fn is_interrupted(&self) -> napi::Result<bool> {
    Ok(self.connection.is_interrupted())
  }
}

#[napi]
impl ObjectFinalize for Connection {
  fn finalize(self, _env: Env) -> napi::Result<()> {
    self
      .connection
      .close()
      .map_err(|(_, err)| NodeRusqliteError::from(err))?;
    Ok(())
  }
}
