/**
 * Basic CRUD Operations Benchmark
 * Run with: deno bench benchmark/basic-crud.bench.ts
 */

import { assertEquals } from "@std/assert";
import { Connection } from "../bindings/binding.js";
import { getTempDbPath, cleanupDb } from "./utils.ts";

let dbPath = "";
let conn: Connection;

function setup() {
  dbPath = getTempDbPath("crud");
  conn = Connection.open(dbPath);
  conn.execute(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER
    )`,
    []
  );
}

function teardown() {
  cleanupDb(dbPath);
}

Deno.bench({
  name: "INSERT single row (10K)",
  group: "CRUD",
  baseline: true,
  fn() {
    setup();
    try {
      for (let i = 0; i < 10000; i++) {
        conn.execute(
          "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
          [`User${i}`, `user${i}@example.com`, 25]
        );
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "SELECT by ID (10K)",
  group: "CRUD",
  fn() {
    setup();
    try {
      for (let i = 0; i < 100; i++) {
        conn.execute(
          "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
          [`User${i}`, `user${i}@example.com`, 25]
        );
      }
      for (let i = 1; i <= 10000; i++) {
        conn.queryRow("SELECT * FROM users WHERE id = ?", [(i % 100) + 1]);
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "UPDATE (5K)",
  group: "CRUD",
  fn() {
    setup();
    try {
      for (let i = 1; i <= 500; i++) {
        conn.execute(
          "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
          [`User${i}`, `user${i}@example.com`, 25]
        );
      }
      for (let i = 1; i <= 5000; i++) {
        conn.execute("UPDATE users SET age = ? WHERE id = ?", [26, (i % 500) + 1]);
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "DELETE (5K)",
  group: "CRUD",
  fn() {
    setup();
    try {
      for (let i = 1; i <= 5000; i++) {
        conn.execute(
          "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
          [`User${i}`, `user${i}@example.com`, 25]
        );
      }
      for (let i = 5000; i >= 1; i--) {
        conn.execute("DELETE FROM users WHERE id = ?", [i]);
      }
    } finally {
      teardown();
    }
  },
});

Deno.bench({
  name: "SELECT with iteration (1000 rows)",
  group: "CRUD",
  fn() {
    setup();
    try {
      for (let i = 1; i <= 1000; i++) {
        conn.execute(
          "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
          [`User${i}`, `user${i}@example.com`, 20 + (i % 50)]
        );
      }
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();
        let count = 0;
        for (const _row of iterator) {
          count++;
        }
        assertEquals(count, 1000);
      });
    } finally {
      teardown();
    }
  },
});
