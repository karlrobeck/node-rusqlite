/**
 * Example 3: Prepared Statements - Efficient and Secure Query Execution
 *
 * This example demonstrates prepared statements, which are compiled SQL
 * statements that can be executed multiple times with different parameters.
 * You'll learn:
 *
 * - Preparing statements with prepare()
 * - Preparing with custom flags via prepareWithFlags()
 * - Binding parameters (positional ? and named :name)
 * - Executing, inserting, querying, and checking existence
 * - Reusing statements for better performance
 * - Clearing parameter bindings
 */

import { Connection, RusqlitePrepFlags } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data
// ============================================================================

function setup_database(db: Connection) {
  db.execute("DROP TABLE IF EXISTS products", []);
  db.execute(
    `
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL,
      stock INTEGER,
      category TEXT
    )
  `,
    [],
  );

  db.execute(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
    ["Laptop", 1200.00, 5, "Electronics"],
  );
  db.execute(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
    ["Mouse", 25.00, 100, "Electronics"],
  );
  db.execute(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
    ["Desk", 300.00, 10, "Furniture"],
  );
}

// ============================================================================
// BEGINNER: Basic Prepared Statements
// ============================================================================

/**
 * Prepares and executes a simple SELECT statement.
 *
 * BEGINNER:
 * - `prepare()` takes SQL and a callback
 * - The callback receives a prepared statement object
 * - You call execute(), query(), or other methods on the statement
 * - Returns nothing: the callback handles all work
 *
 * INTERMEDIATE:
 * - Prepared statements are compiled by SQLite once
 * - Can be executed multiple times with different parameters
 * - More efficient than string concatenation
 *
 * ADVANCED:
 * - Internally, SQLite compiles the statement to a virtual machine
 * - Reusing statements avoids re-compilation overhead
 * - Perfect for loops or repeated operations
 */
export function example_basic_select(db: Connection) {
  db.prepare("SELECT * FROM products WHERE id = ?", (stmt) => {
    const rows = stmt.query([1]);
    console.log("Row count:", rows.toJSON());
  });
}

/**
 * Prepares and executes an INSERT statement.
 *
 * BEGINNER:
 * - `insert()` on a statement returns the inserted row ID
 * - Similar to `execute()` but specifically for INSERT statements
 *
 * INTERMEDIATE:
 * - getInsert() is cleaner than execute() + lastInsertRowid()
 * - Returns a number (the rowid)
 *
 * ADVANCED:
 * - For bulk inserts, prepare once, insert many times (see loop example)
 */
export function example_prepared_insert(db: Connection): number {
  let insertedId = 0;

  db.prepare(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
    (stmt) => {
      insertedId = stmt.insert(["Keyboard", 99.99, 50, "Electronics"]);
      console.log("Inserted product ID:", insertedId);
    },
  );

  return insertedId;
}

/**
 * Prepares and executes an UPDATE statement.
 *
 * BEGINNER:
 * - `execute()` on a statement updates rows and returns count
 * - Used for UPDATE, DELETE, or other non-SELECT queries
 *
 * INTERMEDIATE:
 * - execute() returns the number of rows affected
 * - Check this return value to confirm the update worked
 *
 * ADVANCED:
 * - Prepared updates are efficient for bulk operations
 */
export function example_prepared_update(db: Connection): boolean {
  let rowsAffected = 0;

  db.prepare("UPDATE products SET price = ? WHERE id = ?", (stmt) => {
    rowsAffected = stmt.execute([1099.99, 1]);
    console.log(`Updated ${rowsAffected} row(s)`);
  });

  return rowsAffected > 0;
}

/**
 * Prepares and executes a EXISTS check.
 *
 * BEGINNER:
 * - `exists()` returns true if the query returns any row
 * - Useful for checking if a record exists
 *
 * INTERMEDIATE:
 * - More efficient than SELECT COUNT(*) for existence checks
 * - Returns boolean
 *
 * ADVANCED:
 * - Use for validation: "Is this email already registered?"
 */
export function example_prepared_exists(db: Connection) {
  let productExists = false;

  db.prepare("SELECT 1 FROM products WHERE id = ?", (stmt) => {
    productExists = stmt.exists([1]);
    console.log("Product with ID 1 exists:", productExists);
  });

  return productExists;
}

// ============================================================================
// INTERMEDIATE: Parameter Binding
// ============================================================================

/**
 * Demonstrates positional parameter binding with ?.
 *
 * BEGINNER:
 * - ? is a placeholder for a value
 * - Values are provided in an array in the same order
 * - First ? gets first array value, second ? gets second, etc.
 *
 * INTERMEDIATE:
 * - Safe from SQL injection because values are never concatenated into SQL
 * - Any type can be used: strings, numbers, booleans (as 1/0), null
 * - SQLite automatically converts types as needed
 *
 * ADVANCED:
 * - When parameters exceed 999, split into multiple statements
 * - Some databases allow LIMIT ? (SQLite does)
 */
export function example_positional_parameters(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE category = ? AND price > ? AND stock > ?",
    (stmt) => {
      // Order matters: category, price, stock
      const rows = stmt.query(["Electronics", 50.0, 10]);
      console.log("Filtered products:", rows.toJSON());
    },
  );
}

/**
 * Demonstrates named parameter binding (:name syntax).
 *
 * BEGINNER:
 * - Named parameters are more readable than positional ?
 * - Syntax: :name, @name, or $name (SQLite accepts all)
 * - Pass an array of values (order matching SQL order)
 *
 * INTERMEDIATE:
 * - Use parameterIndex(name) to find the positional index
 * - Or parameterName(index) to find the name
 * - Names are case-sensitive
 *
 * ADVANCED:
 * - Named parameters make queries self-documenting
 * - Easy to refactor without breaking parameter order
 * - Cannot use the same name multiple times (SQLite limitation)
 */
export function example_named_parameters(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE category = :cat AND price < :max_price",
    (stmt) => {
      // Must provide values in the order they appear in the SQL
      // (Find order by looking at SQL or use parameterIndex)
      const rows = stmt.query(["Electronics", 200.0]);
      console.log("Affordable electronics:", rows.toJSON());

      // Find parameter indices
      const catIndex = stmt.parameterIndex(":cat");
      const priceIndex = stmt.parameterIndex(":max_price");
      console.log(`Parameter :cat is at index ${catIndex}`);
      console.log(`Parameter :max_price is at index ${priceIndex}`);
    },
  );
}

/**
 * Inspects parameter information for a prepared statement.
 *
 * BEGINNER:
 * - You can query a statement about its parameters
 * - parameterCount() returns the total number
 * - parameterName(index) returns the name (or null if positional)
 * - parameterIndex(name) returns the position in the query
 *
 * INTERMEDIATE:
 * - Useful for validating or logging parameter information
 * - Helps with ORM or SQL builder implementations
 *
 * ADVANCED:
 * - Use to generate parameter hints at runtime
 */
export function example_parameter_inspection(db: Connection) {
  db.prepare(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, :category)",
    (stmt) => {
      const totalParams = stmt.parameterCount();
      console.log(`Total parameters: ${totalParams}`);

      // Inspect each parameter
      for (let i = 0; i < totalParams; i++) {
        const name = stmt.parameterName(i);
        console.log(
          `  Parameter ${i}: ${name ?? "(positional ?)"}`,
        );
      }

      // Look up index by name
      const categoryIndex = stmt.parameterIndex(":category");
      console.log(
        `Parameter :category is at index ${categoryIndex}`,
      );
    },
  );
}

/**
 * Clears all parameter bindings from a statement.
 *
 * BEGINNER:
 * - clearBindings() resets all parameters to NULL
 * - Useful when reusing a statement with different data
 *
 * INTERMEDIATE:
 * - After clearBindings(), you must rebind before executing
 * - Rarely needed (just pass new parameters to execute)
 *
 * ADVANCED:
 * - Use for debugging: verify state between executions
 * - Some advanced patterns explicitly clear for cleanliness
 */
export function example_clear_bindings(db: Connection) {
  db.prepare("SELECT * FROM products WHERE id = ?", (stmt) => {
    // First query with ID 1
    const rows1 = stmt.query([1]);
    console.log("Query 1:", rows1.toJSON());

    // Clear bindings (reset to NULL)
    stmt.clearBindings();

    // Query again with ID 2 (without clearing, old binding persists)
    const rows2 = stmt.query([2]);
    console.log("Query 2:", rows2.toJSON());
  });
}

// ============================================================================
// ADVANCED: Reusing Statements and Batch Operations
// ============================================================================

/**
 * Reuses a single prepared statement for multiple inserts (efficient!).
 *
 * BEGINNER:
 * - Preparing once and executing many times is more efficient
 * - Loop example: insert 1000 products
 *
 * INTERMEDIATE:
 * - Each iteration just rebinds parameters; no re-compilation
 * - Significantly faster than prepare-execute-prepare-execute
 * - Use for bulk imports or batch operations
 *
 * ADVANCED:
 * - For very large batches (10k+), wrap in transaction (see example 04)
 * - Transactions dramatically improve bulk insert speed
 * - Combine with batching: 1000 inserts per transaction
 */
export function example_bulk_insert(db: Connection) {
  console.time("Bulk insert 1000 products");

  db.prepare(
    "INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)",
    (stmt) => {
      for (let i = 0; i < 1000; i++) {
        stmt.execute([
          `Product ${i}`,
          Math.random() * 1000,
          Math.floor(Math.random() * 100),
          ["Electronics", "Furniture", "Books"][Math.floor(Math.random() * 3)],
        ]);
      }
    },
  );

  console.timeEnd("Bulk insert 1000 products");
}

/**
 * Executes expanded SQL to see actual parameter values (for debugging).
 *
 * BEGINNER:
 * - expandedSql() shows the SQL with parameters replaced
 * - Useful for logging what's actually being executed
 *
 * INTERMEDIATE:
 * - Only available if the statement has been expanded
 * - Returns null if expansion wasn't done or parameters are NULL
 *
 * ADVANCED:
 * - Use for debugging parameter bindings
 * - Log before execute() to verify correctness
 */
export function example_expanded_sql(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE price > ? AND category = ?",
    (stmt) => {
      stmt.query([100.0, "Electronics"]);

      const expanded = stmt.expandedSql();
      console.log("Expanded SQL:", expanded);
      // Output: SELECT * FROM products WHERE price > 100.0 AND category = 'Electronics'
    },
  );
}

// ============================================================================
// ADVANCED: Prepared Statements with Flags
// ============================================================================

/**
 * Prepares a statement with custom flags.
 *
 * BEGINNER:
 * - prepareWithFlags() allows advanced preparation options
 * - Most apps use prepare() without flags
 *
 * INTERMEDIATE:
 * - RusqlitePrepFlags options:
 *   - SqlitePreparePersistent: Keep statement for reuse (optimize)
 *   - SqlitePrepareNoVtab: Disable virtual tables (security/performance)
 *   - SqlitePrepareDontLog: Suppress query logging (privacy)
 *
 * ADVANCED:
 * - PERSISTENT is useful for frequently-used statements
 * - NO_VTAB can prevent SQL injection via malicious virtual tables
 * - DONT_LOG useful for sensitive data (passwords, tokens)
 */
// export function example_prepare_with_flags(db: Connection) {
//   // Prepare with PERSISTENT flag for reuse
//   db.prepareWithFlags(
//     'SELECT * FROM products WHERE id = ?',
//     RusqlitePrepFlags.SqlitePreparePersistent,
//     (stmt) => {
//       const rows = stmt.query([1]);
//       console.log('Product:', rows.toJSON());
//     }
//   );
// }

// ============================================================================
// Running the Examples
// ============================================================================

const db = Connection.openInMemory();
setup_database(db);

console.log("=== Example 3: Prepared Statements ===\n");

console.log("--- Basic Operations ---");
example_basic_select(db);
example_prepared_insert(db);
example_prepared_update(db);
example_prepared_exists(db);

console.log("\n--- Parameter Binding ---");
example_positional_parameters(db);
example_named_parameters(db);
example_parameter_inspection(db);

console.log("\n--- Advanced Features ---");
example_clear_bindings(db);
example_expanded_sql(db);
// example_prepare_with_flags(db);

console.log("\n--- Performance: Bulk Insert ---");
example_bulk_insert(db);

console.log("Total products inserted:", db.changes());
