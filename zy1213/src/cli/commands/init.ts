import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { v4 as uuidv4 } from 'uuid';

export const initCommand = new Command('init')
  .description('初始化分布式一致性模拟环境，创建示例配置文件')
  .option('-o, --output <directory>', '输出目录', './simulation')
  .option('--seed <seed>', '随机种子', Math.floor(Math.random() * 1000000).toString())
  .option('--model <model>', '一致性模型: raft, paxos, eventual', 'raft')
  .action(async (options) => {
    const outputDir = path.resolve(options.output);
    const seed = parseInt(options.seed);
    const model = options.model;

    console.log(`初始化模拟环境，输出目录: ${outputDir}`);
    console.log(`随机种子: ${seed}`);
    console.log(`一致性模型: ${model}`);

    // 创建目录结构
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 创建 cluster.yaml
    const clusterConfig = generateClusterConfig(seed, model);
    const clusterPath = path.join(outputDir, 'cluster.yaml');
    fs.writeFileSync(clusterPath, yaml.stringify(clusterConfig));
    console.log(`已创建: ${clusterPath}`);

    // 创建 events.jsonl
    const events = generateEvents(seed, clusterConfig.nodes.length);
    const eventsPath = path.join(outputDir, 'events.jsonl');
    fs.writeFileSync(eventsPath, events.map(e => JSON.stringify(e)).join('\n'));
    console.log(`已创建: ${eventsPath}`);

    // 创建 policy.yaml
    const policy = generatePolicy(model);
    const policyPath = path.join(outputDir, 'policy.yaml');
    fs.writeFileSync(policyPath, yaml.stringify(policy));
    console.log(`已创建: ${policyPath}`);

    console.log('初始化完成！');
    console.log(`请运行: dcs replay -c ${outputDir}/cluster.yaml -e ${outputDir}/events.jsonl -p ${outputDir}/policy.yaml`);
  });

function generateClusterConfig(seed: number, model: string) {
  const nodes = [];
  const nodeCount = 5; // 默认5个节点

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      id: `node-${i + 1}`,
      name: `节点${i + 1}`,
      weight: 1
    });
  }

  return {
    name: `分布式一致性测试集群 - ${model}模型`,
    nodes,
    consistencyModel: model,
    replicationFactor: 3,
    timeout: 1000,
    heartbeatInterval: 100
  };
}

function generateEvents(seed: number, nodeCount: number) {
  const events = [];
  const random = seededRandom(seed);
  let timestamp = 0;

  // 启动事件
  for (let i = 0; i < nodeCount; i++) {
    events.push({
      id: uuidv4(),
      timestamp: timestamp += 10,
      type: 'heartbeat',
      nodeId: `node-${i + 1}`,
      description: `节点${i + 1}启动并发送心跳`
    });
  }

  // Leader 选举
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'propose',
    nodeId: 'node-1',
    data: { key: 'leader-election', value: 'node-1' },
    description: '节点1发起Leader选举'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 30,
    type: 'commit',
    nodeId: 'node-1',
    data: { key: 'leader-election', value: 'node-1' },
    result: 'success',
    description: '节点1当选Leader'
  });

  // 正常写操作
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 100,
    type: 'write',
    nodeId: 'node-1',
    targetNodeId: 'node-1',
    data: { key: 'user:1', value: 'Alice' },
    description: '向Leader写入用户数据'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'heartbeat',
    nodeId: 'node-1',
    targetNodeId: 'node-2',
    data: { term: 1, commitIndex: 1 },
    description: 'Leader向节点2同步数据'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'heartbeat',
    nodeId: 'node-1',
    targetNodeId: 'node-3',
    data: { term: 1, commitIndex: 1 },
    description: 'Leader向节点3同步数据'
  });

  // 模拟网络分区
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 200,
    type: 'partition',
    nodeId: 'node-3',
    partitionGroup: 'B',
    description: '节点3发生网络分区，进入分区B'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'partition',
    nodeId: 'node-4',
    partitionGroup: 'B',
    description: '节点4发生网络分区，进入分区B'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'partition',
    nodeId: 'node-5',
    partitionGroup: 'B',
    description: '节点5发生网络分区，进入分区B'
  });

  // Leader 检测到分区
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 100,
    type: 'timeout',
    nodeId: 'node-1',
    targetNodeId: 'node-3',
    description: 'Leader检测到节点3心跳超时'
  });

  // 分区B中的节点尝试选举
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 150,
    type: 'propose',
    nodeId: 'node-3',
    data: { key: 'leader-election', value: 'node-3', term: 2 },
    description: '节点3在分区B中发起新的Leader选举'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 30,
    type: 'commit',
    nodeId: 'node-3',
    data: { key: 'leader-election', value: 'node-3', term: 2 },
    result: 'success',
    description: '节点3在分区B中当选Leader'
  });

  // 脑裂场景 - 两个Leader同时处理写请求
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 100,
    type: 'write',
    nodeId: 'node-1',
    data: { key: 'user:1', value: 'Alice_v2' },
    description: '分区A中的Leader节点1更新用户数据'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'write',
    nodeId: 'node-3',
    data: { key: 'user:1', value: 'Bob' },
    description: '分区B中的Leader节点3更新同一用户数据'
  });

  // 网络恢复
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 300,
    type: 'recover',
    nodeId: 'node-3',
    description: '节点3网络恢复，重新加入集群'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'recover',
    nodeId: 'node-4',
    description: '节点4网络恢复，重新加入集群'
  });

  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'recover',
    nodeId: 'node-5',
    description: '节点5网络恢复，重新加入集群'
  });

  // 冲突检测
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 100,
    type: 'conflict',
    nodeId: 'node-1',
    targetNodeId: 'node-3',
    data: { key: 'user:1', value1: 'Alice_v2', value2: 'Bob' },
    description: '检测到同一数据的冲突版本'
  });

  // 补偿重试
  events.push({
    id: uuidv4(),
    timestamp: timestamp += 50,
    type: 'retry',
    nodeId: 'node-1',
    data: { key: 'user:1', retryCount: 1, maxRetries: 3 },
    description: '尝试补偿重试解决冲突'
  });

  return events;
}

function generatePolicy(model: string) {
  const basePolicy = {
    name: '默认一致性策略',
    readRepair: true,
    hintedHandoff: true,
    retryPolicy: {
      maxRetries: 3,
      baseDelay: 100,
      backoffMultiplier: 2
    },
    lockLease: {
      duration: 10000,
      autoRenew: false
    },
    failureDetection: {
      interval: 100,
      timeout: 1000
    }
  };

  switch (model) {
    case 'raft':
      return {
        ...basePolicy,
        consistencyLevel: 'strong',
        readQuorum: 1,
        writeQuorum: 2
      };
    case 'paxos':
      return {
        ...basePolicy,
        consistencyLevel: 'linearizable',
        readQuorum: 2,
        writeQuorum: 2
      };
    case 'eventual':
      return {
        ...basePolicy,
        consistencyLevel: 'eventual',
        readQuorum: 1,
        writeQuorum: 1
      };
    default:
      return {
        ...basePolicy,
        consistencyLevel: 'strong',
        readQuorum: 1,
        writeQuorum: 2
      };
  }
}

function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
