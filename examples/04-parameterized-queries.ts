/**
 * Example 4: Parameterized Queries with Different Data Types
 *
 * This example demonstrates:
 * - Secure parameter binding (prevents SQL injection)
 * - Handling different data types (strings, numbers, null, boolean-like values)
 * - Complex queries with multiple parameters
 */

import { Database, RusqliteError } from "../bindings/index";

interface Article {
  id: number;
  title: string;
  content: string;
  author: string;
  views: number;
  published: boolean;
  created_at: string;
  updated_at: string | null;
}

function parameterizedQueriesExample() {
  const db = Database.openInMemory();

  // Create articles table
  db.exec(`
    CREATE TABLE articles (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      published BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  console.log("=== Parameterized Queries with Different Types ===\n");

  // Insert articles with various data types
  console.log("Inserting articles with different data types:");

  const articles = [
    {
      id: 1,
      title: "Getting Started with SQLite",
      content: "A comprehensive guide...",
      author: "Alice",
      views: 1500,
      published: true,
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-02-01T14:20:00Z",
    },
    {
      id: 2,
      title: "Advanced SQL Queries",
      content: "Master complex queries...",
      author: "Bob",
      views: 800,
      published: true,
      created_at: "2024-01-20T09:15:00Z",
      updated_at: null,
    },
    {
      id: 3,
      title: "Draft Article",
      content: "Work in progress...",
      author: "Charlie",
      views: 0,
      published: false,
      created_at: "2024-02-10T16:45:00Z",
      updated_at: null,
    },
  ];

  // Using parameterized INSERT with different types
  const insertStmt = db.prepare(`
    INSERT INTO articles (id, title, content, author, views, published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const article of articles) {
    insertStmt.execute([
      article.id,
      article.title,
      article.content,
      article.author,
      article.views,
      article.published ? 1 : 0,
      article.created_at,
      article.updated_at, // Can be null
    ]);
    console.log(`  ✓ Inserted: "${article.title}"`);
  }

  // Query 1: String parameter
  console.log("\n--- Query 1: Find articles by author (string parameter) ---");
  const authorArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE author = ? ORDER BY id`,
    ["Alice"]
  );
  console.log(`Found ${authorArticles.length} article(s) by Alice:`);
  for (const article of authorArticles) {
    console.log(`  ✓ "${article.title}" (${article.views} views)`);
  }

  // Query 2: Number parameters (range)
  console.log("\n--- Query 2: Find articles with views in range (number parameters) ---");
  const popularArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE views >= ? AND views <= ? ORDER BY views DESC`,
    [500, 1500]
  );
  console.log(`Found ${popularArticles.length} article(s) with 500-1500 views:`);
  for (const article of popularArticles) {
    console.log(
      `  ✓ "${article.title}" - ${article.views} views`
    );
  }

  // Query 3: Boolean-like parameter
  console.log("\n--- Query 3: Find published articles (boolean parameter) ---");
  const publishedArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE published = ? ORDER BY created_at DESC`,
    [1] // 1 for true
  );
  console.log(`Found ${publishedArticles.length} published article(s):`);
  for (const article of publishedArticles) {
    console.log(
      `  ✓ "${article.title}" by ${article.author}`
    );
  }

  // Query 4: NULL checks with parameters
  console.log("\n--- Query 4: Find articles not yet updated (NULL check) ---");
  const notUpdatedArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE updated_at IS NULL ORDER BY created_at`,
  );
  console.log(`Found ${notUpdatedArticles.length} article(s) never updated:`);
  for (const article of notUpdatedArticles) {
    console.log(
      `  ✓ "${article.title}" (created: ${article.created_at})`
    );
  }

  // Query 5: LIKE with string parameters (pattern matching)
  console.log("\n--- Query 5: Find articles with keyword in title (LIKE parameter) ---");
  const keywordArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE title LIKE ? ORDER BY id`,
    ["%SQL%"] // Pattern with LIKE
  );
  console.log(`Found ${keywordArticles.length} article(s) with "SQL" in title:`);
  for (const article of keywordArticles) {
    console.log(
      `  ✓ "${article.title}"`
    );
  }

  // Query 6: Multiple conditions with mixed types
  console.log("\n--- Query 6: Complex query with mixed parameter types ---");
  const complexResults = db.queryAll<Article>(
    `SELECT * FROM articles 
     WHERE author = ? 
     AND published = ? 
     AND views >= ?
     ORDER BY views DESC`,
    ["Bob", 1, 100]
  );
  console.log(
    `Found ${complexResults.length} published Bob's article(s) with 100+ views:`
  );
  for (const article of complexResults) {
    console.log(
      `  ✓ "${article.title}" - ${article.views} views`
    );
  }

  // Query 7: Using queryOne with parameters
  console.log("\n--- Query 7: Find single article by ID (queryOne) ---");
  const singleArticle = db.queryOne<Article>(
    `SELECT * FROM articles WHERE id = ?`,
    [1]
  );
  if (singleArticle) {
    console.log(`✓ Found article: "${singleArticle.title}"`);
  }

  // Query 8: exists() check with parameters
  console.log("\n--- Query 8: Check if article exists (exists) ---");
  const articleIds = [1, 99, 3];
  for (const id of articleIds) {
    const exists = db.exists(
      `SELECT 1 FROM articles WHERE id = ?`,
      [id]
    );
    console.log(
      `  ${exists ? "✓" : "✗"} Article ${id} exists: ${exists}`
    );
  }

  // Update with parameters
  console.log("\n--- Query 9: Update with parameters ---");
  const updated = db.exec(
    `UPDATE articles SET views = views + ? WHERE author = ?`
  );
  console.log(`✓ Updated ${updated} row(s) (added views for Bob's articles)`);

  // Verify update
  const bobArticles = db.queryAll<Article>(
    `SELECT * FROM articles WHERE author = ? ORDER BY id`,
    ["Bob"]
  );
  for (const article of bobArticles) {
    console.log(`  ✓ Bob's article: "${article.title}" - ${article.views} views`);
  }
}

try {
  parameterizedQueriesExample();
} catch (error) {
  if (error instanceof RusqliteError) {
    console.error("Database Error:", error.message);
    console.error("SQL:", error.sql);
    console.error("Parameters:", error.params);
  } else {
    console.error("Error:", error);
  }
}
