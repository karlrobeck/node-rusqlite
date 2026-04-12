/**
 * Example 11: Statement Status - Performance Metrics & Profiling
 *
 * SQLite provides detailed performance counters for prepared statements.
 * This example demonstrates:
 *
 * - Reading statement status counters with getStatus()
 * - Resetting counters with resetStatus()
 * - Understanding performance metrics
 * - Detecting query optimization issues
 * - Profiling query performance
 */

import { Connection, RusqliteStatementStatus } from "../bindings/binding.js";

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

  // Insert test data
  for (let i = 1; i <= 1000; i++) {
    db.execute(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
      [
        `Product ${i}`,
        ["Electronics", "Books", "Furniture"][i % 3],
        Math.random() * 1000,
        Math.floor(Math.random() * 100),
      ],
    );
  }

  // Create an index on category for optimization
  db.execute("CREATE INDEX idx_products_category ON products(category)", []);
}

// ============================================================================
// BEGINNER: Understanding Query Execution
// ============================================================================

/**
 * Demonstrates detecting full table scans vs indexed queries.
 *
 * BEGINNER:
 * - FULLSCAN_STEP counts rows examined during a full table scan
 * - Indexed queries have lower FULLSCAN_STEP counts
 * - High FULLSCAN_STEP means poor query efficiency
 *
 * INTERMEDIATE:
 * - RusqliteStatementStatus.FullscanStep
 * - Compare two similar queries with/without indexes
 *
 * ADVANCED:
 * - Use to detect missing indexes
 * - Part of automated query analysis for optimization
 */
export function example_detect_full_scans(db: Connection) {
  console.log("Comparing indexed vs non-indexed queries:\n");

  // Query 1: Without using the index (forces full scan)
  console.log("Query 1: SELECT * FROM products (no WHERE clause)");
  db.prepare("SELECT * FROM products", (stmt) => {
    stmt.query([]);
    const fullscans = stmt.getStatus(
      RusqliteStatementStatus.FullscanStep,
    );
    console.log(`  FULLSCAN_STEP: ${fullscans} (rows examined)`);
  });

  // Query 2: Using the index
  console.log("\nQuery 2: SELECT * FROM products WHERE category = ?");
  db.prepare("SELECT * FROM products WHERE category = ?", (stmt) => {
    stmt.query(["Electronics"]);
    const fullscans = stmt.getStatus(
      RusqliteStatementStatus.FullscanStep,
    );
    console.log(`  FULLSCAN_STEP: ${fullscans} (rows examined with index)`);
  });

  console.log("\nNote: Indexed query examined far fewer rows!");
}

// ============================================================================
// INTERMEDIATE: Performance Counters
// ============================================================================

/**
 * Demonstrates various performance status counters.
 *
 * BEGINNER:
 * - getStatus(status) returns the current counter value
 * - Counters track different aspects of query execution
 *
 * INTERMEDIATE:
 * - RusqliteStatementStatus enum has 9 counters:
 *   - FullscanStep: rows examined (full table scan)
 *   - Sort: sort operations performed
 *   - AutoIndex: automatic indexes created/used
 *   - VmStep: virtual machine steps executed
 *   - RePrepare: times statement was re-prepared
 *   - Run: times statement was run
 *   - FilterMiss: rows filtered out by WHERE clause
 *   - FilterHit: rows matching the filter
 *   - MemUsed: approximate memory used
 *
 * ADVANCED:
 * - Combine counters to understand query behavior
 * - VmStep / FullscanStep ratio indicates efficiency
 * - High Sort count suggests need for indexes or optimization
 */
export function example_performance_counters(db: Connection) {
  console.log("Performance counters for a complex query:\n");

  db.prepare(
    `SELECT * FROM products
     WHERE category = ? AND price > ?
     ORDER BY price DESC
     LIMIT 10`,
    (stmt) => {
      stmt.query(["Electronics", 100]);

      const counters = {
        fullscan: stmt.getStatus(RusqliteStatementStatus.FullscanStep),
        sort: stmt.getStatus(RusqliteStatementStatus.Sort),
        autoindex: stmt.getStatus(RusqliteStatementStatus.AutoIndex),
        vmstep: stmt.getStatus(RusqliteStatementStatus.VmStep),
        reprepare: stmt.getStatus(RusqliteStatementStatus.RePrepare),
        run: stmt.getStatus(RusqliteStatementStatus.Run),
        filtermiss: stmt.getStatus(RusqliteStatementStatus.FilterMiss),
        filterhit: stmt.getStatus(RusqliteStatementStatus.FilterHit),
        memused: stmt.getStatus(RusqliteStatementStatus.MemUsed),
      };

      console.log("Status Counters:");
      console.log(`  FullscanStep: ${counters.fullscan} (rows examined)`);
      console.log(`  Sort: ${counters.sort} (sort operations)`);
      console.log(`  AutoIndex: ${counters.autoindex} (auto-indexes created)`);
      console.log(`  VmStep: ${counters.vmstep} (virtual machine steps)`);
      console.log(`  RePrepare: ${counters.reprepare} (re-preparations)`);
      console.log(`  Run: ${counters.run} (times run)`);
      console.log(`  FilterMiss: ${counters.filtermiss} (rows filtered out)`);
      console.log(`  FilterHit: ${counters.filterhit} (rows matching filter)`);
      console.log(`  MemUsed: ${counters.memused} bytes`);

      // Analysis
      const efficiency = counters.fullscan > 0
        ? (counters.filterhit / counters.fullscan * 100).toFixed(1)
        : "N/A";
      console.log(`\nFilter efficiency: ${efficiency}% of rows matched`);
    },
  );
}

/**
 * Resets a counter and returns its previous value.
 *
 * BEGINNER:
 * - resetStatus(status) resets a counter to 0
 * - Returns the previous value before reset
 * - Useful for tracking changes between operations
 *
 * INTERMEDIATE:
 * - Measure only the work done between resets
 * - isolate one query's impact
 *
 * ADVANCED:
 * - Compare before/after optimization changes
 * - Track cumulative metrics
 */
export function example_reset_status(db: Connection) {
  console.log("Resetting status counters:\n");

  db.prepare("SELECT * FROM products WHERE category = ?", (stmt) => {
    // First query
    console.log("Query 1:");
    stmt.query(["Electronics"]);
    const vmsteps1 = stmt.getStatus(RusqliteStatementStatus.VmStep);
    console.log(`  VmStep after query 1: ${vmsteps1}`);

    // Reset the counter (returns old value)
    const previous = stmt.resetStatus(RusqliteStatementStatus.VmStep);
    console.log(`  Previous VmStep value (reset): ${previous}`);

    // Second query on same statement
    console.log("\nQuery 2 (on same prepared statement):");
    stmt.query(["Books"]);
    const vmsteps2 = stmt.getStatus(RusqliteStatementStatus.VmStep);
    console.log(`  VmStep after query 2: ${vmsteps2}`);
    console.log("  (Only counts query 2, since we reset after query 1)");
  });
}

// ============================================================================
// ADVANCED: Profiling & Optimization
// ============================================================================

/**
 * Profiles multiple queries and compares efficiency.
 *
 * BEGINNER:
 * - Compare status counters across different queries
 * - Find the most expensive operations
 *
 * INTERMEDIATE:
 * - Profile before optimization
 * - Identify bottlenecks
 *
 * ADVANCED:
 * - Automated query analysis tools use this
 * - Make data-driven optimization decisions
 */
export function example_profile_queries(db: Connection) {
  const queries = [
    {
      name: "Full table scan",
      sql: "SELECT COUNT(*) FROM products",
      params: [],
    },
    {
      name: "With category filter",
      sql: "SELECT COUNT(*) FROM products WHERE category = ?",
      params: ["Electronics"],
    },
    {
      name: "With price range",
      sql: "SELECT COUNT(*) FROM products WHERE price BETWEEN ? AND ?",
      params: [100, 500],
    },
    {
      name: "Sorted results",
      sql:
        "SELECT * FROM products WHERE category = ? ORDER BY price DESC LIMIT 100",
      params: ["Electronics"],
    },
  ];

  console.log("Query Performance Profile:\n");
  console.log(
    "%-30s | FULLSCAN | SORT | VMSTEP | MEM".padEnd(70),
  );
  console.log("-".repeat(70));

  queries.forEach((q) => {
    db.prepare(q.sql, (stmt) => {
      stmt.query(q.params);

      const fullscan = stmt.getStatus(RusqliteStatementStatus.FullscanStep);
      const sort = stmt.getStatus(RusqliteStatementStatus.Sort);
      const vmstep = stmt.getStatus(RusqliteStatementStatus.VmStep);
      const mem = stmt.getStatus(RusqliteStatementStatus.MemUsed);

      console.log(
        `${q.name.padEnd(30)} | ${String(fullscan).padEnd(8)} | ${
          String(sort).padEnd(4)
        } | ${String(vmstep).padEnd(6)} | ${mem}`,
      );
    });
  });
}

/**
 * Detects queries that need sorting but lack indexes.
 *
 * BEGINNER:
 * - High SORT counter suggests query is sorting in memory
 * - May indicate a missing index
 *
 * INTERMEDIATE:
 * - Create an index on sorted columns to reduce Sort count
 * - Monitor Sort count before/after: should decrease dramatically
 *
 * ADVANCED:
 * - Use to identify index optimization opportunities
 * - Automate index creation suggestions
 */
export function example_identify_sorting_issues(db: Connection) {
  let sortBefore = 0;
  console.log("Before and after index optimization:\n");

  // Query1: Before index on price
  console.log("Query: SELECT * FROM products ORDER BY price DESC LIMIT 100");

  db.prepare("SELECT * FROM products ORDER BY price DESC LIMIT 100", (stmt) => {
    stmt.query([]);
    sortBefore = stmt.getStatus(RusqliteStatementStatus.Sort);
    console.log(`  Sort operations (before index): ${sortBefore}`);
  });

  // Create index
  console.log(
    "\nCreating index: CREATE INDEX idx_products_price ON products(price)",
  );
  db.execute("CREATE INDEX idx_products_price ON products(price)", []);

  // Query2: After index
  console.log("\nQuery: SELECT * FROM products ORDER BY price DESC LIMIT 100");
  db.prepare(
    "SELECT * FROM products ORDER BY price DESC LIMIT 100",
    (stmt) => {
      stmt.query([]);
      const sortAfter = stmt.getStatus(RusqliteStatementStatus.Sort);
      console.log(`  Sort operations (after index): ${sortAfter}`);

      if (sortAfter < sortBefore) {
        console.log("\n✓ Index significantly reduced sort operations!");
      }
    },
  );
}

// ============================================================================
// ADVANCED: Statement Properties
// ============================================================================

/**
 * Detects EXPLAIN statements.
 *
 * BEGINNER:
 * - isExplain() returns a number (0 = not explain, other = explain)
 * - EXPLAIN statements show query plan, not actual data
 *
 * INTERMEDIATE:
 * - Use to bypass certain operations for EXPLAIN queries
 * - Different handling needed for plan vs data
 *
 * ADVANCED:
 * - Automate query plan analysis tools
 */
export function example_detect_explain_statements(db: Connection) {
  console.log("Detecting EXPLAIN statements:\n");

  const queries = [
    ["SELECT * FROM products", "Regular query"],
    ["EXPLAIN SELECT * FROM products", "EXPLAIN query"],
    ["EXPLAIN QUERY PLAN SELECT * FROM products", "EXPLAIN QUERY PLAN"],
  ];

  queries.forEach(([sql, label]) => {
    db.prepare(sql, (stmt) => {
      const isExplain = stmt.isExplain();
      console.log(
        `${label.padEnd(25)} | isExplain: ${isExplain ? "yes" : "no"}`,
      );
    });
  });
}

/**
 * Checks if a statement modifies data (read-only check).
 *
 * BEGINNER:
 * - readonly() returns true if statement is read-only
 * - Use to prevent accidental writes
 *
 * INTERMEDIATE:
 * - SELECT queries return true
 * - INSERT/UPDATE/DELETE queries return false
 * - Useful for permission systems
 *
 * ADVANCED:
 * - Implement query whitelisting (only allow readonly queries in certain contexts)
 */
export function example_readonly_check(db: Connection) {
  console.log("Checking if statements are read-only:\n");

  const queries = [
    "SELECT * FROM products",
    "INSERT INTO products VALUES (?, ?, ?, ?, ?)",
    "UPDATE products SET price = ? WHERE id = ?",
    "DELETE FROM products WHERE id = ?",
  ];

  queries.forEach((sql) => {
    db.prepare(sql, (stmt) => {
      const isReadonly = stmt.readonly();
      const label = sql.split(" ")[0].toUpperCase();
      console.log(
        `${label.padEnd(10)} | Readonly: ${isReadonly ? "yes" : "no"}`,
      );
    });
  });
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 11: Statement Status & Profiling ===\n");

  console.log("--- Detecting Full Scans ---");
  example_detect_full_scans(db);

  console.log("\n--- Performance Counters ---");
  example_performance_counters(db);

  console.log("\n--- Resetting Status ---");
  example_reset_status(db);

  console.log("\n--- Profiling Queries ---");
  example_profile_queries(db);

  console.log("\n--- Identifying Sorting Issues ---");
  example_identify_sorting_issues(db);

  console.log("\n--- EXPLAIN Statements ---");
  example_detect_explain_statements(db);

  console.log("\n--- Read-Only Check ---");
  example_readonly_check(db);
}
