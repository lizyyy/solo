# 客服退款权限管理系统

## 系统概述

这是一个针对客服退款业务的权限管理后端系统，解决以下实际问题：

- 客服退款按等级、金额、品类限制
- 越权审批实时拦截（而非事后发现）
- 完整的审计追踪，数字和明细对得上

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化测试数据

```bash
npm run seed
```

这会创建示例员工、品类、额度、权限矩阵数据。

### 3. 启动服务

```bash
npm start
```

服务启动在 `http://localhost:3000`

健康检查：`GET http://localhost:3000/health`

### 4. 运行测试

```bash
npm test
```

## 核心概念

### 员工等级

| 等级 | 代码 | 退款额度 | 可审批 | 说明 |
|------|------|----------|--------|------|
| 初级客服 | junior | ¥0 | 否 | 只能发起，不能直接退款 |
| 中级客服 | intermediate | ¥500 | 否 | 可直接处理小额 |
| 高级客服 | senior | ¥2000 | 否 | 可处理一般金额 |
| 主管 | supervisor | ¥5000 | 是 | 开始有审批权 |
| 经理 | manager | ¥10000 | 是 | 大额审批 |
| 总监 | director | 无限制 | 是 | 最高权限 |

### 品类规则

| 品类代码 | 名称 | 可退款 | 退款比例 | 特殊审批 |
|----------|------|--------|----------|----------|
| ELECTRONICS | 电子数码 | 是 | 85% | 否 |
| CLOTHING | 服装服饰 | 是 | 100% | 否 |
| FOOD | 食品生鲜 | 否 | 0% | - |
| LUXURY | 奢侈品 | 是 | 50% | 是 |
| DEFAULT | 其他商品 | 是 | 100% | 否 |

## 核心动作

### 1. 权限矩阵

管理谁能做什么操作。

**查询权限检查：**
```bash
POST /api/permissions/check
Content-Type: application/json
X-Operator-Id: staff_senior_01

{
  "staff_id": "staff_senior_01",
  "action": "refund",
  "amount": 1500,
  "category": "CLOTHING"
}
```

**返回会告诉你：**
- 是否允许（allowed）
- 拒绝原因（reason）
- 需要的审批等级（required_approval_level）
- 每一步的检查详情（checks）

### 2. 退款额度

按等级和品类设置退款限额。

**设置额度：**
```bash
POST /api/limits
Content-Type: application/json
X-Operator-Id: admin

{
  "staff_level": "senior",
  "category": "ELECTRONICS",
  "max_amount": 1000
}
```

**检查额度：**
```bash
GET /api/limits/check?staff_level=senior&amount=3000&category=ELECTRONICS
```

额度支持有效期（effective_from/effective_to），变更会保留历史记录。

### 3. 品类规则

管理不同商品品类的退款政策。

**查看所有品类：**
```bash
GET /api/categories
```

**创建品类：**
```bash
POST /api/categories
Content-Type: application/json

{
  "category_code": "DIGITAL",
  "category_name": "数字商品",
  "is_refundable": false,
  "special_approval_required": false
}
```

## 退款流程

### 正常流程（额度内）

```
客服发起 → 权限检查通过 → 直接进入待处理(pending)
                                        ↓
                                    执行退款
                                        ↓
                                  标记完成(completed)
```

### 审批流程（超限或特殊品类）

```
客服发起 → 权限检查失败但可审批 → 进入待审批(awaiting_approval)
                                                   ↓
                                              主管审批
                                          (也可能需要经理/总监)
                                                   ↓
                                            批准/拒绝
                                                   ↓
                                       进入待处理或已拒绝
```

**发起退款：**
```bash
POST /api/refunds
Content-Type: application/json

{
  "order_id": "ORDER20240101001",
  "customer_id": "CUST001",
  "product_id": "PROD001",
  "product_category": "CLOTHING",
  "amount": 800,
  "reason": "尺码不合适",
  "initiator_id": "staff_inter_01",
  "idempotency_key": "RF-20240101-001"
}
```

**idempotency_key 用于幂等性，重复请求会返回已创建的请求。**

**查看待审批列表：**
```bash
GET /api/approvals/pending?approver_level=supervisor
```

**审批通过：**
```bash
POST /api/approvals/{approvalId}/approve
X-Operator-Id: staff_super_01

{
  "comment": "同意退款"
}
```

**审批拒绝：**
```bash
POST /api/approvals/{approvalId}/reject
X-Operator-Id: staff_super_01

{
  "comment": "理由不充分"
}
```

## 真实麻烦的处理

### 缺字段

发起退款时，缺少必填字段会被明确拒绝，返回具体缺失的字段列表：

```json
{
  "success": false,
  "error": "参数验证失败",
  "details": ["字段缺失: amount", "字段缺失: reason"]
}
```

### 重复请求

两种机制防止重复：
1. **幂等键（idempotency_key）**：业务方生成，重复请求返回已创建的
2. **窗口检测**：5分钟内同一订单+商品+发起人视为重复

```json
{
  "success": false,
  "error": "重复请求",
  "existing_request": {
    "id": "...",
    "request_no": "RF20240101ABCDEF",
    "status": "pending"
  }
}
```

### 半路失败

所有写操作使用数据库事务：
- 退款请求创建 + 审批请求创建 在同一事务
- 审批操作 + 状态更新 在同一事务
- 失败时自动回滚

查看审计日志可确认操作是否持久化。

### 人工改错

提供人工修正接口（只允许特定字段）：

```bash
POST /api/refunds/{requestId}/fix
X-Operator-Id: staff_director_01

{
  "status": "approved",
  "amount": 1500,
  "reason": "修正金额"
}
```

**注意：**
- 只允许修改 status、amount、reason
- 所有修改都会记录到审计日志（REFUND_MANUAL_FIX）
- 记录 before_value 和 after_value 便于追溯

## 审计与查询

### 越权拦截

任何越权尝试都会被实时记录（OVERRIDE_ATTEMPT）：

```bash
GET /api/audit/override-attempts?start_time=2024-01-01&end_time=2024-01-31
```

### 退款时间线

查看单笔退款的完整操作历史：

```bash
GET /api/audit/refund-timeline/{refundRequestId}
```

返回按时间排序的操作列表，每个操作包含：
- 操作类型
- 操作人（ID、姓名、等级）
- 结果（success/failed/blocked）
- 详情

### 审计日志查询

```bash
GET /api/audit/logs
  ?operation_type=REFUND_REQUEST_CREATE
  &operator_id=staff_inter_01
  &result=success
  &start_time=2024-01-01
  &end_time=2024-01-31
  &page=1
  &page_size=100
```

### 日报

运行日报脚本：
```bash
npm run audit-report [YYYY-MM-DD]
```

日报包含：
1. 操作汇总（创建、完成、取消、修正、审批、越权尝试）
2. 按操作员统计（操作数、失败数）
3. 越权尝试记录（谁、什么时候、为什么）
4. 业务状态概览（各状态的退款数量）
5. **下一步操作建议**

## 故障排查指南

### 场景1：退款请求被拒绝

**现象：** 发起退款返回 `success: false`

**排查步骤：**
1. 看返回的 `permission_checks` 数组，找到 `passed: false` 的项
2. 检查该客服的额度：`GET /api/limits/check?staff_level=...`
3. 检查品类是否可退款：`GET /api/categories/{categoryCode}`
4. 查看审计日志确认是哪一步失败：`GET /api/audit/logs?target_id={requestId}`

### 场景2：需要审批但没人处理

**现象：** 退款状态一直是 `awaiting_approval`

**排查步骤：**
1. 看创建退款时返回的 `required_approval_level`
2. 查询该等级的待审批列表：`GET /api/approvals/pending?approver_level={level}`
3. 检查是否审批人也超限（需要更高级别审批）
4. 可以手动升级审批：`POST /api/approvals/{approvalId}/escalate`

### 场景3：金额算错了需要改

**现象：** 已创建的退款金额有误

**处理方式：**
1. 总监及以上可人工修正：`POST /api/refunds/{id}/fix`
2. 审计日志会记录修改前后的值
3. 日报会统计人工修正次数（需要关注）

### 场景4：越权尝试频繁

**现象：** 日报中 OVERRIDE_ATTEMPT 很多

**排查步骤：**
1. 查询越权尝试详情：`GET /api/audit/override-attempts`
2. 看是哪类问题（额度超限？品类限制？）
3. 检查是不是权限配置不合理
4. 看是否集中在某个员工（可能需要培训）

## 日志位置

| 日志类型 | 位置 | 如何查看 |
|----------|------|----------|
| 应用日志 | logs/app.log | `tail -f logs/app.log` |
| 审计数据 | 数据库 audit_logs 表 | 通过 API 查询 |
| 业务数据 | refund_permission.db | SQLite 客户端 |

## API 速查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |
| GET | /api/categories | 品类列表 |
| POST | /api/categories | 创建品类 |
| PUT | /api/categories/:code | 更新品类 |
| GET | /api/limits | 额度列表 |
| GET | /api/limits/check | 检查额度 |
| POST | /api/limits | 设置额度 |
| POST | /api/permissions/check | 权限检查 |
| POST | /api/permissions/matrix | 创建权限矩阵 |
| POST | /api/refunds | 创建退款请求 |
| GET | /api/refunds | 退款列表 |
| GET | /api/refunds/:id | 退款详情 |
| POST | /api/refunds/:id/complete | 完成退款 |
| POST | /api/refunds/:id/cancel | 取消退款 |
| POST | /api/refunds/:id/fix | 人工修正 |
| GET | /api/approvals/pending | 待审批列表 |
| GET | /api/approvals/:id | 审批详情 |
| POST | /api/approvals/:id/approve | 审批通过 |
| POST | /api/approvals/:id/reject | 审批拒绝 |
| POST | /api/approvals/:id/escalate | 升级审批 |
| GET | /api/audit/logs | 审计日志列表 |
| GET | /api/audit/logs/:id | 审计日志详情 |
| GET | /api/audit/refund-timeline/:id | 退款时间线 |
| GET | /api/audit/override-attempts | 越权尝试记录 |
| GET | /api/audit/daily-report | 日报数据 |

## 请求头约定

| 头名 | 说明 |
|------|------|
| X-Operator-Id | 操作人ID，用于审计和权限验证 |

## 数据模型

### 核心表

- **staff**：员工信息（ID、姓名、等级、是否激活）
- **permission_matrix**：权限矩阵（等级、操作、是否允许、品类、额度）
- **category_rules**：品类规则（是否可退款、退款比例、是否需特殊审批）
- **refund_limits**：退款额度（等级、品类、最大金额、有效期）
- **refund_requests**：退款请求（订单、客户、商品、金额、状态）
- **approval_requests**：审批请求（关联退款、审批等级、状态）
- **audit_logs**：审计日志（所有操作的完整记录）

## 下一步扩展建议

1. **对接实际支付系统**：completeRefund 目前只更新状态，需要接入实际退款API
2. **消息通知**：待审批时通知对应等级的审批人
3. **报表导出**：支持导出Excel/PDF格式的日报、月报
4. **权限配置UI**：提供可视化界面管理额度和品类规则
5. **定时任务**：自动清理历史数据、生成日报
