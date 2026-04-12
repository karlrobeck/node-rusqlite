import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Connection } from "../bindings/binding";

describe("Rows - Result Set Operations", () => {
  let conn: Connection;

  beforeEach(() => {
    conn = Connection.openInMemory();
    conn.execute(
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)",
      [],
    );
    conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Alice", 30]);
    conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", ["Bob", 25]);
    conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", [
      "Charlie",
      35,
    ]);
  });

  describe("rows.toJSON()", () => {
    it("should convert rows to JSON representation", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      expect(json).toBeDefined();
    });

    it("should return an array-like structure", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      // toJSON should return something that can be serialized
      expect(() => JSON.stringify(json)).not.toThrow();
    });

    it("should preserve row data", () => {
      let json: any;
      conn.prepare("SELECT name, age FROM users WHERE id = 1", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      // Should be able to convert to JSON
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).toContain("Alice");
    });

    it("should handle empty result set", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users WHERE id > ?", (stmt) => {
        const rows = stmt.query([999]);
        json = rows.toJSON();
      });
      expect(json).toBeDefined();
    });

    it("should handle multiple rows", () => {
      let json: any;
      conn.prepare("SELECT name FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).toContain("Alice");
      expect(jsonStr).toContain("Bob");
      expect(jsonStr).toContain("Charlie");
    });
  });

  describe("rows.get()", () => {
    it("should return row at index 0", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(0);
      });
      expect(row).toBeDefined();
      expect(typeof row).toBe("object");
    });

    it("should return row at specified index", () => {
      let row1: unknown;
      let row2: unknown;
      conn.prepare("SELECT name FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);
        row1 = rows.get(0);
        row2 = rows.get(1);
      });
      expect(row1).toBeDefined();
      expect(row2).toBeDefined();
    });

    it("should return null for out of bounds index", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(999);
      });
      expect(row).toBeNull();
    });

    it("should return null for negative index", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(-1);
      });
      expect(row).toBeNull();
    });

    it("should allow accessing multiple rows", () => {
      conn.prepare("SELECT id, name FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);
        const row0 = rows.get(0) as any;
        const row1 = rows.get(1) as any;
        const row2 = rows.get(2) as any;

        expect(row0?.name).toBe("Alice");
        expect(row1?.name).toBe("Bob");
        expect(row2?.name).toBe("Charlie");
      });
    });

    it("should return data consistent with iteration", () => {
      conn.prepare("SELECT id FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);

        // Using get
        const row0 = rows.get(0) as any;
        const row1 = rows.get(1) as any;

        expect(row0?.id).toBe(1);
        expect(row1?.id).toBe(2);
      });
    });

    it("should handle single row result", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
        const rows = stmt.query([1]);
        row = rows.get(0);
      });
      expect(row).toBeDefined();
      expect((row as any)?.name).toBe("Alice");
    });
  });

  describe("rows.iterate()", () => {
    it("should return a RowIterator", () => {
      let iterator: any;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        iterator = rows.iterate();
      });
      expect(iterator).toBeDefined();
    });

    it("should create an iterator with next() method", () => {
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();
        expect(typeof iterator.next).toBe("function");
      });
    });

    it("should iterate over all rows", () => {
      conn.prepare("SELECT name FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();

        const names: any[] = [];
        let result;
        while (!(result = iterator.next()).done) {
          if (typeof result.value === "object") {
            names.push((result.value as any).name);
          }
        }

        expect(names).toContain("Alice");
        expect(names).toContain("Bob");
        expect(names).toContain("Charlie");
      });
    });

    it("should handle empty result set iteration", () => {
      conn.prepare("SELECT * FROM users WHERE id > ?", (stmt) => {
        const rows = stmt.query([999]);
        const iterator = rows.iterate();
        const result = iterator.next();

        expect(result.done).toBe(true);
      });
    });

    it("should iterate once per row", () => {
      conn.prepare("SELECT id FROM users", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();

        let count = 0;
        let result;
        while (!(result = iterator.next()).done) {
          count++;
        }

        expect(count).toBe(3);
      });
    });
  });

  describe("Rows - Integration", () => {
    it("should provide multiple ways to access data", () => {
      conn.prepare("SELECT name FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);

        // Via get()
        const row0 = rows.get(0) as any;
        expect(row0?.name).toBe("Alice");

        // Via toJSON()
        const json = rows.toJSON();
        expect(json).toBeDefined();

        // Via iterate()
        const iterator = rows.iterate();
        const firstRow = iterator.next().value;
        expect(typeof firstRow).toBe("object");
      });
    });

    it("should handle large result sets", () => {
      conn.execute("DELETE FROM users", []);
      for (let i = 0; i < 100; i++) {
        conn.execute("INSERT INTO users (name, age) VALUES (?, ?)", [
          `User${i}`,
          20 + i,
        ]);
      }

      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);

        // Should be able to access by index
        const row50 = rows.get(50);
        expect(row50).not.toBeNull();

        // Should have valid iterator
        const iterator = rows.iterate();
        let count = 0;
        let result;
        while (!(result = iterator.next()).done) {
          count++;
        }
        expect(count).toBe(100);
      });
    });
  });
});
