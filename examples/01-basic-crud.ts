/**
 * Example 1: Basic CRUD Operations
 *
 * This example demonstrates the fundamental CRUD operations:
 * - Create (INSERT)
 * - Read (SELECT/queryOne/queryAll)
 * - Update (UPDATE)
 * - Delete (DELETE)
 */

import { Rusqlite, RusqliteConnection, RusqliteError } from "../bindings/index.ts";

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

function basicCRUD() {
  // Create an in-memory database
  const conn = RusqliteConnection.openInMemory();
  const db = new Rusqlite(conn)

  // Create a users table
  db.executeBatch(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      age INTEGER
    )
  `);

  console.log("✓ Table created");

  // CREATE - Insert users
  db.executeBatch(`
    INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@example.com', 30)
  `);

  db.executeBatch(`
    INSERT INTO users (id, name, email, age) VALUES (2, 'Bob', 'bob@example.com', 25)
  `);

  console.log("✓ Users inserted");

  // READ - Query one user
  const user1 = db.queryOne<User>(
    "SELECT id, name, email, age FROM users WHERE id = ?",
    [1]
  );
  console.log("✓ Query one:", user1);

  // READ - Query all users
  const allUsers = db.queryAll<User>(
    "SELECT id, name, email, age FROM users ORDER BY id"
  );
  
  console.log("✓ Query all:", allUsers);

  // UPDATE - Modify a user
  const updated = db.executeBatch(`
    UPDATE users SET age = 31 WHERE id = 1
  `);
  console.log(`✓ Updated ${updated} user(s)`);

  // Verify the update
  const updatedUser = db.queryOne<User>(
    "SELECT * FROM users WHERE id = 1"
  );
  console.log("✓ After update:", updatedUser);

  // DELETE - Remove a user
  const deleted = db.executeBatch(`
    DELETE FROM users WHERE id = 2
  `);
  console.log(`✓ Deleted ${deleted} user(s)`);

  // Verify the deletion
  const remainingUsers = db.queryAll<User>(
    "SELECT * FROM users ORDER BY id"
  );
  console.log("✓ Remaining users:", remainingUsers);
}

try {
  basicCRUD();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
    console.error("Operation:", error.operation);
    console.error("SQL:", error.sql);
  } else {
    throw error;
  }
}
