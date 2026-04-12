/**
 * Example 14: Best Practices - Performance & Production Patterns
 *
 * This example demonstrates patterns and best practices for production use:
 *
 * - Reusing prepared statements for performance
 * - Batch operations with transactions
 * - Index usage and query optimization
 * - Connection lifecycle management
 * - Memory optimization
 * - Concurrency patterns
 * - Configuration recommendations
 */

import { Connection, TransactionBehavior } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data with Indexes
// ============================================================================

function setup_database(db: Connection) {
  // Configure for production
  db.setDbConfig(1002, true); // Enable foreign keys
  db.pragmaUpdate(null, "journal_mode", "wal");
  db.pragmaUpdate(null, "synchronous", 1);
  db.pragmaUpdate(null, "cache_size", -64000);

  db.execute(
    `
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL,
      stock INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
    [],
  );

  db.execute(
    `
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL,
      quantity INTEGER,
      order_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `,
    [],
  );

  // Create indexes for common queries
  db.execute("CREATE INDEX idx_products_category ON products(category)", []);
  db.execute("CREATE INDEX idx_orders_product_id ON orders(product_id)", []);
}

// ============================================================================
// BEGINNER: Statement Reuse for Performance
// ============================================================================

/**
 * Compares performance: non-reused vs reused statements.
 *
 * BEGINNER:
 * - Reusing prepared statements avoids re-compilation overhead
 * - Each prepare() call compiles the SQL to bytecode
 * - Reusing skips compilation for subsequent executions
 *
 * INTERMEDIATE:
 * - For 1000 inserts:
 *   - Non-reused: 1000 compile + 1000 execute
 *   - Reused: 1 compile + 1000 execute
 *   - Significant speedup (often 10-100x for small queries)
 *
 * ADVANCED:
 * - Statement compilation is the largest overhead for simple queries
 * - Always reuse when executing the same query multiple times
 * - Combine with transactions for maximum performance
 */
export function benchmark_statement_reuse(db: Connection) {
  const itemCount = 1000;

  console.log(`Benchmarking with ${itemCount} inserts:\n`);

  // Method 1: Non-reused statements (SLOW)
  console.time("Non-reused statements");
  for (let i = 0; i < itemCount; i++) {
    db.prepare(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
      (stmt) => {
        stmt.execute([
          `Product ${i}`,
          ["Electronics", "Books", "Furniture"][i % 3],
          Math.random() * 1000,
          Math.floor(Math.random() * 100),
        ]);
      },
    );
  }
  console.timeEnd("Non-reused statements");

  db.execute("DELETE FROM products", []);

  // Method 2: Reused statement (FAST)
  console.time("Reused statement");
  db.prepare(
    "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
    (stmt) => {
      for (let i = 0; i < itemCount; i++) {
        stmt.execute([
          `Product ${i}`,
          ["Electronics", "Books", "Furniture"][i % 3],
          Math.random() * 1000,
          Math.floor(Math.random() * 100),
        ]);
      }
    },
  );
  console.timeEnd("Reused statement");

  console.log("\n→ Reused statements are significantly faster!");
}

// ============================================================================
// INTERMEDIATE: Batch Operations with Transactions
// ============================================================================

/**
 * Combines statement reuse with transactions for maximum performance.
 *
 * BEGINNER:
 * - Transactions batch changes into one commit
 * - Each commit flushes to disk (expensive)
 * - Fewer commits = faster overall
 *
 * INTERMEDIATE:
 * - Combine: reused statement + transaction
 * - 1000 inserts in 1 transaction (1 commit) vs 1000 commits
 * - Speedup often 100-1000x or more
 *
 * ADVANCED:
 * - For bulk imports, mandatory to use transactions
 * - Commit granularity: balance between performance and isolation
 * - Large transactions hold locks; batch into manageable chunks
 */
export function batch_operations_best_practice(db: Connection) {
  const itemCount = 1000;

  console.log(`Batch insert ${itemCount} items:\n`);

  console.time("Batch insert with transaction");
  db.transaction((conn) => {
    conn.prepare(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
      (stmt) => {
        for (let i = 0; i < itemCount; i++) {
          stmt.execute([
            `Product ${i}`,
            ["Electronics", "Books", "Furniture"][i % 3],
            Math.random() * 1000,
            Math.floor(Math.random() * 100),
          ]);
        }
      },
    );
  });
  console.timeEnd("Batch insert with transaction");

  console.log(`\n✓ ${itemCount} items inserted efficiently`);
  console.log(`Total rows: ${db.changes()}`);
}

/**
 * Implements chunked batch processing for very large datasets.
 *
 * BEGINNER:
 * - Processing millions of rows in one transaction can cause problems:
 *   - Locks the database for too long
 *   - Uses too much memory
 *   - Timeout if transaction is too long
 *
 * INTERMEDIATE:
 * - Chunk into batches: 1000 inserts per transaction
 * - Still faster than non-batched (fewer total transactions)
 * - Shorter locks allow concurrent readers
 *
 * ADVANCED:
 * - Optimal chunk size depends on row size and available memory
 * - Monitor for lock contention
 * - Adjust based on actual performance metrics
 */
export function chunked_batch_processing(db: Connection) {
  const totalItems = 10000;
  const chunkSize = 1000;

  console.log(
    `Inserting ${totalItems} items in chunks of ${chunkSize}:\n`,
  );

  console.time("Chunked batch insert");
  for (let offset = 0; offset < totalItems; offset += chunkSize) {
    db.transaction((conn) => {
      conn.prepare(
        "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
        (stmt) => {
          const endIdx = Math.min(offset + chunkSize, totalItems);
          for (let i = offset; i < endIdx; i++) {
            stmt.execute([
              `Product ${i}`,
              ["Electronics", "Books"][i % 2],
              Math.random() * 1000,
              Math.floor(Math.random() * 100),
            ]);
          }
        },
      );
    });

    if ((offset + chunkSize) % 5000 === 0) {
      console.log(
        `  Processed ${Math.min(offset + chunkSize, totalItems)}/${totalItems}`,
      );
    }
  }
  console.timeEnd("Chunked batch insert");

  console.log(`\n✓ ${totalItems} items inserted in chunks`);
}

// ============================================================================
// INTERMEDIATE: Index Usage & Query Optimization
// ============================================================================

/**
 * Demonstrates when and how to use indexes.
 *
 * BEGINNER:
 * - Indexes speed up lookups by column value
 * - Trade-off: faster reads, slower writes
 *
 * INTERMEDIATE:
 * - Index on frequently-searched columns: WHERE category = ?
 * - Index on join columns: WHERE product_id = ?
 * - Index on ordered results: ORDER BY price
 *
 * ADVANCED:
 * - Use EXPLAIN QUERY PLAN to verify indexes are used
 * - Composite indexes: (product_id, order_date)
 * - Avoid indexes on low-cardinality columns (few distinct values)
 */
export function index_best_practices(db: Connection) {
  console.log("Index usage examples:\n");

  // Query 1: Uses index on category
  console.log("Query: SELECT * FROM products WHERE category = ?");
  db.prepare(
    "EXPLAIN QUERY PLAN SELECT * FROM products WHERE category = ?",
    (stmt) => {
      const rows = stmt.query(["Electronics"]) as any;
      console.log("  Plan:", rows.toJSON());
      console.log("  → Uses idx_products_category\n");
    },
  );

  // Query 2: Uses index on join
  console.log("Query: SELECT * FROM orders WHERE product_id = ?");
  db.prepare(
    "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE product_id = ?",
    (stmt) => {
      const rows = stmt.query([100]) as any;
      console.log("  Plan:", rows.toJSON());
      console.log("  → Uses idx_orders_product_id\n");
    },
  );

  // Query 3: Full table scan (no index)
  console.log('Query: SELECT * FROM products WHERE name LIKE ?"');
  db.prepare(
    "EXPLAIN QUERY PLAN SELECT * FROM products WHERE name LIKE ?",
    (stmt) => {
      const rows = stmt.query(["%Product%"]) as any;
      console.log("  Plan:", rows.toJSON());
      console.log("  → Full table scan (LIKE not indexed)\n");
    },
  );
}

// ============================================================================
// ADVANCED: Connection Lifecycle Management
// ============================================================================

/**
 * Best practices for managing connection lifetime.
 *
 * BEGINNER:
 * - Open connection once at startup
 * - Reuse throughout application lifetime
 * - No explicit close needed in Node.js
 *
 * INTERMEDIATE:
 * - Multiple connections can access same database
 * - Each connection has independent transaction state
 * - Pragma configuration is per-connection
 *
 * ADVANCED:
 * - Connection pool for multi-threaded servers
 * - Per-request connections in serverless (cold start overhead)
 * - Monitor connection health
 */
export class DatabaseManager {
  private db: Connection;

  constructor(path: string) {
    this.db = Connection.open(path);
    this.configure();
  }

  private configure() {
    // Set up for production
    this.db.setDbConfig(1002, true); // Foreign keys
    this.db.pragmaUpdate(null, "journal_mode", "wal");
    this.db.pragmaUpdate(null, "synchronous", 1);
    this.db.pragmaUpdate(null, "cache_size", -64000);
  }

  getConnection(): Connection {
    return this.db;
  }

  health(): Record<string, unknown> {
    return {
      isAutocommit: this.db.isAutocommit(),
      isBusy: this.db.isBusy(),
      isInterrupted: this.db.isInterrupted(),
      path: this.db.path(),
      changes: this.db.changes(),
    };
  }

  // Cleanup (optional, for graceful shutdown)
  close() {
    this.db.cacheFlush();
    this.db.releaseMemory();
    // Connection cleanup happens automatically in Node.js
  }
}

export function example_connection_manager() {
  console.log("Connection manager pattern:\n");

  const manager = new DatabaseManager("./app.db");
  const db = manager.getConnection();

  console.log("Health check:", manager.health());
  console.log("Manager ready for queries");

  // Use db...

  manager.close();
}

// ============================================================================
// ADVANCED: Memory Optimization
// ============================================================================

/**
 * Memory management for long-running applications.
 *
 * BEGINNER:
 * - SQLite caches query results and compiled statements
 * - Long-running servers accumulate memory
 *
 * INTERMEDIATE:
 * - Call releaseMemory() periodically to hint SQLite to free cache
 * - cacheFlush() writes pages to disk
 *
 * ADVANCED:
 * - Monitor heap usage with process.memoryUsage()
 * - Set up intervals to clean up periodically
 * - Adjust cache_size PRAGMA based on memory constraints
 */
export function memory_optimization_pattern(db: Connection) {
  console.log("Memory optimization pattern:\n");

  let queryCount = 0;
  const cleanupInterval = 100; // Clean up every 100 queries

  function executeQuery(query: string, params: unknown[]) {
    db.prepare(query, (stmt) => {
      stmt.query(params);
    });

    queryCount++;

    // Periodic cleanup
    if (queryCount % cleanupInterval === 0) {
      console.log(`Executed ${queryCount} queries, cleaning up...`);
      db.releaseMemory();
      db.cacheFlush();
    }
  }

  // Simulate queries
  for (let i = 0; i < 250; i++) {
    executeQuery("SELECT * FROM products WHERE id = ?", [i + 1]);
  }

  console.log(`\nTotal queries: ${queryCount}`);
  console.log("Memory cleanup intervals: 2 (at 100, 200)");
}

// ============================================================================
// ADVANCED: Production Configuration
// ============================================================================

/**
 * Recommended configuration for production applications.
 *
 * BEGINNER:
 * - Security: enable foreign keys, defensive mode
 * - Performance: WAL, PRAGMA settings
 * - Reliability: synchronous writes, larger cache
 *
 * INTERMEDIATE:
 * - FOREIGN_KEYS: Enable referential integrity
 * - JOURNAL_MODE: wal for better concurrency
 * - SYNCHRONOUS: 1 (NORMAL) for safety + speed
 * - CACHE_SIZE: -64000 (64MB) for typical apps
 *
 * ADVANCED:
 * - Tune based on actual workload
 * - Monitor performance metrics
 * - Adjust if needed
 */
export function production_configuration_checklist(db: Connection) {
  console.log("Production Configuration Checklist:\n");

  const checks = [
    {
      name: "Foreign Keys",
      action: () => db.setDbConfig(1002, true),
      verify: () => db.dbConfig(1002),
    },
    {
      name: "Triggers",
      action: () => db.setDbConfig(1003, true),
      verify: () => db.dbConfig(1003),
    },
    {
      name: "WAL Journal Mode",
      action: () => db.pragmaUpdate(null, "journal_mode", "wal"),
      verify: () => db.pragmaQueryValue(null, "journal_mode") === "wal",
    },
    {
      name: "Defensive Mode",
      action: () =>
        db.pragmaUpdate(
          null,
          "defensive",
          1,
        ),
      verify: () => db.pragmaQueryValue(null, "defensive") === 1,
    },
    {
      name: "Synchronous = NORMAL",
      action: () => db.pragmaUpdate(null, "synchronous", 1),
      verify: () => db.pragmaQueryValue(null, "synchronous") === 1,
    },
    {
      name: "Cache Size = 64MB",
      action: () => db.pragmaUpdate(null, "cache_size", -64000),
      verify: () => db.pragmaQueryValue(null, "cache_size") === -64000,
    },
  ];

  
  try {
    checks.forEach((check) => {
    check.action();
    const verified = check.verify();
    console.log(`${check.name.padEnd(25)} ${verified ? "✓" : "✗"}`);
  });
  } catch (error) {
    console.error("Error applying configuration:", error);
  }
  

  console.log("\n✓ Production configuration complete");
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 14: Best Practices ===\n");

  console.log("--- Statement Reuse Benchmark ---");
  benchmark_statement_reuse(db);

  // Clear data for next example
  db.execute("DELETE FROM products", []);

  console.log("\n--- Batch Operations ---");
  batch_operations_best_practice(db);

  console.log("\n--- Chunked Processing ---");
  chunked_batch_processing(db);

  // Clear data for next example
  db.execute("DELETE FROM products", []);

  console.log("\n--- Index Usage ---");
  index_best_practices(db);

  console.log("\n--- Connection Management ---");
  example_connection_manager();

  console.log("\n--- Memory Optimization ---");
  memory_optimization_pattern(db);

  console.log("\n--- Production Configuration ---");
  production_configuration_checklist(db);
}
