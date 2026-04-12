import { describe, it, expect, beforeAll, beforeEach, afterEach } from "bun:test"
import { Connection } from "../bindings/binding"

describe("Connection - Query & Statement Execution", () => {
  let conn: Connection

  beforeAll(() => {
    conn = Connection.openInMemory();
  })
  
  // Create a test table
  beforeEach(() => {
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)", [])
    conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Alice", 30])
    conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Bob", 25])
  })

  afterEach(() => {
    conn.execute("DROP TABLE users",[]);
  })

  describe("connection.execute()", () => {
    it("should execute SQL with parameters", () => {
      const rowsAffected = conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Charlie", 35])
      expect(typeof rowsAffected).toBe("number")
      expect(rowsAffected).toBe(1)
    })

    it("should execute SQL without parameters", () => {
      const rowsAffected = conn.execute("DELETE FROM users WHERE age > 30", [])
      expect(typeof rowsAffected).toBe("number")
    })

    it("should handle UPDATE statements", () => {
      const rowsAffected = conn.execute("UPDATE users SET age = ? WHERE name = ?", [31, "Alice"])
      expect(rowsAffected).toBe(1)
    })

    it("should handle DELETE statements", () => {
      const rowsAffected = conn.execute("DELETE FROM users WHERE name = ?", ["Bob"])
      expect(rowsAffected).toBe(1)
    })
  })

  describe("connection.executeBatch()", () => {
    it("should execute multiple SQL statements", () => {
      expect(() => {
        conn.executeBatch("DELETE FROM users; INSERT INTO users (name, age) VALUES ('David', 40);")
      }).not.toThrow()
    })

    it("should handle empty batch", () => {
      expect(() => {
        conn.executeBatch("")
      }).not.toThrow()
    })
  })

  describe("connection.queryRow()", () => {
    it("should return first matching row as object", () => {
      const row = conn.queryRow("SELECT * FROM users WHERE age > ?", [25])
      expect(row).toBeDefined()
      expect(typeof row).toBe("object")
      expect(row).toHaveProperty("id")
      expect(row).toHaveProperty("name")
      expect(row).toHaveProperty("age")
    })

    it("should handle empty parameters", () => {
      const row = conn.queryRow("SELECT * FROM users LIMIT 1", [])
      expect(row).toBeDefined()
      expect(typeof row).toBe("object")
    })

    it("should work with WHERE clause", () => {
      const row = conn.queryRow("SELECT * FROM users WHERE name = ?", ["Alice"])
      expect(row).toBeDefined()
      expect((row as any).name).toBe("Alice")
    })
  })

  describe("connection.queryOne()", () => {
    it("should return single row as object", () => {
      const row = conn.queryOne("SELECT * FROM users WHERE id = ?", [1])
      expect(row).toBeDefined()
      expect(typeof row).toBe("object")
    })

    it.todo("should return first row if multiple exist", () => {
      const row = conn.queryOne("SELECT * FROM users", [])
      expect(row).toBeDefined()
      expect(row).toHaveProperty("id")
    })
  })

  describe("connection.prepare()", () => {
    it("should prepare a statement and execute callback", () => {
      let callbackCalled = false
      conn.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
        callbackCalled = true
        expect(stmt).toBeDefined()
        const result = stmt.query([1])
        expect(result).toBeDefined()
      })
      expect(callbackCalled).toBe(true)
    })

    it("should allow multiple prepares of same SQL", () => {
      const sql = "SELECT * FROM users"
      let callCount = 0

      conn.prepare(sql, (_) => {
        callCount++
      })
      conn.prepare(sql, (_) => {
        callCount++
      })

      expect(callCount).toBe(2)
    })
  })

  describe("connection.prepareWithFlags()", () => {
    it("should prepare with SQLite prepare flags", () => {
      let callbackCalled = false
      conn.prepareWithFlags("SELECT * FROM users", 1, (stmt) => {
        callbackCalled = true
        expect(stmt).toBeDefined()
      })
      expect(callbackCalled).toBe(true)
    })
  })

  describe("connection.lastInsertRowid()", () => {
    it("should return the last inserted rowid", () => {
      conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Eve", 28])
      const rowid = conn.lastInsertRowid()
      expect(typeof rowid).toBe("number")
      expect(rowid).toBeGreaterThan(0)
    })

    it("should update after each insert", () => {
      conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Frank", 45])
      const rowid1 = conn.lastInsertRowid()
      
      conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Grace", 33])
      const rowid2 = conn.lastInsertRowid()
      
      expect(rowid2).toBeGreaterThan(rowid1)
    })
  })

  describe("connection.changes()", () => {
    it("should return number of rows affected by last statement", () => {
      const changes = conn.changes()
      expect(typeof changes).toBe("number")
    })

    it("should reflect changes from execute", () => {
      conn.execute("UPDATE users SET age = ? WHERE age = ?", [26, 25])
      const changes = conn.changes()
      expect(changes).toBe(1)
    })
  })

  describe("connection.totalChanges()", () => {
    it("should return total changes since connection opened", () => {
      const totalChanges = conn.totalChanges()
      expect(typeof totalChanges).toBe("number")
      expect(totalChanges).toBeGreaterThanOrEqual(2) // from beforeEach inserts
    })

    it("should increase with each modification", () => {
      const before = conn.totalChanges()
      conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Henry", 50])
      const after = conn.totalChanges()
      expect(after).toBeGreaterThan(before)
    })
  })
})
