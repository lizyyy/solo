# 连接器限速休眠API

用于解决三方连接器被限流后重试脚本越跑越乱的问题，提供统一的休眠和恢复记录管理。

## 技术栈

- Java 17
- Spring Boot 3.2
- H2 Database (本地持久化)
- Lombok

## 快速启动

### 1. 编译项目

```bash
mvn clean package -DskipTests
```

### 2. 启动应用

```bash
mvn spring-boot:run
```

或

```bash
java -jar target/rate-limit-sleep-api-1.0.0.jar
```

应用默认启动在 `http://localhost:8080`

### 3. 访问H2控制台（可选）

- 地址: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:file:./data/rate-limit-db`
- 用户名: `sa`
- 密码: (空)

## 数据模型说明

| 实体 | 说明 | 核心字段 |
|------|------|----------|
| Connector | 连接器 | connectorCode, status, currentSleepLevel, expectedWakeTime |
| SupplierAccount | 供应商账号 | supplierCode, apiKey, dailyLimit, qpsLimit |
| RateLimitWindow | 限速窗口 | limitType, limitValue, currentValue, windowStart/End |
| SleepStrategy | 休眠策略 | sleepLevel, sleepDurationSeconds, backoffType |
| RecoveryEvent | 恢复事件 | eventId, fromStatus, toStatus, triggerSource, idempotentKey |
| RunSummary | 运行摘要 | summaryDate, totalRequests, successCount, failureCount |
| ExceptionRecord | 异常记录 | rawInput, failureReason, errorMessage, processingConclusion |

## 状态机说明

```
ACTIVE (活跃)
    ↓ 触发限流
SLEEPING (休眠中)
    ↓ 休眠时间到
RECOVERING (恢复中)
    ↓ 恢复成功
RECOVERED (已恢复)
    ↓ 人工干预
MANUAL_INTERVENTION (人工处理中)
```

## API接口说明

### 基础路径

`http://localhost:8080/api/v1/rate-limit-sleep`

### 1. 查询所有连接器

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/connectors"
```

### 2. 查询单个连接器

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/connectors/CONNECTOR_OSS_UPLOAD"
```

### 3. 创建连接器

```bash
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/connectors" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_PAYMENT",
    "connectorName": "支付连接器",
    "description": "用于调用第三方支付接口",
    "supplierCode": "ALIYUN"
  }'
```

### 4. 检测并触发限流休眠（核心接口）

```bash
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_OSS_UPLOAD",
    "limitType": "QPS",
    "failureReason": "RATE_LIMIT_EXCEEDED",
    "rawResponse": "{\"code\":\"429\",\"message\":\"Too Many Requests\"}",
    "requestId": "req-123456",
    "idempotentKey": "idem-789012"
  }'
```

### 5. 推进状态（从休眠到恢复）

```bash
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/connectors/CONNECTOR_OSS_UPLOAD/advance"
```

### 6. 人工修正状态

```bash
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_OSS_UPLOAD",
    "targetStatus": "ACTIVE",
    "reason": "已联系供应商解除限流",
    "operator": "admin",
    "idempotentKey": "manual-001"
  }'
```

### 7. 查询异常记录

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/exceptions?connectorCode=CONNECTOR_OSS_UPLOAD"
```

### 8. 查询恢复事件

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/recovery-events?connectorCode=CONNECTOR_OSS_UPLOAD"
```

### 9. 查询运行摘要

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/run-summaries"
```

### 10. 导出运行摘要（CSV格式）

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/run-summaries/export" -O run-summaries.csv
```

### 11. 查询休眠策略

```bash
curl -X GET "http://localhost:8080/api/v1/rate-limit-sleep/strategies"
```

### 12. 创建休眠策略

```bash
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/strategies" \
  -H "Content-Type: application/json" \
  -d '{
    "strategyCode": "CUSTOM_LEVEL_1",
    "strategyName": "自定义策略1",
    "sleepLevel": 1,
    "sleepDurationSeconds": 120,
    "backoffType": "EXPONENTIAL",
    "enabled": true
  }'
```

## 被规则拦住的路径示例（异常场景）

### 场景1: 重复触发（幂等验证）

```bash
# 第一次请求
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_SMS_SEND",
    "limitType": "DAILY_LIMIT",
    "failureReason": "RATE_LIMIT_EXCEEDED",
    "idempotentKey": "test-idem-key-001"
  }'

# 第二次请求（使用相同的idempotentKey）- 会被幂等规则拦住
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_SMS_SEND",
    "limitType": "DAILY_LIMIT",
    "failureReason": "RATE_LIMIT_EXCEEDED",
    "idempotentKey": "test-idem-key-001"
  }'
```

**预期结果**: 第二次请求会直接返回，不会重复处理。

### 场景2: 连接器已在休眠状态时重复触发

```bash
# 先触发休眠
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_OCR_RECOGNIZE",
    "limitType": "QPS",
    "failureReason": "RATE_LIMIT_EXCEEDED"
  }'

# 立即再次触发 - 会被状态规则拦住
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_OCR_RECOGNIZE",
    "limitType": "QPS",
    "failureReason": "RATE_LIMIT_EXCEEDED"
  }'
```

**预期结果**: 返回错误信息 "连接器当前处于休眠状态"。

### 场景3: 休眠时间未到就推进状态

```bash
# 先触发休眠
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorCode": "CONNECTOR_OSS_UPLOAD",
    "limitType": "QPS",
    "failureReason": "RATE_LIMIT_EXCEEDED"
  }'

# 立即推进状态 - 会被时间规则拦住
curl -X POST "http://localhost:8080/api/v1/rate-limit-sleep/connectors/CONNECTOR_OSS_UPLOAD/advance"
```

**预期结果**: 返回错误信息 "休眠时间未到，无法推进状态"。

## 核心规则说明

1. **限速识别**: 根据返回的错误码和消息自动识别限流类型
2. **休眠状态机**: 严格按照 ACTIVE → SLEEPING → RECOVERING → RECOVERED 状态流转
3. **恢复幂等**: 通过 idempotentKey 保证同一事件不会被重复处理
4. **失败归因**: 记录每次失败的原始输入、错误原因和处理结论
5. **摘要导出**: 支持按日期范围导出运行统计摘要

## 初始化样例数据

应用启动时会自动初始化以下样例数据：

### 休眠策略（5级）
- LEVEL_1: 60秒
- LEVEL_2: 300秒（5分钟）
- LEVEL_3: 900秒（15分钟）
- LEVEL_4: 1800秒（30分钟）
- LEVEL_5: 3600秒（1小时）

### 供应商账号（3个）
- SUPPLIER_ALIYUN: 阿里云
- SUPPLIER_TENCENT: 腾讯云
- SUPPLIER_HUAWEI: 华为云

### 连接器（3个）
- CONNECTOR_OSS_UPLOAD: OSS文件上传连接器
- CONNECTOR_SMS_SEND: 短信发送连接器
- CONNECTOR_OCR_RECOGNIZE: OCR识别连接器

## 项目结构

```
src/main/java/com/connector/ratelimit/
├── RateLimitSleepApplication.java    # 启动类
├── config/
│   ├── DataInitializer.java          # 数据初始化
│   └── GlobalExceptionHandler.java   # 全局异常处理
├── controller/
│   └── RateLimitSleepController.java # REST API控制器
├── model/
│   ├── dto/                          # 请求/响应DTO
│   ├── entity/                       # 数据实体
│   └── enums/                        # 枚举类型
├── repository/                       # 数据访问层
└── service/                          # 业务逻辑层
```
