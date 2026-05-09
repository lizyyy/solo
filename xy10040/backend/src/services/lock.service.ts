import { v4 as uuidv4 } from 'uuid';
import { db, DatabaseClient } from '../database/client';
import { config } from '../config';
import { LockAcquisitionError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface Lock {
  key: string;
  holderId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export class DistributedLockService {
  private async acquireWithClient(
    client: DatabaseClient,
    key: string,
    holderId: string,
    timeoutMs: number
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + timeoutMs);

    const result = await client.query(
      `INSERT INTO distributed_locks (lock_key, holder_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (lock_key) DO UPDATE
       SET holder_id = EXCLUDED.holder_id,
           acquired_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at
       WHERE distributed_locks.expires_at < CURRENT_TIMESTAMP
       OR distributed_locks.holder_id = $2
       RETURNING *`,
      [key, holderId, expiresAt]
    );

    return result.rows.length > 0;
  }

  private async releaseWithClient(
    client: DatabaseClient,
    key: string,
    holderId: string
  ): Promise<boolean> {
    const result = await client.query(
      `DELETE FROM distributed_locks
       WHERE lock_key = $1 AND holder_id = $2
       RETURNING *`,
      [key, holderId]
    );
    return result.rows.length > 0;
  }

  async acquire(
    key: string,
    timeoutMs: number = config.lock.defaultTimeoutMs,
    maxRetries: number = 3,
    retryDelayMs: number = 100
  ): Promise<Lock> {
    const holderId = uuidv4();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const acquired = await db.transaction(async (client) => {
          await client.query(
            `DELETE FROM distributed_locks WHERE expires_at < CURRENT_TIMESTAMP`
          );
          return this.acquireWithClient(client, key, holderId, timeoutMs);
        });

        if (acquired) {
          return {
            key,
            holderId,
            acquiredAt: new Date(),
            expiresAt: new Date(Date.now() + timeoutMs),
          };
        }

        if (attempt < maxRetries) {
          logger.debug(`Lock acquisition failed, retrying...`, { key, attempt });
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        }
      } catch (error) {
        logger.error('Lock acquisition error', { key, error: (error as Error).message });
        if (attempt === maxRetries) {
          throw new LockAcquisitionError(
            `Failed to acquire lock for key: ${key}`
          );
        }
      }
    }

    throw new LockAcquisitionError(
      `Failed to acquire lock for key: ${key} after ${maxRetries} retries`
    );
  }

  async release(lock: Lock): Promise<boolean> {
    try {
      return await this.releaseWithClient(
        (await db.getClient()) as unknown as DatabaseClient,
        lock.key,
        lock.holderId
      );
    } catch (error) {
      logger.error('Lock release error', {
        key: lock.key,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async executeWithLock<T>(
    key: string,
    callback: () => Promise<T>,
    timeoutMs: number = config.lock.defaultTimeoutMs
  ): Promise<T> {
    const lock = await this.acquire(key, timeoutMs);
    try {
      return await callback();
    } finally {
      await this.release(lock);
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM distributed_locks
       WHERE lock_key = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [key]
    );
    return result.rows.length > 0;
  }
}

export const lockService = new DistributedLockService();
