# Flatmate Manager API

合租室友管理系统后端API - 解决合租时的账单分摊、家务轮值、积分管理和争议处理问题。

## 功能特性

### 核心功能

- **账单管理**：支持均摊、按比例、指定人员、垫付报销四种分摊方式
- **付款记录**：待确认、部分确认、已结清、逾期四种状态
- **家务轮值**：支持周期生成（每天/每周/每两周/每月），完成后奖励积分
- **积分系统**：1积分=0.1元，可抵扣账单，有使用上限
- **争议处理**：支持账单、付款、家务、积分四种争议类型，管理员审核后可重算余额
- **通知系统**：账单创建、付款确认、积分变动等事件实时通知

### 数据导出

- **JSON 导出**：完整数据导出，支持时间范围和模块选择
- **Markdown 导出**：美观的报表格式，适合打印或分享
- **个人对账单**：每个室友的详细收支记录
- **余额汇总**：整体财务状况一览

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 数据库初始化

项目使用 SQLite 数据库，首次运行会自动创建数据库文件。

### 填充种子数据（可选）

```bash
npm run seed
```

种子数据包含：
- 4个室友（张三-管理员、李四、王五、赵六-已退房）
- 5个账单（水电费、房租、公共用品、网络费、历史账单）
- 14条分摊规则
- 3条付款记录
- 5个家务任务
- 3条积分调整记录
- 3条争议单
- 3条通知

### 启动服务

```bash
# 开发模式（支持热重载）
npm run dev

# 生产模式
npm start
```

服务启动后访问 http://localhost:3000

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch
```

## API 文档

### 基础信息

- **基础URL**: `http://localhost:3000/api/v1`
- **请求格式**: `application/json`
- **响应格式**: `application/json`
- **用户认证**: 通过请求头 `x-user-id` 传递用户ID（简化版认证）

### 健康检查

```bash
GET /api/v1/health
```

响应示例：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 123.45
  }
}
```

### API 信息

```bash
GET /api/v1/info
```

---

## 室友管理 API

### 获取所有室友

```bash
GET /api/v1/flatmates
GET /api/v1/flatmates?include_inactive=true
```

### 获取单个室友

```bash
GET /api/v1/flatmates/:id
```

### 创建室友

```bash
POST /api/v1/flatmates
Content-Type: application/json

{
  "name": "新室友",
  "email": "new@example.com",
  "phone": "13800138999",
  "is_admin": false
}
```

### 更新室友

```bash
PUT /api/v1/flatmates/:id
Content-Type: application/json

{
  "name": "更新后的名字",
  "email": "updated@example.com"
}
```

### 删除室友

```bash
DELETE /api/v1/flatmates/:id
```

### 获取室友余额

```bash
GET /api/v1/flatmates/balance
Header: x-user-id: 1
```

---

## 账单管理 API

### 获取所有账单

```bash
GET /api/v1/bills
GET /api/v1/bills?status=pending&category=utility
GET /api/v1/bills?start_date=2024-01-01&end_date=2024-01-31
```

查询参数：
- `status`: 账单状态 (pending/partial/settled/overdue/disputed)
- `category`: 账单类型 (utility/supplies/rent/service/other)
- `created_by`: 创建者ID
- `start_date`: 开始日期
- `end_date`: 结束日期
- `limit`: 每页数量 (默认20)
- `offset`: 偏移量 (默认0)

### 获取单个账单详情

```bash
GET /api/v1/bills/:id
```

### 创建账单

#### 方式一：均摊

```bash
POST /api/v1/bills
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "2024年1月水电费",
  "description": "包含电费、水费、燃气费",
  "category": "utility",
  "total_amount": 600.00,
  "split_type": "equal",
  "due_date": "2024-02-15"
}
```

#### 方式二：按比例分摊

```bash
POST /api/v1/bills
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "公共用品采购",
  "description": "卫生纸、洗洁精、洗衣液等",
  "category": "supplies",
  "total_amount": 150.00,
  "split_type": "ratio",
  "split_config": {
    "ratios": [
      { "flatmate_id": 1, "ratio": 0.4 },
      { "flatmate_id": 2, "ratio": 0.3 },
      { "flatmate_id": 3, "ratio": 0.3 }
    ]
  }
}
```

#### 方式三：指定人员分摊

```bash
POST /api/v1/bills
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "2024年1月网络费",
  "description": "只有我和李四用网络，王五不用",
  "category": "service",
  "total_amount": 200.00,
  "split_type": "specific",
  "split_config": {
    "assignments": [
      { "flatmate_id": 1, "amount": 100 },
      { "flatmate_id": 2, "amount": 100 }
    ]
  }
}
```

#### 方式四：垫付后报销

```bash
POST /api/v1/bills
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "2024年1月房租",
  "description": "我先垫付，大家后续转钱给我",
  "category": "rent",
  "total_amount": 9000.00,
  "split_type": "advance",
  "advanced_by_id": 1,
  "due_date": "2024-01-15"
}
```

### 更新账单

```bash
PUT /api/v1/bills/:id
Content-Type: application/json

{
  "title": "更新后的标题",
  "description": "更新后的描述",
  "due_date": "2024-02-20"
}
```

### 删除账单

```bash
DELETE /api/v1/bills/:id
```

### 获取账单的分摊规则

```bash
GET /api/v1/bills/:bill_id/split-rules
```

### 获取账单的付款记录

```bash
GET /api/v1/bills/:bill_id/payments
```

### 获取余额汇总

```bash
GET /api/v1/bills/balance/summary
```

响应示例：
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_active_flatmates": 3,
      "total_points": 430,
      "total_points_value": "43.00",
      "total_balance": "2300.00",
      "total_pending": "2100.00",
      "total_overdue": "200.00"
    },
    "alerts": {
      "has_overdue_risk": true,
      "has_pending_bills": true,
      "overdue_amount": "200.00",
      "pending_amount": "2100.00"
    }
  }
}
```

### 获取室友对账单

```bash
GET /api/v1/bills/statement/:flatmate_id
GET /api/v1/bills/statement/1?start_date=2024-01-01&end_date=2024-01-31
GET /api/v1/bills/statement/1?status=pending
```

---

## 付款管理 API

### 获取所有付款记录

```bash
GET /api/v1/payments
GET /api/v1/payments?status=pending&payer_id=1
```

### 获取我的付款记录

```bash
GET /api/v1/payments/my
Header: x-user-id: 1
```

### 获取待我确认的付款

```bash
GET /api/v1/payments/to-confirm
Header: x-user-id: 1
```

### 获取单个付款记录

```bash
GET /api/v1/payments/:id
```

### 记录付款

```bash
POST /api/v1/payments
Content-Type: application/json
Header: x-user-id: 2

{
  "bill_id": 1,
  "split_rule_id": 2,
  "amount": 200.00,
  "use_points": true,
  "points_to_use": 100,
  "payment_method": "wechat",
  "receiver_id": 1,
  "transaction_id": "wx20240115123456",
  "notes": "微信转账给张三"
}
```

说明：
- `use_points`: 是否使用积分抵扣
- `points_to_use`: 希望使用的积分数（系统会自动计算最大可用值）
- `receiver_id`: 收款人ID（转账时使用）

### 确认付款

```bash
POST /api/v1/payments/confirm
Content-Type: application/json
Header: x-user-id: 1

{
  "payment_id": 1
}
```

### 拒绝付款

```bash
POST /api/v1/payments/:id/reject
Content-Type: application/json
Header: x-user-id: 1

{
  "rejection_reason": "金额不对，应该是150元不是200元"
}
```

---

## 家务任务 API

### 获取所有任务

```bash
GET /api/v1/chores
GET /api/v1/chores?status=pending&category=cleaning
GET /api/v1/chores?assigned_to=1
GET /api/v1/chores?include_completed=true
```

### 获取即将到来的任务

```bash
GET /api/v1/chores/upcoming
GET /api/v1/chores/upcoming?days_ahead=7&flatmate_id=1
```

### 获取我的任务

```bash
GET /api/v1/chores/my
Header: x-user-id: 1
```

### 获取单个任务

```bash
GET /api/v1/chores/:id
```

### 创建任务

```bash
POST /api/v1/chores
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "打扫客厅",
  "description": "包括扫地、拖地、擦桌子",
  "category": "cleaning",
  "assigned_to_id": 1,
  "points_reward": 15,
  "points_penalty": 8,
  "priority": "medium",
  "due_date": "2024-01-20T18:00:00",
  "is_recurring": false
}
```

### 创建周期性任务

```bash
POST /api/v1/chores
Content-Type: application/json
Header: x-user-id: 1

{
  "title": "倒垃圾",
  "description": "每周一、三、五倒垃圾",
  "category": "trash",
  "assigned_to_id": 1,
  "points_reward": 5,
  "points_penalty": 3,
  "priority": "low",
  "is_recurring": true,
  "recurrence_pattern": "weekly",
  "recurrence_days": ["Monday", "Wednesday", "Friday"]
}
```

周期模式：
- `daily`: 每天
- `weekly`: 每周（配合 `recurrence_days`）
- `biweekly`: 每两周
- `monthly`: 每月

### 更新任务

```bash
PUT /api/v1/chores/:id
Content-Type: application/json

{
  "title": "更新后的任务标题",
  "due_date": "2024-01-25T18:00:00"
}
```

### 完成任务

```bash
POST /api/v1/chores/:id/complete
Content-Type: application/json
Header: x-user-id: 1

{
  "proof_image_url": "https://example.com/cleaned.jpg"
}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "task": { "status": "completed", ... },
    "points_earned": 15
  },
  "message": "任务完成，获得 15 积分"
}
```

### 标记为爽约

```bash
POST /api/v1/chores/:id/miss
Header: x-user-id: 1
```

### 跳过任务

```bash
POST /api/v1/chores/:id/skip
Content-Type: application/json
Header: x-user-id: 1

{
  "reason": "今天有事，明天再做"
}
```

### 检查过期任务

```bash
POST /api/v1/chores/check-overdue
```

---

## 争议处理 API

### 获取所有争议单

```bash
GET /api/v1/disputes
GET /api/v1/disputes?status=open&dispute_type=bill
```

### 获取我的争议单

```bash
GET /api/v1/disputes/my
Header: x-user-id: 1
```

### 获取分配给我的争议单（管理员）

```bash
GET /api/v1/disputes/assigned
Header: x-user-id: 1
```

### 获取争议统计

```bash
GET /api/v1/disputes/stats
```

### 获取单个争议单

```bash
GET /api/v1/disputes/:id
```

### 创建争议单

#### 账单争议

```bash
POST /api/v1/disputes
Content-Type: application/json
Header: x-user-id: 2

{
  "dispute_type": "bill",
  "bill_id": 1,
  "title": "水电费金额有疑问",
  "description": "我觉得这个月的水电费太高了，可能有人私用了大功率电器。请查看电费单明细。",
  "priority": "high",
  "proposed_solution": "希望能查看电费单，按实际使用情况重新分摊。",
  "evidence_image_urls": ["https://example.com/bill-photo.jpg"]
}
```

#### 付款争议

```bash
POST /api/v1/disputes
Content-Type: application/json
Header: x-user-id: 1

{
  "dispute_type": "payment",
  "payment_id": 2,
  "title": "房租付款金额不对",
  "description": "李四说他转了3000元给我，但我只收到了2900元，可能是转账手续费的问题。",
  "priority": "medium"
}
```

#### 家务争议

```bash
POST /api/v1/disputes
Content-Type: application/json
Header: x-user-id: 2

{
  "dispute_type": "chore",
  "task_id": 4,
  "title": "不应该扣我积分",
  "description": "我那天生病了，所以没打扫卫生间，但我第二天补做了。不应该扣我积分。",
  "priority": "low"
}
```

争议类型：
- `bill`: 账单争议
- `payment`: 付款争议
- `chore`: 家务争议
- `point`: 积分争议

### 更新争议单

```bash
PUT /api/v1/disputes/:id
Content-Type: application/json
Header: x-user-id: 1

{
  "priority": "high",
  "notes": "补充说明：已联系供电局核实"
}
```

### 解决争议单（管理员）

```bash
POST /api/v1/disputes/:id/resolve
Content-Type: application/json
Header: x-user-id: 1

{
  "resolution": "已核实，李四确实第二天补做了。已返还扣除的8积分。",
  "requires_balance_recalculation": true,
  "mark_as_completed": true
}
```

根据争议类型的不同解决方案：

**账单争议**：
```json
{
  "resolution": "按实际使用重新分摊",
  "requires_balance_recalculation": true,
  "new_split_rules": [
    { "flatmate_id": 1, "amount": 250 },
    { "flatmate_id": 2, "amount": 200 },
    { "flatmate_id": 3, "amount": 150 }
  ]
}
```

**付款争议**：
```json
{
  "resolution": "确认金额有误，拒绝该付款",
  "requires_balance_recalculation": true,
  "reject_payment": true,
  "rejection_reason": "转账金额与约定不符"
}
```

**家务争议**：
```json
{
  "resolution": "任务确实已补做，返还积分",
  "requires_balance_recalculation": true,
  "mark_as_completed": true
}
```

---

## 通知 API

### 获取我的通知

```bash
GET /api/v1/notifications
GET /api/v1/notifications?is_read=false
```

### 获取通知摘要

```bash
GET /api/v1/notifications/summary
Header: x-user-id: 1
```

### 获取单个通知

```bash
GET /api/v1/notifications/:id
Header: x-user-id: 1
```

### 标记为已读

```bash
POST /api/v1/notifications/:id/mark-read
Header: x-user-id: 1
```

### 全部标记为已读

```bash
POST /api/v1/notifications/mark-all-read
Header: x-user-id: 1
```

### 删除通知

```bash
DELETE /api/v1/notifications/:id
Header: x-user-id: 1
```

### 删除已读通知

```bash
DELETE /api/v1/notifications/read
Header: x-user-id: 1
DELETE /api/v1/notifications/read?before_date=2024-01-01
```

---

## 数据导出 API

### JSON 导出

```bash
GET /api/v1/export/json
GET /api/v1/export/json?start_date=2024-01-01&end_date=2024-01-31
GET /api/v1/export/json?include_bills=true&include_payments=true
```

可选参数：
- `start_date`: 开始日期
- `end_date`: 结束日期
- `include_bills`: 是否包含账单 (默认true)
- `include_payments`: 是否包含付款 (默认true)
- `include_flatmates`: 是否包含室友 (默认true)
- `include_chores`: 是否包含家务 (默认true)
- `include_points`: 是否包含积分 (默认true)
- `include_disputes`: 是否包含争议 (默认true)

### Markdown 导出

```bash
GET /api/v1/export/markdown
GET /api/v1/export/markdown?flatmate_id=1
GET /api/v1/export/markdown?summary_only=true
```

### 余额汇总导出

```bash
GET /api/v1/export/balance/json
GET /api/v1/export/balance/markdown
```

### 个人对账单导出

```bash
GET /api/v1/export/statement/:flatmate_id/json
GET /api/v1/export/statement/:flatmate_id/markdown
```

---

## 核心业务流程

### 流程一：账单创建与付款

```
1. 管理员创建账单
   POST /api/v1/bills
   
2. 系统自动生成分摊规则
   - 均摊：总金额 ÷ 室友数
   - 按比例：按配置的比例计算
   - 指定人员：仅指定的室友分摊
   - 垫付报销：垫付人标记为已支付，其他人待支付
   
3. 室友记录付款
   POST /api/v1/payments
   - 可选择使用积分抵扣
   - 记录付款方式、交易号等
   
4. 收款人确认付款
   POST /api/v1/payments/confirm
   
5. 系统自动更新状态
   - 更新分摊规则的已支付金额
   - 更新账单状态（待确认 → 部分确认 → 已结清）
   - 发送通知给相关人员
```

### 流程二：争议处理

```
1. 室友发起争议
   POST /api/v1/disputes
   - 选择争议类型
   - 填写标题和描述
   - 附上证据图片（可选）
   
2. 系统自动标记
   - 标记关联的账单/付款/任务为"有争议"
   - 发送通知给管理员
   
3. 管理员审核
   GET /api/v1/disputes/assigned
   
4. 管理员解决争议
   POST /api/v1/disputes/:id/resolve
   - 填写解决方案
   - 选择是否需要重新计算余额
   - 根据争议类型执行相应操作
   
5. 系统执行重算
   - 恢复关联实体的状态
   - 重新计算分摊金额（如需）
   - 返还或扣除积分（如需）
   - 发送通知给争议发起人
```

### 流程三：家务任务与积分

```
1. 创建家务任务
   POST /api/v1/chores
   - 可以是单次或周期性任务
   - 设置奖励和惩罚积分
   
2. 周期性任务自动生成
   - 系统按周期模式生成任务实例
   
3. 完成任务
   POST /api/v1/chores/:id/complete
   
4. 系统自动奖励积分
   - 创建积分调整记录
   - 更新室友积分余额
   - 发送通知
   
5. 逾期未完成
   - 系统自动标记为爽约
   - 扣除惩罚积分
   - 发送通知
   
6. 积分抵扣账单
   - 付款时选择使用积分
   - 系统自动计算最大可用积分：
     * 不超过应付金额的20%
     * 不超过100积分（10元）
     * 不超过当前积分余额
```

---

## 数据模型说明

### 核心模型

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| Flatmate | 室友 | name, email, phone, is_admin, points, status |
| Bill | 账单 | title, total_amount, split_type, status, due_date |
| SplitRule | 分摊规则 | bill_id, flatmate_id, split_type, amount, paid_amount |
| PaymentRecord | 付款记录 | bill_id, payer_id, amount, status, payment_method |
| ChoreTask | 家务任务 | title, assigned_to_id, points_reward, status, due_date |
| PointAdjustment | 积分调整 | flatmate_id, adjustment_type, points, reason |
| Dispute | 争议单 | dispute_type, raised_by_id, status, resolution |
| Notification | 通知 | recipient_id, notification_type, is_read |

### 分摊方式说明

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| equal | 均摊 | 水电费、房租等大家平摊的费用 |
| ratio | 按比例 | 有人用得多有人用得少的情况 |
| specific | 指定人员 | 只有部分人参与的费用（如网络费） |
| advance | 垫付报销 | 有人先垫付，其他人后续转账 |

### 状态说明

**账单状态**：
- `pending`: 待确认
- `partial`: 部分确认
- `settled`: 已结清
- `overdue`: 逾期
- `disputed`: 有争议

**付款状态**：
- `pending`: 待确认
- `confirmed`: 已确认
- `rejected`: 已拒绝
- `disputed`: 有争议

**任务状态**：
- `pending`: 待执行
- `in_progress`: 进行中
- `completed`: 已完成
- `missed`: 爽约
- `skipped`: 跳过
- `disputed`: 有争议

**争议状态**：
- `open`: 新提交
- `under_review`: 审核中
- `resolved`: 已解决
- `closed`: 已关闭
- `rejected`: 已驳回

### 积分规则

- **1 积分 = ¥0.1**
- **获得途径**：完成家务任务
- **消耗途径**：抵扣账单、爽约惩罚
- **使用限制**：
  - 单次最多抵扣应付金额的 **20%**
  - 单次最多使用 **100 积分**（¥10）
  - 积分有效期：**180 天**

---

## 错误响应格式

所有错误响应统一使用以下格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": [...]
  }
}
```

### 常见错误码

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| INVALID_INPUT | 输入参数无效 | 400 |
| NOT_FOUND | 资源不存在 | 404 |
| FORBIDDEN | 无权限操作 | 403 |
| CONFLICT | 数据冲突 | 409 |
| BILL_NOT_FOUND | 账单不存在 | 404 |
| BILL_ALREADY_SETTLED | 账单已结清 | 400 |
| PAYMENT_NOT_FOUND | 付款记录不存在 | 404 |
| PAYMENT_ALREADY_CONFIRMED | 付款已确认 | 400 |
| DISPUTE_NOT_FOUND | 争议单不存在 | 404 |
| INSUFFICIENT_POINTS | 积分不足 | 400 |

---

## 目录结构

```
zy1091/
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   ├── database.js        # 数据库配置
│   │   └── constants.js       # 常量配置
│   ├── controllers/
│   │   ├── FlatmateController.js
│   │   ├── BillController.js
│   │   ├── PaymentController.js
│   │   ├── ChoreController.js
│   │   ├── DisputeController.js
│   │   ├── NotificationController.js
│   │   ├── ExportController.js
│   │   └── index.js
│   ├── database/
│   │   └── seed.js            # 种子数据
│   ├── middlewares/
│   │   ├── errorHandler.js    # 错误处理
│   │   ├── validation.js      # 输入校验
│   │   └── index.js
│   ├── models/
│   │   ├── Flatmate.js
│   │   ├── Bill.js
│   │   ├── SplitRule.js
│   │   ├── PaymentRecord.js
│   │   ├── ChoreTask.js
│   │   ├── PointAdjustment.js
│   │   ├── Dispute.js
│   │   ├── Notification.js
│   │   └── index.js
│   ├── routes/
│   │   ├── flatmates.js
│   │   ├── bills.js
│   │   ├── payments.js
│   │   ├── chores.js
│   │   ├── disputes.js
│   │   ├── notifications.js
│   │   ├── export.js
│   │   └── index.js
│   └── services/
│       ├── BillService.js
│       ├── ChoreService.js
│       ├── DisputeService.js
│       ├── NotificationService.js
│       ├── ExportService.js
│       └── index.js
├── tests/
│   ├── setup.js
│   ├── flatmate.test.js
│   ├── bill.test.js
│   └── payment.test.js
├── data/                       # SQLite 数据库目录
├── logs/                       # 日志目录
├── package.json
├── jest.config.js
└── README.md
```

---

## 技术栈

- **Node.js** - 运行时
- **Express** - Web 框架
- **SQLite** - 数据库
- **Sequelize** - ORM
- **Joi** - 数据校验
- **Moment** - 日期处理
- **Jest** - 测试框架
- **Supertest** - API 测试
- **Helmet** - 安全中间件
- **CORS** - 跨域支持
- **Morgan** - 日志记录

---

## 后续优化建议

1. **用户认证**：当前使用简化的 `x-user-id` 头，建议改为 JWT 或 Session
2. **权限控制**：实现更细粒度的权限管理
3. **文件上传**：支持证据图片、付款凭证等文件上传
4. **定时任务**：自动检查逾期账单和任务
5. **邮件/短信通知**：集成邮件或短信服务
6. **数据备份**：定期自动备份数据库
7. **API 文档**：集成 Swagger 或 OpenAPI
8. **性能优化**：添加缓存、优化查询
9. **监控告警**：添加应用监控和错误告警

---

## License

MIT
