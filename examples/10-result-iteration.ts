/**
 * Example 10: Result Iteration - Processing Query Results Efficiently
 *
 * This example demonstrates different ways to work with query result sets:
 *
 * - Collecting all results into a Rows object with query()
 * - Converting to JSON with toJSON()
 * - Accessing results by index with get()
 * - Iterating with RowIterator via iterate()
 * - Using JavaScript iterator protocol
 * - Memory-efficient patterns for large result sets
 */

import { Connection } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      amount REAL,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  // Insert sample orders
  for (let i = 1; i <= 100; i++) {
    const status = ["pending", "completed", "cancelled"][i % 3];
    db.execute(
      "INSERT INTO orders (customer_name, amount, status) VALUES (?, ?, ?)",
      [`Customer ${i}`, Math.random() * 1000, status],
    );
  }
}

// ============================================================================
// BEGINNER: Getting All Results at Once
// ============================================================================

/**
 * Executes a query and collects all results into a Rows object.
 *
 * BEGINNER:
 * - query() on a prepared statement returns a Rows object
 * - Rows contains all result rows in memory
 * - Use when you know result set is small enough
 *
 * INTERMEDIATE:
 * - Rows object is immutable (can't modify it)
 * - contains(): number of rows (via length-like count)
 * - All rows are loaded at once (memory usage)
 *
 * ADVANCED:
 * - For millions of rows, use iterate() instead (see below)
 * - Rows are stored internally; access via get(index) or iterate()
 */
export function example_query_all(db: Connection) {
  db.prepare("SELECT * FROM orders WHERE status = ?", (stmt) => {
    const rows = stmt.query(["completed"]);
    console.log("Returned a Rows object");

    // Rows is a collection, not a mutable array
    // Convert to JSON for inspection
    const jsonData = rows.toJSON();
    console.log("Result count:", jsonData.length);
    console.log("Sample:", jsonData.slice(0, 2));
  });
}

/**
 * Converts result rows to JSON (JavaScript objects/arrays).
 *
 * BEGINNER:
 * - toJSON() returns unknown (typically array of objects)
 * - Each row is a Record<string, unknown>
 * - Can now use standard array methods: map, filter, forEach
 *
 * INTERMEDIATE:
 * - Converts the Rows object to plain JSON
 * - Good for inspection, serialization, or logging
 * - All rows are now in JSON format
 *
 * ADVANCED:
 * - Use toJSON() when you need standard array operations
 * - For large result sets, iterate() is more memory-efficient
 */
export function example_rows_to_json(db: Connection) {
  db.prepare(
    "SELECT id, customer_name, amount FROM orders ORDER BY amount DESC LIMIT 10",
    (stmt) => {
      const rows = stmt.query([]);
      const json = rows.toJSON() as Array<Record<string, unknown>>;

      console.log("Top 10 orders by amount:");
      json.forEach((row) => {
        console.log(
          `  Order #${row.id}: ${row.customer_name} - $${row.amount}`,
        );
      });
    },
  );
}

// ============================================================================
// INTERMEDIATE: Accessing Rows by Index
// ============================================================================

/**
 * Accesses a specific row by zero-based index.
 *
 * BEGINNER:
 * - get(index) returns a single row, or null if out of bounds
 * - Similar to array[index]
 *
 * INTERMEDIATE:
 * - Returns Record<string, unknown> (object with column names as keys)
 * - Returned as unknown; cast to expected type
 * - null if index >= result set size
 *
 * ADVANCED:
 * - Use for random access to specific rows
 * - Combined with columnNames(), can build dynamic row mappers
 */
export function example_row_by_index(db: Connection) {
  db.prepare("SELECT * FROM orders ORDER BY id LIMIT 5", (stmt) => {
    const rows = stmt.query([]);

    console.log("Accessing rows by index:");

    // Get first row
    const firstRow = rows.get(0);
    console.log("Row 0:", firstRow);

    // Get last row (row index 4 for 5 rows)
    const lastRow = rows.get(4);
    console.log("Row 4:", lastRow);

    // Get out-of-bounds row (returns null)
    const outOfBounds = rows.get(999);
    console.log("Row 999:", outOfBounds); // null

    // Iterate through indices
    for (let i = 0; i < 5; i++) {
      const row = rows.get(i);
      if (row) {
        console.log(`  [${i}] Customer: ${row.customer_name}`);
      }
    }
  });
}

// ============================================================================
// INTERMEDIATE: Iterating with RowIterator
// ============================================================================

/**
 * Iterates through results using the iterator protocol.
 *
 * BEGINNER:
 * - iterate() returns a RowIterator
 * - RowIterator implements JavaScript's Iterator interface
 * - Use in for...of loops or with iterator helpers
 *
 * INTERMEDIATE:
 * - Rows are fetched one at a time (minimal memory)
 * - RowIterator has next(), done, value properties
 * - Can use iterator helper methods: forEach, map, filter, etc.
 *
 * ADVANCED:
 * - More efficient than toJSON() for large result sets
 * - Rows are returned as unknown (cast as needed)
 * - Useful for streaming large result sets
 */
export function example_iterate_rows(db: Connection) {
  db.prepare(
    "SELECT id, customer_name, amount, status FROM orders LIMIT 10",
    (stmt) => {
      const rows = stmt.query([]);
      const iterator = rows.iterate();

      console.log("Iterating through rows:");
      let count = 0;
      let result = iterator.next();

      while (!result.done) {
        const row = result.value as Record<string, unknown>;
        console.log(
          `  Row ${count}: ${row.customer_name} ($${row.amount}) - ${row.status}`,
        );
        result = iterator.next();
        count++;
      }

      console.log(`Total iterated: ${count} rows`);
    },
  );
}

/**
 * Uses JavaScript's for...of loop with RowIterator.
 *
 * BEGINNER:
 * - RowIterator works with for...of syntax
 * - Cleaner than manual next() calls
 * - Automatic iteration until done
 *
 * INTERMEDIATE:
 * - for...of internally calls next() and checks done
 * - Each iteration gets the next row
 *
 * ADVANCED:
 * - Perfect for streaming large result sets
 * - Memory usage scales with processing, not result size
 */
export function example_for_of_iteration(db: Connection) {
  db.prepare(
    "SELECT id, customer_name, amount FROM orders WHERE status = ? LIMIT 10",
    (stmt) => {
      const rows = stmt.query(["completed"]);

      console.log("Using for...of with RowIterator:");
      let count = 0;
      for (const row of rows.iterate()) {
        const r = row as Record<string, unknown>;
        console.log(`  #${r.id}: ${r.customer_name}`);
        count++;
      }
      console.log(`Processed ${count} rows`);
    },
  );
}

/**
 * Uses JavaScript iterator helper methods.
 *
 * BEGINNER:
 * - RowIterator supports modern iterator helper methods
 * - Available: forEach, map, filter, find, some, every, reduce
 * - Cleaner functional style
 *
 * INTERMEDIATE:
 * - These are convenience methods built on top of iteration
 * - Syntax similar to Array methods, but works on iterators
 * - forEach, map, reduce available on RowIterator
 *
 * ADVANCED:
 * - Chaining operations: filter + map + forEach
 * - Lazy evaluation (processes row by row, not all at once)
 */
export function example_iterator_helpers(db: Connection) {
  db.prepare("SELECT id, customer_name, amount, status FROM orders", (stmt) => {
    const rows = stmt.query([]);

    console.log("Using iterator helper methods:");

    // forEach
    console.log("\nForEach all rows (first 5):");
    let count = 0;
    rows.iterate().forEach((row) => {
      if (count < 5) {
        const r = row as Record<string, unknown>;
        console.log(`  ${r.customer_name}: $${r.amount}`);
        count++;
      }
    });

    // Requery for next example (each iterate() is separate)
    const rows2 = stmt.query([]);

    // Filter (finding high-value orders)
    console.log("\nHigh-value orders (>$800):");
    const filtered = rows2
      .iterate()
      .filter((row) => {
        const r = row as Record<string, unknown>;
        return (r.amount as number) > 800;
      });

    let filteredCount = 0;
    for (const row of filtered) {
      const r = row as Record<string, unknown>;
      console.log(`  ${r.customer_name}: $${r.amount}`);
      filteredCount++;
      if (filteredCount >= 3) break; // Limit output
    }
  });
}

// ============================================================================
// ADVANCED: Processing Large Result Sets
// ============================================================================

/**
 * Demonstrates efficient processing of large result sets.
 *
 * BEGINNER:
 * - Don't load millions of rows with toJSON()
 * - Use iterate() for memory efficiency
 *
 * INTERMEDIATE:
 * - Process rows in chunks
 * - Use iterators to limit memory usage
 * - Stream results instead of loading all at once
 *
 * ADVANCED:
 * - Combine with transactions for consistency
 * - Use LIMIT/OFFSET for pagination
 * - Consider background job queues for very large batches
 */
export function example_process_large_result_set(db: Connection) {
  console.log("Processing large result set (memory-efficient):");

  let totalAmount = 0;
  let processedCount = 0;
  const chunkSize = 20;
  let currentChunk = 0;

  db.prepare(
    "SELECT id, customer_name, amount, status FROM orders ORDER BY id",
    (stmt) => {
      const rows = stmt.query([]);

      // Process row by row (minimum memory usage)
      for (const row of rows.iterate()) {
        const r = row as Record<string, unknown>;

        // Do work on each row
        totalAmount += r.amount as number;
        processedCount++;

        // Log progress in chunks
        if (processedCount % chunkSize === 0) {
          currentChunk++;
          console.log(
            `  Processed ${processedCount} rows (chunk ${currentChunk})`,
          );
        }
      }

      console.log(
        `\nTotal: ${processedCount} rows, $${totalAmount.toFixed(2)} in orders`,
      );
    },
  );
}

/**
 * Pagination pattern: fetch results in pages.
 *
 * BEGINNER:
 * - Use LIMIT and OFFSET for pagination
 * - Each page fetches a fixed number of rows
 *
 * INTERMEDIATE:
 * - LIMIT n: fetch n rows
 * - OFFSET skip: skip first 'skip' rows
 * - Each query is independent
 *
 * ADVANCED:
 * - Use keyset pagination (WHERE id > last_id) for better performance
 * - Cursor-based pagination for consistency in large datasets
 */
export function example_pagination(db: Connection) {
  const pageSize = 10;

  console.log("Pagination example (page size: 10):");

  for (let page = 0; page < 3; page++) {
    const offset = page * pageSize;

    db.prepare(
      `SELECT id, customer_name, amount FROM orders ORDER BY id LIMIT ? OFFSET ?`,
      (stmt) => {
        const rows = stmt.query([pageSize, offset]);
        const json = rows.toJSON() as Array<Record<string, unknown>>;

        console.log(`\nPage ${page + 1} (${json.length} rows):`);
        json.forEach((row) => {
          console.log(`  #${row.id}: ${row.customer_name}`);
        });
      },
    );
  }
}

/**
 * Aggregation pattern: compute statistics from results.
 *
 * BEGINNER:
 * - Use SQL for aggregation (faster)
 * - Or iterate and calculate in JavaScript
 *
 * INTERMEDIATE:
 * - SQL: COUNT, SUM, AVG, MIN, MAX
 * - JavaScript: manual iteration for complex logic
 *
 * ADVANCED:
 * - Combine SQL and JavaScript for balanced performance
 * - Use prepared statements for consistency
 */
export function example_aggregation(db: Connection) {
  console.log("Computing statistics:");

  // Using SQL for efficiency
  db.prepare(
    `SELECT 
      COUNT(*) as total,
      SUM(amount) as total_amount,
      AVG(amount) as avg_amount,
      MIN(amount) as min_amount,
      MAX(amount) as max_amount
    FROM orders
    WHERE status = ?`,
    (stmt) => {
      const rows = stmt.query(["completed"]);
      const json = rows.toJSON() as Array<Record<string, unknown>>;
      const stats = json[0];

      console.log("Completed orders:");
      console.log(`  Count: ${stats.total}`);
      console.log(`  Total: $${stats.total_amount}`);
      console.log(`  Average: $${stats.avg_amount}`);
      console.log(`  Min: $${stats.min_amount}`);
      console.log(`  Max: $${stats.max_amount}`);
    },
  );
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 10: Result Iteration ===\n");

  console.log("--- Getting All Results ---");
  example_query_all(db);

  console.log("\n--- Converting to JSON ---");
  example_rows_to_json(db);

  console.log("\n--- Accessing by Index ---");
  example_row_by_index(db);

  console.log("\n--- Iterating with RowIterator ---");
  example_iterate_rows(db);

  console.log("\n--- Using for...of ---");
  example_for_of_iteration(db);

  console.log("\n--- Iterator Helper Methods ---");
  example_iterator_helpers(db);

  console.log("\n--- Processing Large Result Sets ---");
  example_process_large_result_set(db);

  console.log("\n--- Pagination ---");
  example_pagination(db);

  console.log("\n--- Aggregation ---");
  example_aggregation(db);
}
