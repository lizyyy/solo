# 服务实例排空 API

## 项目简介

服务实例排空管理 API，确保实例排空过程可追踪、可重复、责任清晰。

- 支持完整的排空状态机流转
- 长连接观察与任务迁移追踪
- 摘流结果与恢复动作记录
- 操作历史全程追溯
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
- Maven 3.6+

### 构建项目

```bash
mvn clean compile
```

### 运行项目

```bash
mvn spring-boot:run
```

或者运行编译后的主类：

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
| GET | `/api/v1/drain/batches/{batchId}` | 获取批次详情 |
| GET | `/api/v1/drain/batches` | 获取所有批次列表 |

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
│   │   ├── dto/           # 数据传输对象
│   │   ├── exception/     # 异常处理
│   │   ├── model/         # 数据实体
│   │   ├── repository/    # 数据访问层
│   │   ├── service/       # 业务逻辑层
│   │   └── DrainApiApplication.java
│   └── resources/
│       └── application.yml
└── test/
    └── java/com/infrastructure/drain/
        └── DrainServiceTest.java
```
