import { v4 as uuidv4 } from 'uuid';
import {
  DatabaseConfig,
  OperationType,
  LogEntry,
  TransactionContext,
  TransactionState,
  LockStateSnapshot,
  DatabaseStateSnapshot,
} from '../types';
import { ConnectionPool } from './ConnectionPool';
import { RetryExecutor } from './RetryExecutor';
import { DatabaseConnection } from './DatabaseConnection';
import { isLockError } from '../config/default';
import { Logger } from '../logging/Logger';

export class DatabaseService {
  private readonly config: DatabaseConfig;
  private readonly pool: ConnectionPool;
  private readonly retryExecutor: RetryExecutor;
  private readonly logger: Logger;
  private readonly activeTransactions = new Map<string, TransactionContext>();

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.pool = new ConnectionPool(config);
    this.retryExecutor = new RetryExecutor(config.retryConfig);
  }

  getLogger(): Logger {
    return this.logger;
  }

  getPool(): ConnectionPool {
    return this.pool;
  }

  private getLockStateSnapshot(connection: DatabaseConnection): LockStateSnapshot {
    const checkpoint = connection.checkpoint();
    return {
      connectionId: connection.id,
      lockType: connection.getLockType(),
      walFileSize: checkpoint.log,
      checkpointProgress: checkpoint.log > 0 ? checkpoint.checkpointed / checkpoint.log : 1,
      pendingWrites: checkpoint.log - checkpoint.checkpointed,
      activeReaders: 0,
    };
  }

  private createLogEntry(
    operationType: OperationType,
    sql?: string,
    params?: unknown[],
    transactionId?: string | null,
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      id: uuidv4(),
      timestamp: Date.now(),
      operationId: uuidv4(),
      transactionId: transactionId || null,
      connectionId: uuidv4(),
      operationType,
      sql,
      params,
      startTime: Date.now(),
      status: 'PENDING',
      lockState: {
        connectionId: uuidv4(),
        lockType: 'NONE',
        walFileSize: 0,
        checkpointProgress: 1,
        pendingWrites: 0,
        activeReaders: 0,
      },
      retryCount: 0,
      metadata,
    };
  }

  async run(sql: string, params?: unknown[], metadata?: Record<string, unknown>): Promise<{ changes: number; lastInsertRowid: number | bigint }> {
    const logEntry = this.createLogEntry('WRITE', sql, params, null, metadata);

    return this.retryExecutor.execute(
      async (): Promise<{ changes: number; lastInsertRowid: number | bigint }> => {
        const connection = await this.pool.acquire();
        logEntry.connectionId = connection.id;
        logEntry.lockState = this.getLockStateSnapshot(connection);
        this.logger.logOperationStart(logEntry);

        try {
          const result = connection.run(sql, params);
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'SUCCESS';
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);

          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        } catch (error) {
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'FAILED';
          logEntry.error = this.serializeError(error);
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);
          throw error;
        } finally {
          this.pool.release(connection);
        }
      },
      (retryCount, error) => {
        logEntry.retryCount = retryCount;
        logEntry.status = 'RETRY';
        this.logger.logRetry(logEntry, retryCount, error);
      }
    );
  }

  async get<T = unknown>(sql: string, params?: unknown[], metadata?: Record<string, unknown>): Promise<T | undefined> {
    const logEntry = this.createLogEntry('READ', sql, params, null, metadata);

    return this.retryExecutor.execute(
      async (): Promise<T | undefined> => {
        const connection = await this.pool.acquire();
        logEntry.connectionId = connection.id;
        logEntry.lockState = this.getLockStateSnapshot(connection);
        this.logger.logOperationStart(logEntry);

        try {
          const result = connection.get<T>(sql, params);
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'SUCCESS';
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);

          return result;
        } catch (error) {
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'FAILED';
          logEntry.error = this.serializeError(error);
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);
          throw error;
        } finally {
          this.pool.release(connection);
        }
      },
      (retryCount, error) => {
        logEntry.retryCount = retryCount;
        logEntry.status = 'RETRY';
        this.logger.logRetry(logEntry, retryCount, error);
      }
    );
  }

  async all<T = unknown>(sql: string, params?: unknown[], metadata?: Record<string, unknown>): Promise<T[]> {
    const logEntry = this.createLogEntry('READ', sql, params, null, metadata);

    return this.retryExecutor.execute(
      async (): Promise<T[]> => {
        const connection = await this.pool.acquire();
        logEntry.connectionId = connection.id;
        logEntry.lockState = this.getLockStateSnapshot(connection);
        this.logger.logOperationStart(logEntry);

        try {
          const result = connection.all<T>(sql, params);
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'SUCCESS';
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);

          return result;
        } catch (error) {
          logEntry.endTime = Date.now();
          logEntry.duration = logEntry.endTime - logEntry.startTime;
          logEntry.status = 'FAILED';
          logEntry.error = this.serializeError(error);
          logEntry.lockState = this.getLockStateSnapshot(connection);
          this.logger.logOperationEnd(logEntry);
          throw error;
        } finally {
          this.pool.release(connection);
        }
      },
      (retryCount, error) => {
        logEntry.retryCount = retryCount;
        logEntry.status = 'RETRY';
        this.logger.logRetry(logEntry, retryCount, error);
      }
    );
  }

  async transaction<T>(
    callback: (tx: TransactionService) => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const connection = await this.pool.acquire();
    const transactionId = uuidv4();

    const txContext: TransactionContext = {
      id: transactionId,
      connectionId: connection.id,
      state: 'PENDING',
      startTime: Date.now(),
      operations: [],
      isDirty: false,
      savepoints: [],
    };

    const logEntry = this.createLogEntry('BEGIN_TRANSACTION', undefined, undefined, transactionId, metadata);
    logEntry.connectionId = connection.id;
    logEntry.lockState = this.getLockStateSnapshot(connection);
    this.logger.logTransactionStart(logEntry, txContext);

    try {
      connection.beginTransaction();
      txContext.state = 'ACTIVE';
      this.activeTransactions.set(transactionId, txContext);

      const tx = new TransactionService(
        connection,
        txContext,
        this.retryExecutor,
        this.logger
      );

      const result = await callback(tx);

      connection.commit();
      txContext.state = 'COMMITTED';
      txContext.endTime = Date.now();

      logEntry.operationType = 'COMMIT';
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'SUCCESS';
      logEntry.lockState = this.getLockStateSnapshot(connection);
      this.logger.logTransactionEnd(logEntry, txContext);

      return result;
    } catch (error) {
      try {
        connection.rollback();
      } catch {
        // ignore rollback errors
      }

      txContext.state = 'ROLLED_BACK';
      txContext.endTime = Date.now();

      logEntry.operationType = 'ROLLBACK';
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'FAILED';
      logEntry.error = this.serializeError(error);
      logEntry.lockState = this.getLockStateSnapshot(connection);
      this.logger.logTransactionEnd(logEntry, txContext);

      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
      this.pool.release(connection);
    }
  }

  private serializeError(error: unknown) {
    const err = error as { message?: string; code?: string; stack?: string };
    return {
      message: err.message || String(error),
      code: err.code || 'UNKNOWN',
      stack: err.stack,
      isLockError: isLockError(error),
    };
  }

  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  getDatabaseStateSnapshot(connection?: DatabaseConnection): DatabaseStateSnapshot {
    const snapshot: DatabaseStateSnapshot = {
      dbPath: this.config.dbPath,
      journalMode: this.config.journalMode,
      autoCommit: true,
      walCheckpoint: {
        busy: 0,
        log: 0,
        checkpointed: 0,
      },
      pageSize: 0,
      pageCount: 0,
      freelistCount: 0,
    };

    if (connection) {
      const checkpoint = connection.checkpoint();
      snapshot.walCheckpoint = checkpoint;

      try {
        const db = connection.getDatabase();
        const pageSize = db.pragma('page_size', { simple: true }) as { page_size: number }[];
        const pageCount = db.pragma('page_count', { simple: true }) as { page_count: number }[];
        const freelistCount = db.pragma('freelist_count', { simple: true }) as { freelist_count: number }[];

        if (pageSize?.[0]?.page_size) snapshot.pageSize = pageSize[0].page_size;
        if (pageCount?.[0]?.page_count) snapshot.pageCount = pageCount[0].page_count;
        if (freelistCount?.[0]?.freelist_count) snapshot.freelistCount = freelistCount[0].freelist_count;
      } catch {
        // ignore
      }
    }

    return snapshot;
  }

  close(): void {
    this.pool.close();
  }
}

export class TransactionService {
  private readonly connection: DatabaseConnection;
  private readonly context: TransactionContext;
  private readonly retryExecutor: RetryExecutor;
  private readonly logger: Logger;

  constructor(
    connection: DatabaseConnection,
    context: TransactionContext,
    retryExecutor: RetryExecutor,
    logger: Logger
  ) {
    this.connection = connection;
    this.context = context;
    this.retryExecutor = retryExecutor;
    this.logger = logger;
  }

  run(sql: string, params?: unknown[], metadata?: Record<string, unknown>): { changes: number; lastInsertRowid: number | bigint } {
    this.context.isDirty = true;
    this.context.operations.push(sql);

    const logEntry = this.createLogEntry('WRITE', sql, params, metadata);
    this.logger.logOperationStart(logEntry);

    try {
      const result = this.connection.run(sql, params);
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'SUCCESS';
      this.logger.logOperationEnd(logEntry);

      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'FAILED';
      logEntry.error = this.serializeError(error);
      this.logger.logOperationEnd(logEntry);
      throw error;
    }
  }

  get<T = unknown>(sql: string, params?: unknown[], metadata?: Record<string, unknown>): T | undefined {
    const logEntry = this.createLogEntry('READ', sql, params, metadata);
    this.logger.logOperationStart(logEntry);

    try {
      const result = this.connection.get<T>(sql, params);
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'SUCCESS';
      this.logger.logOperationEnd(logEntry);

      return result;
    } catch (error) {
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'FAILED';
      logEntry.error = this.serializeError(error);
      this.logger.logOperationEnd(logEntry);
      throw error;
    }
  }

  all<T = unknown>(sql: string, params?: unknown[], metadata?: Record<string, unknown>): T[] {
    const logEntry = this.createLogEntry('READ', sql, params, metadata);
    this.logger.logOperationStart(logEntry);

    try {
      const result = this.connection.all<T>(sql, params);
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'SUCCESS';
      this.logger.logOperationEnd(logEntry);

      return result;
    } catch (error) {
      logEntry.endTime = Date.now();
      logEntry.duration = logEntry.endTime - logEntry.startTime;
      logEntry.status = 'FAILED';
      logEntry.error = this.serializeError(error);
      this.logger.logOperationEnd(logEntry);
      throw error;
    }
  }

  savepoint(name: string): void {
    this.context.savepoints.push(name);
    this.run(`SAVEPOINT ${name}`);
  }

  rollbackTo(name: string): void {
    const index = this.context.savepoints.indexOf(name);
    if (index !== -1) {
      this.context.savepoints.splice(index, 1);
      this.run(`ROLLBACK TO ${name}`);
    }
  }

  release(name: string): void {
    const index = this.context.savepoints.indexOf(name);
    if (index !== -1) {
      this.context.savepoints.splice(index, 1);
      this.run(`RELEASE ${name}`);
    }
  }

  getTransactionId(): string {
    return this.context.id;
  }

  getConnectionId(): string {
    return this.connection.id;
  }

  private createLogEntry(
    operationType: OperationType,
    sql?: string,
    params?: unknown[],
    metadata?: Record<string, unknown>
  ): LogEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      operationId: crypto.randomUUID(),
      transactionId: this.context.id,
      connectionId: this.connection.id,
      operationType,
      sql,
      params,
      startTime: Date.now(),
      status: 'PENDING',
      lockState: {
        connectionId: this.connection.id,
        lockType: this.connection.getLockType(),
        walFileSize: this.connection.getWALFileSize(),
        checkpointProgress: 1,
        pendingWrites: 0,
        activeReaders: 0,
      },
      retryCount: 0,
      metadata,
    };
  }

  private serializeError(error: unknown) {
    const err = error as { message?: string; code?: string; stack?: string };
    return {
      message: err.message || String(error),
      code: err.code || 'UNKNOWN',
      stack: err.stack,
      isLockError: isLockError(error),
    };
  }
}
