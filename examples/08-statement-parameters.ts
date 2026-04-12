/**
 * Example 8: Statement Parameters - Binding & Lookup
 *
 * This example demonstrates working with prepared statement parameters:
 * how to bind values, look up parameter information, and work with both
 * positional and named parameters. You'll learn:
 *
 * - Finding parameter index by name
 * - Finding parameter name by index
 * - Getting total parameter count
 * - Working with positional (?) and named (:name) parameters
 * - Getting expanded SQL with parameters substituted
 * - Clearing parameter bindings
 */

import { Connection } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      price REAL,
      stock INTEGER
    )
  `,
    [],
  );

  db.execute(
    'INSERT INTO products VALUES (1, "Laptop", "Electronics", 1200.00, 5)',
    [],
  );
  db.execute(
    'INSERT INTO products VALUES (2, "Mouse", "Electronics", 25.00, 100)',
    [],
  );
  db.execute(
    'INSERT INTO products VALUES (3, "Desk", "Furniture", 300.00, 10)',
    [],
  );
}

// ============================================================================
// BEGINNER: Parameter Binding Basics
// ============================================================================

/**
 * Demonstrates simple positional parameter binding.
 *
 * BEGINNER:
 * - ? is a positional parameter placeholder
 * - Parameters are replaced in the order they appear in the SQL
 * - Pass values in an array in the same order
 *
 * INTERMEDIATE:
 * - Safe from SQL injection
 * - Any type: number, string, boolean (as 1/0), null, Date (as string)
 *
 * ADVANCED:
 * - Query(params) internally binds then executes
 * - Use parameterIndex/parameterName for more control
 */
export function example_positional_parameters(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE category = ? AND price > ? AND stock > ?",
    (stmt) => {
      // First ? gets 'Electronics', second gets 50, third gets 10
      const rows = stmt.query(["Electronics", 50, 10]);
      console.log("Positional parameters result:", rows.toJSON());
    },
  );
}

/**
 * Demonstrates named parameter binding.
 *
 * BEGINNER:
 * - Named parameters (:name, @name, $name syntax)
 * - More readable than positional ?
 * - SQLite accepts all three syntaxes interchangeably
 *
 * INTERMEDIATE:
 * - Still pass values as an array in SQL order (not object)
 * - Parameter position in SQL determines array position
 *
 * ADVANCED:
 * - Use parameterIndex(:name) to find position if unsure
 * - Useful for ORMs and query builders
 */
export function example_named_parameters(db: Connection) {
  // All three syntaxes work; using :name
  db.prepare(
    "SELECT * FROM products WHERE category = :cat AND price < :max_price",
    (stmt) => {
      // Must provide values in SQL order: :cat first, then :max_price
      const rows = stmt.query(["Electronics", 200]);
      console.log("Named parameters result:", rows.toJSON());
    },
  );
}

/**
 * Demonstrates mixed positional and named parameters.
 *
 * BEGINNER:
 * - You can mix ? (positional) and :name (named) in same query
 * - Less common, but sometimes useful
 *
 * INTERMEDIATE:
 * - Values still pass in array in SQL order
 * - First ? or :name gets values[0], second gets values[1], etc.
 *
 * ADVANCED:
 * - Generally not recommended (confusing)
 * - Use purely positional or purely named for clarity
 */
export function example_mixed_parameters(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE id = ? AND category = :cat AND price > :min_price",
    (stmt) => {
      // Order: ?, :cat, :min_price = values[0], values[1], values[2]
      const rows = stmt.query([2, "Electronics", 20]);
      console.log("Mixed parameters result:", rows.toJSON());
    },
  );
}

// ============================================================================
// INTERMEDIATE: Parameter Introspection
// ============================================================================

/**
 * Gets the total number of parameters in a statement.
 *
 * BEGINNER:
 * - parameterCount() returns the number of placeholders
 * - Useful for validation or iteration
 *
 * INTERMEDIATE:
 * - Tells you how many values must be provided
 * - Can enforce parameter constraints
 *
 * ADVANCED:
 * - Use in query builders to validate correct number of params
 */
export function example_parameter_count(db: Connection) {
  // 3 parameters: ?, :cat, :min_price
  db.prepare(
    "SELECT * FROM products WHERE id = ? AND category = :cat AND price > :min_price",
    (stmt) => {
      const count = stmt.parameterCount();
      console.log("Total parameters:", count); // 3

      // Verify we have enough values
      const values = [1, "Electronics", 50];
      if (values.length !== count) {
        console.error(
          `Expected ${count} parameters, got ${values.length}`,
        );
      } else {
        console.log("✓ Parameter count matches");
      }
    },
  );
}

/**
 * Finds the parameter index given a parameter name.
 *
 * BEGINNER:
 * - parameterIndex(name) returns the position of a parameter
 * - name includes the prefix: ':cat' not just 'cat'
 * - Returns null if parameter not found (not an error)
 *
 * INTERMEDIATE:
 * - Useful for building parameter maps
 * - Allows dynamic parameter lookup
 *
 * ADVANCED:
 * - Use in query builders to map object parameters to array positions
 * - Example: turn {cat: 'Electronics'} into [value_at_that_index]
 */
export function example_parameter_index_by_name(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE category = :category AND price < :price_limit",
    (stmt) => {
      // Find parameter positions
      const categoryIndex = stmt.parameterIndex(":category");
      const priceIndex = stmt.parameterIndex(":price_limit");
      const missingIndex = stmt.parameterIndex(":nonexistent");

      console.log("Parameter :category is at index:", categoryIndex); // 0
      console.log("Parameter :price_limit is at index:", priceIndex); // 1
      console.log("Parameter :nonexistent exists:", missingIndex); // null

      // Use this to build a mapping
      const params = new Array(stmt.parameterCount());
      params[categoryIndex!] = "Electronics";
      params[priceIndex!] = 200;

      const rows = stmt.query(params);
      console.log("Built query with index lookup:", rows.toJSON());
    },
  );
}

/**
 * Finds the parameter name given a position index.
 *
 * BEGINNER:
 * - parameterName(index) returns the name of parameter at that position
 * - null if parameter is positional (?)
 * - Returns the name with prefix: ':category' not just 'category'
 *
 * INTERMEDIATE:
 * - Inverse of parameterIndex()
 * - Used for reflection/introspection
 *
 * ADVANCED:
 * - Detect if parameters are named vs positional
 * - Build parameter hints for debugging
 */
export function example_parameter_name_by_index(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE id = ? AND category = :cat AND price > $min_price",
    (stmt) => {
      const count = stmt.parameterCount();
      console.log("Parameter information:");

      for (let i = 0; i < count; i++) {
        const name = stmt.parameterName(i);
        console.log(
          `  Position ${i}: ${name ?? "(positional ?)"}`,
        );
      }
      // Output:
      //   Position 0: (positional ?)
      //   Position 1: :cat
      //   Position 2: $min_price
    },
  );
}

/**
 * Lists all parameters in a statement with their positions and names.
 *
 * BEGINNER:
 * - Iterate through all parameters to inspect the statement
 * - Useful for debugging
 *
 * INTERMEDIATE:
 * - Build a human-readable parameter map
 * - Validate parameter names and count
 *
 * ADVANCED:
 * - Use in ORM query builders
 * - Implement parameter validation
 */
export function example_inspect_all_parameters(db: Connection) {
  db.prepare(
    `
    INSERT INTO products (name, category, price, stock)
    VALUES (:name, :category, :price, :stock)
  `,
    (stmt) => {
      const count = stmt.parameterCount();
      console.log(`Statement has ${count} parameters:\n`);

      const paramMap: Record<number, string> = {};
      const namedParams: string[] = [];
      const positionalParams: number[] = [];

      for (let i = 0; i < count; i++) {
        const name = stmt.parameterName(i);
        if (name) {
          namedParams.push(name);
          paramMap[i] = name;
          console.log(`  [${i}] ${name}`);
        } else {
          positionalParams.push(i);
          console.log(`  [${i}] (positional ?)`);
        }
      }

      console.log(
        `\nSummary: ${namedParams.length} named, ${positionalParams.length} positional`,
      );
    },
  );
}

// ============================================================================
// ADVANCED: Parameter Binding Patterns
// ============================================================================

/**
 * Converts an object of named parameters to an array for query execution.
 *
 * BEGINNER:
 * - Helper to convert friendly named parameter object to array
 *
 * INTERMEDIATE:
 * - Make it easier for developers to use named parameters
 * - Object: {category: 'Electronics', max_price: 200}
 * - Array: ['Electronics', 200] (based on SQL parameter order)
 *
 * ADVANCED:
 * - Use in query builders or ORM wrappers
 * - Provides type safety with TypeScript types
 */
export function example_object_to_array_parameters(db: Connection) {
  const sql =
    "SELECT * FROM products WHERE category = :cat AND price < :max_price";

  db.prepare(sql, (stmt) => {
    // Friendly object-based API
    const searchParams = {
      cat: "Electronics",
      max_price: 200,
    };

    // Convert to array using parameter lookup
    const paramArray = new Array(stmt.parameterCount());

    // Match parameter names to values in the object
    for (const [name, value] of Object.entries(searchParams)) {
      const index = stmt.parameterIndex(`:${name}`);
      if (index !== null) {
        paramArray[index] = value;
      }
    }

    console.log("Converted params:", paramArray);
    const rows = stmt.query(paramArray);
    console.log("Result:", rows.toJSON());
  });
}

/**
 * Gets expanded SQL with parameters substituted (for debugging).
 *
 * BEGINNER:
 * - expandedSql() shows what SQL looks like with parameters filled in
 * - Useful for logging/debugging what was actually executed
 *
 * INTERMEDIATE:
 * - Only works after binding/query
 * - Returns null if expansion not available
 * - Shows literal values (strings quoted)
 *
 * ADVANCED:
 * - Use for query logging and debugging
 * - Never log the expanded SQL if it contains sensitive data!
 */
export function example_expanded_sql(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE category = :cat AND price BETWEEN :min AND :max",
    (stmt) => {
      stmt.query(["Electronics", 50, 200]);

      const expanded = stmt.expandedSql();
      console.log("Expanded SQL:");
      console.log(
        "  Original: SELECT * FROM products WHERE category = :cat AND price BETWEEN :min AND :max",
      );
      console.log("  Expanded:", expanded);
      // Output might be:
      // SELECT * FROM products WHERE category = 'Electronics' AND price BETWEEN 50 AND 200
    },
  );
}

/**
 * Demonstrates clearing parameter bindings.
 *
 * BEGINNER:
 * - clearBindings() resets all parameters to NULL
 * - Useful when reusing a prepared statement
 *
 * INTERMEDIATE:
 * - After clearing, all parameters are NULL
 * - You must rebind before executing again
 * - Rarely needed (just pass new params to query)
 *
 * ADVANCED:
 * - Use for explicit state management in complex code
 * - Ensure no stale parameters affect next execution
 */
export function example_clear_bindings(db: Connection) {
  db.prepare(
    "SELECT * FROM products WHERE id = ? AND category = :cat",
    (stmt) => {
      // First query
      console.log("First query:");
      const rows1 = stmt.query([1, "Electronics"]);
      console.log("  Result:", rows1.toJSON());

      // Clear bindings
      stmt.clearBindings();
      console.log("Cleared bindings");

      // Second query with new parameters
      console.log("Second query:");
      const rows2 = stmt.query([2, "Furniture"]);
      console.log("  Result:", rows2.toJSON());
    },
  );
}

// ============================================================================
// ADVANCED: Building a Smart Query Wrapper
// ============================================================================

/**
 * Example query wrapper that handles named parameters elegantly.
 *
 * BEGINNER/INTERMEDIATE:
 * - Demonstrates practical use of parameter introspection
 * - Accepts friendly object-based parameters
 * - Handles both named and positional gracefully
 *
 * ADVANCED:
 * - Shows how to build type-safe query wrappers
 * - Real ORMs and query builders use similar patterns
 */
class SmartQuery {
  constructor(private db: Connection, private sql: string) {}

  execute(params: Record<string, unknown>): unknown {
    let result: unknown;

    this.db.prepare(this.sql, (stmt) => {
      // Build parameter array from named params
      const paramArray = new Array(stmt.parameterCount()).fill(null);

      for (const [key, value] of Object.entries(params)) {
        // Try different parameter name formats
        const names = [`:${key}`, `@${key}`, `$${key}`];
        for (const name of names) {
          const index = stmt.parameterIndex(name);
          if (index !== null) {
            paramArray[index] = value;
            break;
          }
        }
      }

      // Verify all parameters are bound
      if (paramArray.includes(null)) {
        const unbound = [];
        for (let i = 0; i < stmt.parameterCount(); i++) {
          if (paramArray[i] === null) {
            const name = stmt.parameterName(i);
            unbound.push(name ?? `positional[${i}]`);
          }
        }
        throw new Error(`Unbound parameters: ${unbound.join(", ")}`);
      }

      result = stmt.query(paramArray).toJSON();
    });

    return result;
  }
}

export function example_smart_query_wrapper(db: Connection) {
  const sql =
    "SELECT * FROM products WHERE category = :category AND price < :max_price";
  const query = new SmartQuery(db, sql);

  try {
    const results = query.execute({
      category: "Electronics",
      max_price: 200,
    });
    console.log("SmartQuery results:", results);
  } catch (error) {
    console.error("SmartQuery error:", error);
  }
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 8: Statement Parameters ===\n");

  console.log("--- Parameter Binding ---");
  example_positional_parameters(db);
  example_named_parameters(db);
  example_mixed_parameters(db);

  console.log("\n--- Parameter Introspection ---");
  example_parameter_count(db);
  example_parameter_index_by_name(db);
  example_parameter_name_by_index(db);
  example_inspect_all_parameters(db);

  console.log("\n--- Parameter Patterns ---");
  example_object_to_array_parameters(db);
  example_expanded_sql(db);
  example_clear_bindings(db);

  console.log("\n--- Smart Query Wrapper ---");
  example_smart_query_wrapper(db);
}
