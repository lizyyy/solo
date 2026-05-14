# Webhook 顺序保证 API

一个保证事件按序列号顺序处理的单体后端服务。

## 功能特性

- **序列校验**：确保事件按期望的序列号顺序处理
- **等待缓存**：乱序事件进入等待队列，待缺口补齐后继续处理
- **缺口超时**：长时间缺口自动超时，强制继续处理
- **乱序告警**：检测到序列号缺口时记录日志
- **处理回执**：每个事件都有明确的处理状态和结果
- **幂等性**：重复提交相同 eventId 的事件不会产生脏数据

## 核心数据模型

- **事件主题 (topic)**：事件类型分类
- **业务键 (businessKey)**：同一业务实体的唯一标识
- **序列号 (sequenceNumber)**：事件的顺序号，必须连续递增
- **等待队列 (waitingQueue)**：存储乱序事件
- **乱序原因 (outOfOrderReason)**：GAP/DUPLICATE/RETROACTIVE/TIMEOUT/NONE
- **处理状态 (status)**：PENDING/WAITING/PROCESSING/SUCCESS/FAILED/TIMEOUT/SKIPPED

## API 接口

### 创建事件
```bash
POST /api/v1/events
Content-Type: application/json

{
  "eventId": "evt-001",
  "topic": "order",
  "businessKey": "order-123",
  "sequenceNumber": 1,
  "payload": {
    "action": "create"
  }
}
```

### 查询单个事件
```bash
GET /api/v1/events/{eventId}
```

### 查询事件列表
```bash
GET /api/v1/events?topic=order&businessKey=order-123
GET /api/v1/events?status=success
```

### 查询序列状态
```bash
GET /api/v1/events/state?topic=order&businessKey=order-123
```

### 导出事件
```bash
GET /api/v1/events/export
GET /api/v1/events/export?topic=order&businessKey=order-123
```

### 健康检查
```bash
GET /api/v1/events/health
```

## 快速开始

### 环境要求
- Java 8+

### 推荐方式：独立版本（无需 Maven）

这是最简单的方式，无需任何构建工具，直接用 JDK 编译运行：

```bash
# 1. 一键启动服务器
./start_server.sh

# 2. 新开终端，运行完整测试
./test_standalone.sh
```

### Spring Boot 版本（需要 Maven）

如果系统安装了 Maven，可以使用完整的 Spring Boot 版本：

```bash
# 编译项目
mvn clean compile

# 打包
mvn clean package -DskipTests

# 运行
java -jar target/webhook-sequence-api-1.0.0.jar
```

### 运行测试
```bash
# 独立版本测试（推荐）
./test_standalone.sh

# 或 Spring Boot 版本测试
./test_api.sh
```

## 配置说明

```yaml
webhook:
  sequence:
    gap-timeout-seconds: 30    # 缺口超时时间（秒）
    max-wait-queue-size: 1000 # 最大等待队列大小
```

## 测试场景

1. **顺序提交**：1 -> 2 -> 3 -> 4，全部 success
2. **乱序提交**：1 -> 2 -> 4（等待） -> 3（触发4一起处理）
3. **幂等测试**：重复提交相同 eventId，返回 isIdempotent=true
4. **回溯序列号**：提交小于当前序列号的事件，返回 skipped
5. **超时处理**：缺口超过 30 秒，强制处理等待队列

## HTTP 状态码说明

- `200 OK`：顺序处理成功
- `202 Accepted`：乱序进入等待队列
- `409 Conflict`：重复/回溯序列号被跳过
- `400 Bad Request`：参数校验失败
- `500 Internal Server Error`：服务器内部错误
