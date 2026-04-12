/**
 * Example 12: Concurrent Operations - Interrupt Handles & State Management
 *
 * This example demonstrates how to manage concurrent or long-running database
 * operations and check connection state:
 *
 * - Getting an interrupt handle with getInterruptHandle()
 * - Interrupting long-running operations
 * - Checking busy state with isBusy()
 * - Checking autocommit state
 * - Checking if connection was interrupted
 * - Tracking changes
 */

import { Connection } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      processing_count INTEGER DEFAULT 0
    )
  `,
    [],
  );

  // Insert test data
  for (let i = 1; i <= 1000; i++) {
    db.execute(
      "INSERT INTO tasks (name) VALUES (?)",
      [`Task ${i}`],
    );
  }
}

// ============================================================================
// BEGINNER: Connection State Inspection
// ============================================================================

/**
 * Checks if the connection is currently in autocommit mode.
 *
 * BEGINNER:
 * - isAutocommit() returns true if autocommit is enabled
 * - Default: true (each statement auto-commits)
 * - false when inside a transaction
 *
 * INTERMEDIATE:
 * - Useful for debugging transaction state
 * - Helps understand if changes are automatically committed
 *
 * ADVANCED:
 * - Monitor autocommit state in server code
 * - Ensure transactions are properly scoped
 */
export function example_check_autocommit(db: Connection) {
  console.log("Checking autocommit mode:\n");

  console.log("Outside transaction:");
  console.log(`  isAutocommit: ${db.isAutocommit()}`); // true

  console.log("\nInside transaction:");
  db.transaction((conn) => {
    console.log(`  isAutocommit: ${conn.isAutocommit()}`); // false
  });

  console.log("\nBack to normal:");
  console.log(`  isAutocommit: ${db.isAutocommit()}`); // true
}

/**
 * Checks if the database is currently busy.
 *
 * BEGINNER:
 * - isBusy() returns true if a query is actively running
 * - Useful to detect long-running operations
 *
 * INTERMEDIATE:
 * - In single-threaded Node.js, rarely useful (one operation at a time)
 * - More relevant for multi-threaded SQLite usage
 * - Can indicate if a statement is still executing
 *
 * ADVANCED:
 * - Monitor for deadlocks or stalled operations
 * - Part of health check systems
 */
export function example_check_busy(db: Connection) {
  console.log("Checking busy state:\n");

  console.log("When idle:");
  console.log(`  isBusy: ${db.isBusy()}`); // false

  console.log("\nAfter query (completed):");
  db.queryOne("SELECT * FROM tasks LIMIT 1",[]);
  console.log(`  isBusy: ${db.isBusy()}`); // false (query completed)
}

/**
 * Checks if a database is read-only.
 *
 * BEGINNER:
 * - isReadonly(dbName) checks if a specific database is read-only
 * - dbName: 'main', 'temp', or attached database name
 *
 * INTERMEDIATE:
 * - Prevents writes to databases opened in read-only mode
 * - Useful for backup/reporting connections
 *
 * ADVANCED:
 * - Implement different permissions per database
 * - Audit which databases are writable
 */
export function example_check_readonly(db: Connection) {
  console.log("Checking read-only status:\n");

  const mainIsReadonly = db.isReadonly("main");
  console.log(`Main database is read-only: ${mainIsReadonly}`);

  // Try read-only database
  const roDb = Connection.open("./readonly.db");
  const isRo = roDb.isReadonly("main");
  console.log(`Read-only connection is read-only: ${isRo}`);
}

/**
 * Checks if the connection was interrupted.
 *
 * BEGINNER:
 * - isInterrupted() returns true if interrupt() was called
 * - Useful after asynchronous operations
 *
 * INTERMEDIATE:
 * - Check when resuming from async work
 * - Verify operation wasn't interrupted
 *
 * ADVANCED:
 * - Part of cancellation logic for long-running queries
 * - Used with getInterruptHandle() (see below)
 */
export function example_check_interrupted(db: Connection) {
  console.log("Checking interrupt state:\n");

  console.log("Normal operation:");
  console.log(`  isInterrupted: ${db.isInterrupted()}`); // false

  // After executing (still false unless explicitly interrupted)
  db.executeBatch("SELECT * FROM tasks LIMIT 1");
  console.log(`  isInterrupted after query: ${db.isInterrupted()}`); // false
}

/**
 * Tracks changes made in the database.
 *
 * BEGINNER:
 * - changes() returns rows affected by most recent operation
 * - totalChanges() returns all changes since connection opened
 *
 * INTERMEDIATE:
 * - Use to verify operations succeeded
 * - Track cumulative database changes
 *
 * ADVANCED:
 * - Monitor for zero changes (might indicate a bug)
 * - Part of audit logging systems
 */
export function example_track_changes(db: Connection) {
  console.log("Tracking changes:\n");

  const initialTotal = db.totalChanges();
  console.log(`Total changes before: ${initialTotal}`);

  // Insert some data
  db.execute("INSERT INTO tasks (name) VALUES (?)", ["New task 1"]);
  console.log(`Changes from insert: ${db.changes()}`);
  console.log(`Total changes after insert: ${db.totalChanges()}`);

  // Update some data
  db.execute("UPDATE tasks SET processing_count = 1 WHERE id = 1", []);
  console.log(`Changes from update: ${db.changes()}`);
  console.log(`Total changes after update: ${db.totalChanges()}`);

  // Delete some data
  db.execute("DELETE FROM tasks WHERE id > 100", []);
  console.log(`Changes from delete: ${db.changes()}`);
  console.log(`Total changes cum: ${db.totalChanges()}`);
}

// ============================================================================
// INTERMEDIATE: Getting Last Insert Row ID
// ============================================================================

/**
 * Gets the most recent inserted row ID.
 *
 * BEGINNER:
 * - lastInsertRowid() returns the rowid of the last INSERT
 * - Essential for INSERT...SELECT getting the new ID
 *
 * INTERMEDIATE:
 * - Returns 0 if last statement wasn't an INSERT
 * - Works per-connection (thread-safe in multi-threaded contexts)
 *
 * ADVANCED:
 * - Combine with changes() to verify insert succeeded
 * - Only reliable immediately after INSERT (same connection)
 */
export function example_last_insert_rowid(db: Connection) {
  console.log("Getting last inserted row ID:\n");

  db.execute("INSERT INTO tasks (name) VALUES (?)", ["Task A"]);
  const idA = db.lastInsertRowid();
  console.log(`Inserted row ID: ${idA}`);

  db.execute("INSERT INTO tasks (name) VALUES (?)", ["Task B"]);
  const idB = db.lastInsertRowid();
  console.log(`Next inserted row ID: ${idB}`);

  // After non-insert query
  db.queryOne("SELECT * FROM tasks LIMIT 1",[]);
  const afterSelect = db.lastInsertRowid();
  console.log(
    `Last insert ID after SELECT (unchanged): ${afterSelect}`,
  );
}

// ============================================================================
// ADVANCED: Interrupt Handles & Long-Running Operations
// ============================================================================

/**
 * Gets an interrupt handle for canceling long-running operations.
 *
 * BEGINNER:
 * - getInterruptHandle() returns a handle to interrupt this connection
 * - Useful for canceling long queries
 *
 * INTERMEDIATE:
 * - Call interrupt() on the handle to stop the current operation
 * - Used with timeouts or user cancellation
 *
 * ADVANCED:
 * - Pass handle to worker threads to allow cancellation
 * - Implement timeout logic for safety
 */
export function example_interrupt_handle(db: Connection) {
  const handle = db.getInterruptHandle();
  console.log("Got interrupt handle");

  // Simulate a long-running operation
  db.prepare("SELECT * FROM tasks", (stmt) => {
    console.log("Starting long query...");

    // In real code, you'd pass this handle to another thread/task
    // that might call handle.interrupt() to cancel

    const rows = stmt.query([]);
    console.log(`Query completed: ${rows.toJSON().length} rows`);
  });
}

/**
 * Demonstrates timeout pattern for operations.
 *
 * BEGINNER:
 * - Get interrupt handle before operation
 * - Set a timeout to call interrupt() if operation takes too long
 *
 * INTERMEDIATE:
 * - Safety mechanism for preventing hangs
 * - Common in server applications
 *
 * ADVANCED:
 * - Real implementation needs threading/async awareness
 * - SQLite will stop executing when interrupt is called
 * - Check isInterrupted() after operation
 */
export function example_timeout_pattern_theory(db: Connection) {
  console.log("Timeout pattern (theoretical):\n");

  const handle = db.getInterruptHandle();

  // In a real async environment:
  // const timeoutId = setTimeout(() => {
  //   console.log('Operation timed out, interrupting...');
  //   handle.interrupt();
  // }, 5000);

  // try {
  //   db.execute('SELECT ... some long query');
  // } finally {
  //   clearTimeout(timeoutId);
  // }
  // if (db.isInterrupted()) {
  //   console.log('Operation was interrupted');
  // }

  console.log(
    "Pattern: get handle → set timeout → execute → check interrupted",
  );
}

/**
 * Demonstrates cancellation pattern with interrupt handle.
 *
 * BEGINNER:
 * - Get handle before long operation
 * - Monitor if operation completes
 *
 * INTERMEDIATE:
 * - Useful for APIs with timeout requirements
 * - Prevent resource exhaustion from stalled queries
 *
 * ADVANCED:
 * - In Node.js, would need worker_threads for true parallelism
 * - SQLite supports multi-threaded access with proper serialization
 */
export function example_cancellation_pattern(db: Connection) {
  console.log("Cancellation pattern:\n");

  const handle = db.getInterruptHandle();

  // Simulate an operation that might be interrupted from another context
  db.transaction((conn) => {
    for (let i = 0; i < 10; i++) {
      conn.execute("INSERT INTO tasks (name) VALUES (?)", [
        `Batch task ${i}`,
      ]);

      // In real code, check if interrupted
      if (db.isInterrupted()) {
        console.log("Operation was interrupted, rolling back");
        break;
      }
    }
  });

  console.log("Batch operation completed");
}

// ============================================================================
// ADVANCED: State Management Patterns
// ============================================================================

/**
 * Connection health check example.
 *
 * BEGINNER:
 * - Verify connection is in expected state
 *
 * INTERMEDIATE:
 * - Use in connection pool health checks
 * - Detect stalled or corrupt connections
 *
 * ADVANCED:
 * - Automate connection monitoring
 * - Decide when to recycle connections
 */
export function example_connection_health_check(db: Connection) {
  console.log("Connection health check:\n");

  const checks = {
    isAutocommit: db.isAutocommit(),
    isBusy: db.isBusy(),
    isInterrupted: db.isInterrupted(),
    isReadonly: db.isReadonly("main"),
  };

  console.log("Status:");
  console.log(`  Autocommit: ${checks.isAutocommit ? "✓" : "✗"}`);
  console.log(`  Not busy: ${!checks.isBusy ? "✓" : "✗"}`);
  console.log(`  Not interrupted: ${!checks.isInterrupted ? "✓" : "✗"}`);
  console.log(`  Writable: ${!checks.isReadonly ? "✓" : "✗"}`);

  const isHealthy = checks.isAutocommit &&
    !checks.isBusy &&
    !checks.isInterrupted &&
    !checks.isReadonly;

  console.log(
    `\nOverall: ${isHealthy ? "✓ Healthy" : "✗ Unhealthy"}`,
  );
}

/**
 * Database path inspection.
 *
 * BEGINNER:
 * - path() returns the database file path
 * - Empty string for in-memory databases
 *
 * INTERMEDIATE:
 * - Distinguish between file-based and in-memory
 * - Useful for logging or testing
 *
 * ADVANCED:
 * - Verify you're connected to the right database
 * - Part of integration tests
 */
export function example_database_path(db: Connection) {
  console.log("Database paths:\n");

  const filePath = db.path();
  console.log(`Current path: ${filePath || "(in-memory)"}`);

  const fileDb = Connection.open("./test-db.sqlite");
  console.log(`File DB path: ${fileDb.path()}`);

  const memDb = Connection.openInMemory();
  console.log(`Memory DB path: ${memDb.path() || "(in-memory)"}`);
}

/**
 * Memory management inspection.
 *
 * BEGINNER:
 * - releaseMemory() suggests to SQLite to release unused cache
 * - cacheFlush() flushes pages to disk
 *
 * INTERMEDIATE:
 * - Important in long-running servers
 * - Monitor memory usage
 *
 * ADVANCED:
 * - Part of periodic maintenance routines
 */
export function example_memory_management(db: Connection) {
  console.log("Memory management:\n");

  // Execute some queries to populate cache
  for (let i = 0; i < 100; i++) {
    db.queryOne("SELECT * FROM tasks WHERE id = ?", [i + 1]);
  }

  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memory before cleanup: ${memBefore.toFixed(2)} MB`);

  // Suggest SQLite to release memory
  db.releaseMemory();
  db.cacheFlush();

  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memory after cleanup: ${memAfter.toFixed(2)} MB`);
  console.log(`Freed: ${(memBefore - memAfter).toFixed(2)} MB`);
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 12: Concurrent Operations & State ===\n");

  console.log("--- Connection State ---");
  example_check_autocommit(db);

  console.log("\n--- Busy State ---");
  example_check_busy(db);

  console.log("\n--- Read-Only Check ---");
  example_check_readonly(db);

  console.log("\n--- Interrupt State ---");
  example_check_interrupted(db);

  console.log("\n--- Tracking Changes ---");
  example_track_changes(db);

  console.log("\n--- Last Insert Row ID ---");
  example_last_insert_rowid(db);

  console.log("\n--- Interrupt Handle ---");
  example_interrupt_handle(db);

  console.log("\n--- Timeout Pattern ---");
  example_timeout_pattern_theory(db);

  console.log("\n--- Cancellation Pattern ---");
  example_cancellation_pattern(db);

  console.log("\n--- Connection Health Check ---");
  example_connection_health_check(db);

  console.log("\n--- Database Path ---");
  example_database_path(db);

  console.log("\n--- Memory Management ---");
  example_memory_management(db);
}
