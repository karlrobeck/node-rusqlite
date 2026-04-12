/**
 * Example 1: Basic Setup - Opening and Connecting to SQLite Databases
 *
 * This example demonstrates the fundamentals of connecting to SQLite databases
 * using node-rusqlite. You'll learn how to:
 *
 * - Open a file-based database (persisted to disk)
 * - Open an in-memory database (temporary, data lost when process ends)
 * - Use optional connection flags and VFS settings
 * - Handle connection errors
 */

import { Connection, OpenFlags } from "../bindings/binding.js";

// ============================================================================
// BEGINNER: Basic Connection Patterns
// ============================================================================

/**
 * Opens a file-based SQLite database at the given path.
 *
 * BEGINNER:
 * - `Connection.open()` is the main entry point for connecting to SQLite
 * - The path is where the database file will be created/opened
 * - If the file doesn't exist, SQLite creates it automatically
 * - The method returns a connection object you use for queries
 *
 * INTERMEDIATE:
 * - Default flags are SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE
 * - The second parameter `options` lets you customize flags and VFS
 *
 * ADVANCED:
 * - File-based databases are persisted: data survives process restart
 * - Use for production applications where you need durability
 * - SQLite handles locking automatically for concurrent access
 */
export function example_open_file_database() {
  const db = Connection.open("./my-database.db");
  console.log(`Connected to: ${db.path()}`);

  // Use the connection...
  // db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');

  // Note: No explicit close() needed in Node.js; cleanup happens automatically
}

/**
 * Opens an in-memory SQLite database.
 *
 * BEGINNER:
 * - `Connection.openInMemory()` creates a temporary database in RAM
 * - Data exists only while the Node.js process runs
 * - When the process ends, all data is lost
 * - Useful for testing, temporary calculations, or demo purposes
 *
 * INTERMEDIATE:
 * - Each call creates a separate, isolated database
 * - No disk I/O, so in-memory databases are very fast
 * - Perfect for unit tests where you want a fresh database each time
 *
 * ADVANCED:
 * - Use :memory: in URI (if VFS is specified) for SQLite compatibility
 * - Each in-memory database is thread-local if using multiple threads
 * - Memory usage grows as you insert data; no automatic cleanup
 */
export function example_open_inmemory_database() {
  const db = Connection.openInMemory();

  // Create a schema and insert test data
  db.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)", []);
  db.execute("INSERT INTO test (value) VALUES (?)", ["hello"]);

  const row = db.queryRow("SELECT * FROM test", []);
  console.log("Test row:", row);

  // When this function ends and db goes out of scope, memory is freed
}

// ============================================================================
// INTERMEDIATE: Connection Options and Flags
// ============================================================================

/**
 * Opens a database with custom flags and options.
 *
 * BEGINNER:
 * - The second parameter `ConnectionOptions` controls how the DB opens
 * - `flags`: Bitwise OR of OpenFlags enum values
 * - `vfs`: Name of the VFS module to use (advanced; usually omitted)
 *
 * INTERMEDIATE:
 * - `OpenFlags` enum includes options like:
 *   - SQLITE_OPEN_READONLY: Open as read-only (no writes)
 *   - SQLITE_OPEN_READWRITE: Open for reading and writing
 *   - SQLITE_OPEN_CREATE: Create if doesn't exist
 *   - SQLITE_OPEN_WAL: Use write-ahead logging (faster, more concurrent)
 *
 * ADVANCED:
 * - You typically combine flags: READWRITE | CREATE (the default)
 * - READONLY is useful for backup/reporting apps
 * - WAL mode enables better concurrency but uses slightly more disk space
 * - MEMORY flag creates in-memory databases via the flags parameter
 */
export function example_open_with_flags() {
  // Open as read-only (will fail if file doesn't exist)
  try {
    const readOnlyDb = Connection.open("./existing-database.db", {
      flags: OpenFlags.SqliteOpenReadonly,
    });
    console.log("Opened read-only database");
    // readOnlyDb.execute('DELETE FROM users'); // This would fail!
  } catch (e) {
    console.error("Failed to open read-only database:", e);
  }

  // Open with custom VFS (rarely used; check your SQLite build)
  // const customDb = Connection.open('./my.db', {
  //   vfs: 'my-custom-vfs'
  // });
}

/**
 * Opens a database in WAL (Write-Ahead Logging) mode for better concurrency.
 *
 * BEGINNER:
 * - WAL mode allows readers and writers to work simultaneously
 * - Default mode (journal) blocks readers while writers are active
 *
 * INTERMEDIATE:
 * - WAL creates extra files: -wal and -shm (don't delete them!)
 * - Slightly faster writes and better parallelism
 * - Requires synchronous filesystem for full safety
 *
 * ADVANCED:
 * - Enable WAL via PRAGMA journal_mode = 'wal' (see example 05)
 * - Useful for concurrent workloads like API servers
 * - Check the SQLite documentation for WAL trade-offs
 */
export function example_open_and_enable_wal() {
  const db = Connection.open("./wal-database.db");

  // Enable WAL mode via PRAGMA (preferred over flags)
  db.pragmaUpdate(null, "journal_mode", "wal");

  console.log("Enabled WAL mode for better concurrency");
}

// ============================================================================
// ADVANCED: Connection State and Error Handling
// ============================================================================

/**
 * Demonstrates connection state inspection and error handling.
 *
 * BEGINNER:
 * - Once opened, you can check if the connection is in a specific state
 * - `path()` returns the file path (or empty string for in-memory)
 * - `isAutocommit()` tells you if auto-commit is enabled
 *
 * INTERMEDIATE:
 * - `isReadonly()` checks if a specific database is read-only
 * - `isBusy()` tells you if a long operation is running
 * - `isInterrupted()` tells you if the connection was interrupted (see example 12)
 *
 * ADVANCED:
 * - Use these for debugging connection state in servers
 * - Combine with error handling for robust applications
 */
export function example_inspect_connection_state() {
  const db = Connection.openInMemory();

  console.log("Path:", db.path() || "<in-memory>");
  console.log("Is autocommit:", db.isAutocommit());
  console.log("Main DB is readonly:", db.isReadonly("main"));
  console.log("Is busy:", db.isBusy());
  console.log("Is interrupted:", db.isInterrupted());
  console.log("Changes:", db.changes());
  console.log("Total changes:", db.totalChanges());
}

/**
 * Safely handles errors when opening databases.
 *
 * BEGINNER:
 * - Use try-catch to handle connection errors gracefully
 * - Common errors: file doesn't exist (read-only), no permissions, corrupted file
 *
 * INTERMEDIATE:
 * - Check if file exists before opening in read-only mode
 * - Use appropriate default paths or fallbacks
 *
 * ADVANCED:
 * - Implement connection pooling for servers (beyond this example)
 * - Log errors for debugging
 * - Use config files to specify database paths
 */
export function example_safe_connection() {
  try {
    const db = Connection.open("./my-app.db");
    console.log(`Successfully connected to ${db.path()}`);
    return db;
  } catch (error) {
    console.error("Failed to connect to database:", error);

    // Fallback: use in-memory database
    console.log("Falling back to in-memory database");
    return Connection.openInMemory();
  }
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  console.log("=== Example 1: Basic Setup ===\n");

  console.log("1. Opening file-based database:");
  example_open_file_database();

  console.log("\n2. Opening in-memory database:");
  example_open_inmemory_database();

  console.log("\n3. Opening with flags:");
  example_open_with_flags();

  console.log("\n4. Opening with WAL mode:");
  example_open_and_enable_wal();

  console.log("\n5. Inspecting connection state:");
  example_inspect_connection_state();

  console.log("\n6. Safe connection with fallback:");
  const db = example_safe_connection();
}
