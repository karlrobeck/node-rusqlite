import {
  RusqliteConnection as NativeConnection,
  RusqliteStatement as NativeStatement,
  RusqliteRows as NativeRows,
  RusqliteTransaction as NativeTransaction,
  RusqliteSavepoint as NativeSavepoint,
  RusqliteColumn,
  RusqliteColumnMetadata,
  RusqliteConnectionColumnMetadata,
  RusqliteConnectionOptions,
  RusqliteDbConfig,
  RusqliteDetailedColumnMetadata,
  RusqlitePrepFlags,
  RusqliteStatementStatus,
  RusqliteTransactionBehavior,
  RusqliteTransactionState,
  RusqliteInterruptHandle,
  DropBehavior,
  Progress,
} from "./binding";

// Re-export low-level bindings for advanced users
export * from "./binding";

/**
 * Custom error class for all rusqlite operations.
 * Wraps native errors with context about the operation, SQL, and parameters.
 */
export class RusqliteError extends Error {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly sql?: string,
    public readonly params?: unknown[],
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "RusqliteError";
    Object.setPrototypeOf(this, RusqliteError.prototype);
  }

  static wrap(error: Error, operation?: string, sql?: string, params?: unknown[]): RusqliteError {
    const message = this.formatErrorMessage(error.message, operation, sql);
    return new RusqliteError(message, operation, sql, params, error);
  }

  private static formatErrorMessage(originalMessage: string, operation?: string, sql?: string): string {
    let message = `RusqliteError: ${originalMessage}`;

    if (operation) {
      message = `Failed to ${operation}. ${message}`;
    }

    if (sql) {
      const sqlSnippet = sql.length > 100 ? sql.substring(0, 97) + "..." : sql;
      message += ` [SQL: "${sqlSnippet}"]`;
    }

    return message;
  }
}

/**
 * Serialization utilities for converting between JS values and SQLite parameter buffers
 */
const Serialization = {
  /**
   * Serialize parameters array to Buffer for SQLite binding
   */
  serializeParams(params?: unknown[]): Buffer {
    if (!params || params.length === 0) {
      return Buffer.from(JSON.stringify([]));
    }
    return Buffer.from(JSON.stringify(params));
  },

  /**
   * Deserialize a single row buffer to an object
   */
  deserializeRow(buffer: Buffer): Record<string, unknown> {
    try {
      return JSON.parse(buffer.toString("utf8"));
    } catch (error) {
      throw new RusqliteError(
        `Failed to deserialize row: ${error instanceof Error ? error.message : String(error)}`,
        "deserializeRow"
      );
    }
  },

  /**
   * Deserialize an iterable of row buffers to an array of objects
   */
  deserializeRows(rows: Iterable<Buffer>): Record<string, unknown>[] {
    const result: Record<string, unknown>[] = [];
    try {
      for (const buffer of rows) {
        result.push(this.deserializeRow(buffer));
      }
    } catch (error) {
      throw new RusqliteError(
        `Failed to deserialize rows: ${error instanceof Error ? error.message : String(error)}`,
        "deserializeRows"
      );
    }
    return result;
  },
};

/**
 * High-level wrapper around RusqliteRows that auto-deserializes rows
 */
export class Rows<T extends Record<string, any> = Record<string, any>> {
  constructor(private readonly nativeRows: NativeRows) {}

  [Symbol.iterator](): Iterator<T> {
    return this;
  }

  next(): IteratorResult<T, void> {
    try {
      const result = this.nativeRows.next();

      if (result.done) {
        return { done: true, value: undefined };
      }

      const deserializedRow = Serialization.deserializeRow(result.value) as T;
      return { done: false, value: deserializedRow };
    } catch (error) {
      throw new RusqliteError(
        `Failed to iterate rows: ${error instanceof Error ? error.message : String(error)}`,
        "Rows.next()"
      );
    }
  }

  /**
   * Collect all remaining rows into an array
   */
  all(): T[] {
    const rows: T[] = [];
    let result = this.next();
    while (!result.done) {
      rows.push(result.value);
      result = this.next();
    }
    return rows;
  }
}

/**
 * High-level wrapper around RusqliteStatement with auto serialization/deserialization
 */
export class Statement {
  constructor(private readonly nativeStatement: NativeStatement) {}

  /**
   * Execute a statement (INSERT, UPDATE, DELETE) and return affected row count
   */
  execute(params?: unknown[]): number {
    try {
      const serialized = Serialization.serializeParams(params);
      return this.nativeStatement.execute(serialized);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.execute()",
        undefined,
        params
      );
    }
  }

  /**
   * Insert a row and get the last inserted rowid
   */
  insert(params?: unknown[]): number {
    try {
      const serialized = Serialization.serializeParams(params);
      return this.nativeStatement.insert(serialized);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.insert()",
        undefined,
        params
      );
    }
  }

  /**
   * Query and return first row as typed object, or undefined if no rows
   */
  queryOne<T extends Record<string, any> = Record<string, any>>(
    params?: unknown[]
  ): T | undefined {
    try {
      const serialized = Serialization.serializeParams(params);
      const rows = this.nativeStatement.query(serialized);

      const firstResult = rows.next();
      if (firstResult.done) {
        return undefined;
      }

      return Serialization.deserializeRow(firstResult.value) as T;
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.queryOne()",
        undefined,
        params
      );
    }
  }

  /**
   * Query and return all rows as typed objects array
   */
  queryAll<T extends Record<string, any> = Record<string, any>>(
    params?: unknown[]
  ): T[] {
    try {
      const serialized = Serialization.serializeParams(params);
      const rows = new Rows<T>(this.nativeStatement.query(serialized));
      return rows.all();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.queryAll()",
        undefined,
        params
      );
    }
  }

  /**
   * Query and return a Rows iterator for manual iteration
   */
  query<T extends Record<string, any> = Record<string, any>>(
    params?: unknown[]
  ): Rows<T> {
    try {
      const serialized = Serialization.serializeParams(params);
      const nativeRows = this.nativeStatement.query(serialized);
      return new Rows<T>(nativeRows);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.query()",
        undefined,
        params
      );
    }
  }

  /**
   * Check if query returns any rows
   */
  exists(params?: unknown[]): boolean {
    try {
      const serialized = Serialization.serializeParams(params);
      return this.nativeStatement.exists(serialized);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.exists()",
        undefined,
        params
      );
    }
  }

  /**
   * Get all column names in result set
   */
  columnNames(): string[] {
    try {
      return this.nativeStatement.columnNames();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnNames()"
      );
    }
  }

  /**
   * Get total number of columns
   */
  columnCount(): number {
    try {
      return this.nativeStatement.columnCount();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnCount()"
      );
    }
  }

  /**
   * Get name of column at index
   */
  columnName(col: number): string {
    try {
      return this.nativeStatement.columnName(col);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnName()"
      );
    }
  }

  /**
   * Get index of column by name
   */
  columnIndex(name: string): number {
    try {
      return this.nativeStatement.columnIndex(name);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnIndex()"
      );
    }
  }

  /**
   * Get all columns
   */
  columns(): RusqliteColumn[] {
    try {
      return this.nativeStatement.columns();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columns()"
      );
    }
  }

  /**
   * Get all columns with metadata
   */
  columnsWithMetadata(): RusqliteColumnMetadata[] {
    try {
      return this.nativeStatement.columnsWithMetadata();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnsWithMetadata()"
      );
    }
  }

  /**
   * Get detailed metadata for column at index
   */
  columnMetadata(col: number): RusqliteDetailedColumnMetadata | null {
    try {
      return this.nativeStatement.columnMetadata(col);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.columnMetadata()"
      );
    }
  }

  /**
   * Get index of parameter by name
   */
  parameterIndex(name: string): number | null {
    try {
      return this.nativeStatement.parameterIndex(name);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.parameterIndex()"
      );
    }
  }

  /**
   * Get name of parameter at index
   */
  parameterName(index: number): string | null {
    try {
      return this.nativeStatement.parameterName(index);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.parameterName()"
      );
    }
  }

  /**
   * Get total number of parameters
   */
  parameterCount(): number {
    try {
      return this.nativeStatement.parameterCount();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.parameterCount()"
      );
    }
  }

  /**
   * Get expanded SQL (with placeholders filled in, if available)
   */
  expandedSql(): string | null {
    try {
      return this.nativeStatement.expandedSql();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.expandedSql()"
      );
    }
  }

  /**
   * Get statement status
   */
  getStatus(status: RusqliteStatementStatus): number {
    try {
      return this.nativeStatement.getStatus(status);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.getStatus()"
      );
    }
  }

  /**
   * Reset statement status
   */
  resetStatus(status: RusqliteStatementStatus): number {
    try {
      return this.nativeStatement.resetStatus(status);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.resetStatus()"
      );
    }
  }

  /**
   * Check if statement is EXPLAIN
   */
  isExplain(): number {
    try {
      return this.nativeStatement.isExplain();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.isExplain()"
      );
    }
  }

  /**
   * Check if statement is read-only
   */
  readonly(): boolean {
    try {
      return this.nativeStatement.readonly();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.readonly()"
      );
    }
  }

  /**
   * Clear all bindings
   */
  clearBindings(): void {
    try {
      this.nativeStatement.clearBindings();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Statement.clearBindings()"
      );
    }
  }
}

/**
 * High-level wrapper around RusqliteSavepoint
 */
export class Savepoint {
  constructor(private readonly nativeSavepoint: NativeSavepoint) {}

  /**
   * Create a nested savepoint
   */
  savepoint(): Savepoint {
    try {
      return new Savepoint(this.nativeSavepoint.savepoint());
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.savepoint()"
      );
    }
  }

  /**
   * Create a named nested savepoint
   */
  savepointWithName(name: string): Savepoint {
    try {
      return new Savepoint(this.nativeSavepoint.savepointWithName(name));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.savepointWithName()"
      );
    }
  }

  /**
   * Get drop behavior
   */
  dropBehavior(): DropBehavior {
    try {
      return this.nativeSavepoint.dropBehavior();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.dropBehavior()"
      );
    }
  }

  /**
   * Set drop behavior
   */
  setDropBehavior(dropBehavior: DropBehavior): void {
    try {
      this.nativeSavepoint.setDropBehavior(dropBehavior);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.setDropBehavior()"
      );
    }
  }

  /**
   * Commit the savepoint
   */
  commit(): void {
    try {
      this.nativeSavepoint.commit();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.commit()"
      );
    }
  }

  /**
   * Rollback the savepoint
   */
  rollback(): void {
    try {
      this.nativeSavepoint.rollback();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.rollback()"
      );
    }
  }

  /**
   * Finish the savepoint
   */
  finish(): void {
    try {
      this.nativeSavepoint.finish();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Savepoint.finish()"
      );
    }
  }
}

/**
 * High-level wrapper around RusqliteTransaction
 */
export class Transaction {
  constructor(private readonly nativeTransaction: NativeTransaction) {}

  /**
   * Create a nested savepoint
   */
  savepoint(): Savepoint {
    try {
      return new Savepoint(this.nativeTransaction.savepoint());
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.savepoint()"
      );
    }
  }

  /**
   * Create a named nested savepoint
   */
  savepointWithName(name: string): Savepoint {
    try {
      return new Savepoint(this.nativeTransaction.savepointWithName(name));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.savepointWithName()"
      );
    }
  }

  /**
   * Get drop behavior
   */
  dropBehavior(): DropBehavior {
    try {
      return this.nativeTransaction.dropBehavior();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.dropBehavior()"
      );
    }
  }

  /**
   * Set drop behavior
   */
  setDropBehavior(dropBehavior: DropBehavior): void {
    try {
      this.nativeTransaction.setDropBehavior(dropBehavior);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.setDropBehavior()"
      );
    }
  }

  /**
   * Commit the transaction
   */
  commit(): void {
    try {
      this.nativeTransaction.commit();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.commit()"
      );
    }
  }

  /**
   * Rollback the transaction
   */
  rollback(): void {
    try {
      this.nativeTransaction.rollback();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.rollback()"
      );
    }
  }

  /**
   * Finish the transaction
   */
  finish(): void {
    try {
      this.nativeTransaction.finish();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Transaction.finish()"
      );
    }
  }
}

/**
 * High-level wrapper around RusqliteConnection with auto serialization/deserialization
 */
export class Database {
  private readonly nativeConnection: NativeConnection;

  /**
   * Open a database file
   */
  static open(path: string, options?: RusqliteConnectionOptions): Database {
    try {
      const connection = NativeConnection.open(path, options);
      return new Database(connection);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.open()"
      );
    }
  }

  /**
   * Open an in-memory database
   */
  static openInMemory(options?: RusqliteConnectionOptions): Database {
    try {
      const connection = NativeConnection.openInMemory(options);
      return new Database(connection);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.openInMemory()"
      );
    }
  }

  constructor(connection: NativeConnection) {
    this.nativeConnection = connection;
  }

  /**
   * Execute a query and return all rows
   */
  queryAll<T extends Record<string, any> = Record<string, any>>(
    sql: string,
    params?: unknown[]
  ): T[] {
    try {
      const serialized = Serialization.serializeParams(params);
      const stmt = this.nativeConnection.prepare(sql);
      const rows = new Rows<T>(stmt.query(serialized));
      return rows.all();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.queryAll()",
        sql,
        params
      );
    }
  }

  /**
   * Execute a query and return first row, or undefined if no rows
   */
  queryOne<T extends Record<string, any> = Record<string, any>>(
    sql: string,
    params?: unknown[]
  ): T | undefined {
    try {
      const serialized = Serialization.serializeParams(params);
      const buffer = this.nativeConnection.queryOne(sql, serialized);
      return Serialization.deserializeRow(buffer) as T;
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.queryOne()",
        sql,
        params
      );
    }
  }

  /**
   * Execute DDL/DML statement and return affected row count
   */
  exec(sql: string): number {
    try {
      return this.nativeConnection.execute(sql, Buffer.from(JSON.stringify([])));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.exec()",
        sql
      );
    }
  }

  /**
   * Check if a query returns any rows
   */
  exists(sql: string, params?: unknown[]): boolean {
    try {
      const serialized = Serialization.serializeParams(params);
      return this.nativeConnection.prepare(sql).exists(serialized);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.exists()",
        sql,
        params
      );
    }
  }

  /**
   * Execute a transaction with auto commit/rollback
   */
  withTransaction<T = void>(callback: (db: Database) => T): T {
    const txn = this.transaction();
    try {
      const result = callback(this);
      txn.commit();
      return result;
    } catch (error) {
      try {
        txn.rollback();
      } catch (rollbackError) {
      }
      throw error;
    } finally {
      txn.finish()
    }
  }

  /**
   * Prepare a statement for reuse
   */
  prepare(sql: string): Statement {
    try {
      return new Statement(this.nativeConnection.prepare(sql));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.prepare()",
        sql
      );
    }
  }

  /**
   * Prepare a statement with flags
   */
  prepareWithFlags(sql: string, flags: RusqlitePrepFlags): Statement {
    try {
      return new Statement(this.nativeConnection.prepareWithFlags(sql, flags));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.prepareWithFlags()",
        sql
      );
    }
  }

  /**
   * Create a transaction
   */
  transaction(): Transaction {
    try {
      return new Transaction(this.nativeConnection.transaction());
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.transaction()"
      );
    }
  }

  /**
   * Create a transaction with specified behavior
   */
  transactionWithBehavior(behavior: RusqliteTransactionBehavior): Transaction {
    try {
      return new Transaction(this.nativeConnection.transactionWithBehavior(behavior));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.transactionWithBehavior()"
      );
    }
  }

  /**
   * Create an unchecked transaction
   */
  uncheckedTransaction(): Transaction {
    try {
      return new Transaction(this.nativeConnection.uncheckedTransaction());
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.uncheckedTransaction()"
      );
    }
  }

  /**
   * Create a savepoint
   */
  savepoint(): Savepoint {
    try {
      return new Savepoint(this.nativeConnection.savepoint());
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.savepoint()"
      );
    }
  }

  /**
   * Create a named savepoint
   */
  savepointWithName(name: string): Savepoint {
    try {
      return new Savepoint(this.nativeConnection.savepointWithName(name));
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.savepointWithName()"
      );
    }
  }

  /**
   * Execute batch SQL (multiple statements)
   */
  executeBatch(sql: string): void {
    try {
      this.nativeConnection.executeBatch(sql);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.executeBatch()",
        sql
      );
    }
  }

  /**
   * Check if table exists
   */
  tableExists(dbName: string | null | undefined, tableName: string): boolean {
    try {
      return this.nativeConnection.tableExists(dbName, tableName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.tableExists()"
      );
    }
  }

  /**
   * Check if column exists
   */
  columnExists(
    dbName: string | null | undefined,
    tableName: string,
    columnName: string
  ): boolean {
    try {
      return this.nativeConnection.columnExists(dbName, tableName, columnName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.columnExists()"
      );
    }
  }

  /**
   * Get column metadata
   */
  columnMetadata(
    dbName: string | null | undefined,
    tableName: string,
    columnName: string
  ): RusqliteConnectionColumnMetadata {
    try {
      return this.nativeConnection.columnMetadata(dbName, tableName, columnName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.columnMetadata()"
      );
    }
  }

  /**
   * Configure database options
   */
  dbConfig(config: RusqliteDbConfig): void {
    try {
      this.nativeConnection.dbConfig(config);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.dbConfig()"
      );
    }
  }

  /**
   * Set database configuration
   */
  setDbConfig(config: RusqliteDbConfig, on: boolean): void {
    try {
      this.nativeConnection.setDbConfig(config, on);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.setDbConfig()"
      );
    }
  }

  /**
   * Query a pragma value
   */
  pragmaQueryValue(schemaName: string | null | undefined, pragmaName: string): Buffer {
    try {
      return this.nativeConnection.pragmaQueryValue(schemaName, pragmaName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.pragmaQueryValue()"
      );
    }
  }

  /**
   * Query PRAGMA
   */
  pragmaQuery(schemaName: string | null | undefined, pragmaName: string): Buffer {
    try {
      return this.nativeConnection.pragmaQuery(schemaName, pragmaName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.pragmaQuery()"
      );
    }
  }

  /**
   * Execute PRAGMA with callback
   */
  pragma(
    schemaName: string | null | undefined,
    pragmaName: string,
    pragmaValue: Uint8Array,
    callback: (err: Error | null, arg: Buffer) => any
  ): void {
    try {
      this.nativeConnection.pragma(schemaName, pragmaName, pragmaValue, (err, result) => {
        if (err) {
          callback(RusqliteError.wrap(err, "Database.pragma()"), result);
        } else {
          callback(null, result);
        }
      });
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.pragma()"
      );
    }
  }

  /**
   * Update PRAGMA
   */
  pragmaUpdate(schemaName: string | null | undefined, pragmaName: string, pragmaValue: Uint8Array): void {
    try {
      this.nativeConnection.pragmaUpdate(schemaName, pragmaName, pragmaValue);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.pragmaUpdate()"
      );
    }
  }

  /**
   * Update PRAGMA and check result
   */
  pragmaUpdateAndCheck(
    schemaName: string | null | undefined,
    pragmaName: string,
    pragmaValue: Uint8Array
  ): Buffer {
    try {
      return this.nativeConnection.pragmaUpdateAndCheck(schemaName, pragmaName, pragmaValue);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.pragmaUpdateAndCheck()"
      );
    }
  }

  /**
   * Get interrupt handle for cancelling queries
   */
  getInterruptHandle(): RusqliteInterruptHandle {
    try {
      return this.nativeConnection.getInterruptHandle();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.getInterruptHandle()"
      );
    }
  }

  /**
   * Get transaction state
   */
  transactionState(dbName?: string | null | undefined): RusqliteTransactionState {
    try {
      return this.nativeConnection.transactionState(dbName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.transactionState()"
      );
    }
  }

  /**
   * Set transaction behavior
   */
  setTransactionBehavior(behavior: RusqliteTransactionBehavior): void {
    try {
      this.nativeConnection.setTransactionBehavior(behavior);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.setTransactionBehavior()"
      );
    }
  }

  /**
   * Get last inserted rowid
   */
  lastInsertRowid(): number {
    try {
      return this.nativeConnection.lastInsertRowid();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.lastInsertRowid()"
      );
    }
  }

  /**
   * Get number of changes
   */
  changes(): number {
    try {
      return this.nativeConnection.changes();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.changes()"
      );
    }
  }

  /**
   * Get total number of changes
   */
  totalChanges(): number {
    try {
      return this.nativeConnection.totalChanges();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.totalChanges()"
      );
    }
  }

  /**
   * Check if autocommit is enabled
   */
  isAutocommit(): boolean {
    try {
      return this.nativeConnection.isAutocommit();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.isAutocommit()"
      );
    }
  }

  /**
   * Check if database is busy
   */
  isBusy(): boolean {
    try {
      return this.nativeConnection.isBusy();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.isBusy()"
      );
    }
  }

  /**
   * Get database path
   */
  path(): string {
    try {
      return this.nativeConnection.path();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.path()"
      );
    }
  }

  /**
   * Release memory
   */
  releaseMemory(): void {
    try {
      this.nativeConnection.releaseMemory();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.releaseMemory()"
      );
    }
  }

  /**
   * Cache flush
   */
  cacheFlush(): void {
    try {
      this.nativeConnection.cacheFlush();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.cacheFlush()"
      );
    }
  }

  /**
   * Check if database is read-only
   */
  isReadonly(dbName: string): boolean {
    try {
      return this.nativeConnection.isReadonly(dbName);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.isReadonly()"
      );
    }
  }

  /**
   * Get database name at index
   */
  dbName(index: number): string {
    try {
      return this.nativeConnection.dbName(index);
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.dbName()"
      );
    }
  }

  /**
   * Check if database was interrupted
   */
  isInterrupted(): boolean {
    try {
      return this.nativeConnection.isInterrupted();
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.isInterrupted()"
      );
    }
  }

  /**
   * Backup database
   */
  backup(name: string, dstPath: string, callback: (err: Error | null, arg: Progress) => any): void {
    try {
      this.nativeConnection.backup(name, dstPath, (err, progress) => {
        if (err) {
          callback(RusqliteError.wrap(err, "Database.backup()"), progress);
        } else {
          callback(null, progress);
        }
      });
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.backup()"
      );
    }
  }

  /**
   * Restore database
   */
  restore(name: string, srcPath: string, callback: (err: Error | null, arg: Progress) => any): void {
    try {
      this.nativeConnection.restore(name, srcPath, (err, progress) => {
        if (err) {
          callback(RusqliteError.wrap(err, "Database.restore()"), progress);
        } else {
          callback(null, progress);
        }
      });
    } catch (error) {
      throw RusqliteError.wrap(
        error instanceof Error ? error : new Error(String(error)),
        "Database.restore()"
      );
    }
  }
}