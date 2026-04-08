/**
 * Example 2: Transactions with Commit and Rollback
 *
 * This example demonstrates transaction management:
 * - Using withTransaction() for automatic commit/rollback
 * - Manual transaction control
 * - Nested savepoints
 */

import { Database, RusqliteError } from "../bindings/index";

interface Account {
  id: number;
  name: string;
  balance: number;
}

function transactionExample() {
  const db = Database.openInMemory();

  // Create accounts table
  db.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      balance REAL NOT NULL
    )
  `);

  // Initial data
  db.exec(`INSERT INTO accounts (id, name, balance) VALUES (1, 'Alice', 1000.0)`);
  db.exec(`INSERT INTO accounts (id, name, balance) VALUES (2, 'Bob', 500.0)`);

  console.log("=== Initial State ===");
  const initialAccounts = db.queryAll<Account>(
    "SELECT * FROM accounts ORDER BY id"
  );
  console.log("Initial balances:", initialAccounts);

  // Example 1: Using withTransaction() - Auto commit on success
  console.log("\n=== Example 1: withTransaction() - Success ===");
  try {
    db.withTransaction(() => {
      // Transfer 200 from Alice to Bob
      db.exec(`UPDATE accounts SET balance = balance - 200 WHERE id = 1`);
      db.exec(`UPDATE accounts SET balance = balance + 200 WHERE id = 2`);
      console.log("✓ Transfer completed within transaction");
    });
    console.log("✓ Transaction committed automatically");
  } catch (error) {
    console.error("Transaction failed:", error);
  }

  const afterTransfer = db.queryAll<Account>(
    "SELECT * FROM accounts ORDER BY id"
  );
  console.log("After transfer:", afterTransfer);

  // Example 2: Using withTransaction() - Auto rollback on error
  console.log("\n=== Example 2: withTransaction() - Rollback ===");
  try {
    db.withTransaction(() => {
      db.exec(`UPDATE accounts SET balance = balance - 300 WHERE id = 2`);
      console.log("✓ First update done");

      // This will fail because balance would go negative (or any other error)
      throw new Error("Simulated business logic error");
    });
  } catch (error) {
    console.log("✓ Transaction rolled back:", (error as Error).message);
  }

  const afterRollback = db.queryAll<Account>(
    "SELECT * FROM accounts ORDER BY id"
  );
  console.log("After failed transaction (rolled back):", afterRollback);

  // Example 3: Manual transaction control
  console.log("\n=== Example 3: Manual Transaction Control ===");
  const txn = db.transaction();
  try {
    db.exec(`UPDATE accounts SET balance = balance - 100 WHERE id = 1`);
    db.exec(`UPDATE accounts SET balance = balance + 100 WHERE id = 2`);
    console.log("✓ Updates completed");
    txn.commit();
    console.log("✓ Transaction committed manually");
  } catch (error) {
    txn.rollback();
    console.log("✗ Transaction rolled back");
    throw error;
  }

  const finalAccounts = db.queryAll<Account>(
    "SELECT * FROM accounts ORDER BY id"
  );
  console.log("Final balances:", finalAccounts);

  // Example 4: Savepoints (nested transactions)
  console.log("\n=== Example 4: Savepoints ===");
  const outerTxn = db.transaction();
  try {
    db.exec(`UPDATE accounts SET balance = balance - 50 WHERE id = 1`);
    console.log("✓ Outer transaction: updated Alice's balance");

    // Create a savepoint
    const savepoint = outerTxn.savepoint();
    try {
      db.exec(`UPDATE accounts SET balance = balance - 500 WHERE id = 2`);
      console.log("✓ Savepoint: would reduce Bob's balance");

      // Simulate error - rollback to savepoint
      throw new Error("Invalid operation");
    } catch (error) {
      savepoint.rollback();
      console.log("✓ Savepoint rolled back, outer transaction continues");
    }

    outerTxn.commit();
    console.log("✓ Outer transaction committed");
  } catch (error) {
    outerTxn.rollback();
    throw error;
  }

  const finalState = db.queryAll<Account>(
    "SELECT * FROM accounts ORDER BY id"
  );
  console.log("Final state with savepoint rollback:", finalState);
}

try {
  transactionExample();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
  } else {
    console.error("Error:", error);
  }
}
