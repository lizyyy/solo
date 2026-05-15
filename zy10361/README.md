# 跨服务补偿指令 API

基于 Spring Boot 的跨服务补偿指令管理系统，提供分布式事务补偿能力。

## 项目概述

本项目实现了一套完整的补偿指令管理机制，主要功能包括：

- **补偿流程创建**：支持批量创建补偿流程和指令
- **幂等性保证**：重复提交不会产生脏数据
- **状态机管理**：完整的流程状态流转
- **执行顺序控制**：按指定顺序执行补偿指令
- **人工确认机制**：关键指令支持人工审核
- **失败重试机制**：自动重试失败的指令
- **历史查询**：支持按时间范围和状态筛选
- **结果导出**：生成完整的执行报告

## 技术栈

- **后端框架**：Spring Boot 2.7.x
- **ORM**：Spring Data JPA
- **数据库**：H2（内存数据库，可切换为 MySQL）
- **构建工具**：Maven
- **Java 版本**：8+

## 核心规则实现

### ✅ 1. 顺序控制
- **`/next` 接口**：仅返回真正可执行的下一条指令（最小的 `executionOrder`）
- **执行校验**：`executeInstruction` 会检查所有前序指令是否已完成
- **前序依赖**：乱序执行会返回明确的错误信息，说明哪个前序指令未完成

### ✅ 2. 可预测执行结果
- **默认行为**：所有补偿操作默认执行 **成功**
- **强制失败**：支持通过 `forceFail: true` 参数强制执行失败，用于测试重试逻辑
- **无随机性**：移除了随机数逻辑，结果完全可预测、可复现

### ✅ 3. 幂等性保证
- **创建流程**：重复提交相同 `processId` 不会创建新数据
- **执行指令**：重复提交相同 `executionId` 不会重复执行，直接返回幂等处理结果

## 项目结构

```
src/main/java/com/compensation/
├── CompensationApplication.java     # 启动类
├── controller/
│   └── CompensationController.java  # REST API 接口
├── service/
│   └── CompensationService.java     # 业务逻辑层
├── repository/                      # 数据访问层
│   ├── BusinessProcessRepository.java
│   ├── FailedNodeRepository.java
│   ├── CompensationInstructionRepository.java
│   ├── CompensationExecutionRepository.java
│   └── CompensationSummaryRepository.java
├── entity/                          # 数据实体
│   ├── BusinessProcess.java
│   ├── FailedNode.java
│   ├── CompensationInstruction.java
│   ├── CompensationExecution.java
│   └── CompensationSummary.java
├── dto/                             # 数据传输对象
│   ├── CreateCompensationRequest.java
│   ├── FailedNodeDTO.java
│   ├── CompensationInstructionDTO.java
│   ├── ExecuteInstructionRequest.java
│   ├── ManualConfirmRequest.java
│   └── ApiResponse.java
├── enums/                           # 枚举类型
│   ├── ProcessStatus.java
│   ├── InstructionStatus.java
│   └── NodeStatus.java
└── exception/                       # 异常处理
    ├── BusinessException.java
    └── GlobalExceptionHandler.java
```

## 核心数据模型

### 1. 业务流程 (BusinessProcess)
- `processId`: 流程唯一标识
- `status`: 流程状态（INIT/FAILED/COMPENSATING/COMPENSATED/COMPENSATION_FAILED）
- `totalNodes`: 总节点数
- `failedNodes`: 失败节点数

### 2. 失败节点 (FailedNode)
- `nodeId`: 节点ID
- `nodeName`: 节点名称
- `errorCode`: 错误码
- `errorMessage`: 错误信息
- `status`: 节点状态

### 3. 补偿指令 (CompensationInstruction)
- `instructionId`: 指令ID
- `instructionType`: 指令类型（ROLLBACK/COMPENSATE/NOTIFY等）
- `executionOrder`: 执行顺序
- `requireManualConfirm`: 是否需要人工确认
- `status`: 指令状态（PENDING/WAITING_MANUAL_CONFIRM/EXECUTING/SUCCESS/FAILED/SKIPPED）
- `retryCount`: 已重试次数
- `maxRetry`: 最大重试次数

### 4. 执行记录 (CompensationExecution)
- `executionId`: 执行ID（幂等键）
- `executor`: 执行人
- `executionResult`: 执行结果
- `resultDetail`: 结果详情

## API 接口文档

### 基础路径
```
http://localhost:8080/api/v1/compensation
```

### 1. 创建补偿流程
```http
POST /
Content-Type: application/json

{
  "processId": "ORDER-20240514-001",
  "processName": "订单创建流程",
  "serviceName": "order-service",
  "totalNodes": 3,
  "failedNodes": [
    {
      "nodeId": "NODE-001",
      "nodeName": "扣减库存",
      "serviceName": "inventory-service",
      "errorCode": "INVENTORY_LOCK_FAILED",
      "errorMessage": "库存不足",
      "instructions": [
        {
          "instructionType": "ROLLBACK",
          "instructionContent": "回滚库存",
          "executionOrder": 1,
          "requireManualConfirm": false,
          "maxRetry": 3
        }
      ]
    }
  ]
}
```

**幂等性说明**：重复提交相同 `processId` 不会创建新数据，直接返回已有数据。

### 2. 查看流程详情
```http
GET /{processId}
```

### 3. 启动补偿流程
```http
POST /{processId}/start
```

### 4. 人工确认指令
```http
POST /instruction/{instructionId}/confirm
Content-Type: application/json

{
  "operator": "admin",
  "remark": "确认执行"
}
```

### 5. 执行补偿指令
```http
POST /instruction/{instructionId}/execute
Content-Type: application/json

{
  "executionId": "EXEC-001",
  "executor": "system",
  "resultDetail": "执行详情"
}
```

**幂等性说明**：重复提交相同 `executionId` 不会重复执行。

### 6. 获取待执行指令
```http
GET /{processId}/next
```

### 7. 查询历史记录
```http
GET /history?startTime=2024-05-01 00:00:00&endTime=2024-05-15 23:59:59&status=COMPENSATED
```

### 8. 导出执行报告
```http
GET /{processId}/export
```

## 核心规则说明

### 状态流转
- **流程状态**：FAILED → COMPENSATING → COMPENSATED / COMPENSATION_FAILED
- **指令状态**：PENDING → WAITING_MANUAL_CONFIRM → PENDING → EXECUTING → SUCCESS / FAILED

### 执行顺序控制
指令按 `executionOrder` 升序执行，可通过 `/next` 接口获取下一条可执行指令。

### 失败重试
- 执行失败时自动增加重试计数
- 未达到最大重试次数时状态保持 PENDING
- 达到最大重试次数时状态变为 FAILED

### 人工确认
- `requireManualConfirm = true` 的指令在启动后进入 WAITING_MANUAL_CONFIRM 状态
- 必须经过人工确认后才能执行

## 运行项目

### 前置要求
- JDK 8+
- **不需要 Maven**（所有脚本都是独立的）

### ⭐ 快速启动（唯一推荐入口）
```bash
# 一键启动：自动清理旧 class、下载依赖、Java 8 模式编译、启动服务
./one-click-start.sh
```

**脚本自动完成 7 个步骤：**
1. 🔍 检查 Java 环境
2. 🧹 **强制删除旧 class 文件**（彻底解决 version 55 问题）
3. 🔧 移除 Lombok 注解，生成纯 Java 代码
4. 📦 自动下载所有依赖 jar 到 lib 目录
5. 🔨 用 `-source 1.8 -target 1.8` 编译所有源码
6. 🔍 验证 class 文件版本（确保是 52 = Java 8）
7. 🚀 启动 Spring Boot 服务

### 访问地址
- **API 接口**: http://localhost:8080/api/v1/compensation
- **H2 控制台**: http://localhost:8080/h2-console

### H2 数据库配置
- JDBC URL: `jdbc:h2:mem:compensation_db`
- Username: `sa`
- Password: （空）

## 测试验证

项目包含完整的测试脚本，自动验证所有验收要点：

```bash
# 第一步：启动服务（打开一个终端）
./one-click-start.sh

# 第二步：等待服务启动成功后，打开另一个终端运行测试
./test-full.sh
```

测试脚本会自动验证：
1. ✅ 幂等性（重复创建、重复执行）
2. ✅ 顺序控制（乱序执行被拦截）
3. ✅ 失败原因（前序依赖、人工确认）
4. ✅ 重试机制（maxRetry 限制）
5. ✅ 历史查询
6. ✅ 导出结果一致性

## 扩展建议

1. **持久化数据库**：将 H2 切换为 MySQL/PostgreSQL
2. **定时任务**：添加调度器自动执行待执行指令
3. **消息队列**：集成 Kafka/RabbitMQ 实现异步执行
4. **告警机制**：补偿失败时发送告警通知
5. **可视化界面**：开发管理后台查看和操作补偿流程
