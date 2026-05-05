# MQ-Stress CLI - 消息队列压测复盘工具

本地消息队列压测复盘 CLI，用于后端同学演练削峰填谷和消费故障场景。

## 功能特性

- 📊 **削峰填谷模拟**：模拟峰值流量与异步解耦后的平滑消费
- 🔄 **顺序消费**：支持同 key 顺序消费模拟
- 🔁 **重复投递/消费**：模拟网络抖动导致的重复消息
- 💀 **故障模拟**：消费者宕机、消息堆积场景
- 📈 **策略支持**：ack、重试、死信、限流扩容策略
- 📋 **报告导出**：Markdown/JSON 报告导出
- 💾 **数据持久化**：SQLite 存储每次运行结果

## 安装

```bash
npm install
npm run build
npm link
```

## 快速开始

### 1. 初始化项目

```bash
mq-stress init
```

这会在当前目录生成样例配置文件：
- `queue-plan.yaml` - 队列计划配置
- `producers.jsonl` - 生产者配置
- `consumers.yaml` - 消费者配置

### 2. 运行模拟

```bash
mq-stress simulate
```

### 3. 分析结果

```bash
mq-stress analyze
```

### 4. 导出报告

```bash
mq-stress export --format markdown --output report.md
mq-stress export --format json --output report.json
```

## 配置文件说明

### queue-plan.yaml - 队列计划

```yaml
global:
  simulation:
    duration: 600
    stepInterval: 1
    seed: 12345

topics:
  - name: order-events
    partitions: 4
    retention: 86400

  - name: payment-events
    partitions: 2
    retention: 86400
```

### producers.jsonl - 生产者配置

每一行一个 JSON 对象：

```json
{"topic": "order-events", "rate": 100, "burstRate": 500, "startTime": 0, "duration": 60, "sequentialKeyField": "orderId", "idempotentKeyField": "eventId"}
{"topic": "payment-events", "rate": 50, "burstRate": 200, "startTime": 10, "duration": 120, "sequentialKeyField": "paymentId", "idempotentKeyField": "txnId"}
```

### consumers.yaml - 消费者配置

```yaml
consumerGroups:
  - name: order-service
    topics: ["order-events"]
    consumers: 2
    consumeRate: 80
    maxConsumeRate: 150
    
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
    
    deadLetter:
      topic: order-dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 30000
    
    scaling:
      enableAutoScaling: true
      targetLag: 100
      maxConsumers: 8
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: true
      minRate: 10
    
    failure:
      crashProbability: 0.01
      recoveryTime: 30
```

## 命令说明

### init

初始化项目，生成样例配置文件。

```bash
mq-stress init [--seed <seed>]
```

### simulate

运行消息队列模拟。

```bash
mq-stress simulate [--plan <plan-file>] [--producers <producers-file>] [--consumers <consumers-file>] [--seed <seed>]
```

### analyze

分析最近一次模拟结果。

```bash
mq-stress analyze [--run-id <run-id>]
```

### export

导出模拟报告。

```bash
mq-stress export [--run-id <run-id>] [--format <markdown|json>] [--output <file-path>]
```

## 模拟场景

### 1. 削峰填谷

通过设置生产者高突发速率，消费者低消费速率，观察消息积压和消费延迟。

### 2. 顺序消费

使用 `sequentialKeyField` 确保同一 key 的消息按顺序投递到同一分区。

### 3. 重复投递

模拟网络抖动导致的消息重复，测试幂等键处理。

### 4. 消费者故障

设置 `crashProbability` 模拟消费者宕机，观察消息重新投递和堆积。

### 5. 自动扩缩容

启用 `enableAutoScaling`，观察消费者根据堆积量自动调整数量。

## 输出指标

- **积压曲线**：各时间点消息积压量
- **乱序风险**：检测到的乱序消息数量
- **重复风险**：检测到的重复消息数量
- **消费延迟**：平均/最大消费延迟
- **死信队列**：进入死信的消息数量
- **扩容建议**：推荐的消费者数量调整

## 项目结构

```
src/
├── cli.ts              # CLI 入口
├── commands/           # 命令实现
│   ├── init.ts
│   ├── simulate.ts
│   ├── analyze.ts
│   └── export.ts
├── config/             # 配置解析
│   ├── parser.ts
│   └── validator.ts
├── simulation/         # 模拟引擎
│   ├── engine.ts
│   ├── producer.ts
│   ├── consumer.ts
│   ├── topic.ts
│   └── message.ts
├── store/              # SQLite 存储
│   └── sqlite.ts
├── analysis/           # 分析模块
│   ├── analyzer.ts
│   └── recommender.ts
├── export/             # 导出模块
│   ├── markdown.ts
│   └── json.ts
└── types/              # 类型定义
    └── index.ts
```

## License

MIT
