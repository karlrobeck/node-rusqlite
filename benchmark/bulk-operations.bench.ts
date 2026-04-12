/**
 * Bulk Operations Benchmark
 * Run with: deno bench benchmark/bulk-operations.bench.ts
 */

import { assertEquals } from "@std/assert";
import { Connection } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";

let dbPath = "";
let conn: Connection;
const BULK_SIZE = 50000;

function setup() {
  dbPath = getTempDbPath("bulk-ops");
  conn = Connection.open(dbPath);
  conn.execute(
    `CREATE TABLE IF NOT EXISTS large_dataset (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      age INTEGER
    )`,
    [],
  );
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: `Bulk INSERT with transaction (${BULK_SIZE} rows)`,
  group: "Bulk Operations",
  baseline: true,
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 1; i <= BULK_SIZE; i++) {
          tx.execute(
            "INSERT INTO large_dataset (id, name, email, age) VALUES (?, ?, ?, ?)",
            [i, `User${i}`, `user${i}@example.com`, 20 + (i % 50)],
          );
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: `Bulk SELECT and iterate (${BULK_SIZE} rows)`,
  group: "Bulk Operations",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 1; i <= BULK_SIZE; i++) {
          tx.execute(
            "INSERT INTO large_dataset (id, name, email, age) VALUES (?, ?, ?, ?)",
            [i, `User${i}`, `user${i}@example.com`, 20 + (i % 50)],
          );
        }
      });

      let rowCount = 0;
      conn.prepare("SELECT * FROM large_dataset", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();
        for (const _row of iterator) {
          rowCount++;
        }
      });

      assertEquals(rowCount, BULK_SIZE);
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: `Bulk UPDATE (${BULK_SIZE} rows)`,
  group: "Bulk Operations",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 1; i <= BULK_SIZE; i++) {
          tx.execute(
            "INSERT INTO large_dataset (id, name, email, age) VALUES (?, ?, ?, ?)",
            [i, `User${i}`, `user${i}@example.com`, 20 + (i % 50)],
          );
        }
      });

      conn.transaction((tx) => {
        for (let i = 1; i <= BULK_SIZE; i++) {
          tx.execute("UPDATE large_dataset SET age = ? WHERE id = ?", [
            30 + (i % 30),
            i,
          ]);
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Aggregation queries (1K iterations)",
  group: "Bulk Operations",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 1; i <= 10000; i++) {
          tx.execute(
            "INSERT INTO large_dataset (id, name, email, age) VALUES (?, ?, ?, ?)",
            [i, `User${i}`, `user${i}@example.com`, 20 + (i % 50)],
          );
        }
      });

      for (let i = 0; i < 1000; i++) {
        const result = conn.queryRow(
          "SELECT COUNT(*) as count, SUM(age) as total_age, AVG(age) as avg_age FROM large_dataset WHERE age > ?",
          [25],
        );
        assertEquals(result !== null && result !== undefined, true);
      }
    } finally {
      teardown();
    }
  },
});
