/**
 * Example 5: PRAGMA Operations - Database Configuration & Tuning
 *
 * PRAGMAs are SQLite configuration directives that control database behavior.
 * This example demonstrates:
 *
 * - Reading PRAGMA values with pragmaQueryValue()
 * - Querying PRAGMAs that return rows with pragmaQuery()
 * - Updating PRAGMAs with pragmaUpdate()
 * - Checking PRAGMA results with pragmaUpdateAndCheck()
 * - Common PRAGMAs used in production
 */

import { Connection } from "../bindings/binding.js";

// ============================================================================
// BEGINNER: Reading PRAGMAs
// ============================================================================

/**
 * Reads a single PRAGMA value.
 *
 * BEGINNER:
 * - pragmaQueryValue() reads a PRAGMA and returns a single value
 * - Useful for simple scalar PRAGMAs (numbers, strings)
 * - Returns unknown type (TypeScript); cast to expected type
 *
 * INTERMEDIATE:
 * - Arguments: (schemaName, pragmaName)
 * - schemaName: null for main database, or 'database_name' for attached DBs
 * - pragmaName: the PRAGMA name without 'PRAGMA ' prefix
 *
 * ADVANCED:
 * - Some PRAGMAs return multiple values (see pragmaQuery)
 * - Read-only PRAGMAs cannot be set
 */
export function example_read_simple_pragma(db: Connection) {
  // Read the current page size (default 4096 on most systems)
  const pageSize = db.pragmaQueryValue(null, "page_size") as number;
  console.log("Page size:", pageSize);

  // Read the journal mode (how SQLite writes to disk)
  const journalMode = db.pragmaQueryValue(null, "journal_mode") as string;
  console.log("Journal mode:", journalMode);

  // Read the cache size (negative = KB, positive = pages)
  const cacheSize = db.pragmaQueryValue(null, "cache_size") as number;
  console.log("Cache size:", cacheSize);
}

/**
 * Reads a PRAGMA that returns multiple columns via pragmaQuery().
 *
 * BEGINNER:
 * - pragmaQuery() returns the result as a plain JavaScript object
 * - Useful for PRAGMAs that return multiple fields
 * - Often returns a single row (as an object with multiple keys)
 *
 * INTERMEDIATE:
 * - The return type is Record<string, unknown>
 * - Column names from the result become object keys
 * - Can safely cast to a more specific type after reading
 *
 * ADVANCED:
 * - Use pragmaQueryValue() for single-value PRAGMAs (faster)
 * - Use pragmaQuery() for multi-column results
 */
export function example_read_multi_column_pragma(db: Connection) {
  // table_info returns columns of a table
  // Note: This is actually not a PRAGMA but demonstrates the pattern
  // Real example: database_list
  const dbList = db.pragmaQuery(null, "database_list") as Record<
    string,
    unknown
  >;
  console.log("Database list:", dbList);

  // pragma_list returns PRAGMA information (if available in your SQLite version)
  // Just show the pattern:
  // const pragmaInfo = db.pragmaQuery(null, 'pragma_list');
  // console.log('Available PRAGMAs:', pragmaInfo);
}

// ============================================================================
// INTERMEDIATE: Querying & Setting PRAGMAs
// ============================================================================

/**
 * Sets a PRAGMA value without checking the result.
 *
 * BEGINNER:
 * - pragmaUpdate() sets a PRAGMA and discards the result
 * - Returns Promise<void>
 *
 * INTERMEDIATE:
 * - Arguments: (schemaName, pragmaName, pragmaValue[])
 * - pragmaValue is an array of values to set
 * - Most common: single-value array [value]
 *
 * ADVANCED:
 * - Only use pragmaUpdate() if you don't care about the result
 * - Use pragmaUpdateAndCheck() to verify it was set
 * - Some PRAGMAs are read-only (will fail)
 */
export async function example_set_pragma_without_check(db: Connection) {
  // Set the timeout value (in milliseconds)
  await db.pragmaUpdate(null, "busy_timeout", 5000);
  console.log("Set busy timeout to 5000ms");

  // Enable foreign keys (must be done per-connection; off by default!)
  await db.pragmaUpdate(null, "foreign_keys", 1);
  console.log("Enabled foreign keys");

  // Set synchronous mode (0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA)
  await db.pragmaUpdate(null, "synchronous", 1);
  console.log("Set synchronous mode to NORMAL");
}

/**
 * Sets a PRAGMA and checks the result.
 *
 * BEGINNER:
 * - pragmaUpdateAndCheck() sets a PRAGMA and returns the result
 * - Useful to verify the setting was applied
 *
 * INTERMEDIATE:
 * - Returns the PRAGMA result as an object
 * - Compare returned value with expected value
 *
 * ADVANCED:
 * - Some PRAGMAs return differently than set values
 * - Always check the result if you need certainty
 */
export function example_set_pragma_and_check(db: Connection) {
  // Set journal mode to WAL and check it was applied
  const result = db.pragmaUpdateAndCheck(null, "journal_mode", "wal") as Record<
    string,
    unknown
  >;
  console.log("Journal mode after setting:", result);
  // Typically returns something like { journal_mode: 'wal' }

  // Set cache
  try {
    const cacheResult = db.pragmaUpdateAndCheck(
      null,
      "cache_size",
      -64000,
    ) as Record<
      string,
      unknown
    >;
    console.log("Cache size after setting:", cacheResult);
  } catch (err) {
    console.error("Failed to set cache size:", err);
  }
}

/**
 * Runs a PRAGMA with a callback for the result.
 *
 * BEGINNER:
 * - pragma() is the lowest-level PRAGMA method
 * - Takes a callback that receives the result row
 * - Mostly useful internally; pragmaQueryValue/pragmaQuery are easier
 *
 * INTERMEDIATE:
 * - Callback receives Record<string, unknown>
 * - Can do custom processing on the result
 *
 * ADVANCED:
 * - Used when you need fine-grained control
 * - Try pragmaUpdateAndCheck() first; this is rarely needed
 */
export function example_pragma_with_callback(db: Connection) {
  db.pragma(null, "query_only", [0], (result) => {
    console.log("Query-only PRAGMA result:", result);
  });
}

// ============================================================================
// INTERMEDIATE & ADVANCED: Common Production PRAGMAs
// ============================================================================

/**
 * Configures SQLite for typical production use.
 *
 * BEGINNER:
 * - Shows a recommended configuration for reliable applications
 *
 * INTERMEDIATE:
 * - Each PRAGMA is independent; you can set them individually
 *
 * ADVANCED:
 * - These settings prioritize reliability over raw speed
 * - Adjust for your specific needs (see below)
 */
export function configure_production_database(db: Connection) {
  console.log("Configuring database for production...\n");

  // FOREIGN_KEYS: Enable foreign key constraint checking
  // Default: OFF (for SQLite compatibility)
  // Recommended: ON to prevent orphaned records
  db.pragmaUpdate(null, "foreign_keys", 1);
  console.log("✓ Enabled foreign keys");

  // JOURNAL_MODE: Control write strategy
  // Default: delete (older, slower)
  // Options: delete, truncate, persist, wal
  // WAL: fastest for typical workloads, good concurrency
  db.pragmaUpdateAndCheck(null, "journal_mode", "wal");
  console.log("✓ Set journal mode to WAL");

  // SYNCHRONOUS: How hard to push data to disk
  // Default: 2 (FULL) - safest, slowest
  // Option: 1 (NORMAL) - good balance
  // Option: 0 (OFF) - fastest, risky
  // Recommended: 1 (NORMAL) for most apps
  db.pragmaUpdate(null, "synchronous", 1);
  console.log("✓ Set synchronous to NORMAL");

  // CACHE_SIZE: Memory used for caching pages
  // Default: 2000 pages
  // Positive: number of pages
  // Negative: KB (e.g., -64000 = 64MB)
  // Recommended: -64000 or larger for production
  db.pragmaUpdate(null, "cache_size", -64000);
  console.log("✓ Set cache size to 64MB");

  // TEMP_STORE: Where to put temporary tables
  // 0 (DEFAULT): decide based on compile-time options
  // 1 (FILE): use file temp directory
  // 2 (MEMORY): use RAM
  // Recommended: 2 for speed, 1 for large temp sets
  db.pragmaUpdate(null, "temp_store", 2);
  console.log("✓ Set temp store to MEMORY");

  // AUTO_VACUUM: Automatically reclaim unused space
  // 0 (NONE): don't reclaim (default)
  // 1 (FULL): reclaim after every transaction
  // 2 (INCREMENTAL): reclaim on PRAGMA incremental_vacuum
  // Recommended: 2 (incremental) for production to avoid long pauses
  db.pragmaUpdate(null, "auto_vacuum", 2);
  console.log("✓ Set auto vacuum to INCREMENTAL");

  // MMAP_SIZE: Memory-map file I/O
  // 0 (OFF): use normal I/O
  // > 0: use mmap with this size limit (e.g., 30000000 = 30MB)
  // Recommended: 30000000 for production
  db.pragmaUpdate(null, "mmap_size", 30000000);
  console.log("✓ Enabled memory-mapping (30MB)");

  // BUSY_TIMEOUT: How long to wait if DB is locked
  // In milliseconds; 0 = fail immediately
  // Recommended: 5000 (5 seconds) for production
  db.pragmaUpdate(null, "busy_timeout", 5000);
  console.log("✓ Set busy timeout to 5000ms");

  console.log("\nDatabase configured for production!");
}

/**
 * Configures SQLite for testing/development.
 *
 * BEGINNER:
 * - Testing prioritizes simplicity and speed over durability
 *
 * INTERMEDIATE:
 * - Looser settings since test data isn't critical
 *
 * ADVANCED:
 * - These are fast, but don't use in production!
 */
export function configure_testing_database(db: Connection) {
  console.log("Configuring database for testing...\n");

  // Disable synchronization for speed
  db.pragmaUpdate(null, "synchronous", 0);
  console.log("✓ Disabled synchronous (FAST)");

  // Use in-memory journals for testing
  db.pragmaUpdate(null, "journal_mode", "memory");
  console.log("✓ Set journal mode to MEMORY");

  // Larger cache for tests
  db.pragmaUpdate(null, "cache_size", -200000);
  console.log("✓ Set cache size to 200MB");

  // No auto-vacuum in tests
  db.pragmaUpdate(null, "auto_vacuum", 0);
  console.log("✓ Disabled auto-vacuum");

  // Enable foreign keys for testing
  db.pragmaUpdate(null, "foreign_keys", 1);
  console.log("✓ Enabled foreign keys");

  console.log("\nDatabase configured for testing!");
}

// ============================================================================
// ADVANCED: Schema-Specific PRAGMAs
// ============================================================================

/**
 * Uses PRAGMAs with table_info to inspect table structure.
 *
 * BEGINNER:
 * - table_info(tableName) returns details about a table's columns
 * - Each row describes one column
 *
 * INTERMEDIATE:
 * - Similar to PRAGMA but returns multiple rows
 * - Get column names, types, constraints
 *
 * ADVANCED:
 * - Use for runtime schema discovery
 * - Build ORMs or query builders with this info
 */
export function example_table_info_pragma(db: Connection) {
  // Create a sample table
  db.execute(
    `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  // Get column info (note: this uses PRAGMA table_info, not pragmaQuery)
  // In real code, you'd use prepare() + query() for this
  // db.prepare('PRAGMA table_info(users)', (stmt) => {
  //   const columns = stmt.query([]);
  //   console.log('Columns:', columns.toJSON());
  // });
}

/**
 * Demonstrates other useful informational PRAGMAs.
 *
 * BEGINNER:
 * - Various PRAGMAs provide database info
 *
 * INTERMEDIATE:
 * - database_list: attached databases
 * - index_list: indexes on a table
 * - foreign_key_list: foreign keys in a table
 *
 * ADVANCED:
 * - Use for introspection and debugging
 */
export function example_introspection_pragmas(db: Connection) {
  // Get list of attached databases
  console.log("Main DB page size:", db.pragmaQueryValue(null, "page_size"));

  // Note: Most introspection is via PRAGMA queries, use prepare() for them
  // db.prepare('PRAGMA database_list', (stmt) => {
  //   const result = stmt.query([]);
  //   console.log('Databases:', result.toJSON());
  // });
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();

  console.log("=== Example 5: PRAGMA Operations ===\n");

  console.log("--- Reading PRAGMAs ---");
  example_read_simple_pragma(db);

  console.log("\n--- Setting PRAGMAs ---");
  example_set_pragma_and_check(db);

  console.log("\n--- Production Configuration ---");
  configure_production_database(db);

  console.log("\n--- Testing Configuration ---");
  const testDb = Connection.openInMemory();
  configure_testing_database(testDb);

  console.log("\n--- Schema Introspection ---");
  example_table_info_pragma(db);
  example_introspection_pragmas(db);
}
