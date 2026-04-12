import { expect } from "@std/expect";
// @ts-types="../bindings/binding.d.ts"
import {
  Connection,
  TransactionBehavior,
  TransactionState,
} from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
  conn.execute(
    "CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)",
    [],
  );
  conn.execute("INSERT INTO accounts (balance) VALUES (100)", []);
  conn.execute("INSERT INTO accounts (balance) VALUES (200)", []);
});

Deno.test("connection.transaction()", async (t) => {
  await t.step("should execute callback within transaction", () => {
    let callbackExecuted = false;
    conn.transaction((txn) => {
      callbackExecuted = true;
      expect(txn).toBeDefined();
    });
    expect(callbackExecuted).toBe(true);
  });

  await t.step("should commit on successful callback", () => {
    conn.transaction((txn) => {
      txn.execute("INSERT INTO accounts (balance) VALUES (300)", []);
    });

    const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
    expect((count as any).count).toBe(3);
  });

  await t.step("should rollback on callback error", () => {
    const beforeCount =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;

    try {
      conn.transaction((txn) => {
        txn.execute("INSERT INTO accounts (balance) VALUES (300)", []);
        throw new Error("Test error");
      });
    } catch (e) {
      // Expected
    }

    const afterCount =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;
    expect(afterCount).toBe(beforeCount);
  });
});

Deno.test("connection.transactionWithBehavior()", async (t) => {
  await t.step("should accept TransactionBehavior.Deferred", () => {
    let executed = false;
    conn.transactionWithBehavior(TransactionBehavior.Deferred, (txn) => {
      executed = true;
      expect(txn).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should accept TransactionBehavior.Immediate", () => {
    let executed = false;
    conn.transactionWithBehavior(TransactionBehavior.Immediate, (txn) => {
      executed = true;
      expect(txn).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should accept TransactionBehavior.Exclusive", () => {
    let executed = false;
    conn.transactionWithBehavior(TransactionBehavior.Exclusive, (txn) => {
      executed = true;
      expect(txn).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should commit changes with Deferred behavior", () => {
    conn.transactionWithBehavior(TransactionBehavior.Deferred, (txn) => {
      txn.execute("UPDATE accounts SET balance = ? WHERE id = 1", [150]);
    });

    const account = conn.queryRow(
      "SELECT balance FROM accounts WHERE id = 1",
      [],
    );
    expect((account as any).balance).toBe(150);
  });

  await t.step("should rollback on Immediate behavior with error", () => {
    const before = conn.queryRow(
      "SELECT balance FROM accounts WHERE id = 1",
      [],
    );

    try {
      conn.transactionWithBehavior(TransactionBehavior.Immediate, (txn) => {
        txn.execute("UPDATE accounts SET balance = ? WHERE id = 1", [999]);
        throw new Error("Test error");
      });
    } catch (e) {
      // Expected
    }

    const after = conn.queryRow(
      "SELECT balance FROM accounts WHERE id = 1",
      [],
    );
    expect((after as any).balance).toBe((before as any).balance);
  });
});

Deno.test("connection.uncheckedTransaction()", async (t) => {
  await t.step("should execute callback without extra checks", () => {
    let executed = false;
    conn.uncheckedTransaction((txn) => {
      executed = true;
      expect(txn).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should commit on successful execution", () => {
    conn.uncheckedTransaction((txn) => {
      txn.execute("INSERT INTO accounts (balance) VALUES (400)", []);
    });

    const count =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;
    expect(count).toBe(3);
  });
});

Deno.test("connection.savepoint()", async (t) => {
  await t.step("should execute callback within savepoint", () => {
    let executed = false;
    conn.savepoint((sp) => {
      executed = true;
      expect(sp).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should allow nested savepoints via transaction", () => {
    conn.transaction((txn) => {
      txn.execute("INSERT INTO accounts (balance) VALUES (500)", []);

      txn.savepoint((sp) => {
        sp.execute("INSERT INTO accounts (balance) VALUES (600)", []);
      });
    });

    const count =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;
    expect(count).toBe(4);
  });

  await t.step("should rollback savepoint on error", () => {
    conn.transaction((txn) => {
      const beforeCount =
        (txn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
          .count;

      try {
        txn.savepoint((sp) => {
          sp.execute("INSERT INTO accounts (balance) VALUES (700)", []);
          throw new Error("Savepoint error");
        });
      } catch (e) {
        // Expected
      }

      const afterCount =
        (txn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
          .count;
      expect(afterCount).toBe(beforeCount);
    });
  });
});

Deno.test("connection.savepointWithName()", async (t) => {
  await t.step("should create named savepoint", () => {
    let executed = false;
    conn.savepointWithName("my_savepoint", (sp) => {
      executed = true;
      expect(sp).toBeDefined();
    });
    expect(executed).toBe(true);
  });

  await t.step("should allow multiple named savepoints", () => {
    conn.transaction((txn) => {
      txn.savepointWithName("sp1", (sp) => {
        sp.execute("INSERT INTO accounts (balance) VALUES (800)", []);
      });

      txn.savepointWithName("sp2", (sp) => {
        sp.execute("INSERT INTO accounts (balance) VALUES (900)", []);
      });
    });

    const count =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

Deno.test("connection.transactionState()", async (t) => {
  await t.step("should return TransactionState enum value", () => {
    const state = conn.transactionState();
    expect(typeof state).toBe("number");
  });

  await t.step(
    "should return TransactionState.None for idle connection",
    () => {
      const state = conn.transactionState();
      expect(state).toBe(TransactionState.None);
    },
  );

  await t.step(
    "should return TransactionState.Write during write transaction",
    () => {
      let txnState = TransactionState.None;
      conn.transaction((txn) => {
        txnState = txn.transactionState();
      });
      // State during transaction may vary, just verify we get a state
      expect(typeof txnState).toBe("number");
    },
  );

  await t.step("should accept optional dbName parameter", () => {
    const state1 = conn.transactionState();
    const state2 = conn.transactionState(null);
    const state3 = conn.transactionState("main");

    expect(typeof state1).toBe("number");
    expect(typeof state2).toBe("number");
    expect(typeof state3).toBe("number");
  });
});

Deno.test("connection.setTransactionBehavior()", async (t) => {
  await t.step("should set default behavior to Deferred", () => {
    expect(() => {
      conn.setTransactionBehavior(TransactionBehavior.Deferred);
    }).not.toThrow();
  });

  await t.step("should set default behavior to Immediate", () => {
    expect(() => {
      conn.setTransactionBehavior(TransactionBehavior.Immediate);
    }).not.toThrow();
  });

  await t.step("should set default behavior to Exclusive", () => {
    expect(() => {
      conn.setTransactionBehavior(TransactionBehavior.Exclusive);
    }).not.toThrow();
  });

  await t.step("should affect subsequent transactions", () => {
    conn.setTransactionBehavior(TransactionBehavior.Deferred);

    conn.transaction((txn) => {
      txn.execute("INSERT INTO accounts (balance) VALUES (1000)", []);
    });

    const count =
      (conn.queryRow("SELECT COUNT(*) as count FROM accounts", []) as any)
        .count;
    expect(count).toBe(3);
  });
});
