import { RusqliteConnection } from "../bindings/binding";

export const memorySqlite = () => RusqliteConnection.openInMemory();

/**
 * Helper: Create users table with id (primary key), name, email
 */
export const createUsersTable = (db: RusqliteConnection) => {
  db.executeBatch(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE
    )
  `);
};

/**
 * Helper: Create orders table with foreign key to users
 */
export const createOrdersTable = (db: RusqliteConnection) => {
  createUsersTable(db);
  db.executeBatch(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
};

/**
 * Helper: Populate users table with sample data
 */
export const populateUsers = (db: RusqliteConnection) => {
  createUsersTable(db);
  const users = [
    { id: 1, name: "Alice", email: "alice@test.com" },
    { id: 2, name: "Bob", email: "bob@test.com" },
    { id: 3, name: "Charlie", email: "charlie@test.com" },
  ];
  users.forEach((user) => {
    const params = valueToParams([user.id, user.name, user.email]);
    db.execute(
      "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
      params
    );
  });
};

/**
 * Helper: Create a simple products table with constraints
 */
export const createProductsTable = (db: RusqliteConnection) => {
  db.executeBatch(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL CHECK(price > 0),
      stock INTEGER NOT NULL DEFAULT 0
    )
  `);
};

/**
 * Helper: Convert value array to Uint8Array buffer
 * Pattern: Directly pass values (no wrapper) -> JSON.stringify -> Buffer.from(string, 'utf-8')
 * Examples: valueToParams([1, "hello", 3.14, null])
 */
export const valueToParams = (values: unknown[]): Uint8Array => {
  if (!values || values.length === 0) return new Uint8Array();
  return Buffer.from(JSON.stringify(values), "utf-8") as Uint8Array;
};

/**
 * Helper: Empty params buffer
 */
export const emptyParams = (): Uint8Array => new Uint8Array();