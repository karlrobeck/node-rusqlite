import { Connection } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";
import {DatabaseSync} from "node:sqlite";

let dbPath = "";
let nodeRusqlite: Connection;
let nodeSqlite: DatabaseSync;

function setupNodeRusqlite() {
  dbPath = getTempDbPath("crud-node-rusqlite");
  nodeRusqlite = Connection.open(dbPath);
  nodeRusqlite.execute(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER
    )`,
    [],
  );
}

function setupNodeSqlite() {
  dbPath = getTempDbPath("crud-node-sqlite");
  nodeSqlite = new DatabaseSync(dbPath);
  nodeSqlite.exec(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER
    )`
  );
}

Deno.bench({
  name: "node-rusqlite - INSERT",
  group: "INSERT",
  fn(b) {
    setupNodeRusqlite();
    try {
      nodeRusqlite.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)",(stmt) => {
        b.start();
        stmt.execute(["John Doe", "john.doe@example.com", 30]);
        b.end();
      });
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-sqlite - INSERT",
  group: "INSERT",
  fn(b) {
    setupNodeSqlite();
    try {
      const prepare = nodeSqlite.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)");
      b.start();
      prepare.run("John Doe", "john.doe@example.com", 30);
      b.end();
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-rusqlite - SELECT",
  group: "SELECT",
  fn(b) {
    setupNodeRusqlite();
    try {
      nodeRusqlite.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["John Doe", "john.doe@example.com", 30],
      );
      nodeRusqlite.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
        b.start();
        stmt.query([1]);
        b.end();
      });
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-sqlite - SELECT",
  group: "SELECT",
  fn(b) {
    setupNodeSqlite();
    try {
      const insert = nodeSqlite.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)");
      insert.run("John Doe", "john.doe@example.com", 30);
      const prepare = nodeSqlite.prepare("SELECT * FROM users WHERE id = ?");
      b.start();
      prepare.get(1);
      b.end();
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-rusqlite - UPDATE",
  group: "UPDATE",
  fn(b) {
    setupNodeRusqlite();
    try {
      nodeRusqlite.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["John Doe", "john.doe@example.com", 30],
      );
      nodeRusqlite.prepare("UPDATE users SET age = ? WHERE id = ?", (stmt) => {
        b.start();
        stmt.execute([31, 1]);
        b.end();
      });
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-sqlite - UPDATE",
  group: "UPDATE",
  fn(b) {
    setupNodeSqlite();
    try {
      const insert = nodeSqlite.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)");
      insert.run("John Doe", "john.doe@example.com", 30);
      const prepare = nodeSqlite.prepare("UPDATE users SET age = ? WHERE id = ?");
      b.start();
      prepare.run(31, 1);
      b.end();
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-rusqlite - DELETE",
  group: "DELETE",
  fn(b) {
    setupNodeRusqlite();
    try {
      nodeRusqlite.execute(
        "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
        ["John Doe", "john.doe@example.com", 30],
      );
      nodeRusqlite.prepare("DELETE FROM users WHERE id = ?", (stmt) => {
        b.start();
        stmt.execute([1]);
        b.end();
      });
    } finally {
      cleanupDb(dbPath);
    }
  },
});

Deno.bench({
  name: "node-sqlite - DELETE",
  group: "DELETE",
  fn(b) {
    setupNodeSqlite();
    try {
      const insert = nodeSqlite.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)");
      insert.run("John Doe", "john.doe@example.com", 30);
      const prepare = nodeSqlite.prepare("DELETE FROM users WHERE id = ?");
      b.start();
      prepare.run(1);
      b.end();
    } finally {
      cleanupDb(dbPath);
    }
  },
});
