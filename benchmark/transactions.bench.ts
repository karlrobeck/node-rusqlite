/**
 * Transactions Benchmark
 * Run with: deno bench benchmark/transactions.bench.ts
 */

import { Connection, TransactionBehavior } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";

let dbPath = "";
let conn: Connection;

function setup() {
  dbPath = getTempDbPath("transactions");
  conn = Connection.open(dbPath);
  conn.execute(
    `CREATE TABLE IF NOT EXISTS test_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value INTEGER,
      data TEXT
    )`,
    [],
  );
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: "Bulk INSERT no transaction (10K rows)",
  group: "Transactions",
  baseline: true,
  fn() {
    setup();
    try {
      for (let i = 0; i < 10000; i++) {
        conn.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
          i,
          `data${i}`,
        ]);
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Bulk INSERT DEFERRED (10K rows)",
  group: "Transactions",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 0; i < 10000; i++) {
          tx.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
            i,
            `data${i}`,
          ]);
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Bulk INSERT IMMEDIATE (10K rows)",
  group: "Transactions",
  fn() {
    setup();
    try {
      conn.transactionWithBehavior(TransactionBehavior.Immediate, (tx) => {
        for (let i = 0; i < 10000; i++) {
          tx.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
            i,
            `data${i}`,
          ]);
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Bulk INSERT EXCLUSIVE (10K rows)",
  group: "Transactions",
  fn() {
    setup();
    try {
      conn.transactionWithBehavior(TransactionBehavior.Exclusive, (tx) => {
        for (let i = 0; i < 10000; i++) {
          tx.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
            i,
            `data${i}`,
          ]);
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Savepoint with rollback (5K rows)",
  group: "Transactions",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 0; i < 2500; i++) {
          tx.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
            i,
            `data${i}`,
          ]);
        }
        tx.savepoint((sp) => {
          for (let i = 2500; i < 5000; i++) {
            sp.execute("INSERT INTO test_data (value, data) VALUES (?, ?)", [
              i,
              `data${i}`,
            ]);
          }
        });
      });
    } finally {
      teardown();
    }
  },
});
