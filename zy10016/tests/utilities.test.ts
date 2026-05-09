import { Logger } from '../src/logging/Logger';
import { CacheManager } from '../src/cache/CacheManager';
import { StateManager } from '../src/state/StateManager';
import { IdempotencyManager } from '../src/idempotency/IdempotencyManager';
import { ReportGenerator } from '../src/report/ReportGenerator';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'DEBUG', enableConsole: false });
  });

  it('应该能够记录和获取日志', () => {
    const entry = {
      id: 'test-id',
      timestamp: Date.now(),
      operationId: 'op-1',
      transactionId: null,
      connectionId: 'conn-1',
      operationType: 'READ' as const,
      sql: 'SELECT * FROM test',
      startTime: Date.now(),
      status: 'SUCCESS' as const,
      lockState: {
        connectionId: 'conn-1',
        lockType: 'SHARED' as const,
        walFileSize: 0,
        checkpointProgress: 1,
        pendingWrites: 0,
        activeReaders: 0,
      },
      retryCount: 0,
    };

    logger.logOperationStart(entry);
    logger.logOperationEnd({ ...entry, endTime: Date.now(), duration: 10 });

    const logs = logger.getAllLogs();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('应该能够区分不同类型的日志', () => {
    const errorInfo = {
      message: 'Test error',
      code: 'TEST_ERROR',
      isLockError: true,
    };

    const errorEntry = {
      id: 'error-id',
      timestamp: Date.now(),
      operationId: 'op-2',
      transactionId: null,
      connectionId: 'conn-2',
      operationType: 'WRITE' as const,
      startTime: Date.now(),
      status: 'FAILED' as const,
      error: errorInfo,
      lockState: {
        connectionId: 'conn-2',
        lockType: 'EXCLUSIVE' as const,
        walFileSize: 0,
        checkpointProgress: 1,
        pendingWrites: 0,
        activeReaders: 0,
      },
      retryCount: 0,
    };

    logger.logOperationEnd(errorEntry);

    const errors = logger.getErrorLogs();
    expect(errors.length).toBe(1);

    const lockErrors = logger.getLockErrors();
    expect(lockErrors.length).toBe(1);
  });

  it('应该能够正确统计日志', () => {
    for (let i = 0; i < 5; i++) {
      const successEntry = {
        id: `success-${i}`,
        timestamp: Date.now(),
        operationId: `op-${i}`,
        transactionId: null,
        connectionId: `conn-${i}`,
        operationType: 'READ' as const,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 10,
        status: 'SUCCESS' as const,
        lockState: {
          connectionId: `conn-${i}`,
          lockType: 'SHARED' as const,
          walFileSize: 0,
          checkpointProgress: 1,
          pendingWrites: 0,
          activeReaders: 0,
        },
        retryCount: 0,
      };
      logger.logOperationEnd(successEntry);
    }

    const stats = logger.getStatistics();
    expect(stats.successfulOperations).toBe(5);
    expect(stats.avgLatencyMs).toBe(10);
  });
});

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 100 });
  });

  afterEach(() => {
    cache.close();
  });

  it('应该能够设置和获取缓存', () => {
    cache.set('key1', 'value1');

    const result = cache.get<string>('key1');
    expect(result.value).toBe('value1');
    expect(result.status).toBe('VALID');
  });

  it('应该能够正确处理缓存未命中', () => {
    const result = cache.get<string>('nonexistent');
    expect(result.value).toBeUndefined();
    expect(result.status).toBe('MISSING');
  });

  it('应该能够删除缓存', () => {
    cache.set('key1', 'value1');
    cache.delete('key1');

    const result = cache.get<string>('key1');
    expect(result.status).toBe('MISSING');
  });

  it('应该能够使缓存失效', () => {
    cache.set('dependent1', 'value1', { dependencyKeys: ['parent1'] });
    cache.set('dependent2', 'value2', { dependencyKeys: ['parent1'] });
    cache.set('dependent3', 'value3', { dependencyKeys: ['parent2'] });

    const count = cache.invalidateByDependency('parent1');
    expect(count).toBe(2);

    expect(cache.get<string>('dependent1').status).toBe('MISSING');
    expect(cache.get<string>('dependent2').status).toBe('MISSING');
    expect(cache.get<string>('dependent3').status).toBe('VALID');
  });

  it('应该能够正确统计缓存', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.get('key1');
    cache.get('key1');
    cache.get('nonexistent');

    const stats = cache.getStatistics();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(2 / 3);
  });

  it('应该能够正确处理TTL过期', async () => {
    cache.set('expiring', 'value', { ttl: 100 });

    let result = cache.get('expiring');
    expect(result.status).toBe('VALID');

    await new Promise((r) => setTimeout(r, 150));

    result = cache.get('expiring');
    expect(result.status).toBe('EXPIRED');
  });
});

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  it('应该能够注册和获取资源', () => {
    stateManager.registerResource({
      id: 'conn-1',
      type: 'CONNECTION',
      status: 'IDLE',
      lockType: 'NONE',
      holdingConnections: [],
      waitingConnections: [],
    });

    const resource = stateManager.getResource('conn-1');
    expect(resource).toBeDefined();
    expect(resource?.status).toBe('IDLE');
  });

  it('应该能够验证状态转换', () => {
    stateManager.registerResource({
      id: 'conn-1',
      type: 'CONNECTION',
      status: 'IDLE',
      lockType: 'NONE',
      holdingConnections: [],
      waitingConnections: [],
    });

    expect(stateManager.canTransition('conn-1', 'READ')).toBe(true);
    expect(stateManager.canTransition('conn-1', 'COMMIT')).toBe(false);
  });

  it('应该能够执行状态转换', () => {
    stateManager.registerResource({
      id: 'conn-1',
      type: 'CONNECTION',
      status: 'IDLE',
      lockType: 'NONE',
      holdingConnections: [],
      waitingConnections: [],
    });

    const result = stateManager.transition('conn-1', 'READ');
    expect(result.status).toBe('WAITING');

    const history = stateManager.getStateHistory('conn-1');
    expect(history.length).toBe(1);
    expect(history[0].from).toBe('IDLE');
    expect(history[0].to).toBe('WAITING');
  });

  it('应该能够管理锁状态', () => {
    stateManager.registerResource({
      id: 'resource-1',
      type: 'OPERATION',
      status: 'IDLE',
      lockType: 'NONE',
      holdingConnections: [],
      waitingConnections: [],
    });

    stateManager.addHoldingConnection('resource-1', 'conn-1');
    stateManager.addWaitingConnection('resource-1', 'conn-2');

    const resource = stateManager.getResource('resource-1');
    expect(resource?.holdingConnections).toContain('conn-1');
    expect(resource?.waitingConnections).toContain('conn-2');

    stateManager.removeHoldingConnection('resource-1', 'conn-1');
    stateManager.removeWaitingConnection('resource-1', 'conn-2');

    const updated = stateManager.getResource('resource-1');
    expect(updated?.holdingConnections).not.toContain('conn-1');
    expect(updated?.waitingConnections).not.toContain('conn-2');
  });
});

describe('IdempotencyManager', () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager({ cleanupInterval: 1000 });
  });

  afterEach(() => {
    manager.close();
  });

  it('应该能够执行幂等操作', async () => {
    let callCount = 0;
    const result1 = await manager.execute('op-1', 'test', async () => {
      callCount++;
      return 'result-1';
    });

    const result2 = await manager.execute('op-1', 'test', async () => {
      callCount++;
      return 'result-2';
    });

    expect(callCount).toBe(1);
    expect(result1).toBe('result-1');
    expect(result2).toBe('result-1');
  });

  it('应该能够检查操作状态', async () => {
    await manager.execute('op-1', 'test', async () => 'result');

    expect(manager.hasExecuted('op-1')).toBe(true);
    expect(manager.hasExecuted('op-2')).toBe(false);
    expect(manager.getStatus('op-1')).toBe('EXECUTED');
  });

  it('应该能够回滚操作', async () => {
    await manager.execute('op-1', 'test', async () => 'result');
    await manager.rollback('op-1');

    expect(manager.getStatus('op-1')).toBe('ROLLED_BACK');

    await expect(
      manager.execute('op-1', 'test', async () => 'result')
    ).rejects.toThrow();
  });
});

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  it('应该能够生成报告', () => {
    const report = generator.generate({
      title: '测试报告',
      generatedAt: new Date().toISOString(),
      systemInfo: {
        nodeVersion: 'v20.0.0',
        platform: 'darwin',
        pid: 1234,
        uptime: 3600,
        memory: {
          rss: 100000000,
          heapTotal: 50000000,
          heapUsed: 25000000,
          external: 10000000,
        },
      },
      loggerStats: {
        totalOperations: 100,
        successfulOperations: 95,
        failedOperations: 5,
        lockErrors: 2,
        retries: 10,
        avgLatencyMs: 50.5,
        activeTransactions: 0,
      },
    });

    expect(report).toContain('# 测试报告');
    expect(report).toContain('## 系统信息');
    expect(report).toContain('## 数据库操作统计');
    expect(report).toContain('100');
    expect(report).toContain('95.00%');
  });
});
