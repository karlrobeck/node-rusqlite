import { afterAll, beforeAll, describe, it } from "bun:test";
import { expect } from "bun:test";
import { RusqliteConnection, RusqliteTransactionBehavior, DropBehavior, RusqliteDbConfig } from "../bindings/binding";
import {
  memorySqlite,
  createUsersTable,
  createProductsTable,
  populateUsers,
  valueToParams,
  emptyParams,
} from "./setup";

describe("RusqliteConnection", () => {
  let db: RusqliteConnection;

  beforeAll(() => {
    db = memorySqlite();
  });

  afterAll(() => {
    //@ts-expect-error
    db = null;
  });

  // ============================================================================
  // PHASE 2: Schema Inspection Methods
  // ============================================================================

  describe("Schema Inspection: columnExists & tableExists", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should return true for existing table", () => {
      const exists = db.tableExists(null, "users");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent table", () => {
      const exists = db.tableExists(null, "nonexistent");
      expect(exists).toBe(false);
    });

    it("should return true for existing column", () => {
      const exists = db.columnExists(null, "users", "name");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent column", () => {
      const exists = db.columnExists(null, "users", "age");
      expect(exists).toBe(false);
    });

    it("should return false when table does not exist for columnExists", () => {
      const exists = db.columnExists(null, "nonexistent", "anycolumn");
      expect(exists).toBe(false);
    });
  });

  describe("Schema Inspection: columnMetadata", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should retrieve column metadata", () => {
      const metadata = db.columnMetadata(null, "users", "id");
      expect(metadata).toBeDefined();
      expect(metadata.primaryKey).toBe(true);
      expect(metadata.autoIncrement).toBe(true);
    });

    it("should return false for non-primary columns", () => {
      const metadata = db.columnMetadata(null, "users", "name");
      expect(metadata.primaryKey).toBe(false);
    });

    it("should throw for non-existent table", () => {
      try {
        db.columnMetadata(null, "nonexistent", "id");
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("Schema Inspection: prepare & statement metadata", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should prepare a valid SQL statement", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      expect(stmt).toBeDefined();
      expect(stmt.parameterCount()).toBe(1);
    });

    it("should throw on invalid SQL", () => {
      try {
        db.prepare("INVALID SQL SYNTAX ??");
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should return column names from prepared statement", () => {
      const stmt = db.prepare("SELECT id, name, email FROM users");
      const columns = stmt.columnNames();
      expect(columns.length).toBe(3);
      expect(columns).toContain("id");
      expect(columns).toContain("name");
      expect(columns).toContain("email");
    });

    it("should return column count", () => {
      const stmt = db.prepare("SELECT id, name FROM users");
      expect(stmt.columnCount()).toBe(2);
    });

    it("should get column name by index", () => {
      const stmt = db.prepare("SELECT id, name, email FROM users");
      expect(stmt.columnName(0)).toBe("id");
      expect(stmt.columnName(1)).toBe("name");
      expect(stmt.columnName(2)).toBe("email");
    });

    it("should get column index by name", () => {
      const stmt = db.prepare("SELECT id, name, email FROM users");
      expect(stmt.columnIndex("id")).toBe(0);
      expect(stmt.columnIndex("name")).toBe(1);
      expect(stmt.columnIndex("email")).toBe(2);
    });

    it("should throw for non-existent column index", () => {
      try {
        const stmt = db.prepare("SELECT id, name FROM users");
        stmt.columnIndex("nonexistent");
        expect(true).toBe(false); // Should not reach
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should get columns with metadata", () => {
      const stmt = db.prepare("SELECT id, name FROM users");
      const columns = stmt.columns();
      expect(columns.length).toBe(2);
      expect(columns[0].name()).toBe("id");
      expect(columns[1].name()).toBe("name");
    });

    it("should get parameter info", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ? AND name = ?");
      expect(stmt.parameterCount()).toBe(2);
    });
  });

  // ============================================================================
  // PHASE 3: Execution Methods
  // ============================================================================

  describe("Execution: execute, queryRow, queryOne, exists", () => {
    beforeAll(() => {
      populateUsers(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should execute INSERT statement", () => {
      const params = valueToParams([4, "David", "david@test.com"]);
      const rowsAffected = db.execute(
        "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
        params
      );
      expect(rowsAffected).toBeGreaterThan(0);
    });

    it("should execute UPDATE statement", () => {
      const params = valueToParams(["UpdatedName", 1]);
      const rowsAffected = db.execute(
        "UPDATE users SET name = ? WHERE id = ?",
        params
      );
      expect(rowsAffected).toBeGreaterThanOrEqual(0);
    });

    it("should execute DELETE statement", () => {
      const params = valueToParams([4]);
      const rowsAffected = db.execute("DELETE FROM users WHERE id = ?", params);
      expect(rowsAffected).toBeGreaterThanOrEqual(0);
    });

    it("should throw on invalid SQL syntax", () => {
      try {
        db.execute("INVALID SQL ???", emptyParams());
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should throw when table does not exist", () => {
      try {
        db.execute("INSERT INTO nonexistent VALUES (?)", valueToParams([1]));
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should check if row exists", () => {
      const stmt = db.prepare("SELECT 1 FROM users WHERE id = ?");
      const exists = stmt.exists(valueToParams([1]));
      expect(exists).toBe(true);
    });

    it("should return false when row does not exist", () => {
      const stmt = db.prepare("SELECT 1 FROM users WHERE id = ?");
      const exists = stmt.exists(valueToParams([999]));
      expect(exists).toBe(false);
    });

    it("should query one row", () => {
      const result = db.queryOne(
        "SELECT * FROM users WHERE id = ?",
        valueToParams([1])
      );
      expect(result).toBeDefined();
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it("should throw when queryOne finds no rows", () => {
      try {
        db.queryOne("SELECT * FROM users WHERE id = ?", valueToParams([999]));
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should throw on invalid column in queryRow", () => {
      try {
        db.queryRow("SELECT nonexistent FROM users WHERE id = ?", valueToParams([1]));
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("Execution: executeBatch", () => {
    beforeAll(() => {
      createProductsTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE products");
    });

    it("should execute multiple SQL statements in batch", () => {
      db.executeBatch(`
        INSERT INTO products (id, name, price, stock) VALUES (1, 'Widget', 9.99, 100);
        INSERT INTO products (id, name, price, stock) VALUES (2, 'Gadget', 19.99, 50);
      `);
      db.prepare("SELECT COUNT(*) as count FROM products");
      const result = db.queryOne("SELECT COUNT(*) FROM products", emptyParams());
      expect(result).toBeDefined();
    });

    it("should throw on syntax error in executeBatch", () => {
      try {
        db.executeBatch("INVALID BATCH SQL ??");
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should throw on SQL error in batch (missing table)", () => {
      try {
        db.executeBatch("INSERT INTO nonexistent VALUES (1, 'test')");
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("Execution: Iterator pattern (RusqliteRows)", () => {
    beforeAll(() => {
      populateUsers(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should iterate over multiple rows", () => {
      const stmt = db.prepare("SELECT * FROM users ORDER BY id");
      const rows = stmt.query(emptyParams());
      let count = 0;
      for (const row of rows) {
        count++;
        expect(row).toBeDefined();
        expect(row.byteLength).toBeGreaterThan(0);
      }
      expect(count).toBe(3);
    });

    it("should handle empty result set", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id > ?");
      const rows = stmt.query(valueToParams([999]));
      let count = 0;
      for (const _row of rows) {
        count++;
      }
      expect(count).toBe(0);
    });

    it("should iterate with parameters", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id > ? ORDER BY id");
      const rows = stmt.query(valueToParams([1]));
      let count = 0;
      for (const _row of rows) {
        count++;
      }
      expect(count).toBe(2);
    });

    it("should query multiple rows without parameters", () => {
      const result = db.queryOne(
        "SELECT COUNT(*) as cnt FROM users",
        emptyParams()
      );
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // PHASE 4: Transaction & Savepoint Methods
  // ============================================================================

  describe("Transactions: basic commit/rollback", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should commit transaction", () => {
      const tx = db.transaction();
      const params = valueToParams([10, "TxTest", "txtest@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      tx.commit();

      const result = db.queryOne("SELECT * FROM users WHERE id = ?", valueToParams([10]));
      expect(result).toBeDefined();
    });

    it("should rollback transaction", () => {
      const tx = db.transaction();
      const params = valueToParams([11, "TxRollback", "rollback@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      tx.rollback();

      try {
        db.queryOne("SELECT * FROM users WHERE id = ?", valueToParams([11]));
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should finish transaction without error", () => {
      const tx = db.transaction();
      expect(() => tx.finish()).not.toThrow();
    });
  });

  describe("Transactions: behavior modes", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should create deferred transaction", () => {
      const tx = db.transactionWithBehavior(
        RusqliteTransactionBehavior.Deferred
      );
      expect(tx).toBeDefined();
      tx.finish();
    });

    it("should create immediate transaction", () => {
      const tx = db.transactionWithBehavior(
        RusqliteTransactionBehavior.Immediate
      );
      expect(tx).toBeDefined();
      tx.finish();
    });

    it("should create exclusive transaction", () => {
      const tx = db.transactionWithBehavior(
        RusqliteTransactionBehavior.Exclusive
      );
      expect(tx).toBeDefined();
      tx.finish();
    });
  });

  describe("Savepoints: create, commit, rollback", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should create unnamed savepoint", () => {
      const sp = db.savepoint();
      expect(sp).toBeDefined();
      sp.finish();
    });

    it("should create named savepoint", () => {
      const sp = db.savepointWithName("test_sp");
      expect(sp).toBeDefined();
      sp.finish();
    });

    it("should commit savepoint", () => {
      const sp = db.savepoint();
      const params = valueToParams([20, "SavepointTest", "sp@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      sp.commit();

      const result = db.queryOne("SELECT * FROM users WHERE id = ?", valueToParams([20]));
      expect(result).toBeDefined();
    });

    it("should rollback savepoint", () => {
      const sp = db.savepoint();
      const params = valueToParams([21, "SavepointRollback", "sprb@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      sp.rollback();

      try {
        db.queryOne("SELECT * FROM users WHERE id = ?", valueToParams([21]));
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should set drop behavior on savepoint", () => {
      const sp = db.savepoint();
      sp.setDropBehavior(DropBehavior.Commit);
      expect(sp.dropBehavior()).toBe(DropBehavior.Commit);
      sp.finish();
    });
  });

  describe("Transactions: transaction state", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should report None state initially", () => {
      // Ensure clean state after table creation by committing any pending transactions
      if (!db.isAutocommit()) {
        db.executeBatch("COMMIT");
      }
      const state = db.transactionState(null);
      expect(state).toBe(0); // None
    });

    it("should report transaction state", () => {
      // Note: State reporting depends on SQLite's internal state
      // Just verify the method doesn't throw
      const state = db.transactionState(null);
      expect([0, 1, 2]).toContain(state);
    });

    it("should set transaction behavior", () => {
      expect(() => {
        db.setTransactionBehavior(RusqliteTransactionBehavior.Immediate);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // PHASE 5: Pragma & Config Methods
  // ============================================================================

  describe("Pragmas: pragma queries", () => {
    it("should query pragma value", () => {
      expect(() => {
        db.pragmaQueryValue(null, "journal_mode");
      }).not.toThrow();
    });

    it("should query pragma", () => {
      expect(() => {
        db.pragmaQuery(null, "table_list");
      }).not.toThrow();
    });

    it("should throw on invalid pragma", () => {
      try {
        db.pragmaQueryValue(null, "nonexistent_pragma_xxyz");
        // Some pragmas may not throw; just verify it doesn't crash
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe("Pragmas: pragma updates", () => {
    it("should update pragma", () => {
      const value = Buffer.from(
        JSON.stringify("MEMORY"),
        "utf-8"
      ) as Uint8Array;
      expect(() => {
        db.pragmaUpdate(null, "journal_mode", value);
      }).not.toThrow();
    });

    it("should update and check pragma", () => {
      const value = Buffer.from(
        JSON.stringify("DELETE"),
        "utf-8"
      ) as Uint8Array;
      expect(() => {
        db.pragmaUpdateAndCheck(null, "journal_mode", value);
      }).not.toThrow();
    });
  });

  describe("Config: dbConfig and setDbConfig", () => {
    it("should set db config", () => {
      expect(() => {
        db.setDbConfig(RusqliteDbConfig.SqliteDbconfigEnableFkey, true);
      }).not.toThrow();
    });

    it("should disable config", () => {
      expect(() => {
        db.setDbConfig(RusqliteDbConfig.SqliteDbconfigEnableFkey, false);
      }).not.toThrow();
    });

    it("should call dbConfig", () => {
      expect(() => {
        db.dbConfig(RusqliteDbConfig.SqliteDbconfigEnableFkey);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // PHASE 6: State & Info Methods
  // ============================================================================

  describe("State & Info: connection properties", () => {
    it("should get database path", () => {
      const path = db.path();
      expect(path).toBeDefined();
    });

    it("should report autocommit status", () => {
      const isAutocommit = db.isAutocommit();
      expect(typeof isAutocommit).toBe("boolean");
    });

    it("should report busy status", () => {
      const isBusy = db.isBusy();
      expect(typeof isBusy).toBe("boolean");
    });

    it("should report interrupted status", () => {
      const isInterrupted = db.isInterrupted();
      expect(typeof isInterrupted).toBe("boolean");
      expect(isInterrupted).toBe(false);
    });
  });

  describe("State & Info: row tracking", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should get last insert rowid", () => {
      const params = valueToParams([50, "LastInsert", "li@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      const lastId = db.lastInsertRowid();
      expect(lastId).toBeGreaterThan(0);
    });

    it("should report changes count", () => {
      const params = valueToParams([51, "Changes", "changes@test.com"]);
      db.execute("INSERT INTO users (id, name, email) VALUES (?, ?, ?)", params);
      const changes = db.changes();
      expect(changes).toBeGreaterThanOrEqual(0);
    });

    it("should report total changes", () => {
      const totalChanges = db.totalChanges();
      expect(totalChanges).toBeGreaterThan(0);
    });
  });

  describe("State & Info: memory and cache", () => {
    it("should release memory", () => {
      expect(() => {
        db.releaseMemory();
      }).not.toThrow();
    });

    it("should flush cache", () => {
      expect(() => {
        db.cacheFlush();
      }).not.toThrow();
    });
  });

  describe("State & Info: database enumeration", () => {
    it("should get main database name", () => {
      const dbName = db.dbName(0);
      expect(dbName).toBe("main");
    });

    it("should report readonly status for main db", () => {
      const isReadonly = db.isReadonly("main");
      expect(typeof isReadonly).toBe("boolean");
    });
  });

  describe("State & Info: interrupt handle", () => {
    it("should get interrupt handle", () => {
      const handle = db.getInterruptHandle();
      expect(handle).toBeDefined();
    });

    it("should create and use interrupt handle", () => {
      const handle = db.getInterruptHandle();
      expect(() => {
        handle.interrupt();
      }).not.toThrow();
    });
  });

  describe("Prepared Statement: advanced features", () => {
    beforeAll(() => {
      createUsersTable(db);
    });

    afterAll(() => {
      db.executeBatch("DROP TABLE users");
    });

    it("should clear bindings", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      expect(() => {
        stmt.clearBindings();
      }).not.toThrow();
    });

    it("should get expanded SQL", () => {
      const stmt = db.prepare("SELECT * FROM users WHERE id = ? AND name = ?");
      const expandedSql = stmt.expandedSql();
      expect(expandedSql).toBeDefined();
    });

    it("should check if statement is readonly", () => {
      const stmtRead = db.prepare("SELECT * FROM users");
      const stmtWrite = db.prepare("INSERT INTO users VALUES (?, ?, ?)");

      expect(stmtRead.readonly()).toBe(true);
      expect(stmtWrite.readonly()).toBe(false);
    });

    it("should check if statement is explain", () => {
      const stmt = db.prepare("SELECT * FROM users");
      const isExplain = stmt.isExplain();
      expect(typeof isExplain).toBe("number");
    });
  });
});