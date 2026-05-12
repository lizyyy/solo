# 售楼认购锁房API

房源、定金、改名、退定、渠道佣金状态一致管理系统

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化演示数据

```bash
npm run seed
```

### 3. 启动服务

```bash
npm start
```

服务地址: http://localhost:3000

### 4. 运行演示

**方式一：交互式 curl 演示（推荐）**
```bash
chmod +x scripts/demo-curls.sh
./scripts/demo-curls.sh
```

**方式二：自动化测试**
```bash
npm test
```

## API 接口列表

### 基础信息
- `GET /` - API 信息
- `GET /health` - 健康检查

### 楼盘项目
- `GET /api/projects` - 项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id` - 项目详情

### 房源管理
- `GET /api/properties` - 房源列表 (支持 project_id, status 过滤)
- `POST /api/properties` - 创建房源
- `GET /api/properties/:id` - 房源详情
- `GET /api/properties/:id/timeline` - 房源时间线
- `GET /api/properties/:id/history` - 历史记录

### 渠道管理
- `GET /api/channels` - 渠道列表
- `POST /api/channels` - 创建渠道
- `GET /api/channels/:id` - 渠道详情

### 客户管理
- `GET /api/customers` - 客户列表
- `POST /api/customers` - 创建客户
- `GET /api/customers/:id` - 客户详情
- `GET /api/customers/:id/bookings` - 客户认购单
- `POST /api/customers/:id/correct` - 人工修正客户信息

### 认购锁房
- `GET /api/bookings` - 认购单列表
- `POST /api/bookings` - 创建认购单
- `GET /api/bookings/:id` - 认购单详情
- `GET /api/bookings/:id/detail` - 认购单详情（含所有关联）
- `POST /api/bookings/:id/lock` - 锁定房源
- `POST /api/bookings/:id/correct` - 人工修正认购单

### 定金管理
- `GET /api/deposits` - 定金账本（含汇总）
- `POST /api/deposits` - 创建定金单
- `GET /api/deposits/:id` - 定金单详情
- `POST /api/deposits/callback` - 支付回调（支持幂等）
- `GET /api/deposits/can-sign/:booking_id` - 检查是否可签约

### 改名审批
- `GET /api/name-changes` - 改名申请列表
- `POST /api/name-changes` - 创建改名申请
- `GET /api/name-changes/changes` - 客户变更记录
- `GET /api/name-changes/:id` - 改名申请详情
- `POST /api/name-changes/:id/submit` - 提交审批
- `POST /api/name-changes/:id/approve` - 审批通过
- `POST /api/name-changes/:id/reject` - 审批驳回

### 退定管理
- `GET /api/refunds` - 退定申请列表
- `POST /api/refunds` - 创建退定申请
- `GET /api/refunds/:id` - 退定申请详情
- `POST /api/refunds/:id/submit` - 提交审批
- `POST /api/refunds/:id/approve` - 审批通过
- `POST /api/refunds/:id/reject` - 审批驳回
- `POST /api/refunds/:id/execute` - 执行退款

### 佣金管理
- `GET /api/commissions` - 佣金报告（含汇总）
- `POST /api/commissions` - 创建佣金
- `GET /api/commissions/:id` - 佣金详情
- `POST /api/commissions/:id/approve` - 审批通过
- `POST /api/commissions/:id/freeze` - 冻结佣金
- `POST /api/commissions/:id/unfreeze` - 解冻佣金
- `POST /api/commissions/:id/void` - 作废佣金
- `POST /api/commissions/:id/settle` - 结算佣金

### 报告导出
- `GET /api/reports/dashboard` - 仪表盘
- `GET /api/reports/property-timeline/:property_id` - 房源时间线报告
- `GET /api/reports/deposit-ledger` - 定金账本
- `GET /api/reports/customer-changes` - 客户变更报告
- `GET /api/reports/commission-report` - 佣金报告
- `GET /api/reports/full` - 完整报告 (JSON)
- `GET /api/reports/export?format=text` - 导出报告 (文本格式)

## 业务场景演示

### 场景一：正常认购流程

1. **创建认购单**
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "<房源ID>",
    "customer_id": "<客户ID>",
    "channel_id": "<渠道ID>",
    "total_price": 3500000,
    "booking_amount": 50000,
    "deposit_amount": 200000,
    "created_by": "销售专员A"
  }'
```

2. **锁定房源**
```bash
curl -X POST http://localhost:3000/api/bookings/<认购单ID>/lock \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员A"}'
```

3. **创建定金单**
```bash
curl -X POST http://localhost:3000/api/deposits \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<认购单ID>",
    "amount": 200000,
    "payment_method": "bank_transfer",
    "created_by": "财务A"
  }'
```

4. **支付回调**
```bash
curl -X POST http://localhost:3000/api/deposits/callback \
  -H "Content-Type: application/json" \
  -d '{
    "callback_id": "CB-001",
    "deposit_id": "<定金单ID>",
    "success": true,
    "transaction_no": "TXN-001",
    "operator": "payment_gateway"
  }'
```

5. **创建佣金**
```bash
curl -X POST http://localhost:3000/api/commissions \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<认购单ID>",
    "operator": "佣金专员"
  }'
```

### 场景二：改名审批流程

1. **创建改名申请**
```bash
curl -X POST http://localhost:3000/api/name-changes \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<认购单ID>",
    "old_customer_id": "<原客户ID>",
    "new_customer_id": "<新客户ID>",
    "reason": "客户改名原因",
    "created_by": "销售专员"
  }'
```

2. **提交审批**
```bash
curl -X POST http://localhost:3000/api/name-changes/<申请ID>/submit \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员"}'
```

3. **审批通过**
```bash
curl -X POST http://localhost:3000/api/name-changes/<申请ID>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approval_notes": "审批通过",
    "operator": "审批主管"
  }'
```

### 场景三：退定解锁流程

1. **创建退定申请**
```bash
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<认购单ID>",
    "amount": 200000,
    "reason": "客户退定原因",
    "created_by": "销售专员"
  }'
```

2. **执行退款**
```bash
curl -X POST http://localhost:3000/api/refunds/<申请ID>/submit \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员"}'

curl -X POST http://localhost:3000/api/refunds/<申请ID>/approve \
  -H "Content-Type: application/json" \
  -d '{"operator": "财务主管"}'

curl -X POST http://localhost:3000/api/refunds/<申请ID>/execute \
  -H "Content-Type: application/json" \
  -d '{
    "refund_method": "bank_transfer",
    "transaction_no": "RF-001",
    "operator": "财务A"
  }'
```

## 业务规则

### 1. 房源状态流转
```
available → locked → deposited → sold
    ↑                             ↓
    └────────── refunded ────────┘
```

### 2. 认购单状态流转
```
draft → locked → deposited → signed
                    ↓
               refunding → refunded
```

### 3. 关键规则
- **重复锁房拦截**：房源已锁定后，无法再次创建认购单
- **定金未到账不能转认购**：支付成功回调后才转为 deposited
- **改名审批**：需提交 → 审批通过 → 执行改名
- **退定后佣金失效**：退定执行后，佣金自动作废
- **支付回调幂等**：相同 callback_id 重复调用不重复处理
- **人工修正留痕**：所有人工修改记录前后差异和操作者

### 4. 改名后同步
- 认购单客户变更
- 佣金自动冻结（待重新确认）

### 5. 退定后同步
- 房源解锁 (available)
- 认购单状态变为 refunded
- 定金单状态变为 refunded
- 佣金自动作废 (void)

## 数据模型

### 核心实体
- **projects** - 楼盘项目
- **properties** - 房源 (含状态和当前认购单关联)
- **channels** - 渠道 (含佣金率)
- **customers** - 客户 (关联渠道)
- **bookings** - 认购单 (核心实体)
- **deposits** - 定金单 (支持回调幂等)
- **name_change_applications** - 改名申请
- **refunds** - 退定申请
- **commissions** - 佣金记录

### 审计表
- **status_history** - 所有实体的状态变更历史
- **manual_corrections** - 人工修正记录（含前后差异）

## 预置演示数据

运行 `npm run seed` 后自动创建：

### 楼盘
- **锦绣花园** (PRJ-001) - 北京市

### 房源 (6套)
| 房源编码 | 房号 | 面积 | 总价 |
|---------|------|------|------|
| PROP-A101 | 1-1-101 | 95.5㎡ | ¥3,500,000 |
| PROP-A102 | 1-1-102 | 89.3㎡ | ¥3,200,000 |
| PROP-A201 | 1-1-201 | 95.5㎡ | ¥3,600,000 |
| PROP-A301 | 1-1-301 | 120.8㎡ | ¥4,500,000 |
| PROP-B101 | 2-2-101 | 110.2㎡ | ¥4,000,000 |
| PROP-B201 | 2-2-201 | 110.2㎡ | ¥4,100,000 |

### 渠道
- **链家房产** (CHN-001) - 佣金率 2.5%
- **我爱我家** (CHN-002) - 佣金率 3%

### 客户
- **王小明** (CUS-001) - 13900139001
- **李小红** (CUS-002) - 13900139002
- **王大明** (CUS-003) - 13900139003
- **张伟** (CUS-004) - 13900139004

## 演示路径

### 正常路径
1. 王小明认购 PROP-A101 → 锁定 → 支付定金20万 → 生成佣金8.75万 → 改名给李小红 → 佣金冻结
2. 王小明认购 PROP-A102 → 锁定 → 支付定金15万 → 生成佣金8万 → 申请退定 → 房源解锁 → 定金退还 → 佣金作废

### 失败路径
1. 认购 PROP-A201 → 锁定 → 不支付定金 → 尝试创建佣金 → 失败（定金未到账）
2. 支付失败回调 → 认购单保持锁定状态

## 报告查看

演示完成后，访问以下接口查看业务闭环：

```bash
# 仪表盘
curl http://localhost:3000/api/reports/dashboard

# 房源时间线 (PROP-A101)
curl http://localhost:3000/api/properties/<PROP-A101_ID>/timeline

# 定金账本
curl http://localhost:3000/api/deposits

# 客户变更
curl http://localhost:3000/api/name-changes/changes

# 渠道佣金
curl http://localhost:3000/api/commissions

# 完整报告 (文本格式，适合直接查看)
curl http://localhost:3000/api/reports/export?format=text
```

## 技术栈

- **运行时**: Node.js
- **Web框架**: Express
- **数据库**: SQLite (better-sqlite3)
- **工具库**: uuid, dayjs

## 目录结构

```
.
├── data/                    # SQLite 数据库文件
├── src/
│   ├── server.js           # 服务入口
│   ├── database.js         # 数据库连接
│   ├── schema.js           # 数据库Schema
│   ├── utils.js            # 工具函数
│   ├── services/           # 业务逻辑层
│   │   ├── propertyService.js
│   │   ├── customerService.js
│   │   ├── bookingService.js
│   │   ├── depositService.js
│   │   ├── nameChangeService.js
│   │   ├── refundService.js
│   │   ├── commissionService.js
│   │   └── reportService.js
│   └── routes/             # API路由层
│       ├── projects.js
│       ├── properties.js
│       ├── channels.js
│       ├── customers.js
│       ├── bookings.js
│       ├── deposits.js
│       ├── name-changes.js
│       ├── refunds.js
│       ├── commissions.js
│       └── reports.js
├── scripts/
│   ├── demo-curls.sh       # 交互式curl演示
│   └── test-api.js         # 自动化测试
├── src/seed.js             # 演示数据初始化
└── package.json
```
