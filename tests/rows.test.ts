import { expect } from "@std/expect";
import { Connection } from "../bindings/binding.js";

  let conn: Connection;

  Deno.test.beforeEach(() => {
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

  Deno.test("rows.toJSON()", async (t) => {
    await t.step("should convert rows to JSON representation", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      expect(json).toBeDefined();
    });

    await t.step("should return an array-like structure", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      // toJSON should return something that can be serialized
      expect(() => JSON.stringify(json)).not.toThrow();
    });

    await t.step("should preserve row data", () => {
      let json: any;
      conn.prepare("SELECT name, age FROM users WHERE id = 1", (stmt) => {
        const rows = stmt.query([]);
        json = rows.toJSON();
      });
      // Should be able to convert to JSON
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).toContain("Alice");
    });

    await t.step("should handle empty result set", () => {
      let json: unknown;
      conn.prepare("SELECT * FROM users WHERE id > ?", (stmt) => {
        const rows = stmt.query([999]);
        json = rows.toJSON();
      });
      expect(json).toBeDefined();
    });

    await t.step("should handle multiple rows", () => {
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

  Deno.test("rows.get()", async (t) => {
    await t.step("should return row at index 0", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(0);
      });
      expect(row).toBeDefined();
      expect(typeof row).toBe("object");
    });

    await t.step("should return row at specified index", () => {
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

    await t.step("should return null for out of bounds index", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(999);
      });
      expect(row).toBeNull();
    });

    await t.step("should return null for negative index", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        row = rows.get(-1);
      });
      expect(row).toBeNull();
    });

    await t.step("should allow accessing multiple rows", () => {
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

    await t.step("should return data consistent with iteration", () => {
      conn.prepare("SELECT id FROM users ORDER BY id", (stmt) => {
        const rows = stmt.query([]);

        // Using get
        const row0 = rows.get(0) as any;
        const row1 = rows.get(1) as any;

        expect(row0?.id).toBe(1);
        expect(row1?.id).toBe(2);
      });
    });

    await t.step("should handle single row result", () => {
      let row: unknown;
      conn.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
        const rows = stmt.query([1]);
        row = rows.get(0);
      });
      expect(row).toBeDefined();
      expect((row as any)?.name).toBe("Alice");
    });
  });

  Deno.test("rows.iterate()", async (t) => {
    await t.step("should return a RowIterator", () => {
      let iterator: any;
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        iterator = rows.iterate();
      });
      expect(iterator).toBeDefined();
    });

    await t.step("should create an iterator with next() method", () => {
      conn.prepare("SELECT * FROM users", (stmt) => {
        const rows = stmt.query([]);
        const iterator = rows.iterate();
        expect(typeof iterator.next).toBe("function");
      });
    });

    await t.step("should iterate over all rows", () => {
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

    await t.step("should handle empty result set iteration", () => {
      conn.prepare("SELECT * FROM users WHERE id > ?", (stmt) => {
        const rows = stmt.query([999]);
        const iterator = rows.iterate();
        const result = iterator.next();

        expect(result.done).toBe(true);
      });
    });

    await t.step("should iterate once per row", () => {
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

  Deno.test("Rows - Integration", async (t) => {
    await t.step("should provide multiple ways to access data", () => {
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

    await t.step("should handle large result sets", () => {
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
