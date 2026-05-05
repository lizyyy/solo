# Distributed Consistency Simulator (DCS)

分布式一致性模拟 CLI 工具 - 把 CAP、BASE、Raft、Paxos、分布式锁和最终一致性跑成可复查的事故剧本。

## 功能特性

- **init**: 初始化模拟环境，创建示例配置文件
- **replay**: 重放事件序列，模拟分布式一致性场景
- **compare**: 比较多次模拟运行的结果
- **export**: 导出模拟结果为 Markdown/JSON 报告

## 支持的一致性模型

- **Raft**: 强一致性，Leader 选举 + 日志复制
- **Paxos**: 线性一致性，两阶段提交
- **Eventual**: 最终一致性，异步复制

## 支持的故障场景

- 网络分区 (Network Partition)
- Leader 宕机 (Leader Failure)
- 锁租约过期 (Lock Lease Expiration)
- 提案冲突 (Proposal Conflict)
- 旧值读取 (Stale Read)
- 补偿重试 (Compensation Retry)

## 安装

```bash
npm install
npm run build
```

## 快速开始

### 1. 初始化模拟环境

```bash
# 使用默认配置初始化
npm run dev -- init

# 指定输出目录和一致性模型
npm run dev -- init -o ./my-simulation --model raft --seed 12345
```

### 2. 执行模拟

```bash
# 使用默认路径
npm run dev -- replay

# 指定配置文件
npm run dev -- replay -c ./my-simulation/cluster.yaml -e ./my-simulation/events.jsonl -p ./my-simulation/policy.yaml -o ./my-simulation/results.sqlite

# 详细输出模式
npm run dev -- replay --verbose
```

### 3. 导出报告

```bash
# 导出为 Markdown
npm run dev -- export -f md -o ./report.md

# 导出为 JSON
npm run dev -- export -f json -o ./report.json

# 导出两种格式
npm run dev -- export -f both -o ./report

# 指定运行 ID
npm run dev -- export -r <simulation-id>
```

### 4. 比较运行结果

```bash
# 比较最近两次运行
npm run dev -- compare

# 比较指定的两次运行
npm run dev -- compare -1 <id1> -2 <id2>

# 比较所有运行
npm run dev -- compare --all
```

## 配置文件说明

### cluster.yaml - 集群配置

```yaml
name: "分布式一致性测试集群"
nodes:
  - id: "node-1"
    name: "节点1"
    weight: 1
  - id: "node-2"
    name: "节点2"
    weight: 1
consistencyModel: "raft"  # raft, paxos, eventual
replicationFactor: 3
timeout: 1000
heartbeatInterval: 100
```

### events.jsonl - 事件序列

每行一个 JSON 对象，支持以下事件类型：

| 类型 | 说明 |
|------|------|
| propose | 发起提案 |
| commit | 提交操作 |
| read | 读取数据 |
| write | 写入数据 |
| timeout | 超时事件 |
| heartbeat | 心跳 |
| partition | 网络分区 |
| recover | 故障恢复 |
| leaderFail | Leader 宕机 |
| leaseExpire | 租约过期 |
| conflict | 冲突检测 |
| retry | 补偿重试 |

示例：
```json
{"id":"uuid","timestamp":10,"type":"heartbeat","nodeId":"node-1","description":"节点1启动"}
{"id":"uuid","timestamp":100,"type":"write","nodeId":"node-1","data":{"key":"user:1","value":"Alice"},"description":"写入用户数据"}
{"id":"uuid","timestamp":500,"type":"partition","nodeId":"node-3","partitionGroup":"B","description":"节点3进入分区B"}
```

### policy.yaml - 策略配置

```yaml
name: "默认一致性策略"
consistencyLevel: "strong"  # strong, eventual, linearizable, sequential
readRepair: true
hintedHandoff: true
readQuorum: 1
writeQuorum: 2
retryPolicy:
  maxRetries: 3
  baseDelay: 100
  backoffMultiplier: 2
lockLease:
  duration: 10000
  autoRenew: false
failureDetection:
  interval: 100
  timeout: 1000
```

## 输出指标

### 提交路径 (Commit Path)
展示数据从提议到提交的完整路径，包括：
- Leader 选举过程
- 提案复制路径
- 最终提交确认

### 不可用窗口 (Unavailable Window)
记录系统不可用的时间段和原因：
- 开始/结束时间
- 持续时长
- 触发原因

### 冲突记录 (Conflicts)
记录检测到的数据冲突：
- 事件 ID
- 涉及节点
- 冲突原因
- 发生时间

### 风险提示 (Risks)
识别潜在的一致性风险：
| 类型 | 说明 | 严重程度 |
|------|------|----------|
| dataLoss | 数据丢失风险 | critical |
| splitBrain | 脑裂风险 | critical/high |
| staleRead | 旧值读取风险 | high/medium |
| lockExpiration | 锁过期风险 | high/medium |
| inconsistency | 数据不一致风险 | high/low |

### 性能指标
- 平均延迟 (Average Latency)
- P95 延迟 (P95 Latency)
- P99 延迟 (P99 Latency)
- 读取吞吐量 (Reads Per Second)
- 写入吞吐量 (Writes Per Second)

## 报告格式

### Markdown 报告
包含：
- 模拟概览
- 集群状态
- 关键指标表格
- 事件序列时间线
- CAP 理论分析
- BASE 理论分析

### JSON 报告
结构化数据，便于程序处理。

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testNamePattern="Raft"
```

## 坏配置提示

工具会检测以下坏配置并给出警告：

1. **奇数节点建议**: Raft/Paxos 建议使用奇数个节点 (3, 5, 7...)
2. **Quorum 配置**: 读写 Quorum 之和应大于副本数
3. **超时设置**: 超时时间应大于心跳间隔
4. **租约时长**: 锁租约时长应合理设置

## 架构

```
src/
├── cli/
│   ├── index.ts              # CLI 入口
│   └── commands/
│       ├── init.ts           # init 命令
│       ├── replay.ts         # replay 命令
│       ├── compare.ts        # compare 命令
│       └── export.ts         # export 命令
├── engine/
│   └── SimulationEngine.ts   # 核心模拟引擎
├── storage/
│   └── SQLiteStorage.ts      # SQLite 存储
└── types/
    └── index.ts              # 类型定义
```

## 扩展

### 添加新的一致性模型

在 `SimulationEngine.ts` 中：

1. 添加新的 handler 方法 (`handleXxxPropose`)
2. 在 `handlePropose` 中添加模型判断
3. 更新类型定义中的 `consistencyModel`

### 添加新的事件类型

在 `SimulationEngine.ts` 中：

1. 在 `processEvent` 的 switch 中添加新 case
2. 实现对应的 handler 方法
3. 更新 `Event` 类型定义

## License

MIT
