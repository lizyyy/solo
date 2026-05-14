# 特征开关命中审计 API

## 项目简介
这是一个基于 Spring Boot 3.x 的特征开关命中审计后端服务，用于管理 AB 测试实验、用户属性匹配、分桶计算、覆盖规则处理以及审计记录的完整生命周期管理。

## 技术栈
- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (内存数据库)
- Lombok
- Jackson
- Guava

## 核心功能
1. **实验管理**: 配置特征开关实验，包括流量分配、分桶设置、命中规则
2. **规则引擎**: 支持多种匹配规则（等于、包含、大于、小于、IN、正则等）
3. **分桶计算**: 基于 MD5 哈希的稳定分桶算法
4. **覆盖处理**: 支持 QA 测试、管理员强制、白名单等多种覆盖方式
5. **审计记录**: 完整记录每次请求的命中结果、状态、错误信息
6. **状态管理**: PENDING/SUCCESS/FAILED/COMPENSATED/EXPORTED 状态流转
7. **补偿机制**: 失败记录人工补偿处理
8. **数据导出**: 支持 CSV 格式导出审计记录
9. **幂等性**: 基于 requestId 防止重复提交

## 快速启动

### 环境要求
- JDK 17+
- Maven 3.8+

### 启动方式
```bash
# 进入项目目录
cd feature-flag-audit

# 编译项目
mvn clean package

# 运行项目
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080

### H2 控制台
访问地址: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:featureflagdb`
- 用户名: `sa`
- 密码: (空)

## 关键接口

### 1. 评估特征开关
```bash
POST /api/v1/feature-flag/evaluate
Content-Type: application/json

{
  "requestId": "req_1001",
  "experimentKey": "button_color_test",
  "userIdentifier": "user_12345",
  "userAttributes": {
    "userId": "user_12345",
    "deviceId": "device_67890",
    "sessionId": "session_abcde",
    "country": "CN",
    "region": "Beijing",
    "city": "Beijing",
    "os": "iOS",
    "appVersion": "2.1.0",
    "userSegment": "new",
    "age": 25,
    "gender": "male",
    "customAttributes": {
      "memberLevel": "gold"
    }
  }
}
```

### 2. 查询审计记录列表
```bash
GET /api/v1/feature-flag/audit?experimentKey=button_color_test&page=0&size=20
```

### 3. 查询失败记录
```bash
GET /api/v1/feature-flag/audit/failed
```

### 4. 人工补偿审计记录
```bash
POST /api/v1/feature-flag/audit/{id}/compensate?compensatedBy=admin
```

### 5. 导出审计记录
```bash
GET /api/v1/feature-flag/audit/export?experimentKey=button_color_test
```

### 6. 查询用户最近命中记录
```bash
GET /api/v1/feature-flag/audit/recent?experimentKey=button_color_test&userIdentifier=user_12345&limit=10
```

## 被拦截的路径示例

以下是会触发规则匹配和分桶计算的业务路径，所有这些请求都会被审计记录：

```
/api/v1/feature-flag/evaluate          # 特征开关评估入口
/api/v1/experiment/{key}/variants       # 获取实验变体
/api/v1/user/{id}/features              # 获取用户特征配置
/button/color                           # 按钮颜色获取（业务路径）
/homepage/banner                        # 首页横幅实验
/checkout/button_style                  # 结账页按钮样式
/search/result_sort                     # 搜索结果排序实验
/recommendation/algorithm               # 推荐算法实验
/onboarding/flow_variant                # 新手引导流程变体
```

## 测试数据说明

项目启动时会自动初始化以下测试数据：

### 实验配置
- **实验 Key**: `button_color_test`
- **实验名称**: 按钮颜色 AB 测试
- **流量分配**: 100%
- **分桶配置**: 对照组(control)红色 #FF0000, 变体(variant)绿色 #00FF00，各 50%
- **命中规则**: 中国地区用户 + new/premium 用户组

### 预置审计记录
1. **正常命中**: req_001_normal - 成功命中对照组
2. **覆盖命中**: req_002_override - QA 用户被强制命中
3. **失败记录**: req_003_failed - 模拟数据库超时
4. **未命中规则**: req_004_miss - 用户属性不匹配
5. **不在流量中**: req_005_not_in_traffic - 流量外用户
6. **已补偿**: req_006_compensated - 人工补偿处理
7. **已导出**: req_007_exported - 已导出记录

## 数据模型

### Experiment (实验)
- experimentKey: 实验唯一标识
- name: 实验名称
- description: 描述
- enabled: 是否启用
- trafficPercentage: 流量百分比(0-100)
- salt: 分桶盐值
- status: 实验状态(DRAFT/RUNNING/PAUSED/COMPLETED/ARCHIVED)
- rules: 命中规则列表
- buckets: 分桶配置列表
- overrides: 覆盖规则列表

### HitRule (命中规则)
- attributeName: 属性名称
- operator: 操作符(EQUALS, CONTAINS, GREATER_THAN, IN, REGEX 等)
- attributeValue: 属性值
- priority: 优先级

### BucketValue (分桶值)
- bucketKey: 分桶标识
- value: 分桶返回值
- weight: 权重

### OverrideReason (覆盖原因)
- userIdentifier: 用户标识
- forcedBucketKey: 强制分桶
- reason: 原因说明
- overrideType: 覆盖类型(WHITELIST, BLACKLIST, FORCE_BUCKET, QA_TESTING, ADMIN_OVERRIDE)

### AuditRecord (审计记录)
- requestId: 请求唯一 ID（幂等键）
- experimentKey: 实验 Key
- userIdentifier: 用户标识
- userAttributes: 用户属性 JSON
- matchedRules: 匹配到的规则
- bucketKey: 命中分桶
- bucketValue: 分桶值
- overrideReason: 覆盖原因
- overrideType: 覆盖类型
- hitResult: 命中结果(HIT, MISS, OVERRIDDEN, ERROR, NOT_IN_TRAFFIC)
- status: 状态(PENDING, SUCCESS, FAILED, COMPENSATED, EXPORTED)
- errorMessage: 错误信息
- retryCount: 重试次数
- compensatedAt: 补偿时间
- compensatedBy: 补偿人

## 异常处理

系统会返回统一的错误响应格式：

```json
{
  "status": 409,
  "code": "DUPLICATE_REQUEST",
  "message": "重复请求: req_1001",
  "timestamp": "2024-01-15T10:30:00",
  "details": null
}
```

### 常见错误码
- `DUPLICATE_REQUEST`: 重复请求（409）
- `EXPERIMENT_NOT_FOUND`: 实验不存在（404）
- `VALIDATION_ERROR`: 参数验证失败（400）
- `INTERNAL_ERROR`: 系统内部错误（500）

## 命令行测试示例

使用 curl 进行测试：

```bash
# 正常请求 - 应该命中分桶
curl -X POST http://localhost:8080/api/v1/feature-flag/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "test_user_001",
    "userAttributes": {
      "userId": "test_user_001",
      "country": "CN",
      "userSegment": "new"
    }
  }'

# 重复请求 - 应该被拦截返回 409
curl -X POST http://localhost:8080/api/v1/feature-flag/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "test_user_001",
    "userAttributes": {}
  }'

# 覆盖用户 - QA 测试账号，强制命中对照组
curl -X POST http://localhost:8080/api/v1/feature-flag/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_002",
    "experimentKey": "button_color_test",
    "userIdentifier": "qa_user_001",
    "userAttributes": {}
  }'
```
