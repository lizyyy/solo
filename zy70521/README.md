# 数据删除宽限期 API

一个完整的数据删除宽限期管理系统，支持删除申请、宽限期管理、撤销申请、数据清除及合规性证明留存。

## 核心特性

- 📋 **删除申请管理**: 支持创建、查询、修改删除请求
- ⏳ **宽限期管理**: 可配置宽限期时长，状态自动流转
- ↩️ **撤销申请**: 宽限期内可申请撤销，支持审核流程
- 🗑️ **数据清除**: 幂等性清除任务，支持失败重试
- 📜 **证明留存**: 完整审计轨迹，SHA-256 哈希校验
- 📊 **导出功能**: 导出完整审计摘要，用于合规性验证

## 技术栈

- Node.js + Express
- SQLite (嵌入式数据库)
- Joi (参数验证)
- UUID + SHA-256 (证明生成)

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（可选，首次启动自动执行）

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3005

## API 接口列表

### 基础信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| GET | /api/status-definitions | 状态定义说明 |

### 删除请求管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deletion-requests | 创建删除请求 |
| GET | /api/deletion-requests | 查询删除请求列表 |
| GET | /api/deletion-requests/:id | 查询单个删除请求 |
| GET | /api/deletion-requests/:id/history | 查询状态变更历史 |

### 状态推进

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deletion-requests/:id/start-grace | 进入宽限期 |
| POST | /api/deletion-requests/:id/revoke | 申请撤销 |
| POST | /api/deletion-requests/revocations/:id/review | 审核撤销申请 |
| POST | /api/deletion-requests/:id/purge | 创建清除任务 |
| POST | /api/deletion-requests/purge/:id/start | 开始清除 |
| POST | /api/deletion-requests/purge/:id/complete | 完成清除 |
| POST | /api/deletion-requests/purge/:id/fail | 标记清除失败 |

### 异常处理与人工修正

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deletion-requests/:id/manual-correct | 人工修正请求 |

### 导出与证明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/deletion-requests/:id/export | 导出完整审计摘要 |
| GET | /api/deletion-requests/:id/proofs | 查询证明列表 |
| GET | /api/deletion-requests/:id/revocations | 查询撤销记录 |
| GET | /api/deletion-requests/:id/purge-tasks | 查询清除任务 |

## 状态流转图

```
PENDING
   ├─→ IN_GRACE_PERIOD ←──────────┐
   │     ├─→ REVOCATION_REQUESTED  │
   │     │     ├─→ REVOKED         │
   │     │     └─→ (退回) ─────────┘
   │     └─→ PURGE_SCHEDULED
   │           └─→ PURGE_IN_PROGRESS
   │                 └─→ PURGED
   ├─→ CANCELLED
   └─→ ERROR (可恢复)
```

## Curl 调用示例

### 1. 创建删除请求

```bash
curl -X POST http://localhost:3005/api/deletion-requests \
  -H "Content-Type: application/json" \
  -d '{
    "user_subject": "user_12345",
    "deletion_scope": "FULL_ACCOUNT",
    "scope_details": {
      "include_profile": true,
      "include_order_history": true,
      "include_payment_data": true
    },
    "grace_period_hours": 72,
    "created_by": "admin_system",
    "reason": "用户申请注销账户"
  }'
```

### 2. 查询删除请求列表

```bash
curl http://localhost:3005/api/deletion-requests
```

### 3. 进入宽限期

```bash
# 替换 {request_id} 为实际请求ID
curl -X POST http://localhost:3005/api/deletion-requests/{request_id}/start-grace \
  -H "Content-Type: application/json" \
  -d '{
    "changed_by": "compliance_officer",
    "reason": "审核通过，进入72小时宽限期"
  }'
```

### 4. 申请撤销删除

```bash
curl -X POST http://localhost:3005/api/deletion-requests/{request_id}/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "requested_by": "user_12345",
    "reason": "用户改变主意，希望保留账户"
  }'
```

### 5. 审核撤销申请（批准）

```bash
# 替换 {revocation_id} 为实际撤销请求ID
curl -X POST http://localhost:3005/api/deletion-requests/revocations/{revocation_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "APPROVE",
    "reviewed_by": "compliance_manager",
    "review_notes": "撤销理由充分，批准撤销"
  }'
```

### 6. 创建并执行清除任务

```bash
# 创建清除任务
curl -X POST http://localhost:3005/api/deletion-requests/{request_id}/purge \
  -H "Content-Type: application/json" \
  -d '{
    "purge_scope": {
      "tables": ["users", "profiles", "orders", "payments"],
      "record_count": 156
    }
  }'

# 开始清除
curl -X POST http://localhost:3005/api/deletion-requests/purge/{purge_task_id}/start

# 完成清除
curl -X POST http://localhost:3005/api/deletion-requests/purge/{purge_task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "records_purged": 156,
    "bytes_purged": 2048576,
    "execution_log": {
      "start_time": "2024-01-15T10:00:00Z",
      "end_time": "2024-01-15T10:05:32Z",
      "tables_processed": 4
    }
  }'
```

### 7. 导出完整审计摘要

```bash
curl -X GET http://localhost:3005/api/deletion-requests/{request_id}/export \
  -o audit-summary.json
```

### 8. 人工修正（异常处理）

```bash
curl -X POST http://localhost:3005/api/deletion-requests/{request_id}/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "grace_period_hours": 168,
    "reason": "特殊审批延长宽限期至7天",
    "corrected_by": "senior_manager",
    "correction_reason": "用户正在办理重要业务，特批延长宽限期"
  }'
```

## 被规则拦住的路径（错误示例）

### 示例 1: 在 PENDING 状态下直接申请撤销

```bash
curl -X POST http://localhost:3005/api/deletion-requests/{request_id}/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "requested_by": "user_12345",
    "reason": "尝试在PENDING状态撤销"
  }'
```

**错误响应:**
```json
{
  "error": {
    "code": "REVOCATION_DENIED",
    "message": "撤销申请不被允许",
    "details": "仅在宽限期内且处于IN_GRACE_PERIOD状态时可以申请撤销",
    "raw_error": "REVOCATION_NOT_ALLOWED: 仅宽限期内可申请撤销"
  },
  "timestamp": "2024-01-15T...",
  "path": "/api/deletion-requests/..."
}
```

### 示例 2: 已 PURGED 状态尝试重新清除

```bash
# 在已清除的请求上再次创建清除任务
curl -X POST http://localhost:3005/api/deletion-requests/{purged_request_id}/purge \
  -H "Content-Type: application/json" \
  -d '{
    "purge_scope": {"tables": ["users"]}
  }'
```

**错误响应:**
```json
{
  "error": {
    "code": "PURGE_DENIED",
    "message": "创建清除任务不被允许",
    "details": "仅IN_GRACE_PERIOD或PURGE_SCHEDULED状态可以创建清除任务",
    "raw_error": "PURGE_NOT_ALLOWED: 状态不允许创建清除任务"
  },
  ...
}
```

### 示例 3: 无效的状态转换

```bash
# 尝试直接从 PENDING 跳到 PURGED
curl -X POST http://localhost:3005/api/deletion-requests/purge/{task_id}/complete \
  -H "Content-Type: application/json" \
  -d '{"records_purged": 100, "bytes_purged": 1024}'
```

**错误响应:**
```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "任务未处于执行状态",
    "details": "只能完成处于IN_PROGRESS状态的任务",
    "raw_error": "TASK_NOT_IN_PROGRESS"
  },
  ...
}
```

### 示例 4: 重复审核撤销请求

```bash
# 对已审核的撤销请求再次审核
curl -X POST http://localhost:3005/api/deletion-requests/revocations/{reviewed_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "REJECT",
    "reviewed_by": "another_officer"
  }'
```

**错误响应:**
```json
{
  "error": {
    "code": "ALREADY_REVIEWED",
    "message": "撤销请求已审核",
    "details": "同一撤销请求只能审核一次",
    "raw_error": "REVOCATION_ALREADY_REVIEWED"
  },
  ...
}
```

## 关键业务规则

### 1. 宽限期状态校验
- 只有 IN_GRACE_PERIOD 状态可以申请撤销
- 宽限期截止时间过后不允许撤销
- 状态变更必须遵循流转图规则

### 2. 撤销审核机制
- 撤销申请后进入 REVOCATION_REQUESTED 状态
- 需要人工审核批准（APPROVE）或拒绝（REJECT）
- 批准后进入 REVOKED 终止状态
- 拒绝后退回到 IN_GRACE_PERIOD 状态

### 3. 清除幂等性保护
- 同一删除请求只能完成一次清除
- 已完成的清除请求不能重复执行
- 失败的清除任务可以重试

### 4. 证明留存与完整性
- 所有状态变更记录完整历史
- 清除完成生成 SHA-256 内容哈希
- 导出摘要包含完整审计轨迹
- 原始请求、处理依据、最终结论全部留存

### 5. 失败路径处理
- 所有失败操作保留错误详情
- ERROR 状态可以人工干预恢复
- 人工修正记录完整操作痕迹
- 所有操作记录操作人和操作时间

## 数据模型说明

### deletion_requests（删除请求）
- id: 请求UUID
- user_subject: 用户主体标识
- deletion_scope: 删除范围
- scope_details: 范围详情(JSON)
- grace_period_hours: 宽限期时长
- grace_deadline: 宽限期截止时间
- status: 当前状态
- created_at: 创建时间
- created_by: 创建人
- reason: 删除原因
- original_request: 原始请求(JSON)
- processing_evidence: 处理证据(JSON)
- final_conclusion: 最终结论(JSON)
- version: 版本号(乐观锁)

### revocation_requests（撤销请求）
- 关联删除请求，记录撤销申请和审核信息

### purge_tasks（清除任务）
- 记录清除执行详情、统计数据、执行日志、证据哈希

### proof_summaries（证明摘要）
- 自动生成的审计证明，包含内容哈希
- 支持导出完整审计报告

### status_history（状态历史）
- 完整的状态变更日志，每次状态变更都有记录

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── database/
│   │   └── index.js           # 数据库连接
│   ├── models/
│   │   ├── deletionRequest.js # 删除请求模型
│   │   ├── revocationRequest.js # 撤销请求模型
│   │   ├── purgeTask.js       # 清除任务模型
│   │   └── proofSummary.js    # 证明摘要模型
│   ├── routes/
│   │   └── deletionRequests.js # API路由
│   ├── middleware/
│   │   └── errorHandler.js    # 错误处理中间件
│   ├── constants/
│   │   └── status.js          # 状态定义
│   └── scripts/
│       └── initDB.js          # 数据库初始化脚本
├── data/                      # SQLite数据库文件目录
├── package.json
└── README.md
```
