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
  name: "INSERT single row",
  group: "node-rusqlite",
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
  name: "INSERT single row",
  group: "node-sqlite",
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
