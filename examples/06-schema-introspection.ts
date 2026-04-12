/**
 * Example 6: Schema Introspection - Database Metadata & Structure
 *
 * This example demonstrates how to query database structure and metadata
 * without directly accessing the database files. You'll learn:
 *
 * - Checking if tables exist with tableExists()
 * - Checking if columns exist with columnExists()
 * - Getting detailed column metadata with columnMetadata()
 * - Working with multiple attached databases
 * - Querying sqlite_master and sqlite_schema
 */

import { Connection, ConnectionColumnMetadata } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Schema
// ============================================================================

function setup_database(db: Connection) {
  // Create schema
  db.execute(
    `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      age INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  db.execute(
    `
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
    [],
  );

  db.execute(
    `
    CREATE INDEX idx_posts_user_id ON posts(user_id)
  `,
    [],
  );
}

// ============================================================================
// BEGINNER: Checking for Existence
// ============================================================================

/**
 * Checks if a table exists in the database.
 *
 * BEGINNER:
 * - tableExists() returns true/false
 * - First parameter: database name (null for 'main', or 'attached_name')
 * - Useful before trying to query a table
 *
 * INTERMEDIATE:
 * - SQLite creates tables in different databases (main, temp, attached)
 * - Must specify which database to check
 * - Throws error if database doesn't exist
 *
 * ADVANCED:
 * - Use in conditional migrations or schema setup
 * - Part of runtime schema discovery
 */
export function example_table_exists(db: Connection) {
  const usersExist = db.tableExists(null, "users");
  console.log('Table "users" exists:', usersExist);

  const nonexistentExists = db.tableExists(null, "nonexistent");
  console.log('Table "nonexistent" exists:', nonexistentExists);

  // Check in temp database
  const tempExists = db.tableExists("temp", "temp_table");
  console.log('Table "temp_table" in temp DB exists:', tempExists);
}

/**
 * Checks if a column exists in a table.
 *
 * BEGINNER:
 * - columnExists() returns true/false
 * - Three parameters: database name, table name, column name
 * - Useful before trying to use or alter a column
 *
 * INTERMEDIATE:
 * - Used in migration logic: "Does column X exist?"
 * - Helps with backward compatibility
 *
 * ADVANCED:
 * - Combine with try-catch for safe schema exploration
 * - Part of versioned migration systems
 */
export function example_column_exists(db: Connection) {
  const hasId = db.columnExists(null, "users", "id");
  console.log('Column "id" in users table:', hasId);

  const hasEmail = db.columnExists(null, "users", "email");
  console.log('Column "email" in users table:', hasEmail);

  const hasPhone = db.columnExists(null, "users", "phone");
  console.log('Column "phone" in users table:', hasPhone);
}

// ============================================================================
// INTERMEDIATE: Column Metadata
// ============================================================================

/**
 * Gets detailed metadata about a column.
 *
 * BEGINNER:
 * - columnMetadata() returns a ConnectionColumnMetadata object
 * - Contains: declared type, collation, NOT NULL, PRIMARY KEY, AUTOINCREMENT
 *
 * INTERMEDIATE:
 * - Use to understand column constraints at runtime
 * - Useful for building query builders or ORMs
 *
 * ADVANCED:
 * - Metadata comes from the table definition, not stored separately
 * - Can inform validation logic (e.g., "column is NOT NULL, must validate")
 */
export function example_column_metadata(db: Connection) {
  const idMeta = db.columnMetadata(
    null,
    "users",
    "id",
  ) as ConnectionColumnMetadata;
  console.log("Metadata for users.id:");
  console.log("  Type:", idMeta.type);
  console.log("  Not null:", idMeta.notNull);
  console.log("  Primary key:", idMeta.primaryKey);
  console.log("  Autoincrement:", idMeta.autoIncrement);
  console.log("  Collation:", idMeta.collationSequence);

  const emailMeta = db.columnMetadata(
    null,
    "users",
    "email",
  ) as ConnectionColumnMetadata;
  console.log("\nMetadata for users.email:");
  console.log("  Type:", emailMeta.type);
  console.log("  Not null:", emailMeta.notNull);
  console.log("  Primary key:", emailMeta.primaryKey);
  console.log("  Autoincrement:", emailMeta.autoIncrement);

  const ageMeta = db.columnMetadata(
    null,
    "users",
    "age",
  ) as ConnectionColumnMetadata;
  console.log("\nMetadata for users.age (nullable column):");
  console.log("  Type:", ageMeta.type);
  console.log("  Not null:", ageMeta.notNull);
}

// ============================================================================
// ADVANCED: Multi-Database Metadata
// ============================================================================

/**
 * Works with multiple attached databases.
 *
 * BEGINNER:
 * - SQLite supports ATTACH DATABASE for multiple databases
 * - Check tables/columns across different databases
 *
 * INTERMEDIATE:
 * - Pass database name to any metadata function
 * - 'main' is the primary database
 * - 'temp' is always available (temporary, per-connection)
 *
 * ADVANCED:
 * - Use for federated query patterns
 * - Use dbName(index) to get attached DB names (see example 01)
 */
export function example_attached_database_metadata(db: Connection) {
  // Attach a second database
  db.execute("ATTACH DATABASE ':memory:' AS secondary", []);

  // Create a table in the secondary database
  db.execute(
    "CREATE TABLE secondary.logs (id INTEGER PRIMARY KEY, message TEXT)",
    [],
  );

  // Check tables in different databases
  const mainHasUsers = db.tableExists(null, "users");
  const secondaryHasUsers = db.tableExists("secondary", "users");
  const secondaryHasLogs = db.tableExists("secondary", "logs");

  console.log('Main DB has "users":', mainHasUsers);
  console.log('Secondary DB has "users":', secondaryHasUsers);
  console.log('Secondary DB has "logs":', secondaryHasLogs);

  // Get metadata from secondary database
  const logsMeta = db.columnMetadata(
    "secondary",
    "logs",
    "message",
  ) as ConnectionColumnMetadata;
  console.log("\nMetadata for secondary.logs.message:");
  console.log("  Type:", logsMeta.type);
  console.log("  Not null:", logsMeta.notNull);
}

// ============================================================================
// ADVANCED: Schema Discovery Patterns
// ============================================================================

/**
 * Discovers all tables in a database using sqlite_master.
 *
 * BEGINNER:
 * - sqlite_master is a special virtual table SQLite provides
 * - Contains metadata about all database objects (tables, indexes, etc.)
 * - Each row represents one object
 *
 * INTERMEDIATE:
 * - Query it like any other table
 * - Columns: type, name, tbl_name, rootpage, sql
 * - type: 'table', 'index', 'view', 'trigger'
 *
 * ADVANCED:
 * - Use for schema migration or introspection tools
 * - Build ORMs on top of this
 */
export function example_list_all_tables(db: Connection) {
  db.prepare(
    `
    SELECT name, sql FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `,
    (stmt) => {
      const tables = stmt.query([]);
      console.log("All tables in database:");
      const rows = tables.toJSON() as Array<Record<string, unknown>>;
      rows.forEach((row) => {
        console.log(`\n  ${row.name}`);
        console.log(`    SQL: ${row.sql}`);
      });
    },
  );
}

/**
 * Discovers all columns in a table using sqlite_schema.
 *
 * BEGINNER:
 * - sqlite_schema is another special table (alias for sqlite_master)
 * - Can also use PRAGMA table_info(table_name) for columns
 *
 * INTERMEDIATE:
 * - PRAGMA table_info returns cid, name, type, notnull, dflt_value, pk
 * - More structured than querying sqlite_master
 *
 * ADVANCED:
 * - Use for runtime schema discovery
 * - Build database introspection tools
 */
export function example_list_table_columns(db: Connection, tableName: string) {
  db.prepare(`PRAGMA table_info(${tableName})`, (stmt) => {
    const columns = stmt.query([]);
    console.log(`\nColumns in ${tableName}:`);
    const rows = columns.toJSON() as Array<Record<string, unknown>>;
    rows.forEach((col) => {
      const nullable = col.notnull ? "NOT NULL" : "nullable";
      const pk = col.pk ? ` -> PRIMARY KEY (pos ${col.pk})` : "";
      console.log(
        `  ${col.name}: ${col.type} (${nullable})${pk}`,
      );
    });
  });
}

/**
 * Discovers all indexes in a table.
 *
 * BEGINNER:
 * - Indexes speed up queries but use extra disk space
 * - PRAGMA index_list returns information about indexes
 *
 * INTERMEDIATE:
 * - Each row represents one index on the table
 * - Shows the index name, sequence, columns, uniqueness
 *
 * ADVANCED:
 * - Use for performance analysis
 * - Decide which columns to index based on query patterns
 */
export function example_list_table_indexes(db: Connection, tableName: string) {
  db.prepare(`PRAGMA index_list(${tableName})`, (stmt) => {
    const indexes = stmt.query([]);
    console.log(`\nIndexes on ${tableName}:`);
    const rows = indexes.toJSON() as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      console.log("  (No indexes)");
      return;
    }
    rows.forEach((idx) => {
      const unique = idx.unique ? "UNIQUE " : "";
      const partial = idx.partial ? " PARTIAL" : "";
      console.log(`  ${unique}${idx.name}${partial}`);
    });
  });
}

/**
 * Discovers foreign key constraints in a table.
 *
 * BEGINNER:
 * - Foreign keys enforce referential integrity
 * - PRAGMA foreign_key_list shows relationships
 *
 * INTERMEDIATE:
 * - Each row represents one foreign key relationship
 * - Shows local column, referenced table, referenced column
 *
 * ADVANCED:
 * - Use for understanding data relationships
 * - Generate relationship diagrams from this info
 */
export function example_list_foreign_keys(db: Connection, tableName: string) {
  db.prepare(`PRAGMA foreign_key_list(${tableName})`, (stmt) => {
    const fks = stmt.query([]);
    console.log(`\nForeign keys in ${tableName}:`);
    const rows = fks.toJSON() as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      console.log("  (No foreign keys)");
      return;
    }
    rows.forEach((fk) => {
      console.log(
        `  ${fk.from} -> ${fk.table}.${fk.to}`,
      );
    });
  });
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 6: Schema Introspection ===\n");

  console.log("--- Checking Existence ---");
  example_table_exists(db);

  console.log("\n--- Checking Columns ---");
  example_column_exists(db);

  console.log("\n--- Column Metadata ---");
  example_column_metadata(db);

  console.log("\n--- Multi-Database Metadata ---");
  example_attached_database_metadata(db);

  console.log("\n--- Schema Discovery ---");
  example_list_all_tables(db);
  example_list_table_columns(db, "users");
  example_list_table_columns(db, "posts");
  example_list_table_indexes(db, "posts");
  example_list_foreign_keys(db, "posts");
}
