# 接口证据链追踪 API

## 项目简介

接口证据链追踪服务，用于研发和支持团队按同一套记录排查问题。核心围绕业务单号、入口请求、内部动作、外部回执、人工备注、证据摘要展开。

## 技术栈

- Spring Boot 2.7.x
- Spring Data JPA
- H2 内存数据库
- Swagger 2
- Lombok
- FastJSON

## 快速开始

### 1. 启动服务

**方式一：使用启动脚本（推荐）**

```bash
./start.sh
```

**方式二：使用 Maven Wrapper**

```bash
./mvnw clean spring-boot:run
```

> 首次启动会自动下载 Maven 和项目依赖，无需系统预装 Maven。

服务启动后访问：
- API 文档: http://localhost:8080/swagger-ui.html
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:evidencedb
  - 用户名: sa
  - 密码: (空)

### 2. 预置测试数据

服务启动后自动创建3条测试证据链：
- REQ-TEST-001: 成功支付的完整流程
- REQ-TEST-002: 处理中的库存扣减
- REQ-TEST-003: 失败的支付，含人工备注

## API 接口说明

### 创建证据链

```bash
POST /api/evidence/create
Content-Type: application/json

{
  "businessNo": "ORD-2024-001",
  "requestId": "REQ-UNIQUE-001",
  "sourceSystem": "ORDER-SYSTEM",
  "targetSystem": "PAYMENT-SYSTEM",
  "apiName": "createPayment",
  "requestBody": "{\"amount\":100}",
  "operator": "system"
}
```

**幂等性说明**：相同 requestId 重复提交会返回原记录，不会创建新数据（code=0001）。

### 添加动作

```bash
POST /api/evidence/action
Content-Type: application/json

{
  "requestId": "REQ-UNIQUE-001",
  "actionType": "EXTERNAL_CALL",
  "actionName": "调用第三方支付",
  "actionDetail": "调用支付宝接口",
  "externalRefNo": "PAY-20240514-001",
  "receiptData": "{\"code\":\"10000\",\"msg\":\"Success\"}",
  "operator": "system"
}
```

动作类型：`INBOUND_REQUEST`、`INTERNAL_TRANSFORM`、`DB_OPERATION`、`EXTERNAL_CALL`、`EXTERNAL_RECEIPT`、`ERROR_HANDLING`、`MANUAL_REMARK`

### 更新状态

```bash
POST /api/evidence/status
Content-Type: application/json

{
  "requestId": "REQ-UNIQUE-001",
  "targetStatus": "SUCCESS",
  "responseBody": "{\"code\":\"0000\",\"message\":\"成功\"}",
  "errorMessage": null,
  "operator": "system"
}
```

状态流转规则：
- `CREATED` → `PROCESSING` → `SUCCESS`/`FAILED`
- `SUCCESS` 只能转为 `MANUAL_HANDLED`
- `MANUAL_HANDLED` 为终态，不可变更

### 添加人工备注

```bash
POST /api/evidence/remark
Content-Type: application/json

{
  "requestId": "REQ-UNIQUE-001",
  "remarkContent": "客户反馈支付失败，已引导重新支付",
  "operator": "support-001"
}
```

### 查询接口

```bash
# 按 requestId 查询
GET /api/evidence/REQ-TEST-001

# 按业务单号查询所有关联证据链
GET /api/evidence/business/ORD-2024-0514-001

# 条件查询
GET /api/evidence/query?businessNo=ORD&status=FAILED&sourceSystem=ORDER-SYSTEM

# 导出摘要
GET /api/evidence/summary/REQ-TEST-001

# 验证是否存在
GET /api/evidence/validate/REQ-TEST-001
```

## 统一返回格式

```json
{
  "code": "0000",
  "message": "成功",
  "data": {...},
  "timestamp": "2024-05-14T10:30:00",
  "requestId": "REQ-XXX"
}
```

响应码说明：
- `0000`: 成功
- `0001`: 幂等返回（重复请求）
- `E0001`: 证据链不存在
- `E0002`: 重复请求
- `E0003`: 状态流转非法
- `E0004`: 参数校验失败
- `E9999`: 系统异常

## 如何造数据

使用 curl 命令创建新证据链：

```bash
curl -X POST http://localhost:8080/api/evidence/create \
  -H "Content-Type: application/json" \
  -d '{
    "businessNo": "MY-ORDER-001",
    "requestId": "MY-REQ-'$(date +%Y%m%d%H%M%S)'",
    "sourceSystem": "TEST-SYSTEM",
    "targetSystem": "EXTERNAL-SYSTEM",
    "apiName": "testApi",
    "requestBody": "{\"test\":\"data\"}",
    "operator": "tester"
  }'
```

## 如何触发异常

### 1. 查询不存在的记录

```bash
curl http://localhost:8080/api/evidence/NOT-EXIST
# 返回: {"code":"E0001","message":"证据链不存在",...}
```

### 2. 非法状态流转

```bash
# 先将 REQ-TEST-001 转为 SUCCESS（已预置）
# 再尝试从 SUCCESS 转为 FAILED
curl -X POST http://localhost:8080/api/evidence/status \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-TEST-001",
    "targetStatus": "FAILED",
    "operator": "test"
  }'
# 返回: {"code":"E0003","message":"成功状态下仅能转为人工处理",...}
```

### 3. 参数校验失败

```bash
curl -X POST http://localhost:8080/api/evidence/create \
  -H "Content-Type: application/json" \
  -d '{}'
# 返回: {"code":"E0004","message":"业务单号不能为空, 请求ID不能为空",...}
```

## 如何查看处理记录

### 方式一：Swagger UI

访问 http://localhost:8080/api/swagger-ui.html，在浏览器中直接测试接口。

### 方式二：H2 控制台

访问 http://localhost:8080/api/h2-console，登录后执行 SQL：

```sql
-- 查询所有证据链
SELECT * FROM EVIDENCE_CHAIN;

-- 查询动作记录
SELECT * FROM EVIDENCE_ACTION ORDER BY EVIDENCE_CHAIN_ID, ID;

-- 查询备注记录
SELECT * FROM EVIDENCE_REMARK;
```

### 方式三：导出摘要接口

```bash
curl http://localhost:8080/api/evidence/summary/REQ-TEST-003
```

返回格式化的完整处理流程摘要。

## 核心设计特点

1. **幂等性保证**：基于 requestId 做幂等，重复提交不会产生脏数据
2. **完整溯源**：从入口请求、内部处理、外部回执、人工备注完整记录
3. **状态机约束**：严格的状态流转校验，防止非法状态变更
4. **统一异常处理**：标准化的错误码和错误信息
5. **一键导出**：支持导出人类可读的处理流程摘要

## 项目结构

```
src/main/java/com/evidence/
├── EvidenceChainTrackerApplication.java  # 启动类
├── config/
│   ├── DataInitializer.java              # 测试数据初始化
│   └── SwaggerConfig.java                # Swagger 配置
├── controller/
│   └── EvidenceChainController.java      # API 接口
├── dto/
│   ├── ApiResponse.java                  # 统一响应
│   ├── CreateEvidenceRequest.java
│   ├── AddActionRequest.java
│   ├── AddRemarkRequest.java
│   └── StatusUpdateRequest.java
├── entity/
│   ├── EvidenceChain.java                # 证据链主表
│   ├── EvidenceAction.java               # 动作记录表
│   └── EvidenceRemark.java               # 备注记录表
├── enums/
│   ├── EvidenceStatus.java               # 状态枚举
│   └── ActionType.java                   # 动作类型枚举
├── exception/
│   ├── BusinessException.java            # 业务异常
│   └── GlobalExceptionHandler.java       # 全局异常处理
├── repository/
│   └── EvidenceChainRepository.java      # DAO
└── service/
    └── EvidenceChainService.java         # 业务逻辑
```
