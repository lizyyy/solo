import { v4 as uuidv4 } from 'uuid';
import { 
  ClusterConfig, 
  Event, 
  Policy, 
  SimulationResult, 
  SimulationState, 
  Node, 
  Lock, 
  Proposal 
} from '../types';
import { SQLiteStorage } from '../storage/SQLiteStorage';

export class SimulationEngine {
  private clusterConfig: ClusterConfig;
  private policy: Policy;
  private seed: number;
  private storage: SQLiteStorage;
  private state: SimulationState;
  private commitPath: string[];
  private unavailableWindows: SimulationResult['metrics']['unavailableWindow'];
  private conflicts: SimulationResult['metrics']['conflicts'];
  private risks: SimulationResult['metrics']['risks'];
  private latencyMeasurements: number[];
  private readCount: number;
  private writeCount: number;
  private startTime: number;

  constructor(clusterConfig: ClusterConfig, policy: Policy, seed: number, storage: SQLiteStorage) {
    this.clusterConfig = clusterConfig;
    this.policy = policy;
    this.seed = seed;
    this.storage = storage;
    this.startTime = Date.now();

    // 初始化状态
    this.state = this.initializeState();
    this.commitPath = [];
    this.unavailableWindows = [];
    this.conflicts = [];
    this.risks = [];
    this.latencyMeasurements = [];
    this.readCount = 0;
    this.writeCount = 0;
  }

  private initializeState(): SimulationState {
    const nodes = new Map<string, Node>();
    
    this.clusterConfig.nodes.forEach(nodeConfig => {
      nodes.set(nodeConfig.id, {
        id: nodeConfig.id,
        name: nodeConfig.name,
        status: 'up',
        role: 'follower',
        term: 0,
        dataStore: {},
        lastHeartbeat: Date.now(),
        partitionGroup: undefined
      });
    });

    return {
      nodes,
      currentTerm: 0,
      leaderId: undefined,
      events: [],
      startTime: this.startTime,
      currentTime: this.startTime,
      locks: new Map<string, Lock>(),
      proposals: []
    };
  }

  run(events: Event[]): SimulationResult {
    console.log(`开始执行模拟，共 ${events.length} 个事件`);

    // 按时间排序事件
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    sortedEvents.forEach((event, index) => {
      if (index % 10 === 0) {
        console.log(`处理事件 ${index + 1}/${events.length}...`);
      }
      this.processEvent(event);
    });

    // 生成最终结果
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    // 计算延迟指标
    const latencySorted = [...this.latencyMeasurements].sort((a, b) => a - b);
    const avgLatency = latencySorted.length > 0 
      ? latencySorted.reduce((a, b) => a + b, 0) / latencySorted.length 
      : 0;
    const p95Latency = latencySorted.length > 0 
      ? latencySorted[Math.floor(latencySorted.length * 0.95)] || 0 
      : 0;
    const p99Latency = latencySorted.length > 0 
      ? latencySorted[Math.floor(latencySorted.length * 0.99)] || 0 
      : 0;

    // 计算吞吐量
    const throughputSeconds = duration / 1000;
    const readsPerSecond = throughputSeconds > 0 ? this.readCount / throughputSeconds : 0;
    const writesPerSecond = throughputSeconds > 0 ? this.writeCount / throughputSeconds : 0;

    const result: SimulationResult = {
      id: uuidv4(),
      seed: this.seed,
      startTime: this.startTime,
      endTime: endTime,
      consistencyModel: this.clusterConfig.consistencyModel,
      events: this.state.events,
      nodes: Array.from(this.state.nodes.values()),
      metrics: {
        commitPath: this.commitPath.length > 0 ? this.commitPath : ['无提交操作'],
        unavailableWindow: this.unavailableWindows,
        conflicts: this.conflicts,
        risks: this.risks,
        latency: {
          average: Math.round(avgLatency),
          p95: Math.round(p95Latency),
          p99: Math.round(p99Latency)
        },
        throughput: {
          readsPerSecond: Math.round(readsPerSecond * 100) / 100,
          writesPerSecond: Math.round(writesPerSecond * 100) / 100
        }
      }
    };

    return result;
  }

  private processEvent(event: Event): void {
    const eventCopy = { ...event };
    this.state.events.push(eventCopy);

    switch (event.type) {
      case 'propose':
        this.handlePropose(event);
        break;
      case 'commit':
        this.handleCommit(event);
        break;
      case 'read':
        this.handleRead(event);
        break;
      case 'write':
        this.handleWrite(event);
        break;
      case 'timeout':
        this.handleTimeout(event);
        break;
      case 'heartbeat':
        this.handleHeartbeat(event);
        break;
      case 'partition':
        this.handlePartition(event);
        break;
      case 'recover':
        this.handleRecover(event);
        break;
      case 'leaderFail':
        this.handleLeaderFail(event);
        break;
      case 'leaseExpire':
        this.handleLeaseExpire(event);
        break;
      case 'conflict':
        this.handleConflict(event);
        break;
      case 'retry':
        this.handleRetry(event);
        break;
    }

    // 测量延迟（假设事件处理时间为随机值，基于事件类型）
    const latency = this.measureLatency(event.type);
    this.latencyMeasurements.push(latency);
  }

  private handlePropose(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    // 检查节点是否可用
    if (node.status !== 'up') {
      this.addRisk('dataLoss', `节点 ${node.name} 处于 ${node.status} 状态，无法发起提案`, 'medium', event.timestamp);
      return;
    }

    // 根据一致性模型处理提案
    if (this.clusterConfig.consistencyModel === 'raft') {
      this.handleRaftPropose(event, node);
    } else if (this.clusterConfig.consistencyModel === 'paxos') {
      this.handlePaxosPropose(event, node);
    } else {
      // 最终一致性模型
      this.handleEventualPropose(event, node);
    }
  }

  private handleRaftPropose(event: Event, node: Node): void {
    // Raft: 只有 Leader 可以发起提案
    if (node.role !== 'leader') {
      // 如果没有 Leader，尝试选举
      if (!this.state.leaderId) {
        this.triggerLeaderElection(node.id, event.timestamp);
      }
      return;
    }

    // 创建提案
    if (event.data && event.data.key !== undefined) {
      const proposal: Proposal = {
        id: uuidv4(),
        proposerId: node.id,
        key: event.data.key,
        value: event.data.value,
        term: this.state.currentTerm,
        status: 'pending',
        acceptors: [],
        timestamp: event.timestamp
      };

      this.state.proposals.push(proposal);

      // 向 Followers 复制日志
      const followers = Array.from(this.state.nodes.values())
        .filter(n => n.role === 'follower' && n.status === 'up' && !n.partitionGroup);

      let ackCount = 1; // Leader 自己的 ack
      followers.forEach(follower => {
        // 模拟复制成功
        proposal.acceptors.push(follower.id);
        ackCount++;
      });

      // 检查是否达到大多数
      const totalNodes = this.state.nodes.size;
      const majority = Math.floor(totalNodes / 2) + 1;

      if (ackCount >= majority) {
        proposal.status = 'accepted';
        // 提交到 Leader 的数据存储
        node.dataStore[proposal.key] = proposal.value;
        this.commitPath.push(`[${event.timestamp}ms] ${node.id} 提交 ${proposal.key}=${proposal.value}`);
      }
    }

    // 检查 Leader 选举
    if (event.data && event.data.key === 'leader-election') {
      this.state.currentTerm++;
      node.role = 'leader';
      node.term = this.state.currentTerm;
      this.state.leaderId = node.id;

      // 更新其他节点为 follower
      this.state.nodes.forEach((n, id) => {
        if (id !== node.id) {
          n.role = 'follower';
        }
      });

      this.commitPath.push(`[${event.timestamp}ms] ${node.id} 当选 Leader (任期 ${this.state.currentTerm})`);
    }
  }

  private handlePaxosPropose(event: Event, node: Node): void {
    // Paxos: 任何节点都可以发起提案
    if (!event.data || event.data.key === undefined) return;

    const proposal: Proposal = {
      id: uuidv4(),
      proposerId: node.id,
      key: event.data.key,
      value: event.data.value,
      term: event.data.term || this.state.currentTerm,
      status: 'pending',
      acceptors: [],
      timestamp: event.timestamp
    };

    this.state.proposals.push(proposal);

    // Paxos 两阶段提交
    // 阶段1: Prepare
    const acceptors = Array.from(this.state.nodes.values())
      .filter(n => n.status === 'up' && !n.partitionGroup);

    let prepareAcks = 0;
    acceptors.forEach(acceptor => {
      // 模拟 Prepare 响应
      prepareAcks++;
    });

    const majority = Math.floor(this.state.nodes.size / 2) + 1;

    if (prepareAcks >= majority) {
      // 阶段2: Accept
      let acceptAcks = 0;
      acceptors.forEach(acceptor => {
        proposal.acceptors.push(acceptor.id);
        acceptAcks++;
      });

      if (acceptAcks >= majority) {
        proposal.status = 'accepted';
        // 学习阶段：所有节点学习已接受的值
        acceptors.forEach(acceptor => {
          acceptor.dataStore[proposal.key] = proposal.value;
        });
        this.commitPath.push(`[${event.timestamp}ms] Paxos 提案 ${proposal.key}=${proposal.value} 被接受`);
      }
    }
  }

  private handleEventualPropose(event: Event, node: Node): void {
    // 最终一致性：直接写入，异步复制
    if (!event.data || event.data.key === undefined) return;

    node.dataStore[event.data.key] = event.data.value;
    this.commitPath.push(`[${event.timestamp}ms] ${node.id} 写入 ${event.data.key}=${event.data.value}（最终一致性）`);

    // 添加风险：最终一致性可能导致暂时不一致
    this.addRisk('inconsistency', `最终一致性模型下，${event.data.key} 可能暂时不一致`, 'low', event.timestamp);
  }

  private handleCommit(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    if (event.result === 'success' && event.data) {
      // 提交数据
      node.dataStore[event.data.key] = event.data.value;

      // 如果是 Leader 选举提交
      if (event.data.key === 'leader-election') {
        this.state.currentTerm = event.data.term || this.state.currentTerm + 1;
        node.role = 'leader';
        node.term = this.state.currentTerm;
        this.state.leaderId = node.id;

        this.state.nodes.forEach((n, id) => {
          if (id !== node.id) {
            n.role = 'follower';
          }
        });
      }
    }
  }

  private handleRead(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    this.readCount++;

    // 检查节点状态
    if (node.status !== 'up') {
      this.addRisk('staleRead', `节点 ${node.name} 处于 ${node.status} 状态，读取可能失败`, 'high', event.timestamp);
      return;
    }

    // 检查分区
    if (node.partitionGroup) {
      // 检查是否有旧值读取的风险
      if (this.clusterConfig.consistencyModel === 'strong') {
        this.addRisk('staleRead', `节点 ${node.name} 在分区中，强一致性模型下可能无法读取`, 'high', event.timestamp);
      } else {
        this.addRisk('staleRead', `节点 ${node.name} 在分区中，可能读取到旧值`, 'medium', event.timestamp);
      }
    }

    // 检查锁
    if (event.data && event.data.key) {
      const lock = this.state.locks.get(event.data.key);
      if (lock && lock.holderId !== node.id) {
        // 检查锁是否过期
        const currentTime = Date.now();
        if (currentTime < lock.leaseExpireTime) {
          this.addRisk('lockExpiration', `键 ${event.data.key} 被 ${lock.holderId} 持有`, 'medium', event.timestamp);
        }
      }
    }
  }

  private handleWrite(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    this.writeCount++;

    // 检查节点状态
    if (node.status !== 'up') {
      this.addRisk('dataLoss', `节点 ${node.name} 处于 ${node.status} 状态，写入可能失败`, 'high', event.timestamp);
      return;
    }

    // 检查分区
    if (node.partitionGroup) {
      // 检查是否有脑裂风险
      if (this.state.leaderId && node.role === 'leader') {
        // 两个 Leader 同时存在 - 脑裂
        this.addRisk('splitBrain', `检测到脑裂：${node.id} 和 ${this.state.leaderId} 同时为 Leader`, 'critical', event.timestamp);
      }
    }

    // 检查锁
    if (event.data && event.data.key) {
      const lock = this.state.locks.get(event.data.key);
      if (lock && lock.holderId !== node.id) {
        const currentTime = Date.now();
        if (currentTime < lock.leaseExpireTime) {
          // 锁被其他节点持有
          this.conflicts.push({
            eventId: event.id,
            nodeId: node.id,
            reason: `键 ${event.data.key} 被 ${lock.holderId} 锁定，无法写入`,
            timestamp: event.timestamp
          });
          return;
        } else {
          // 锁已过期，自动释放
          this.state.locks.delete(event.data.key);
          this.addRisk('lockExpiration', `键 ${event.data.key} 的锁已过期，自动释放`, 'medium', event.timestamp);
        }
      }

      // 强一致性模型检查
      if (this.clusterConfig.consistencyModel === 'raft' || this.clusterConfig.consistencyModel === 'paxos') {
        if (node.role !== 'leader' && this.state.leaderId) {
          this.addRisk('inconsistency', `非 Leader 节点 ${node.name} 尝试写入`, 'high', event.timestamp);
        }
      }

      // 执行写入
      node.dataStore[event.data.key] = event.data.value;
      this.commitPath.push(`[${event.timestamp}ms] ${node.id} 写入 ${event.data.key}=${event.data.value}`);
    }
  }

  private handleTimeout(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    // 记录不可用窗口
    const targetNode = event.targetNodeId ? this.state.nodes.get(event.targetNodeId) : undefined;
    
    if (targetNode) {
      this.unavailableWindows.push({
        startTime: event.timestamp - this.clusterConfig.timeout,
        endTime: event.timestamp,
        duration: this.clusterConfig.timeout,
        cause: `节点 ${targetNode.name} 心跳超时`
      });

      // 检查是否需要触发 Leader 选举
      if (targetNode.id === this.state.leaderId) {
        this.triggerLeaderElection(node.id, event.timestamp);
      }
    }
  }

  private handleHeartbeat(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    node.lastHeartbeat = Date.now();

    // 如果是 Leader 发送的心跳，更新 Followers 的状态
    if (node.role === 'leader' && event.targetNodeId) {
      const targetNode = this.state.nodes.get(event.targetNodeId);
      if (targetNode && targetNode.status === 'up' && !targetNode.partitionGroup) {
        // 复制日志条目
        if (event.data) {
          const commitIndex = event.data.commitIndex;
          // 模拟日志复制
          targetNode.lastHeartbeat = Date.now();
        }
      }
    }
  }

  private handlePartition(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    node.status = 'partitioned';
    node.partitionGroup = (event as any).partitionGroup || 'A';

    // 检查是否是 Leader
    if (node.id === this.state.leaderId) {
      // 记录不可用窗口开始
      this.unavailableWindows.push({
        startTime: event.timestamp,
        endTime: event.timestamp, // 暂时，等恢复时更新
        duration: 0,
        cause: `Leader ${node.name} 发生网络分区`
      });

      // 触发新的 Leader 选举
      this.triggerLeaderElection(undefined, event.timestamp);
    }

    this.addRisk('splitBrain', `节点 ${node.name} 进入分区 ${node.partitionGroup}，可能导致脑裂`, 'high', event.timestamp);
  }

  private handleRecover(event: Event): void {
    const node = this.state.nodes.get(event.nodeId);
    if (!node) return;

    const previousStatus = node.status;
    node.status = 'up';
    node.partitionGroup = undefined;

    // 更新不可用窗口的结束时间
    if (previousStatus === 'partitioned') {
      const lastWindow = this.unavailableWindows[this.unavailableWindows.length - 1];
      if (lastWindow && lastWindow.duration === 0) {
        lastWindow.endTime = event.timestamp;
        lastWindow.duration = event.timestamp - lastWindow.startTime;
      }
    }

    // 检查数据一致性
    if (this.state.leaderId && this.state.leaderId !== node.id) {
      const leader = this.state.nodes.get(this.state.leaderId);
      if (leader) {
        // 比较数据存储
        for (const [key, value] of Object.entries(leader.dataStore)) {
          if (node.dataStore[key] !== value) {
            this.conflicts.push({
              eventId: event.id,
              nodeId: node.id,
              reason: `数据不一致：${key}，Leader 值: ${value}，本地值: ${node.dataStore[key]}`,
              timestamp: event.timestamp
            });

            // 读修复
            if (this.policy.readRepair) {
              node.dataStore[key] = value;
              this.commitPath.push(`[${event.timestamp}ms] 读修复: ${node.id} 同步 ${key}=${value}`);
            }
          }
        }
      }
    }
  }

  private handleLeaderFail(event: Event): void {
    if (!this.state.leaderId) return;

    const leader = this.state.nodes.get(this.state.leaderId);
    if (leader) {
      leader.status = 'down';
      leader.role = 'follower';

      // 记录不可用窗口
      this.unavailableWindows.push({
        startTime: event.timestamp,
        endTime: event.timestamp,
        duration: 0,
        cause: `Leader ${leader.name} 宕机`
      });

      this.addRisk('dataLoss', `Leader ${leader.name} 宕机，可能导致数据丢失`, 'critical', event.timestamp);

      // 触发新的 Leader 选举
      this.triggerLeaderElection(undefined, event.timestamp);
    }
  }

  private handleLeaseExpire(event: Event): void {
    if (!event.data || !event.data.key) return;

    const lock = this.state.locks.get(event.data.key);
    if (lock) {
      const currentTime = Date.now();
      if (currentTime >= lock.leaseExpireTime) {
        this.state.locks.delete(event.data.key);
        this.addRisk('lockExpiration', `键 ${event.data.key} 的锁租约已过期`, 'high', event.timestamp);
      }
    }
  }

  private handleConflict(event: Event): void {
    this.conflicts.push({
      eventId: event.id,
      nodeId: event.nodeId,
      reason: event.description,
      timestamp: event.timestamp
    });

    this.addRisk('inconsistency', `检测到数据冲突: ${event.description}`, 'high', event.timestamp);
  }

  private handleRetry(event: Event): void {
    if (!event.data) return;

    const retryCount = event.data.retryCount || 0;
    const maxRetries = this.policy.retryPolicy.maxRetries;

    if (retryCount < maxRetries) {
      // 模拟补偿重试
      this.commitPath.push(`[${event.timestamp}ms] 补偿重试 (${retryCount}/${maxRetries})`);
    } else {
      this.addRisk('dataLoss', `重试次数已达上限 (${maxRetries})，操作失败`, 'critical', event.timestamp);
    }
  }

  private triggerLeaderElection(candidateId?: string, timestamp: number = 0): void {
    // 清除旧 Leader
    this.state.leaderId = undefined;

    // 找到可用的候选人
    const availableNodes = Array.from(this.state.nodes.values())
      .filter(n => n.status === 'up' && !n.partitionGroup);

    if (availableNodes.length === 0) {
      this.addRisk('splitBrain', '没有可用节点进行 Leader 选举', 'critical', timestamp);
      return;
    }

    // 选择新 Leader
    let newLeader: Node;
    if (candidateId) {
      const candidate = this.state.nodes.get(candidateId);
      if (candidate && candidate.status === 'up' && !candidate.partitionGroup) {
        newLeader = candidate;
      } else {
        newLeader = availableNodes[0];
      }
    } else {
      // 随机选择一个可用节点
      newLeader = availableNodes[Math.floor(this.seededRandom() * availableNodes.length)];
    }

    // 增加任期
    this.state.currentTerm++;

    // 更新角色
    newLeader.role = 'leader';
    newLeader.term = this.state.currentTerm;
    this.state.leaderId = newLeader.id;

    availableNodes.forEach(node => {
      if (node.id !== newLeader.id) {
        node.role = 'follower';
      }
    });

    this.commitPath.push(`[${timestamp}ms] Leader 选举: ${newLeader.id} 当选 (任期 ${this.state.currentTerm})`);

    // 更新不可用窗口
    const lastWindow = this.unavailableWindows[this.unavailableWindows.length - 1];
    if (lastWindow && lastWindow.duration === 0) {
      lastWindow.endTime = timestamp;
      lastWindow.duration = timestamp - lastWindow.startTime;
    }
  }

  private addRisk(
    type: SimulationResult['metrics']['risks'][0]['type'],
    description: string,
    severity: SimulationResult['metrics']['risks'][0]['severity'],
    timestamp: number
  ): void {
    // 检查是否已存在相同风险
    const exists = this.risks.some(
      r => r.type === type && r.description === description
    );

    if (!exists) {
      this.risks.push({
        type,
        description,
        severity,
        timestamp
      });
    }
  }

  private measureLatency(eventType: string): number {
    // 根据事件类型模拟延迟
    const baseLatency: Record<string, number> = {
      'propose': 50,
      'commit': 30,
      'read': 10,
      'write': 20,
      'timeout': 0,
      'heartbeat': 5,
      'partition': 0,
      'recover': 0,
      'leaderFail': 0,
      'leaseExpire': 0,
      'conflict': 0,
      'retry': 100
    };

    const base = baseLatency[eventType] || 10;
    // 添加随机波动
    const jitter = this.seededRandom() * 20 - 10;
    return Math.max(1, Math.round(base + jitter));
  }

  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}
