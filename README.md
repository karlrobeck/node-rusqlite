# `@karlrobeck/node-rusqlite`

**Type-safe SQLite for Node.js**, powered by the Rust [`rusqlite`](https://github.com/rusqlite/rusqlite) crate and exposed via [`napi-rs`](https://napi.rs/). Zero external dependencies, native performance, single-file databases. Perfect for desktop apps, Electron, embedded systems, or any Node.js project needing fast, reliable local data storage.

---

## ⚠️ Active Development Notice

This project is currently in **active development**. Bugs will occur, and breaking changes may be introduced while the API stabilizes.

- **Current state**: Feature implementation is ongoing; core functionality is tested and working
- **npm package**: Package distribution will be implemented later when features are stable and performant
- **Current use case**: Recommended for experimental and development work, learning projects, and non-critical systems
- **Installation**: Clone from GitHub and build locally (see [Installation](#installation))

---

## Quick Start

Here's a minimal example to get started:

```typescript
import { Connection } from "./bindings/binding.js";

// Create an in-memory database
const db = Connection.openInMemory();

// Create a table
db.executeBatch(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT
  );
`);

// Insert data with parameters
db.execute("INSERT INTO users (name, email) VALUES (?, ?)", [
  "Alice",
  "alice@example.com",
]);

// Query data
const result = db.queryRow("SELECT * FROM users WHERE id = ?", [1]);
console.log("Found user:", result);
// Output: Found user: { id: 1, name: 'Alice', email: 'alice@example.com' }
```

For more examples, see the [examples folder](./examples/).

---

## Installation

**Prerequisites**: Node.js 14.17+ and a C/C++ toolchain (for building Rust bindings)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/karlrobeck/node-rusqlite
   cd node-rusqlite
   ```

2. **Install and build**:
   ```bash
   npm install
   npm run build
   ```

3. **Import in your code**:
   ```typescript
   import { Connection } from "./bindings/binding.js";
   ```

**Note**: npm package distribution is planned for a future release when features are stable and performance-tested. For now, clone the repository and build locally.

---

## Features

### Core Database Operations

- ✅ **File-based & in-memory databases** — Persistent (disk) and temporary (RAM) storage
- ✅ **CRUD operations** — Insert, select, update, delete with parameterized queries
- ✅ **Prepared statements** — Compiled SQL for reuse, better performance
- ✅ **Batch execution** — Run multiple SQL statements efficiently

### Transaction & Concurrency Control

- ✅ **Transactions** — Atomic operations with automatic rollback on error
- ✅ **Transaction behaviors** — DEFERRED, IMMEDIATE, EXCLUSIVE modes
- ✅ **Savepoints** — Nested transactions with named savepoints
- ✅ **Interrupt handles** — Ability to cancel long-running queries
- ✅ **State inspection** — Check autocommit mode, busy state, transaction state

### Schema & Introspection

- ✅ **Table/column existence checks** — Idempotent schema validation
- ✅ **Column metadata** — Type, constraints, default values, origin information
- ✅ **Statement metadata** — Query column names and types before execution
- ✅ **PRAGMA queries** — Read/write database configuration (journal mode, page size, cache, etc.)

### Configuration & Optimization

- ✅ **DbConfig flags** — 20+ database configuration switches (PRAGMA, foreign keys, triggers, etc.)
- ✅ **Memory optimization** — Release memory, flush cache, manage statement cache
- ✅ **Connection state** — Track changes, row counts, readonly status
- ✅ **Open flags** — 20+ flags for connection control (READONLY, WAL, EXCLUSIVE, etc.)

### Advanced Features

- ✅ **Full-text search** — FTS3/FTS5 support via SQLite
- ✅ **Backup & restore** — Database copy operations
- ✅ **Statement profiling** — Get execution metrics (steps, sorts, VM ops)

---

## API Overview

node-rusqlite exposes the following main components:

| Class/Type | Purpose | Example |
|-----------|---------|---------|
| **Connection** | Main entry point for database operations | `Connection.open("db.sqlite")` |
| **ScopedConnection** | Borrowed connection within transactions | Used in `transaction()` callback |
| **ScopedStatement** | Prepared statement in a scoped context | Used in `prepare()` callback |
| **Statement** | Direct prepared statement (low-level) | Raw compiled SQL |
| **Rows** | Collection of query results | `.iterate()` for iteration |
| **Row** | Single result row | Via row iterator |
| **Column** | Column metadata | Name and declared type |
| **ColumnMetadata** | Detailed column information | Origin, table, nullability |
| **InterruptHandle** | Async query cancellation | `db.getInterruptHandle()` |

For complete method signatures and types, see [bindings/binding.d.ts](./bindings/binding.d.ts).

---

## Feature Matrix

### Legend

| Status | Meaning |
|--------|---------|
| ✅ | Implemented & stable |
| ⬜ | Not yet implemented |
| ➖ | Not planned (out of scope, deprecated) |
| ↔️ | Merged/simplified into another method |

### Connection

| Method | Description | Status |
|--------|-------------|--------|
| **Opening & Closing** | | |
| `open(path, options?)` | Open file-based database | ✅ |
| `openInMemory(options?)` | Open in-memory database | ✅ |
| `close()` | Close the connection | ✅ |
| **CRUD & Execution** | | |
| `execute(sql, params)` | Execute SQL with parameters | ✅ |
| `executeBatch(sql)` | Execute multiple statements | ✅ |
| `queryRow(sql, params)` | Query first matching row | ✅ |
| `queryOne(sql, params)` | Query single row | ✅ |
| `prepare(sql, callback)` | Prepare statement (scoped) | ✅ |
| `prepareWithFlags(sql, flags, callback)` | Prepare with explicit flags | ✅ |
| **Transactions & Savepoints** | | |
| `transaction(callback)` | Execute transaction (auto commit/rollback) | ✅ |
| `transactionWithBehavior(behavior, callback)` | Transaction with DEFERRED/IMMEDIATE/EXCLUSIVE | ✅ |
| `uncheckedTransaction(callback)` | Transaction without checks | ✅ |
| `savepoint(callback)` | Create savepoint | ✅ |
| `savepointWithName(name, callback)` | Named savepoint | ✅ |
| `transactionState(dbName?)` | Query current transaction state | ✅ |
| `setTransactionBehavior(behavior)` | Set default transaction behavior | ✅ |
| **Schema Introspection** | | |
| `tableExists(dbName, tableName)` | Check if table exists | ✅ |
| `columnExists(dbName, tableName, columnName)` | Check if column exists | ✅ |
| `columnMetadata(dbName, tableName, columnName)` | Get detailed column info | ✅ |
| **Configuration & State** | | |
| `pragma(schema, name, value, callback)` | Read/write PRAGMA with callback | ✅ |
| `pragmaQuery(schema, name)` | Query PRAGMA as object | ✅ |
| `pragmaQueryValue(schema, name)` | Query PRAGMA value | ✅ |
| `pragmaUpdate(schema, name, value)` | Update PRAGMA (async) | ✅ |
| `pragmaUpdateAndCheck(schema, name, value)` | Update PRAGMA and return result | ✅ |
| `dbConfig(config)` | Read DbConfig flag | ✅ |
| `setDbConfig(config, on)` | Set DbConfig flag | ✅ |
| **Query State & Metadata** | | |
| `path()` | Get database file path | ✅ |
| `lastInsertRowid()` | Get last inserted row ID | ✅ |
| `changes()` | Get rows changed by last operation | ✅ |
| `totalChanges()` | Get total rows changed | ✅ |
| `isAutocommit()` | Check if autocommit is enabled | ✅ |
| `isBusy()` | Check if connection is busy | ✅ |
| `isReadonly(dbName)` | Check if database is read-only | ✅ |
| `dbName(index)` | Get database name at index | ✅ |
| `isInterrupted()` | Check if interrupted | ✅ |
| **Memory Management** | | |
| `releaseMemory()` | Ask SQLite to free memory | ✅ |
| `cacheFlush()` | Flush prepared statement cache | ✅ |
| `getInterruptHandle()` | Get handle to interrupt operations | ✅ |
| **Not Yet Implemented** | | |
| `blobOpen()` | Open SQLite BLOB handle | ⬜ |
| `busyTimeout()` | Set busy timeout | ⬜ |
| `busyHandler()` | Set busy handler callback | ⬜ |
| `createScalarFunction()` | Register scalar function | ⬜ |
| `createAggregateFunction()` | Register aggregate function | ⬜ |
| `createWindowFunction()` | Register window function | ⬜ |
| `removeFunction()` | Unregister function | ⬜ |
| `commitHook()` | Register commit hook | ⬜ |
| `rollbackHook()` | Register rollback hook | ⬜ |
| `updateHook()` | Register update hook | ⬜ |
| `walHook()` | Register WAL hook | ⬜ |
| `progressHandler()` | Register progress callback | ⬜ |
| `authorizer()` | Register authorizer callback | ⬜ |
| `limit()` | Query resource limit | ⬜ |
| `setLimit()` | Set resource limit | ⬜ |
| `serialize()` | Serialize database to bytes | ⬜ |
| `deserialize()` | Deserialize database from bytes | ⬜ |
| `traceV2()` | Enable SQL tracing | ⬜ |
| **Merged/Not Exposed** | | |
| `loadExtensionEnable()` | Load extension support | ↔️ Not exposed |
| `loadExtensionDisable()` | Disable extension support | ↔️ Not exposed |
| `loadExtension()` | Load extension library | ↔️ Not exposed |
| `handle()` / `fromHandle()` / `fromHandleOwned()` | Low-level FFI handles | ↔️ Not exposed |

### Statement

| Method | Description | Status |
|--------|-------------|--------|
| **Column Metadata** | | |
| `columnNames()` | Get all column names | ✅ |
| `columnCount()` | Get number of columns | ✅ |
| `columnName(index)` | Get column name at index | ✅ |
| `columnIndex(name)` | Get column index by name | ✅ |
| `columns()` | Get all column info objects | ✅ |
| `columnsWithMetadata()` | Get columns with detailed metadata | ✅ |
| `columnMetadata(index)` | Get metadata for column at index | ✅ |
| **Execution** | | |
| `execute()` | Execute prepared statement | ✅ |
| `insert()` | Execute INSERT and get row ID | ✅ |
| `query()` | Execute SELECT and get rows | ✅ |
| `exists()` | Check if query returns any rows | ✅ |
| **Parameters** | | |
| `parameterCount()` | Get number of parameters | ✅ |
| `parameterName(index)` | Get parameter name at index | ✅ |
| `parameterIndex(name)` | Get parameter index by name | ✅ |
| `clearBindings()` | Clear all parameter bindings | ✅ |
| **Statement Info** | | |
| `expandedSql()` | Get SQL with parameters substituted | ✅ |
| `getStatus()` | Get execution metrics (steps, sorts) | ✅ |
| `resetStatus()` | Reset execution metrics | ✅ |
| `isExplain()` | Check if statement is EXPLAIN | ✅ |
| `readonly()` | Check if statement is read-only | ✅ |
| `finalize()` | Release statement resources | ✅ |
| **Not Yet Implemented** | | |
| `queryMap()` | Map transformation over rows | ➖ Handled by Rows iterator |
| `queryAndThen()` | Chain multiple transforms | ➖ Handled by Rows iterator |
| `queryRow()` | Query single row | ➖ Use Connection.queryRow() |
| `queryOne()` | Query exactly one row | ➖ Use Connection.queryOne() |
| `rawBindParameter()` | Low-level parameter binding | ➖ Not exposed |
| `rawExecute()` | Low-level raw execution | ➖ Not exposed |
| `rawQuery()` | Low-level raw query | ➖ Not exposed |

### Row Iterator

| Feature | Description | Status |
|---------|-------------|--------|
| **Iteration** | | |
| `next()` | Get next row from iteration | ✅ |
| `get(index)` | Get row at index | ✅ |
| **Transformation** | | |
| Iterator helpers (map, filter, etc.) | JavaScript iterator protocol | ✅ |
| **Not Yet Implemented** | | |
| `getUnwrap()` | Get value or panic | ➖ Use with error handling |
| `getRef()` | Get borrowed reference | ➖ Not applicable in JS |
| `getRefUnwrap()` | Get ref or panic | ➖ Not applicable in JS |
| `getPointer()` | Get pointer to value | ➖ Not applicable in JS |

### Transaction (Scoped)

| Method | Description | Status |
|--------|-------------|--------|
| **Savepoints** | | |
| `savepoint(callback)` | Create savepoint | ✅ |
| `savepointWithName(name, callback)` | Named savepoint | ✅ |
| **Control** | | |
| `commit()` | Commit transaction | ✅ |
| `rollback()` | Rollback transaction | ✅ |
| `finish()` | Finish and return to parent | ✅ |
| `dropBehavior()` | Get drop behavior | ✅ |
| `setDropBehavior(behavior)` | Set drop behavior | ✅ |
| **Not Yet Implemented** | | |
| `new()` | Create new transaction | ➖ Use db.transaction() |
| `newUnchecked()` | Create without checks | ➖ Use db.uncheckedTransaction() |

### Column

| Method | Description | Status |
|--------|-------------|--------|
| `name()` | Get column name | ✅ |
| `declType()` | Get declared type | ✅ |

### ColumnMetadata

| Method | Description | Status |
|--------|-------------|--------|
| `name()` | Get column name | ✅ |
| `databaseName()` | Get database name | ✅ |
| `tableName()` | Get table name | ✅ |
| `originName()` | Get origin column name | ✅ |

---

## Learning Resources

### Structured Learning Paths

Learn node-rusqlite through 14 comprehensive, self-contained examples:

#### **[Beginner](./examples/README.md#beginner-new-to-sqlite--node-rusqlite)** — New to SQLite & Node (2 hours)

Master the fundamentals with **Examples 1–4**:

1. [Basic Setup](./examples/01-basic-setup.ts) — Open databases, connections, and memory management
2. [CRUD Operations](./examples/02-crud-operations.ts) — Insert, select, update, delete patterns
3. [Prepared Statements](./examples/03-prepared-statements.ts) — Compiled SQL and parameters
4. [Transactions & Savepoints](./examples/04-transactions-savepoints.ts) — Atomic operations and rollback

#### **[Intermediate](./examples/README.md#intermediate-familiar-with-sql-learning-node-rusqlite)** — Familiar with SQL (3 hours)

Level up with **Examples 5–11**:

5. [Pragmas](./examples/05-pragmas.ts) — Configure database behavior and performance
6. [Schema Introspection](./examples/06-schema-introspection.ts) — Inspect tables, columns, metadata
7. [Statement Metadata](./examples/07-statement-metadata.ts) — Query column info before execution
8. [Statement Parameters](./examples/08-statement-parameters.ts) — Advanced parameter binding
9. [Configuration](./examples/09-configuration.ts) — DbConfig flags and database tuning
10. [Result Iteration](./examples/10-result-iteration.ts) — Efficient row processing patterns
11. [Error Handling](./examples/13-error-handling.ts) — Exception handling and recovery

#### **[Advanced](./examples/README.md#advanced-production-optimization--patterns)** — Production Ready (1.5 hours)

Master optimization with **Examples 12–14**:

12. [Concurrent Operations](./examples/12-concurrent-operations.ts) — Multi-threaded patterns and interrupt handles
13. [Statement Status](./examples/11-statement-status.ts) — Performance profiling and metrics
14. [Best Practices](./examples/14-best-practices.ts) — Production patterns, pooling, and optimization

### Additional Resources

- **[Examples README](./examples/README.md)** — Detailed breakdown of each example
- **[SQL Schema Reference](./examples/schema-reference.sql)** — SQL patterns and templates
- **[API Bindings](./bindings/binding.d.ts)** — Complete TypeScript type definitions
- **[Rusqlite Documentation](https://docs.rs/rusqlite/)** — Underlying Rust library reference

---

## Advanced Topics

### Performance Optimization

- **Batch operations in transactions** — 10-100x faster for bulk inserts: wrap in `db.transaction()`
- **Prepared statement reuse** — Avoid recompiling SQL: prepare once, execute many times
- **WAL mode** — Enable via `pragmaUpdate(null, 'journal_mode', 'wal')` for better concurrency
- **Index creation** — Add indexes on frequently queried columns for O(log n) lookups
- **Memory flushing** — Call `db.releaseMemory()` in long-running processes

### Concurrency Patterns

- **Single writer model** — SQLite serializes writes; use transactions for batching
- **Read-heavy workloads** — WAL mode allows concurrent readers while one writer finishes
- **Interrupt handles** — Stop long-running queries: `const handle = db.getInterruptHandle(); handle.interrupt()`
- **Connection per thread** — Each thread should have its own `Connection` (not shared)

### Common Patterns

```typescript
// Idempotent schema creation
if (!db.tableExists(null, "users")) {
  db.executeBatch(`CREATE TABLE users (...)`);
}

// Bulk insert with transaction (fast)
db.transaction((tx) => {
  for (const user of users) {
    tx.execute("INSERT INTO users (name) VALUES (?)", [user.name]);
  }
});

// Query with error handling
try {
  const result = db.queryRow("SELECT * FROM users WHERE id = ?", [id]);
  console.log(result);
} catch (err) {
  console.error("Query failed:", err.message);
}
```

### Limitations

- **Synchronous API** — All operations block; no async/await (by design)
- **Single writer** — Only one connection can write at a time
- **Not suitable for** — Multi-process systems (use a real server DB for that)
- **Memory databases** — Data is lost when the process ends

---

## Contributing & Development

### Project Structure

- **[src/](./src/)** — Rust source code (Napi-Rs bindings)
  - `lib.rs` — Main entry point
  - `connection.rs`, `statement.rs`, `row.rs`, `transaction.rs` — Core API implementations
  - `errors.rs`, `utils.rs` — Error handling and utilities
  
- **[bindings/](./bindings/)** — Generated TypeScript definitions
  - `binding.d.ts` — Complete type definitions
  - `binding.js` — JavaScript bindings wrapper
  
- **[crates/](./crates/)** — Rust dependencies
  - `rusqlite/` — Underlying SQLite Rust wrapper
  - `libsqlite3-sys/` — SQLite C bindings
  
- **[examples/](./examples/)** — 14 comprehensive learning examples
- **[tests/](./tests/)** — TypeScript test suite
- **[Cargo.toml](./Cargo.toml)** — Rust project configuration
- **[package.json](./package.json)** — Node.js project configuration

### Building

```bash
# Install dependencies
npm install

# Build Rust bindings (release mode)
npm run build

# Build in debug mode with source maps
npm run build:debug

# Format code
npm run format        # Prettier + Rust + TOML
npm run format:rs     # Rust only
npm run format:toml   # TOML only

# Lint
npm run lint          # oxlint (JavaScript)

# Run benchmarks
npm run bench
```

### Development Tools

- **Language**: TypeScript (frontend), Rust (backend)
- **Build system**: Napi-Rs (native module builder)
- **Code formatter**: Prettier (TS/JS), rustfmt (Rust)
- **Linter**: oxlint (JavaScript)
- **Testing**: Vitest (planned/in-progress)

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for full details.

### Credits

- Built with [`rusqlite`](https://github.com/rusqlite/rusqlite) — Pure Rust SQLite bindings
- Exposed via [`napi-rs`](https://napi.rs/) — Rust to Node.js bridge
- SQLite is in the public domain ([sqlite.org](https://www.sqlite.org/))
