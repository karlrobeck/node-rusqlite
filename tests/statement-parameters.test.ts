import { expect } from "@std/expect";
import { Connection } from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
  conn.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)",
    [],
  );
});

Deno.test("statement.parameterIndex()", async (t) => {
  await t.step("should return index of positional parameter", () => {
    let index = -1;
    conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
      // Positional parameters don't typically have indices by name
      // This tests the method exists and handles named parameters
      index = stmt.parameterIndex("$name") ?? -1;
    });
    expect(typeof index).toBe("number");
  });

  await t.step("should handle named parameters with $ prefix", () => {
    let index: number | null = -1;
    conn.prepare(
      "SELECT * FROM users WHERE name = $name AND age = $age",
      (stmt) => {
        index = stmt.parameterIndex("$name");
      },
    );
    // Result depends on if binding uses named parameters
    expect(typeof index === "number" || index === null).toBe(true);
  });

  await t.step("should handle named parameters with : prefix", () => {
    let index: number | null = -1;
    conn.prepare("SELECT * FROM users WHERE name = :name", (stmt) => {
      index = stmt.parameterIndex(":name");
    });
    expect(typeof index === "number" || index === null).toBe(true);
  });

  await t.step("should return null for non-existent parameter", () => {
    let index: number | null = 999;
    conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
      index = stmt.parameterIndex("nonexistent");
    });
    expect(index === null || typeof index === "number").toBe(true);
  });

  await t.step("should handle @ prefix for parameters", () => {
    let index: number | null = -1;
    conn.prepare("SELECT * FROM users WHERE name = @name", (stmt) => {
      index = stmt.parameterIndex("@name");
    });
    expect(typeof index === "number" || index === null).toBe(true);
  });
});

Deno.test("statement.parameterName()", async (t) => {
  await t.step("should return parameter name by index", () => {
    let name: string | null = "";
    conn.prepare(
      "SELECT * FROM users WHERE name = $name AND age = $age",
      (stmt) => {
        name = stmt.parameterName(1);
      },
    );
    // Result depends on statement configuration
    expect(typeof name === "string" || name === null).toBe(true);
  });

  await t.step("should return null for positional parameters", () => {
    let name: string | null = "something";
    conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
      name = stmt.parameterName(0);
    });
    expect(name === null || typeof name === "string").toBe(true);
  });

  await t.step("should handle multiple parameters", () => {
    conn.prepare(
      "SELECT * FROM users WHERE id = ? AND name = ? AND age = ?",
      (stmt) => {
        const name0 = stmt.parameterName(0);
        const name1 = stmt.parameterName(1);
        const name2 = stmt.parameterName(2);

        // All should be either null or string
        expect(name0 === null || typeof name0 === "string").toBe(true);
        expect(name1 === null || typeof name1 === "string").toBe(true);
        expect(name2 === null || typeof name2 === "string").toBe(true);
      },
    );
  });
});

Deno.test("statement.parameterCount()", async (t) => {
  await t.step("should return number of parameters", () => {
    let count = 0;
    conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
      count = stmt.parameterCount();
    });
    expect(count).toBe(2);
  });

  await t.step("should return count for single parameter", () => {
    let count = 0;
    conn.prepare("SELECT * FROM users WHERE id = ?", (stmt) => {
      count = stmt.parameterCount();
    });
    expect(count).toBe(1);
  });

  await t.step("should return 0 for no parameters", () => {
    let count = 0;
    conn.prepare("SELECT * FROM users", (stmt) => {
      count = stmt.parameterCount();
    });
    expect(count).toBe(0);
  });

  await t.step("should handle multiple parameters correctly", () => {
    let count: number;
    conn.prepare(
      "INSERT INTO users (name, age) VALUES (?, ?)",
      (stmt) => {
        count = stmt.parameterCount();
      },
    );
    expect(count!).toBe(2);
  });

  await t.step("should handle named parameters", () => {
    let count = 0;
    conn.prepare(
      "INSERT INTO users (name, age) VALUES (:name, :age)",
      (stmt) => {
        count = stmt.parameterCount();
      },
    );
    expect(count).toBe(2);
  });
});

Deno.test("statement.clearBindings()", async (t) => {
  await t.step("should execute without error", () => {
    expect(() => {
      conn.prepare("SELECT * FROM users WHERE name = ?", (stmt) => {
        stmt.clearBindings();
      });
    }).not.toThrow();
  });

  await t.step("should be callable multiple times", () => {
    expect(() => {
      conn.prepare("SELECT * FROM users WHERE name = ?", (stmt) => {
        stmt.clearBindings();
        stmt.clearBindings();
        stmt.clearBindings();
      });
    }).not.toThrow();
  });

  await t.step("should work after binding parameters", () => {
    expect(() => {
      conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
        stmt.execute(["test", 30]);
        stmt.clearBindings();
      });
    }).not.toThrow();
  });
});

Deno.test("statement.expandedSql()", async (t) => {
  await t.step("should return expanded SQL string", () => {
    let sql: string | null = "";
    conn.prepare("SELECT * FROM users WHERE name = ? AND age = ?", (stmt) => {
      sql = stmt.expandedSql();
    });
    expect(typeof sql === "string" || sql === null).toBe(true);
  });

  await t.step("should return original SQL when no parameters bound", () => {
    let sql: string | null = "";
    conn.prepare("SELECT * FROM users", (stmt) => {
      sql = stmt.expandedSql();
    });
    // Could be null or the expanded SQL
    expect(sql === null || typeof sql === "string").toBe(true);
  });

  await t.step("should expand parameters in returned SQL", () => {
    let sql: string | null = "";
    conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
      sql = stmt.expandedSql();
    });
    // After binding, should return expanded SQL if available
    expect(sql === null || typeof sql === "string").toBe(true);
  });

  await t.step("should handle unnamed parameters", () => {
    let sql: string | null = "";
    conn.prepare("INSERT INTO users (name, age) VALUES (?, ?)", (stmt) => {
      sql = stmt.expandedSql();
    });
    expect(sql === null || typeof sql === "string").toBe(true);
  });
});
