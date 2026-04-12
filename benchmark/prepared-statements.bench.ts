/**
 * Prepared Statements Benchmark
 * Run with: deno bench benchmark/prepared-statements.bench.ts
 */

import { Connection } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";

let dbPath = "";
let conn: Connection;

function setup() {
  dbPath = getTempDbPath("preparedstmt");
  conn = Connection.open(dbPath);
  conn.execute(
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL,
      stock INTEGER
    )`,
    [],
  );
  for (let i = 1; i <= 1000; i++) {
    conn.execute(
      "INSERT INTO products (name, price, stock) VALUES (?, ?, ?)",
      [`Product${i}`, Math.random() * 100, Math.floor(Math.random() * 1000)],
    );
  }
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: "Inline SQL (10K queries)",
  group: "Prepared Statements",
  baseline: true,
  fn() {
    setup();
    try {
      for (let i = 1; i <= 10000; i++) {
        conn.queryRow("SELECT * FROM products WHERE id = ?", [(i % 1000) || 1]);
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Prepared statement reuse (10K queries)",
  group: "Prepared Statements",
  fn() {
    setup();
    try {
      conn.prepare("SELECT * FROM products WHERE id = ?", (stmt) => {
        for (let i = 1; i <= 10000; i++) {
          stmt.query([(i % 1000) || 1]);
        }
      });
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "Multiple parameters (5K queries)",
  group: "Prepared Statements",
  fn() {
    setup();
    try {
      for (let i = 1; i <= 5000; i++) {
        conn.queryRow(
          "SELECT * FROM products WHERE id = ? AND price > ? AND stock < ?",
          [(i % 500) || 1, 25.0, 750],
        );
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "LIKE queries (5K queries)",
  group: "Prepared Statements",
  fn() {
    setup();
    try {
      conn.prepare("SELECT * FROM products WHERE name LIKE ?", (stmt) => {
        for (let i = 1; i <= 5000; i++) {
          stmt.query([`Product${i % 100}%`]);
        }
      });
    } finally {
      teardown();
    }
  },
});
