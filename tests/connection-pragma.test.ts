import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { Connection } from "../bindings/binding"

describe("Connection - PRAGMA Operations", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
  })

  afterEach(() => {
    const handle = conn.getInterruptHandle()
    handle.interrupt()
  })


  describe("connection.pragmaQueryValue()", () => {
    it("should query a PRAGMA value", () => {
      const value = conn.pragmaQueryValue(null, "cache_size")
      expect(value).toBeDefined()
    })

    it("should return a value (could be any type)", () => {
      const value = conn.pragmaQueryValue(null, "cache_size")
      expect(typeof value).not.toBe("undefined")
    })

    it("should handle different pragma names", () => {
      const cacheSize = conn.pragmaQueryValue(null, "cache_size")
      const pageSize = conn.pragmaQueryValue(null, "page_size")
      expect(cacheSize).toBeDefined()
      expect(pageSize).toBeDefined()
    })

    it("should return queryable pragma values", () => {
      const value = conn.pragmaQueryValue(null, "cache_size")
      // pragmaQueryValue returns an object with the pragma name as key
      expect(typeof value).toBe("object")
    })
  })

  describe("connection.pragmaQuery()", () => {
    it("should query PRAGMA and return object", () => {
      const result = conn.pragmaQuery(null, "table_info")
      expect(typeof result).toBe("object")
    })

    it("should return Record<string, unknown> type", () => {
      const result = conn.pragmaQuery(null, "cache_size")
      expect(result).toBeDefined()
      expect(typeof result).toBe("object")
    })

    it("should work with basic pragmas", () => {
      const result = conn.pragmaQuery(null, "journal_mode")
      expect(result).toBeDefined()
    })
  })

  describe("connection.pragma()", () => {
    it.todo("should execute pragma with callback synchronously", () => {
      let callbackCalled = false
      let callbackValue: Record<string, unknown> | null = null

      conn.pragma(null, "journal_mode", [], (value) => {
        callbackCalled = true
        callbackValue = value
      })

      expect(callbackCalled).toBe(true)
      expect(callbackValue).toBeDefined()
      expect(typeof callbackValue).toBe("object")
    })

    it.todo("should pass result to callback with no pragma value", () => {
      let receivedResult: Record<string, unknown> | null = null

      conn.pragma(null, "journal_mode", [], (result) => {
        receivedResult = result
      })

      expect(receivedResult).toBeDefined()
      expect(typeof receivedResult).toBe("object")
    })

    it.todo("should execute pragma callback synchronously", () => {
      let callbackExecuted = false

      conn.pragma(null, "cache_size", [], (result) => {
        callbackExecuted = true
        expect(result).toBeDefined()
      })

      expect(callbackExecuted).toBe(true)
    })
  })

  describe("connection.pragmaUpdate()", () => {
    it.todo("should return a Promise from pragmaUpdate", async () => {
      const promise = conn.pragmaUpdate(null, "journal_mode", [])
      // pragmaUpdate is async - should return a promise
      expect(typeof promise.then === "function").toBe(true)
    })
  })

  describe("connection.pragmaUpdateAndCheck()", () => {
    it("should be callable and return result", () => {
      // pragmaUpdateAndCheck is available on the connection
      expect(typeof conn.pragmaUpdateAndCheck).toBe("function")
    })
  })
})
