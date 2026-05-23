# 学校实验室耗材重试补偿队列 API 文档

## 系统概述

本系统用于管理学校实验室耗材的重试补偿队列，支持领用单、采购到货表、老师补签记录的建账，主管批注追加，以及完整的审计追踪。

## 核心功能

- ✅ 外部回执提交（支持幂等性）
- ✅ 排队与限次重试机制
- ✅ 人工接管与改判
- ✅ 补偿入账与关闭
- ✅ 完整的变更历史（前后差异）
- ✅ 重复提交策略（忽略/覆盖/追加）
- ✅ 撤回后再提交
- ✅ 部分失败处理
- ✅ 导出前冻结
- ✅ 异常保留与死信处理
- ✅ 自动化审计检查

## 数据源类型 (SourceType)

```typescript
enum SourceType {
  RECEIPT = 'receipt',           // 领用单
  PURCHASE_ARRIVAL = 'purchase_arrival', // 采购到货表
  TEACHER_SIGN = 'teacher_sign', // 老师补签记录
  SUPERVISOR_COMMENT = 'supervisor_comment', // 主管批注
  GROUP_BORROW = 'group_borrow', // 课题组借用
  LOSS_RECORD = 'loss_record',   // 损耗记录
}
```

## 队列状态 (QueueStatus)

```typescript
enum QueueStatus {
  PENDING = 'pending',         // 待处理
  PROCESSING = 'processing',   // 处理中
  SUCCESS = 'success',         // 成功
  FAILED = 'failed',           // 失败
  RETRYING = 'retrying',       // 重试中
  MANUAL_REVIEW = 'manual_review', // 人工审核
  DEAD_LETTER = 'dead_letter', // 死信
  CANCELLED = 'cancelled',     // 已取消
  FROZEN = 'frozen',           // 已冻结
  CLOSED = 'closed',           // 已关闭
}
```

## 重试策略 (RetryStrategy)

```typescript
enum RetryStrategy {
  IGNORE = 'ignore',     // 忽略重复
  OVERWRITE = 'overwrite', // 覆盖原有
  APPEND = 'append',     // 追加新记录
}
```

---

## API 接口

### 1. 提交接口

#### POST /api/submission/submit

提交记录到队列。

**请求体：**
```json
{
  "sourceType": "receipt",
  "batchId": "batch-2024-01-001",
  "items": [
    {
      "sourceId": "receipt-001",
      "data": {
        "item": "试管",
        "quantity": 100,
        "requester": "张三"
      }
    }
  ],
  "submittedBy": "teacher_01",
  "retryStrategy": "ignore",
  "comment": "日常耗材领用"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-2024-01-001",
    "totalItems": 1,
    "processedItems": 1,
    "skippedItems": 0,
    "failedItems": 0,
    "queueItemIds": ["uuid-queue-item-1"],
    "results": [
      {
        "sourceId": "receipt-001",
        "status": "created",
        "queueItemId": "uuid-queue-item-1"
      }
    ]
  }
}
```

#### GET /api/submission/batch/:batchId

获取批次下的所有记录。

#### POST /api/submission/resubmit/:queueItemId

重新提交已取消的队列项。

**请求体：**
```json
{
  "operator": "admin",
  "newData": { "updated": "data" }
}
```

---

### 2. 队列管理接口

#### GET /api/queue/item/:id

获取队列项详情。

#### GET /api/queue/pending

获取待处理项列表。

**查询参数：** `limit` (默认 100)

#### GET /api/queue/retryable

获取可重试项列表。

**查询参数：** `limit` (默认 100)

#### GET /api/queue/statistics

获取队列统计信息。

**响应：**
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "pending": 10,
      "success": 50,
      "retrying": 5,
      "dead_letter": 2
    },
    "frozenCount": 3
  }
}
```

#### POST /api/queue/status/:id

更新队列项状态。

**请求体：**
```json
{
  "status": "manual_review",
  "operator": "supervisor",
  "comment": "需要人工核实"
}
```

#### POST /api/queue/retry/:id

标记为重试。

**请求体：**
```json
{
  "operator": "system_worker",
  "error": "Network timeout"
}
```

#### POST /api/queue/manual-review/:id

标记为人工审核。

**请求体：**
```json
{
  "operator": "supervisor",
  "comment": "数据异常，需人工核对"
}
```

#### POST /api/queue/freeze/:id

冻结队列项（导出前）。

**请求体：**
```json
{
  "operator": "audit_admin",
  "reason": "审计导出冻结"
}
```

#### POST /api/queue/unfreeze/:id

解冻队列项。

#### POST /api/queue/cancel/:id

取消队列项。

#### POST /api/queue/close/:id

关闭队列项。

---

### 3. 死信队列接口

#### GET /api/dead-letter/unresolved

获取未解决的死信。

#### GET /api/dead-letter/statistics

获取死信统计。

#### POST /api/dead-letter/resolve/:id

解决死信。

**请求体：**
```json
{
  "operator": "admin",
  "resolution": "已修复上游数据问题",
  "action": "retry"
}
```

**action 可选值：** `retry` | `dismiss`

---

### 4. 变更历史接口

#### GET /api/history/queue-item/:queueItemId

获取队列项的完整变更历史。

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "queue_item_id": "queue-item-uuid",
      "operation_type": "submit",
      "operator": "teacher_01",
      "operated_at": 1704067200000,
      "before_state": null,
      "after_state": {
        "status": "pending",
        "retryCount": 0
      },
      "diff": null,
      "comment": "Initial submission"
    },
    {
      "id": "uuid-2",
      "operation_type": "retry",
      "operator": "system_worker",
      "operated_at": 1704067260000,
      "before_state": { "status": "pending" },
      "after_state": { "status": "retrying" },
      "diff": {
        "status": {
          "before": "pending",
          "after": "retrying"
        }
      },
      "comment": "Retry attempt 1"
    }
  ]
}
```

#### GET /api/history/summary/:queueItemId

获取变更摘要。

#### GET /api/history/timeline

获取时间线视图。

---

### 5. 补偿入账接口

#### POST /api/compensation/post

提交补偿入账。

**请求体：**
```json
{
  "queueItemId": "queue-item-uuid",
  "recordId": "record-uuid",
  "sourceType": "receipt",
  "batchId": "batch-001",
  "entryType": "adjustment",
  "amount": 50.00,
  "quantity": 10,
  "accountCode": "EXP-LAB-001",
  "postedBy": "finance_01",
  "notes": "补偿入账 - 耗材损耗"
}
```

**entryType 可选值：** `debit` | `credit` | `adjustment`

#### POST /api/compensation/comment/:queueItemId

添加主管批注。

**请求体：**
```json
{
  "comment": "数据核实无误，同意入账",
  "commentedBy": "director_01",
  "isAppendOnly": true
}
```

---

### 6. 导出接口

#### POST /api/export/audit

导出审计数据。

**请求体：**
```json
{
  "format": "json",
  "filters": {
    "sourceType": ["receipt", "purchase_arrival"],
    "status": ["success", "pending"],
    "batchId": "batch-001",
    "startDate": 1704067200000,
    "endDate": 1706659200000
  },
  "includeHistory": true,
  "includeDeadLetter": true,
  "exportedBy": "audit_admin"
}
```

**format 可选值：** `json` | `csv`

#### GET /api/export/retriable-classification

获取可重试项分类（学院秘书重点关注）。

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "category": "network_errors",
      "count": 5,
      "items": [
        {
          "id": "queue-item-1",
          "sourceType": "receipt",
          "error": "Network timeout while connecting to ERP",
          "lastAttempt": 1704067200000
        }
      ]
    },
    {
      "category": "validation_errors",
      "count": 3,
      "items": [...]
    },
    {
      "category": "other_errors",
      "count": 2,
      "items": [...]
    }
  ]
}
```

#### GET /api/export/dead-letter-summary

死信导出摘要。

---

### 7. 审计检查接口

#### GET /api/audit/all

运行所有自动化检查。

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "checkName": "duplicate_import_check",
      "passed": true,
      "message": "No duplicate imports found",
      "details": []
    },
    {
      "checkName": "permission_interception_check",
      "passed": true,
      "message": "All sensitive operations performed by authorized personnel"
    },
    {
      "checkName": "exception_retention_check",
      "passed": true,
      "message": "All exceptions are properly retained with context"
    },
    {
      "checkName": "restart_history_check",
      "passed": true,
      "message": "History continuity verified"
    },
    {
      "checkName": "export_consistency_check",
      "passed": true,
      "message": "Found 5 frozen export snapshots for verification"
    },
    {
      "checkName": "frozen_items_check",
      "passed": true,
      "message": "No frozen items older than 7 days"
    },
    {
      "checkName": "orphaned_records_check",
      "passed": true,
      "message": "No orphaned records found"
    }
  ],
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0
  }
}
```

---

## 边界情况处理

### 1. 重复提交

通过 `retryStrategy` 参数控制：
- `ignore`: 跳过重复记录
- `overwrite`: 覆盖原有数据和状态
- `append`: 创建新记录（sourceId 添加时间戳）

### 2. 撤回后再提交

1. 调用 `POST /api/queue/cancel/:id` 取消
2. 调用 `POST /api/submission/resubmit/:id` 重新提交（可选更新数据）

### 3. 部分失败

批次提交返回详细结果，包含每个项目的状态：
- `created` - 新建成功
- `skipped` - 重复跳过
- `overwritten` - 覆盖成功
- `appended` - 追加成功
- `failed` - 处理失败

### 4. 人工改判

1. 标记为 `manual_review` 状态
2. 主管添加批注
3. 人工决定：通过/驳回/重试/转死信

### 5. 导出前冻结

1. 调用 `POST /api/queue/freeze/:id` 冻结
2. 冻结期间无法修改状态
3. 导出完成后可解冻

### 6. 异常保留

- 所有异常记录错误信息和堆栈
- 死信保留完整重试历史
- 系统日志保留 traceId 可追溯

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build
npm start
```

---

## 项目结构

```
src/
├── types/              # 类型定义
├── database/           # 数据库配置与Schema
├── middleware/         # Express中间件
├── services/           # 核心业务服务
│   ├── logger.ts       # 系统日志
│   ├── history.ts      # 变更历史
│   ├── queue.ts        # 队列管理
│   ├── deadLetter.ts   # 死信处理
│   ├── submission.ts   # 提交处理
│   ├── compensation.ts # 补偿入账
│   ├── export.ts       # 导出功能
│   ├── audit.ts        # 审计检查
│   └── worker.ts       # 工作队列
├── routes/             # API路由
└── index.ts            # 入口文件

tests/
└── integration.test.ts # 集成测试
```

---

## 核心设计要点

### 可信记录保障

1. **不可变历史**：所有变更记录完整，包含前后状态和diff
2. **操作人追踪**：每个操作记录操作者、时间、IP
3. **冻结机制**：导出前冻结防止篡改
4. **哈希快照**：导出内容哈希可验证一致性

### 学院秘书关注点

1. **可重试分类**：按错误类型分类，便于批量处理
2. **死信处理**：死信队列集中管理，可恢复重试
3. **恢复后续跑**：支持从失败点继续，不重复处理

### 审计关注点

1. **同一套事实**：所有数据源统一管理，可交叉验证
2. **去向追踪**：完整的补偿入账记录
3. **谁改了什么**：变更历史清晰记录每个修改
