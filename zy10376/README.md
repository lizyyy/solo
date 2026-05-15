# 接口撤销补偿 API (Undo Compensation API)

基于 Spring Boot 的分布式事务补偿服务，提供接口调用失败后的自动撤销补偿能力。

## 核心特性

- **撤销判定**: 根据动作执行结果自动判断是否需要补偿
- **补偿编排**: 按逆序编排补偿任务，确保数据一致性
- **失败隔离**: 补偿失败不影响其他任务，支持重试机制
- **结果确认**: 生成完成证明，包含 SHA-256 哈希校验
- **幂等处理**: 重复提交请求不会产生脏数据
- **管理控制台**: 内置 Web UI 方便测试和管理

## 快速开始

### 环境要求
- JDK 11+
- Maven 3.6+

### 启动服务

```bash
# 编译项目
mvn clean package -DskipTests

# 启动服务
mvn spring-boot:run
```

服务启动后访问:
- **管理控制台**: http://localhost:8080/
- **H2 数据库**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/compensation`
  - 用户名: `sa`
  - 密码: (空)

## API 接口

### 1. 创建补偿请求

```bash
POST /api/v1/compensation/requests
Content-Type: application/json

{
    "requestId": "REQ-001",
    "businessType": "ORDER_PROCESS",
    "businessKey": "ORDER-12345",
    "description": "正常订单处理流程",
    "maxRetry": 3,
    "actions": [
        {
            "actionId": "ACTION-001",
            "actionName": "扣减库存",
            "actionOrder": 1,
            "items": [
                {
                    "itemId": "ITEM-001",
                    "itemType": "STOCK",
                    "itemKey": "SKU-1001",
                    "revocable": true,
                    "compensationMethod": "RESTORE_STOCK",
                    "compensationParams": "{\"skuId\":1001}"
                }
            ]
        }
    ]
}
```

### 2. 校验请求

```bash
POST /api/v1/compensation/requests/{requestId}/validate
```

### 3. 执行请求

```bash
POST /api/v1/compensation/requests/{requestId}/execute
```

### 4. 查询请求详情

```bash
GET /api/v1/compensation/requests/{requestId}
```

### 5. 查询请求列表

```bash
GET /api/v1/compensation/requests?status=COMPLETED&startTime=2024-01-01T00:00:00&endTime=2024-12-31T23:59:59
```

### 6. 导出完成证明

```bash
GET /api/v1/compensation/requests/{requestId}/proof
```

## 使用场景示例

### 场景一：正常流程（成功完成）

```bash
# 1. 创建请求
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-NORMAL-001",
    "businessType": "ORDER_PROCESS",
    "businessKey": "ORDER-12345",
    "description": "正常订单处理",
    "actions": [
        {
            "actionId": "A001",
            "actionName": "扣减库存",
            "actionOrder": 1,
            "items": []
        },
        {
            "actionId": "A002",
            "actionName": "创建订单",
            "actionOrder": 2,
            "items": []
        }
    ]
  }'

# 2. 校验
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-NORMAL-001/validate

# 3. 执行
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-NORMAL-001/execute

# 4. 查看完成证明
curl http://localhost:8080/api/v1/compensation/requests/REQ-NORMAL-001/proof
```

### 场景二：失败补偿流程（触发异常）

```bash
# 1. 创建包含模拟失败的请求
# 注意：actionName = "FAIL_SIMULATION" 会触发执行失败
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-FAIL-001",
    "businessType": "PAYMENT_PROCESS",
    "businessKey": "PAY-67890",
    "description": "模拟失败补偿流程",
    "actions": [
        {
            "actionId": "A001",
            "actionName": "冻结账户",
            "actionOrder": 1,
            "items": [
                {
                    "itemId": "I001",
                    "itemType": "ACCOUNT",
                    "itemKey": "ACC-8888",
                    "revocable": true,
                    "compensationMethod": "UNFREEZE",
                    "compensationParams": "{\"accountId\":8888}"
                }
            ]
        },
        {
            "actionId": "A002",
            "actionName": "FAIL_SIMULATION",
            "actionOrder": 2,
            "items": []
        }
    ]
  }'

# 2. 校验并执行
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-FAIL-001/validate
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-FAIL-001/execute

# 3. 查看执行结果（会看到补偿任务被创建并执行）
curl http://localhost:8080/api/v1/compensation/requests/REQ-FAIL-001
```

### 场景三：重复提交幂等性验证

```bash
# 多次提交相同 requestId 的请求
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-IDEMPOTENT-001",
    "businessType": "TEST",
    "actions": []
  }'

# 再次提交相同 requestId，不会创建新记录
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-IDEMPOTENT-001",
    "businessType": "TEST",
    "actions": []
  }'

# 查看列表确认只有一条记录
curl http://localhost:8080/api/v1/compensation/requests
```

## 核心数据对象

### UndoRequest (撤销请求)
- `requestId`: 唯一请求ID（幂等键）
- `businessType`: 业务类型
- `status`: 请求状态 (CREATED/VALIDATING/VALIDATED/EXECUTING/COMPENSATING/COMPLETED/FAILED)
- `executedActions`: 已执行动作列表
- `compensationTasks`: 补偿任务列表

### ExecutedAction (已执行动作)
- `actionId`: 动作ID
- `actionOrder`: 执行顺序
- `status`: 动作状态
- `revocableItems`: 可撤销项

### RevocableItem (可撤销项)
- `itemType`: 资源类型
- `itemKey`: 资源标识
- `revocable`: 是否可撤销
- `compensationMethod`: 补偿方法
- `compensationParams`: 补偿参数

### CompensationTask (补偿任务)
- `taskOrder`: 补偿顺序（逆序）
- `status`: 任务状态
- `retryCount`: 重试次数
- `maxRetry`: 最大重试次数

### FailureReason (失败原因)
- `errorCode`: 错误码
- `errorMessage`: 错误信息
- `failedStep`: 失败步骤
- `recoverable`: 是否可恢复

### CompletionProof (完成证明)
- `proofId`: 证明ID
- `proofHash`: SHA-256 内容哈希
- `proofContent`: 完整证明内容
- 统计信息：成功/失败动作数、成功/失败任务数

## 状态流转

```
CREATED → VALIDATING → VALIDATED → EXECUTING → COMPLETED
                              ↓
                          PARTIAL_SUCCESS
                              ↓
                          COMPENSATING → COMPLETED
                                           ↓
                                         FAILED
```

## 项目结构

```
src/main/java/com/compensation/
├── CompensationApplication.java    # 启动类
├── controller/                     # REST 控制器
│   └── UndoCompensationController.java
├── service/                        # 业务服务
│   └── UndoCompensationService.java
├── entity/                         # 数据实体
│   ├── UndoRequest.java
│   ├── ExecutedAction.java
│   ├── RevocableItem.java
│   ├── CompensationTask.java
│   ├── FailureReason.java
│   └── CompletionProof.java
├── enums/                          # 枚举定义
│   ├── RequestStatus.java
│   ├── ActionStatus.java
│   └── CompensationStatus.java
├── dto/                            # 数据传输对象
│   ├── CreateUndoRequest.java
│   └── ApiResponse.java
├── exception/                      # 异常处理
│   └── GlobalExceptionHandler.java
└── repository/                     # 数据访问层
    ├── UndoRequestRepository.java
    ├── ExecutedActionRepository.java
    ├── RevocableItemRepository.java
    ├── CompensationTaskRepository.java
    ├── FailureReasonRepository.java
    └── CompletionProofRepository.java

src/main/resources/
├── application.yml                 # 配置文件
└── static/index.html               # 管理控制台
```

## 扩展说明

### 自定义补偿逻辑
在 `UndoCompensationService.executeCompensationTask()` 方法中添加实际的补偿调用逻辑。

### 持久化配置
默认使用 H2 嵌入式数据库，可在 `application.yml` 中配置 MySQL/PostgreSQL 等其他数据库。

### 异步补偿
当前为同步执行，可引入线程池或消息队列实现异步补偿处理。

## License
MIT
