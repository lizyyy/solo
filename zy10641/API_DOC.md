# 数据同步平台 - 失败批次重放 API 文档

## 概述

本系统为数据同步平台提供失败批次重放功能，支持过程追踪、证据留存、冲突检测和CSV导出。

## 状态流转

```
同步中 (syncing) → 失败 (failed) → 重放中 (replaying) → 已完成 (completed)
                                         ↓
                                      失败 (failed)  [可继续重放]
```

## API 接口列表

### 1. 批次管理

#### 1.1 创建批次

```
POST /api/batch
Content-Type: application/json

{
  "batchNo": "BATCH20240101001",      // 可选，自动生成
  "dataSource": "MySQL-用户库",        // 必填
  "targetTable": "t_user_sync",        // 必填
  "totalCount": 100,                   // 总记录数
  "successCount": 0,
  "failCount": 0,
  "failReason": "",
  "createdBy": "admin"
}

返回:
{
  "code": 0,
  "message": "创建成功",
  "data": {
    "id": "uuid",
    "batchNo": "BATCH20240101001",
    "dataSource": "MySQL-用户库",
    "targetTable": "t_user_sync",
    "status": "syncing",
    "statusText": "同步中",
    "totalCount": 100,
    "successCount": 0,
    "failCount": 0,
    "failReason": null,
    "hasPartialSuccess": false,
    "replayCount": 0,
    "createdBy": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 1.2 查询批次列表

```
GET /api/batch?page=1&pageSize=20&status=failed&dataSource=MySQL

参数:
- page: 页码，默认1
- pageSize: 每页条数，默认20
- status: 状态筛选 (syncing/failed/replaying/completed)
- dataSource: 数据源模糊搜索
- batchNo: 批次号模糊搜索
- startDate/endDate: 创建时间范围

返回:
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 1.3 查询批次详情

```
GET /api/batch/{id}

返回包含重放历史记录:
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "id": "uuid",
    "batchNo": "BATCH20240101001",
    ...,
    "replayHistories": [
      {
        "id": "uuid",
        "replayNo": 1,
        "operator": "operator_001",
        "status": "success",
        "statusText": "成功",
        "totalCount": 40,
        "successCount": 40,
        "failCount": 0,
        "conflictCount": 0,
        "skipCount": 0,
        "reason": "修复数据格式后重放",
        "failRecords": [],
        "conflictRecords": [],
        "evidence": {
          "requestId": "REQ123456",
          "processTime": 1250
        },
        "startedAt": "2024-01-01T01:00:00.000Z",
        "finishedAt": "2024-01-01T01:00:02.000Z"
      }
    ]
  }
}
```

#### 1.4 标记批次失败

```
POST /api/batch/{id}/mark-failed
Content-Type: application/json

{
  "successCount": 60,
  "failCount": 40,
  "failReason": "字段格式错误: 手机号格式不合法",
  "failDetail": {
    "errorType": "validation_error",
    "fieldErrors": ["phone", "email"]
  }
}
```

### 2. 重放功能

#### 2.1 发起重放

```
POST /api/batch/{id}/replay
Content-Type: application/json

{
  "operator": "operator_001",
  "reason": "修复数据格式后重放"
}

返回:
{
  "code": 0,
  "message": "重放任务已提交",
  "data": {
    "batch": {...},
    "replayHistory": {...}
  }
}
```

#### 2.2 完成重放

```
POST /api/batch/{id}/complete-replay
Content-Type: application/json

{
  "successCount": 40,
  "failCount": 0,
  "conflictCount": 0,
  "skipCount": 0,
  "failRecords": [],
  "conflictRecords": [],
  "evidence": {
    "requestId": "REQ123456",
    "processTime": 1250,
    "operator": "operator_001"
  }
}
```

#### 2.3 冲突检测

```
POST /api/batch/{id}/check-conflict
Content-Type: application/json

{
  "recordKeys": ["ORD001", "ORD002", "ORD003"]
}

返回:
{
  "code": 0,
  "message": "冲突检测完成",
  "data": {
    "hasConflict": true,
    "conflictKeys": ["ORD001", "ORD002"],
    "message": "检测到 2 条记录已存在，将跳过这些记录以避免重复写入"
  }
}
```

### 3. 导出功能

#### 3.1 发起导出

```
POST /api/batch/export
Content-Type: application/json

{
  "exportType": "batch_list",          // batch_list / replay_history / fail_records
  "operator": "operator_001",
  "filters": {
    "status": "failed",
    "batchId": "uuid"                  // 仅用于重放历史和失败记录导出
  }
}

返回:
{
  "code": 0,
  "message": "导出任务已提交",
  "data": {
    "exportNo": "EXP20240101120000ABCD",
    "id": "uuid",
    "status": "pending"
  }
}
```

#### 3.2 查询导出状态

```
GET /api/batch/export/{id}/status

返回:
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "exportNo": "EXP20240101120000ABCD",
    "exportType": "batch_list",
    "status": "completed",
    "statusText": "已完成",
    "fileName": "同步批次列表_20240101120000.csv",
    "fileSize": 15360,
    "recordCount": 100,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "expiredAt": "2024-01-08T12:00:00.000Z"
  }
}
```

## 导出字段说明

### 批次列表导出字段

| 字段名 | 中文说明 |
|--------|----------|
| batchNo | 批次号 |
| dataSource | 数据源 |
| targetTable | 目标表 |
| statusText | 状态 |
| totalCount | 总记录数 |
| successCount | 成功数 |
| failCount | 失败数 |
| failReason | 失败原因 |
| hasPartialSuccess | 是否部分成功 |
| replayCount | 重放次数 |
| lastReplayAt | 最后重放时间 |
| createdBy | 创建人 |
| createdAt | 创建时间 |
| completedAt | 完成时间 |

### 重放历史导出字段

| 字段名 | 中文说明 |
|--------|----------|
| replayNo | 重放序号 |
| batchNo | 批次号 |
| operator | 操作人 |
| statusText | 重放结果 |
| reason | 重放原因 |
| totalCount | 总记录数 |
| successCount | 成功数 |
| failCount | 失败数 |
| conflictCount | 冲突数 |
| skipCount | 跳过数 |
| startedAt | 开始时间 |
| finishedAt | 结束时间 |

### 失败记录导出字段

| 字段名 | 中文说明 |
|--------|----------|
| lineNo | 行号 |
| recordKey | 记录标识 |
| failReason | 失败原因 |
| failType | 失败类型 |
| rawData | 原始数据 |
| batchNo | 所属批次 |
| replayNo | 重放序号 |

## 数据模型

### Batch (批次表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| batchNo | String | 批次号，唯一 |
| dataSource | String | 数据源 |
| targetTable | String | 目标表 |
| status | Enum | 状态: syncing/failed/replaying/completed |
| totalCount | Integer | 总记录数 |
| successCount | Integer | 成功数 |
| failCount | Integer | 失败数 |
| failReason | Text | 失败原因 |
| failDetail | JSON | 失败详情 |
| hasPartialSuccess | Boolean | 是否部分成功 |
| replayCount | Integer | 重放次数 |
| lastReplayAt | DateTime | 最后重放时间 |
| createdBy | String | 创建人 |
| completedAt | DateTime | 完成时间 |

### ReplayHistory (重放历史表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| batchId | UUID | 批次ID |
| replayNo | Integer | 重放序号 |
| operator | String | 操作人 |
| status | Enum | 结果: pending/success/partial_success/failed |
| totalCount | Integer | 本次重放总记录数 |
| successCount | Integer | 本次重放成功数 |
| failCount | Integer | 本次重放失败数 |
| conflictCount | Integer | 冲突记录数 |
| skipCount | Integer | 跳过记录数 |
| reason | Text | 重放原因 |
| failRecords | JSON | 失败记录详情 |
| conflictRecords | JSON | 冲突记录详情 |
| evidence | JSON | 重放证据 |
| startedAt | DateTime | 开始时间 |
| finishedAt | DateTime | 结束时间 |

### ExportRecord (导出记录表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| exportNo | String | 导出编号 |
| exportType | Enum | 类型: batch_list/replay_history/fail_records |
| status | Enum | 状态: pending/processing/completed/failed |
| fileName | String | 文件名 |
| filePath | String | 文件路径 |
| fileSize | BigInteger | 文件大小 |
| recordCount | Integer | 记录数 |
| operator | String | 操作人 |
| filters | JSON | 查询条件 |
| errorMsg | Text | 错误信息 |
| expiredAt | DateTime | 过期时间 |

## 验收场景覆盖

1. **完整流转测试** (7个用例)
   - 创建批次 → 同步中状态
   - 标记失败含部分成功
   - 列表查询验证可见
   - 发起重放 → 重放中状态
   - 重放完成全部成功 → 已完成状态
   - 详情查询验证历史记录
   - 已完成批次不能重放

2. **冲突记录测试** (4个用例)
   - 创建含部分成功批次
   - 检测冲突记录
   - 重放含冲突批次，保留冲突证据
   - 详情查询验证冲突记录留存

3. **坏行导入测试** (4个用例)
   - 创建批次含坏行
   - 重放失败保留坏行证据
   - 导出失败记录
   - 验证导出字段与列表一致

4. **业务字段验证** (1个用例)
   - API返回包含业务字段（数据源、目标表、状态文本、失败原因等）

## 启动服务

```bash
npm install
npm start          # 生产模式
npm run dev        # 开发模式（nodemon）
npm test           # 运行测试
```

服务默认运行在 `http://localhost:3000`
