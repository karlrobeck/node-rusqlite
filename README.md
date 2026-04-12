# `@karlrobeck/node-rusqlite`

node sqlite library powered by `rusqlite` crate and `napi-rs`

## Examples & Documentation

Looking to learn how to use node-rusqlite? Check out the
**[comprehensive examples](./examples/)** directory!

### Learning Paths

- **Beginner?** Start with
  [Examples 1-4](./examples/README.md#beginner-new-to-sqlite--node-rusqlite) (2
  hours)
  - Basic connections, CRUD operations, prepared statements, transactions
- **Intermediate?** Continue with
  [Examples 5-11](./examples/README.md#intermediate-familiar-with-sql-learning-node-rusqlite)
  (3 hours)
  - Configuration, schema inspection, metadata, error handling
- **Advanced?** Explore
  [Examples 12-14](./examples/README.md#advanced-production-optimization--patterns)
  (1.5 hours)
  - Concurrent operations, performance tuning, best practices

### Quick Links

- 14 comprehensive examples covering all APIs: [./examples/](./examples/)
- SQL schema patterns and templates:
  [./examples/schema-reference.sql](./examples/schema-reference.sql)
- Full examples README with learning paths:
  [./examples/README.md](./examples/README.md)

## Features

- ✅ Type-safe Node.js bindings to SQLite via Rust
- ✅ Prepared statements & parameterized queries
- ✅ Transaction control with savepoints
- ✅ Schema introspection & metadata
- ✅ Performance profiling (statement status)
- ✅ Configure via PRAGMA & DbConfig flags
- ✅ Full-text search support
- ✅ Memory optimization utilities

## Checklist

**Connection**

- default
  - [x] backup()
  - [x] restore()
  - [ ] blob_open()
  - [ ] busy_timeout()
  - [ ] busy_handler()
    - feature: cache
      - [ ] prepare_cached()
      - [ ] set_prepared_statement_cache_capacity()
      - [ ] flush_prepared_statement_cache()
    - feature: collation
      - [ ] create_collation()
      - [ ] collation_needed()
      - [ ] remove_collation()
  - [x] column_exists()
  - [x] table_exists()
  - [x] column_metadata()
  - [x] db_config()
  - [x] set_db_config()
    - feature: functions
      - [ ] create_scalar_function()
      - [ ] create_aggregate_function()
      - [ ] create_window_function()
      - [ ] remove_function()
    - feature: hooks
      - [ ] commit_hook()
      - [ ] rollback_hook()
      - [ ] update_hook()
      - [ ] wal_hook()
      - [ ] progress_handler()
      - [ ] authorizer()
    - feature: limits
      - [ ] limit()
      - [ ] set_limit()
  - [x] pragma()
  - [x] pragma_query_value()
  - [x] pragma_query()
  - [x] pragma_update()
  - [x] pragma_update_and_check()
    - feature: serialize
      - [ ] serialize()
      - [ ] deserialize_read_exact()
      - [ ] deserialize_bytes()
      - [ ] deserialize()
    - feature: trace
      - [ ] trace_v2
  - [x] transaction()
  - [x] transaction_with_behavior()
  - [x] unchecked_transaction()
  - [x] savepoint()
  - [x] savepoint_with_name()
    - feature: modern_sqlite
      - [x] transaction_state()
  - [x] set_transaction_behavior()
    - feature: vtab
      - [ ] create_module()
  - [x] open()
  - [x] open_in_memory()
  - [/] open_with_flags()
  - [/] open_with_flags_and_vfs()
  - [/] open_in_memory_with_flags()
  - [/] open_in_memory_with_flags_and_vfs()
  - [x] execute_batch()
  - [x] execute()
  - [x] path()
  - [x] release_memory()
  - [x] last_insert_rowid()
  - [x] query_row()
  - [x] query_one()
  - [-] query_row_and_then()
  - [x] prepare()
  - [x] prepare_with_flags()
  - [x] close()
  - [/] load_extension_enable()
  - [/] load_extension_disable()
  - [/] load_extension()
  - [/] handle()
  - [/] from_handle()
  - [/] from_handle_owned()
  - [x] get_interrupt_handle()
  - [x] changes()
  - [x] total_changes()
  - [x] is_autocommit()
  - [x] is_busy()
  - [x] cache_flush()
  - [x] is_readonly()
  - [x] db_name()
  - [x] is_interrupted

**statement**

- default
  - [x] column_names()
  - [x] column_count()
  - [x] column_name()
  - [x] column_index()
  - [x] columns()
  - [x] columns_with_metadata()
  - [x] column_metadata()
  - [x] execute()
  - [x] insert()
  - [x] query()
  - [-] query_map()
  - [-] query_and_then()
  - [x] exists()
  - [-] query_row()
  - [-] query_one()
  - [x] finalize()
  - [x] parameter_index()
  - [x] parameter_name()
  - [x] parameter_count()
  - [-] raw_bind_parameter()
  - [-] raw_execute()
  - [-] raw_query()
  - [x] expanded_sql()
  - [x] get_status()
  - [x] reset_status()
  - [x] is_explain()
  - [x] readonly()
  - [x] clear_bindings()

**row** (with iterator)

- default:
  - [-] get_unwrap()
  - [x] get()
  - [-] get_ref()
  - [-] get_ref_unwrap()
  - [-] get_pointer()

**transaction**

- default:
  - [-] new()
  - [-] new_unchecked()
  - [x] savepoint()
  - [x] savepoint_with_name()
  - [x] drop_behavior()
  - [x] set_drop_behavior()
  - [x] commit()
  - [x] rollback()
  - [x] finish()

**column**

- default:
  - [x] name()
  - [x] decl_type()

**column_metadata**

- default:
  - [x] name()
  - [x] database_name()
  - [x] table_name()
  - [x] origin_name()
