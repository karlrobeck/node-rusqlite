import { describe, it, expect, beforeEach } from "bun:test"
import { Connection, RusqliteStatementStatus } from "../bindings/binding"

describe("Statement - Status", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
    conn.execute("CREATE TABLE numbers (id INTEGER PRIMARY KEY, value INTEGER)", [])
    for (let i = 1; i <= 100; i++) {
      conn.execute("INSERT INTO numbers (value) VALUES (?)", [i])
    }
  })


  describe("statement.getStatus()", () => {
    it("should read FullscanStep status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers WHERE value > ?", (stmt) => {
        stmt.query([50])
        status = stmt.getStatus(RusqliteStatementStatus.FullscanStep)
      })
      expect(typeof status).toBe("number")
      expect(status).toBeGreaterThanOrEqual(0)
    })

    it("should read Sort status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers ORDER BY value DESC", (stmt) => {
        stmt.query([])
        status = stmt.getStatus(RusqliteStatementStatus.Sort)
      })
      expect(typeof status).toBe("number")
    })

    it("should read AutoIndex status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers WHERE value = ?", (stmt) => {
        stmt.query([50])
        status = stmt.getStatus(RusqliteStatementStatus.AutoIndex)
      })
      expect(typeof status).toBe("number")
    })

    it("should read VmStep status", () => {
      let status = 0
      conn.prepare("SELECT COUNT(*) FROM numbers", (stmt) => {
        stmt.query([])
        status = stmt.getStatus(RusqliteStatementStatus.VmStep)
      })
      expect(typeof status).toBe("number")
      expect(status).toBeGreaterThanOrEqual(0)
    })

    it("should read Run status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers LIMIT 10", (stmt) => {
        stmt.query([])
        status = stmt.getStatus(RusqliteStatementStatus.Run)
      })
      expect(typeof status).toBe("number")
    })

    it("should read FilterMiss status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers WHERE value > ? AND value < ?", (stmt) => {
        stmt.query([10, 90])
        status = stmt.getStatus(RusqliteStatementStatus.FilterMiss)
      })
      expect(typeof status).toBe("number")
    })

    it("should read FilterHit status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers WHERE value > ? AND value < ?", (stmt) => {
        stmt.query([10, 90])
        status = stmt.getStatus(RusqliteStatementStatus.FilterHit)
      })
      expect(typeof status).toBe("number")
    })

    it("should read MemUsed status", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers", (stmt) => {
        stmt.query([])
        status = stmt.getStatus(RusqliteStatementStatus.MemUsed)
      })
      expect(typeof status).toBe("number")
      expect(status).toBeGreaterThanOrEqual(0)
    })

    it("should return 0 before query execution", () => {
      let status = 0
      conn.prepare("SELECT * FROM numbers LIMIT 1", (stmt) => {
        status = stmt.getStatus(RusqliteStatementStatus.VmStep)
      })
      expect(status).toBe(0)
    })

    it("should increase after query execution", () => {
      let before = 0
      let after = 0

      conn.prepare("SELECT * FROM numbers WHERE value > ?", (stmt) => {
        before = stmt.getStatus(RusqliteStatementStatus.VmStep)
        stmt.query([50])
        after = stmt.getStatus(RusqliteStatementStatus.VmStep)
      })

      expect(after).toBeGreaterThanOrEqual(before)
    })
  })

  describe("statement.resetStatus()", () => {
    it("should reset FullscanStep and return previous value", () => {
      let previousValue = 0
      conn.prepare("SELECT * FROM numbers", (stmt) => {
        stmt.query([])
        previousValue = stmt.resetStatus(RusqliteStatementStatus.FullscanStep)
      })
      expect(typeof previousValue).toBe("number")
      expect(previousValue).toBeGreaterThanOrEqual(0)
    })

    it("should reset VmStep counter", () => {
      conn.prepare("SELECT * FROM numbers LIMIT 10", (stmt) => {
        stmt.query([])
        const before = stmt.getStatus(RusqliteStatementStatus.VmStep)
        stmt.resetStatus(RusqliteStatementStatus.VmStep)
        const after = stmt.getStatus(RusqliteStatementStatus.VmStep)

        expect(before).toBeGreaterThan(0)
        expect(after).toBe(0)
      })
    })

    it("should reset Sort counter", () => {
      conn.prepare("SELECT * FROM numbers ORDER BY value DESC", (stmt) => {
        stmt.query([])
        const before = stmt.getStatus(RusqliteStatementStatus.Sort)
        stmt.resetStatus(RusqliteStatementStatus.Sort)
        const after = stmt.getStatus(RusqliteStatementStatus.Sort)

        expect(after).toBe(0)
      })
    })

    it("should reset Run counter", () => {
      conn.prepare("SELECT COUNT(*) FROM numbers", (stmt) => {
        stmt.query([])
        const before = stmt.getStatus(RusqliteStatementStatus.Run)
        stmt.resetStatus(RusqliteStatementStatus.Run)
        const after = stmt.getStatus(RusqliteStatementStatus.Run)

        expect(after).toBe(0)
      })
    })

    it("should allow multiple resets", () => {
      conn.prepare("SELECT * FROM numbers LIMIT 5", (stmt) => {
        stmt.query([])
        const value1 = stmt.resetStatus(RusqliteStatementStatus.VmStep)
        const value2 = stmt.resetStatus(RusqliteStatementStatus.VmStep)

        expect(typeof value1).toBe("number")
        expect(typeof value2).toBe("number")
        // Second reset should return 0 (was reset by first reset)
        expect(value2).toBe(0)
      })
    })

    it("should work for all status types", () => {
      conn.prepare("SELECT * FROM numbers", (stmt) => {
        stmt.query([])

        const statuses = [
          RusqliteStatementStatus.FullscanStep,
          RusqliteStatementStatus.Sort,
          RusqliteStatementStatus.AutoIndex,
          RusqliteStatementStatus.VmStep,
          RusqliteStatementStatus.Run,
        ]

        for (const status of statuses) {
          const value = stmt.resetStatus(status)
          expect(typeof value).toBe("number")
        }
      })
    })
  })

  describe("RusqliteStatementStatus Enum", () => {
    it("should have documented status types", () => {
      expect(RusqliteStatementStatus.FullscanStep).toBeDefined()
      expect(RusqliteStatementStatus.Sort).toBeDefined()
      expect(RusqliteStatementStatus.AutoIndex).toBeDefined()
      expect(RusqliteStatementStatus.VmStep).toBeDefined()
      expect(RusqliteStatementStatus.Run).toBeDefined()
      expect(RusqliteStatementStatus.FilterMiss).toBeDefined()
      expect(RusqliteStatementStatus.FilterHit).toBeDefined()
      expect(RusqliteStatementStatus.MemUsed).toBeDefined()
    })

    it("should have numeric values", () => {
      expect(typeof RusqliteStatementStatus.FullscanStep).toBe("number")
      expect(typeof RusqliteStatementStatus.Sort).toBe("number")
      expect(typeof RusqliteStatementStatus.VmStep).toBe("number")
    })

    it("should have distinct values", () => {
      const values = [
        RusqliteStatementStatus.FullscanStep,
        RusqliteStatementStatus.Sort,
        RusqliteStatementStatus.AutoIndex,
        RusqliteStatementStatus.VmStep,
      ]

      const unique = new Set(values)
      expect(unique.size).toBe(values.length)
    })
  })
})
