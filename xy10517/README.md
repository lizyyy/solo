# 售后备件借用 API

一套完整的售后备件借用管理系统，围绕售后工程师借用备件后追踪归还、消耗、损坏和客户工单关联展开。

## 功能概述

- **备件建档**: 管理备件基本信息和库存
- **工程师借用**: 工程师从仓库借出备件
- **工单绑定**: 将借用记录关联到具体客户工单
- **归还验收**: 工程师归还备件，仓库验收
- **消耗登记**: 备件在现场被使用消耗
- **损坏赔付**: 备件损坏登记和赔偿处理
- **异常处理**: 自动检测逾期、工单关闭未归还等异常
- **人工修正**: 管理员人工修正数据，保留审计痕迹
- **报告导出**: 支持 CSV 格式导出各类报告

## 核心业务规则

### 1. 同一备件重复借出检查
- 同一工程师不能同时借用同一未归还的备件
- 借用前自动检查是否有未结束的借用记录

### 2. 归还期限管理
- 借用时设置预计归还日期（默认 7 天）
- 自动检测逾期（`POST /api/loans/check-overdue`）
- 逾期借用自动标记为 `overdue` 状态

### 3. 工单关联检查
- 借用可绑定到一个工单
- 工单关闭时自动检查是否有未归还的借用
- 工单关闭但备件未归还的借用自动标记为 `exception` 状态

### 4. 归还数量一致性
- 归还数量不能超过未归还数量
- 支持部分归还，状态变为 `partial_returned`
- 全部归还后状态变为 `returned`

### 5. 幂等性保证
- 所有写操作支持 `X-Idempotency-Key` 请求头
- 相同的幂等键+相同的请求只会执行一次
- 重复请求直接返回第一次的响应

### 6. 人工修正审计
- 所有人工修改操作必须记录操作者和原因
- 自动记录修改前后的差异
- 审计日志不可删除

## 借用状态流转

```
borrowed (借用中)
    ├──→ partial_returned (部分归还) ──→ returned (已归还)
    ├──→ consumed (已消耗)
    ├──→ damaged (已损坏)
    ├──→ overdue (已逾期)
    └──→ exception (异常状态)
             └──→ (人工修正后可转为其他状态)
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化基础数据（造数）

```bash
# 清除旧数据（如果有）
rm -rf data/

# 创建基础数据：5种备件、4名工程师、4个工单
npm run seed
```

### 3. 运行演示场景

```bash
# 运行完整演示脚本
npm run demo
```

演示脚本会自动执行以下 6 个场景：

1. **正常借还流程**：借用 → 2天后归还 → 库存恢复
2. **工单消耗流程**：借用并绑定工单 → 现场消耗登记 → 状态变为 consumed
3. **逾期提醒流程**：借用 → 模拟时间流逝 → 自动检测并标记逾期
4. **损坏赔付流程**：借用 → 部分损坏登记 → 剩余归还 → 赔偿登记
5. **重复借用验证**：同一工程师试图重复借用同一未归还备件 → 被系统阻止
6. **异常处理流程**：借用绑定工单 → 关闭工单 → 自动标记异常 → 人工修正

### 4. 启动本地服务

```bash
npm start
```

服务启动后访问：
- 健康检查：http://localhost:3001/health
- 系统概览：http://localhost:3001/api/reports/dashboard

## API 接口文档

### 一、创建接口

#### 1.1 创建备件

```http
POST /api/parts
Content-Type: application/json

{
  "part_code": "MB-001",
  "part_name": "主板 A型",
  "category": "电子部件",
  "unit": "块",
  "price": 1500,
  "initial_quantity": 50,
  "location": "A-01-01",
  "min_stock": 10
}
```

#### 1.2 创建工程师

```http
POST /api/engineers
Content-Type: application/json

{
  "engineer_code": "ENG-001",
  "name": "张明",
  "department": "硬件维修组",
  "phone": "13800000001"
}
```

#### 1.3 创建工单

```http
POST /api/workorders
Content-Type: application/json

{
  "order_code": "WO-2024-001",
  "customer_name": "阳光科技有限公司",
  "customer_contact": "陈经理 13900000001",
  "issue_type": "硬件故障"
}
```

#### 1.4 创建借用记录

```http
POST /api/loans
Content-Type: application/json
X-Idempotency-Key: unique-key-12345
X-Operator: 仓管-小王

{
  "part_id": "part-uuid",
  "engineer_id": "engineer-uuid",
  "quantity": 2,
  "loan_reason": "现场维修使用",
  "expected_return_days": 7,
  "work_order_id": "workorder-uuid"
}
```

### 二、推进接口（状态流转）

#### 2.1 绑定工单

```http
POST /api/loans/:id/bind-workorder
Content-Type: application/json
X-Operator: 仓管-小王

{
  "work_order_id": "workorder-uuid",
  "reason": "现场绑定到具体工单"
}
```

#### 2.2 解除工单绑定

```http
POST /api/loans/:id/unbind-workorder
Content-Type: application/json
X-Operator: 仓管-小王

{
  "reason": "工单变更"
}
```

#### 2.3 归还备件

```http
POST /api/loans/:id/return
Content-Type: application/json
X-Idempotency-Key: return-key-123
X-Operator: 仓管-小王

{
  "quantity": 2,
  "reason": "维修完成，备件完好"
}
```

#### 2.4 消耗登记

```http
POST /api/loans/:id/consume
Content-Type: application/json
X-Operator: 仓管-小王

{
  "quantity": 2,
  "reason": "客户同意更换，旧件报废"
}
```

#### 2.5 损坏登记

```http
POST /api/loans/:id/damage
Content-Type: application/json
X-Operator: 仓管-小王

{
  "quantity": 1,
  "damage_level": "medium",
  "compensation_amount": 150,
  "reason": "现场电压不稳导致损坏"
}
```

损坏等级：
- `minor`: 轻微损坏
- `medium`: 中等损坏
- `major`: 严重损坏
- `total`: 完全损坏

#### 2.6 赔偿登记

```http
POST /api/loans/:id/compensate
Content-Type: application/json
X-Operator: 财务-小李

{
  "amount": 150,
  "reason": "工程师赔偿款已到账"
}
```

#### 2.7 检查逾期

```http
POST /api/loans/check-overdue
```

自动将超过归还日期的借用标记为 `overdue` 状态。

#### 2.8 检查工单关闭异常

```http
POST /api/loans/check-workorder-closed
```

自动将工单已关闭但备件未归还的借用标记为 `exception` 状态。

#### 2.9 人工修正

```http
POST /api/loans/:id/manual-correct
Content-Type: application/json
X-Operator: 仓库主管-张经理

{
  "correction": {
    "status": "damaged",
    "quantity": 1
  },
  "reason": "工程师确认备件丢失，按损坏处理"
}
```

**注意**：人工修正会记录完整的审计日志，包括修改前后的值、操作者和原因。

#### 2.10 解决异常

```http
POST /api/loans/:id/resolve-exception
Content-Type: application/json
X-Operator: 仓库主管-张经理

{
  "new_status": "returned",
  "reason": "已追回丢失的备件"
}
```

### 三、查询接口

#### 3.1 查询借用记录列表

```http
GET /api/loans?status=borrowed&engineer_id=xxx
```

查询参数：
- `status`: 按状态过滤
- `engineer_id`: 按工程师过滤
- `part_id`: 按备件过滤
- `work_order_id`: 按工单过滤

#### 3.2 查询单个借用详情

```http
GET /api/loans/:id
```

返回详细信息，包括：
- 基本信息（备件、工程师、工单）
- 状态计算（已归还、已消耗、已损坏、剩余数量）
- 逾期状态

#### 3.3 查询借用操作历史

```http
GET /api/loans/:id/items
```

返回该借用的所有操作记录（借用、绑定工单、归还、消耗、损坏等）。

#### 3.4 查询借用审计日志

```http
GET /api/loans/:id/audit
```

返回该借用的完整审计轨迹，包括所有状态变化和修改记录。

#### 3.5 查询工程师未归还清单

```http
GET /api/engineers/:id/unreturned
```

#### 3.6 查询备件流向

```http
GET /api/parts/:id/flow
```

#### 3.7 查询所有未归还

```http
GET /api/loans/unreturned
```

### 四、报告导出接口

所有报告接口支持 `?format=csv` 参数导出 CSV 文件。

#### 4.1 系统概览

```http
GET /api/reports/dashboard
```

返回：
- 借用状态统计
- 未归还统计（按状态、按工程师、按备件）
- 库存统计

#### 4.2 未归还清单

```http
GET /api/reports/unreturned
GET /api/reports/unreturned?format=csv
```

返回：
- 未归还总数和按状态分布
- 未绑定工单数量
- 工单已关闭但未归还数量
- 逾期超过7天/30天数量
- 详细清单

#### 4.3 库存状态报告

```http
GET /api/reports/stock
GET /api/reports/stock?format=csv
```

返回：
- 库存总价值
- 库存总数
- 低库存/零库存备件
- 详细库存列表

#### 4.4 库存变化记录

```http
GET /api/reports/inventory-changes
GET /api/reports/inventory-changes?format=csv
```

#### 4.5 备件流向报告

```http
GET /api/reports/part-flow/:partId
GET /api/reports/part-flow/:partId?format=csv
```

#### 4.6 借用审计报告

```http
GET /api/reports/loan-audit/:loanId
GET /api/reports/loan-audit/:loanId?format=csv
```

#### 4.7 完整审计报告

```http
GET /api/reports/full-audit
GET /api/reports/full-audit?format=csv
```

返回所有实体的审计记录，支持按动作、实体类型、操作员统计。

## 主要演示路径

### 路径 1：正常借还（闭环验证）

**步骤**：
1. 创建备件（初始库存 50）
2. 工程师借用 1 个 → 库存变为 49，状态 `borrowed`
3. 归还 1 个 → 库存恢复 50，状态 `returned`
4. 查看审计日志：create → stock_out → return → stock_in

**验证**：
- `GET /api/loans/:id` → 状态 `returned`，remaining=0
- `GET /api/parts/:id` → 库存 50
- `GET /api/loans/:id/audit` → 完整轨迹

### 路径 2：工单消耗

**步骤**：
1. 创建借用并绑定工单
2. 消耗登记 2 个 → 状态 `consumed`
3. 关闭工单 → 不会触发异常（因为已消耗）

**验证**：
- `GET /api/loans/:id` → 状态 `consumed`，totalConsumed=2
- `GET /api/workorders/:id/loans` → 关联的借用记录

### 路径 3：逾期检测

**步骤**：
1. 借用（设置 3 天归还期）
2. 模拟时间流逝 10 天
3. 调用 `POST /api/loans/check-overdue`
4. 查询状态变为 `overdue`

**验证**：
- `GET /api/loans/:id` → is_overdue=true, status=overdue
- `GET /api/reports/unreturned` → 显示在逾期列表中

### 路径 4：损坏赔付

**步骤**：
1. 借用 2 个电源
2. 登记 1 个损坏（medium，赔偿 150 元）
3. 归还剩余 1 个
4. 登记赔偿支付

**验证**：
- `GET /api/loans/:id` → totalDamaged=1, totalReturned=1, remaining=0
- `GET /api/loans/:id/items` → 包含 damage 和 compensate 记录

### 路径 5：异常处理

**步骤**：
1. 借用并绑定工单
2. 关闭工单（不归还备件）
3. 调用 `POST /api/loans/check-workorder-closed`
4. 状态变为 `exception`
5. 人工修正为 `damaged`

**验证**：
- `GET /api/loans/:id/audit` → 显示 exception 和 manual_correct 记录
- 审计日志包含 before/after 值、操作者、原因

## 失败路径演示

### 失败路径 1：重复借用

**预期**：同一工程师不能重复借用同一未归还的备件

```http
# 第一次借用（成功）
POST /api/loans
{ "part_id": "part-1", "engineer_id": "eng-1", "quantity": 1 }

# 第二次借用（失败）
POST /api/loans
{ "part_id": "part-1", "engineer_id": "eng-1", "quantity": 1 }
```

**返回**：
```json
{
  "success": false,
  "error": "该工程师已借用此备件且未归还，借用单号: LOAN-XXX"
}
```

### 失败路径 2：归还数量超过未归还数量

**预期**：归还数量不能大于剩余未归还数量

```http
# 借用 2 个
POST /api/loans { "quantity": 2, ... }

# 归还 3 个（失败）
POST /api/loans/:id/return { "quantity": 3 }
```

**返回**：
```json
{
  "success": false,
  "error": "归还数量超过未归还数量: 未归还2, 归还3"
}
```

### 失败路径 3：绑定到已关闭的工单

**预期**：不能将借用绑定到已关闭的工单

```http
# 关闭工单
POST /api/workorders/:id/close

# 绑定到已关闭工单（失败）
POST /api/loans/:id/bind-workorder
{ "work_order_id": "closed-wo-id" }
```

**返回**：
```json
{
  "success": false,
  "error": "不能绑定已关闭的工单"
}
```

### 失败路径 4：库存不足

**预期**：借用时库存不足会被拒绝

```http
# 备件库存 10 个
POST /api/loans { "quantity": 20, ... }
```

**返回**：
```json
{
  "success": false,
  "error": "库存不足: 当前库存 10, 需要 20"
}
```

### 失败路径 5：对已结束的借用操作

**预期**：已归还/已消耗/已关闭的借用不能再操作

```http
# 借用并已全部归还
POST /api/loans → POST /api/loans/:id/return { quantity: 2 }

# 再次归还（失败）
POST /api/loans/:id/return { "quantity": 1 }
```

**返回**：
```json
{
  "success": false,
  "error": "该借用已结束"
}
```

## 幂等性使用说明

对于所有写操作，建议使用 `X-Idempotency-Key` 请求头确保操作只执行一次。

```javascript
// 生成唯一键
const idempotencyKey = uuidv4();

// 第一次请求（执行）
const response1 = await fetch('/api/loans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
    'X-Operator': '仓管-小王'
  },
  body: JSON.stringify({ ... })
});

// 第二次相同请求（返回缓存结果，不重复执行）
const response2 = await fetch('/api/loans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,  // 相同的键
    'X-Operator': '仓管-小王'
  },
  body: JSON.stringify({ ... })  // 相同的请求体
});
```

**适用场景**：
- 网络超时后的重试
- 前端防止重复提交
- 异步回调的重复通知

## 审计记录验证

所有关键操作都会留下审计痕迹，可以通过以下方式验证业务闭环：

### 查看单个借用的审计轨迹

```http
GET /api/reports/loan-audit/:loanId
```

返回的 timeline 包含：
- `time`: 操作时间
- `action`: 操作类型（create, bind_workorder, return, consume, damage, manual_correct 等）
- `operator`: 操作者
- `before`: 操作前的值（JSON）
- `after`: 操作后的值（JSON）
- `reason`: 操作原因

### 查看完整审计报告

```http
GET /api/reports/full-audit
```

可以按以下维度统计：
- 按动作类型（create, update, return, consume 等）
- 按实体类型（loan, part, engineer, work_order）
- 按操作者

## 数据结构说明

### 借用状态 (loan.status)

| 状态 | 说明 |
|------|------|
| borrowed | 借用中 |
| overdue | 已逾期 |
| partial_returned | 部分归还 |
| returned | 已归还 |
| consumed | 已消耗 |
| damaged | 已损坏 |
| closed | 已关闭 |
| exception | 异常状态 |

### 操作类型 (loan_items.action_type)

| 类型 | 说明 |
|------|------|
| borrow | 借用 |
| bind_workorder | 绑定工单 |
| unbind_workorder | 解除工单 |
| partial_return | 部分归还 |
| return | 归还 |
| consume | 消耗 |
| damaged | 损坏 |
| compensate | 赔偿 |
| manual_correct | 人工修正 |
| resolve_exception | 解决异常 |

## 项目结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── database/
│   │   └── connection.js      # 数据库连接和封装
│   ├── services/
│   │   ├── partsService.js    # 备件服务
│   │   ├── engineersService.js # 工程师服务
│   │   ├── workOrdersService.js # 工单服务
│   │   ├── loanService.js     # 借用核心服务（业务规则）
│   │   └── reportService.js   # 报告服务
│   ├── routes/
│   │   ├── parts.js           # 备件路由
│   │   ├── engineers.js       # 工程师路由
│   │   ├── workorders.js      # 工单路由
│   │   ├── loans.js           # 借用路由
│   │   └── reports.js         # 报告路由
│   └── utils/
│       ├── idempotency.js     # 幂等性中间件
│       └── audit.js           # 审计日志工具
├── scripts/
│   ├── seed.js                # 基础数据初始化
│   └── demo.js                # 完整演示脚本
├── data/                      # 数据库文件目录
├── package.json
└── README.md
```

## 技术栈

- **运行时**: Node.js
- **Web 框架**: Express.js
- **数据库**: SQLite (sql.js - 纯 JavaScript 实现，无需编译)
- **时间处理**: dayjs
- **CSV 导出**: json2csv
- **UUID 生成**: uuid

## 验证业务闭环的关键报告

不看源码也能判断业务是否闭环：

1. **未归还清单** (`GET /api/reports/unreturned`)
   - 应该能看到所有未结束的借用
   - 逾期的应该有标记
   - 工单已关闭的应该在异常状态

2. **库存变化** (`GET /api/reports/inventory-changes`)
   - 每次借用应有 stock_out
   - 每次归还应有 stock_in
   - 数量应该匹配

3. **审计轨迹** (`GET /api/reports/loan-audit/:loanId`)
   - 每个借用应该有完整的时间线
   - 人工修改必须有操作者和原因
   - 状态变化应该有 before/after

4. **系统概览** (`GET /api/reports/dashboard`)
   - 借用状态分布合理
   - 异常和逾期数量应该是重点关注对象

## 常见问题

### Q: 数据库文件在哪里？
A: 在 `data/aftersales.db`，删除这个文件就可以重置所有数据。

### Q: 如何重置演示数据？
A:
```bash
rm -rf data/
npm run seed
npm run demo
```

### Q: 幂等键会永久保存吗？
A: 目前会永久保存。生产环境可以考虑设置过期清理机制。

### Q: 支持并发吗？
A: 当前实现是单线程内存操作，适合单机部署。高并发场景建议使用 PostgreSQL/MySQL。

## License

MIT
