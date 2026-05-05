import { SimulationEngine } from '../src/engine/SimulationEngine';
import { SQLiteStorage } from '../src/storage/SQLiteStorage';
import { ClusterConfig, Policy, Event } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('SimulationEngine', () => {
  let testDbPath: string;
  let storage: SQLiteStorage;

  beforeEach(async () => {
    // 创建临时测试数据库
    testDbPath = path.join(__dirname, 'test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = new SQLiteStorage(testDbPath);
    await storage.initialize();
  });

  afterEach(() => {
    storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Raft Consistency Model', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Raft Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 }
      ],
      consistencyModel: 'raft',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'strong',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 1,
      writeQuorum: 2,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should handle leader election', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(2);
      
      // 检查是否有提交路径记录
      expect(result.metrics.commitPath.length).toBeGreaterThan(0);
    });

    test('should handle normal write operations', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 500,
          type: 'write',
          nodeId: 'node-1',
          data: { key: 'user:1', value: 'Alice' },
          description: '写入用户数据'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(3);
    });

    test('should detect network partition', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 1000,
          type: 'partition',
          nodeId: 'node-3',
          description: '节点3发生网络分区'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      
      // 检查是否有风险提示
      const hasPartitionRisk = result.metrics.risks.some(
        r => r.type === 'splitBrain' || r.description.includes('分区')
      );
      expect(hasPartitionRisk).toBe(true);
    });

    test('should handle leader failure and trigger new election', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 1000,
          type: 'leaderFail',
          nodeId: 'node-1',
          description: 'Leader节点1宕机'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      
      // 检查是否有数据丢失风险
      const hasDataLossRisk = result.metrics.risks.some(
        r => r.type === 'dataLoss'
      );
      expect(hasDataLossRisk).toBe(true);
    });

    test('should detect conflicts after partition recovery', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 500,
          type: 'partition',
          nodeId: 'node-3',
          description: '节点3发生网络分区'
        },
        {
          id: 'event-4',
          timestamp: 1000,
          type: 'write',
          nodeId: 'node-1',
          data: { key: 'user:1', value: 'Alice' },
          description: '节点1写入数据'
        },
        {
          id: 'event-5',
          timestamp: 2000,
          type: 'recover',
          nodeId: 'node-3',
          description: '节点3恢复网络连接'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
    });
  });

  describe('Paxos Consistency Model', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Paxos Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 },
        { id: 'node-4', name: '节点4', weight: 1 },
        { id: 'node-5', name: '节点5', weight: 1 }
      ],
      consistencyModel: 'paxos',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'linearizable',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 2,
      writeQuorum: 2,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should handle Paxos two-phase commit', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'config:1', value: 'value1', term: 1 },
          description: '节点1发起Paxos提案'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(1);
    });

    test('any node can propose in Paxos', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-3',
          data: { key: 'config:1', value: 'value1', term: 1 },
          description: '节点3发起Paxos提案'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'propose',
          nodeId: 'node-5',
          data: { key: 'config:2', value: 'value2', term: 2 },
          description: '节点5发起另一个Paxos提案'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(2);
    });
  });

  describe('Eventual Consistency Model', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Eventual Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 }
      ],
      consistencyModel: 'eventual',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'eventual',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 1,
      writeQuorum: 1,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should allow writes with eventual consistency', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'write',
          nodeId: 'node-1',
          data: { key: 'user:1', value: 'Alice' },
          description: '节点1写入数据'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'write',
          nodeId: 'node-2',
          data: { key: 'user:2', value: 'Bob' },
          description: '节点2写入数据'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(2);
    });

    test('should flag inconsistency risks in eventual consistency', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'user:1', value: 'Alice' },
          description: '节点1发起提案'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      
      // 检查是否有不一致风险
      const hasInconsistencyRisk = result.metrics.risks.some(
        r => r.type === 'inconsistency'
      );
      expect(hasInconsistencyRisk).toBe(true);
    });
  });

  describe('Conflict and Retry Handling', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 }
      ],
      consistencyModel: 'raft',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'strong',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 1,
      writeQuorum: 2,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should handle conflict events', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'conflict',
          nodeId: 'node-1',
          targetNodeId: 'node-2',
          data: { key: 'user:1', value1: 'Alice', value2: 'Bob' },
          description: '检测到数据冲突'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.metrics.conflicts.length).toBeGreaterThan(0);
    });

    test('should handle retry events', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'retry',
          nodeId: 'node-1',
          data: { key: 'user:1', retryCount: 1, maxRetries: 3 },
          description: '补偿重试'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
    });

    test('should flag data loss risk when retry limit reached', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'retry',
          nodeId: 'node-1',
          data: { key: 'user:1', retryCount: 3, maxRetries: 3 },
          description: '重试已达上限'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      
      const hasDataLossRisk = result.metrics.risks.some(
        r => r.type === 'dataLoss'
      );
      expect(hasDataLossRisk).toBe(true);
    });
  });

  describe('Read Operations', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 }
      ],
      consistencyModel: 'raft',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'strong',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 1,
      writeQuorum: 2,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should handle normal read operations', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 500,
          type: 'write',
          nodeId: 'node-1',
          data: { key: 'user:1', value: 'Alice' },
          description: '写入用户数据'
        },
        {
          id: 'event-4',
          timestamp: 600,
          type: 'read',
          nodeId: 'node-1',
          data: { key: 'user:1' },
          description: '读取用户数据'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(4);
    });

    test('should flag stale read risk when node is partitioned', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 500,
          type: 'partition',
          nodeId: 'node-3',
          description: '节点3发生网络分区'
        },
        {
          id: 'event-4',
          timestamp: 600,
          type: 'read',
          nodeId: 'node-3',
          data: { key: 'user:1' },
          description: '分区中的节点尝试读取'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      
      const hasStaleReadRisk = result.metrics.risks.some(
        r => r.type === 'staleRead'
      );
      expect(hasStaleReadRisk).toBe(true);
    });
  });

  describe('Timeout and Heartbeat', () => {
    const clusterConfig: ClusterConfig = {
      name: 'Test Cluster',
      nodes: [
        { id: 'node-1', name: '节点1', weight: 1 },
        { id: 'node-2', name: '节点2', weight: 1 },
        { id: 'node-3', name: '节点3', weight: 1 }
      ],
      consistencyModel: 'raft',
      replicationFactor: 3,
      timeout: 1000,
      heartbeatInterval: 100
    };

    const policy: Policy = {
      name: 'Test Policy',
      consistencyLevel: 'strong',
      readRepair: true,
      hintedHandoff: true,
      readQuorum: 1,
      writeQuorum: 2,
      retryPolicy: { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 },
      lockLease: { duration: 10000, autoRenew: false },
      failureDetection: { interval: 100, timeout: 1000 }
    };

    test('should handle heartbeat events', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 10,
          type: 'heartbeat',
          nodeId: 'node-1',
          description: '节点1发送心跳'
        },
        {
          id: 'event-2',
          timestamp: 20,
          type: 'heartbeat',
          nodeId: 'node-2',
          description: '节点2发送心跳'
        },
        {
          id: 'event-3',
          timestamp: 30,
          type: 'heartbeat',
          nodeId: 'node-3',
          description: '节点3发送心跳'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.events.length).toBe(3);
    });

    test('should record unavailable window on timeout', () => {
      const engine = new SimulationEngine(clusterConfig, policy, 12345, storage);
      
      const events: Event[] = [
        {
          id: 'event-1',
          timestamp: 100,
          type: 'propose',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          description: '节点1发起Leader选举'
        },
        {
          id: 'event-2',
          timestamp: 200,
          type: 'commit',
          nodeId: 'node-1',
          data: { key: 'leader-election', value: 'node-1' },
          result: 'success',
          description: '节点1当选Leader'
        },
        {
          id: 'event-3',
          timestamp: 1000,
          type: 'timeout',
          nodeId: 'node-1',
          targetNodeId: 'node-3',
          description: '检测到节点3心跳超时'
        }
      ];

      const result = engine.run(events);

      expect(result).toBeDefined();
      expect(result.metrics.unavailableWindow.length).toBeGreaterThan(0);
    });
  });
});
