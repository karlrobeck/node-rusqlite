-- Schema Reference: Common SQLite Patterns for node-rusqlite
-- This file contains reusable SQL patterns for building database schemas.
-- Use these as templates when creating tables in your node-rusqlite applications.

-- =============================================================================
-- 1. BASIC TABLES
-- =============================================================================

-- Simple user table (no constraints)
CREATE TABLE users_simple (
  id INTEGER PRIMARY KEY,
  username TEXT,
  email TEXT,
  created_at DATETIME
);

-- User table with constraints (recommended)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  age INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Simple orders table
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. NORMALIZATION & RELATIONSHIPS
-- =============================================================================

-- User accounts (parent table)
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles (one-to-one relationship with accounts)
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Posts (one-to-many relationship with accounts)
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Post tags (many-to-many relationship)
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =============================================================================
-- 3. INDEXES - Performance Optimization
-- =============================================================================

-- Index on frequently searched columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Composite index for multi-column searches
CREATE INDEX idx_posts_account_published ON posts(account_id, published);

-- Unique index (alternative to UNIQUE constraint)
CREATE UNIQUE INDEX idx_profiles_account_id ON profiles(account_id);

-- Full-text search index (requires FTS virtual table)
CREATE VIRTUAL TABLE posts_fts USING fts5(
  title,
  content,
  content=posts,
  content_rowid=id
);

-- =============================================================================
-- 4. ADVANCED CONSTRAINTS
-- =============================================================================

-- Table with CHECK constraints
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  salary REAL NOT NULL CHECK (salary >= 0),
  department TEXT NOT NULL,
  hire_date DATE NOT NULL,
  CHECK (typeof(hire_date) = 'text')
);

-- Table with COLLATE for case-insensitive comparisons
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE
);

-- Table with DEFAULT expressions
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 5. SOFT DELETE PATTERN
-- =============================================================================

-- Table with soft delete support
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL
);

-- Index to efficiently filter active records
CREATE INDEX idx_articles_deleted_at ON articles(deleted_at);

-- View for non-deleted articles
CREATE VIEW active_articles AS
SELECT *
FROM articles
WHERE deleted_at IS NULL;

-- =============================================================================
-- 6. AUDIT TRAIL PATTERN
-- =============================================================================

-- Primary table
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit table for tracking changes
CREATE TABLE documents_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values TEXT,
  new_values TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Index for efficient audit lookups
CREATE INDEX idx_documents_audit_document_id ON documents_audit(document_id);
CREATE INDEX idx_documents_audit_changed_at ON documents_audit(changed_at);

-- =============================================================================
-- 7. TIMESTAMP PATTERN
-- =============================================================================

-- Standard timestamp columns
CREATE TABLE blogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to auto-update updated_at
CREATE TRIGGER blogs_update_updated_at
AFTER UPDATE ON blogs
FOR EACH ROW
BEGIN
  UPDATE blogs SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

-- =============================================================================
-- 8. ENUM-LIKE PATTERN (using CHECK constraints and allowed values)
-- =============================================================================

-- Table with enum-like status field
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- =============================================================================
-- 9. FULL-TEXT SEARCH PATTERN
-- =============================================================================

-- Virtual table for full-text search
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title,
  content,
  content=documents,
  content_rowid=id
);

-- Trigger to keep FTS index in sync
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content)
  VALUES (NEW.id, NEW.title, NEW.content);
END;

CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content)
  VALUES('delete', OLD.id, OLD.title, OLD.content);
END;

-- =============================================================================
-- 10. HIERARCHICAL DATA (Adjacency List)
-- =============================================================================

-- Categories with parent-child relationships
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Create index on parent_id for efficient tree traversal
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- =============================================================================
-- 11. COMPOSITE PRIMARY KEYS
-- =============================================================================

-- Junction table with composite key
CREATE TABLE course_enrollments (
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- =============================================================================
-- 12. VIEW EXAMPLES
-- =============================================================================

-- Simple view: filter active users
CREATE VIEW active_users AS
SELECT id, username, email, created_at
FROM users
WHERE is_active = 1;

-- Aggregation view: user post counts
CREATE VIEW user_post_counts AS
SELECT
  u.id,
  u.username,
  COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.account_id
GROUP BY u.id;

-- Join view: posts with author info
CREATE VIEW posts_with_authors AS
SELECT
  p.id,
  p.title,
  p.content,
  u.username,
  u.email,
  p.created_at
FROM posts p
JOIN users u ON p.account_id = u.id
WHERE p.published = 1;

-- =============================================================================
-- 13. MIGRATION-FRIENDLY ALTER TABLE EXAMPLES
-- =============================================================================

-- Note: SQLite has limited ALTER TABLE support
-- Common pattern: create new table, copy data, drop old, rename

-- Example: Adding a new column (SQLite supports this natively)
ALTER TABLE users ADD COLUMN phone TEXT;

-- Example: Adding a column with default value
ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL;

-- Example: Adding a column with constraint
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN DEFAULT 0;

-- =============================================================================
-- 14. PERFORMANCE OPTIMIZATION PATTERNS
-- =============================================================================

-- Use INTEGER PRIMARY KEY for auto-increment (fastest)
CREATE TABLE fast_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT
);

-- Avoid SELECT * in views, specify columns explicitly
CREATE VIEW optimized_view AS
SELECT id, title, status
FROM articles;

-- Use appropriate data types (TEXT vs BLOB, etc.)
CREATE TABLE storage_efficient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  small_int INTEGER,        -- Use INTEGER for whole numbers
  decimal_value REAL,        -- Use REAL for decimals
  text_data TEXT,            -- Use TEXT for strings
  binary_data BLOB,          -- Use BLOB for binary data
  bool_value INTEGER         -- Use INTEGER (0/1) for booleans
);

-- =============================================================================
-- 15. TESTING & EXAMPLE DATA SETUP
-- =============================================================================

-- Insert sample users
INSERT INTO users (username, email, age) VALUES
  ('alice', 'alice@example.com', 30),
  ('bob', 'bob@example.com', 25),
  ('charlie', 'charlie@example.com', 35);

-- Insert sample products
INSERT INTO products (name, description, price, stock, category_id) VALUES
  ('Widget', 'A useful widget', 9.99, 100, 1),
  ('Gadget', 'A cool gadget', 19.99, 50, 2),
  ('Tool', 'A handy tool', 29.99, 25, 3);

-- Insert sample orders
INSERT INTO orders (user_id, total, status) VALUES
  (1, 29.97, 'completed'),
  (2, 19.99, 'pending'),
  (3, 39.98, 'completed');

-- =============================================================================
-- 16. PRAGMAS - Recommended Configuration
-- =============================================================================

-- Enable foreign keys (must be done per connection!)
-- PRAGMA foreign_keys = ON;

-- Set journal mode to WAL (better for concurrent access)
-- PRAGMA journal_mode = WAL;

-- Set synchronous mode to NORMAL (good balance)
-- PRAGMA synchronous = NORMAL;

-- Increase cache size (in pages, negative = KB)
-- PRAGMA cache_size = -64000;

-- Enable memory-mapped I/O (improves read speed)
-- PRAGMA mmap_size = 30000000;

-- Set busy timeout (in milliseconds)
-- PRAGMA busy_timeout = 5000;

-- =============================================================================
-- 17. CLEANUP & MAINTENANCE
-- =============================================================================

-- Analyze database statistics (helps query planner)
-- ANALYZE;

-- Optimize database structure
-- PRAGMA optimize;

-- Vacuum to reclaim space (locks database!)
-- VACUUM;

-- Flush cache
-- PRAGMA cache_size = 0;
-- PRAGMA cache_size = -64000;
