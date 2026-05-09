import { DatabaseConfig } from '../types';
import { DatabaseConnection } from './DatabaseConnection';

export class ConnectionPool {
  private readonly config: DatabaseConfig;
  private readonly connections: DatabaseConnection[] = [];
  private readonly pendingAcquires: Array<(conn: DatabaseConnection) => void> = [];
  private isClosed = false;
  private readonly maxPoolSize: number;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.maxPoolSize = config.maxPoolSize;
    this.initializePool();
  }

  private initializePool(): void {
    const initialSize = Math.min(1, this.maxPoolSize);
    for (let i = 0; i < initialSize; i++) {
      this.connections.push(new DatabaseConnection(this.config));
    }
  }

  private createConnection(): DatabaseConnection {
    return new DatabaseConnection(this.config);
  }

  private getAvailableConnection(): DatabaseConnection | null {
    const available = this.connections.find((conn) => conn.isAvailable());
    if (available) {
      return available;
    }

    if (this.connections.length < this.maxPoolSize) {
      const newConn = this.createConnection();
      this.connections.push(newConn);
      return newConn;
    }

    return null;
  }

  async acquire(): Promise<DatabaseConnection> {
    if (this.isClosed) {
      throw new Error('Connection pool is closed');
    }

    const available = this.getAvailableConnection();
    if (available) {
      available.acquire();
      return available;
    }

    return new Promise((resolve) => {
      this.pendingAcquires.push((conn) => {
        conn.acquire();
        resolve(conn);
      });
    });
  }

  release(connection: DatabaseConnection): void {
    if (this.isClosed) {
      return;
    }

    if (!this.connections.includes(connection)) {
      throw new Error('Connection not in pool');
    }

    if (connection.isInTransactionState()) {
      connection.rollback();
    }

    connection.release();

    if (this.pendingAcquires.length > 0) {
      const nextAcquire = this.pendingAcquires.shift();
      if (nextAcquire) {
        nextAcquire(connection);
      }
    }
  }

  getSize(): number {
    return this.connections.length;
  }

  getActiveCount(): number {
    return this.connections.filter((c) => !c.isAvailable()).length;
  }

  getIdleCount(): number {
    return this.connections.filter((c) => c.isAvailable()).length;
  }

  getPendingCount(): number {
    return this.pendingAcquires.length;
  }

  close(): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    this.pendingAcquires.forEach((acquire) => {
      const errConn = {
        acquire: () => {
          throw new Error('Connection pool is closed');
        },
      } as unknown as DatabaseConnection;
      acquire(errConn);
    });

    this.connections.forEach((conn) => conn.close());
    this.connections.length = 0;
    this.pendingAcquires.length = 0;
  }

  isPoolClosed(): boolean {
    return this.isClosed;
  }
}
