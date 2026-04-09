import { RusqliteConnection, RusqliteDbConfig, RusqlitePrepFlags, RusqliteSharedConnection, RusqliteStatement, RusqliteTransaction, RusqliteTransactionBehavior } from "./binding";

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

const Serialization = {
  serializeParams(params?: unknown[]): Buffer {
    if (!params || params.length === 0) {
      return Buffer.from(JSON.stringify([]));
    }
    return Buffer.from(JSON.stringify(params));
  },
  serialize(params:unknown): Buffer {
    if(!params) {
      return Buffer.from([])
    }

    return Buffer.from(JSON.stringify(params))
  },
  deserialize(buffer:Buffer): unknown {
    return JSON.parse(buffer.toString("utf8"))
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

type OmittedSharedConnection = 'pragmaQueryValue' | 'pragmaQuery' | 'pragma' | 'pragmaUpdateAndCheck' | 'transaction' | '_connection' | 'execute' | 'queryOne' | 'queryRow' | 'prepare' | 'prepareWithFlags'

export interface Rusqlite extends RusqliteConnection {}

export class Rusqlite {
  constructor(private readonly conn: RusqliteConnection | RusqliteSharedConnection) {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // 1. Priority: Properties/Methods defined in this class
        if (prop in target) {
          const value = Reflect.get(target, prop, receiver);
          // Bind functions so 'this' inside them stays as Rusqlite
          return typeof value === 'function' ? value.bind(target) : value;
        }

        // 2. Fallback: Properties/Methods from the connection
        const connectionValue = (target as any)._connection[prop];
        return typeof connectionValue === 'function' 
          ? connectionValue.bind((target as any)._connection) 
          : connectionValue;
      }
    });
  }

  get _connection() {
    return this.conn
  }

  pragma(schemaName: string | undefined,pragmaName:string,pragmaValue:unknown,callback?:(arg:unknown) => void) {
    const value = Serialization.serialize(pragmaValue)
    this._connection.pragma(schemaName,pragmaName,value,(err,arg) => {
      if(err) throw err;
      const parsedArg = Serialization.deserialize(arg)
      callback?.(parsedArg)
    })
  }

  pragmaQueryValue(schemaName: string | undefined,pragmaName: string) {
    const result = this._connection.pragmaQueryValue(schemaName,pragmaName)
    return Serialization.deserialize(result)
  }

  pragmaQuery(schemaName:string | undefined, pragmaName: string) {
    const result = this._connection.pragmaQuery(schemaName,pragmaName)
    return Serialization.deserialize(result)
  }

  pragmaUpdate(schemaName: string | undefined,pragmaName: string,pragmaValue: unknown) {
    const value = Serialization.serialize(pragmaValue)
    this._connection.pragmaUpdate(schemaName,pragmaName,value)
  }

  pragmaUpdateAndCheck(schemaName: string | undefined, pragmaName: string,pragmaValue:unknown) {
    const value = Serialization.serialize(pragmaValue)
    const result = this._connection.pragmaUpdateAndCheck(schemaName,pragmaName,value)
    return Serialization.deserialize(result)
  }

  transaction(behavior:RusqliteTransactionBehavior | undefined,callback:(trx:Transaction) => void) {
    
    if(this._connection instanceof RusqliteSharedConnection) {
      throw new Error("already in transaction")
    }

    const mainTrx = behavior ? this._connection.transactionWithBehavior(behavior) : this._connection.transaction();

    const trxWrapper = new Transaction(mainTrx)

    try{
      callback(trxWrapper)
    } catch(err) {
      mainTrx.rollback()
    } finally {
      mainTrx.finish()
    }
  }

  execute(sql:string,sqlParams?:unknown[]) {
    const params = Serialization.serializeParams(sqlParams)
    return this._connection.execute(sql,params)
  }

  queryRow(sql:string,sqlParams?:unknown[]) {
    const params = Serialization.serializeParams(sqlParams)
    const result = this._connection.queryRow(sql,params)
    return Serialization.deserialize(result)
  }

  queryOne(sql:string,sqlParams?:unknown[]) {
    const params = Serialization.serializeParams(sqlParams);
    const result = this._connection.queryOne(sql,params);
    return Serialization.deserialize(result)
  }

  prepare(sql:string) {
    const stmt = this._connection.prepare(sql)
    return new Statement(stmt)
  }

  prepareWithFlags(sql:string,flags:RusqlitePrepFlags) {
    const stmt = this._connection.prepareWithFlags(sql,flags)
    return new Statement(stmt)
  }
}

export type TransactionInstance = Rusqlite & RusqliteTransaction;

export interface Transaction extends TransactionInstance {}

export class Transaction {
  private _cachedConn?: Rusqlite;

  constructor(private readonly transaction: RusqliteTransaction) {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        const rawTrx = (target as any)._transaction;
        if (prop in rawTrx) {
          const value = rawTrx[prop];
          return typeof value === 'function' ? value.bind(rawTrx) : value;
        }

        // Priority 3: Check your Rusqlite wrapper (_connection)
        const wrappedConn = (target as any)._connection;
        if (prop in wrappedConn) {
          const value = wrappedConn[prop];
          return typeof value === 'function' ? value.bind(wrappedConn) : value;
        }
      }
    });
  }

  get _transaction() {
    return this.transaction
  }

  get _connection() {
    if (!this._cachedConn) {
      this._cachedConn = new Rusqlite(this.transaction.connection);
    }
    return this._cachedConn;
  }
}

export interface Statement extends Statement, RusqliteStatement {}

export class Statement {
  constructor(private readonly stmt: RusqliteStatement) {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // 1. Check if the property is defined in this Statement wrapper
        if (prop in target) {
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        }

        // 2. Fallback to the raw RusqliteStatement
        const rawStmt = (target as any).stmt;
        const value = rawStmt[prop];
        return typeof value === 'function' ? value.bind(rawStmt) : value;
      }
    });
  }

  execute(sqlParams?:unknown[]) {
    const params = Serialization.serialize(sqlParams)
    return this.stmt.execute(params)
  }

  insert(sqlParams:unknown[]) {
    const params = Serialization.serialize(sqlParams);
    return this.stmt.insert(params)
  }

  query(sqlParams?:unknown[]) {
    const params = Serialization.serialize(sqlParams);
    return this.stmt.query(params)
  }
}

const conn = RusqliteConnection.openInMemory();

const rusqlite = new Rusqlite(conn)

rusqlite.transaction(undefined,(trx) => {
  const stmt = trx.prepare('')
})