import { expect } from "@std/expect";
// @ts-types="../bindings/binding.d.ts"
import {
  Connection,
  DropBehavior,
  TransactionBehavior,
} from "../bindings/binding.js";

let conn: Connection;

Deno.test.beforeEach(() => {
  conn = Connection.openInMemory();
  conn.execute(
    "CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)",
    [],
  );
  conn.execute("INSERT INTO accounts (balance) VALUES (100)", []);
  conn.execute("INSERT INTO accounts (balance) VALUES (200)", []);
});

Deno.test("transaction basic commit", () => {
  const tx = conn.transaction();
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  tx.commit();

  const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
  expect((count as any).count).toBe(3);
});

Deno.test("transaction explicit rollback", () => {
  const tx = conn.transaction();
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  tx.rollback();

  const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
  expect((count as any).count).toBe(2);
});

Deno.test("transaction double commit guard", () => {
  const tx = conn.transaction();
  tx.commit();
  expect(() => tx.commit()).toThrow();
});

Deno.test("transaction double rollback guard", () => {
  const tx = conn.transaction();
  tx.rollback();
  expect(() => tx.rollback()).toThrow();
});

Deno.test("transaction DropBehavior.Commit auto-commits via dispose()", () => {
  const tx = conn.transaction({ dropBehavior: DropBehavior.Commit });
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  tx.dispose();

  const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
  expect((count as any).count).toBe(3);
});

Deno.test("transaction dispose() with default behavior rolls back", () => {
  const tx = conn.transaction();
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  tx.dispose();

  const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
  expect((count as any).count).toBe(2);
});

Deno.test("transaction dropBehavior / setDropBehavior accessors", () => {
  const tx = conn.transaction({ dropBehavior: DropBehavior.Commit });
  expect(tx.dropBehavior()).toBe(DropBehavior.Commit);
  tx.setDropBehavior(DropBehavior.Rollback);
  expect(tx.dropBehavior()).toBe(DropBehavior.Rollback);
  tx.rollback();
});

Deno.test("transaction TransactionBehavior.Deferred", () => {
  conn.transaction({ behavior: TransactionBehavior.Deferred }).commit();
});

Deno.test("transaction TransactionBehavior.Immediate", () => {
  conn.transaction({ behavior: TransactionBehavior.Immediate }).commit();
});

Deno.test("transaction TransactionBehavior.Exclusive", () => {
  conn.transaction({ behavior: TransactionBehavior.Exclusive }).commit();
});

Deno.test("transaction delegated executeBatch", () => {
  const tx = conn.transaction();
  tx.executeBatch("INSERT INTO accounts (balance) VALUES (300)");
  tx.commit();

  const count = conn.queryRow("SELECT COUNT(*) as count FROM accounts", []);
  expect((count as any).count).toBe(3);
});

Deno.test("transaction delegated changes", () => {
  const tx = conn.transaction();
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  expect(tx.changes()).toBe(1);
  tx.rollback();
});

Deno.test("transaction delegated lastInsertRowid", () => {
  const tx = conn.transaction();
  tx.execute("INSERT INTO accounts (balance) VALUES (300)", []);
  const rowid = tx.lastInsertRowid();
  expect(typeof rowid).toBe("number");
  tx.rollback();
});

Deno.test("transaction delegated isAutocommit", () => {
  const tx = conn.transaction();
  expect(tx.isAutocommit()).toBe(false);
  tx.rollback();
});

Deno.test("transaction delegated queryRow", () => {
  const tx = conn.transaction();
  const row = tx.queryRow("SELECT * FROM accounts WHERE id = 1", []);
  expect((row as any).balance).toBe(100);
  tx.rollback();
});

Deno.test("transaction delegated queryOne", () => {
  const tx = conn.transaction();
  const row = tx.queryOne("SELECT * FROM accounts WHERE id = 1", []);
  expect((row as any).balance).toBe(100);
  tx.rollback();
});

Deno.test("transaction delegated columnExists", () => {
  const tx = conn.transaction();
  expect(tx.columnExists(null, "accounts", "id")).toBe(true);
  tx.rollback();
});

Deno.test("transaction delegated tableExists", () => {
  const tx = conn.transaction();
  expect(tx.tableExists(null, "accounts")).toBe(true);
  tx.rollback();
});

Deno.test("transaction delegated transactionState", () => {
  const tx = conn.transaction();
  const state = tx.transactionState();
  expect(typeof state).toBe("number");
  tx.rollback();
});

Deno.test("transaction delegated prepare with callback", () => {
  const tx = conn.transaction();
  tx.prepare("SELECT * FROM accounts WHERE id = ?", (stmt) => {
    const rows = stmt.query([1]);
    expect(rows).toBeDefined();
  });
  tx.rollback();
});
