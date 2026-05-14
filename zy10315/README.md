# 服务实例排空 API

## 项目概述

服务实例排空 API 是一个用于管理服务实例生命周期、实现优雅下线的核心基础设施服务。通过标准化的API契约、严格的状态机控制、完整的操作审计追踪，确保服务实例排空过程可追溯、责任可界定。

## 核心特性

- ✅ **完整状态机控制** - 17种状态转换，确保流程合规
- ✅ **幂等性保障** - 重复提交不会产生脏数据
- ✅ **连接观察** - 实时追踪长连接状态
- ✅ **任务迁移** - 支持队列任务平滑迁移
- ✅ **摘流结果记录** - 记录流量切换前后对比
- ✅ **失败恢复机制** - 支持批次失败后的恢复操作
- ✅ **完整审计日志** - 所有操作都有历史记录

## 数据模型

### 核心实体

| 实体 | 说明 | 关键字段 |
|------|------|----------|
| DrainBatch | 排空批次 | batchId, status, operator, reason |
| ServiceInstance | 服务实例 | instanceId, serviceName, ip |
| PersistentConnection | 长连接 | connectionId, clientIp, status |
| QueueTask | 队列任务 | taskId, queueName, status |
| TrafficOffloadResult | 摘流结果 | initialConnections, finalConnections |
| RecoveryAction | 恢复动作 | actionType, reason, success |
| DrainActionLog | 操作日志 | fromStatus, toStatus, operator |

### 排空状态机

```
INIT → VALIDATING → VALIDATED → TRAFFIC_OFFLOADING → TRAFFIC_OFFLOADED 
     → CONNECTION_OBSERVING → CONNECTIONS_EMPTY → TASK_MIGRATING → TASKS_MIGRATED 
     → DRAINING → DRAINED → COMPLETED

FAILED → RECOVERING → RECOVERED

任何状态可跳转 → CANCELLED
```

## API 接口

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/drain/batches` | 获取所有批次列表 |
| POST | `/api/v1/drain/batches` | 创建新批次 |
| GET | `/api/v1/drain/batches/{batchId}` | 获取批次详情 |

### 状态推进

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/drain/batches/{batchId}/validate` | 校验批次合法性 |
| POST | `/api/v1/drain/batches/{batchId}/offload` | 执行流量摘除 |
| POST | `/api/v1/drain/batches/{batchId}/observe` | 观察连接排空状态 |
| POST | `/api/v1/drain/batches/{batchId}/migrate` | 迁移队列任务 |
| POST | `/api/v1/drain/batches/{batchId}/drain` | 执行最终排空 |
| POST | `/api/v1/drain/batches/{batchId}/complete` | 完成排空流程 |
| POST | `/api/v1/drain/batches/{batchId}/cancel` | 取消批次 |
| POST | `/api/v1/drain/batches/{batchId}/recover` | 恢复失败批次 |

### 响应结构示例

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "batchId": "batch001",
    "operator": "admin",
    "reason": "版本升级",
    "status": "COMPLETED",
    "instances": [...],
    "actionLogs": [...],
    "connections": [...],
    "tasks": [...],
    "offloadResults": [...],
    "recoveryActions": [...]
  },
  "timestamp": "2024-05-14T10:30:00"
}
```

## 快速开始

### 方式一：使用独立服务器（推荐，Java 8+ 兼容）

```bash
# 编译项目
javac -d target/classes src/main/java/com/infrastructure/drain/model/*.java
javac -cp target/classes -d target/classes src/main/java/com/infrastructure/drain/SimpleDrainServer.java

# 启动服务
java -cp target/classes com.infrastructure.drain.SimpleDrainServer
```

### 方式二：使用 Maven（需要 Maven 环境）

```bash
# 编译
mvn clean compile

# 运行测试
mvn test

# 启动 Spring Boot 应用
mvn spring-boot:run
```

### 方式三：使用验证脚本

```bash
# 运行项目完整性验证
./verify.sh

# 运行完整验收测试
./acceptance_test.sh

# 一键编译并启动
./build_and_run.sh
```

## 验收测试场景

### 1. 基础场景测试

```bash
# 健康检查
curl http://localhost:8080/health

# 创建批次
curl -X POST http://localhost:8080/api/v1/drain/batches \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch001","operator":"admin","reason":"版本升级"}'

# 重复创建（幂等性验证）
curl -X POST http://localhost:8080/api/v1/drain/batches \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch001","operator":"admin","reason":"版本升级"}'
```

### 2. 完整流程推进

```bash
# 1. 校验批次
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/validate

# 2. 执行摘流
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/offload

# 3. 观察连接
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/observe

# 4. 任务迁移
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/migrate

# 5. 执行排空
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/drain

# 6. 完成流程
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/complete
```

### 3. 异常场景测试

```bash
# 非法状态跳转（已完成的批次不能再操作）
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/drain

# 取消批次
curl -X POST http://localhost:8080/api/v1/drain/batches/batch001/cancel

# 查询不存在的批次
curl http://localhost:8080/api/v1/drain/batches/nonexistent
```

### 4. 历史追溯

```bash
# 查询批次详情（包含所有操作历史和明细数据）
curl http://localhost:8080/api/v1/drain/batches/batch001
```

## 项目结构

```
service-instance-drain-api/
├── src/main/java/com/infrastructure/drain/
│   ├── controller/
│   │   └── DrainController.java          # API 控制器
│   ├── dto/
│   │   ├── ApiResponse.java               # 统一响应封装
│   │   └── ...                            # 请求/响应 DTO
│   ├── exception/
│   │   ├── DrainException.java            # 业务异常
│   │   └── GlobalExceptionHandler.java    # 全局异常处理
│   ├── model/
│   │   ├── DrainStatus.java               # 状态枚举
│   │   ├── DrainBatch.java                # 排空批次
│   │   ├── ServiceInstance.java           # 服务实例
│   │   ├── PersistentConnection.java      # 长连接
│   │   ├── QueueTask.java                 # 队列任务
│   │   ├── TrafficOffloadResult.java      # 摘流结果
│   │   ├── RecoveryAction.java            # 恢复动作
│   │   └── DrainActionLog.java            # 操作日志
│   ├── repository/                         # JPA 数据访问层
│   ├── service/
│   │   ├── DrainStateMachine.java         # 状态机引擎
│   │   └── DrainService.java               # 核心业务逻辑
│   ├── StandaloneDrainServer.java         # 独立 HTTP 服务器
│   ├── SimpleDrainServer.java             # 简化版服务器（Java 8 兼容）
│   └── DrainApiApplication.java           # Spring Boot 启动类
├── src/test/java/
│   └── DrainServiceTest.java               # 单元测试
├── pom.xml                                  # Maven 配置
├── README.md                                # 项目文档
├── verify.sh                                # 项目验证脚本
├── acceptance_test.sh                       # 验收测试脚本
└── build_and_run.sh                         # 一键编译启动脚本
```

## 技术栈

- **语言**: Java 8+
- **框架**: Spring Boot 2.x (可选)
- **HTTP 服务器**: 内置 ServerSocket / HttpServer
- **数据存储**: 内存存储 (可扩展为 JPA/MySQL)
- **测试**: JUnit 5
- **构建**: Maven

## 设计原则

1. **API 优先**: 明确的接口契约，便于集成
2. **幂等性**: 重复操作不产生副作用
3. **可追溯**: 所有状态变更都有审计日志
4. **容错性**: 支持失败恢复和取消操作
5. **状态机**: 严格的状态跳转验证

## 故障排查责任界定

通过完整的操作日志和状态历史，可以清晰界定：

- 谁在什么时间执行了什么操作
- 状态从什么变为什么
- 摘流前后的连接数变化
- 任务迁移的目标和结果
- 失败恢复的执行情况

## 许可证

本项目仅供内部基础设施使用。
