import { expect } from "@std/expect";
// @ts-types="../bindings/binding.d.ts"
import { Connection, OpenFlags } from "../bindings/binding.js";
import { mkdirSync, rmdirSync } from "node:fs";

Deno.test.beforeAll(() => {
  mkdirSync("/tmp/node-rusqlite-test/connection", { recursive: true });
});

Deno.test.afterAll(async () => {
  rmdirSync("/tmp/node-rusqlite-test/connection");
});

Deno.test("should open properly", () => {
  const conn = Connection.open("/tmp/node-rusqlite-test/path.db", {
    flags: OpenFlags.SqliteOpenCreate | OpenFlags.SqliteOpenReadwrite,
  });

  expect(() => conn.queryOne("select sqlite_version()", [])).not
    .toThrow();
});

Deno.test("should open in memory mode", () => {
  const conn = Connection.openInMemory();
  expect(() => conn.queryOne("select sqlite_version()", [])).not
    .toThrow();
});
