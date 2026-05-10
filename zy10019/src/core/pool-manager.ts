import { EventEmitter } from 'eventemitter3';
import { 
  PoolConfig, 
  PoolState, 
  ConnectionState,
  ConnectionInfo, 
  PoolMetrics,
  PoolEventEmitter,
  PoolEventMap,
  HealthCheckResult,
  PoolError
} from '../types';
import { validatePoolConfig } from '../config';
import { PoolConnection, ConnectionClient, MockConnectionClient } from './connection';
import { PostgresClient, MySQLClient } from './db-clients';
import { DatabaseType } from '../types';
import { MetricsCollector } from '../utils/metrics';
import { PoolLogger } from '../utils/logger';
import { 
  PoolException, 
  ConnectionTimeoutException, 
  PoolExhaustedException,
  ConnectionValidationException,
  createPoolError
} from '../utils/errors';

interface PendingRequest {
  requestId: string;
  resolve: (connection: PoolConnection) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

export class PoolManager {
  private readonly config: PoolConfig;
  private readonly connections: Map<string, PoolConnection>;
  private readonly idleQueue: PoolConnection[];
  private readonly pendingRequests: PendingRequest[];
  private state: PoolState;
  private metrics: MetricsCollector;
  private logger: PoolLogger;
  private emitter: PoolEventEmitter;
  private reapTimer?: NodeJS.Timeout;
  private recentErrors: PoolError[];
  private maxRecentErrors: number = 50;

  constructor(config: PoolConfig, clientFactory?: (config: PoolConfig) => ConnectionClient) {
    const validationErrors = validatePoolConfig(config);
    if (validationErrors.length > 0) {
      throw new PoolException(
        `Invalid pool configuration: ${validationErrors.join(', ')}`,
        'INVALID_CONFIG'
      );
    }

    this.config = config;
    this.connections = new Map();
    this.idleQueue = [];
    this.pendingRequests = [];
    this.state = PoolState.INITIALIZING;
    this.metrics = new MetricsCollector();
    this.logger = PoolLogger.getInstance().createChild({ poolName: config.name });
    this.emitter = new EventEmitter() as unknown as PoolEventEmitter;
    this.recentErrors = [];
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing pool ${this.config.name}`, {
      config: {
        min: this.config.min,
        max: this.config.max,
        acquireTimeout: this.config.acquireTimeout,
        idleTimeout: this.config.idleTimeout
      }
    });

    try {
      for (let i = 0; i < this.config.min; i++) {
        const conn = await this.createConnection();
        this.idleQueue.push(conn);
      }

      this.state = PoolState.READY;
      this.startReaper();
      this.emitter.emit('pool:state-change', PoolState.INITIALIZING, PoolState.READY);
      
      this.logger.info(`Pool ${this.config.name} initialized successfully`, {
        totalConnections: this.connections.size,
        availableConnections: this.idleQueue.length
      });
    } catch (error) {
      this.state = PoolState.STOPPED;
      this.logger.error('Failed to initialize pool', error as Error);
      throw error;
    }
  }

  private async createConnection(): Promise<PoolConnection> {
    const dbType = this.config.connection.type || 'mock';
    const client = this.createClient(dbType);
    const conn = new PoolConnection(client);
    
    try {
      await conn.connect();
      this.connections.set(conn.id, conn);
      this.metrics.incrementCreated();
      
      const info = conn.getInfo();
      this.emitter.emit('connection:created', info);
      
      this.logger.debug('Connection created', { 
        connectionId: conn.id,
        dbType 
      });
      return conn;
    } catch (error) {
      this.metrics.incrementError();
      this.logger.error('Failed to create connection', error as Error);
      throw error;
    }
  }

  private createClient(dbType: DatabaseType): ConnectionClient {
    switch (dbType) {
      case 'postgresql':
        return new PostgresClient(this.config.connection);
      case 'mysql':
        return new MySQLClient(this.config.connection);
      case 'mock':
      default:
        return new MockConnectionClient(this.config.connection);
    }
  }

  private async shutdownDatabasePools(): Promise<void> {
    const dbType = this.config.connection.type || 'mock';
    try {
      if (dbType === 'postgresql') {
        await PostgresClient.shutdownPool();
      } else if (dbType === 'mysql') {
        await MySQLClient.shutdownPool();
      }
    } catch (error) {
      this.logger.warn('Error shutting down database pools', {
        error: (error as Error).message
      });
    }
  }

  async acquire(
    requestId?: string, 
    timeout?: number
  ): Promise<PoolConnection> {
    const actualRequestId = requestId || PoolLogger.generateRequestId();
    const actualTimeout = timeout ?? this.config.acquireTimeout;
    const startTime = Date.now();

    this.logger.debug('Acquiring connection', { requestId: actualRequestId });

    if (this.state === PoolState.STOPPED) {
      throw new PoolException(
        'Pool is stopped',
        'POOL_STOPPED',
        undefined,
        actualRequestId
      );
    }

    const existingIdle = this.idleQueue.shift();
    if (existingIdle) {
      if (await this.validateConnection(existingIdle, actualRequestId)) {
        return this.assignConnection(existingIdle, actualRequestId, startTime);
      }
    }

    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values()).filter(
      c => !c.isDestroyed()
    ).length;

    if (activeConnections < this.config.max) {
      try {
        const newConn = await this.createConnection();
        return this.assignConnection(newConn, actualRequestId, startTime);
      } catch (error) {
        this.metrics.incrementError();
        this.addError(createPoolError(
          'Failed to create new connection',
          'CONNECTION_CREATE_FAILED',
          undefined,
          actualRequestId
        ));
      }
    }

    if (this.pendingRequests.length >= this.config.max * 2) {
      this.emitter.emit('request:queue:full');
      this.addError(createPoolError(
        'Request queue is full',
        'QUEUE_FULL',
        undefined,
        actualRequestId
      ));
      throw new PoolExhaustedException(
        this.config.max,
        this.pendingRequests.length,
        actualRequestId
      );
    }

    this.metrics.incrementPending();
    this.updatePoolState();

    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        requestId: actualRequestId,
        resolve: (conn: PoolConnection) => {
          this.metrics.decrementPending();
          const acquireTime = Date.now() - startTime;
          this.metrics.incrementAcquired(acquireTime);
          this.updatePoolState();
          resolve(conn);
        },
        reject: (error: Error) => {
          this.metrics.decrementPending();
          this.metrics.incrementError();
          this.updatePoolState();
          reject(error);
        },
        queuedAt: startTime
      };

      this.pendingRequests.push(request);

      if (actualTimeout > 0) {
        setTimeout(() => {
          const index = this.pendingRequests.indexOf(request);
          if (index !== -1) {
            this.pendingRequests.splice(index, 1);
            const waitTime = Date.now() - startTime;
            
            this.emitter.emit('request:timeout', actualRequestId, waitTime);
            this.metrics.incrementTimeout();
            
            const timeoutError = new ConnectionTimeoutException(waitTime, actualRequestId);
            this.addError(timeoutError.toPoolError());
            
            request.reject(timeoutError);
          }
        }, actualTimeout);
      }
    });
  }

  private async validateConnection(
    conn: PoolConnection,
    requestId: string
  ): Promise<boolean> {
    if (!this.config.testOnBorrow) {
      return true;
    }

    try {
      const valid = await conn.validate();
      if (!valid) {
        await this.destroyConnection(conn, 'validation_failed');
        throw new ConnectionValidationException(conn.id, 'Connection validation failed', requestId);
      }
      return true;
    } catch (error) {
      this.metrics.incrementError();
      this.addError(createPoolError(
        `Validation failed for connection ${conn.id}`,
        'VALIDATION_ERROR',
        conn.id,
        requestId
      ));
      return false;
    }
  }

  private assignConnection(
    conn: PoolConnection,
    requestId: string,
    startTime: number
  ): PoolConnection {
    conn.acquire(requestId);
    const acquireTime = Date.now() - startTime;
    
    this.metrics.incrementAcquired(acquireTime);
    
    const info = conn.getInfo();
    this.emitter.emit('connection:acquired', info, requestId);
    
    this.logger.debug('Connection acquired', {
      connectionId: conn.id,
      requestId,
      acquireTime
    });
    
    this.updatePoolState();
    return conn;
  }

  async release(connection: PoolConnection): Promise<void> {
    if (!connection) {
      this.logger.warn('Attempting to release null connection');
      return;
    }

    if (connection.isDestroyed()) {
      this.logger.warn('Attempting to release destroyed connection', {
        connectionId: connection.id
      });
      return;
    }

    try {
      if (this.config.testOnReturn) {
        const valid = await connection.validate();
        if (!valid) {
          await this.destroyConnection(connection, 'validation_on_return_failed');
          return;
        }
      }

      const useDuration = connection.release();
      this.metrics.incrementReleased(useDuration);
      
      this.idleQueue.push(connection);
      
      const info = connection.getInfo();
      this.emitter.emit('connection:released', info, useDuration);
      
      this.logger.debug('Connection released', {
        connectionId: connection.id,
        useDuration
      });

      if (this.pendingRequests.length > 0) {
        this.processPendingRequests();
      }
      
      this.updatePoolState();
    } catch (error) {
      this.logger.error('Error releasing connection', error as Error, {
        connectionId: connection.id
      });
      await this.destroyConnection(connection, 'release_error');
    }
  }

  private async destroyConnection(connection: PoolConnection, reason: string): Promise<void> {
    try {
      connection.destroy(reason);
      await connection.disconnect();
      this.connections.delete(connection.id);
      this.metrics.incrementDestroyed();
      
      const info = connection.getInfo();
      this.emitter.emit('connection:destroyed', info, reason);
      
      this.logger.info('Connection destroyed', {
        connectionId: connection.id,
        reason
      });
      
      this.updatePoolState();
    } catch (error) {
      this.logger.error('Error destroying connection', error as Error, {
        connectionId: connection.id
      });
    }
  }

  private processPendingRequests(): void {
    while (this.pendingRequests.length > 0 && this.idleQueue.length > 0) {
      const request = this.pendingRequests.shift();
      const conn = this.idleQueue.shift();
      
      if (request && conn) {
        this.validateConnection(conn, request.requestId).then(valid => {
          if (valid) {
            conn.acquire(request.requestId);
            request.resolve(conn);
          } else {
            this.processPendingRequests();
          }
        }).catch(error => {
          request.reject(error as Error);
          this.processPendingRequests();
        });
      }
    }
  }

  private startReaper(): void {
    if (this.reapTimer) {
      return;
    }

    this.reapTimer = setInterval(() => {
      this.reapIdleConnections().catch(error => {
        this.logger.error('Error in reaper', error as Error);
      });
    }, this.config.reapInterval);

    this.logger.debug('Reaper started', { interval: this.config.reapInterval });
  }

  private stopReaper(): void {
    if (this.reapTimer) {
      clearInterval(this.reapTimer);
      this.reapTimer = undefined;
      this.logger.debug('Reaper stopped');
    }
  }

  private async reapIdleConnections(): Promise<void> {
    const now = Date.now();
    const toReap: PoolConnection[] = [];
    
    const activeCount = Array.from(this.connections.values()).filter(
      c => !c.isDestroyed()
    ).length;

    for (let i = this.idleQueue.length - 1; i >= 0; i--) {
      const conn = this.idleQueue[i];
      const idleTime = conn.getIdleTime();

      const shouldReap = idleTime >= this.config.idleTimeout ||
        (activeCount - toReap.length > this.config.min && idleTime >= this.config.idleTimeout / 2);

      if (shouldReap) {
        this.idleQueue.splice(i, 1);
        toReap.push(conn);
      }
    }

    for (const conn of toReap) {
      await this.destroyConnection(conn, 'idle_timeout');
    }

    if (toReap.length > 0) {
      this.logger.info('Reaped idle connections', { count: toReap.length });
    }
  }

  private updatePoolState(): void {
    const oldState = this.state;
    const metrics = this.getMetrics();
    
    const utilization = metrics.totalConnections > 0
      ? metrics.borrowedConnections / metrics.totalConnections
      : 0;
    const pendingRatio = metrics.pendingRequests / Math.max(metrics.totalConnections, 1);

    if (this.state === PoolState.STOPPED || this.state === PoolState.DRAINING) {
      return;
    }

    if (utilization > 0.9 || pendingRatio > 2) {
      this.state = PoolState.OVERLOADED;
    } else if (utilization > 0.7 || pendingRatio > 1) {
      this.state = PoolState.DEGRADED;
    } else {
      this.state = PoolState.READY;
    }

    if (oldState !== this.state) {
      this.emitter.emit('pool:state-change', oldState, this.state);
      this.logger.info(`Pool state changed: ${oldState} -> ${this.state}`, {
        utilization,
        pendingRatio,
        metrics
      });
    }

    this.emitter.emit('pool:metrics-update', this.metrics.getMetrics());
  }

  private addError(error: PoolError): void {
    this.recentErrors.unshift(error);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.pop();
    }
    this.emitter.emit('pool:error', error);
  }

  getState(): PoolState {
    return this.state;
  }

  getMetrics(): PoolMetrics {
    return this.metrics.getMetrics();
  }

  getConnectionInfos(): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter(c => !c.isDestroyed())
      .map(c => c.getInfo());
  }

  getConnectionById(id: string): ConnectionInfo | undefined {
    const conn = this.connections.get(id);
    return conn && !conn.isDestroyed() ? conn.getInfo() : undefined;
  }

  async withConnection<T>(
    operation: (connection: PoolConnection) => Promise<T>,
    options?: {
      requestId?: string;
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> {
    const retries = options?.retries ?? 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let connection: PoolConnection | null = null;
      
      try {
        connection = await this.acquire(options?.requestId, options?.timeout);
        connection.markInUse();
        const result = await operation(connection);
        await this.release(connection);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (connection) {
          await this.destroyConnection(connection, 'operation_failed');
        }

        if (attempt < retries) {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000);
          this.logger.warn('Retrying operation', {
            attempt: attempt + 1,
            maxRetries: retries,
            delay,
            error: lastError.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new PoolException('Operation failed', 'OPERATION_FAILED');
  }

  healthCheck(): HealthCheckResult {
    const metrics = this.getMetrics();
    const warnings: string[] = [];
    
    if (metrics.borrowedConnections === this.config.max) {
      warnings.push('All connections are in use');
    }
    
    if (metrics.pendingRequests > 0) {
      warnings.push(`${metrics.pendingRequests} requests waiting for connection`);
    }
    
    if (this.metrics.getErrorRate() > 0.1) {
      warnings.push('High error rate detected');
    }

    const utilization = metrics.totalConnections > 0
      ? metrics.borrowedConnections / metrics.totalConnections
      : 0;
    
    const healthy = this.state === PoolState.READY && 
      utilization < 0.9 && 
      metrics.pendingRequests === 0;

    return {
      healthy,
      state: this.state,
      timestamp: Date.now(),
      metrics,
      errors: this.recentErrors.slice(0, 10),
      warnings
    };
  }

  async drain(): Promise<void> {
    this.state = PoolState.DRAINING;
    this.stopReaper();
    
    this.logger.info('Draining pool', { 
      totalConnections: this.connections.size,
      pendingRequests: this.pendingRequests.length
    });

    while (this.pendingRequests.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const connections = Array.from(this.connections.values());
    for (const conn of connections) {
      if (!conn.isDestroyed()) {
        await this.destroyConnection(conn, 'pool_drain');
      }
    }

    this.state = PoolState.STOPPED;
    this.logger.info('Pool drained');
  }

  async close(): Promise<void> {
    await this.drain();
    await this.shutdownDatabasePools();
  }

  on(event: keyof PoolEventMap, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: keyof PoolEventMap, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  getConfig(): PoolConfig {
    return { ...this.config };
  }

  getRecentErrors(): PoolError[] {
    return [...this.recentErrors];
  }
}
