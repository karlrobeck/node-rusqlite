/**
 * Example 9: Database Configuration - dbConfig & setDbConfig
 *
 * Database configuration flags control SQLite behavior. This example demonstrates:
 *
 * - Reading configuration flags with dbConfig()
 * - Setting configuration flags with setDbConfig()
 * - Overview of all 21+ DbConfig options
 * - Common production configurations
 * - Advanced tuning for specific workloads
 */

import { Connection, DbConfig } from "../bindings/binding.js";

// ============================================================================
// BEGINNER: Understanding Database Configuration
// ============================================================================

/**
 * Reads the current value of a database configuration flag.
 *
 * BEGINNER:
 * - dbConfig() reads a single config flag
 * - Returns a value (meaning depends on the specific flag)
 * - Most flags are boolean (0 = off, 1 = on)
 *
 * INTERMEDIATE:
 * - Some flags have multiple states (e.g., logging levels)
 * - Returns type: unknown (cast to appropriate type)
 *
 * ADVANCED:
 * - Configuration is per-connection
 * - Different connections can have different settings
 */
export function example_read_config(db: Connection) {
  // Read which config flags are enabled
  const fkeyEnabled = db.dbConfig(DbConfig.SqliteDbconfigEnableFkey);
  console.log("FOREIGN_KEYS enabled:", fkeyEnabled);

  const triggersEnabled = db.dbConfig(DbConfig.SqliteDbconfigEnableTrigger);
  console.log("TRIGGERS enabled:", triggersEnabled);

  const defensiveEnabled = db.dbConfig(DbConfig.SqliteDbconfigDefensive);
  console.log("DEFENSIVE mode enabled:", defensiveEnabled);
}

/**
 * Sets a database configuration flag.
 *
 * BEGINNER:
 * - setDbConfig(flag, enabled) changes a configuration
 * - enabled: true (1) or false (0) for boolean flags
 * - Takes effect immediately
 *
 * INTERMEDIATE:
 * - Most flags are runtime-configurable (can change on the fly)
 * - Some flags must be set before any operations
 *
 * ADVANCED:
 * - Configuration is per-connection; affects only this db instance
 * - Different connections can have different settings
 */
export function example_set_config(db: Connection) {
  // Enable foreign keys (important for referential integrity!)
  db.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
  console.log("Enabled FOREIGN_KEYS");

  // Enable triggers
  db.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true);
  console.log("Enabled TRIGGERS");

  // Enable defensive mode (SQLite rejects suspicious queries)
  db.setDbConfig(DbConfig.SqliteDbconfigDefensive, true);
  console.log("Enabled DEFENSIVE mode");

  // Reset defensive mode
  db.setDbConfig(DbConfig.SqliteDbconfigDefensive, false);
  console.log("Disabled DEFENSIVE mode");
}

// ============================================================================
// INTERMEDIATE: Core Database Configuration Options
// ============================================================================

/**
 * Configures fundamental SQLite behavior with key flags.
 *
 * BEGINNER:
 * - These are the most commonly used configuration options
 *
 * INTERMEDIATE:
 * - SqliteDbconfigEnableFkey: Enable/disable foreign key constraints
 *   - Default: OFF (for backward compatibility)
 *   - Recommended: ON (prevents orphaned records)
 * - SqliteDbconfigEnableTrigger: Enable/disable automatic triggers
 *   - Default: ON
 *   - Only disable if you're certain you don't use triggers
 * - SqliteDbconfigEnableQpsg: Query Planner Stability Guarantee
 *   - Default: OFF
 *   - ON: Plans don't change between runs (less optimization)
 * - SqliteDbconfigEnableView: Enable virtual tables via CREATE VIRTUAL TABLE
 *   - Default: ON
 *   - Only disable for security in untrusted databases
 *
 * ADVANCED:
 * - Enable FOREIGN_KEYS first thing after opening a connection
 * - Most apps want TRIGGERS and VIEW enabled
 * - QPSG useful for reproducible query plans in testing
 */
export function configure_core_behavior(db: Connection) {
  console.log("Configuring core SQLite behavior:\n");

  // Critical: Enable foreign keys (must do this per-connection)
  db.setDbConfig(DbConfig.SqliteDbconfigEnableFkey, true);
  console.log("✓ Enabled FOREIGN_KEYS");

  // Ensure triggers work
  db.setDbConfig(DbConfig.SqliteDbconfigEnableTrigger, true);
  console.log("✓ Enabled TRIGGERS");

  // Allow virtual tables (most apps need this)
  db.setDbConfig(DbConfig.SqliteDbconfigEnableView, true);
  console.log("✓ Enabled VIEW (virtual tables)");

  // Query planner stability (optional, for reproducibility)
  db.setDbConfig(DbConfig.SqliteDbconfigEnableQpsg, false);
  console.log("✓ Set Query Planner Stability = OFF (allow optimization)");
}

// ============================================================================
// INTERMEDIATE: Schema & Safety Configuration
// ============================================================================

/**
 * Configures schema validation and access control.
 *
 * BEGINNER:
 * - These flags control how SQLite handles schema and writes
 *
 * INTERMEDIATE:
 * - SqliteDbconfigWritableSchema: Allow modification of schema directly
 *   - Default: OFF
 *   - ON: Can directly UPDATE sqlite_master (very dangerous!)
 * - SqliteDbconfigTrustedSchema: Require query authorization for schema
 *   - Default: depends on SQLite version
 *   - ON: Stricter schema validation
 * - SqliteDbconfigDqsDml: Double-Quoted Strings as variable names
 *   - Default: OFF (SQL standard)
 *   - ON: "string" is a variable, not a string literal (old SQLite behavior)
 * - SqliteDbconfigDqsDdl: Same as DQS_DML for DDL statements
 *
 * ADVANCED:
 * - Keep WritableSchema OFF except for emergency database repair
 * - TrustedSchema ON for stricter enforcement
 * - DQS_* OFF for SQL standard compliance
 */
export function configure_schema_safety(db: Connection) {
  console.log("Configuring schema safety:\n");

  // Prevent direct schema modification (safe default)
  db.setDbConfig(DbConfig.SqliteDbconfigWritableSchema, false);
  console.log(
    "✓ Prevented WRITABLE_SCHEMA (can't directly modify sqlite_master)",
  );

  // Trust schema (validate strictly)
  db.setDbConfig(DbConfig.SqliteDbconfigTrustedSchema, true);
  console.log("✓ Enabled TRUSTED_SCHEMA");

  // Use standard SQL (not SQLite quirks)
  db.setDbConfig(DbConfig.SqliteDbconfigDqsDml, false);
  console.log(
    "✓ Disabled DQS_DML (double-quoted strings are strings, not variables)",
  );

  db.setDbConfig(DbConfig.SqliteDbconfigDqsDdl, false);
  console.log(
    "✓ Disabled DQS_DDL (same as DML, applied to schema definitions)",
  );
}

// ============================================================================
// ADVANCED: Performance & Observability Configuration
// ============================================================================

/**
 * Configures advanced observability and performance options.
 *
 * BEGINNER:
 * - These are for specialized use cases
 *
 * INTERMEDIATE:
 * - SqliteDbconfigReverseScanOrder: Scan tables in reverse order
 *   - Default: OFF
 *   - ON: LIMIT queries scan from end (sometimes faster)
 * - SqliteDbconfigStmtScanStatus: Enable SCAN STATUS observation
 *   - Default: OFF
 *   - ON: Can use sqlite3_stmt_status(SQLITE_STMTSTATUS_FULLSCAN_STEP, etc.)
 * - SqliteDbconfigTriggerEqp: Include triggers in EXPLAIN PLAN
 *   - Default: OFF
 *   - ON: EXPLAIN includes trigger information
 *
 * ADVANCED:
 * - Enable STMT_SCAN_STATUS to profile query performance
 * - Use TRIGGER_EQP when debugging complex trigger logic
 * - REVERSE_SCAN_ORDER rarely helpful; let query planner decide
 */
export function configure_observability(db: Connection) {
  console.log("Configuring observability:\n");

  // Enable scan status collection for performance profiling
  db.setDbConfig(DbConfig.SqliteDbconfigStmtScanStatus, true);
  console.log("✓ Enabled STMT_SCAN_STATUS (can collect performance metrics)");

  // Include trigger information in EXPLAIN output
  db.setDbConfig(DbConfig.SqliteDbconfigTriggerEqp, true);
  console.log("✓ Enabled TRIGGER_EQP (explains show trigger info)");

  // Don't force reverse scan order (let query planner decide)
  db.setDbConfig(DbConfig.SqliteDbconfigReverseScanOrder, false);
  console.log("✓ Set REVERSE_SCAN_ORDER = OFF (allow optimization)");
}

// ============================================================================
// ADVANCED: Legacy & Compatibility Configuration
// ============================================================================

/**
 * Configures legacy SQLite behavior for backward compatibility.
 *
 * BEGINNER:
 * - Usually leave these OFF (use modern SQL)
 *
 * INTERMEDIATE:
 * - SqliteDbconfigLegacyAlterTable: Allow ADD COLUMN to any position
 *   - Default: OFF (SQL standard: ADD COLUMN adds to end)
 *   - ON: Old SQLite behavior (dangerous, breaks compatibility)
 * - SqliteDbconfigLegacyFileFormat: Use old database file format
 *   - Default: OFF (use modern format)
 *   - ON: Generate files for old SQLite versions (rare)
 * - SqliteDbconfigEnableAttachCreate: Auto-create databases on ATTACH
 *   - Default: OFF
 *   - ON: ATTACH DATABASE auto-creates if doesn't exist
 * - SqliteDbconfigEnableAttachWrite: Allow writes to ATTACH databases
 *   - Default: OFF (prevents accidents)
 *   - ON: Auto-enable read+write on attached DBs
 *
 * ADVANCED:
 * - Keep legacy features OFF unless you have a specific need
 * - Modern SQL is more portable and safer
 */
export function configure_legacy_options(db: Connection) {
  console.log("Configuring legacy & compatibility options:\n");

  // Use modern ALTER TABLE behavior
  db.setDbConfig(DbConfig.SqliteDbconfigLegacyAlterTable, false);
  console.log("✓ Disabled LEGACY_ALTER_TABLE (use standard SQL)");

  // Use modern database file format
  db.setDbConfig(DbConfig.SqliteDbconfigLegacyFileFormat, false);
  console.log("✓ Disabled LEGACY_FILE_FORMAT (use modern format)");

  // Don't auto-create attached databases
  db.setDbConfig(DbConfig.SqliteDbconfigEnableAttachCreate, false);
  console.log("✓ Disabled ENABLE_ATTACH_CREATE (require explicit creation)");

  // Don't auto-enable writes on attached DBs
  db.setDbConfig(DbConfig.SqliteDbconfigEnableAttachWrite, false);
  console.log("✓ Disabled ENABLE_ATTACH_WRITE (require explicit permissions)");
}

// ============================================================================
// ADVANCED: Other Configuration Options
// ============================================================================

/**
 * Overview of remaining configuration options.
 *
 * BEGINNER:
 * - These are rarely used but available for special cases
 *
 * INTERMEDIATE/ADVANCED:
 * - SqliteDbconfigEnableFts3Tokenizer: Enable FTS3 tokenizer
 *   - FTS = Full-Text Search extension
 * - SqliteDbconfigNoCkptOnClose: Don't checkpoint on close
 *   - Default: OFF (checkpoint to clean up WAL file)
 * - SqliteDbconfigResetDatabase: Mark database as corrupt (internal recovery)
 *   - Usually only called by SQLite internals
 * - SqliteDbconfigEnableComments: Allow comments in SQL
 *   - Default: ON (supports -- comments)
 * - SqliteDbconfigNoCheckpointOnClose: Performance tuning (skip final checkpoint)
 */
export function configure_other_options(db: Connection) {
  console.log("Other configuration options:\n");

  // FTS3 tokenizer (only needed if using full-text search)
  // db.setDbConfig(DbConfig.SqliteDbconfigEnableFts3Tokenizer, true);
  console.log("• SqliteDbconfigEnableFts3Tokenizer - for full-text search");

  // WAL checkpoint control
  // db.setDbConfig(DbConfig.SqliteDbconfigNoCkptOnClose, false);
  console.log("• SqliteDbconfigNoCkptOnClose - WAL checkpoint behavior");

  // Database reset (for recovery, rarely used)
  // db.setDbConfig(DbConfig.SqliteDbconfigResetDatabase, true);
  console.log("• SqliteDbconfigResetDatabase - emergency database reset");

  // Comments in SQL (usually always enabled)
  // db.setDbConfig(DbConfig.SqliteDbconfigEnableComments, true);
  console.log("• SqliteDbconfigEnableComments - SQL comment support");
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  console.log("=== Example 9: Database Configuration ===\n");

  console.log("--- Reading Configuration ---");
  const db1 = Connection.openInMemory();
  example_read_config(db1);

  console.log("\n--- Setting Configuration ---");
  const db2 = Connection.openInMemory();
  example_set_config(db2);

  console.log("\n--- Core Behavior Configuration ---");
  const db3 = Connection.openInMemory();
  configure_core_behavior(db3);

  console.log("\n--- Schema Safety Configuration ---");
  const db4 = Connection.openInMemory();
  configure_schema_safety(db4);

  console.log("\n--- Observability Configuration ---");
  const db5 = Connection.openInMemory();
  configure_observability(db5);

  console.log("\n--- Legacy & Compatibility Configuration ---");
  const db6 = Connection.openInMemory();
  configure_legacy_options(db6);

  console.log("\n--- Other Configuration Options ---");
  configure_other_options(Connection.openInMemory());
}
