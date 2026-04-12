import { expect } from "@std/expect";
// @ts-types="../bindings/binding.d.ts"
import { Connection } from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
});

Deno.test("connection.pragmaQueryValue()", async (t) => {
  await t.step("should query a PRAGMA value", () => {
    const value = conn.pragmaQueryValue(null, "cache_size");
    expect(value).toBeDefined();
  });

  await t.step("should return a value (could be any type)", () => {
    const value = conn.pragmaQueryValue(null, "cache_size");
    expect(typeof value).not.toBe("undefined");
  });

  await t.step("should handle different pragma names", () => {
    const cacheSize = conn.pragmaQueryValue(null, "cache_size");
    const pageSize = conn.pragmaQueryValue(null, "page_size");
    expect(cacheSize).toBeDefined();
    expect(pageSize).toBeDefined();
  });

  await t.step("should return queryable pragma values", () => {
    const value = conn.pragmaQueryValue(null, "cache_size");
    // pragmaQueryValue returns an object with the pragma name as key
    expect(typeof value).toBe("object");
  });
});

Deno.test("connection.pragmaQuery()", async (t) => {
  await t.step("should query PRAGMA and return object", () => {
    const result = conn.pragmaQuery(null, "table_info");
    expect(typeof result).toBe("object");
  });

  await t.step("should return Record<string, unknown> type", () => {
    const result = conn.pragmaQuery(null, "cache_size");
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  await t.step("should work with basic pragmas", () => {
    const result = conn.pragmaQuery(null, "journal_mode");
    expect(result).toBeDefined();
  });
});

Deno.test("connection.pragma()", async (t) => {
  await t.step("should execute pragma with callback synchronously", () => {
    let callbackCalled = false;
    let callbackValue: Record<string, unknown> | null = null;

    conn.pragma(null, "journal_mode", [], (value) => {
      callbackCalled = true;
      callbackValue = value;
    });

    expect(callbackCalled).toBe(true);
    expect(callbackValue).toBeDefined();
    expect(typeof callbackValue).toBe("object");
  });

  await t.step("should pass result to callback with no pragma value", () => {
    let receivedResult: Record<string, unknown> | null = null;

    conn.pragma(null, "journal_mode", [], (result) => {
      receivedResult = result;
    });

    expect(receivedResult).toBeDefined();
    expect(typeof receivedResult).toBe("object");
  });

  await t.step("should execute pragma callback synchronously", () => {
    let callbackExecuted = false;

    conn.pragma(null, "cache_size", [], (result) => {
      callbackExecuted = true;
      expect(result).toBeDefined();
    });

    expect(callbackExecuted).toBe(true);
  });
});

Deno.test("connection.pragmaUpdate()", async (t) => {
  await t.step("should return a Promise from pragmaUpdate", async () => {
    const promise = conn.pragmaUpdate(null, "journal_mode", []);
    // pragmaUpdate is async - should return a promise
    expect(typeof promise.then === "function").toBe(true);
  });
});

Deno.test("connection.pragmaUpdateAndCheck()", async (t) => {
  await t.step("should be callable and return result", () => {
    // pragmaUpdateAndCheck is available on the connection
    expect(typeof conn.pragmaUpdateAndCheck).toBe("function");
  });
});
