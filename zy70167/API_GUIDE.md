# 数据质量规则发布 API 使用指南

## 概述

本 API 系统围绕**规则版本**作为核心入口，实现完整的数据质量规则发布流程。

**核心设计理念：**
- **规则版本 = 入口**：所有操作都围绕规则版本展开
- **批次重算 + 告警订阅 = 主推进**：规则发布后的主要业务流程
- **误报豁免 + 发布审批 + 质量报表 = 兜底复查**：异常处理和质量追溯
- **状态机 + 操作日志 = 可追溯**：所有状态变更都有清晰记录

## 状态流转图

### 规则版本状态机

```
DRAFT (草稿)
    ↓ submit →
PENDING_APPROVAL (待审批)
    ↓ approve →           ↓ reject →
APPROVED (已通过)      REJECTED (已拒绝)
    ↓ publish →             ↓ edit →
PUBLISHED (已发布)       DRAFT (回到草稿)
    ↓ archive →
ARCHIVED (已归档)
```

### 批次重算状态机

```
PENDING (待执行)
    ↓ start →
RUNNING (执行中)
    ↓ success →        ↓ fail →
SUCCESS (成功)        FAILED (失败)
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm run build
npm start
```

服务地址: `http://localhost:3000`

### 健康检查

```bash
curl http://localhost:3000/health
```

## 完整流程示例

下面演示一个完整的规则发布和后续操作流程。

### 1. 创建规则版本（草稿）

```bash
curl -X POST http://localhost:3000/api/rule-versions \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "RULE-001",
    "ruleName": "用户表主键非空校验",
    "content": "SELECT COUNT(*) as fail_count FROM users WHERE id IS NULL",
    "description": "校验用户表主键字段是否存在空值",
    "createdBy": "developer-001"
  }'
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "ruleId": "RULE-001",
    "ruleName": "用户表主键非空校验",
    "version": 1,
    "status": "DRAFT",
    "content": "SELECT COUNT(*) as fail_count FROM users WHERE id IS NULL",
    "description": "校验用户表主键字段是否存在空值",
    "createdBy": "developer-001",
    "createdAt": "2026-05-10T...",
    "updatedAt": "2026-05-10T..."
  }
}
```

**保存返回的 `id`，后续操作都需要使用它。**

### 2. 查看状态信息

```bash
curl http://localhost:3000/api/rule-versions/status-info/DRAFT
```

**响应:**
```json
{
  "success": true,
  "data": {
    "status": "DRAFT",
    "description": "草稿 - 规则正在编辑中，未提交审批",
    "allowedTransitions": [
      { "status": "PENDING_APPROVAL", "description": "待审批 - 规则已提交，等待审批通过" },
      { "status": "ARCHIVED", "description": "已归档 - 规则已停用归档" }
    ]
  }
}
```

### 3. 提交审批

```bash
curl -X POST http://localhost:3000/api/rule-versions/{ruleVersionId}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "developer-001",
    "comment": "规则已完成，请求审批"
  }'
```

**状态: DRAFT → PENDING_APPROVAL**

### 4. 审批通过

```bash
curl -X POST http://localhost:3000/api/rule-versions/{ruleVersionId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "approver-001",
    "comment": "规则逻辑正确，审批通过"
  }'
```

**状态: PENDING_APPROVAL → APPROVED**

### 5. 发布规则

```bash
curl -X POST http://localhost:3000/api/rule-versions/{ruleVersionId}/publish \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "publisher-001",
    "comment": "正式发布 v1"
  }'
```

**状态: APPROVED → PUBLISHED**

### 6. 创建告警订阅（发布后才能订阅）

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "ruleVersionId": "{ruleVersionId}",
    "subscriberId": "USER-001",
    "subscriberName": "张三",
    "email": "zhangsan@example.com",
    "operator": "admin"
  }'
```

### 7. 发起批次重算（发布后才能重算）

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "ruleVersionId": "{ruleVersionId}",
    "batchDate": "2026-05-10",
    "createdBy": "operator-001"
  }'
```

### 8. 开始执行批次

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/start \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "scheduler-001"
  }'
```

**状态: PENDING → RUNNING**

### 9. 完成批次（成功）

```bash
curl -X POST http://localhost:3000/api/batches/{batchId}/success \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "scheduler-001",
    "dataCount": 10000,
    "passCount": 9850,
    "failCount": 150
  }'
```

**状态: RUNNING → SUCCESS**

### 10. 误报豁免（对失败记录进行豁免）

```bash
curl -X POST http://localhost:3000/api/waives \
  -H "Content-Type: application/json" \
  -d '{
    "ruleVersionId": "{ruleVersionId}",
    "batchId": "{batchId}",
    "reason": "历史数据迁移问题，属于已知错误，不影响业务",
    "waivedBy": "data-owner-001",
    "affectedRows": 50
  }'
```

### 11. 生成质量报表

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "ruleVersionId": "{ruleVersionId}",
    "reportDate": "2026-05-10",
    "generatedBy": "analyst-001"
  }'
```

### 12. 查看规则版本汇总

```bash
curl http://localhost:3000/api/reports/rule-version/{ruleVersionId}/summary
```

**响应:**
```json
{
  "success": true,
  "data": {
    "ruleVersion": {
      "id": "{ruleVersionId}",
      "ruleId": "RULE-001",
      "ruleName": "用户表主键非空校验",
      "version": 1,
      "status": "PUBLISHED"
    },
    "batchStatistics": {
      "total": 1,
      "success": 1,
      "failed": 0,
      "pending": 0,
      "running": 0,
      "successRate": "100.00",
      "averageScore": "98.50"
    },
    "subscriptionCount": 1,
    "activeSubscriptionCount": 1,
    "waiveCount": 1,
    "totalWaivedRows": 50,
    "reportCount": 1
  }
}
```

### 13. 查看操作历史

```bash
# 查看规则版本的完整历史
curl http://localhost:3000/api/rule-versions/{ruleVersionId}/history

# 或通过通用日志接口
curl http://localhost:3000/api/logs/entity/RuleVersion/{ruleVersionId}
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-1",
      "operationType": "PUBLISH",
      "entityType": "RuleVersion",
      "entityId": "{ruleVersionId}",
      "fromStatus": "APPROVED",
      "toStatus": "PUBLISHED",
      "description": "发布规则 v1 - 正式发布 v1",
      "operator": "publisher-001",
      "timestamp": "2026-05-10T10:30:00Z",
      "metadata": { "comment": "正式发布 v1" }
    },
    {
      "id": "log-2",
      "operationType": "APPROVE",
      "entityType": "RuleVersion",
      "entityId": "{ruleVersionId}",
      "fromStatus": "PENDING_APPROVAL",
      "toStatus": "APPROVED",
      "description": "审批通过 v1 - 规则逻辑正确，审批通过",
      "operator": "approver-001",
      "timestamp": "2026-05-10T10:25:00Z",
      "metadata": { "comment": "规则逻辑正确，审批通过" }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 6,
    "totalPages": 1
  }
}
```

## 错误处理示例

系统会拦截非法状态流转并给出清晰的错误原因。

### 示例 1: 重复提交（状态已是目标状态）

```bash
# 假设规则已在 PENDING_APPROVAL 状态，再次提交
curl -X POST http://localhost:3000/api/rule-versions/{ruleVersionId}/submit \
  -H "Content-Type: application/json" \
  -d '{"operator": "test"}'
```

**响应:**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "状态已经是 \"PENDING_APPROVAL\"，无需重复操作"
  }
}
```

### 示例 2: 非法流转（从 DRAFT 直接跳到 PUBLISHED）

```bash
curl -X POST http://localhost:3000/api/rule-versions/{ruleVersionId}/publish \
  -H "Content-Type: application/json" \
  -d '{"operator": "test"}'
```

**响应:**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "无法从 \"DRAFT\" 转换到 \"PUBLISHED\"。允许的转换: 待审批 - 规则已提交，等待审批通过、已归档 - 规则已停用归档"
  }
}
```

### 示例 3: 对未发布规则创建批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "ruleVersionId": "{draftRuleVersionId}",
    "batchDate": "2026-05-10",
    "createdBy": "test"
  }'
```

**响应:**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "仅已发布的规则可以发起批次重算。当前规则状态: DRAFT"
  }
}
```

## API 参考

### 规则版本管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/rule-versions` | 创建新规则版本 |
| GET | `/api/rule-versions` | 列出规则版本（支持过滤） |
| GET | `/api/rule-versions/:id` | 获取单个规则版本详情 |
| PUT | `/api/rule-versions/:id` | 更新规则版本（仅限草稿/已拒绝） |
| POST | `/api/rule-versions/:id/submit` | 提交审批 |
| POST | `/api/rule-versions/:id/approve` | 审批通过 |
| POST | `/api/rule-versions/:id/reject` | 审批拒绝 |
| POST | `/api/rule-versions/:id/publish` | 发布规则 |
| POST | `/api/rule-versions/:id/archive` | 归档规则 |
| GET | `/api/rule-versions/:id/history` | 查看操作历史 |
| GET | `/api/rule-versions/status-info/:status` | 查看状态信息和允许转换 |

### 批次重算

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/batches` | 创建批次重算任务 |
| GET | `/api/batches/:id` | 获取批次详情 |
| GET | `/api/batches/rule-version/:ruleVersionId` | 列出规则的所有批次 |
| POST | `/api/batches/:id/start` | 开始执行批次 |
| POST | `/api/batches/:id/success` | 标记批次成功 |
| POST | `/api/batches/:id/fail` | 标记批次失败 |
| GET | `/api/batches/:id/history` | 查看批次操作历史 |

### 告警订阅

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/subscriptions` | 创建告警订阅 |
| GET | `/api/subscriptions/:id` | 获取订阅详情 |
| GET | `/api/subscriptions/rule-version/:ruleVersionId` | 列出规则的订阅 |
| PUT | `/api/subscriptions/:id` | 更新订阅信息 |
| POST | `/api/subscriptions/:id/cancel` | 取消订阅 |
| POST | `/api/subscriptions/:id/reactivate` | 重新激活订阅 |
| GET | `/api/subscriptions/:id/history` | 查看订阅历史 |

### 误报豁免

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/waives` | 创建误报豁免 |
| GET | `/api/waives/:id` | 获取豁免详情 |
| GET | `/api/waives/rule-version/:ruleVersionId` | 列出规则的豁免 |
| GET | `/api/waives/batch/:batchId` | 列出批次的豁免 |

### 质量报表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/reports` | 生成质量报表 |
| GET | `/api/reports/:id` | 获取报表详情 |
| GET | `/api/reports/rule-version/:ruleVersionId` | 列出规则的报表 |
| GET | `/api/reports/rule-version/:ruleVersionId/summary` | 获取规则汇总信息 |

### 操作日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/logs` | 查看所有操作日志 |
| GET | `/api/logs/entity/:entityType/:entityId` | 查看实体的操作历史 |

## 项目结构

```
.
├── src/
│   ├── index.ts                 # 应用入口
│   ├── types/
│   │   └── index.ts            # 类型定义
│   ├── utils/
│   │   └── stateMachine.ts     # 状态机逻辑
│   ├── database/
│   │   └── init.ts             # 数据库初始化
│   ├── services/
│   │   ├── ruleVersionService.ts      # 规则版本服务
│   │   ├── batchRecalculationService.ts # 批次重算服务
│   │   ├── alertSubscriptionService.ts  # 告警订阅服务
│   │   ├── falsePositiveWaiveService.ts # 误报豁免服务
│   │   ├── qualityReportService.ts     # 质量报表服务
│   │   └── operationLogService.ts      # 操作日志服务
│   └── routes/
│       ├── ruleVersions.ts     # 规则版本路由
│       ├── batches.ts          # 批次路由
│       ├── subscriptions.ts    # 订阅路由
│       ├── waives.ts           # 豁免路由
│       ├── reports.ts          # 报表路由
│       └── logs.ts             # 日志路由
├── data/                       # SQLite 数据库文件
├── package.json
├── tsconfig.json
└── API_GUIDE.md
```

## 核心特性

1. **状态机保护**：所有状态变更都经过严格校验，非法流转被拦截
2. **完整日志**：每个操作都记录 `fromStatus`、`toStatus`、操作人、操作说明
3. **防重复提交**：同一状态重复操作会返回友好提示
4. **业务约束**：
   - 只有 `PUBLISHED` 状态的规则才能创建批次和订阅
   - 只有成功的批次才能申请误报豁免
   - 只有草稿/已拒绝状态可以编辑
5. **汇总视图**：通过 `/summary` 接口一站式查看规则全貌
