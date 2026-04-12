# node-rusqlite Benchmarks

Comprehensive performance benchmarks for node-rusqlite using Deno's native bench
framework.

## Overview

This benchmark suite measures the performance of node-rusqlite (napi-rs Rust
binding to rusqlite) across various database operations and scenarios.

**Benchmark Categories:**

1. **Basic CRUD** - INSERT, SELECT, UPDATE, DELETE operations
2. **Prepared Statements** - Inline SQL vs prepared statement reuse
3. **Transactions** - Different transaction behaviors (DEFERRED, IMMEDIATE,
   EXCLUSIVE)
4. **Bulk Operations** - Large dataset handling (50K+ rows)
5. **Connection Modes** - File-based vs in-memory database performance
6. **Concurrent Operations** - Multiple connections and access patterns

## Running Benchmarks

### Run all benchmarks

```bash
deno bench benchmark/*.bench.ts
```

Or using the npm task:

```bash
deno task bench
```

### Run specific benchmark category

```bash
# CRUD operations
deno task bench:crud

# Prepared statements
deno task bench:prepared

# Transactions
deno task bench:transactions

# Bulk operations
deno task bench:bulk

# Connection modes
deno task bench:connmodes

# Concurrent operations
deno task bench:concurrent
```

### Run individual benchmark file

```bash
deno bench benchmark/basic-crud.bench.ts --filter "INSERT"
```

## Understanding Results

Each benchmark displays:

- **name** - Operation being tested
- **baseline** - First test in each group (marked as baseline)
- **ops/sec** - Operations per second
- **avg** - Average time per operation
- **min/max** - Minimum and maximum times

Example output:

```
bench basic-crud ... measured 5 samples
  INSERT single row (10K)                 time    149.87 ms  rate   66.72 ops/sec
  SELECT by ID (10K)                      time    201.25 ms  rate   49.69 ops/sec
  UPDATE (5K)                             time    150.40 ms  rate   66.43 ops/sec
  DELETE (5K)                             time    135.22 ms  rate   73.95 ops/sec
  SELECT with iteration (1000 rows)       time     45.32 ms  rate   22.07 ops/sec
```

## Benchmark Details

### Basic CRUD (basic-crud.bench.ts)

Tests fundamental database operations:

- **INSERT single row** - 10K individual INSERT statements
- **SELECT by ID** - 10K queries using WHERE id = ?
- **UPDATE** - 5K update statements
- **DELETE** - 5K delete statements
- **SELECT with iteration** - Reading 1000 rows and iterating through them

### Prepared Statements (prepared-statements.bench.ts)

Compares prepared statement optimization:

- **Inline SQL** - Fresh SQL parsing for each query
- **Prepared statement reuse** - Compiled statement reused
- **Multiple parameters** - Queries with 3+ parameter bindings
- **LIKE queries** - Pattern matching performance

### Transactions (transactions.bench.ts)

Tests transaction performance and behaviors:

- **No transaction** - Batch of 10K INSERTs without transaction (slow)
- **DEFERRED** - Default transaction behavior (best for batches)
- **IMMEDIATE** - Acquires lock immediately
- **EXCLUSIVE** - Locks database exclusively
- **Savepoint** - Nested transaction rollback

### Bulk Operations (bulk-operations.bench.ts)

Tests handling of large datasets:

- **Bulk INSERT** - 50K rows in a single transaction
- **Bulk SELECT and iterate** - Read and iterate 50K rows
- **Bulk UPDATE** - Update 50K rows
- **Aggregation queries** - COUNT, SUM, AVG with filtering

### Connection Modes (connection-modes.bench.ts)

Compares file-based vs in-memory databases:

- **File-based INSERT** - Writes to disk (slower)
- **In-memory INSERT** - RAM only (faster)
- **File-based SELECT** - Disk reads (slower)
- **In-memory SELECT** - RAM reads (faster)
- **File vs memory UPDATE** - Transaction updates

### Concurrent Operations (concurrent.bench.ts)

Tests multiple connections and mixed workloads:

- **Multiple connections** - 5 connections doing 1K ops each
- **Concurrent reads** - 5 threads reading from same database
- **Interleaved reads/writes** - 50/50 mix of reads and writes
- **Heavy write contention** - 5K inserts in transaction

## Performance Tips

Based on these benchmarks, here are optimization patterns:

### Use transactions for bulk operations

```typescript
conn.transaction((tx) => {
  for (let i = 0; i < 50000; i++) {
    tx.execute("INSERT INTO table VALUES (?)", [i]);
  }
});
```

**Impact**: ~50-100x faster than individual statements

### Reuse prepared statements

```typescript
conn.prepare("SELECT * FROM table WHERE id = ?", (stmt) => {
  for (let i = 0; i < 10000; i++) {
    stmt.query([i]);
  }
});
```

**Impact**: ~10-20% faster for repeated queries

### Prefer in-memory databases for temporary data

```typescript
const temp = Connection.openInMemory();
// ~50-100% faster than file-based
```

### Use DEFERRED transactions for reads

```typescript
conn.transaction((tx) => {
  // Reads only, no lock until needed
});
```

### Use IMMEDIATE for mixed workloads

```typescript
conn.transactionWithBehavior("Immediate", (tx) => {
  // Reads and writes together
});
```

## Development

### Adding new benchmarks

Create a new `.bench.ts` file in the `benchmark/` directory:

```typescript
import { Connection } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";

let dbPath = "";
let conn: Connection;

function setup() {
  dbPath = getTempDbPath("my-bench");
  conn = Connection.open(dbPath);
  // Create schema
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: "My benchmark",
  group: "My Group",
  baseline: true,
  fn() {
    setup();
    try {
      // Benchmark code here
    } finally {
      teardown();
    }
  },
});
```

### Utility functions

Available from `./utils.ts`:

- `getTempDbPath(name)` - Create temporary database file
- `cleanupDb(path)` - Remove database file
- `Timer` - High-resolution timer class
- `captureMemory()` - Get heap memory snapshot
- `memoryDelta()` - Calculate memory change
- `generateTestUsers()` - Generate test data

## Notes

- Benchmarks run on `localhost` with no network I/O
- Each benchmark runs multiple times (configurable via `--reps`)
- Results vary based on system load and disk speed
- File-based benchmarks use `/tmp` directory
- In-memory benchmarks use RAM only

## Further Reading

- [Deno Benchmarking](https://docs.deno.com/runtime/reference/cli/bench/)
- [node-rusqlite API](../bindings/binding.d.ts)
- [rusqlite documentation](https://docs.rs/rusqlite/)
