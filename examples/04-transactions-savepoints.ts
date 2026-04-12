/**
 * Example 4: Transactions & Savepoints - Atomic Operations
 *
 * This example demonstrates transaction control, which ensures that a group
 * of database operations either all succeed or all fail together. You'll learn:
 *
 * - Basic transactions with automatic rollback on error
 * - Transaction behaviors (Deferred, Immediate, Exclusive)
 * - Savepoints for nested transactions
 * - Manual rollback patterns
 * - Detecting transaction state
 * - Performance benefits of batching with transactions
 */

import {
  Connection,
  TransactionBehavior,
  TransactionState,
} from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Tables
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      balance REAL NOT NULL
    )
  `,
    [],
  );

  db.execute(
    `
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account INTEGER,
      to_account INTEGER,
      amount REAL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  // Insert sample data
  db.execute('INSERT INTO accounts VALUES (1, "Alice", 1000.00)', []);
  db.execute('INSERT INTO accounts VALUES (2, "Bob", 500.00)', []);
  db.execute('INSERT INTO accounts VALUES (3, "Charlie", 750.00)', []);
}

// ============================================================================
// BEGINNER: Basic Transactions
// ============================================================================

/**
 * Demonstrates a successful transaction (auto-commit on success).
 *
 * BEGINNER:
 * - `transaction()` takes a callback
 * - Inside the callback, you receive a ScopedConnection
 * - All operations are atomic: all succeed or all fail
 * - If the callback completes without error, changes are committed
 * - If an error is thrown, everything is rolled back
 *
 * INTERMEDIATE:
 * - Transactions isolate your changes from other connections
 * - Without transactions, bank transfers can lose money!
 * - The callback runs synchronously
 *
 * ADVANCED:
 * - Each transaction incurs overhead; batch operations together
 * - Transactions improve performance for bulk operations (vs many small ones)
 * - SQLite uses DEFERRED by default (see TransactionBehavior)
 */
export function transfer_money_success(
  db: Connection,
  fromId: number,
  toId: number,
  amount: number,
): boolean {
  try {
    db.transaction((conn) => {
      // Read current balances
      const fromAccount = conn.queryRow(
        "SELECT balance FROM accounts WHERE id = ?",
        [fromId],
      );
      const fromBalance = fromAccount.balance as number;

      // Check sufficient funds
      if (fromBalance < amount) {
        throw new Error("Insufficient funds");
      }

      // Debit from account
      conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [
        amount,
        fromId,
      ]);

      // Credit to account
      conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [
        amount,
        toId,
      ]);

      // Record transaction
      conn.execute(
        "INSERT INTO transactions (from_account, to_account, amount) VALUES (?, ?, ?)",
        [fromId, toId, amount],
      );

      // If we reach here without error, transaction is committed
      console.log(`Transferred $${amount} from account ${fromId} to ${toId}`);
    });

    return true;
  } catch (error) {
    console.error("Transfer failed (rolled back):", error);
    return false;
  }
}

/**
 * Demonstrates a transaction that rolls back on error.
 *
 * BEGINNER:
 * - If ANY error is thrown, the entire transaction is rolled back
 * - The database state returns to before the transaction started
 *
 * INTERMEDIATE:
 * - This is the safety feature that makes transactions valuable
 * - Prevents partial updates (e.g., money credited but not debited)
 *
 * ADVANCED:
 * - SQLite's isolation level is SERIALIZABLE (strictest)
 * - Transactions use locks; long transactions can slow down other operations
 */
export function transfer_money_with_error(
  db: Connection,
  fromId: number,
  toId: number,
  amount: number,
) {
  db.transaction((conn) => {
    const fromAccount = conn.queryRow(
      "SELECT balance FROM accounts WHERE id = ?",
      [fromId],
    );
    const fromBalance = fromAccount.balance as number;

    // Debit from account
    conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [
      amount,
      fromId,
    ]);

    // Simulate an error before crediting (e.g., network failure)
    if (Math.random() < 0.5) {
      throw new Error("Transaction processing system is unavailable");
    }

    // Credit to account (THIS WILL NEVER HAPPEN if error is thrown above)
    conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [
      amount,
      toId,
    ]);

    console.log("Transfer completed");
  });
}

// ============================================================================
// INTERMEDIATE: Transaction Behaviors
// ============================================================================

/**
 * Demonstrates different transaction behaviors/isolation levels.
 *
 * BEGINNER:
 * - TransactionBehavior determines when the transaction truly begins
 * - Three options: Deferred, Immediate, Exclusive
 *
 * INTERMEDIATE:
 * - DEFERRED (default): Transaction starts only when first SQL is executed
 *   - Allows other readers/writers until you write
 * - IMMEDIATE: Transaction locks for writing immediately
 *   - Prevents other writers immediately, readers can still access
 * - EXCLUSIVE: Complete lock immediately
 *   - Only this transaction can access the database
 *
 * ADVANCED:
 * - Choose based on your access patterns:
 *   - DEFERRED: most transactions, rarely conflicts
 *   - IMMEDIATE: when you know you'll write and want to fail fast
 *   - EXCLUSIVE: batch operations that need uninterrupted access
 * - Exclusive transactions are slower for others but faster for the batch
 */
export function batch_import_with_behavior(
  db: Connection,
  behavior: TransactionBehavior,
  records: Array<{ name: string; balance: number }>,
) {
  db.transactionWithBehavior(behavior, (conn) => {
    for (const record of records) {
      conn.execute("INSERT INTO accounts (name, balance) VALUES (?, ?)", [
        record.name,
        record.balance,
      ]);
    }
    console.log(
      `Imported ${records.length} accounts with ${behavior} behavior`,
    );
  });
}

/**
 * Sets the default transaction behavior for the connection.
 *
 * BEGINNER:
 * - By default, all transactions use DEFERRED
 * - You can change this per-connection
 *
 * INTERMEDIATE:
 * - Use if all your transactions have the same behavior
 * - Saves repetition: setTransactionBehavior() once, then transaction() calls use it
 *
 * ADVANCED:
 * - Still can override with transactionWithBehavior() for specific operations
 */
export function set_default_behavior(
  db: Connection,
  behavior: TransactionBehavior,
) {
  db.setTransactionBehavior(behavior);
  console.log(`Set default transaction behavior to ${behavior}`);

  // All subsequent transaction() calls now use IMMEDIATE
  db.transaction((conn) => {
    conn.execute("UPDATE accounts SET balance = balance + 10 WHERE id = 1", []);
    console.log("Updated with default IMMEDIATE behavior");
  });
}

// ============================================================================
// ADVANCED: Savepoints (Nested Transactions)
// ============================================================================

/**
 * Demonstrates savepoints for partial rollback within a transaction.
 *
 * BEGINNER:
 * - Savepoints are like nested transactions
 * - You can roll back to a savepoint without rolling back the outer transaction
 * - Syntax: savepoint name; ... ; RELEASE name or ROLLBACK TO name
 *
 * INTERMEDIATE:
 * - savepointWithName() creates a named savepoint
 * - If the callback throws, only the savepoint is rolled back
 * - Useful for optional sub-operations
 *
 * ADVANCED:
 * - Create savepoints at any nesting level
 * - Common pattern: transaction() { savepoint() { } } structure
 * - Savepoints have slightly different behavior than transactions
 *   (e.g., can't set savepoint behavior)
 */
export function transfer_with_savepoint(
  db: Connection,
  fromId: number,
  toId: number,
  amount: number,
  logTransaction: boolean = true,
) {
  db.transaction((conn) => {
    // Main transfer
    conn.execute("UPDATE accounts SET balance = balance - ? WHERE id = ?", [
      amount,
      fromId,
    ]);
    conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", [
      amount,
      toId,
    ]);

    console.log("Transfer completed");

    // Optional: try to log the transaction (can fail independently)
    if (logTransaction) {
      conn.savepointWithName("log_transaction", (savepoint) => {
        savepoint.execute(
          "INSERT INTO transactions (from_account, to_account, amount) VALUES (?, ?, ?)",
          [fromId, toId, amount],
        );
        console.log("Transaction logged");
      });
    }

    // If logging fails, transfer is still committed
    // If transfer fails, logging never happens
    console.log("Savepoint example completed");
  });
}

/**
 * Demonstrates unnamed savepoints.
 *
 * BEGINNER:
 * - savepoint() without a name creates a temporary savepoint
 * - Cleaner syntax when you don't need to reference the savepoint by name
 *
 * INTERMEDIATE:
 * - Internal name is auto-generated
 * - Otherwise equivalent to savepointWithName()
 *
 * ADVANCED:
 * - Use for simple partial rollback patterns
 */
export function savepoint_example(db: Connection) {
  db.transaction((conn) => {
    conn.execute(
      "UPDATE accounts SET balance = balance - 100 WHERE id = 1",
      [],
    );
    console.log("After first update");

    conn.savepoint((sp) => {
      try {
        // This might fail
        sp.execute(
          "UPDATE accounts SET balance = balance - 1000 WHERE id = 1",
          [
            // ... values
          ],
        );
        console.log("Large debit succeeded");
      } catch (e) {
        console.log("Large debit failed; will rollback to savepoint");
        // Savepoint auto-rolls back if callback throws
      }
    });

    // First update (100) is still committed
    // Second update (1000) was rolled back
    console.log("Continuing after savepoint");
  });
}

// ============================================================================
// ADVANCED: Transaction State Inspection
// ============================================================================

/**
 * Checks the current transaction state.
 *
 * BEGINNER:
 * - TransactionState tells you the current state
 * - Useful for debugging or assertions
 *
 * INTERMEDIATE:
 * - TransactionState enum:
 *   - None: No active transaction
 *   - Read: Active read transaction
 *   - Write: Active write transaction
 * - transactionState(dbName?) checks state for a specific database
 *
 * ADVANCED:
 * - Use for multi-database setups (ATTACH DATABASE)
 * - Rarely needed in single-threaded Node.js code
 */
export function check_transaction_state(db: Connection) {
  console.log(
    "Before transaction:",
    db.transactionState(),
  );

  db.transaction((conn) => {
    // Inside transaction
    console.log(
      "Inside transaction:",
      conn.transactionState(),
    );

    conn.execute("SELECT * FROM accounts", []);
    console.log(
      "After SELECT:",
      conn.transactionState(),
    );

    conn.execute("UPDATE accounts SET balance = balance + 1 WHERE id = 1", []);
    console.log(
      "After UPDATE:",
      conn.transactionState(),
    );
  });

  console.log(
    "After transaction:",
    db.transactionState(),
  );
}

// ============================================================================
// ADVANCED: Unchecked Transactions (Manual Control)
// ============================================================================

/**
 * Uses unchecked transactions for manual rollback control.
 *
 * BEGINNER:
 * - uncheckedTransaction() starts a transaction without automatic error handling
 * - You must manually handle commit/rollback logic
 *
 * INTERMEDIATE:
 * - Useful when the callback completes but you want to conditionally commit
 * - Or when you have complex error recovery logic
 *
 * ADVANCED:
 * - If the callback throws, the transaction is NOT automatically rolled back
 * - You're responsible for rollback (via another transaction or ROLLBACK command)
 * - Rarely used; transaction() with try-catch is usually better
 */
export function unchecked_transaction_example(db: Connection) {
  let updateResult: boolean = false;

  db.uncheckedTransaction((conn) => {
    // Do work...
    const balance = conn.queryRow(
      "SELECT balance FROM accounts WHERE id = 1",
      [],
    ).balance as number;

    if (balance > 500) {
      conn.execute(
        "UPDATE accounts SET balance = balance - 100 WHERE id = 1",
        [],
      );
      updateResult = true;
    } else {
      updateResult = false;
    }

    // Callback ends, but transaction is NOT automatically committed
  });

  // After callback, transaction is left open or in some state
  // This is dangerous; use transaction() instead unless you have a specific reason
  console.log("Update result:", updateResult);
}

// ============================================================================
// ADVANCED: Performance - Transactions for Bulk Operations
// ============================================================================

/**
 * Compares performance: individual operations vs transaction batch.
 *
 * BEGINNER:
 * - Each individual operation is auto-committed
 * - Batching in a transaction is much faster
 *
 * INTERMEDIATE:
 * - Why? Each commit flushes to disk (or journal)
 * - Batching: write once before/after many operations
 *
 * ADVANCED:
 * - With 1000 inserts:
 *   - Without transaction: 1000 commits (slow!)
 *   - With transaction: 1 commit (fast!)
 *   - Speedup can be 100x or more
 */
export function benchmark_bulk_operations(db: Connection) {
  const numAccounts = 1000;

  // Method 1: Individual operations (slow)
  console.time("Individual operations");
  for (let i = 0; i < numAccounts; i++) {
    db.execute("INSERT INTO accounts (name, balance) VALUES (?, ?)", [
      `Account ${i}`,
      Math.random() * 10000,
    ]);
  }
  console.timeEnd("Individual operations");

  // Clean up for next test
  db.execute("DELETE FROM accounts WHERE id > 3", []);

  // Method 2: Batched in transaction (fast)
  console.time("Batched in transaction");
  db.transaction((conn) => {
    for (let i = 0; i < numAccounts; i++) {
      conn.execute("INSERT INTO accounts (name, balance) VALUES (?, ?)", [
        `Account ${i}`,
        Math.random() * 10000,
      ]);
    }
  });
  console.timeEnd("Batched in transaction");

  console.log("Transaction batch is typically 10-100x faster!");
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 4: Transactions & Savepoints ===\n");

  console.log("--- Basic Transactions ---");
  const success = transfer_money_success(db, 1, 2, 100);
  console.log("Transfer successful:", success);

  // Check balances
  const alice = db.queryRow("SELECT * FROM accounts WHERE id = 1", []);
  const bob = db.queryRow("SELECT * FROM accounts WHERE id = 2", []);
  console.log("Alice balance:", alice.balance);
  console.log("Bob balance:", bob.balance);

  console.log("\n--- Transaction Behaviors ---");
  const records = [
    { name: "Dave", balance: 2000 },
    { name: "Eve", balance: 3000 },
  ];
  batch_import_with_behavior(db, TransactionBehavior.Deferred, records);

  console.log("\n--- Savepoints ---");
  transfer_with_savepoint(db, 1, 2, 50, true);

  console.log("\n--- Transaction State ---");
  check_transaction_state(db);

  console.log("\n--- Performance Benchmark ---");
  benchmark_bulk_operations(db);
}
