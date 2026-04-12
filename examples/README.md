# node-rusqlite Examples

This directory contains comprehensive examples demonstrating all major features
of node-rusqlite. Each example is self-contained, well-commented, and includes
beginner through advanced usage patterns.

## Quick Start

All examples use the same pattern:

```typescript
import { Connection } from "../bindings/binding";

const db = Connection.open("./my-database.db");
// or
const db = Connection.openInMemory();

// Use the database
db.execute("CREATE TABLE ...", []);
```

Run any example with:

```bash
bun run examples/01-basic-setup.ts
# or
npx ts-node examples/01-basic-setup.ts
```

## Learning Paths

### Beginner (New to SQLite & node-rusqlite)

Start here if you're new to SQLite or databases:

1. **[01-basic-setup.ts](./01-basic-setup.ts)** - Opening and connecting to
   databases
2. **[02-crud-operations.ts](./02-crud-operations.ts)** - INSERT, SELECT,
   UPDATE, DELETE
3. **[03-prepared-statements.ts](./03-prepared-statements.ts)** - Parameterized
   queries
4. **[04-transactions-savepoints.ts](./04-transactions-savepoints.ts)** -
   Atomicity and rollback
5. **[10-result-iteration.ts](./10-result-iteration.ts)** - Processing results

**Time to complete:** ~2 hours

**Concepts covered:**

- Database connections
- Basic SQL operations
- Parameter binding
- Transactions
- Result processing

### Intermediate (Familiar with SQL, learning node-rusqlite)

Deepen your knowledge of the node-rusqlite API:

1. **[05-pragmas.ts](./05-pragmas.ts)** - Configuration with PRAGMA
2. **[06-schema-introspection.ts](./06-schema-introspection.ts)** - Inspecting
   database structure
3. **[07-statement-metadata.ts](./07-statement-metadata.ts)** - Query column
   information
4. **[08-statement-parameters.ts](./08-statement-parameters.ts)** - Advanced
   parameter binding
5. **[09-configuration.ts](./09-configuration.ts)** - Database configuration
   flags
6. **[11-statement-status.ts](./11-statement-status.ts)** - Performance
   profiling
7. **[13-error-handling.ts](./13-error-handling.ts)** - Robust error recovery

**Time to complete:** ~3 hours

**Concepts covered:**

- Database configuration
- Schema discovery
- Performance metrics
- Error handling patterns
- Advanced introspection

### Advanced (Production optimization & patterns)

Build production-grade database code:

1. **[12-concurrent-operations.ts](./12-concurrent-operations.ts)** - State
   management and interrupts
2. **[14-best-practices.ts](./14-best-practices.ts)** - Performance tuning and
   patterns

**Time to complete:** ~1.5 hours

**Concepts covered:**

- Concurrent operation handling
- Connection lifecycle
- Memory optimization
- Bulk operations
- Index usage
- Production configuration

### Complete Journey (Every feature)

Follow all 14 examples in order:

- Examples 1-5: Fundamentals & configuration
- Examples 6-9: Metadata & introspection
- Examples 10-12: Results, performance, concurrency
- Examples 13-14: Error handling & best practices

**Total time:** ~6-7 hours

## Examples Overview

| #  | File                            | Topic              | Level        | Key APIs                                                    |
| -- | ------------------------------- | ------------------ | ------------ | ----------------------------------------------------------- |
| 01 | `01-basic-setup.ts`             | Connections        | Beginner     | `open()`, `openInMemory()`                                  |
| 02 | `02-crud-operations.ts`         | CRUD               | Beginner     | `execute()`, `queryRow()`, `lastInsertRowid()`              |
| 03 | `03-prepared-statements.ts`     | Statements         | Beginner     | `prepare()`, `query()`, `insert()`, `execute()`             |
| 04 | `04-transactions-savepoints.ts` | Transactions       | Beginner     | `transaction()`, `savepoint()`, `transactionWithBehavior()` |
| 05 | `05-pragmas.ts`                 | Configuration      | Intermediate | `pragmaQuery()`, `pragmaUpdate()`, `pragmaQueryValue()`     |
| 06 | `06-schema-introspection.ts`    | Metadata           | Intermediate | `tableExists()`, `columnExists()`, `columnMetadata()`       |
| 07 | `07-statement-metadata.ts`      | Statement Info     | Intermediate | `columnNames()`, `columnCount()`, `columns()`               |
| 08 | `08-statement-parameters.ts`    | Parameters         | Intermediate | `parameterIndex()`, `parameterName()`, `parameterCount()`   |
| 09 | `09-configuration.ts`           | DB Config          | Intermediate | `dbConfig()`, `setDbConfig()`                               |
| 10 | `10-result-iteration.ts`        | Results            | Intermediate | `toJSON()`, `iterate()`, `get()`                            |
| 11 | `11-statement-status.ts`        | Performance        | Intermediate | `getStatus()`, `resetStatus()`                              |
| 12 | `12-concurrent-operations.ts`   | State & Interrupts | Advanced     | `getInterruptHandle()`, `isBusy()`, `isAutocommit()`        |
| 13 | `13-error-handling.ts`          | Error Patterns     | Advanced     | Try-catch, constraint detection, retry patterns             |
| 14 | `14-best-practices.ts`          | Production         | Advanced     | Reuse, transactions, indexes, configuration                 |

## Use Case Finder

**Looking for examples of a specific task?**

- **Opening databases**: See
  [01-basic-setup.ts](./01-basic-setup.ts#basic-connection-patterns)
- **Inserting data**: See
  [02-crud-operations.ts](./02-crud-operations.ts#create-insert) and
  [14-best-practices.ts](./14-best-practices.ts#batch-operations-best-practice)
- **Querying data**: See
  [02-crud-operations.ts](./02-crud-operations.ts#read-select) and
  [10-result-iteration.ts](./10-result-iteration.ts)
- **Transactions**: See
  [04-transactions-savepoints.ts](./04-transactions-savepoints.ts)
- **Schema inspection**: See
  [06-schema-introspection.ts](./06-schema-introspection.ts)
- **Performance tuning**: See [11-statement-status.ts](./11-statement-status.ts)
  and [14-best-practices.ts](./14-best-practices.ts)
- **Error handling**: See [13-error-handling.ts](./13-error-handling.ts)
- **Configuration**: See [05-pragmas.ts](./05-pragmas.ts) and
  [09-configuration.ts](./09-configuration.ts)
- **Bulk operations**: See
  [14-best-practices.ts](./14-best-practices.ts#batch-operations-best-practice)
- **Prepared statements**: See
  [03-prepared-statements.ts](./03-prepared-statements.ts)
- **Working with results**: See
  [10-result-iteration.ts](./10-result-iteration.ts)

## Comment Levels

Each example includes comments at multiple levels:

- **BEGINNER**: Explains what/why for basic concepts
- **INTERMEDIATE**: Links to documentation, explains design choices
- **ADVANCED**: Discusses edge cases, performance implications, alternatives

Feel free to skip advanced sections if you're just starting out!

## Running Examples

### With Bun (Recommended for speed)

```bash
bun run examples/01-basic-setup.ts
```

### With ts-node

```bash
npx ts-node examples/01-basic-setup.ts
```

### With tsx

```bash
npx tsx examples/01-basic-setup.ts
```

### With Node.js (requires build step)

```bash
npm run build
node dist/examples/01-basic-setup.js
```

## Common Patterns Across Examples

### Pattern 1: Opening a Database

```typescript
const db = Connection.open("./my-db.db");
const memDb = Connection.openInMemory();
```

### Pattern 2: Simple Query

```typescript
db.execute("INSERT INTO users VALUES (?, ?)", [name, email]);
const row = db.queryRow("SELECT * FROM users WHERE id = ?", [1]);
```

### Pattern 3: Prepared Statements

```typescript
db.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
  const rows = stmt.query([1]);
});
```

### Pattern 4: Transactions

```typescript
db.transaction((conn) => {
  conn.execute("INSERT ...", []);
  conn.execute("UPDATE ...", []);
  // Auto-commits on success, rolls back on error
});
```

### Pattern 5: Error Handling

```typescript
try {
  db.execute("INSERT INTO users (username) VALUES (?)", ["alice"]);
} catch (error) {
  console.error("Insert failed:", error);
}
```

## Related Test Files

Each example concept is also demonstrated in the test suite:

- `tests/connection.test.ts` - Connection basics → Example 01
- `tests/connection-execution.test.ts` - CRUD operations → Example 02
- `tests/statement-parameters.test.ts` - Prepared statements → Example 03
- `tests/connection-transaction.test.ts` - Transactions → Example 04
- `tests/connection-pragma.test.ts` - PRAGMAs → Example 05
- `tests/connection-metadata.test.ts` - Schema inspection → Example 06
- `tests/statement-metadata.test.ts` - Statement info → Example 07
- `tests/statement-parameters.test.ts` - Parameters → Example 08
- `tests/connection-config.test.ts` - Configuration → Example 09
- `tests/rows.test.ts` - Result handling → Example 10
- `tests/statement-status.test.ts` - Performance metrics → Example 11
- `tests/interrupt.test.ts` - Concurrent operations → Example 12

## API Reference

For quick API lookup:

- **Connection**: [see binding.d.ts](../bindings/binding.d.ts#Connection)
- **ScopedStatement**:
  [see binding.d.ts](../bindings/binding.d.ts#ScopedStatement)
- **Rows & RowIterator**: [see binding.d.ts](../bindings/binding.d.ts#Rows)

## Tips & Tricks

### Tip 1: Use Transactions for Bulk Operations

Inserting 1000 rows:

- **Without transaction**: 1000 commits (slow!)
- **With transaction**: 1 commit (fast!)

```typescript
db.transaction((conn) => {
  for (let i = 0; i < 1000; i++) {
    conn.execute("INSERT ...", data);
  }
}); // ~100x faster!
```

### Tip 2: Reuse Prepared Statements

```typescript
// Slow: compiles SQL 1000 times
for (let i = 0; i < 1000; i++) {
  db.prepare("SELECT * FROM users WHERE id = ?", (stmt) => stmt.query([i]));
}

// Fast: compiles SQL once
db.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
  for (let i = 0; i < 1000; i++) {
    stmt.query([i]);
  }
});
```

### Tip 3: Enable Foreign Keys (per connection!)

```typescript
// Must do this after opening a connection
db.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
```

### Tip 4: Use Parameterized Queries

```typescript
// Safe from SQL injection
db.execute("SELECT * FROM users WHERE name = ?", [userInput]);

// Don't concatenate!
// db.execute('SELECT * FROM users WHERE name = ' + userInput); // ✗ UNSAFE
```

### Tip 5: Check PRAGMA Before Setting

```typescript
const journalMode = db.pragmaQueryValue(null, "journal_mode");
console.log("Current mode:", journalMode);
db.pragmaUpdate(null, "journal_mode", ["wal"]);
```

## Troubleshooting

### "database is locked"

- Ensure you're using WAL mode (`journal_mode = 'wal'`)
- Check for long-running transactions
- Increase `busy_timeout` PRAGMA

### "FOREIGN KEY constraint failed"

- Remember: foreign keys are OFF by default!
- Enable with `setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true)`

### Performance issues

- Use prepared statements (reuse them!)
- Batch operations with transactions
- Create indexes on frequently-searched columns
- Check `getStatus(RusqliteStatementStatus.FullscanStep)` for table scans

### Memory leaks in long-running servers

Call periodically:

```typescript
db.releaseMemory();
db.cacheFlush();
```

## Contributing

Found an error or want to improve an example? Please submit a PR or issue!

## Further Reading

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [SQLite PRAGMA Guide](https://www.sqlite.org/pragma.html)
- [SQLite Performance Tips](https://www.sqlite.org/bestpractice.html)
- [node-rusqlite README](../README.md)
