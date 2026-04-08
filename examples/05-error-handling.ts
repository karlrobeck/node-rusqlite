/**
 * Example 5: Error Handling with RusqliteError
 *
 * This example demonstrates:
 * - Catching and handling RusqliteError
 * - Accessing error context (operation, SQL, parameters)
 * - Different error scenarios
 * - Graceful error recovery
 */

import { Database, RusqliteError } from "../bindings/index";

interface User {
  id: number;
  username: string;
  email: string;
}

function errorHandlingExample() {
  const db = Database.openInMemory();

  // Create users table with constraints
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      age INTEGER CHECK (age >= 0 AND age <= 150)
    )
  `);

  console.log("=== Error Handling with RusqliteError ===\n");

  // Error 1: Duplicate username (UNIQUE constraint)
  console.log("--- Error 1: UNIQUE Constraint Violation ---");
  try {
    db.exec(`
      INSERT INTO users (id, username, email, age) VALUES (1, 'alice', 'alice@example.com', 25)
    `);
    console.log("✓ First user inserted");

    db.exec(`
      INSERT INTO users (id, username, email, age) VALUES (2, 'alice', 'alice2@example.com', 30)
    `);
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
      console.error(`  SQL: ${error.sql?.substring(0, 80)}...`);
      console.error(`  Original Error: ${error.originalError?.message}`);
    }
  }

  // Error 2: Check constraint violation
  console.log("\n--- Error 2: CHECK Constraint Violation ---");
  try {
    db.exec(`
      INSERT INTO users (id, username, email, age) VALUES (3, 'bob', 'bob@example.com', 200)
    `);
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
      console.error(`  Original Error: ${error.originalError?.message}`);
    }
  }

  // Successfully insert valid user
  db.exec(`
    INSERT INTO users (id, username, email, age) VALUES (2, 'bob', 'bob@example.com', 30)
  `);
  console.log("✓ Valid user inserted");

  // Error 3: Query non-existent table
  console.log("\n--- Error 3: Table Not Found ---");
  try {
    db.queryAll<User>(
      "SELECT * FROM nonexistent_table"
    );
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
      console.error(`  SQL: ${error.sql}`);
    }
  }

  // Error 4: Invalid column in SELECT
  console.log("\n--- Error 4: Invalid Column ---");
  try {
    db.queryAll<User>(
      "SELECT id, username, nonexistent_column FROM users"
    );
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
    }
  }

  // Error 5: Transaction with error and automatic rollback
  console.log("\n--- Error 5: Transaction Automatic Rollback ---");
  const countBefore = db.queryAll<User>("SELECT id, username, email FROM users").length;
  console.log(`Users before transaction: ${countBefore}`);

  try {
    db.withTransaction(() => {
      db.exec(`
        INSERT INTO users (id, username, email, age)
        VALUES (3, 'charlie', 'charlie@example.com', 28)
      `);
      console.log("✓ User inserted within transaction");

      // Intentional error to trigger rollback
      throw new Error("Simulated business logic error");
    });
  } catch (error) {
    console.log(`✓ Transaction rolled back: ${(error as Error).message}`);
  }

  const countAfter = db.queryAll<User>("SELECT id, username, email FROM users").length;
  console.log(`Users after transaction rollback: ${countAfter}`);
  console.log(`Assert: User count unchanged: ${countBefore === countAfter}`);

  // Error 6: Parameterized query with wrong parameter count
  console.log("\n--- Error 6: Parameter Mismatch ---");
  try {
    // Query expects 1 parameter, but we provide 0
    db.queryAll<User>(
      "SELECT * FROM users WHERE id = ?",
      [] // Missing parameter
    );
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
      console.error(`  Parameters provided: ${error.params?.length}`);
      console.error(`  SQL: ${error.sql}`);
    }
  }

  // Error 7: Prepare invalid SQL
  console.log("\n--- Error 7: Invalid SQL Syntax ---");
  try {
    db.prepare("SELECT * FROM users WHERE id = ");
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.error("✗ Error caught:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Operation: ${error.operation}`);
    }
  }

  // Successful recovery and continued operations
  console.log("\n--- Successful Recovery ---");
  try {
    const users = db.queryAll<User>(
      "SELECT id, username, email FROM users ORDER BY id"
    );
    console.log(`✓ Query successful after errors`);
    console.log(`✓ Found ${users.length} users:`);
    for (const user of users) {
      console.log(`  - ${user.username} (${user.email})`);
    }
  } catch (error) {
    console.error("✗ Unexpected error:", error);
  }

  // Error 8: Access error properties for debugging
  console.log("\n--- Error Properties for Debugging ---");
  try {
    db.exec("SELECT * FROM users WHERE age > ");
  } catch (error) {
    if (error instanceof RusqliteError) {
      console.log("Error properties:");
      console.log(`  - name: ${error.name}`);
      console.log(`  - operation: ${error.operation}`);
      console.log(`  - sql: ${error.sql}`);
      console.log(`  - params: ${JSON.stringify(error.params)}`);
      console.log(`  - originalError: ${error.originalError?.message}`);
      console.log(`  - stack available: ${error.stack?.substring(0, 50)}...`);
    }
  }
}

try {
  errorHandlingExample();
} catch (error) {
  console.error("Unhandled error:", error);
}
