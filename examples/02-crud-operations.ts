/**
 * Example 2: CRUD Operations - Create, Read, Update, Delete
 *
 * This example covers the fundamental database operations: creating tables,
 * inserting data, querying, updating, and deleting records. You'll learn:
 *
 * - Creating tables with CREATE TABLE
 * - Inserting data with parameterized queries
 * - Reading data with queryRow() and queryOne()
 * - Updating records with UPDATE
 * - Deleting records with DELETE
 * - Getting the last inserted row ID
 */

import { Connection } from "../bindings/binding";

// ============================================================================
// Setup: Table Definition and Sample Data
// ============================================================================

/**
 * Creates a sample `users` table with basic columns.
 *
 * BEGINNER:
 * - CREATE TABLE defines a table's structure
 * - Columns have types: INTEGER, TEXT, REAL, BLOB, NULL
 * - PRIMARY KEY uniquely identifies each row
 * - The ? placeholder is used for parameters (more in example 03)
 *
 * INTERMEDIATE:
 * - INTEGER PRIMARY KEY auto-increments in SQLite
 * - NOT NULL means the field is required
 * - DEFAULT sets a fallback value if not specified
 * - UNIQUE ensures no duplicate values in a column
 *
 * ADVANCED:
 * - Use FOREIGN KEY for referential integrity
 * - Create indexes for frequent lookups
 * - Normalize schema to avoid data duplication (see examples/schema-reference.sql)
 */
function setup_database(db: Connection) {
  // Drop the table if it exists (for demo purposes)
  try {
    db.execute("DROP TABLE IF EXISTS users", []);
  } catch {
    // Ignore if table doesn't exist
  }

  // Create the users table
  db.execute(
    `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  console.log("Created users table");
}

// ============================================================================
// CREATE (INSERT)
// ============================================================================

/**
 * Inserts a single user record and returns the inserted row ID.
 *
 * BEGINNER:
 * - INSERT adds a new row to the table
 * - Column order: (name, email, age)
 * - Values are provided via the second parameter array
 * - `lastInsertRowid()` returns the auto-generated ID
 *
 * INTERMEDIATE:
 * - The ? placeholder is replaced by values from the array
 * - Order matters: first ? gets first array value, etc.
 * - executE() returns the number of rows affected
 * - created_at uses DEFAULT so we don't specify it
 *
 * ADVANCED:
 * - Use transactions for bulk inserts (see example 04)
 * - Parameterized queries prevent SQL injection
 * - Some databases use RETURNING clause (SQLite doesn't, use lastInsertRowid)
 */
export function insert_user(
  db: Connection,
  name: string,
  email: string,
  age: number,
): number {
  const rowsAffected = db.execute(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    [name, email, age],
  );

  if (rowsAffected === 0) {
    throw new Error("Failed to insert user");
  }

  const id = db.lastInsertRowid();
  console.log(`Inserted user with ID: ${id}`);
  return id;
}

/**
 * Inserts a user and returns the row ID directly.
 *
 * BEGINNER:
 * - Most databases have a way to get the last inserted ID
 * - In SQLite with node-rusqlite, use lastInsertRowid()
 *
 * INTERMEDIATE:
 * - The rowid() function returns the same value
 * - Or query: SELECT last_insert_rowid();
 *
 * ADVANCED:
 * - In multi-threaded servers, lastInsertRowid() is only reliable
 *   if called immediately after insert (same connection)
 * - Use database-level sequences or UUIDs for multi-threaded apps
 */
export function insert_and_get_id(
  db: Connection,
  name: string,
  email: string,
): number {
  db.execute("INSERT INTO users (name, email) VALUES (?, ?)", [name, email]);
  return db.lastInsertRowid();
}

// ============================================================================
// READ (SELECT)
// ============================================================================

/**
 * Reads a single row by ID.
 *
 * BEGINNER:
 * - SELECT retrieves data from the table
 * - WHERE filters by conditions
 * - queryRow() returns the first matching row as an object
 * - The ? is replaced by the value in the array
 *
 * INTERMEDIATE:
 * - WHERE id = ? is the most common lookup pattern
 * - SELECT * means "all columns"; you can specify columns: SELECT name, email
 * - Returns a plain JavaScript object with column names as keys
 *
 * ADVANCED:
 * - Always use parameters (? placeholders) for security
 * - queryRow() vs queryOne() (see example 04):
 *   - queryRow() returns first match (or throws if none found)
 *   - queryOne() is similar but behavior differs slightly
 * - For multiple rows, use query() with prepare() (see example 10)
 */
export function read_user_by_id(
  db: Connection,
  id: number,
): Record<string, unknown> {
  const user = db.queryRow("SELECT * FROM users WHERE id = ?", [id]);
  console.log("User found:", user);
  return user;
}

/**
 * Reads all users (returns first row only here).
 *
 * BEGINNER:
 * - Removing the WHERE clause fetches all rows
 * - queryRow() returns just the first one
 * - For all rows, use prepare() + query() (see example 10)
 *
 * INTERMEDIATE:
 * - WHERE email = ? narrows results
 * - ORDER BY sorts results
 * - LIMIT 1 explicitly limits to one row
 *
 * ADVANCED:
 * - For large result sets, iteration is better than loading all
 * - Use LIMIT and OFFSET for pagination
 */
export function read_user_by_email(
  db: Connection,
  email: string,
): Record<string, unknown> | null {
  try {
    const user = db.queryRow("SELECT * FROM users WHERE email = ?", [email]);
    return user;
  } catch {
    // queryRow throws if no rows found
    return null;
  }
}

/**
 * Reads a single row and returns it as an object (similar to queryRow).
 *
 * BEGINNER:
 * - queryOne() is another method to get a single row
 * - Very similar to queryRow(); behavior depends on internal implementation
 *
 * INTERMEDIATE:
 * - Use queryOne() when you know exactly one row should exist
 * - Both throw errors if the row doesn't exist
 *
 * ADVANCED:
 * - In production, wrap with try-catch to handle missing rows gracefully
 */
export function read_user_one(
  db: Connection,
  id: number,
): Record<string, unknown> {
  const user = db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
  return user;
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Updates a user's email and age.
 *
 * BEGINNER:
 * - UPDATE modifies existing rows
 * - SET specifies which columns to change
 * - WHERE identifies which rows to update
 * - execute() returns the number of rows affected
 *
 * INTERMEDIATE:
 * - Always use WHERE to target specific rows
 *   (without WHERE, the entire table is updated!)
 * - You can update multiple columns: SET email = ?, age = ?
 * - SET field = field + 1 is valid for incrementing
 *
 * ADVANCED:
 * - Use transactions for multi-step updates (see example 04)
 * - Check rowsAffected to confirm the update worked
 * - Some apps use UPDATE ... RETURNING (SQLite 3.35+) for new values
 */
export function update_user(
  db: Connection,
  id: number,
  newEmail: string,
  newAge: number,
): boolean {
  const rowsAffected = db.execute(
    "UPDATE users SET email = ?, age = ? WHERE id = ?",
    [newEmail, newAge, id],
  );

  if (rowsAffected === 0) {
    console.log(`No user found with ID ${id}`);
    return false;
  }

  console.log(`Updated ${rowsAffected} user(s)`);
  return true;
}

/**
 * Increments a user's age (example of computed updates).
 *
 * BEGINNER:
 * - You can use SQL expressions on the right side of SET
 * - age + 1 computes the new value
 *
 * INTERMEDIATE:
 * - Common patterns: age + 1, count + count, date functions
 * - Cast types if needed: CAST(value AS INTEGER)
 *
 * ADVANCED:
 * - More complex: age + ? for parameterized increment amounts
 */
export function increment_user_age(
  db: Connection,
  id: number,
  increment: number = 1,
): boolean {
  const rowsAffected = db.execute(
    "UPDATE users SET age = age + ? WHERE id = ?",
    [increment, id],
  );

  return rowsAffected > 0;
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deletes a user by ID.
 *
 * BEGINNER:
 * - DELETE removes rows from the table
 * - WHERE specifies which rows to delete
 * - execute() returns the number of rows deleted
 *
 * INTERMEDIATE:
 * - Always use WHERE! DELETE without WHERE deletes all rows
 * - Check rowsAffected to confirm deletion
 * - FOREIGN KEY constraints may prevent deletion (see example 09)
 *
 * ADVANCED:
 * - Soft deletes: UPDATE users SET deleted = 1 WHERE id = ?
 * - Hard deletes are permanent; consider archiving important data
 * - Use transactions to delete related records atomically
 */
export function delete_user(db: Connection, id: number): boolean {
  const rowsAffected = db.execute("DELETE FROM users WHERE id = ?", [id]);

  if (rowsAffected === 0) {
    console.log(`No user found with ID ${id}`);
    return false;
  }

  console.log(`Deleted ${rowsAffected} user(s)`);
  return true;
}

/**
 * Deletes all users (use with caution!).
 *
 * BEGINNER:
 * - DELETE without WHERE removes all rows
 * - Useful for testing/cleanup, dangerous in production!
 *
 * INTERMEDIATE:
 * - execute() returns the total count deleted
 * - Consider TRUNCATE (SQLite doesn't have TRUNCATE, use DELETE with wal)
 *
 * ADVANCED:
 * - Implement hard deletes carefully
 * - Use soft deletes for auditable systems
 * - Transactions can rollback if multiple tables are involved
 */
export function delete_all_users(db: Connection): number {
  const rowsAffected = db.execute("DELETE FROM users", []);
  console.log(`Deleted all ${rowsAffected} users`);
  return rowsAffected;
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 2: CRUD Operations ===\n");

  // CREATE
  console.log("--- INSERT (Create) ---");
  const id1 = insert_user(db, "Alice", "alice@example.com", 30);
  const id2 = insert_user(db, "Bob", "bob@example.com", 25);
  const id3 = insert_user(db, "Charlie", "charlie@example.com", 35);

  // READ
  console.log("\n--- SELECT (Read) ---");
  read_user_by_id(db, id1);
  const bob = read_user_by_email(db, "bob@example.com");
  console.log("Bob found:", bob);

  // UPDATE
  console.log("\n--- UPDATE (Update) ---");
  update_user(db, id2, "bob.new@example.com", 26);
  increment_user_age(db, id1, 2);
  read_user_by_id(db, id1);

  // DELETE
  console.log("\n--- DELETE (Delete) ---");
  delete_user(db, id3);
  console.log("Attempting to read deleted user:");
  try {
    read_user_by_id(db, id3);
  } catch (e) {
    console.log("  (Correctly threw error: user not found)");
  }

  // Check final state
  console.log("\n--- Final State ---");
  console.log("Remaining changes:", db.changes());
  console.log("Total changes:", db.totalChanges());
}
