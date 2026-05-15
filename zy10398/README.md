# API 回放隐私预算

一个基于 Spring Boot 的 API 回放隐私预算管理系统，提供数据脱敏、预算控制、申请审批等功能。

## 功能特性

- **隐私预算管理**：预算扣减、次数限制、过期自动清理
- **数据脱敏**：5级脱敏级别，从无脱敏到完全脱敏
- **回放申请**：创建、审批、执行、状态流转
- **重复请求保护**：幂等性处理，防止重复提交
- **异常处理**：统一异常返回，错误码定义
- **历史查询**：执行记录追溯

## 技术栈

- Spring Boot 2.7.x
- Spring Data JPA
- H2 内存数据库
- Lombok
- Maven

## 快速启动

### 环境要求

- JDK 11+
- Maven 3.6+

### 启动命令

```bash
# 编译项目
mvn clean package -DskipTests

# 启动服务
java -jar target/api-replay-budget-1.0.0.jar

# 或使用 Maven 直接启动
mvn spring-boot:run
```

服务启动后访问：http://localhost:8080

### H2 数据库控制台

访问：http://localhost:8080/h2-console

- JDBC URL: `jdbc:h2:mem:replaybudget`
- 用户名: `sa`
- 密码: (空)

## 核心接口

### 1. 样本管理

**创建样本**
```bash
POST /api/sample/create?userId=user001&dataType=phone&sampleData=13800138000
```

**查询用户样本列表**
```bash
GET /api/sample/user/user001
```

### 2. 预算管理

**创建预算**
```bash
POST /api/budget/create?userId=user001&totalBudget=10000&maxUsageCount=100&defaultMaskingLevel=MEDIUM
```

**查询用户预算**
```bash
GET /api/budget/user001
```

### 3. 回放申请

**创建回放申请**
```bash
POST /api/replay/request
Content-Type: application/json

{
  "requestId": "REQ001",
  "requesterId": "user001",
  "purpose": "数据分析",
  "description": "用于用户行为分析",
  "sampleIds": ["SMPxxx1", "SMPxxx2"],
  "maskingLevel": "MEDIUM"
}
```

**审批回放申请**
```bash
POST /api/replay/approve
Content-Type: application/json

{
  "requestId": "REQ001",
  "approverId": "admin001",
  "approved": true,
  "comment": "同意申请"
}
```

**执行回放申请**
```bash
POST /api/replay/execute
Content-Type: application/json

{
  "requestId": "REQ001"
}
```

**查询申请详情**
```bash
GET /api/replay/request/REQ001
```

**查询申请列表**
```bash
GET /api/replay/requests?requesterId=user001
```

**查询执行历史**
```bash
GET /api/replay/history?requesterId=user001
```

## 脱敏级别说明

| 级别 | 枚举值 | 说明 | 示例 |
|------|--------|------|------|
| 0 | NONE | 不脱敏 | 13800138000 |
| 1 | LOW | 低级别脱敏 | 138****8000 |
| 2 | MEDIUM | 中级别脱敏 | 13****8000 |
| 3 | HIGH | 高级别脱敏 | ********** |
| 4 | FULL | 完全脱敏 | ****** |

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 参数错误 |
| 1002 | 重复请求 |
| 2001 | 隐私预算不存在 |
| 2002 | 隐私预算不足 |
| 2003 | 使用次数超限 |
| 2004 | 预算已过期 |
| 3001 | 回放申请不存在 |
| 3002 | 申请状态无效 |
| 3003 | 申请已处理 |
| 4001 | 用户样本不存在 |
| 4002 | 样本已失效 |
| 5001 | 脱敏级别不允许 |
| 9999 | 系统内部错误 |

## 测试示例

### 正常流程测试

```bash
# 1. 先获取用户样本列表，拿到 sampleId
curl "http://localhost:8080/api/sample/user/user001"

# 2. 创建回放申请
curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST001",
    "requesterId": "user001",
    "purpose": "测试",
    "sampleIds": ["SMPxxx1"],
    "maskingLevel": "MEDIUM"
  }'

# 3. 审批申请
curl -X POST "http://localhost:8080/api/replay/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST001",
    "approverId": "admin001",
    "approved": true
  }'

# 4. 执行申请
curl -X POST "http://localhost:8080/api/replay/execute" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "TEST001"}'
```

### 异常场景测试

**预算不足的拦截示例**

```bash
# user002 只有 500 预算
# 执行一个高成本请求会被拦截

curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_BLOCK_001",
    "requesterId": "user002",
    "purpose": "测试拦截",
    "sampleIds": ["SMPxxx1", "SMPxxx2", "SMPxxx3", "SMPxxx4", "SMPxxx5", "SMPxxx6", "SMPxxx7", "SMPxxx8", "SMPxxx9", "SMPxxx10"],
    "maskingLevel": "HIGH"
  }'

# 返回结果会被拦截：
# {"code":2002,"message":"隐私预算不足","success":false}
```

### 重复请求测试

```bash
# 连续提交两次相同 requestId 的请求
# 第二次会返回重复请求错误，或直接返回第一次的结果

curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_DUP_001",
    "requesterId": "user001",
    "purpose": "重复测试",
    "sampleIds": ["SMPxxx1"],
    "maskingLevel": "MEDIUM"
  }'

# 再次提交相同请求
curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_DUP_001",
    "requesterId": "user001",
    "purpose": "重复测试",
    "sampleIds": ["SMPxxx1"],
    "maskingLevel": "MEDIUM"
  }'
```

### 脱敏级别不允许测试

```bash
# user001 默认脱敏级别是 MEDIUM
# 请求 LOW 级别会被拦截

curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST_MASK_001",
    "requesterId": "user001",
    "purpose": "脱敏级别测试",
    "sampleIds": ["SMPxxx1"],
    "maskingLevel": "LOW"
  }'

# 返回结果会被拦截：
# {"code":5001,"message":"脱敏级别不允许","success":false}
```

## 一条会被拦截的路径

**预算不足拦截测试：**

```bash
# user002 用户预算只有 500
# 执行包含10个样本的高级别回放，预算成本超过500，会被拦截

curl -X POST "http://localhost:8080/api/replay/request" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "BLOCK_DEMO_001",
    "requesterId": "user002",
    "purpose": "拦截演示",
    "sampleIds": ["SMP001", "SMP002", "SMP003", "SMP004", "SMP005", "SMP006", "SMP007", "SMP008", "SMP009", "SMP010"],
    "maskingLevel": "HIGH"
  }'
```

**预期拦截响应：**
```json
{
  "code": 2002,
  "message": "隐私预算不足",
  "success": false
}
```

## 项目结构

```
api-replay-budget/
├── src/main/java/com/privacy/replay/
│   ├── ReplayBudgetApplication.java    # 启动类
│   ├── config/                          # 配置类
│   │   ├── DataInitializer.java
│   │   └── JacksonConfig.java
│   ├── controller/                      # 控制器
│   │   ├── BudgetController.java
│   │   ├── ReplayController.java
│   │   └── SampleController.java
│   ├── dto/                             # 数据传输对象
│   │   ├── ApiResponse.java
│   │   ├── ApproveReplayRequest.java
│   │   ├── CreateReplayRequest.java
│   │   └── ExecuteReplayRequest.java
│   ├── exception/                       # 异常处理
│   │   ├── BusinessException.java
│   │   ├── ErrorCode.java
│   │   └── GlobalExceptionHandler.java
│   ├── model/                           # 数据模型
│   │   ├── IdempotentRecord.java
│   │   ├── MaskingLevel.java
│   │   ├── PrivacyBudget.java
│   │   ├── ReplayHistory.java
│   │   ├── ReplayRequest.java
│   │   ├── ReplayRequestStatus.java
│   │   └── UserSample.java
│   ├── repository/                      # 数据访问层
│   │   ├── IdempotentRecordRepository.java
│   │   ├── PrivacyBudgetRepository.java
│   │   ├── ReplayHistoryRepository.java
│   │   ├── ReplayRequestRepository.java
│   │   └── UserSampleRepository.java
│   └── service/                         # 业务逻辑层
│       ├── IdempotentService.java
│       ├── PrivacyBudgetService.java
│       ├── ReplayService.java
│       └── UserSampleService.java
├── src/main/resources/
│   └── application.yml                  # 配置文件
└── pom.xml                              # Maven 配置
```

## 定时任务

系统内置以下定时任务：

- 每天 01:00：清理过期预算
- 每天 02:00：清理过期幂等记录
- 每天 03:00：清理过期样本数据
- 每天 04:00：清理过期待审批申请
