# 服务实例排空 API

## 项目简介

服务实例排空管理 API，确保实例排空过程可追踪、可重复、责任清晰。

**核心特性：**
- 完整的排空状态机流转控制
- 长连接观察与任务迁移追踪
- 摘流结果与恢复动作记录
- 操作历史全程追溯（可查询、可推进、可追溯）
- 幂等性调用支持

## 技术栈

- Java 11
- Spring Boot 2.7.18
- Spring Data JPA
- H2 Database (内存)
- Swagger 3.0
- JUnit 5

## 状态机流转

```
INIT → VALIDATING → VALIDATED → TRAFFIC_OFFLOADING → TRAFFIC_OFFLOADED 
→ CONNECTION_OBSERVING → CONNECTIONS_EMPTY → TASK_MIGRATING → TASKS_MIGRATED 
→ DRAINING → DRAINED → COMPLETED

FAILED → RECOVERING → RECOVERED

* 大部分状态支持 → CANCELLED
```

## 快速开始

### 环境要求

- JDK 11+

### 编译项目（无需 Maven）

```bash
./verify.sh
```

### 运行项目

```bash
java -cp target/classes com.infrastructure.drain.DrainApiApplication
```

### 运行测试

```bash
mvn test
```

## API 接口

服务启动后访问：
- API 文档：http://localhost:8080/swagger-ui.html
- H2 控制台：http://localhost:8080/h2-console

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/drain/batches` | 创建排空批次 |
| POST | `/api/v1/drain/batches/{batchId}/validate` | 校验批次 |
| POST | `/api/v1/drain/batches/{batchId}/offload` | 开始摘流 |
| POST | `/api/v1/drain/batches/{batchId}/observe` | 观察连接状态 |
| POST | `/api/v1/drain/batches/{batchId}/migrate` | 迁移任务 |
| POST | `/api/v1/drain/batches/{batchId}/drain` | 执行排空 |
| POST | `/api/v1/drain/batches/{batchId}/complete` | 完成排空流程 |
| POST | `/api/v1/drain/batches/{batchId}/recover` | 恢复失败批次 |
| POST | `/api/v1/drain/batches/{batchId}/cancel` | 取消批次 |
| GET | `/api/v1/drain/batches/{batchId}` | 获取批次详情（含操作历史） |
| GET | `/api/v1/drain/batches` | 获取所有批次列表 |

## API 响应结构

GET `/api/v1/drain/batches/{batchId}` 返回完整的批次信息：

```json
{
  "batchId": "BATCH-001",
  "operator": "admin",
  "status": "VALIDATED",
  "instances": [...],
  "actionLogs": [...],      // 操作历史
  "offloadResults": [...],   // 摘流结果
  "connections": [...],      // 长连接明细
  "tasks": [...],            // 队列任务明细
  "recoveryActions": [...]   // 恢复动作记录
}
```

## 核心数据模型

1. **DrainBatch** - 排空批次
2. **ServiceInstance** - 服务实例
3. **PersistentConnection** - 长连接
4. **QueueTask** - 队列任务
5. **TrafficOffloadResult** - 摘流结果
6. **RecoveryAction** - 恢复动作
7. **DrainActionLog** - 操作日志

## 验证脚本

项目提供 `verify.sh` 脚本用于快速验证：

```bash
chmod +x verify.sh
./verify.sh
```

## 项目结构

```
src/
├── main/
│   ├── java/com/infrastructure/drain/
│   │   ├── controller/     # API 控制器
│   │   ├── dto/           # 数据传输对象（含操作历史）
│   │   ├── exception/     # 异常处理
│   │   ├── model/         # 数据实体
│   │   ├── repository/    # 数据访问层
│   │   ├── service/       # 业务逻辑层（完整实现）
│   │   └── DrainApiApplication.java
│   └── resources/
│       └── application.yml
└── test/
    └── java/com/infrastructure/drain/
        └── DrainServiceTest.java

README.md
verify.sh
pom.xml
```

## 使用示例

### 1. 创建排空批次

```bash
curl -X POST http://localhost:8080/api/v1/drain/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH-001",
    "operator": "admin",
    "reason": "例行维护",
    "instances": [
      {"instanceId": "INSTANCE-001", "serviceName": "order-service", "ip": "192.168.1.1"}
    ]
  }'
```

### 2. 校验批次

```bash
curl -X POST "http://localhost:8080/api/v1/drain/batches/BATCH-001/validate?operator=admin"
```

### 3. 获取批次详情（含操作历史）

```bash
curl http://localhost:8080/api/v1/drain/batches/BATCH-001
```

## 关键特性实现

### 连接观察
- 自动模拟长连接数据
- 实时追踪连接状态变化

### 任务迁移
- 支持任务状态追踪
- 记录目标实例信息

### 摘流确认
- 记录摘流前后连接数变化
- 生成摘流结果报告

### 失败恢复
- 恢复实例连接状态
- 回滚任务状态
- 记录恢复动作

### 历史追溯
- 完整操作日志记录
- 状态变更轨迹追踪
- 责任可界定
