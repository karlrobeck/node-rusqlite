/**
 * Example 6: Schema Inspection and Introspection
 *
 * This example demonstrates:
 * - Checking table and column existence
 * - Retrieving column metadata
 * - Inspecting statement structure
 * - Database introspection utilities
 */

import { Database, RusqliteError } from "../bindings/index";

function schemaInspectionExample() {
  const db = Database.openInMemory();

  // Create a schema with various table structures
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      age INTEGER CHECK (age >= 18),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      published BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log("=== Schema Inspection and Introspection ===\n");

  // 1. Check table existence
  console.log("--- 1. Table Existence Checks ---");
  const tablesToCheck = ["users", "posts", "comments", "nonexistent"];
  for (const tableName of tablesToCheck) {
    const exists = db.tableExists(null, tableName);
    console.log(`  ${exists ? "✓" : "✗"} Table "${tableName}" exists: ${exists}`);
  }

  // 2. Check column existence
  console.log("\n--- 2. Column Existence Checks ---");
  const columnsToCheck = [
    { table: "users", column: "id" },
    { table: "users", column: "username" },
    { table: "users", column: "age" },
    { table: "users", column: "nonexistent" },
    { table: "posts", column: "title" },
    { table: "nonexistent", column: "id" },
  ];

  for (const { table, column } of columnsToCheck) {
    try {
      const exists = db.columnExists(null, table, column);
      console.log(
        `  ${exists ? "✓" : "✗"} Column "${column}" in "${table}": ${exists}`
      );
    } catch (error) {
      console.log(
        `  ✗ Error checking "${table}"."{column}": ${(error as Error).message}`
      );
    }
  }

  // 3. Get column metadata
  console.log("\n--- 3. Column Metadata Inspection ---");
  const tables = ["users", "posts"];
  for (const tableName of tables) {
    console.log(`\n  Table: ${tableName}`);
    try {
      const metadata = db.columnMetadata(null, tableName, "id");
      console.log(`    Column "id" metadata:`);
      console.log(`      - Type: ${metadata.type || "NOT SPECIFIED"}`);
      console.log(`      - NotNull: ${metadata.notNull}`);
      console.log(`      - PrimaryKey: ${metadata.primaryKey}`);
      console.log(`      - AutoIncrement: ${metadata.autoIncrement}`);
    } catch (error) {
      console.log(`    Error: ${(error as Error).message}`);
    }

    try {
      const metadata = db.columnMetadata(null, tableName, "created_at");
      console.log(`    Column "created_at" metadata (if exists):`);
      console.log(`      - Type: ${metadata.type || "UNKNOWN"}`);
      console.log(`      - NotNull: ${metadata.notNull}`);
    } catch (error) {
      // Column may not exist, that's ok
    }
  }

  // 4. Inspect prepared statements
  console.log("\n--- 4. Prepared Statement Introspection ---");
  const selectStmt = db.prepare(
    `SELECT id, username, email, age FROM users WHERE age > ? AND username LIKE ?`
  );

  console.log(`  SELECT Statement Metadata:`);
  console.log(`    - Column count: ${selectStmt.columnCount()}`);
  console.log(`    - Column names: ${selectStmt.columnNames().join(", ")}`);
  console.log(`    - Parameter count: ${selectStmt.parameterCount()}`);
  console.log(`    - Is readonly: ${selectStmt.readonly()}`);
  console.log(`    - Is EXPLAIN: ${selectStmt.isExplain()}`);

  // Get detailed column metadata
  console.log(`    - Column metadata:`);
  for (let i = 0; i < selectStmt.columnCount(); i++) {
    const colName = selectStmt.columnName(i);
    const colIndex = selectStmt.columnIndex(colName);
    console.log(
      `      - Column ${i}: "${colName}" (index from name: ${colIndex})`
    );
  }

  // Get parameter info
  console.log(`    - Parameters:`);
  for (let i = 0; i < selectStmt.parameterCount(); i++) {
    const paramName = selectStmt.parameterName(i);
    console.log(`      - Parameter ${i + 1}: "${paramName || "(unnamed)"}"`);
  }

  // 5. Inspect INSERT statement
  console.log("\n--- 5. INSERT Statement Inspection ---");
  const insertStmt = db.prepare(
    `INSERT INTO users (username, email, age) VALUES (?, ?, ?)`
  );

  console.log(`  INSERT Statement Metadata:`);
  console.log(`    - Column count: ${insertStmt.columnCount()}`);
  console.log(`    - Parameter count: ${insertStmt.parameterCount()}`);
  console.log(`    - Is readonly: ${insertStmt.readonly()}`);

  // 6. List all columns in a table using PRAGMA
  console.log("\n--- 6. Table Structure via PRAGMA ---");
  console.log(`  Users table structure:`);

  // Execute a PRAGMA to get table info
  interface ColumnInfo {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }
  const tableInfoStmt = db.prepare("PRAGMA table_info(users)");
  const columns = tableInfoStmt.queryAll<ColumnInfo>();

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    console.log(
      `    - ${col.name} (type: ${col.type}, notnull: ${col.notnull}, pk: ${col.pk})`
    );
  }

  // 7. Get database info
  console.log("\n--- 7. Database Information ---");
  console.log(`  - Database path: ${db.path()}`);
  console.log(`  - Is autocommit: ${db.isAutocommit()}`);
  console.log(`  - Is busy: ${db.isBusy()}`);
  console.log(`  - Is interrupted: ${db.isInterrupted()}`);
  console.log(`  - Database main name: ${db.dbName(0)}`);

  // 8. Transaction state
  console.log("\n--- 8. Transaction State ---");
  const state = db.transactionState();
  const stateNames = ["None", "Read", "Write"];
  console.log(`  - Current transaction state: ${stateNames[state]}`);

  // 9. Check result set structure without executing
  console.log("\n--- 9. Query Result Structure (without execution) ---");
  const checkStmt = db.prepare(
    "SELECT id, username, email, age, created_at FROM users LIMIT 0"
  );

  console.log(`  Result columns for "SELECT ... FROM users":`);
  const cols = checkStmt.columns();
  for (const col of cols) {
    console.log(`    - ${col.name()}: UNKNOWN`);
  }

  // 10. Database enumeration
  console.log("\n--- 10. Database Enumeration ---");
  try {
    const mainDbName = db.dbName(0);
    console.log(`  - Database 0 (main): ${mainDbName}`);
    console.log(`  - Is main database readonly: ${db.isReadonly(mainDbName)}`);
  } catch (error) {
    console.log(`  No additional databases`);
  }
}

try {
  schemaInspectionExample();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
    console.error("Operation:", error.operation);
  } else {
    console.error("Error:", error);
  }
}
