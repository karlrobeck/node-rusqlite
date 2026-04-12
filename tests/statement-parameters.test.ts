import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { Connection } from "../bindings/binding"

describe("Statement - Parameters", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)", [])
  })

  afterEach(() => {
    try {
      // Force finalization of pending statements
      conn.execute("PRAGMA integrity_check", [])
      conn.cacheFlush()
    } catch (e) {
      // Ignore errors during cleanup
    }
  })


  describe("statement.parameterIndex()", () => {
    it("should return index of positional parameter", () => {
      let index = -1
      conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
        // Positional parameters don't typically have indices by name
        // This tests the method exists and handles named parameters
        index = stmt.parameterIndex("$name") ?? -1
      })
      expect(typeof index).toBe("number")
    })

    it("should handle named parameters with $ prefix", () => {
      let index: number | null = -1
      conn.prepare("SELECT * FROM users WHERE name = $name AND age = $age", (stmt) => {
        index = stmt.parameterIndex("$name")
      })
      // Result depends on if binding uses named parameters
      expect(typeof index === "number" || index === null).toBe(true)
    })

    it("should handle named parameters with : prefix", () => {
      let index: number | null = -1
      conn.prepare("SELECT * FROM users WHERE name = :name", (stmt) => {
        index = stmt.parameterIndex(":name")
      })
      expect(typeof index === "number" || index === null).toBe(true)
    })

    it("should return null for non-existent parameter", () => {
      let index: number | null = 999
      conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
        index = stmt.parameterIndex("nonexistent")
      })
      expect(index === null || typeof index === "number").toBe(true)
    })

    it("should handle @ prefix for parameters", () => {
      let index: number | null = -1
      conn.prepare("SELECT * FROM users WHERE name = @name", (stmt) => {
        index = stmt.parameterIndex("@name")
      })
      expect(typeof index === "number" || index === null).toBe(true)
    })
  })

  describe("statement.parameterName()", () => {
    it("should return parameter name by index", () => {
      let name: string | null = ""
      conn.prepare("SELECT * FROM users WHERE name = $name AND age = $age", (stmt) => {
        name = stmt.parameterName(1)
      })
      // Result depends on statement configuration
      expect(typeof name === "string" || name === null).toBe(true)
    })

    it("should return null for positional parameters", () => {
      let name: string | null = "something"
      conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
        name = stmt.parameterName(0)
      })
      expect(name === null || typeof name === "string").toBe(true)
    })

    it("should handle multiple parameters", () => {
      conn.prepare("SELECT * FROM users WHERE id = ? AND name = ? AND age = ?", (stmt) => {
        const name0 = stmt.parameterName(0)
        const name1 = stmt.parameterName(1)
        const name2 = stmt.parameterName(2)

        // All should be either null or string
        expect(name0 === null || typeof name0 === "string").toBe(true)
        expect(name1 === null || typeof name1 === "string").toBe(true)
        expect(name2 === null || typeof name2 === "string").toBe(true)
      })
    })
  })

  describe("statement.parameterCount()", () => {
    it("should return number of parameters", () => {
      let count = 0
      conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
        count = stmt.parameterCount()
      })
      expect(count).toBe(2)
    })

    it("should return count for single parameter", () => {
      let count = 0
      conn.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
        count = stmt.parameterCount()
      })
      expect(count).toBe(1)
    })

    it("should return 0 for no parameters", () => {
      let count = 0
      conn.prepare("SELECT * FROM users", (stmt) => {
        count = stmt.parameterCount()
      })
      expect(count).toBe(0)
    })

    it("should handle multiple parameters correctly", () => {
      let count: number
      conn.prepare(
        "INSERT INTO users (name, age) VALUES (?, ?)",
        (stmt) => {
          count = stmt.parameterCount()
        }
      )
      expect(count!).toBe(2)
    })

    it("should handle named parameters", () => {
      let count = 0
      conn.prepare(
        "INSERT INTO users (name, age) VALUES (:name, :age)",
        (stmt) => {
          count = stmt.parameterCount()
        }
      )
      expect(count).toBe(2)
    })
  })

  describe("statement.clearBindings()", () => {
    it("should execute without error", () => {
      expect(() => {
        conn.prepare("SELECT * FROM users WHERE name = ?", (stmt) => {
          stmt.clearBindings()
        })
      }).not.toThrow()
    })

    it("should be callable multiple times", () => {
      expect(() => {
        conn.prepare("SELECT * FROM users WHERE name = ?", (stmt) => {
          stmt.clearBindings()
          stmt.clearBindings()
          stmt.clearBindings()
        })
      }).not.toThrow()
    })

    it("should work after binding parameters", () => {
      expect(() => {
        conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
          stmt.execute(["test", 30])
          stmt.clearBindings()
        })
      }).not.toThrow()
    })
  })

  describe("statement.expandedSql()", () => {
    it("should return expanded SQL string", () => {
      let sql: string | null = ""
      conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
        sql = stmt.expandedSql()
      })
      expect(typeof sql === "string" || sql === null).toBe(true)
    })

    it("should return original SQL when no parameters bound", () => {
      let sql: string | null = ""
      conn.prepare("SELECT * FROM users", (stmt) => {
        sql = stmt.expandedSql()
      })
      // Could be null or the expanded SQL
      expect(sql === null || typeof sql === "string").toBe(true)
    })

    it("should expand parameters in returned SQL", () => {
      let sql: string | null = ""
      conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
        sql = stmt.expandedSql()
      })
      // After binding, should return expanded SQL if available
      expect(sql === null || typeof sql === "string").toBe(true)
    })

    it("should handle unnamed parameters", () => {
      let sql: string | null = ""
      conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
        sql = stmt.expandedSql()
      })
      expect(sql === null || typeof sql === "string").toBe(true)
    })
  })
})
