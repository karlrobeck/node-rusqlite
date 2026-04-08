/**
 * Example 7: Batch Operations (Bulk Insert, Update, Delete)
 *
 * This example demonstrates:
 * - Bulk insert with prepared statements
 * - Batch updates for efficiency
 * - Transaction management for bulk operations
 * - Performance considerations
 */

import { Database, RusqliteError } from "../bindings/index";

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
  hire_date: string;
}

function batchOperationsExample() {
  const db = Database.openInMemory();

  // Create employees table
  db.exec(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      salary REAL NOT NULL,
      hire_date TEXT NOT NULL
    )
  `);

  console.log("=== Batch Operations (Bulk Insert, Update, Delete) ===\n");

  // Generate bulk data
  const employeeData: Employee[] = [];
  const departments = ["Engineering", "Sales", "HR", "Finance", "Marketing"];

  for (let i = 1; i <= 1000; i++) {
    employeeData.push({
      id: i,
      name: `Employee ${i}`,
      department: departments[i % departments.length],
      salary: 50000 + Math.random() * 100000,
      hire_date: new Date(2020 + Math.floor(i / 250), i % 12, (i % 28) + 1)
        .toISOString()
        .split("T")[0],
    });
  }

  console.log(`Generated ${employeeData.length} employee records for bulk insert\n`);

  // Bulk insert with transaction (efficient approach)
  console.log("--- Bulk Insert with Transaction ---");
  const startInsert = Date.now();

  db.withTransaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO employees (id, name, department, salary, hire_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const emp of employeeData) {
      insertStmt.execute([
        emp.id,
        emp.name,
        emp.department,
        emp.salary,
        emp.hire_date,
      ]);
    }
  });

  const insertTime = Date.now() - startInsert;
  console.log(
    `✓ Inserted ${employeeData.length} records in ${insertTime}ms`
  );
  console.log(
    `  Average: ${(insertTime / employeeData.length).toFixed(3)}ms per record\n`
  );

  // Verify insert
  const totalRowsResult = db.queryAll<{ count: number }>("SELECT COUNT(*) as count FROM employees");
  const totalRows = totalRowsResult[0];
  console.log(`✓ Verified: ${totalRows?.count} records in database\n`);

  // Bulk update with transaction
  console.log("--- Bulk Update with Transaction ---");
  const startUpdate = Date.now();

  db.withTransaction(() => {
    const updateStmt = db.prepare(`
      UPDATE employees SET salary = salary * ?
      WHERE department = ?
    `);

    // 10% raise for Engineering
    updateStmt.execute([1.1, "Engineering"]);
    // 5% raise for Sales
    updateStmt.execute([1.05, "Sales"]);
    // 3% raise for others
    updateStmt.execute([1.03, "HR"]);
    updateStmt.execute([1.03, "Finance"]);
    updateStmt.execute([1.03, "Marketing"]);
  });

  const updateTime = Date.now() - startUpdate;
  console.log(`✓ Bulk salary update completed in ${updateTime}ms\n`);

  // Show salary changes by department
  console.log("--- Salary Changes by Department ---");
  interface DeptStats {
    department: string;
    count: number;
    avg_salary: number;
    min_salary: number;
    max_salary: number;
  }
  const deptStats = db.queryAll<DeptStats>(`
    SELECT 
      department,
      COUNT(*) as count,
      ROUND(AVG(salary), 2) as avg_salary,
      ROUND(MIN(salary), 2) as min_salary,
      ROUND(MAX(salary), 2) as max_salary
    FROM employees
    GROUP BY department
    ORDER BY department
  `);

  for (const d of deptStats) {
    console.log(
      `  ${d.department.padEnd(15)} | Count: ${String(d.count).padEnd(4)} | Avg: $${String(d.avg_salary).padEnd(8)} | Min: $${String(d.min_salary).padEnd(8)} | Max: $${d.max_salary}`
    );
  }

  console.log();

  // Batch delete with conditions
  console.log("--- Batch Delete (Remove low earners) ---");
  const avgSalaryRow = db.queryOne<{ avg_salary: number }>(`
    SELECT AVG(salary) as avg_salary FROM employees
  `);
  const avgSalary = avgSalaryRow?.avg_salary ?? 0;

  console.log(`  Average salary: $${avgSalary.toFixed(2)}`);

  const lowEarners = db.queryAll<{ id: number }>(`
    SELECT id FROM employees WHERE salary < ?
    LIMIT 10
  `, [avgSalary * 0.7]);

  console.log(
    `  Found ${lowEarners.length} employees earning less than 70% of average\n`
  );

  if (lowEarners.length > 0) {
    db.withTransaction(() => {
      const deleteStmt = db.prepare("DELETE FROM employees WHERE id = ?");
      for (const row of lowEarners) {
        deleteStmt.execute([row.id]);
      }
    });
    console.log(`✓ Deleted ${lowEarners.length} records\n`);
  }

  // Verify final count
  const finalCountRow = db.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM employees"
  );
  const finalCount = finalCountRow?.count ?? 0;
  console.log(`✓ Final employee count: ${finalCount}\n`);

  // Performance comparison: transaction vs no transaction
  console.log("--- Performance Comparison ---");

  // Reset database
  db.exec("DELETE FROM employees");

  // Test 1: Bulk insert WITHOUT transaction (slower)
  const slowData = employeeData.slice(0, 100);
  const startSlow = Date.now();

  const insertNoTxn = db.prepare(`
    INSERT INTO employees (id, name, department, salary, hire_date)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const emp of slowData) {
    insertNoTxn.execute([emp.id, emp.name, emp.department, emp.salary, emp.hire_date]);
  }

  const slowTime = Date.now() - startSlow;
  console.log(
    `  Without transaction (100 inserts): ${slowTime}ms`
  );

  // Reset database
  db.exec("DELETE FROM employees");

  // Test 2: Bulk insert WITH transaction (faster)
  const startFast = Date.now();

  db.withTransaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO employees (id, name, department, salary, hire_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const emp of slowData) {
      insertStmt.execute([emp.id, emp.name, emp.department, emp.salary, emp.hire_date]);
    }
  });

  const fastTime = Date.now() - startFast;
  console.log(
    `  With transaction (100 inserts): ${fastTime}ms`
  );

  const improvement = ((slowTime - fastTime) / slowTime * 100).toFixed(1);
  console.log(
    `  ✓ Speedup with transaction: ${improvement}% faster\n`
  );

  // Batch operations summary
  console.log("--- Batch Operations Best Practices ---");
  console.log("  1. Always use prepared statements for repeated operations");
  console.log("  2. Wrap bulk operations in transactions for better performance");
  console.log("  3. Use withTransaction() for automatic commit/rollback");
  console.log("  4. Consider batching multiple updates/deletes in one transaction");
  console.log("  5. Parameterize all queries to prevent SQL injection");
}

try {
  batchOperationsExample();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
    console.error("Operation:", error.operation);
    console.error("SQL:", error.sql?.substring(0, 100));
  } else {
    console.error("Error:", error);
  }
}
