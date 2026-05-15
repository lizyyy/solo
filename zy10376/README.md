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
- JDK 8+ (已兼容 Java 8，支持 JDK 8/11/17)
- Maven 3.6+ (项目已内置 Maven Wrapper，无需单独安装)

### 环境检查

```bash
# 检查 Java 版本
java -version

# 如使用 Maven Wrapper，Linux/Mac 需先添加执行权限
chmod +x mvnw
```

### 启动服务

**方式一：使用 Maven Wrapper (推荐)**
```bash
# Linux/Mac
./mvnw clean package -DskipTests
./mvnw spring-boot:run

# Windows
mvnw.cmd clean package -DskipTests
mvnw.cmd spring-boot:run
```

**方式二：使用已安装的 Maven**
```bash
mvn clean package -DskipTests
mvn spring-boot:run
```

**方式三：直接运行 JAR**
```bash
./mvnw clean package -DskipTests
java -jar target/undo-compensation-api-1.0.0.jar
```

服务启动后访问:
- **管理控制台**: http://localhost:8080/
- **H2 数据库**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/compensation`
  - 用户名: `sa`
  - 密码: (空)

### 核心功能验证流程

#### 验证 1：正常流程
```bash
# 1. 创建请求（使用管理控制台点击"正常流程"模板，然后点击创建）
# 或使用 curl：
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-TEST-001",
    "businessType": "ORDER_PROCESS",
    "actions": [
      {"actionId": "A001", "actionName": "扣减库存", "actionOrder": 1, "items": []},
      {"actionId": "A002", "actionName": "创建订单", "actionOrder": 2, "items": []}
    ]
  }'

# 2. 校验请求
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-TEST-001/validate

# 3. 执行请求
curl -X POST http://localhost:8080/api/v1/compensation/requests/REQ-TEST-001/execute

# 4. 查看请求状态，应为 COMPLETED
curl http://localhost:8080/api/v1/compensation/requests/REQ-TEST-001

# 5. 导出完成证明
curl http://localhost:8080/api/v1/compensation/requests/REQ-TEST-001/proof
```

#### 验证 2：失败补偿流程
```bash
# 1. 创建包含模拟失败的请求（使用管理控制台点击"失败补偿"模板）
# 注意：动作名称 "FAIL_SIMULATION" 会触发执行失败，触发补偿流程

# 2. 校验 → 执行

# 3. 查看结果，应能看到：
#    - 请求状态最终为 COMPLETED
#    - 已生成补偿任务列表
#    - 失败动作有对应的失败原因记录
```

#### 验证 3：幂等性（重复提交）
```bash
# 1. 重复提交相同 requestId 的请求
curl -X POST http://localhost:8080/api/v1/compensation/requests \
  -H "Content-Type: application/json" \
  -d '{"requestId": "REQ-IDEMPOTENT-001", "businessType": "TEST", "actions": []}'

# 2. 再次提交相同的 requestId，系统会返回已有记录，不会重复创建

# 3. 查询列表确认只有一条记录
curl http://localhost:8080/api/v1/compensation/requests
```

### 常见问题

**Q: 提示 class file version 不兼容怎么办？**
- 确保本地 Java 版本不低于编译时的版本，项目已配置为兼容 Java 8
- 使用 `java -version` 检查当前 Java 版本

**Q: Maven Wrapper 下载失败怎么办？**
- 检查网络连接
- 可以使用系统已安装的 Maven 直接执行 `mvn` 命令

**Q: H2 数据库连接失败怎么办？**
- 确保项目目录有读写权限
- 检查 JDBC URL 是否正确
- 确认服务已成功启动

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
