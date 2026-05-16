# 包发布撤回仲裁API系统

## 技术栈
- Spring Boot 2.7.18
- Spring Data JPA
- H2 文件数据库
- Lombok

## 核心功能
1. **包版本管理** - 创建、查询、状态变更
2. **撤回申请流程** - 提交、幂等处理、自动/人工仲裁
3. **状态机流转** - PUBLISHED -> WITHDRAW_REQUESTED -> WITHDRAW_PENDING_REVIEW -> 最终状态
4. **依赖影响分析** - 自动计算影响项目和风险等级
5. **异常路径追踪** - 保留原始输入和处理结论
6. **数据导出** - CSV格式导出所有记录

## 统一响应格式
```json
{
  "status": "SUCCESS|PENDING_REVIEW|BLOCKED|COMPENSATED|FAILED",
  "message": "操作描述",
  "data": {...},
  "timestamp": "2025-05-16T10:00:00"
}
```

---

## 一、包版本管理接口

### 1.1 创建包版本
```bash
POST /api/packages
Content-Type: application/json

{
  "packageName": "com.example:order-service",
  "version": "1.0.0",
  "publisher": "zhang.san",
  "description": "订单服务核心库",
  "dependencyProjects": ["payment-service", "user-service", "gateway-service"],
  "rawInput": "原始请求数据..."
}
```

**响应示例（成功）：**
```json
{
  "status": "SUCCESS",
  "message": "包创建成功",
  "data": {
    "id": 1,
    "packageName": "com.example:order-service",
    "version": "1.0.0",
    "status": "PUBLISHED"
  }
}
```

### 1.2 查询所有包
```bash
GET /api/packages
```

### 1.3 查询指定包
```bash
GET /api/packages/{packageName}/{version}
```

### 1.4 按状态查询
```bash
GET /api/packages/status/PUBLISHED
```

### 1.5 更新包状态
```bash
PUT /api/packages/{id}/status?status=WITHDRAW_REQUESTED&reason=测试原因&operator=admin
```

### 1.6 人工修正（绕过状态机）
```bash
PUT /api/packages/{id}/manual-fix?status=PUBLISHED&reason=紧急回滚&operator=duty.officer
```

### 1.7 导出包列表CSV
```bash
GET /api/packages/export/csv
```

---

## 二、撤回仲裁接口

### 2.1 提交撤回申请
```bash
POST /api/withdraw/request
Content-Type: application/json

{
  "packageName": "com.example:framework-core",
  "version": "3.0.0",
  "requester": "li.si",
  "reason": "发现严重安全漏洞，需要紧急撤回",
  "requestId": "WD-20250516-001",
  "rawInput": "来自Slack的撤回请求..."
}
```

**响应说明：**
- `SUCCESS` - 申请成功，等待仲裁
- `PENDING_REVIEW` - 检测到高影响依赖，需人工复核

**响应示例（待复核）：**
```json
{
  "status": "PENDING_REVIEW",
  "message": "待人工复核",
  "data": {
    "requestId": "WD-20250516-001",
    "processingConclusion": "检测到高影响依赖，需人工复核"
  }
}
```

### 2.2 人工仲裁
```bash
POST /api/withdraw/arbitrate
Content-Type: application/json

{
  "requestId": "WD-20250516-001",
  "arbitrator": "duty.manager",
  "result": "APPROVED",
  "comment": "确认为高危漏洞，同意撤回",
  "rawInput": "值班经理审批记录..."
}
```

**仲裁结果枚举：**
- `PENDING` - 待仲裁
- `APPROVED` - 同意撤回
- `REJECTED` - 拒绝撤回
- `NEEDS_MORE_INFO` - 需补充信息

**响应示例（被拦截）：**
```json
{
  "status": "BLOCKED",
  "message": "撤回被拦截/拒绝",
  "data": {
    "arbitrationResult": "REJECTED"
  }
}
```

### 2.3 补偿操作
```bash
POST /api/withdraw/{requestId}/compensate?operator=duty.officer&reason=已发布补丁版本替代
```

### 2.4 查询撤回申请
```bash
GET /api/withdraw/{requestId}
GET /api/withdraw
GET /api/withdraw/pending
```

### 2.5 查看影响报告
```bash
GET /api/withdraw/{requestId}/impact-reports
```

### 2.6 导出撤回请求CSV
```bash
GET /api/withdraw/export/csv
GET /api/withdraw/{requestId}/export/csv
```

---

## 三、操作日志接口

### 3.1 查询所有日志
```bash
GET /api/logs
```

### 3.2 按资源查询日志
```bash
GET /api/logs/resource/com.example:order-service:1.0.0
```

### 3.3 查询失败操作日志
```bash
GET /api/logs/failed
```

---

## 四、影响分析接口

```bash
GET /api/packages/{packageName}/{version}/impact
```

**响应示例：**
```json
{
  "status": "SUCCESS",
  "data": {
    "packageName": "com.example:framework-core",
    "version": "3.0.0",
    "currentStatus": "PUBLISHED",
    "dependencyCount": 3,
    "withdrawRequestCount": 1,
    "dependencies": [
      "order-service (未知)",
      "payment-service (未知)",
      "user-service (未知)"
    ]
  }
}
```

---

## 五、H2数据库控制台

**访问地址：** `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:file:./data/arbitration-db`
- 用户名: `sa`
- 密码: (空)

---

## 六、状态流转规则

```
PUBLISHED (已发布)
    ↓
WITHDRAW_REQUESTED (撤回申请中)
    ↓
WITHDRAW_PENDING_REVIEW (待复核)
    ↓         ↓          ↓
WITHDRAW_APPROVED  WITHDRAW_REJECTED  WITHDRAW_BLOCKED
    ↓
WITHDRAW_COMPENSATED (已补偿)
```

## 七、影响级别说明

| 级别 | 含义 | 自动处理 |
|------|------|----------|
| 1 | 低影响 | 可自动通过 |
| 2 | 中影响 | 需人工确认 |
| 3-5 | 高影响 | 强制人工复核 |

影响级别计算因子：
- 核心框架/支付类项目 +2级
- 项目负责人未知 +1级
- 依赖数>=3 高影响

## 八、启动项目

使用Maven包装器：
```bash
./mvnw spring-boot:run
```

或安装Maven后：
```bash
mvn spring-boot:run
```

项目启动后会自动初始化4个样例包数据。
