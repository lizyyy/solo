# 发版回滚决策 API - Curl 示例

## 基础信息
- Base URL: http://localhost:3000
- API 版本: v1

---

## 场景 1: 健康发布流程

### 1.1 创建发布批次
```bash
# 创建一个新的发布批次
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.1.0",
    "description": "新功能发布 - 用户中心升级",
    "createdBy": "developer-zhang"
  }'
```

**响应示例:**
```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "2.1.0",
  "description": "新功能发布 - 用户中心升级",
  "status": "CREATED",
  "grayscaleStage": 0,
  "maxGrayscaleStage": 100,
  "createdBy": "developer-zhang",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 1.2 配置阈值
```bash
# 配置错误率阈值
curl -X POST http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "error_rate": {
        "type": "upper",
        "value": 5.0,
        "description": "错误率阈值 5%"
      },
      "response_time_p99": {
        "type": "upper",
        "value": 500.0,
        "description": "P99响应时间阈值 500ms"
      },
      "success_rate": {
        "type": "lower",
        "value": 95.0,
        "description": "成功率阈值 95%"
      }
    }
  }'
```

### 1.3 上报健康指标
```bash
# 上报第一批健康指标
curl -X POST http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "error_rate": 0.5,
      "response_time_p99": 120.5,
      "success_rate": 99.2
    },
    "timestamp": "2024-01-15T10:35:00.000Z"
  }'
```

**响应 - 健康状态:**
```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "recorded": true,
  "recommendation": {
    "status": "CREATED",
    "recommendation": "指标健康，可继续推进",
    "thresholdHits": [],
    "nextAction": "promote_or_complete"
  }
}
```

### 1.4 推进灰度
```bash
# 推进到 20% 灰度
curl -X POST http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/promote \
  -H "Content-Type: application/json" \
  -d '{
    "stage": 20,
    "operator": "release-manager"
  }'
```

### 1.5 继续推进到全量
```bash
# 再次上报指标（仍健康）
curl -X POST http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "error_rate": 0.8,
      "response_time_p99": 150.2,
      "success_rate": 98.8
    }
  }'

# 推进到 100%（全量发布）
curl -X POST http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000/promote \
  -H "Content-Type: application/json" \
  -d '{
    "stage": 100,
    "operator": "release-manager"
  }'
```

---

## 场景 2: 关键指标缺失 - 暂停推进

### 2.1 创建批次
```bash
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.2.0",
    "description": "支付模块重构",
    "createdBy": "developer-li"
  }'
```

### 2.2 配置阈值
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "payment_success_rate": {
        "type": "lower",
        "value": 99.0
      },
      "payment_error_rate": {
        "type": "upper",
        "value": 1.0
      }
    }
  }'
```

### 2.3 上报缺失关键指标的数据
```bash
# 只上报了部分指标，缺少 payment_error_rate
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "payment_success_rate": 99.5
    }
  }'
```

**响应 - 指标缺失:**
```json
{
  "batchId": "<batch-id>",
  "recorded": true,
  "recommendation": {
    "status": "CREATED",
    "recommendation": "关键指标缺失，暂停推进",
    "missingMetrics": ["payment_error_rate"],
    "thresholdHits": [],
    "nextAction": "provide_metrics_or_confirm"
  }
}
```

### 2.4 尝试推进（会被拒绝）
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/promote \
  -H "Content-Type: application/json" \
  -d '{}'
```

**响应 - 拒绝推进:**
```json
{
  "error": "关键指标缺失，暂停推进",
  "missingMetrics": ["payment_error_rate"],
  "recommendation": {
    "status": "CREATED",
    "recommendation": "关键指标缺失，暂停推进",
    "missingMetrics": ["payment_error_rate"],
    "thresholdHits": [],
    "nextAction": "provide_metrics_or_confirm"
  }
}
```

---

## 场景 3: 错误率超阈值 - 自动建议回滚

### 3.1 创建批次并配置阈值
```bash
# 创建批次
curl -X POST http://localhost:3000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.3.0-beta",
    "description": "高风险功能试验",
    "createdBy": "developer-wang"
  }'

# 配置严格阈值
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "thresholds": {
      "error_rate": {
        "type": "upper",
        "value": 2.0
      }
    }
  }'
```

### 3.2 上报超阈值指标
```bash
# 错误率 8.5% 远超阈值 2.0%
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "error_rate": 8.5
    }
  }'
```

**响应 - 阈值命中:**
```json
{
  "batchId": "<batch-id>",
  "recorded": true,
  "recommendation": {
    "status": "CREATED",
    "recommendation": "阈值命中，建议回滚",
    "thresholdHits": [
      {
        "metricName": "error_rate",
        "value": 8.5,
        "threshold": 2.0,
        "type": "upper",
        "hit": true
      }
    ],
    "nextAction": "rollback_or_confirm"
  }
}
```

### 3.3 尝试推进（会被拒绝）
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/promote \
  -H "Content-Type: application/json" \
  -d '{}'
```

**响应:**
```json
{
  "error": "阈值命中，需先回滚或人工确认",
  "thresholdHits": [
    {
      "metricName": "error_rate",
      "value": 8.5,
      "threshold": 2.0,
      "type": "upper",
      "hit": true
    }
  ],
  "recommendation": {...}
}
```

### 3.4 触发回滚
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "错误率超过阈值 4 倍，紧急回滚",
    "operator": "on-call-engineer"
  }'
```

**响应:**
```json
{
  "batchId": "<batch-id>",
  "status": "ROLLED_BACK",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

### 3.5 已回滚批次不能再发布
```bash
# 尝试再次推进已回滚的批次
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/promote \
  -H "Content-Type: application/json" \
  -d '{}'
```

**响应:**
```json
{
  "error": "已回滚批次不能再发布",
  "batchId": "<batch-id>",
  "currentStatus": "ROLLED_BACK"
}
```

---

## 场景 4: 人工确认继续（忽略阈值）

### 4.1 阈值命中后人工确认
```bash
# 假设阈值已命中（如场景3）

# 人工确认继续发布（业务需要紧急发布）
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "action": "continue",
    "reason": "已知问题，业务影响可控，经CTO批准继续发布",
    "operator": "cto"
  }'
```

**响应:**
```json
{
  "batchId": "<batch-id>",
  "status": "IN_PROGRESS",
  "action": "continue",
  "updatedAt": "2024-01-15T11:30:00.000Z"
}
```

### 4.2 人工确认暂停
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pause",
    "reason": "需要进一步调查，先暂停发布",
    "operator": "tech-lead"
  }'
```

### 4.3 人工确认回滚
```bash
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "action": "rollback",
    "reason": "影响较大，决定回滚",
    "operator": "vp-engineering"
  }'
```

---

## 场景 5: 幂等性验证

### 5.1 重复触发回滚
```bash
# 第一次回滚
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/rollback \
  -H "Content-Type: application/json" \
  -d '{}'

# 第二次回滚（幂等处理）
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/rollback \
  -H "Content-Type: application/json" \
  -d '{}'
```

**第二次响应:**
```json
{
  "message": "批次已回滚，幂等处理",
  "batchId": "<batch-id>",
  "currentStatus": "ROLLED_BACK"
}
```

### 5.2 重复推进到相同阶段
```bash
# 第一次推进到 40%
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/promote \
  -H "Content-Type: application/json" \
  -d '{"stage": 40}'

# 第二次推进到 40%（幂等处理）
curl -X POST http://localhost:3000/api/v1/batches/<batch-id>/promote \
  -H "Content-Type: application/json" \
  -d '{"stage": 40}'
```

**第二次响应:**
```json
{
  "message": "已到达目标阶段，幂等处理",
  "batchId": "<batch-id>",
  "currentStatus": "IN_PROGRESS",
  "grayscaleStage": 40
}
```

---

## 查询接口示例

### 查询单批次详情（包含时间线、建议、审计日志）
```bash
curl -X GET http://localhost:3000/api/v1/batches/550e8400-e29b-41d4-a716-446655440000
```

**响应示例（已回滚的批次）:**
```json
{
  "batch": {
    "batchId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "2.3.0-beta",
    "status": "ROLLED_BACK",
    "grayscaleStage": 0,
    "createdBy": "developer-wang",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  },
  "thresholds": {
    "error_rate": { "type": "upper", "value": 2.0 }
  },
  "latestMetrics": {
    "metrics": { "error_rate": 8.5 },
    "timestamp": "2024-01-15T10:50:00.000Z"
  },
  "recommendation": {
    "status": "ROLLED_BACK",
    "recommendation": "批次已回滚，无法继续发布",
    "thresholdHits": [],
    "nextAction": "no_action"
  },
  "thresholdHits": [
    {
      "timestamp": "2024-01-15T10:50:00.000Z",
      "data": {
        "thresholdHits": [
          { "metricName": "error_rate", "value": 8.5, "threshold": 2.0 }
        ],
        "recommendation": "阈值命中，建议回滚"
      }
    }
  ],
  "auditLog": [
    {
      "eventId": "event-1",
      "eventType": "BATCH_CREATED",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "operator": "system",
      "data": { "batch": {...} }
    },
    {
      "eventId": "event-2",
      "eventType": "THRESHOLD_CONFIGURED",
      "timestamp": "2024-01-15T10:35:00.000Z",
      "operator": "system",
      "data": { "thresholds": {...} }
    },
    {
      "eventId": "event-3",
      "eventType": "METRICS_REPORTED",
      "timestamp": "2024-01-15T10:50:00.000Z",
      "operator": "system",
      "data": { "metrics": { "error_rate": 8.5 }, "recommendation": {...} }
    },
    {
      "eventId": "event-4",
      "eventType": "THRESHOLD_HIT",
      "timestamp": "2024-01-15T10:50:00.000Z",
      "operator": "system",
      "data": { "thresholdHits": [...], "recommendation": "阈值命中，建议回滚" }
    },
    {
      "eventId": "event-5",
      "eventType": "ROLLBACK_TRIGGERED",
      "timestamp": "2024-01-15T11:00:00.000Z",
      "operator": "on-call-engineer",
      "data": { "reason": "错误率超过阈值 4 倍，紧急回滚" }
    }
  ],
  "timeline": [
    {
      "eventId": "event-1",
      "eventType": "BATCH_CREATED",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "operator": "system",
      "summary": "批次创建: v2.3.0-beta"
    },
    {
      "eventId": "event-2",
      "eventType": "THRESHOLD_CONFIGURED",
      "timestamp": "2024-01-15T10:35:00.000Z",
      "operator": "system",
      "summary": "配置阈值: 1 个指标"
    },
    {
      "eventId": "event-3",
      "eventType": "METRICS_REPORTED",
      "timestamp": "2024-01-15T10:50:00.000Z",
      "operator": "system",
      "summary": "上报指标: error_rate"
    },
    {
      "eventId": "event-4",
      "eventType": "THRESHOLD_HIT",
      "timestamp": "2024-01-15T10:50:00.000Z",
      "operator": "system",
      "summary": "阈值命中: error_rate"
    },
    {
      "eventId": "event-5",
      "eventType": "ROLLBACK_TRIGGERED",
      "timestamp": "2024-01-15T11:00:00.000Z",
      "operator": "on-call-engineer",
      "summary": "触发回滚: 错误率超过阈值 4 倍，紧急回滚"
    }
  ]
}
```

### 查询所有批次列表
```bash
curl -X GET http://localhost:3000/api/v1/batches
```

**响应:**
```json
{
  "total": 3,
  "batches": [
    { "batchId": "...", "version": "2.1.0", "status": "COMPLETED", ... },
    { "batchId": "...", "version": "2.2.0", "status": "IN_PROGRESS", ... },
    { "batchId": "...", "version": "2.3.0-beta", "status": "ROLLED_BACK", ... }
  ]
}
```

---

## 状态流转说明

```
CREATED (创建)
    │
    ├─── 上报指标 + 配置阈值 ──┐
    │                         │
    └─────────────────────────┘
              │
              ▼
    IN_PROGRESS (发布中)
         /    \
        /      \
       ▼        ▼
   PAUSED    COMPLETED (完成)
   (暂停)     (全量发布)
      │
      │ (人工确认继续/回滚)
      ▼
   ROLLED_BACK (已回滚)  ←── 终态，不能再发布
```

## 决策矩阵

| 情况 | 推荐动作 | 可执行操作 |
|------|----------|------------|
| 指标健康 | 继续推进 | promote / complete |
| 关键指标缺失 | 暂停推进 | provide_metrics / confirm(continue) |
| 阈值命中 | 建议回滚 | rollback / confirm(continue) |
| 已回滚 | 无动作 | 无 |
| 已完成 | 无动作 | 无 |
