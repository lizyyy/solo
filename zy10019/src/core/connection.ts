import { v4 as uuidv4 } from 'uuid';
import { ConnectionState, ConnectionInfo, PoolError, ConnectionConfig } from '../types';
import { createPoolError } from '../utils/errors';

export interface ConnectionClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  validate(): Promise<boolean>;
  query(sql: string, params?: unknown[]): Promise<unknown>;
  isConnected(): boolean;
}

export class MockConnectionClient implements ConnectionClient {
  private connected: boolean = false;
  private config: ConnectionConfig;
  private latency: number = 50;

  constructor(config: ConnectionConfig, latency?: number) {
    this.config = config;
    if (latency !== undefined) {
      this.latency = latency;
    }
  }

  async connect(): Promise<void> {
    await this.delay(this.latency);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.delay(this.latency / 2);
    this.connected = false;
  }

  async validate(): Promise<boolean> {
    await this.delay(this.latency / 4);
    return this.connected;
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Connection is not connected');
    }
    await this.delay(this.latency);
    return {
      sql,
      params,
      rows: [],
      affectedRows: 0,
      insertId: null
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class PoolConnection {
  public readonly id: string;
  private state: ConnectionState;
  private createdAt: number;
  private lastUsedAt: number;
  private acquiredAt?: number;
  private useCount: number;
  private totalDuration: number;
  private lastError?: PoolError;
  private borrowedBy?: string;
  private client: ConnectionClient;

  constructor(client: ConnectionClient) {
    this.id = uuidv4();
    this.state = ConnectionState.IDLE;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.useCount = 0;
    this.totalDuration = 0;
    this.client = client;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    this.state = ConnectionState.DESTROYED;
    await this.client.disconnect();
  }

  async validate(): Promise<boolean> {
    try {
      return await this.client.validate();
    } catch (error) {
      this.setError(error);
      return false;
    }
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    try {
      return await this.client.query(sql, params);
    } catch (error) {
      this.setError(error);
      throw error;
    }
  }

  acquire(requestId: string): void {
    this.state = ConnectionState.ACQUIRED;
    this.acquiredAt = Date.now();
    this.borrowedBy = requestId;
  }

  markInUse(): void {
    this.state = ConnectionState.IN_USE;
  }

  release(): number {
    const now = Date.now();
    const duration = this.acquiredAt ? now - this.acquiredAt : 0;
    
    this.state = ConnectionState.IDLE;
    this.lastUsedAt = now;
    this.useCount++;
    this.totalDuration += duration;
    this.acquiredAt = undefined;
    this.borrowedBy = undefined;

    return duration;
  }

  destroy(reason: string): void {
    this.state = ConnectionState.DESTROYED;
    this.setError({
      code: 'DESTROYED',
      message: reason,
      timestamp: Date.now()
    });
  }

  setTimeout(): void {
    this.state = ConnectionState.TIMED_OUT;
  }

  setError(error: unknown): void {
    if (error instanceof Error) {
      this.lastError = {
        code: (error as NodeJS.ErrnoException).code || 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: Date.now(),
        connectionId: this.id,
        stack: error.stack
      };
    } else {
      this.lastError = createPoolError(
        String(error),
        'UNKNOWN_ERROR',
        this.id
      );
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  isIdle(): boolean {
    return this.state === ConnectionState.IDLE;
  }

  isInUse(): boolean {
    return this.state === ConnectionState.IN_USE || this.state === ConnectionState.ACQUIRED;
  }

  isDestroyed(): boolean {
    return this.state === ConnectionState.DESTROYED;
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  getAge(): number {
    return Date.now() - this.createdAt;
  }

  getIdleTime(): number {
    return Date.now() - this.lastUsedAt;
  }

  getUseDuration(): number {
    if (!this.acquiredAt) return 0;
    return Date.now() - this.acquiredAt;
  }

  getInfo(): ConnectionInfo {
    return {
      id: this.id,
      state: this.state,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      acquiredAt: this.acquiredAt,
      useCount: this.useCount,
      totalDuration: this.totalDuration,
      lastError: this.lastError,
      borrowedBy: this.borrowedBy
    };
  }

  getClient(): ConnectionClient {
    return this.client;
  }
}
