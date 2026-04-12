import { describe, it, expect, beforeEach } from "bun:test"
import { Connection } from "../bindings/binding"

describe("Interrupt - Long-Running Operations", () => {
  let conn: Connection

  beforeEach(() => {
    conn = Connection.openInMemory()
    conn.execute("CREATE TABLE numbers (id INTEGER PRIMARY KEY, value INTEGER)", [])
    for (let i = 1; i <= 10000; i++) {
      conn.execute("INSERT INTO numbers (value) VALUES (?)", [i])
    }
  })

  describe("connection.getInterruptHandle()", () => {
    it("should return an InterruptHandle", () => {
      const handle = conn.getInterruptHandle()
      expect(handle).toBeDefined()
    })

    it("should return object with interrupt method", () => {
      const handle = conn.getInterruptHandle()
      expect(typeof handle.interrupt).toBe("function")
    })

    it("should allow multiple handle acquisitions", () => {
      const handle1 = conn.getInterruptHandle()
      const handle2 = conn.getInterruptHandle()

      expect(handle1).toBeDefined()
      expect(handle2).toBeDefined()
    })

    it("should return same type of handle for same connection", () => {
      const handle1 = conn.getInterruptHandle()
      const handle2 = conn.getInterruptHandle()

      expect(typeof handle1.interrupt).toBe("function")
      expect(typeof handle2.interrupt).toBe("function")
    })
  })

  describe("handle.interrupt()", () => {
    it("should execute without error", () => {
      const handle = conn.getInterruptHandle()
      expect(() => {
        handle.interrupt()
      }).not.toThrow()
    })

    it("should be callable multiple times", () => {
      const handle = conn.getInterruptHandle()
      expect(() => {
        handle.interrupt()
        handle.interrupt()
        handle.interrupt()
      }).not.toThrow()
    })

    it("should set connection interrupt state", () => {
      const handle = conn.getInterruptHandle()
      const beforeInterrupt = conn.isInterrupted()
      
      handle.interrupt()
      
      const afterInterrupt = conn.isInterrupted()
      // After interrupt is called, isInterrupted should return true
      expect(afterInterrupt).toBe(true)
    })

    it("should allow interrupting different handles independently", () => {
      const handle1 = conn.getInterruptHandle()
      const handle2 = conn.getInterruptHandle()

      expect(() => {
        handle1.interrupt()
        handle2.interrupt()
      }).not.toThrow()
    })
  })

  describe("connection.isInterrupted()", () => {
    it("should return a boolean", () => {
      const interrupted = conn.isInterrupted()
      expect(typeof interrupted).toBe("boolean")
    })

    it("should return false for non-interrupted connection", () => {
      const interrupted = conn.isInterrupted()
      expect(interrupted).toBe(false)
    })

    it("should return true after interrupt()", () => {
      const handle = conn.getInterruptHandle()
      handle.interrupt()

      const interrupted = conn.isInterrupted()
      expect(interrupted).toBe(true)
    })

    it("should reflect interrupt state changes", () => {
      expect(conn.isInterrupted()).toBe(false)

      const handle = conn.getInterruptHandle()
      handle.interrupt()

      expect(conn.isInterrupted()).toBe(true)
    })
  })

  describe("Interrupt - Query Handling", () => {
    it("should allow querying after interrupt", () => {
      const handle = conn.getInterruptHandle()
      
      // Create fresh connection to avoid persisting interrupt
      const freshConn = Connection.openInMemory()
      freshConn.execute("CREATE TABLE test (id INTEGER)", [])
      freshConn.execute("INSERT INTO test VALUES (1)", [])

      // Get handle and interrupt
      const freshHandle = freshConn.getInterruptHandle()
      freshHandle.interrupt()

      // Connection should still be usable (though may error on actual execution)
      expect(() => {
        freshConn.execute("INSERT INTO test VALUES (2)", [])
      }).not.toThrow()
    })

    it("should coexist with normal operations", () => {
      const handle1 = conn.getInterruptHandle()
      
      // Normal query
      const result1 = conn.queryRow("SELECT COUNT(*) as count FROM numbers", [])
      expect(result1).toBeDefined()

      // Get handle
      const handle2 = conn.getInterruptHandle()
      expect(handle2).toBeDefined()

      // Another normal query
      const result2 = conn.queryRow("SELECT COUNT(*) as count FROM numbers", [])
      expect(result2).toBeDefined()
    })
  })

  describe("Interrupt - Connection State", () => {
    it("should maintain interrupt state across operations", () => {
      const handle = conn.getInterruptHandle()
      
      // Initial state
      expect(conn.isInterrupted()).toBe(false)

      // Interrupt
      handle.interrupt()
      expect(conn.isInterrupted()).toBe(true)

      // State should persist
      expect(conn.isInterrupted()).toBe(true)
    })

    it("should allow checking interrupt from any handle", () => {
      const handle1 = conn.getInterruptHandle()
      
      handle1.interrupt()

      const handle2 = conn.getInterruptHandle()
      // Both handles reference same connection
      expect(conn.isInterrupted()).toBe(true)
    })

    it("should work with multiple interrupt calls", () => {
      const handle = conn.getInterruptHandle()

      handle.interrupt()
      expect(conn.isInterrupted()).toBe(true)

      handle.interrupt()
      expect(conn.isInterrupted()).toBe(true)

      handle.interrupt()
      expect(conn.isInterrupted()).toBe(true)
    })
  })

  describe("Interrupt - Error Scenarios", () => {
    it("should handle interrupt on empty table", () => {
      const emptyConn = Connection.openInMemory()
      emptyConn.execute("CREATE TABLE empty (id INTEGER)", [])

      const handle = emptyConn.getInterruptHandle()
      handle.interrupt()

      expect(emptyConn.isInterrupted()).toBe(true)
    })

    it("should handle interrupt on large result set", () => {
      const handle = conn.getInterruptHandle()
      
      // Query large result set
      conn.prepare("SELECT * FROM numbers", (stmt) => {
        const rows = stmt.query([])
        
        // Interrupt while data exists
        handle.interrupt()
        
        expect(conn.isInterrupted()).toBe(true)
      })
    })

    it("should handle rapid interrupt calls", () => {
      const handle = conn.getInterruptHandle()

      expect(() => {
        for (let i = 0; i < 10; i++) {
          handle.interrupt()
        }
      }).not.toThrow()

      expect(conn.isInterrupted()).toBe(true)
    })
  })

  describe("Interrupt - Multiple Handles", () => {
    it("should allow getting multiple handles from same connection", () => {
      const handles = []
      for (let i = 0; i < 5; i++) {
        handles.push(conn.getInterruptHandle())
      }

      expect(handles.length).toBe(5)
      handles.forEach((handle) => {
        expect(typeof handle.interrupt).toBe("function")
      })
    })

    it("should interrupt from any handle", () => {
      const handle1 = conn.getInterruptHandle()
      const handle2 = conn.getInterruptHandle()
      const handle3 = conn.getInterruptHandle()

      // Interrupt using middle handle
      handle2.interrupt()

      // All should see same interrupted state
      expect(conn.isInterrupted()).toBe(true)
    })

    it("should work with handles created at different times", () => {
      const handle1 = conn.getInterruptHandle()
      
      // Do some work
      conn.execute("INSERT INTO numbers (value) VALUES (?)", [99999])
      
      const handle2 = conn.getInterruptHandle()

      // Interrupt with first handle
      handle1.interrupt()

      // Check state with second handle's concept
      expect(conn.isInterrupted()).toBe(true)
    })
  })
})
