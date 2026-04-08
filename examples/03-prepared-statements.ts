/**
 * Example 3: Prepared Statements for Reuse
 *
 * This example demonstrates using prepared statements:
 * - Reusing the same statement with different parameters
 * - Performance benefits for bulk operations
 * - Statement metadata inspection
 */

import { Database, RusqliteError } from "../bindings/index";

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

function preparedStatementsExample() {
  const db = Database.openInMemory();

  // Create products table
  db.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL
    )
  `);

  console.log("=== Using Prepared Statements ===\n");

  // Prepare an INSERT statement
  const insertStmt = db.prepare(`
    INSERT INTO products (id, name, price, stock)
    VALUES (?, ?, ?, ?)
  `);

  console.log("Statement Info:");
  console.log(`- Parameter count: ${insertStmt.parameterCount()}`);
  console.log(`- Is readonly: ${insertStmt.readonly()}`);
  console.log("");

  // Insert multiple products using the same prepared statement
  console.log("Inserting products with prepared statement:");
  const products: Product[] = [
    { id: 1, name: "Laptop", price: 999.99, stock: 10 },
    { id: 2, name: "Mouse", price: 29.99, stock: 100 },
    { id: 3, name: "Keyboard", price: 79.99, stock: 50 },
    { id: 4, name: "Monitor", price: 299.99, stock: 25 },
    { id: 5, name: "USB Cable", price: 9.99, stock: 500 },
  ];

  for (const product of products) {
    insertStmt.execute([product.id, product.name, product.price, product.stock]);
    console.log(`  ✓ Inserted: ${product.name}`);
  }

  // Prepare a SELECT statement
  const selectStmt = db.prepare(`
    SELECT id, name, price, stock FROM products WHERE price < ?
  `);

  console.log(`\nSelectStatement Info:`);
  console.log(`- Column count: ${selectStmt.columnCount()}`);
  console.log(`- Column names: ${selectStmt.columnNames().join(", ")}`);
  console.log(`- Is readonly: ${selectStmt.readonly()}`);

  // Query products under $100 using prepared statement
  console.log("\nFinding products under $100:");
  const cheapProducts = selectStmt.queryAll<Product>([100]);
  for (const product of cheapProducts) {
    console.log(
      `  ✓ ${product.name}: $${product.price} (stock: ${product.stock})`
    );
  }

  // Query products under $50
  console.log("\nFinding products under $50:");
  const veryChearProducts = selectStmt.queryAll<Product>([50]);
  for (const product of veryChearProducts) {
    console.log(
      `  ✓ ${product.name}: $${product.price} (stock: ${product.stock})`
    );
  }

  // Prepare an UPDATE statement for bulk stock adjustments
  const updateStmt = db.prepare(`
    UPDATE products SET stock = stock + ? WHERE id = ?
  `);

  console.log("\nAdjusting stock levels:");
  const stockAdjustments = [
    { id: 1, adjustment: -2 },
    { id: 2, adjustment: 20 },
    { id: 3, adjustment: -5 },
  ];

  for (const { id, adjustment } of stockAdjustments) {
    const affected = updateStmt.execute([adjustment, id]);
    console.log(
      `  ✓ Updated product ${id}: ${affected} row(s) affected`
    );
  }

  // Use query() for iteration with prepared statement
  console.log("\nIterating through all products with prepared statement:");
  const allProductsStmt = db.prepare(
    "SELECT id, name, price, stock FROM products ORDER BY name"
  );

  const iterator = allProductsStmt.query();
  for (const product of iterator) {
    const p = product as Product;
    console.log(
      `  ✓ ${p.name.padEnd(15)} | Price: $${String(p.price).padEnd(7)} | Stock: ${p.stock}`
    );
  }

  // Check if a product exists using prepared statement
  const existsStmt = db.prepare("SELECT 1 FROM products WHERE id = ?");

  console.log("\nChecking product existence:");
  const productIds = [1, 99, 3];
  for (const id of productIds) {
    const exists = existsStmt.exists([id]);
    console.log(
      `  ${exists ? "✓" : "✗"} Product ${id} exists: ${exists}`
    );
  }

  // Get metadata for columns
  console.log("\nColumn metadata:");
  const metadataStmt = db.prepare("SELECT * FROM products LIMIT 0");
  const metadata = metadataStmt.columnsWithMetadata();
  for (const col of metadata) {
    console.log(`  - ${col.name()}: ${col.originName() || "UNKNOWN"}`);
  }
}

try {
  preparedStatementsExample();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
    console.error("SQL:", error.sql);
  } else {
    console.error("Error:", error);
  }
}
