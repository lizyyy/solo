# 仓储计费阶梯 API

第三方仓储按体积、库龄、温区和操作次数阶梯计费系统，提供可解释的账单展开、完整的审计追踪和客户对账单。

## 📋 目录

- [快速开始](#快速开始)
- [业务规则](#业务规则)
- [API 接口](#api-接口)
- [演示场景](#演示场景)
- [数据模型](#数据模型)

---

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10585
npm install
```

### 运行演示脚本（推荐首次体验）

```bash
npm run demo
```

演示脚本会完整展示所有业务场景，包括：
- 正常计费流程
- 库龄阶梯加价
- 冷链费率差异
- 重复操作幂等性
- 调账流程
- 状态流转
- 失败路径验证

### 启动 API 服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 初始化样例数据

启动服务后，调用接口加载样例数据：

```bash
curl -X POST http://localhost:3000/api/sample-data/load
```

### 健康检查

```bash
curl http://localhost:3000/health
```

---

## 📦 业务规则

### 1. 库龄阶梯费率

库存根据入库天数应用不同的费率乘数：

| 阶梯名称 | 天数范围 | 费率乘数 | 说明 |
|---------|---------|---------|------|
| 0-30天 | 0-30天 | 1.0x | 标准费率 |
| 31-60天 | 31-60天 | 1.2x | 超库龄加价20% |
| 61-90天 | 61-90天 | 1.5x | 超库龄加价50% |
| 90天以上 | 91天+ | 2.0x | 超库龄加价100% |

**跨月处理**：每月独立计算，入库日期跨越多个库龄阶梯时，按天分别计算归属。

### 2. 温区费率差异

不同温区应用不同的基础费率（冷链高于常温）：

| 温区 | 仓储费(元/立方/天) | 入库操作费(元/次) | 出库操作费(元/次) | 相对倍数 |
|-----|------------------|-----------------|-----------------|---------|
| 常温区 | 2.00 | 15.00 | 20.00 | 1.0x |
| 冷藏区 | 5.00 | 25.00 | 35.00 | 2.5x |
| 冷冻区 | 8.00 | 40.00 | 55.00 | 4.0x |

### 3. 操作次数阶梯折扣

根据月度操作次数应用不同折扣：

| 阶梯名称 | 次数范围 | 折扣率 | 说明 |
|---------|---------|--------|------|
| 0-50次 | 0-50 | 0% | 标准费率 |
| 51-200次 | 51-200 | 5% | 95折 |
| 201-500次 | 201-500 | 10% | 9折 |
| 500次以上 | 501+ | 15% | 85折 |

### 4. 账单状态流转

```
DRAFT(草稿) 
  ↓ 
PROCESSING(处理中) 
  ↓
PENDING_CONFIRM(待确认) 
  ↓
CONFIRMED(已确认) ← 终态，不可修改
```

状态转换规则：
- DRAFT → PROCESSING / CANCELLED
- PROCESSING → PENDING_CONFIRM / ERROR
- PENDING_CONFIRM → CONFIRMED / DRAFT
- CONFIRMED → 不可转换
- ERROR → DRAFT

### 5. 幂等性规则

- 所有写操作必须提供 `idempotent_key`
- 重复请求返回首次执行结果
- 账单生成自动使用 `BILL-{customer_id}-{period_start}-{period_end}` 作为幂等键

### 6. 调账规则

- 已确认账单不可调账，需先冲销
- 调账必须记录：调账前金额、调账后金额、操作人、原因
- 调账记录追加到账单明细中

---

## 🔌 API 接口

### 配置查询接口

#### 1. 查询温区配置
```bash
GET /api/config/zones
```

#### 2. 查询库龄阶梯
```bash
GET /api/config/age-ladders
```

#### 3. 查询操作阶梯
```bash
GET /api/config/operation-ladders
```

#### 4. 查询温区费率
```bash
GET /api/config/zone-rates
```

#### 5. 查询客户列表
```bash
GET /api/customers
```

---

### 操作记录接口

#### 1. 提交入库/出库操作
```bash
POST /api/operations
Content-Type: application/json

{
  "idempotent_key": "OP-202405-00001",
  "customer_id": "CUST001",
  "operation_type": "IN",
  "zone_id": "zone-uuid",
  "product_sku": "SKU-001",
  "volume_cbm": 2.5,
  "operation_date": "2024-05-15",
  "source_system": "WMS",
  "source_id": "WMS-12345"
}
```

#### 2. 处理操作记录
```bash
POST /api/operations/:id/process
Content-Type: application/json

{
  "operator": "system"
}
```

#### 3. 查询操作记录
```bash
GET /api/operations?customer_id=CUST001&status=PROCESSED
```

---

### 账单管理接口

#### 1. 生成账单
```bash
POST /api/bills
Content-Type: application/json

{
  "customer_id": "CUST001",
  "period_start": "2024-05-01",
  "period_end": "2024-05-31",
  "operator": "billing_user"
}
```

#### 2. 查询账单列表
```bash
GET /api/bills?customer_id=CUST001&status=DRAFT
```

#### 3. 查询账单详情
```bash
GET /api/bills/:id
```

返回包含：
- 账单基本信息
- 费用明细（line_items）
- 库龄明细（age_details）
- 状态流转历史（status_history）
- 调账历史（adjustments）

#### 4. 推进账单状态
```bash
POST /api/bills/:id/advance
Content-Type: application/json

{
  "target_status": "PROCESSING",
  "operator": "settlement_specialist",
  "reason": "账单数据校验完成"
}
```

#### 5. 调账
```bash
POST /api/bills/:id/adjust
Content-Type: application/json

{
  "adjusted_by": "财务经理-张三",
  "adjustment_type": "DISCOUNT",
  "amount": -500.00,
  "reason": "客户投诉库龄计算有误，经核实给予减免"
}
```

#### 6. 导出账单
```bash
GET /api/bills/:id/export?format=csv
```

支持格式：`json` (默认), `csv`

#### 7. 查询库龄明细
```bash
GET /api/bills/:id/age-details?product_sku=SKU-001
```

返回按库龄阶梯分组的汇总和每日明细。

---

## 🎬 演示场景

### 场景一：正常计费流程
**路径**：创建操作 → 处理操作 → 生成账单 → 查看明细

**预期结果**：
- 仓储费按体积 × 天数 × 费率计算
- 操作费按次数 × 单价计算
- 自动应用操作阶梯折扣

### 场景二：库龄阶梯加价
**数据**：5个SKU，库龄分别为15天、45天、10天、100天、15天

**预期结果**：
- 15天：1.0x 标准费率
- 45天：1.2x 加价20%
- 100天：2.0x 加价100%
- 库龄明细按天展开，可追溯

### 场景三：冷链费率差异
**温区**：常温、冷藏、冷冻

**预期结果**：
- 冷藏费率 = 2.5 × 常温费率
- 冷冻费率 = 4.0 × 常温费率
- 账单明细中按温区分组展示

### 场景四：重复操作幂等性
**操作**：使用相同 `idempotent_key` 提交两次

**预期结果**：
- 第一次：创建新记录
- 第二次：返回已有结果，标记 `idempotent: true`

### 场景五：调账流程
**操作**：客户投诉 → 核实 → 调账减免

**预期结果**：
- 记录调账前后金额
- 记录操作人、时间、原因
- 调账金额追加到账单

### 场景六：失败路径（已确认账单保护）
**操作**：尝试修改已确认账单

**预期结果**：
- 状态回滚：失败，提示"已确认账单不可修改状态"
- 调账：失败，提示"已确认账单不可调账"
- 重新生成：失败，提示"账单已确认，不可重新生成"

---

## 🔧 主要演示路径（API 调用顺序）

### 路径 A：完整计费流程（成功路径）

```bash
# 1. 加载样例数据
curl -X POST http://localhost:3000/api/sample-data/load

# 2. 查看客户列表
curl http://localhost:3000/api/customers

# 3. 查看温区费率
curl http://localhost:3000/api/config/zone-rates

# 4. 生成账单（替换日期为当前月）
curl -X POST http://localhost:3000/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "period_start": "2026-05-01",
    "period_end": "2026-05-31",
    "operator": "demo"
  }'

# 5. 查看账单详情（使用返回的 bill_id）
curl http://localhost:3000/api/bills/{bill_id}

# 6. 查看库龄明细
curl http://localhost:3000/api/bills/{bill_id}/age-details

# 7. 推进状态到 PROCESSING
curl -X POST http://localhost:3000/api/bills/{bill_id}/advance \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "PROCESSING",
    "operator": "结算专员",
    "reason": "账单数据校验完成"
  }'

# 8. 推进状态到 PENDING_CONFIRM
curl -X POST http://localhost:3000/api/bills/{bill_id}/advance \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "PENDING_CONFIRM",
    "operator": "结算主管",
    "reason": "费用计算复核通过"
  }'

# 9. 调账（可选）
curl -X POST http://localhost:3000/api/bills/{bill_id}/adjust \
  -H "Content-Type: application/json" \
  -d '{
    "adjusted_by": "财务经理",
    "adjustment_type": "DISCOUNT",
    "amount": -500.00,
    "reason": "客户投诉减免"
  }'

# 10. 确认账单
curl -X POST http://localhost:3000/api/bills/{bill_id}/advance \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "CONFIRMED",
    "operator": "客户-张经理",
    "reason": "客户确认无误"
  }'

# 11. 导出CSV
curl http://localhost:3000/api/bills/{bill_id}/export?format=csv -o bill.csv
```

### 路径 B：失败路径演示

```bash
# 1. 先生成并确认一个账单（参考路径 A 步骤 1-10）

# 2. 尝试修改已确认账单状态（应该失败）
curl -X POST http://localhost:3000/api/bills/{confirmed_bill_id}/advance \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "DRAFT",
    "operator": "测试用户",
    "reason": "尝试回滚"
  }'

# 3. 尝试对已确认账单调账（应该失败）
curl -X POST http://localhost:3000/api/bills/{confirmed_bill_id}/adjust \
  -H "Content-Type: application/json" \
  -d '{
    "adjusted_by": "测试用户",
    "adjustment_type": "DISCOUNT",
    "amount": -100.00,
    "reason": "测试调账"
  }'

# 4. 尝试重新生成已确认账单（应该失败）
curl -X POST http://localhost:3000/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "period_start": "2026-05-01",
    "period_end": "2026-05-31",
    "operator": "test"
  }'
```

### 路径 C：幂等性演示

```bash
# 1. 首次提交操作
curl -X POST http://localhost:3000/api/operations \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "DEMO-IDEMPOTENT-001",
    "customer_id": "CUST001",
    "operation_type": "IN",
    "zone_id": "replace-with-actual-zone-id",
    "product_sku": "SKU-TEST-001",
    "volume_cbm": 1.0,
    "operation_date": "2026-05-15",
    "source_system": "DEMO",
    "source_id": "DEMO-001"
  }'

# 2. 重复提交（返回 idempotent: true）
curl -X POST http://localhost:3000/api/operations \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "DEMO-IDEMPOTENT-001",
    "customer_id": "CUST001",
    "operation_type": "IN",
    "zone_id": "replace-with-actual-zone-id",
    "product_sku": "SKU-TEST-001",
    "volume_cbm": 1.0,
    "operation_date": "2026-05-15",
    "source_system": "DEMO",
    "source_id": "DEMO-001"
  }'
```

---

## 📊 数据模型

### 核心实体

1. **customers** - 客户信息
2. **temperature_zones** - 温区配置（常温/冷藏/冷冻）
3. **zone_rates** - 温区费率（支持客户特定费率）
4. **age_ladders** - 库龄阶梯配置
5. **operation_ladders** - 操作次数阶梯配置
6. **inventory_snapshots** - 库存快照（用于仓储费计算）
7. **operations** - 入库/出库操作记录
8. **bills** - 账单主表
9. **bill_line_items** - 账单明细项目
10. **bill_age_details** - 库龄每日明细（可解释性）
11. **bill_status_history** - 状态流转历史
12. **adjustments** - 调账记录
13. **idempotent_records** - 幂等记录

### 关键审计字段

所有状态变更和调账都记录：
- 操作时间（created_at）
- 操作人（changed_by / adjusted_by）
- 变更原因（reason）
- 前后差异（before_amount / after_amount）

---

## 📝 账单可解释性

每个账单都提供三级明细：

### 第一级：汇总金额
```
仓储费: ¥XXXX.XX
入库操作费: ¥XXXX.XX  
出库操作费: ¥XXXX.XX
调账: ¥XXXX.XX
总计: ¥XXXX.XX
```

### 第二级：费用项目（line_items）
- 按温区 + 阶梯分组的仓储费
- 按SKU分组的操作费
- 调账项目

### 第三级：库龄明细（age_details）
- 每日的库龄计算
- 归属的库龄阶梯
- 应用的费率乘数
- 每日费用

---

## 🛡️ 安全约束

1. **已确认账单保护**：CONFIRMED 状态的账单不可修改
2. **调账审计**：所有调账必须记录原因和操作人
3. **幂等保护**：防止重复计费和重复操作
4. **状态流转校验**：只允许合法的状态转换
5. **费率生效日期**：支持历史费率查询，不会因费率变更影响历史账单

---

## 📈 计费公式

### 仓储费
```
每日仓储费 = 体积(CBM) × 基础费率 × 库龄乘数
月度仓储费 = Σ(每日仓储费)
```

### 操作费
```
入库操作费 = 入库次数 × 入库单价 × 操作折扣率
出库操作费 = 出库次数 × 出库单价 × 操作折扣率
```

### 调账后总金额
```
总金额 = 仓储费 + 入库操作费 + 出库操作费 + 调账金额
```

---

## 🔍 客户质疑点响应

当客户质疑账单时，可以提供：

1. **库龄阶梯质疑**：`GET /api/bills/:id/age-details` 展示每日库龄和费率应用
2. **冷链费率质疑**：展示温区费率配置和按温区汇总
3. **操作费质疑**：`GET /api/operations?customer_id=xxx` 列出所有操作记录
4. **调账质疑**：`adjustments` 表记录完整的调账历史
5. **状态变更质疑**：`bill_status_history` 记录每一步变更

---

## 📂 项目结构

```
.
├── src/
│   ├── server.js          # Express API 服务器
│   ├── database.js        # 数据库初始化和配置
│   ├── billing-engine.js  # 核心计费引擎
│   ├── sample-data.js     # 样例数据生成
│   └── demo.js            # 演示脚本
├── package.json           # 项目配置
├── README.md              # 本文档
└── billing.db             # SQLite 数据库（运行时生成）
```

---

## 🎯 验证业务闭环

通过以下步骤验证业务是否真正闭环：

### 1. 费用拆分验证
- [ ] 仓储费按温区和库龄阶梯分别计算
- [ ] 操作费按入库/出库分别统计
- [ ] 操作阶梯折扣正确应用

### 2. 库龄明细验证
- [ ] 每个SKU的每日库龄可追溯
- [ ] 库龄阶梯边界正确（30天、60天、90天）
- [ ] 跨月库存正确分段计算

### 3. 调账历史验证
- [ ] 调账前后金额差异清晰
- [ ] 操作人、时间、原因完整记录
- [ ] 调账项目追加到账单明细

### 4. 客户对账单验证
- [ ] 总金额 = 仓储费 + 操作费 + 调账
- [ ] 状态流转历史完整
- [ ] 可导出为 CSV 格式

### 5. 失败路径验证
- [ ] 已确认账单不可修改
- [ ] 重复操作幂等返回
- [ ] 无效状态转换被拒绝

运行 `npm run demo` 可以一次性验证所有上述场景。
