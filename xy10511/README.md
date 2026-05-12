# 物业设备保修管理系统 API

一个完整的物业设备保修管理系统，用于解决园区物业电梯、空调、门禁等设备保修时"保内/保外/人为损坏"的责任判定问题。

## 项目特点

- ✅ **完整业务闭环**: 资产建档 → 报修提交 → 维保派单 → 报价 → 审批 → 完工 → 评价
- ✅ **智能规则引擎**: 保内自动免审、重复报修合并、维保超时升级、报价超阈值审批
- ✅ **全链路追踪**: 每一步都有状态变化、历史记录和失败原因
- ✅ **幂等性保证**: 重复执行或重复回调保持数据一致性
- ✅ **人工修正审计**: 所有修改留下前后差异和操作者信息
- ✅ **可反复演示**: 内置完整样例数据和演示脚本

## 核心业务规则

### 1. 保内/保外自动判定
- 系统根据资产的 `warranty_end_date` 自动判定保修状态
- 保内工单：报修后自动派单并免审进入维修状态，费用由维保商承担
- 保外工单：需要维保商报价 → 物业审批 → 才能开始维修，费用由物业承担

### 2. 重复报修合并
- 24小时内同一资产的相似描述报修自动合并
- 相似度阈值：60% 以上（基于关键词匹配）
- 合并记录保留，可追溯所有报修人信息

### 3. 维保超时升级
- 默认阈值：4小时未完成自动升级
- 升级动作：优先级从 normal → high
- 记录升级历史：原因、超时时间、优先级变更

### 4. 报价审批机制
- 报价阈值：¥5,000（可配置）
- 超过阈值：需要物业经理审批
- 低于阈值：可自动批准（当前实现为标记可自动批准）

### 5. 已完工工单保护
- 工单状态为 `completed` 后，禁止修改费用
- 确保财务数据一致性和可审计性

### 6. 幂等性机制
- 通过 `callback_id` 字段实现
- 相同 `callback_id` 的重复请求返回首次结果
- 适用于所有关键操作（报修、派单、报价、审批、完工、评价）

### 7. 人工修正审计
- 人工修改费用时记录 `diff` 字段
- 包含：修改前后的金额和描述
- 记录操作人信息，便于审计追溯

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化演示数据

```bash
npm run seed
```

### 运行主演示流程

```bash
npm run demo
```

### 运行失败场景演示

```bash
npm run demo-failure
```

### 启动 API 服务

```bash
npm start
```

服务地址: http://localhost:3000

## 项目结构

```
property-maintenance-api/
├── src/
│   ├── index.js              # 应用入口
│   ├── db.js                 # 数据库初始化
│   ├── routes/
│   │   └── api.js            # API 路由
│   └── services/
│       └── maintenanceService.js  # 核心业务逻辑
├── scripts/
│   ├── seed.js               # 初始化演示数据
│   ├── demo.js               # 主演示脚本
│   └── demo-failure.js       # 失败场景演示
├── data/                     # SQLite 数据库文件 (自动创建)
├── package.json
└── README.md
```

## 数据模型

### 资产 (assets)
| 字段 | 说明 |
|------|------|
| asset_code | 资产编码（唯一） |
| name | 资产名称 |
| type | 类型：elevator/air_conditioner/access_control |
| location | 位置 |
| warranty_start_date | 保修开始日期 |
| warranty_end_date | 保修截止日期 |
| vendor_id | 指定维保商 |

### 维保商 (vendors)
| 字段 | 说明 |
|------|------|
| name | 公司名称 |
| rating | 当前评分 (1-5) |
| total_orders | 总工单数 |
| completed_orders | 已完工单数 |
| average_response_time | 平均响应时间 |

### 工单 (work_orders)
| 字段 | 说明 |
|------|------|
| order_no | 工单编号 |
| status | 状态：submitted/assigned/quoted/in_progress/completed/closed |
| warranty_status | 保内/保外：in_warranty/out_of_warranty |
| priority | 优先级：low/normal/high |
| escalated_at | 升级时间 |
| merged_orders | 合并的报修记录 (JSON) |

### 工单状态流转

```
submitted (已提交)
    ↓
assigned (已派单) ← 保内自动派单
    ↓
quoted (已报价) ← 保外需要
    ↓
in_progress (维修中) ← 保内免审直接到这
    ↓
completed (已完工)
    ↓
closed (已关闭) ← 评价后
```

## API 接口

### 健康检查
```
GET /api/health
```

### 资产管理

```
# 创建资产
POST /api/assets
{
  "asset_code": "ELEV-A01-001",
  "name": "A栋1号客梯",
  "type": "elevator",
  "location": "A栋1-20层",
  "installation_date": "2024-01-01",
  "warranty_start_date": "2024-01-01",
  "warranty_end_date": "2027-01-01",
  "manufacturer": "三菱电机",
  "model": "LEHY-III",
  "vendor_id": "uuid"
}

# 查询资产列表
GET /api/assets

# 查询单个资产
GET /api/assets/:id

# 查询资产历史
GET /api/assets/:id/history
```

### 维保商管理

```
# 创建维保商
POST /api/vendors
{
  "name": "东方电梯维保有限公司",
  "contact": "张工",
  "phone": "13800138001",
  "email": "service@company.com",
  "service_area": "A区、B区电梯设备"
}

# 查询维保商列表
GET /api/vendors

# 查询单个维保商
GET /api/vendors/:id
```

### 报修流程

```
# 提交报修
POST /api/repairs/submit
{
  "asset_id": "uuid",
  "reporter_id": "USER001",
  "reporter_name": "张先生",
  "description": "电梯运行时有异响",
  "category": "elevator",
  "priority": "high",
  "callback_id": "CB-001"  # 可选，用于幂等
}

# 派单给维保商
POST /api/repairs/:id/assign
{
  "vendor_id": "uuid",
  "actor": "物业经理-王经理",
  "callback_id": "CB-ASSIGN-001"
}

# 维保商报价
POST /api/repairs/:id/quote
{
  "vendor_id": "uuid",
  "labor_cost": 800,
  "parts_cost": 5500,
  "other_cost": 200,
  "estimated_time": 180,
  "quote_note": "需要更换按钮面板总成",
  "actor": "张工",
  "callback_id": "CB-QUOTE-001"
}

# 审批报价 - 批准
POST /api/quotes/:id/approve
{
  "actor": "物业经理-王经理",
  "callback_id": "CB-APPROVE-001"
}

# 审批报价 - 拒绝
POST /api/quotes/:id/reject
{
  "reason": "报价过高，建议重新询价",
  "actor": "物业经理-王经理",
  "callback_id": "CB-REJECT-001"
}

# 完工
POST /api/repairs/:id/complete
{
  "completion_note": "更换了曳引机轴承",
  "actual_time": 120,
  "actor": "张工",
  "callback_id": "CB-COMPLETE-001"
}

# 人工修正费用 (仅维修中状态允许)
POST /api/repairs/:id/expense
{
  "amount": 3000,
  "description": "实际更换了更贵的配件",
  "actor": "财务主管-李总",
  "callback_id": "CB-EXPENSE-001"
}

# 评价
POST /api/repairs/:id/evaluate
{
  "rating": 5,
  "response_time_rating": 5,
  "quality_rating": 5,
  "price_rating": 5,
  "comment": "响应迅速，维修专业",
  "evaluator": "张先生",
  "callback_id": "CB-EVAL-001"
}
```

### 查询接口

```
# 查询工单详情 (包含完整信息)
GET /api/repairs/:id

# 返回内容：
# - order: 工单基本信息
# - asset: 关联资产信息
# - vendor: 关联维保商
# - quotes: 报价记录
# - expenses: 费用明细
# - history: 操作历史
# - evaluation: 评价信息
# - current_responsible: 当前责任方
# - warranty_info: 保修信息

# 工单列表查询 (支持筛选)
GET /api/repairs?status=in_progress&asset_id=xxx&vendor_id=xxx&keyword=电梯

# 超时检查 (触发自动升级)
POST /api/escalation/check
```

### 报告导出

```
# 月度汇总报告
GET /api/reports/monthly_summary

# 维保商绩效报告
GET /api/reports/vendor_performance

# 资产成本分析
GET /api/reports/asset_cost_analysis

# 导出 CSV
GET /api/reports/:type/export
```

## 主要演示路径

### 路径 1: 保内维修 (自动免审)

**场景**: A栋1号客梯（保内）出现异响

**流程**:
1. 用户提交报修 → 系统自动判定保内
2. 系统自动派单给指定维保商
3. 系统自动免审，工单直接进入 `in_progress`
4. 维保商完工
5. 用户评价 → 工单关闭

**关键验证点**:
- 报修后状态直接变为 `in_progress`
- 历史记录中有 `AUTO_APPROVE` 操作
- 费用归属为 `vendor`（维保商承担）

### 路径 2: 保外报价审批

**场景**: B栋2号货梯（保外）按钮失灵

**流程**:
1. 用户提交报修 → 系统判定保外
2. 物业派单给维保商
3. 维保商报价（¥6,500，超过¥5,000阈值）
4. 系统标记需要审批
5. 物业审批通过
6. 工单进入 `in_progress`
7. 维保商完工
8. 用户评价 → 工单关闭

**关键验证点**:
- 报价超过阈值，`needs_approval` 为 `true`
- 审批前状态为 `quoted`
- 审批后状态变为 `in_progress`
- 费用归属为 `property`（物业承担）

### 路径 3: 重复报修合并

**场景**: 多个用户报修同一电梯的相似问题

**流程**:
1. 用户A报修："货梯按键没反应" → 创建新工单
2. 用户B报修："货梯按钮按不动" → 自动合并到工单1
3. 查询工单详情 → 查看合并记录

**关键验证点**:
- 第二次报修返回 `merged: true`
- 工单 `merged_orders` 字段包含所有合并记录
- 历史记录中有 `MERGE` 操作

### 路径 4: 超时升级

**场景**: 工单超过4小时未完成

**流程**:
1. 创建并派单工单
2. 模拟工单创建时间为5小时前
3. 调用超时检查接口
4. 查询工单详情

**关键验证点**:
- `priority` 从 `normal` 变为 `high`
- `escalated_at` 有值
- 历史记录中有 `ESCALATE` 操作
- 历史详情包含超时原因和时间

### 路径 5: 人工修正费用

**场景**: 实际维修费用与报价有差异

**流程**:
1. 正常创建工单、报价、审批
2. 在 `in_progress` 状态下修改费用
3. 查询历史记录

**关键验证点**:
- `diff` 字段记录前后差异
- 历史记录中有 `CORRECT_EXPENSE` 操作
- 记录操作人信息

## 失败路径演示

### 场景 1: 状态流转错误

**操作**: 在 `submitted` 状态直接调用完工接口

**预期结果**:
- 返回错误代码 `INVALID_STATUS`
- 错误信息："当前状态 submitted 不允许完工"

### 场景 2: 已完工工单修改费用

**操作**: 在 `completed` 状态下调用费用修改接口

**预期结果**:
- 返回错误代码 `ORDER_COMPLETED`
- 错误信息："工单已完工，不能修改费用"

### 场景 3: 重复审批报价

**操作**: 使用相同 `callback_id` 多次调用审批接口

**预期结果**:
- 第一次：正常执行
- 第二次：返回 `idempotent: true`
- 第三次（无 callback_id）：返回 `ALREADY_PROCESSED`

### 场景 4: 不存在的资产报修

**操作**: 使用不存在的 asset_id 提交报修

**预期结果**:
- 返回错误代码 `ASSET_NOT_FOUND`
- 错误信息："资产不存在"

## 演示脚本使用说明

### 初始化数据
```bash
npm run seed
```

创建：
- 3个维保商（电梯、空调、门禁各一个）
- 4个资产（2个保内，2个保外）

### 主演示
```bash
npm run demo
```

演示：
1. 保内维修流程（自动免审）
2. 保外报价审批流程
3. 重复报修合并
4. 幂等性验证
5. 报告生成
6. 资产历史查询

### 失败场景演示
```bash
npm run demo-failure
```

演示：
1. 状态流转错误
2. 已完工工单费用保护
3. 幂等机制拦截重复操作
4. 超时自动升级
5. 人工修正费用差异追踪

## 系统配置

配置存储在 `system_configs` 表中：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| quote_threshold | 5000 | 报价审批阈值（元） |
| escalation_hours | 4 | 超时升级阈值（小时） |
| response_sla_hours | 2 | 响应SLA时间（小时） |
| merge_same_asset_hours | 24 | 重复报修合并时间窗口（小时） |

## 审计追踪

所有操作记录在 `order_history` 表中，包含：

- `action`: 操作类型 (SUBMIT, ASSIGN, QUOTE, APPROVE, COMPLETE, EVALUATE, MERGE, ESCALATE, CORRECT_EXPENSE 等)
- `old_status` / `new_status`: 状态变化
- `actor`: 操作人
- `actor_role`: 操作人角色
- `details`: 详细信息 (JSON)
- `diff`: 前后差异 (JSON，仅人工修改时有)
- `created_at`: 操作时间

## 责任判定示例

### 如何判断费用归属？

查询工单详情，查看：
1. `warranty_info.in_warranty`: `true` = 维保商承担，`false` = 物业承担
2. `expenses[].payer`: 明确记录 `vendor` 或 `property`

### 如何判断当前责任方？

查询工单详情，查看 `current_responsible`：
- `submitted`: 物业经理待派单
- `assigned`: 维保商待响应
- `quoted`: 物业经理待审批报价
- `in_progress`: 维保商维修中
- `completed`: 用户待评价
- `closed`: 无责任方

### 如何判断是否超时？

查询工单详情，查看：
1. `order.escalated_at`: 有值表示已升级
2. `order.priority`: `high` 表示高优先级
3. `history` 中是否有 `ESCALATE` 记录

## 维保商质量评估

查询 `/api/reports/vendor_performance` 查看：
- `total_orders`: 总工单数
- `completed_orders`: 已完工单数
- `completion_rate`: 完成率 (%)
- `current_rating`: 当前评分 (1-5)
- `average_rating`: 平均评分

## 注意事项

1. 数据库使用 SQLite，存储在 `data/maintenance.db`
2. 每次重新初始化数据前，建议删除 `data` 目录
3. 演示脚本可重复运行，但建议先清理数据
4. API 服务启动后，可通过 curl 或 Postman 手动测试

## 清理数据

```bash
rm -rf data/
npm run seed
```

## 测试建议

1. **首次运行**: `npm run seed` → `npm run demo`
2. **理解业务**: 查看 `src/services/maintenanceService.js` 中的注释
3. **接口测试**: 启动服务后，使用 curl 测试各 API
4. **异常场景**: 运行 `npm run demo-failure`
5. **数据验证**: 查看 `order_history` 表确认所有操作有记录
