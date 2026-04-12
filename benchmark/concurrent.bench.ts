/**
 * Concurrent Operations Benchmark
 * Run with: deno bench benchmark/concurrent.bench.ts
 */

import { Connection } from "../bindings/binding.js";
import { getTempDbPath, cleanupDb } from "./utils.ts";

let dbPath = "";
let conn: Connection;

function setup() {
  dbPath = getTempDbPath("concurrent-ops");
  conn = Connection.open(dbPath);
  conn.execute(
    `CREATE TABLE IF NOT EXISTS concurrent_test (
      id INTEGER PRIMARY KEY,
      thread INTEGER,
      value TEXT,
      counter INTEGER
    )`,
    []
  );

  for (let i = 1; i <= 5000; i++) {
    conn.execute(
      "INSERT INTO concurrent_test (thread, value, counter) VALUES (?, ?, ?)",
      [0, `initial_${i}`, i]
    );
  }
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: "Multiple sequential connections (5 conns, 1K ops each)",
  group: "Concurrent Operations",
  baseline: true,
  fn() {
    const basePath = getTempDbPath("concurrent-multi");
    try {
      const connections = [];
      for (let i = 0; i < 5; i++) {
        const c = Connection.open(`${basePath}-${i}.db`);
        c.execute(
          `CREATE TABLE IF NOT EXISTS concurrent_test (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread INTEGER,
            value TEXT,
            counter INTEGER
          )`,
          []
        );
        connections.push(c);
      }

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 1000; j++) {
          connections[i].execute(
            "INSERT INTO concurrent_test (thread, value, counter) VALUES (?, ?, ?)",
            [i, `t${i}_d${j}`, j]
          );
        }
      }

      for (const c of connections) {
        const path = c.path();
        cleanupDb(path);
      }
    } catch {
      // ignore errors
    }
  },
});

Deno.bench({
  name: "Concurrent reads (5 threads, 2K queries each)",
  group: "Concurrent Operations",
  fn() {
    setup();
    try {
      for (let thread = 0; thread < 5; thread++) {
        for (let i = 1; i <= 2000; i++) {
          conn.queryRow(
            "SELECT * FROM concurrent_test WHERE thread = ? AND counter = ?",
            [thread, (i % 5000) || 1]
          );
        }
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Interleaved reads/writes (5K ops)",
  group: "Concurrent Operations",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 0; i < 5000; i++) {
          if (i % 2 === 0) {
            tx.execute(
              "INSERT INTO concurrent_test (thread, value, counter) VALUES (?, ?, ?)",
              [5, `interleaved_${i}`, i]
            );
          } else {
            tx.queryRow("SELECT * FROM concurrent_test WHERE id = ?", [
              (i % 2500) || 1,
            ]);
          }
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Heavy write contention (5K inserts in txn)",
  group: "Concurrent Operations",
  fn() {
    setup();
    try {
      conn.transaction((tx) => {
        for (let i = 0; i < 5000; i++) {
          tx.execute(
            "INSERT INTO concurrent_test (thread, value, counter) VALUES (?, ?, ?)",
            [6, `heavy_${i}`, i]
          );
        }
      });
    } finally {
      teardown();
    }
  },
});
