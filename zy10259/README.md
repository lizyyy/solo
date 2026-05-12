# 设备租赁延期 API

## 项目简介

展会客户多租2天场景下的设备租赁管理系统，解决仓库与财务信息不同步问题，支持设备档案、租赁下单、出库、延期、换机、归还、押金扣减和账单查询等全流程管理。

## 核心特性

- ✅ **库存锁定机制** - 下单即锁定设备，避免超售
- ✅ **延期冲突检测** - 自动检测延期时段与其他订单的冲突
- ✅ **换机自动释放** - 换机后自动释放原设备的锁定
- ✅ **归还后禁止延期** - 设备归还后无法再申请延期
- ✅ **押金管理** - 支持支付、扣减、退款，避免重复扣除
- ✅ **幂等性保障** - 通过 `X-Idempotency-Key` 防止重复提交
- ✅ **账单自动生成** - 延期、损坏等费用自动生成账单

## 技术栈

- Node.js + Express
- SQLite3 (嵌入式数据库)
- 原生 JavaScript (无需编译)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 运行完整流程演示

```bash
# 先启动服务，然后在另一个终端执行:
npm run demo
```

演示脚本将自动执行完整流程：
1. 创建设备档案
2. 创建租赁订单 (含库存锁定)
3. 支付押金
4. 设备出库
5. 延期申请 (计算延期费用)
6. 审批延期 (更新订单)
7. 换机流程 (释放旧设备)
8. 延期冲突检测测试
9. 设备归还
10. 押金扣减
11. 账单查询
12. 幂等性验证

## API 接口文档

### 健康检查

```
GET /health
```

### 设备管理

```
POST   /api/equipment          # 创建设备 (需要 X-Idempotency-Key)
GET    /api/equipment/:id      # 查询单个设备
GET    /api/equipment          # 设备列表 (支持 status 查询参数)
```

### 订单管理

```
POST   /api/orders             # 创建订单 (需要 X-Idempotency-Key)
GET    /api/orders/:id         # 查询订单详情
GET    /api/orders             # 订单列表
```

### 延期管理

```
POST   /api/extensions          # 创建延期申请 (需要 X-Idempotency-Key)
POST   /api/extensions/:id/approve  # 审批延期
GET    /api/extensions/order/:orderId  # 查询订单延期记录
```

### 出库管理

```
POST   /api/outbounds           # 创建出库单 (需要 X-Idempotency-Key)
POST   /api/outbounds/:id/confirm  # 确认出库
GET    /api/outbounds/:id       # 查询出库单
```

### 换机管理

```
POST   /api/exchanges           # 创建换机申请 (需要 X-Idempotency-Key)
POST   /api/exchanges/:id/confirm  # 确认换机
GET    /api/exchanges/order/:orderId  # 查询订单换机记录
```

### 归还管理

```
POST   /api/returns             # 创建归还单 (需要 X-Idempotency-Key)
POST   /api/returns/:id/confirm   # 确认归还 (支持 damage_fee)
GET    /api/returns/:id         # 查询归还单
```

### 押金管理

```
POST   /api/deposits/pay        # 支付押金 (需要 X-Idempotency-Key)
POST   /api/deposits/deduct     # 押金扣减 (需要 X-Idempotency-Key)
POST   /api/deposits/refund     # 押金退款 (需要 X-Idempotency-Key)
GET    /api/deposits/order/:orderId  # 查询押金交易记录
```

### 账单管理

```
GET    /api/bills/order/:orderId  # 查询订单账单
POST   /api/bills/:id/pay         # 支付账单
GET    /api/bills                  # 账单列表
```

## 幂等性使用说明

所有 POST 接口支持幂等性，调用时需在请求头中携带：

```
X-Idempotency-Key: <唯一键>
```

- 相同的幂等键 + 相同的请求内容 = 返回相同的结果，不会重复执行
- 相同的幂等键 + 不同的请求内容 = 返回 409 冲突
- 幂等键有效期 24 小时

## 数据模型

### 核心表结构

1. **equipment** - 设备档案表
2. **rental_orders** - 租赁订单表
3. **order_items** - 订单项表
4. **stock_locks** - 库存锁定表
5. **outbounds** - 出库单表
6. **extensions** - 延期记录表
7. **exchanges** - 换机记录表
8. **returns** - 归还单表
9. **deposit_transactions** - 押金交易表
10. **bills** - 账单表
11. **idempotency_keys** - 幂等键表

## 业务规则说明

### 延期规则
- 只有租赁中（rented）状态的订单才能申请延期
- 新结束日期必须晚于原结束日期
- 延期时段不能与该设备的其他订单冲突
- 已归还的设备不能申请延期
- 延期费用自动按日租金计算

### 换机规则
- 只有租赁中（rented）状态的订单才能换机
- 换机后原设备自动释放锁定
- 新设备必须是可用状态
- 换机后订单项自动更新为新设备

### 押金规则
- 押金支付后才能进行出库
- 押金扣减需检查余额是否充足
- 扣减金额自动生成损坏赔偿账单

## 目录结构

```
equipment-rental-api/
├── src/
│   ├── app.js                 # 应用入口
│   ├── models/                # 数据模型
│   │   └── database.js
│   ├── controllers/           # 控制器
│   │   ├── equipmentController.js
│   │   ├── orderController.js
│   │   ├── extensionController.js
│   │   ├── outboundController.js
│   │   ├── exchangeController.js
│   │   ├── returnController.js
│   │   ├── depositController.js
│   │   └── billController.js
│   ├── services/              # 业务逻辑层
│   │   ├── equipmentService.js
│   │   ├── orderService.js
│   │   ├── extensionService.js
│   │   ├── outboundService.js
│   │   ├── exchangeService.js
│   │   ├── returnService.js
│   │   ├── depositService.js
│   │   └── billService.js
│   ├── routes/                # 路由
│   │   ├── equipment.js
│   │   ├── orders.js
│   │   ├── extensions.js
│   │   ├── outbounds.js
│   │   ├── exchanges.js
│   │   ├── returns.js
│   │   ├── deposits.js
│   │   └── bills.js
│   ├── middleware/            # 中间件
│   │   └── idempotency.js
│   └── utils/                 # 工具函数
│       └── helpers.js
├── demo/
│   └── complete-flow.js       # 完整流程演示脚本
├── database/                  # SQLite 数据库文件 (运行时生成)
├── package.json
├── .env
└── README.md
```

## 调用示例

### 1. 创建设备

```bash
curl -X POST http://localhost:3000/api/equipment \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: key-001" \
  -d '{
    "equipment_code": "PROJ-001",
    "name": "高清投影仪",
    "category": "显示设备",
    "spec": "4K 3000流明",
    "daily_rate": 200,
    "deposit_amount": 1000,
    "warehouse": "A仓"
  }'
```

### 2. 创建订单

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: key-002" \
  -d '{
    "customer_id": "CUST001",
    "customer_name": "展会科技公司",
    "start_date": "2026-05-15",
    "end_date": "2026-05-17",
    "items": [{ "equipment_id": 1 }],
    "remarks": "展会设备租赁"
  }'
```

### 3. 申请延期

```bash
curl -X POST http://localhost:3000/api/extensions \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: key-003" \
  -d '{
    "order_id": 1,
    "new_end_date": "2026-05-19",
    "remarks": "客户展会延期2天",
    "created_by": "客户经理小李"
  }'
```

### 4. 查询订单详情 (含库存锁定状态)

```bash
curl http://localhost:3000/api/orders/1
```

## 常见问题

**Q: 如何查看数据库内容？**

A: 数据库文件位于 `database/rental.db`，可使用 SQLite 客户端工具查看，如 DB Browser for SQLite。

**Q: 延期冲突检测是如何实现的？**

A: 创建延期申请时，系统会检查该订单所有设备在延期时段内是否有其他订单的锁定，如有则拒绝申请。

**Q: 幂等键过期后会怎样？**

A: 幂等键有效期 24 小时，过期后相同的键会被当作新请求处理。

## License

MIT
