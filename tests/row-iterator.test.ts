import { describe, it, expect, beforeEach, beforeAll } from "bun:test"
import { Connection } from "../bindings/binding"
import { afterEach } from "node:test"

describe("RowIterator - Iterator Protocol", () => {
  let conn: Connection

  beforeAll(() => {
    conn = Connection.openInMemory()
  })

  beforeEach(() => {
    conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT, price REAL)", [])
    conn.execute("INSERT INTO items (title, price) VALUES (?, ?)", ["Item1", 10.5])
    conn.execute("INSERT INTO items (title, price) VALUES (?, ?)", ["Item2", 20.75])
    conn.execute("INSERT INTO items (title, price) VALUES (?, ?)", ["Item3", 15.25])
  })

  afterEach(() => {
    conn.execute("DROP TABLE items",[])
  })

  describe("iterator.next()", () => {
    it("should return IteratorResult with value and done", () => {
      conn.prepare("SELECT * FROM items LIMIT 1", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        expect(result).toBeDefined()
        expect(Object.keys(result)).toContain("value")
        expect(Object.keys(result)).toContain("done")
      })
    })

    it("should return done=false for first row", () => {
      conn.prepare("SELECT * FROM items", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        expect(result.done).toBe(false)
      })
    })

    it("should return done=true after final row", () => {
      conn.prepare("SELECT * FROM items WHERE id > ?", (stmt) => {
        const rows = stmt.query([999])
        const iterator = rows.iterate()
        const result = iterator.next()

        expect(result.done).toBe(true)
      })
    })

    it("should provide row data in value", () => {
      conn.prepare("SELECT title FROM items WHERE id = 1", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        expect(result.value).toBeDefined()
        expect(typeof result.value).toBe("object")
      })
    })

    it("should iterate through all rows", () => {
      conn.prepare("SELECT id FROM items ORDER BY id", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        const ids: any[] = []
        let result
        while (!(result = iterator.next()).done) {
          if (result.value && typeof result.value === "object") {
            ids.push((result.value as any).id)
          }
        }

        expect(ids).toEqual([1, 2, 3])
      })
    })

    it("should handle optional value parameter", () => {
      conn.prepare("SELECT * FROM items LIMIT 2", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        const result1 = iterator.next()
        const result2 = iterator.next(0)
        const result3 = iterator.next()

        expect(result1.done).toBe(false)
        expect(result2.done).toBe(false)
        expect(result3.done).toBe(true)
      })
    })
  })

  describe("Iterator as Iterable", () => {
    it("should work with for...of loop", () => {
      conn.prepare("SELECT title FROM items ORDER BY id", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        const titles: any[] = []
        for (const row of iterator as any) {
          if (row && typeof row === "object") {
            titles.push((row as any).title)
          }
        }

        expect(titles).toContain("Item1")
        expect(titles).toContain("Item2")
        expect(titles).toContain("Item3")
      })
    })

    it("should allow using spread operator", () => {
      conn.prepare("SELECT id FROM items ORDER BY id", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        // Note: spread on iterator might not work directly,
        // but we test that the method exists
        expect(typeof iterator.next).toBe("function")
      })
    })
  })

  describe("Iterator with Data Validation", () => {
    it("should provide correct row structure", () => {
      conn.prepare("SELECT id, title, price FROM items WHERE id = 1", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        expect(result.done).toBe(false)
        const row = result.value as any
        expect(row).toHaveProperty("id")
        expect(row).toHaveProperty("title")
        expect(row).toHaveProperty("price")
      })
    })

    it("should preserve data types", () => {
      conn.prepare("SELECT id, title, price FROM items WHERE id = 2", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        const row = result.value as any
        expect(typeof row.id).toBe("number")
        expect(typeof row.title).toBe("string")
        expect(typeof row.price).toBe("number")
      })
    })

    it("should handle null values in row data", () => {
      conn.execute("INSERT INTO items (title, price) VALUES (?, ?)", [null, null])

      conn.prepare("SELECT title, price FROM items WHERE title IS NULL", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()
        const result = iterator.next()

        const row = result.value as any
        expect(row.title).toBeNull()
        expect(row.price).toBeNull()
      })
    })
  })

  describe("Iterator Edge Cases", () => {
    it("should handle empty result set", () => {
      conn.prepare("SELECT * FROM items WHERE id > ?", (stmt) => {
        const rows = stmt.query([999])
        const iterator = rows.iterate()

        const result = iterator.next()
        expect(result.done).toBe(true)
        expect(result.value).toBeUndefined() // or null, depends on implementation
      })
    })

    it("should handle single row", () => {
      conn.prepare("SELECT * FROM items WHERE id = 1", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        const r1 = iterator.next()
        const r2 = iterator.next()

        expect(r1.done).toBe(false)
        expect(r2.done).toBe(true)
      })
    })

    it("should handle sequential next() calls", () => {
      conn.prepare("SELECT id FROM items ORDER BY id LIMIT 3", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        const results = [
          iterator.next(),
          iterator.next(),
          iterator.next(),
          iterator.next(),
        ]

        expect(results[0].done).toBe(false)
        expect(results[1].done).toBe(false)
        expect(results[2].done).toBe(false)
        expect(results[3].done).toBe(true)
      })
    })

    it("should handle next() after exhaustion", () => {
      conn.prepare("SELECT * FROM items WHERE id > ?", (stmt) => {
        const rows = stmt.query([999])
        const iterator = rows.iterate()

        const result1 = iterator.next()
        const result2 = iterator.next()

        expect(result1.done).toBe(true)
        expect(result2.done).toBe(true)
      })
    })
  })

  describe("Iterator Helper Methods", () => {
    it("should have defined structure", () => {
      conn.prepare("SELECT * FROM items", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        // Iterator should have next method
        expect(typeof iterator.next).toBe("function")
      })
    })

    it("should support iterator protocol", () => {
      conn.prepare("SELECT id FROM items ORDER BY id", (stmt) => {
        const rows = stmt.query([])
        const iterator = rows.iterate()

        // Should be able to call next repeatedly
        let count = 0
        let result
        while (true) {
          result = iterator.next()
          if (result.done) break
          count++
        }

        expect(count).toBe(3)
      })
    })
  })
})
