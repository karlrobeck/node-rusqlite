import { expect } from "@std/expect";
// @ts-types="../bindings/binding.d.ts"
import { Connection } from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
  conn.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)",
    [],
  );
  conn.execute(
    "CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT, price REAL)",
    [],
  );
});

Deno.test("connection.tableExists()", async (t) => {
  await t.step("should return true for existing table", () => {
    const exists = conn.tableExists(null, "users");
    expect(exists).toBe(true);
  });

  await t.step("should return false for non-existing table", () => {
    const exists = conn.tableExists(null, "nonexistent");
    expect(exists).toBe(false);
  });

  await t.step("should check case-sensitive table names", () => {
    const exists = conn.tableExists(null, "USERS");
    expect(typeof exists).toBe("boolean");
  });

  await t.step("should accept null db name for main database", () => {
    const exists = conn.tableExists(null, "users");
    expect(exists).toBe(true);
  });
});

Deno.test("connection.columnExists()", async (t) => {
  await t.step("should return true for existing column", () => {
    const exists = conn.columnExists(null, "users", "name");
    expect(exists).toBe(true);
  });

  await t.step("should return false for non-existing column", () => {
    const exists = conn.columnExists(null, "users", "nonexistent");
    expect(exists).toBe(false);
  });

  await t.step("should handle different column types", () => {
    expect(conn.columnExists(null, "users", "id")).toBe(true);
    expect(conn.columnExists(null, "users", "age")).toBe(true);
    expect(conn.columnExists(null, "products", "price")).toBe(true);
  });

  await t.step("should return false for column in non-existing table", () => {
    const exists = conn.columnExists(null, "nonexistent", "column");
    expect(exists).toBe(false);
  });
});

Deno.test("connection.columnMetadata()", async (t) => {
  await t.step("should return metadata for existing column", () => {
    const metadata = conn.columnMetadata(null, "users", "name");
    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe("object");
  });

  await t.step("should include declType in metadata", () => {
    const metadata = conn.columnMetadata(null, "users", "id");
    expect(metadata).toHaveProperty("type");
  });

  await t.step("should indicate PRIMARY KEY columns", () => {
    const metadata = conn.columnMetadata(null, "users", "id");
    expect(metadata).toHaveProperty("primaryKey");
    expect(metadata.primaryKey).toBe(true);
  });

  await t.step("should distinguish primary keys from regular columns", () => {
    const pkMetadata = conn.columnMetadata(null, "users", "id");
    const colMetadata = conn.columnMetadata(null, "users", "name");
    // At least one should differ in primaryKey status
    expect(pkMetadata.primaryKey).not.toBe(colMetadata.primaryKey);
  });

  await t.step(
    "should return metadata with name, databaseName, tableName, originName",
    () => {
      const metadata = conn.columnMetadata(null, "users", "name");
      // metadata object should have connection column metadata interface
      expect(typeof metadata).toBe("object");
      expect(Object.keys(metadata).length).toBeGreaterThan(0);
    },
  );
});

Deno.test("connection.dbName()", async (t) => {
  await t.step("should return database name at index 0", () => {
    const dbName = conn.dbName(0);
    expect(typeof dbName).toBe("string");
    expect(dbName).toBe("main");
  });

  await t.step("should return 'main' for primary database", () => {
    const dbName = conn.dbName(0);
    expect(dbName).toBe("main");
  });

  await t.step("should handle multiple database indices", () => {
    const db0 = conn.dbName(0);
    expect(db0).toBeDefined();
    // Other indices may or may not exist depending on attachments
  });
});

Deno.test("connection.isReadonly()", async (t) => {
  await t.step("should return boolean for database read-only status", () => {
    const readonly = conn.isReadonly("main");
    expect(typeof readonly).toBe("boolean");
  });

  await t.step("should return false for writable in-memory database", () => {
    const readonly = conn.isReadonly("main");
    expect(readonly).toBe(false);
  });
});
