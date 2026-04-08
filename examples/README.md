# node-rusqlite Examples

This folder contains practical examples demonstrating the high-level TypeScript wrapper API for node-rusqlite. Each example focuses on a specific use case and can be run independently.

All examples use in-memory SQLite databases for simplicity and don't require external setup.

## Running Examples

To run an example:

```bash
bun run examples/01-basic-crud.ts
```

Or with TypeScript directly:

```bash
bun examples/02-transactions.ts
```

## Examples Overview

### 1. **Basic CRUD Operations** (`01-basic-crud.ts`)

Demonstrates fundamental database operations:
- **CREATE (INSERT)** - Add records to the database
- **READ (SELECT)** - Query one record with `queryOne()` or all with `queryAll()`
- **UPDATE** - Modify existing records
- **DELETE** - Remove records

**Key APIs:**
- `Database.openInMemory()` - Create in-memory database
- `db.exec()` - Execute DDL/DML statements
- `db.queryOne<T>()` - Get first result as typed object
- `db.queryAll<T>()` - Get all results as typed array
- Error handling with `RusqliteError`

**Output:** Shows users being inserted, queried, updated, and deleted with result verification.

---

### 2. **Transactions with Commit/Rollback** (`02-transactions.ts`)

Demonstrates transaction management and control flow:
- **Auto commit/rollback** using `db.withTransaction()`
- **Manual transaction control** with explicit `commit()` and `rollback()`
- **Nested savepoints** for partial transaction rollback
- Transaction state inspection

**Key APIs:**
- `db.withTransaction<T>(callback)` - Execute callback with auto commit/rollback
- `db.transaction()` - Create manual transaction
- `txn.commit()`, `txn.rollback()` - Manual control
- `txn.savepoint()` - Create nested savepoint
- `savepoint.rollback()` - Rollback to savepoint

**Output:** Shows successful transfer, failed transaction rollback, and savepoint usage.

---

### 3. **Prepared Statements for Reuse** (`03-prepared-statements.ts`)

Demonstrates prepared statement benefits:
- Reusing statements with different parameters
- Performance benefits for bulk operations
- Statement metadata inspection
- Column information retrieval

**Key APIs:**
- `db.prepare(sql)` - Create reusable statement
- `stmt.execute(params)` - Run statement, get affected rows
- `stmt.queryOne<T>(params)` - Get first result
- `stmt.queryAll<T>(params)` - Get all results
- `stmt.query(params)` - Get iterator
- `stmt.exists(params)` - Predicate check
- `stmt.columnNames()`, `stmt.columnCount()` - Metadata

**Output:** Shows inserting/updating multiple products and querying with metadata inspection.

---

### 4. **Parameterized Queries with Different Types** (`04-parameterized-queries.ts`)

Demonstrates secure parameter binding:
- String parameters for text searches
- Number parameters for ranges
- Boolean-like values (1/0)
- NULL value handling
- LIKE pattern matching
- Multiple conditions with mixed types

**Key APIs:**
- `db.queryAll<T>(sql, params)` - Parameterized query
- `db.queryOne<T>(sql, params)` - Single result with parameters
- `db.exists(sql, params)` - Existence check with parameters
- Parameter binding prevents SQL injection

**Output:** Shows articles being queried by author, views, publication status, and keywords.

---

### 5. **Error Handling with RusqliteError** (`05-error-handling.ts`)

Demonstrates comprehensive error handling:
- UNIQUE constraint violations
- CHECK constraint violations
- Table/column not found errors
- Invalid SQL syntax
- Transaction rollback on error
- Accessing error context (operation, SQL, parameters)
- Graceful error recovery

**Key APIs:**
- `RusqliteError` - Custom error class with context
- `error.operation` - Operation name
- `error.sql` - SQL statement
- `error.params` - Parameters used
- `error.originalError` - Underlying error
- Try/catch pattern with `instanceof RusqliteError`

**Output:** Shows various error scenarios with detailed error information and recovery.

---

### 6. **Schema Inspection and Introspection** (`06-schema-inspection.ts`)

Demonstrates database introspection:
- Checking table and column existence
- Retrieving column metadata
- Inspecting prepared statement structure
- Getting table structure via PRAGMA
- Database state inspection
- Query result structure inspection

**Key APIs:**
- `db.tableExists(dbName, tableName)` - Check table existence
- `db.columnExists(dbName, tableName, columnName)` - Check column existence
- `db.columnMetadata(dbName, tableName, columnName)` - Get column info
- `stmt.columnNames()` - Get column names
- `stmt.columnCount()` - Get column count
- `stmt.parameterCount()` - Get parameter count
- `db.transactionState()` - Get transaction state
- `db.isAutocommit()` - Check autocommit status

**Output:** Shows table/column checks, metadata inspection, and statement introspection.

---

### 7. **Batch Operations (Bulk Insert, Update, Delete)** (`07-batch-operations.ts`)

Demonstrates efficient batch operations:
- Bulk insert with transactions (1000 records)
- Batch updates by department
- Conditional batch delete
- Performance comparison (with vs without transaction)
- Transaction benefits for bulk operations

**Key APIs:**
- `db.withTransaction<T>(callback)` - Wrap bulk operations
- `db.prepare()` + loop - Reuse statement for each row
- `db.queryAll()` - Aggregate queries (COUNT, AVG, etc.)

**Output:** Shows inserting 1000 records, bulk salary updates, and performance metrics showing transaction speedup.

---

## Common Patterns

### Type-Safe Queries

Define interfaces for your data:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user = db.queryOne<User>("SELECT * FROM users WHERE id = ?", [1]);
```

### Prepared Statements for Bulk Operations

```typescript
const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");

db.withTransaction(() => {
  for (const user of users) {
    stmt.execute([user.name, user.email]);
  }
});
```

### Error Handling

```typescript
try {
  db.exec("INSERT INTO users (email) VALUES (?)", [email]);
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error(`Failed to insert user: ${error.message}`);
    console.error(`SQL: ${error.sql}`);
  } else {
    throw error;
  }
}
```

### Transaction Pattern

```typescript
const result = db.withTransaction(() => {
  // All operations here are wrapped in a transaction
  // Auto-rolls back if an error is thrown
  const user = db.queryOne<User>("SELECT * FROM users WHERE id = ?", [1]);
  db.exec("UPDATE users SET status = 'active' WHERE id = ?", [1]);
  return user;
});
```

## Performance Tips

1. **Use prepared statements** for repeated queries
2. **Wrap bulk operations in transactions** - provides 10x+ speedup
3. **Use `queryOne()` instead of `queryAll().pop()`** when you only need one row
4. **Use `exists()` instead of `queryOne()` for existence checks**
5. **Use parameters** for all dynamic values (prevents SQL injection and improves performance)

## API Reference

### `Database` Class

#### Static Methods
- `Database.open(path, options?)` - Open file database
- `Database.openInMemory(options?)` - Open in-memory database

#### Query Methods
- `queryOne<T>(sql, params?)` - Execute query, return first row or undefined
- `queryAll<T>(sql, params?)` - Execute query, return all rows as array
- `exec(sql)` - Execute DDL/DML, return affected rows
- `exists(sql, params?)` - Check if query returns any rows

#### Transactions
- `withTransaction<T>(callback)` - Execute callback in transaction with auto commit/rollback
- `transaction()` - Create manual transaction
- `transactionWithBehavior(behavior)` - Create transaction with specific behavior
- `uncheckedTransaction()` - Create unchecked transaction

#### Savepoints
- `savepoint()` - Create unnamed savepoint
- `savepointWithName(name)` - Create named savepoint

#### Prepared Statements
- `prepare(sql)` - Create prepared statement
- `prepareWithFlags(sql, flags)` - Create prepared statement with flags

#### Schema Inspection
- `tableExists(dbName, tableName)` - Check if table exists
- `columnExists(dbName, tableName, columnName)` - Check if column exists
- `columnMetadata(dbName, tableName, columnName)` - Get column metadata
- `executeBatch(sql)` - Execute multiple SQL statements

#### Database Info
- `path()` - Get database file path
- `isAutocommit()` - Check if autocommit is enabled
- `isBusy()` - Check if database is busy
- `isInterrupted()` - Check if database was interrupted
- `changes()` - Get number of changes in current session
- `totalChanges()` - Get total changes across all sessions
- `lastInsertRowid()` - Get last inserted rowid
- `transactionState()` - Get current transaction state
- `dbName(index)` - Get database name at index
- `isReadonly(dbName)` - Check if database is read-only

#### Other Methods
- `backup(name, path, callback)` - Backup database
- `restore(name, path, callback)` - Restore database
- `dbConfig(config)` - Configure database options
- `pragmaQuery(schemaName, pragmaName)` - Query PRAGMA
- `pragmaUpdate(schemaName, pragmaName, value)` - Update PRAGMA
- `releaseMemory()` - Release cached memory
- `cacheFlush()` - Flush cache

### `Statement` Class

- `execute(params?)` - Execute statement, return affected rows
- `insert(params?)` - Execute INSERT, return last inserted rowid
- `queryOne<T>(params?)` - Execute query, return first row or undefined
- `queryAll<T>(params?)` - Execute query, return all rows
- `query<T>(params?)` - Execute query, return iterator
- `exists(params?)` - Check if query returns rows
- `columnNames()` - Get all column names
- `columnCount()` - Get number of columns
- `columnName(index)` - Get column name at index
- `columnIndex(name)` - Get column index by name
- `columns()` - Get all columns
- `columnsWithMetadata()` - Get columns with metadata
- `columnMetadata(index)` - Get detailed column metadata
- `parameterIndex(name)` - Get parameter index by name
- `parameterName(index)` - Get parameter name by index
- `parameterCount()` - Get number of parameters
- `expandedSql()` - Get expanded SQL
- `readonly()` - Check if statement is read-only
- `clearBindings()` - Clear all parameter bindings

### `Rows<T>` Class

- `[Symbol.iterator]()` - Make iterator
- `next()` - Get next row
- `all()` - Collect all rows into array

### `Transaction` Class

- `commit()` - Commit transaction
- `rollback()` - Rollback transaction
- `finish()` - Finish transaction
- `savepoint()` - Create nested savepoint
- `savepointWithName(name)` - Create named savepoint
- `dropBehavior()` - Get drop behavior
- `setDropBehavior(behavior)` - Set drop behavior

### `Savepoint` Class

- See `Transaction` class (same API)

### `RusqliteError` Class

- `name` - Error name ("RusqliteError")
- `message` - Formatted error message with context
- `operation` - Operation name (e.g., "Database.queryOne()")
- `sql` - SQL statement (truncated to 100 chars)
- `params` - Parameters used
- `originalError` - Original underlying error

---

## Tips & Tricks

### Bulk Import from CSV

```typescript
const rows = csvData.split('\n').map(line => line.split(','));
const stmt = db.prepare("INSERT INTO items (name, value) VALUES (?, ?)");

db.withTransaction(() => {
  for (const row of rows) {
    stmt.execute(row);
  }
});
```

### Conditional Updates

```typescript
db.queryAll("SELECT * FROM users WHERE age < ?", [21]).forEach(user => {
  db.exec("UPDATE users SET restricted = 1 WHERE id = ?", [user.id]);
});
```

### Backup State

```typescript
db.backup("main", "/path/to/backup.db", (err, progress) => {
  if (err) console.error("Backup failed:", err);
  else console.log(`Backup progress: ${progress.remaining} remaining`);
});
```

---

## Resources

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [rusqlite (Rust library) Docs](https://docs.rs/rusqlite/)
- [NAPI-RS Documentation](https://napi.rs/)
