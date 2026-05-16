# Schema灰度发布API - 使用示例

## 启动服务

```bash
npm run dev
# 服务运行在 http://localhost:3000
```

## API端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/canaries | 创建灰度发布 |
| GET | /api/v1/canaries | 查询灰度发布列表 |
| GET | /api/v1/canaries/:id | 查询单个灰度发布详情 |
| POST | /api/v1/canaries/:id/transitions | 状态转换推进 |
| POST | /api/v1/canaries/:id/correct | 人工修正 |
| POST | /api/v1/canaries/:id/compatibility | 兼容校验 |
| GET | /api/v1/canaries/:id/export | 确认导出 |
| GET | /api/v1/meta/statuses | 状态元数据 |

---

## 1. 创建灰度发布

```bash
curl -X POST http://localhost:3000/api/v1/canaries \
  -H "Content-Type: application/json" \
  -d '{
    "schemaName": "user_profile",
    "schemaVersion": "v2.0.0",
    "schemaContent": "{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"name\":{\"type\":\"string\"},\"email\":{\"type\":\"string\"}}}",
    "consumerIds": ["consumer-a", "consumer-b", "consumer-c"],
    "canaryRatio": 10,
    "createdBy": "admin@example.com"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "schemaName": "user_profile",
    "schemaVersion": "v2.0.0",
    "status": "pending",
    "canaryRatio": 10,
    "consumers": [...],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 2. 查询灰度发布列表

```bash
# 查询全部
curl http://localhost:3000/api/v1/canaries

# 按Schema名称过滤
curl "http://localhost:3000/api/v1/canaries?schemaName=user_profile"

# 按状态过滤
curl "http://localhost:3000/api/v1/canaries?status=pending"

# 按消费方过滤
curl "http://localhost:3000/api/v1/canaries?consumerId=consumer-a"
```

---

## 3. 状态转换推进

### 确认发布 (pending -> confirmed)
```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/transitions \
  -H "Content-Type: application/json" \
  -d '{
    "transitionType": "confirm",
    "reason": "所有消费方验证通过",
    "operatedBy": "admin@example.com",
    "consumerId": "consumer-a"
  }'
```

### 拦截发布 (pending -> blocked)
```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/transitions \
  -H "Content-Type: application/json" \
  -d '{
    "transitionType": "block",
    "reason": "发现字段兼容性问题",
    "operatedBy": "admin@example.com"
  }'
```

### 撤回发布 (confirmed/blocked -> revoked)
```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/transitions \
  -H "Content-Type: application/json" \
  -d '{
    "transitionType": "revoke",
    "reason": "新字段导致生产问题，紧急撤回",
    "operatedBy": "oncall@example.com"
  }'
```

### 补偿处理 (confirmed -> compensated)
```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/transitions \
  -H "Content-Type: application/json" \
  -d '{
    "transitionType": "compensate",
    "reason": "已修复问题并补偿受影响数据",
    "operatedBy": "admin@example.com"
  }'
```

---

## 4. 人工修正

```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending",
    "canaryRatio": 5,
    "correctedBy": "admin@example.com",
    "correctionReason": "灰度比例过高，调低后重试"
  }'
```

---

## 5. 兼容校验

```bash
curl -X POST http://localhost:3000/api/v1/canaries/{id}/compatibility \
  -H "Content-Type: application/json" \
  -d '{
    "previousSchema": "{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"name\":{\"type\":\"string\"}}}"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "isCompatible": true,
    "breakingCount": 0,
    "warningCount": 1,
    "issues": [
      {
        "type": "warning",
        "field": "email",
        "message": "新增字段 \"email\""
      }
    ]
  }
}
```

---

## 6. 确认导出

```bash
curl http://localhost:3000/api/v1/canaries/{id}/export
```

导出内容包含：
- 基本信息（Schema名称、版本、灰度比例）
- 消费方确认状态
- 状态变更历史
- 撤回记录
- 兼容校验结果

---

## 7. 状态机说明

### 状态定义
- **pending**: 待处理 - 初始状态，等待确认
- **confirmed**: 已确认 - 验证通过正式发布
- **blocked**: 被拦截 - 发现问题，暂停发布
- **revoked**: 已撤销 - 最终撤回，不可再变更
- **compensated**: 已补偿 - 问题已修复并补偿

### 允许的转换
```
pending  ──> confirmed, blocked, revoked
confirmed ──> revoked, compensated
blocked  ──> revoked, pending, confirmed
revoked  ──> (终止状态)
compensated ──> (终止状态)
```

### 失败记录
所有失败操作都会保留：
- 失败步骤
- 原始输入
- 处理依据
- 最终结论
- 错误详情
- 失败时间