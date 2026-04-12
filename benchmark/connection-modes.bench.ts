/**
 * Connection Modes Benchmark
 * Run with: deno bench benchmark/connection-modes.bench.ts
 */

import { Connection } from "../bindings/binding.js";
import { cleanupDb, getTempDbPath } from "./utils.ts";

let dbPathFile = "";
let connFile: Connection;
let connMem: Connection;

function setupFile() {
  dbPathFile = getTempDbPath("connmodes-file");
  connFile = Connection.open(dbPathFile);
  connFile.execute(
    `CREATE TABLE IF NOT EXISTS benchmark_data (
      id INTEGER PRIMARY KEY,
      value TEXT,
      number INTEGER
    )`,
    [],
  );
}

function setupMem() {
  connMem = Connection.openInMemory();
  connMem.execute(
    `CREATE TABLE IF NOT EXISTS benchmark_data (
      id INTEGER PRIMARY KEY,
      value TEXT,
      number INTEGER
    )`,
    [],
  );
}

function teardownFile() {
  cleanupDb(dbPathFile);
}

Deno.bench({
  name: "INSERT file-based (10K rows)",
  group: "Connection Modes",
  baseline: true,
  fn() {
    setupFile();
    try {
      for (let i = 0; i < 10000; i++) {
        connFile.execute(
          "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
          [`data${i}`, i],
        );
      }
    } finally {
      teardownFile();
    }
  },
});

Deno.bench({
  name: "INSERT in-memory (10K rows)",
  group: "Connection Modes",
  fn() {
    setupMem();
    try {
      for (let i = 0; i < 10000; i++) {
        connMem.execute(
          "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
          [`data${i}`, i],
        );
      }
    } finally {
      // in-memory doesn't need cleanup
    }
  },
});

Deno.bench({
  name: "SELECT file-based (10K queries)",
  group: "Connection Modes",
  fn() {
    setupFile();
    try {
      for (let i = 0; i < 1000; i++) {
        connFile.execute(
          "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
          [`data${i}`, i],
        );
      }
      for (let i = 0; i < 10000; i++) {
        connFile.queryRow("SELECT * FROM benchmark_data WHERE id = ?", [
          (i % 1000) || 1,
        ]);
      }
    } finally {
      teardownFile();
    }
  },
});

Deno.bench({
  name: "SELECT in-memory (10K queries)",
  group: "Connection Modes",
  fn() {
    setupMem();
    try {
      for (let i = 0; i < 1000; i++) {
        connMem.execute(
          "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
          [`data${i}`, i],
        );
      }
      for (let i = 0; i < 10000; i++) {
        connMem.queryRow("SELECT * FROM benchmark_data WHERE id = ?", [
          (i % 1000) || 1,
        ]);
      }
    } finally {
      // in-memory doesn't need cleanup
    }
  },
});

Deno.bench({
  name: "UPDATE file-based (5K updates)",
  group: "Connection Modes",
  fn() {
    setupFile();
    try {
      connFile.transaction((tx) => {
        for (let i = 1; i <= 5000; i++) {
          tx.execute(
            "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
            [`data${i}`, i],
          );
        }
      });

      connFile.transaction((tx) => {
        for (let i = 1; i <= 5000; i++) {
          tx.execute("UPDATE benchmark_data SET number = ? WHERE rowid = ?", [
            i * 2,
            i,
          ]);
        }
      });
    } finally {
      teardownFile();
    }
  },
});

Deno.bench({
  name: "UPDATE in-memory (5K updates)",
  group: "Connection Modes",
  fn() {
    setupMem();
    try {
      connMem.transaction((tx) => {
        for (let i = 1; i <= 5000; i++) {
          tx.execute(
            "INSERT INTO benchmark_data (value, number) VALUES (?, ?)",
            [`data${i}`, i],
          );
        }
      });

      connMem.transaction((tx) => {
        for (let i = 1; i <= 5000; i++) {
          tx.execute("UPDATE benchmark_data SET number = ? WHERE rowid = ?", [
            i * 2,
            i,
          ]);
        }
      });
    } finally {
      // in-memory doesn't need cleanup
    }
  },
});
