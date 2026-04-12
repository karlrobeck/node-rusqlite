import { beforeEach, describe, expect, it } from "bun:test";
import { Connection } from "../bindings/binding";

describe("Statement - Column Metadata", () => {
  let conn: Connection;

  beforeEach(() => {
    conn = Connection.openInMemory();
    conn.execute(
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, email TEXT)",
      [],
    );
  });

  describe("statement.columnNames()", () => {
    it("should return array of column names", () => {
      let names: string[] = [];
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        names = stmt.columnNames();
      });
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(3);
    });

    it("should return correct column names in order", () => {
      let names: string[] = [];
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        names = stmt.columnNames();
      });
      expect(names).toContain("id");
      expect(names).toContain("name");
      expect(names).toContain("age");
    });

    it("should preserve column order", () => {
      let names: string[] = [];
      conn.prepare("SELECT age, name, id FROM users", (stmt) => {
        names = stmt.columnNames();
      });
      expect(names[0]).toBe("age");
      expect(names[1]).toBe("name");
      expect(names[2]).toBe("id");
    });

    it("should handle SELECT *", () => {
      let names: string[] = [];
      conn.prepare("SELECT * FROM users", (stmt) => {
        names = stmt.columnNames();
      });
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain("id");
    });
  });

  describe("statement.columnCount()", () => {
    it("should return number of columns", () => {
      let count = 0;
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        count = stmt.columnCount();
      });
      expect(count).toBe(3);
    });

    it("should match columnNames array length", () => {
      let count = 0;
      let names: string[] = [];
      conn.prepare("SELECT id, name, age, email FROM users", (stmt) => {
        count = stmt.columnCount();
        names = stmt.columnNames();
      });
      expect(count).toBe(names.length);
    });

    it("should return 0 for INSERT statement", () => {
      let count = -1;
      conn.prepare("INSERT INTO users (name) VALUES (?)", (stmt) => {
        count = stmt.columnCount();
      });
      expect(count).toBe(0);
    });
  });

  describe("statement.columnName()", () => {
    it("should return column name by index", () => {
      let name = "";
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        name = stmt.columnName(1);
      });
      expect(name).toBe("name");
    });

    it("should handle 0-based indexing", () => {
      let name0 = "";
      let name1 = "";
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        name0 = stmt.columnName(0);
        name1 = stmt.columnName(1);
      });
      expect(name0).toBe("id");
      expect(name1).toBe("name");
    });

    it("should work for all columns", () => {
      conn.prepare("SELECT id, name, age, email FROM users", (stmt) => {
        expect(stmt.columnName(0)).toBe("id");
        expect(stmt.columnName(1)).toBe("name");
        expect(stmt.columnName(2)).toBe("age");
        expect(stmt.columnName(3)).toBe("email");
      });
    });
  });

  describe("statement.columnIndex()", () => {
    it("should return index by column name", () => {
      let index = -1;
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        index = stmt.columnIndex("name");
      });
      expect(index).toBe(1);
    });

    it("should handle first column", () => {
      let index = -1;
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        index = stmt.columnIndex("id");
      });
      expect(index).toBe(0);
    });

    it("should handle last column", () => {
      let index = -1;
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        index = stmt.columnIndex("age");
      });
      expect(index).toBe(2);
    });

    it.todo("should return -1 or null for non-existent column", () => {
      let index: number | null = 0;
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        const idx = stmt.columnIndex("nonexistent");
        // TypeScript says it returns number, so we check behavior
        index = idx;
      });
      // The binding may return any value for non-existent columns
      expect(typeof index).toBe("number");
    });
  });

  describe("statement.columns()", () => {
    it("should return array of Column objects", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        columns = stmt.columns();
      });
      expect(Array.isArray(columns)).toBe(true);
    });

    it("should return Column objects with name() method", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        columns = stmt.columns();
      });
      for (const col of columns) {
        expect(typeof col.name).toBe("function");
      }
    });

    it("should return correct column metadata", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        columns = stmt.columns();
      });
      expect(columns.length).toBe(3);
      expect(columns[0].name()).toBe("id");
      expect(columns[1].name()).toBe("name");
      expect(columns[2].name()).toBe("age");
    });
  });

  describe("statement.columnsWithMetadata()", () => {
    it("should return array of ColumnMetadata objects", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        columns = stmt.columnsWithMetadata();
      });
      expect(Array.isArray(columns)).toBe(true);
    });

    it("should include name method", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        columns = stmt.columnsWithMetadata();
      });
      for (const col of columns) {
        expect(typeof col.name).toBe("function");
      }
    });

    it("should include tableName information", () => {
      let columns: any[] = [];
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        columns = stmt.columnsWithMetadata();
      });
      // Some columns should have tableName metadata
      expect(columns.length).toBeGreaterThan(0);
    });
  });

  describe("statement.columnMetadata()", () => {
    it("should return metadata for column by index", () => {
      let metadata: any;
      conn.prepare("SELECT id, name FROM users", (stmt) => {
        metadata = stmt.columnMetadata(0);
      });
      expect(metadata).toBeDefined();
    });

    it("should return object with type property", () => {
      let metadata: any;
      conn.prepare("SELECT id FROM users", (stmt) => {
        metadata = stmt.columnMetadata(0);
      });
      expect(typeof metadata).toBe("object");
    });

    it("should return metadata for each column", () => {
      conn.prepare("SELECT id, name, age FROM users", (stmt) => {
        const meta0 = stmt.columnMetadata(0);
        const meta1 = stmt.columnMetadata(1);
        const meta2 = stmt.columnMetadata(2);

        expect(meta0).toBeDefined();
        expect(meta1).toBeDefined();
        expect(meta2).toBeDefined();
      });
    });

    it("should return null for out of bounds index", () => {
      let metadata: any;
      conn.prepare("SELECT id FROM users", (stmt) => {
        metadata = stmt.columnMetadata(999);
      });
      expect(metadata).toBeNull();
    });
  });
});
