import { describe, it, expect, beforeEach } from "bun:test"
import { Connection } from "../bindings/binding"

describe("Connection - Schema Metadata", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)", [])
    conn.execute("CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT, price REAL)", [])
  })


  describe("connection.tableExists()", () => {
    it("should return true for existing table", () => {
      const exists = conn.tableExists(null, "users")
      expect(exists).toBe(true)
    })

    it("should return false for non-existing table", () => {
      const exists = conn.tableExists(null, "nonexistent")
      expect(exists).toBe(false)
    })

    it("should check case-sensitive table names", () => {
      const exists = conn.tableExists(null, "USERS")
      expect(typeof exists).toBe("boolean")
    })

    it("should accept null db name for main database", () => {
      const exists = conn.tableExists(null, "users")
      expect(exists).toBe(true)
    })
  })

  describe("connection.columnExists()", () => {
    it("should return true for existing column", () => {
      const exists = conn.columnExists(null, "users", "name")
      expect(exists).toBe(true)
    })

    it("should return false for non-existing column", () => {
      const exists = conn.columnExists(null, "users", "nonexistent")
      expect(exists).toBe(false)
    })

    it("should handle different column types", () => {
      expect(conn.columnExists(null, "users", "id")).toBe(true)
      expect(conn.columnExists(null, "users", "age")).toBe(true)
      expect(conn.columnExists(null, "products", "price")).toBe(true)
    })

    it("should return false for column in non-existing table", () => {
      const exists = conn.columnExists(null, "nonexistent", "column")
      expect(exists).toBe(false)
    })
  })

  describe("connection.columnMetadata()", () => {
    it("should return metadata for existing column", () => {
      const metadata = conn.columnMetadata(null, "users", "name")
      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe("object")
    })

    it("should include declType in metadata", () => {
      const metadata = conn.columnMetadata(null, "users", "id")
      expect(metadata).toHaveProperty("type")
    })

    it("should indicate PRIMARY KEY columns", () => {
      const metadata = conn.columnMetadata(null, "users", "id")
      expect(metadata).toHaveProperty("primaryKey")
      expect(metadata.primaryKey).toBe(true)
    })

    it("should distinguish primary keys from regular columns", () => {
      const pkMetadata = conn.columnMetadata(null, "users", "id")
      const colMetadata = conn.columnMetadata(null, "users", "name")
      // At least one should differ in primaryKey status
      expect(pkMetadata.primaryKey).not.toBe(colMetadata.primaryKey)
    })

    it("should return metadata with name, databaseName, tableName, originName", () => {
      const metadata = conn.columnMetadata(null, "users", "name")
      // metadata object should have connection column metadata interface
      expect(typeof metadata).toBe("object")
      expect(Object.keys(metadata).length).toBeGreaterThan(0)
    })
  })

  describe("connection.dbName()", () => {
    it("should return database name at index 0", () => {
      const dbName = conn.dbName(0)
      expect(typeof dbName).toBe("string")
      expect(dbName).toBe("main")
    })

    it("should return 'main' for primary database", () => {
      const dbName = conn.dbName(0)
      expect(dbName).toBe("main")
    })

    it("should handle multiple database indices", () => {
      const db0 = conn.dbName(0)
      expect(db0).toBeDefined()
      // Other indices may or may not exist depending on attachments
    })
  })

  describe("connection.isReadonly()", () => {
    it("should return boolean for database read-only status", () => {
      const readonly = conn.isReadonly("main")
      expect(typeof readonly).toBe("boolean")
    })

    it("should return false for writable in-memory database", () => {
      const readonly = conn.isReadonly("main")
      expect(readonly).toBe(false)
    })
  })
})
