/**
 * Example 7: Statement Metadata - Query Column Information
 *
 * Once you've prepared a statement, you can query metadata about its result
 * columns before executing it. This example demonstrates:
 *
 * - Getting column names with columnNames() and columnName()
 * - Counting result columns with columnCount()
 * - Finding column index by name with columnIndex()
 * - Getting lightweight column info with columns()
 * - Getting detailed column metadata with columnsWithMetadata()
 * - Single column detailed metadata with columnMetadata()
 */

import { Column, ColumnMetadata, Connection } from "../bindings/binding.js";

// ============================================================================
// Setup: Sample Data
// ============================================================================

function setup_database(db: Connection) {
  db.execute(
    `
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      department TEXT,
      salary REAL,
      hire_date TEXT,
      is_manager INTEGER
    )
  `,
    [],
  );

  db.execute(
    `
    INSERT INTO employees VALUES (1, 'Alice', 'Johnson', 'Engineering', 120000.00, '2020-01-15', 0)
  `,
    [],
  );

  db.execute(
    `
    INSERT INTO employees VALUES (2, 'Bob', 'Smith', 'Sales', 80000.00, '2021-03-20', 1)
  `,
    [],
  );
}

// ============================================================================
// BEGINNER: Basic Column Information
// ============================================================================

/**
 * Gets all column names in a result set.
 *
 * BEGINNER:
 * - columnNames() returns an array of column name strings
 * - Called on a prepared statement before execution
 * - Useful to know what columns the query will return
 *
 * INTERMEDIATE:
 * - Order matches SELECT clause order
 * - Includes expressions: SELECT id, salary * 2 AS doubled gives ['id', 'doubled']
 *
 * ADVANCED:
 * - Use for dynamic result processing
 * - Build column-based ORM mappers
 */
export function example_column_names(db: Connection) {
  db.prepare(
    "SELECT id, first_name, last_name, department FROM employees",
    (stmt) => {
      const names = stmt.columnNames();
      console.log("Column names:", names);
      // Output: ['id', 'first_name', 'last_name', 'department']

      // Now execute to see data
      const rows = stmt.query([]);
      console.log("Result:", rows.toJSON());
    },
  );
}

/**
 * Gets the total number of columns in a result set.
 *
 * BEGINNER:
 * - columnCount() returns integer count of columns
 * - Useful for validating results match expected structure
 *
 * INTERMEDIATE:
 * - Always exactly matches columnNames().length
 * - Useful when you don't know the schema in advance
 *
 * ADVANCED:
 * - Combined with columnName(index), allows iteration
 */
export function example_column_count(db: Connection) {
  db.prepare(
    "SELECT id, first_name, last_name, department, salary FROM employees",
    (stmt) => {
      const count = stmt.columnCount();
      console.log("Number of columns:", count); // 5

      // Iterate through all columns
      for (let i = 0; i < count; i++) {
        const name = stmt.columnName(i);
        console.log(`  Column ${i}: ${name}`);
      }
    },
  );
}

/**
 * Gets the name of a column by zero-based index.
 *
 * BEGINNER:
 * - columnName(index) returns the name of column at that position
 * - Useful for iterating through columns
 *
 * INTERMEDIATE:
 * - Inverse of columnIndex() (see below)
 * - Used together for reflection/introspection
 *
 * ADVANCED:
 * - Combine for dynamic mapping: index -> name -> value
 */
export function example_column_name_by_index(db: Connection) {
  db.prepare(
    "SELECT id, first_name, salary FROM employees WHERE id = ?",
    (stmt) => {
      stmt.query([1]);

      // Get column names by index
      console.log("Column at index 0:", stmt.columnName(0)); // 'id'
      console.log("Column at index 1:", stmt.columnName(1)); // 'first_name'
      console.log("Column at index 2:", stmt.columnName(2)); // 'salary'
    },
  );
}

/**
 * Finds the index of a column by name.
 *
 * BEGINNER:
 * - columnIndex(name) returns the position (0-based) of a named column
 * - Throws error if column doesn't exist
 *
 * INTERMEDIATE:
 * - Inverse of columnName(index)
 * - Useful when processing results and you need column position
 *
 * ADVANCED:
 * - For dynamic queries where column order varies, use this to find positions
 */
export function example_column_index_by_name(db: Connection) {
  db.prepare(
    "SELECT id, first_name, salary, department FROM employees WHERE id = ?",
    (stmt) => {
      stmt.query([1]);

      // Find column indexes by name
      const idIndex = stmt.columnIndex("id");
      const nameIndex = stmt.columnIndex("first_name");
      const salaryIndex = stmt.columnIndex("salary");

      console.log('Index of "id":', idIndex); // 0
      console.log('Index of "first_name":', nameIndex); // 1
      console.log('Index of "salary":', salaryIndex); // 2

      // Error if column doesn't exist:
      try {
        const badIndex = stmt.columnIndex("nonexistent");
      } catch (e) {
        console.log("Column not found (expected)");
      }
    },
  );
}

// ============================================================================
// INTERMEDIATE: Column Metadata (Lightweight)
// ============================================================================

/**
 * Gets lightweight column metadata for all columns.
 *
 * BEGINNER:
 * - columns() returns an array of Column objects
 * - Each Column has: name() method and declType() method
 * - "Lightweight" means minimal info; see columnsWithMetadata for full details
 *
 * INTERMEDIATE:
 * - Column.declType() returns the declared SQL type
 *   - E.g., INTEGER, TEXT, REAL
 *   - Returns null for computed/expression columns
 * - Column.name() returns the column name
 *
 * ADVANCED:
 * - Use this instead of columnsWithMetadata() if you only need name and type
 * - Less overhead than detailed metadata
 */
export function example_columns_lightweight(db: Connection) {
  db.prepare(
    "SELECT id, first_name, salary, is_manager FROM employees WHERE id = ?",
    (stmt) => {
      stmt.query([1]);

      const columns = stmt.columns();
      console.log("Lightweight column metadata:");
      columns.forEach((col, i) => {
        console.log(
          `  ${i}: ${col.name()} -> ${col.declType() || "(expression)"}`,
        );
      });
      // Output:
      //   0: id -> INTEGER
      //   1: first_name -> TEXT
      //   2: salary -> REAL
      //   3: is_manager -> INTEGER
    },
  );
}

/**
 * Gets detailed column metadata for all columns.
 *
 * BEGINNER:
 * - columnsWithMetadata() returns array of ColumnMetadata objects
 * - Full info: name, database, table origin, original column name, declared type
 * - Useful for understanding where columns come from
 *
 * INTERMEDIATE:
 * - ColumnMetadata includes:
 *   - name: result column name
 *   - databaseName: which database (main, attached, temp)
 *   - tableName: which table
 *   - originName: original column name in source table
 *   - (for computed columns, these are null)
 *
 * ADVANCED:
 * - Use for ORM/query builders that track source information
 * - Useful when results combine multiple tables
 */
export function example_columns_with_metadata(db: Connection) {
  db.prepare(
    "SELECT id, first_name, salary * 0.9 AS after_tax FROM employees WHERE id = ?",
    (stmt) => {
      stmt.query([1]);

      const metadata = stmt.columnsWithMetadata();
      console.log("Detailed column metadata:");
      metadata.forEach((col, i) => {
        const origin = col.originName
          ? `from ${col.tableName}.${col.originName}`
          : "(computed)";
        console.log(
          `  ${i}: ${col.name} ${origin} (${col.databaseName || "main"})`,
        );
      });
      // Output:
      //   0: id from employees.id (main)
      //   1: first_name from employees.first_name (main)
      //   2: after_tax (computed)
    },
  );
}

// ============================================================================
// ADVANCED: Single Column Detailed Metadata
// ============================================================================

/**
 * Gets detailed metadata for a single column by index.
 *
 * BEGINNER:
 * - columnMetadata(index) returns info for one column
 * - RusqliteDetailedColumnMetadata interface
 * - Includes: databaseName, tableName, columnName, type, collation, notNull, primaryKey, autoIncrement
 *
 * INTERMEDIATE:
 * - Combine with loop to build full metadata
 * - Or use for specific columns you care about
 *
 * ADVANCED:
 * - Use for fine-grained column analysis
 * - Check if a column is PRIMARY KEY, NOT NULL, etc.
 */
export function example_single_column_metadata(db: Connection) {
  db.prepare(
    "SELECT id, first_name, salary, hire_date FROM employees WHERE id = ?",
    (stmt) => {
      stmt.query([1]);

      // Get metadata for column 0 (id)
      const idMeta = stmt.columnMetadata(0);
      if (idMeta) {
        console.log("Metadata for column 0 (id):");
        console.log("  Database:", idMeta.databaseName);
        console.log("  Table:", idMeta.tableName);
        console.log("  Column:", idMeta.columnName);
        console.log("  Type:", idMeta.type);
        console.log("  Collation:", idMeta.collationSequence);
        console.log("  Not null:", idMeta.notNull);
        console.log("  Primary key:", idMeta.primaryKey);
        console.log("  Autoincrement:", idMeta.autoIncrement);
      }

      // Get metadata for column 1 (first_name)
      const firstNameMeta = stmt.columnMetadata(1);
      if (firstNameMeta) {
        console.log("\nMetadata for column 1 (first_name):");
        console.log("  Database:", firstNameMeta.databaseName);
        console.log("  Table:", firstNameMeta.tableName);
        console.log("  Column:", firstNameMeta.columnName);
        console.log("  Type:", firstNameMeta.type);
        console.log("  Not null:", firstNameMeta.notNull);
      }
    },
  );
}

// ============================================================================
// ADVANCED: Metadata for Computed/Expression Columns
// ============================================================================

/**
 * Demonstrates metadata behavior for computed columns and expressions.
 *
 * BEGINNER:
 * - Computed columns (SELECT salary * 2) have no table origin
 * - Metadata is null for origin information
 *
 * INTERMEDIATE:
 * - Still get the column name (from AS alias or expression text)
 * - But no table/database/original column info
 *
 * ADVANCED:
 * - Use to detect computed vs table columns in results
 * - Build smarter query introspection tools
 */
export function example_computed_column_metadata(db: Connection) {
  db.prepare(
    `
    SELECT
      id,
      first_name,
      salary,
      salary * 1.1 AS salary_with_bonus,
      COUNT(*) OVER () AS total_employees
    FROM employees
    WHERE id = ?
  `,
    (stmt) => {
      stmt.query([1]);

      const metadata = stmt.columnsWithMetadata();
      console.log("Metadata for query with computed columns:");
      metadata.forEach((col, i) => {
        const isComputed = !col.originName;
        const origin = isComputed
          ? "(computed/aggregate)"
          : `${col.tableName}.${col.originName}`;
        console.log(
          `  Column ${i}: "${col.name}" from ${origin}`,
        );
      });
    },
  );
}

// ============================================================================
// ADVANCED: Schema Discovery with Statement Metadata
// ============================================================================

/**
 * Uses statement metadata to validate result structure at runtime.
 *
 * BEGINNER:
 * - Prepare a query and check if results match expectations
 *
 * INTERMEDIATE:
 * - Before executing/consuming results, validate structure
 * - Useful for error handling or validation
 *
 * ADVANCED:
 * - Build ORM type checking on this
 * - Validate migrations updated schema correctly
 */
export function example_validate_result_schema(
  db: Connection,
  expectedColumns: string[],
) {
  db.prepare("SELECT id, first_name, salary FROM employees", (stmt) => {
    const actualColumns = stmt.columnNames();

    const matches = expectedColumns.length === actualColumns.length &&
      expectedColumns.every((col, i) => col === actualColumns[i]);

    if (matches) {
      console.log("✓ Result schema matches expected:", expectedColumns);
    } else {
      console.log("✗ Result schema mismatch!");
      console.log("  Expected:", expectedColumns);
      console.log("  Actual:", actualColumns);
    }

    // Only execute if schema is valid
    if (matches) {
      const rows = stmt.query([]);
      console.log("Results:", rows.toJSON());
    }
  });
}

/**
 * Builds a dynamic column mapper using metadata.
 *
 * BEGINNER:
 * - Get column names, then use them to map values
 *
 * INTERMEDIATE:
 * - Useful for generic row processors
 *
 * ADVANCED:
 * - Build ORMs or query builders with dynamic type mapping
 */
export function example_dynamic_column_mapper(db: Connection) {
  db.prepare("SELECT id, first_name, salary FROM employees", (stmt) => {
    const columnNames = stmt.columnNames();
    const rows = stmt.query([]);
    const results = rows.toJSON() as Record<string, unknown>[];

    console.log("Dynamic mapping example:");
    results.forEach((row, rowIdx) => {
      console.log(`  Row ${rowIdx}:`);
      columnNames.forEach((colName) => {
        const value = row[colName];
        console.log(`    ${colName} = ${value}`);
      });
    });
  });
}

// ============================================================================
// Running the Examples
// ============================================================================

if (import.meta.main) {
  const db = Connection.openInMemory();
  setup_database(db);

  console.log("=== Example 7: Statement Metadata ===\n");

  console.log("--- Column Names & Counts ---");
  example_column_names(db);

  console.log("\n--- Column Count ---");
  example_column_count(db);

  console.log("\n--- Looking Up Columns ---");
  example_column_name_by_index(db);
  example_column_index_by_name(db);

  console.log("\n--- Lightweight Metadata ---");
  example_columns_lightweight(db);

  console.log("\n--- Detailed Metadata ---");
  example_columns_with_metadata(db);

  console.log("\n--- Single Column Metadata ---");
  example_single_column_metadata(db);

  console.log("\n--- Computed Columns ---");
  example_computed_column_metadata(db);

  console.log("\n--- Validation & Mapping ---");
  example_validate_result_schema(db, [
    "id",
    "first_name",
    "salary",
  ]);
  example_dynamic_column_mapper(db);
}
