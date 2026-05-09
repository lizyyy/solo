import { v4 as uuidv4 } from 'uuid';
import {
  StressTestConfig,
  StressTestResult,
} from '../types';
import { DatabaseService } from '../core/DatabaseService';
import { isLockError } from '../config/default';

export interface WorkerResult {
  workerId: number;
  operationsCompleted: number;
  operationsFailed: number;
  lockErrors: number;
  latencies: number[];
  errors: Array<{
    timestamp: number;
    message: string;
    isLockError: boolean;
  }>;
}

export class StressTestRunner {
  private readonly service: DatabaseService;

  constructor(service: DatabaseService) {
    this.service = service;
  }

  async setupSchema(): Promise<void> {
    await this.service.run(`
      CREATE TABLE IF NOT EXISTS stress_test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.service.run(`
      CREATE TABLE IF NOT EXISTS stress_test_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES stress_test_users(id)
      )
    `);

    await this.service.run(`
      CREATE INDEX IF NOT EXISTS idx_stress_test_orders_user_id 
      ON stress_test_orders(user_id)
    `);
  }

  async insertSeedData(userCount: number = 100): Promise<void> {
    for (let i = 0; i < userCount; i++) {
      await this.service.run(
        `INSERT INTO stress_test_users (name, email, balance) VALUES (?, ?, ?)`,
        [
          `User ${i + 1}`,
          `user${i + 1}@test.com`,
          Math.random() * 10000
        ]
      );
    }
  }

  async run(config: Partial<StressTestConfig> = {}): Promise<StressTestResult> {
    const effectiveConfig: StressTestConfig = {
      concurrentConnections: config.concurrentConnections || 10,
      operationsPerConnection: config.operationsPerConnection || 100,
      readWriteRatio: config.readWriteRatio || 0.7,
      transactionProbability: config.transactionProbability || 0.3,
      minDelayMs: config.minDelayMs || 0,
      maxDelayMs: config.maxDelayMs || 50,
      runtimeMs: config.runtimeMs || 0,
    };

    await this.setupSchema();

    const startTime = Date.now();
    const workers: Promise<WorkerResult>[] = [];

    for (let i = 0; i < effectiveConfig.concurrentConnections; i++) {
      workers.push(this.runWorker(i, effectiveConfig));
    }

    const workerResults = await Promise.all(workers);

    const endTime = Date.now();
    const totalDurationMs = endTime - startTime;

    const result = this.aggregateResults(workerResults, totalDurationMs);

    return result;
  }

  private async runWorker(
    workerId: number,
    config: StressTestConfig
  ): Promise<WorkerResult> {
    const result: WorkerResult = {
      workerId,
      operationsCompleted: 0,
      operationsFailed: 0,
      lockErrors: 0,
      latencies: [],
      errors: [],
    };

    const startTime = Date.now();

    for (let i = 0; i < config.operationsPerConnection; i++) {
      if (config.runtimeMs > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= config.runtimeMs) {
          break;
        }
      }

      if (config.maxDelayMs > 0) {
        const delay = config.minDelayMs + Math.random() * (config.maxDelayMs - config.minDelayMs);
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      const useTransaction = Math.random() < config.transactionProbability;
      const isRead = Math.random() < config.readWriteRatio;

      const opStartTime = Date.now();

      try {
        if (useTransaction) {
          await this.executeTransactionOperation(isRead);
        } else {
          await this.executeSingleOperation(isRead);
        }

        result.operationsCompleted++;
        result.latencies.push(Date.now() - opStartTime);
      } catch (error) {
        const err = error as { message?: string; code?: string };
        result.operationsFailed++;

        const isLock = isLockError(error);
        if (isLock) {
          result.lockErrors++;
        }

        result.errors.push({
          timestamp: Date.now(),
          message: err.message || String(error),
          isLockError: isLock,
        });
      }
    }

    return result;
  }

  private async executeSingleOperation(isRead: boolean): Promise<void> {
    if (isRead) {
      const userId = Math.floor(Math.random() * 100) + 1;
      await this.service.all(
        `SELECT * FROM stress_test_users WHERE id = ?`,
        [userId]
      );
    } else {
      const userId = Math.floor(Math.random() * 100) + 1;
      const amount = Math.random() * 100;

      await this.service.run(
        `UPDATE stress_test_users SET balance = balance + ? WHERE id = ?`,
        [amount, userId]
      );

      await this.service.run(
        `INSERT INTO stress_test_orders (user_id, product, amount) VALUES (?, ?, ?)`,
        [userId, `Product ${Math.floor(Math.random() * 100)}`, amount]
      );
    }
  }

  private async executeTransactionOperation(isRead: boolean): Promise<void> {
    await this.service.transaction(async (tx) => {
      if (isRead) {
        const userId = Math.floor(Math.random() * 100) + 1;
        const user = tx.get(
          `SELECT * FROM stress_test_users WHERE id = ?`,
          [userId]
        );

        if (user) {
          tx.all(
            `SELECT * FROM stress_test_orders WHERE user_id = ?`,
            [userId]
          );
        }
      } else {
        const fromUserId = Math.floor(Math.random() * 100) + 1;
        let toUserId = Math.floor(Math.random() * 100) + 1;

        while (toUserId === fromUserId) {
          toUserId = Math.floor(Math.random() * 100) + 1;
        }

        const amount = Math.random() * 100;

        tx.run(
          `UPDATE stress_test_users SET balance = balance - ? WHERE id = ?`,
          [amount, fromUserId]
        );

        tx.run(
          `UPDATE stress_test_users SET balance = balance + ? WHERE id = ?`,
          [amount, toUserId]
        );

        tx.run(
          `INSERT INTO stress_test_orders (user_id, product, amount) VALUES (?, ?, ?)`,
          [fromUserId, `Transfer to ${toUserId}`, -amount]
        );

        tx.run(
          `INSERT INTO stress_test_orders (user_id, product, amount) VALUES (?, ?, ?)`,
          [toUserId, `Transfer from ${fromUserId}`, amount]
        );
      }
    });
  }

  private aggregateResults(
    workerResults: WorkerResult[],
    totalDurationMs: number
  ): StressTestResult {
    const allLatencies: number[] = [];
    const allErrors: Array<{
      timestamp: number;
      message: string;
      isLockError: boolean;
    }> = [];

    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;
    let lockErrors = 0;

    for (const result of workerResults) {
      totalOperations += result.operationsCompleted + result.operationsFailed;
      successfulOperations += result.operationsCompleted;
      failedOperations += result.operationsFailed;
      lockErrors += result.lockErrors;
      allLatencies.push(...result.latencies);
      allErrors.push(...result.errors);
    }

    allLatencies.sort((a, b) => a - b);

    const avgLatencyMs = allLatencies.length > 0
      ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length
      : 0;

    const p95Index = Math.floor(allLatencies.length * 0.95);
    const p99Index = Math.floor(allLatencies.length * 0.99);

    const p95LatencyMs = allLatencies[p95Index] || 0;
    const p99LatencyMs = allLatencies[p99Index] || 0;

    const operationsPerSecond = totalDurationMs > 0
      ? (totalOperations / totalDurationMs) * 1000
      : 0;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      lockErrors,
      avgLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      totalDurationMs,
      operationsPerSecond,
      errors: allErrors,
    };
  }

  async cleanup(): Promise<void> {
    try {
      await this.service.run(`DROP TABLE IF EXISTS stress_test_orders`);
      await this.service.run(`DROP TABLE IF EXISTS stress_test_users`);
    } catch {
      // ignore cleanup errors
    }
  }
}
