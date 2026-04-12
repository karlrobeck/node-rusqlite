/**
 * Example 13: Error Handling & Recovery Patterns
 *
 * This example demonstrates robust error handling for SQLite operations:
 *
 * - Catching and handling database errors
 * - Constraint violation patterns
 * - Transaction rollback on error
 * - Retrying failed operations
 * - Graceful degradation and fallback patterns
 * - Debugging with error inspection
 */

import { Connection } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Schema
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      age INTEGER CHECK(age >= 18 AND age <= 150)
    )
  `,
    [],
  );

  db.execute(
    `
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
    [],
  );

  // Enable foreign keys
  db.pragmaUpdate(null, "foreign_keys", 1);

  // Insert sample data
  db.execute(
    "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
    ["alice", "alice@example.com", 30],
  );
}

// ============================================================================
// BEGINNER: Basic Error Handling
// ============================================================================

/**
 * Catches database errors with try-catch.
 *
 * BEGINNER:
 * - Most database operations can throw errors
 * - Use try-catch to handle gracefully
 * - Error messages come from SQLite
 *
 * INTERMEDIATE:
 * - Error types: constraint violations, syntax, type mismatches
 * - Different errors require different recovery strategies
 *
 * ADVANCED:
 * - Implement specific error handlers
 * - Log errors for debugging
 */
export function example_basic_error_handling(db: Connection) {
  console.log("Basic error handling:\n");

  // Attempt 1: Successful query
  try {
    console.log("Attempting to insert valid user...");
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["bob", "bob@example.com", 25],
    );
    console.log("✓ User inserted successfully");
  } catch (error) {
    console.error("✗ Error:", error);
  }

  // Attempt 2: Duplicate username (should fail)
  try {
    console.log("\nAttempting to insert duplicate username...");
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["alice", "newemail@example.com", 28],
    );
    console.log("✓ Inserted (unexpected)");
  } catch (error) {
    console.error("✗ Caught expected error:", error);
  }

  // Attempt 3: Invalid age (CHECK constraint)
  try {
    console.log("\nAttempting to insert user with invalid age...");
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["charlie", "charlie@example.com", 15],
    );
    console.log("✓ Inserted (unexpected)");
  } catch (error) {
    console.error("✗ Caught expected error:", error);
  }
}

// ============================================================================
// INTERMEDIATE: Constraint Violations
// ============================================================================

/**
 * Detects specific constraint violations by error message.
 *
 * BEGINNER:
 * - Different constraint types throw similar errors
 * - Check error message to determine constraint type
 *
 * INTERMEDIATE:
 * - UNIQUE constraint violation includes column name
 * - NOT NULL and CHECK constraints appear in error text
 * - FOREIGN KEY constraint shows referenced table
 *
 * ADVANCED:
 * - Implement constraint-specific recovery
 * - Provide user-friendly error messages
 */
export function example_constraint_violations(db: Connection) {
  console.log("Handling constraint violations:\n");

  // Helper to determine violation type
  function getViolationType(error: unknown): string {
    const msg = String(error);
    if (msg.includes("UNIQUE constraint failed")) return "UNIQUE";
    if (msg.includes("NOT NULL constraint failed")) return "NOT NULL";
    if (msg.includes("CHECK constraint failed")) return "CHECK";
    if (msg.includes("FOREIGN KEY constraint failed")) return "FOREIGN KEY";
    return "UNKNOWN";
  }

  // Test 1: UNIQUE constraint
  try {
    console.log("1. UNIQUE constraint test:");
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["alice", "alice@example.com", 30],
    );
  } catch (error) {
    const type = getViolationType(error);
    console.log(`   ✗ ${type} constraint violation detected`);
    console.log(`   Error: ${error}`);
  }

  // Test 2: CHECK constraint
  try {
    console.log("\n2. CHECK constraint test:");
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["dave", "dave@example.com", 200],
    );
  } catch (error) {
    const type = getViolationType(error);
    console.log(`   ✗ ${type} constraint violation detected`);
    console.log(`   Error: ${error}`);
  }

  // Test 3: Insert valid user first, then try invalid FK
  db.execute(
    "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
    ["eve", "eve@example.com", 28],
  );

  try {
    console.log("\n3. FOREIGN KEY constraint test:");
    db.execute(
      "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
      [9999, "Test", "Invalid user_id"],
    );
  } catch (error) {
    const type = getViolationType(error);
    console.log(`   ✗ ${type} constraint violation detected`);
    console.log(`   Error: ${error}`);
  }
}

// ============================================================================
// INTERMEDIATE: Transaction Rollback on Error
// ============================================================================

/**
 * Demonstrates automatic rollback when transaction fails.
 *
 * BEGINNER:
 * - If any operation in transaction fails, entire transaction rolls back
 * - All-or-nothing semantics
 *
 * INTERMEDIATE:
 * - Use for related multi-step operations
 * - Prevents partial updates
 *
 * ADVANCED:
 * - Implement custom recovery logic
 * - Retry entire transaction
 */
export function example_transaction_rollback(db: Connection) {
  console.log("Transaction rollback on error:\n");

  // Check initial state
  const initialUsers = db.queryRow(
    "SELECT COUNT(*) as cnt FROM users",
    [],
  ) as Record<string, unknown>;
  console.log(`Initial user count: ${initialUsers.cnt}`);

  // Attempt a transaction that will fail
  try {
    console.log("\nStarting transaction...");
    db.transaction((conn) => {
      // Insert valid user
      conn.execute(
        "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
        ["frank", "frank@example.com", 35],
      );
      console.log("  Inserted frank");

      // This should fail (duplicate username)
      conn.execute(
        "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
        ["frank", "duplicate@example.com", 40],
      );
      console.log("  Inserted frank #2 (should not happen)");
    });
  } catch (error) {
    console.log("✗ Transaction failed (expected)");
    console.log(`   Error: ${error}`);
  }

  // Check final state: frank was NOT inserted (rolled back)
  const finalUsers = db.queryRow(
    "SELECT COUNT(*) as cnt FROM users",
    [],
  ) as Record<string, unknown>;
  console.log(`\nFinal user count: ${finalUsers.cnt}`);
  console.log(
    `Transaction rolled back: ${
      finalUsers.cnt === initialUsers.cnt ? "✓ yes" : "✗ no"
    }`,
  );
}

// ============================================================================
// ADVANCED: Retry Patterns
// ============================================================================

/**
 * Retries failed operations with exponential backoff.
 *
 * BEGINNER:
 * - Some errors are temporary (database lock, busy)
 * - Retry instead of failing immediately
 *
 * INTERMEDIATE:
 * - Exponential backoff: wait 10ms, 100ms, 1000ms, etc.
 * - Max retries: usually 3-5
 *
 * ADVANCED:
 * - Distinguish retryable from permanent errors
 * - Circuit breaker patterns
 * - Jitter to prevent thundering herd
 */
export function example_retry_with_backoff(db: Connection) {
  async function retryOperation<T>(
    operation: () => T,
    maxRetries: number = 3,
    baseDelayMs: number = 10,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`);
        return operation();
      } catch (error) {
        lastError = error;
        const msg = String(error);

        // Only retry on specific errors (database lock, busy, etc.)
        if (
          !msg.includes("database is locked") &&
          !msg.includes("SQLITE_BUSY") &&
          attempt === maxRetries
        ) {
          throw error; // Don't retry other errors on final attempt
        }

        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          console.log(`  Failed: ${msg}`);
          console.log(`  Waiting ${delayMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  console.log("Retry with exponential backoff (simulated):\n");

  // Simulate operation that might fail
  let attempts = 0;
  const operation = () => {
    attempts++;
    console.log(`    [Operation executing, attempt ${attempts}]`);
    // In real code, this would be: db.execute(...)
    return "Success!";
  };

  retryOperation(operation, 3, 10).then((result) => {
    console.log(`✓ Operation succeeded: ${result}`);
  });
}

// ============================================================================
// ADVANCED: Graceful Degradation & Fallback
// ============================================================================

/**
 * Implements fallback behavior when database is unavailable.
 *
 * BEGINNER:
 * - Fall back to in-memory database or default values
 * - Partial functionality instead of complete failure
 *
 * INTERMEDIATE:
 * - Distinguish between file not found vs corrupted
 * - Different fallback for each error type
 *
 * ADVANCED:
 * - Cache last good state
 * - Async retry to restore service
 * - Feature flag to control fallback
 */
export function example_graceful_degradation() {
  function openDatabase(path: string): Connection {
    try {
      console.log(`Opening database at ${path}...`);
      const db = Connection.open(path);
      console.log("✓ Database opened successfully");
      return db;
    } catch (error) {
      console.log(`✗ Failed to open ${path}`);
      console.log(`  Error: ${error}`);
      console.log("  Falling back to in-memory database");

      // Fallback to in-memory
      const fallbackDb = Connection.openInMemory();
      console.log("✓ In-memory fallback database created");

      // Could restore from backup here
      // await restoreFromBackup(fallbackDb);

      return fallbackDb;
    }
  }

  console.log("Graceful degradation example:\n");
  const db = openDatabase("/nonexistent/path/db.sqlite");
  console.log(
    `Connected database path: ${db.path() || "(in-memory)"}`,
  );
}

// ============================================================================
// ADVANCED: Error Inspection & Debugging
// ============================================================================

/**
 * Extracts useful information from database errors.
 *
 * BEGINNER:
 * - Errors contain SQL state codes but usually just message
 *
 * INTERMEDIATE:
 * - Extract specific parts of error message
 * - Log full error for debugging
 *
 * ADVANCED:
 * - Build error telemetry
 * - Categorize errors for metrics
 */
export function example_error_inspection(db: Connection) {
  console.log("Error inspection and debugging:\n");

  function analyzeError(error: unknown): Record<string, unknown> {
    const msg = String(error);

    return {
      fullMessage: msg,
      isConstraintError: msg.includes("constraint failed"),
      isLockError: msg.includes("locked"),
      isSyntaxError: msg.includes("syntax error"),
      isBusyError: msg.includes("SQLITE_BUSY"),
      constraintType: msg.includes("UNIQUE")
        ? "UNIQUE"
        : msg.includes("NOT NULL")
        ? "NOT NULL"
        : msg.includes("CHECK")
        ? "CHECK"
        : msg.includes("FOREIGN KEY")
        ? "FOREIGN KEY"
        : "UNKNOWN",
    };
  }

  try {
    db.execute(
      "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
      ["alice", "newemail@example.com", 25],
    );
  } catch (error) {
    const analysis = analyzeError(error);
    console.log("Error Analysis:");
    console.log(`  Message: ${analysis.fullMessage}`);
    console.log(`  Is constraint error: ${analysis.isConstraintError}`);
    console.log(`  Constraint type: ${analysis.constraintType}`);
    console.log(`  Is lock error: ${analysis.isLockError}`);
    console.log(`  Is syntax error: ${analysis.isSyntaxError}`);
  }
}

/**
 * Validates data before insert to catch errors early.
 *
 * BEGINNER:
 * - Check constraints in JavaScript before sending to SQLite
 * - Provide better error messages
 *
 * INTERMEDIATE:
 * - Validation logic mirrors database schema
 * - Prevents roundtrip errors
 *
 * ADVANCED:
 * - Single source of truth for validation (shared validators)
 * - Type safety with TypeScript
 */
export function example_pre_validation(db: Connection) {
  interface UserInput {
    username: string;
    email?: string;
    age: number;
  }

  function validateUser(user: UserInput): string[] {
    const errors: string[] = [];

    if (!user.username || user.username.length === 0) {
      errors.push("Username is required");
    }

    if (user.age < 18 || user.age > 150) {
      errors.push("Age must be between 18 and 150");
    }

    if (user.email && !user.email.includes("@")) {
      errors.push("Email must contain @");
    }

    return errors;
  }

  console.log("Pre-validation example:\n");

  const testCases: UserInput[] = [
    { username: "valid_user", email: "valid@example.com", age: 30 },
    { username: "", email: "noname@example.com", age: 25 },
    { username: "too_young", email: "young@example.com", age: 10 },
  ];

  testCases.forEach((user) => {
    console.log(`Validating: ${JSON.stringify(user)}`);
    const errors = validateUser(user);
    if (errors.length === 0) {
      console.log("  ✓ Valid\n");
      // Safe to insert
      try {
        db.execute(
          "INSERT INTO users (username, email, age) VALUES (?, ?, ?)",
          [user.username, user.email || null, user.age],
        );
      } catch (e) {
        console.log(`  Insert error: ${e}\n`);
      }
    } else {
      console.log(`  ✗ Validation errors:`);
      errors.forEach((err) => console.log(`    - ${err}`));
      console.log("");
    }
  });
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 13: Error Handling & Recovery ===\n");

  console.log("--- Basic Error Handling ---");
  example_basic_error_handling(db);

  console.log("\n--- Constraint Violations ---");
  example_constraint_violations(db);

  console.log("\n--- Transaction Rollback ---");
  example_transaction_rollback(db);

  console.log("\n--- Retry Pattern ---");
  example_retry_with_backoff(db);

  console.log("\n--- Graceful Degradation ---");
  example_graceful_degradation();

  console.log("\n--- Error Inspection ---");
  example_error_inspection(db);

  console.log("\n--- Pre-Validation ---");
  example_pre_validation(db);
}
