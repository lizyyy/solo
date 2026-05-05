# Message Queue Analyzer

一个用于分析和复盘消息队列问题的本地后端 API 服务。

## 功能特性

- 📥 **数据导入**：支持导入 producers.yaml、topics.yaml、messages.jsonl、delivery-events.jsonl
- 🔍 **投递链路追踪**：查询单条消息的完整投递链路
- 🔄 **模拟重放**：模拟消息重放投递，识别潜在问题
- 🎯 **问题识别**：自动检测以下问题类型：
  - ACK 丢失 (ack_lost)
  - 重复投递 (duplicate_delivery)
  - 最大重试 (max_retry_reached)
  - 死信原因 (dead_letter)
  - 顺序键乱序 (order_key_violation)
  - 消费者积压 (consumer_backlog)
  - 幂等风险 (idempotency_risk)
- 📊 **报告导出**：支持生成 Markdown 和 JSON 格式的分析报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

开发模式（自动重启）：

```bash
npm run dev
```

### 运行测试

```bash
npm test
```

## API 文档

### 健康检查

```bash
curl http://localhost:3000/health
```

### 数据导入

#### 导入所有数据（推荐）

```bash
curl -X POST http://localhost:3000/api/import/all \
  -H "Content-Type: application/json" \
  -d '{
    "directory": "./data"
  }'
```

#### 单独导入各文件

```bash
# 导入 producers.yaml
curl -X POST http://localhost:3000/api/import/producers \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/producers.yaml"}'

# 导入 topics.yaml
curl -X POST http://localhost:3000/api/import/topics \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/topics.yaml"}'

# 导入 messages.jsonl
curl -X POST http://localhost:3000/api/import/messages \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/messages.jsonl"}'

# 导入 delivery-events.jsonl
curl -X POST http://localhost:3000/api/import/delivery-events \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data/delivery-events.jsonl"}'
```

### 消息分析

#### 分析单条消息

```bash
curl http://localhost:3000/api/analysis/messages/msg-003
```

#### 查询消息投递链路

```bash
curl http://localhost:3000/api/analysis/messages/msg-003/delivery-chain
```

#### 模拟重放投递

```bash
curl -X POST http://localhost:3000/api/analysis/messages/msg-003/replay \
  -H "Content-Type: application/json" \
  -d '{"consumerGroup": "order-processor-group"}'
```

#### 批量分析消息

```bash
curl -X POST http://localhost:3000/api/analysis/batch \
  -H "Content-Type: application/json" \
  -d '{
    "messageIds": ["msg-001", "msg-002", "msg-003", "msg-004", "msg-005", "msg-008", "msg-009"]
  }'
```

#### 获取统计信息

```bash
curl http://localhost:3000/api/analysis/statistics
```

### 复盘任务管理

#### 创建复盘任务

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单系统问题复盘",
    "description": "分析最近订单系统的消息队列问题",
    "messageIds": ["msg-001", "msg-002", "msg-003", "msg-004", "msg-005", "msg-008", "msg-009", "msg-010"],
    "consumerGroup": "order-processor-group"
  }'
```

#### 获取所有任务

```bash
curl http://localhost:3000/api/tasks
```

#### 获取单个任务

```bash
curl http://localhost:3000/api/tasks/{task-id}
```

#### 执行任务

```bash
curl -X POST http://localhost:3000/api/tasks/{task-id}/execute
```

#### 生成任务报告

```bash
# Markdown 格式
curl -X POST "http://localhost:3000/api/tasks/{task-id}/report?format=markdown"

# JSON 格式
curl -X POST "http://localhost:3000/api/tasks/{task-id}/report?format=json"
```

### 报告管理

#### 生成 JSON 报告

```bash
curl -X POST http://localhost:3000/api/reports/json \
  -H "Content-Type: application/json" \
  -d '{"taskId": "{task-id}"}'
```

#### 生成 Markdown 报告

```bash
curl -X POST http://localhost:3000/api/reports/markdown \
  -H "Content-Type: application/json" \
  -d '{"taskId": "{task-id}"}'
```

#### 导出报告

```bash
curl http://localhost:3000/api/reports/{report-id}/export -o report.md
```

### 数据查询

#### 查询所有生产者

```bash
curl http://localhost:3000/api/data/producers
```

#### 查询所有主题

```bash
curl http://localhost:3000/api/data/topics
```

#### 查询消息

```bash
# 所有消息
curl http://localhost:3000/api/data/messages

# 按主题查询
curl "http://localhost:3000/api/data/messages?topic=order-events"

# 按顺序键查询
curl "http://localhost:3000/api/data/messages?orderKey=order-12345"
```

#### 查询投递事件

```bash
# 所有事件
curl http://localhost:3000/api/data/delivery-events

# 按消息 ID 查询
curl "http://localhost:3000/api/data/delivery-events?messageId=msg-005"

# 按消费者组查询
curl "http://localhost:3000/api/data/delivery-events?consumerGroup=payment-processor-group"
```

#### 获取数据统计

```bash
curl http://localhost:3000/api/data/stats
```

#### 清空所有数据

```bash
curl -X DELETE http://localhost:3000/api/data/clear
```

## 数据格式说明

### producers.yaml

```yaml
producers:
  - id: producer-001
    name: order-service-producer
    topic: order-events
    enabled: true
    createdAt: "2024-01-01T10:00:00Z"
    metadata:
      service: "order-service"
      region: "cn-beijing"
```

### topics.yaml

```yaml
topics:
  - id: topic-001
    name: order-events
    partitions: 4
    replicationFactor: 3
    retentionMs: 604800000
    orderKeyEnabled: true
    createdAt: "2024-01-01T09:00:00Z"
    metadata:
      description: "Order lifecycle events"
```

### messages.jsonl (JSON Lines 格式)

每行一个 JSON 对象：

```json
{"id": "msg-001", "topic": "order-events", "partition": 0, "offset": 1001, "key": "order-12345", "value": {"orderId": "order-12345", "status": "created"}, "orderKey": "order-12345", "producerId": "producer-001", "timestamp": "2024-01-15T10:00:00Z", "headers": {"message-id": "msg-001"}, "metadata": {}}
```

### delivery-events.jsonl (JSON Lines 格式)

事件类型：
- `deliver` - 投递
- `ack` - 确认
- `nack` - 拒绝
- `retry` - 重试
- `dead-letter` - 死信

```json
{"id": "event-001", "messageId": "msg-001", "consumerId": "consumer-order-001", "consumerGroup": "order-processor-group", "type": "deliver", "attempt": 1, "timestamp": "2024-01-15T10:00:10Z", "durationMs": null, "error": null, "metadata": {}}
```

## 坏样例说明

示例数据中包含以下问题场景：

| 消息 ID | 问题类型 | 说明 |
|---------|---------|------|
| msg-003 | ACK 丢失 | 投递后无确认，无后续事件 |
| msg-004 | 重复投递 | 同一尝试号投递 2 次 |
| msg-005 | 最大重试 | 重试 5 次失败 |
| msg-008 | 死信 | 重试 5 次后进入死信队列 |
| msg-009 | 幂等风险 | 重复投递且无唯一键 |
| msg-001/002/010 | 顺序键乱序 | 同一 orderKey 的 offset 顺序不一致 |

## 项目结构

```
.
├── data/
│   ├── producers.yaml          # 生产者配置
│   ├── topics.yaml             # 主题配置
│   ├── messages.jsonl          # 消息数据（含坏样例）
│   └── delivery-events.jsonl   # 投递事件（含各种问题场景）
├── src/
│   ├── controllers/
│   │   ├── importController.js    # 导入控制器
│   │   ├── analysisController.js  # 分析控制器
│   │   ├── taskController.js      # 任务控制器
│   │   ├── reportController.js    # 报告控制器
│   │   └── dataController.js      # 数据查询控制器
│   ├── models/
│   │   └── index.js             # 数据模型定义
│   ├── routes/
│   │   └── index.js             # API 路由
│   ├── services/
│   │   ├── importService.js     # 数据导入服务
│   │   ├── analysisService.js   # 分析引擎服务
│   │   └── reportService.js     # 报告生成服务
│   ├── store/
│   │   └── index.js             # 内存数据存储
│   └── index.js                 # 应用入口
├── tests/
│   └── app.test.js              # 基础测试
├── package.json
└── README.md
```

## 完整工作流示例

```bash
# 1. 启动服务
npm start

# 2. 导入示例数据
curl -X POST http://localhost:3000/api/import/all \
  -H "Content-Type: application/json" \
  -d '{"directory": "./data"}'

# 3. 查看数据统计
curl http://localhost:3000/api/data/stats

# 4. 分析有问题的消息
curl http://localhost:3000/api/analysis/messages/msg-003
curl http://localhost:3000/api/analysis/messages/msg-005
curl http://localhost:3000/api/analysis/messages/msg-008

# 5. 创建复盘任务
TASK_ID=$(curl -s -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单系统问题复盘",
    "description": "分析订单系统的消息队列问题",
    "messageIds": ["msg-001", "msg-002", "msg-003", "msg-004", "msg-005", "msg-008", "msg-009", "msg-010"],
    "consumerGroup": "order-processor-group"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "Task ID: $TASK_ID"

# 6. 执行任务
curl -X POST http://localhost:3000/api/tasks/$TASK_ID/execute

# 7. 生成 Markdown 报告
REPORT_ID=$(curl -s -X POST "http://localhost:3000/api/tasks/$TASK_ID/report?format=markdown" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

# 8. 导出报告
curl http://localhost:3000/api/reports/$REPORT_ID/export -o analysis-report.md

# 9. 查看报告
cat analysis-report.md
```

## License

MIT
