# 回滚指标裁决 API

用于灰度发布期间自动判断是否需要回滚的决策服务。

## 技术栈
- Go 1.21+
- SQLite (本地持久化)
- Gorilla Mux (HTTP路由)
- GORM (ORM)

## 快速启动

### 1. 安装依赖
```bash
cd rollback-decision-api
go mod tidy
```

### 2. 启动服务
```bash
go run cmd/main.go
```
服务将在 `http://localhost:8080` 启动

### 3. 初始化样例数据（新开一个终端）
```bash
go run samples/init_sample_data.go
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/batches | 查询所有发布批次 |
| POST | /api/batches | 创建新的发布批次 |
| GET | /api/batches/{id} | 查询单个发布批次 |
| POST | /api/batches/{id}/metrics | 添加指标数据 |
| GET | /api/batches/{id}/metrics | 查询指标数据 |
| GET | /api/batches/{id}/metrics/aggregated | 查询聚合后的指标 |
| POST | /api/batches/{id}/rules | 添加阈值规则 |
| GET | /api/batches/{id}/rules | 查询阈值规则 |
| POST | /api/batches/{id}/evaluate | 执行裁决判断 |
| GET | /api/batches/{id}/decisions | 查询裁决记录 |
| POST | /api/batches/{id}/override | 人工覆写裁决 |
| GET | /api/batches/{id}/summary | 导出回滚摘要 |

## Curl 调用示例

### 1. 创建发布批次
```bash
curl -X POST http://localhost:8080/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-service",
    "version": "v3.0.0",
    "description": "用户服务灰度发布",
    "created_by": "dev@example.com"
  }'
```

### 2. 查询所有批次
```bash
curl http://localhost:8080/api/batches
```

### 3. 添加核心指标
```bash
# 替换 BATCH_ID 为实际的批次ID
curl -X POST http://localhost:8080/api/batches/BATCH_ID/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "core_metrics": [
      {
        "name": "error_rate",
        "metric_type": "ERROR_RATE",
        "value": 0.015,
        "baseline": 0.01,
        "raw_data": "{\"5xx\": 15, \"total\": 1000}"
      }
    ]
  }'
```

### 4. 添加阈值规则
```bash
curl -X POST http://localhost:8080/api/batches/BATCH_ID/rules \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "metric_name": "error_rate",
        "metric_type": "ERROR_RATE",
        "operator": "GT",
        "threshold": 0.02,
        "severity": "CRITICAL",
        "description": "错误率超过2%"
      }
    ]
  }'
```

### 5. 执行裁决判断
```bash
curl -X POST http://localhost:8080/api/batches/BATCH_ID/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "raw_input": "灰度监控第5分钟数据"
  }'
```

### 6. 人工覆写裁决
```bash
curl -X POST http://localhost:8080/api/batches/BATCH_ID/override \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reason": "经排查为下游服务抖动，当前版本无问题",
    "operator": "sre-lead@example.com"
  }'
```

### 7. 导出回滚摘要
```bash
# JSON格式
curl http://localhost:8080/api/batches/BATCH_ID/summary?exported_by=john

# 纯文本格式
curl http://localhost:8080/api/batches/BATCH_ID/summary?format=text
```

## 异常路径演示（被规则拦住的回滚）

以下演示一个完整的触发回滚的流程：

### 步骤1: 创建批次
```bash
# 保存返回的id作为 ROLLBACK_BATCH_ID
curl -X POST http://localhost:8080/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "checkout-service",
    "version": "v2.5.0",
    "description": "结账服务重大更新",
    "created_by": "dev@example.com"
  }'
```

### 步骤2: 添加异常指标（高错误率）
```bash
curl -X POST http://localhost:8080/api/batches/ROLLBACK_BATCH_ID/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "core_metrics": [
      {
        "name": "error_rate",
        "metric_type": "ERROR_RATE",
        "value": 0.085,
        "baseline": 0.01,
        "raw_data": "{\"5xx\": 85, \"4xx\": 120, \"total\": 1000}"
      },
      {
        "name": "latency_p99",
        "metric_type": "LATENCY",
        "value": 850.0,
        "baseline": 200.0,
        "raw_data": "{\"p50\": 200, \"p95\": 500, \"p99\": 850}"
      },
      {
        "name": "success_rate",
        "metric_type": "SUCCESS_RATE",
        "value": 0.915,
        "baseline": 0.99,
        "raw_data": "{\"success\": 915, \"total\": 1000}"
      }
    ],
    "auxiliary_metrics": [
      {
        "name": "cpu_usage",
        "value": 92.5,
        "description": "Pod CPU使用率"
      }
    ]
  }'
```

### 步骤3: 添加严格的阈值规则
```bash
curl -X POST http://localhost:8080/api/batches/ROLLBACK_BATCH_ID/rules \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "metric_name": "error_rate",
        "metric_type": "ERROR_RATE",
        "operator": "GT",
        "threshold": 0.02,
        "severity": "CRITICAL",
        "description": "错误率超过2% - 立即回滚"
      },
      {
        "metric_name": "latency_p99",
        "metric_type": "LATENCY",
        "operator": "GT",
        "threshold": 500.0,
        "severity": "CRITICAL",
        "description": "P99延迟超过500ms"
      },
      {
        "metric_name": "success_rate",
        "metric_type": "SUCCESS_RATE",
        "operator": "LT",
        "threshold": 0.97,
        "severity": "CRITICAL",
        "description": "成功率低于97%"
      }
    ]
  }'
```

### 步骤4: 执行裁决（触发回滚）
```bash
curl -X POST http://localhost:8080/api/batches/ROLLBACK_BATCH_ID/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "raw_input": "灰度监控第10分钟数据，用户开始投诉"
  }'
```

**预期返回结果**:
```json
{
  "id": "...",
  "batch_id": "...",
  "status": "ROLLBACK",
  "decision_type": "AUTO_ROLLBACK",
  "reason": "Violated 3 threshold rules",
  "raw_input": "灰度监控第10分钟数据，用户开始投诉",
  "conclusion": "ROLLBACK TRIGGERED: 3 rules violated",
  "violated_rules": "[...所有违反的规则...]",
  "decided_by": "SYSTEM",
  "decided_at": "..."
}
```

### 步骤5: 查看裁决记录
```bash
curl http://localhost:8080/api/batches/ROLLBACK_BATCH_ID/decisions
```

### 步骤6: 导出回滚摘要
```bash
curl "http://localhost:8080/api/batches/ROLLBACK_BATCH_ID/summary?exported_by=sre&format=text"
```

**输出示例**:
```
Release Batch Summary: checkout-service (v2.5.0)
Status: ROLLBACK
Created: ...

Core Metrics:
  - error_rate: 0.0850 (baseline: 0.0100)
  - latency_p99: 850.0000 (baseline: 200.0000)
  - success_rate: 0.9150 (baseline: 0.9900)

Decisions:
  - [...] ROLLBACK by SYSTEM: ROLLBACK TRIGGERED: 3 rules violated
```

## 数据模型说明

### 发布批次 (ReleaseBatch)
- 唯一标识、名称、版本
- 状态流转：PENDING → EVALUATING → APPROVED/ROLLBACK → MANUAL_OVERRIDE

### 核心指标 (CoreMetric)
- 错误率、延迟、吞吐量、成功率
- 包含基线值用于对比
- 保留原始数据(raw_data)用于审计

### 辅助指标 (AuxiliaryMetric)
- CPU、内存等非决定性指标
- 仅用于辅助判断

### 阈值规则 (ThresholdRule)
- 支持运算符：GT(大于)、LT(小于)、GTE(大于等于)、LTE(小于等于)、EQ(等于)
- 严重级别：CRITICAL/WARNING

### 裁决记录 (DecisionRecord)
- 自动裁决或人工覆写
- 保留原始输入(raw_input)和结论
- 记录违反的规则列表

### 回滚摘要 (RollbackSummary)
- 完整的复盘报告
- 可导出为JSON或纯文本格式
