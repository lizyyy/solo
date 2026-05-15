# 实验流量护栏 API 文档

## 概述

实验流量护栏 API 为新能力试运行提供服务端保护，支持：
- 实验计划管理
- 用户流量分桶
- 指标观测与阈值告警
- 自动暂停机制
- 回退确认
- 历史数据导出

## 基础信息

- Base URL: `http://localhost:8080/api/v1`
- Content-Type: `application/json`

## 接口列表

### 1. 创建实验

**POST** `/experiments`

创建一个新的实验计划。

**请求体:**
```json
{
  "name": "实验名称",
  "description": "实验描述",
  "traffic_rate": 0.5,
  "bucket_key": "experiment-v1",
  "thresholds": [
    {
      "metric_name": "error_rate",
      "operator": "gt",
      "value": 0.05,
      "window_size": 3,
      "trigger_count": 2
    }
  ]
}
```

**字段说明:**
- `traffic_rate`: 流量比例，0-1 之间
- `bucket_key`: 分桶键，用于一致性哈希
- `operator`: 阈值操作符，支持 `gt`, `lt`, `gte`, `lte`, `eq`
- `window_size`: 滑动窗口大小（最近 N 个指标）
- `trigger_count`: 触发次数阈值

**响应:**
```json
{
  "id": "uuid",
  "name": "实验名称",
  "status": "draft",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2. 启动实验

**POST** `/experiments/{id}/start`

将实验从草稿状态切换为运行状态。

**响应:**
```json
{
  "id": "uuid",
  "status": "running",
  "started_at": "2024-01-01T00:00:00Z"
}
```

### 3. 检查用户分桶

**GET** `/experiments/{id}/bucket?user_id={user_id}`

判断用户是否在实验组中。

**参数:**
- `user_id`: 用户唯一标识

**响应:**
```json
{
  "in_experiment": true
}
```

### 4. 记录指标

**POST** `/experiments/{id}/metrics`

记录实验指标，自动检查阈值。

**请求体:**
```json
{
  "request_id": "req_123",
  "user_id": "user_1",
  "name": "error_rate",
  "value": 0.03,
  "timestamp": "2024-01-01T00:00:00Z",
  "tags": "payment"
}
```

**字段说明:**
- `request_id`: 请求唯一标识，用于幂等性检查

**响应:**
```json
{
  "paused": false,
  "duplicate": false
}
```

**阈值触发时响应:**
```json
{
  "paused": true,
  "reason": "Threshold exceeded for metric 'error_rate'",
  "duplicate": false
}
```

### 5. 检查暂停状态

**GET** `/experiments/{id}/paused`

查询实验是否被暂停。

**响应:**
```json
{
  "paused": true,
  "reason": "Threshold exceeded for metric 'error_rate'"
}
```

### 6. 确认回退

**POST** `/experiments/{id}/rollback`

确认回退，将实验标记为回退状态。

**请求体:**
```json
{
  "confirmed_by": "admin@example.com",
  "reason": "错误率过高"
}
```

**响应:**
```json
{
  "id": "uuid",
  "status": "rollback",
  "ended_at": "2024-01-01T00:00:00Z"
}
```

### 7. 恢复实验

**POST** `/experiments/{id}/resume`

恢复已暂停的实验。

**响应:**
```json
{
  "id": "uuid",
  "status": "running"
}
```

### 8. 获取实验详情

**GET** `/experiments/{id}`

获取实验的详细信息，包括阈值配置和暂停记录。

### 9. 列出所有实验

**GET** `/experiments`

列出所有实验。

### 10. 导出观察结果

**GET** `/experiments/{id}/export?start_time={time}&end_time={time}`

导出实验的所有观察数据。

**参数:**
- `start_time`: 开始时间 (RFC3339 格式，可选)
- `end_time`: 结束时间 (RFC3339 格式，可选)

**响应:**
```json
{
  "experiment": {...},
  "metrics": [...],
  "pause_logs": [...],
  "rollback_log": {...}
}
```

## 状态流转

```
draft → running → paused → rollback
                    ↓
                  running (resume)
```

- `draft`: 草稿状态
- `running`: 运行中
- `paused`: 已暂停（阈值触发）
- `rollback`: 已回退
- `completed`: 已完成

## 核心机制

### 分桶算法
使用 FNV-32a 哈希算法对 `user_id:bucket_key` 进行哈希，根据哈希值与流量比例判断是否进入实验组。同一用户始终分到同一组。

### 阈值检测
每次记录指标后自动检测：
1. 获取窗口内的最新指标
2. 统计满足阈值条件的次数
3. 达到触发次数时自动暂停实验并记录日志

### 幂等性
通过 `request_id` 检测重复提交，避免重复计算。
