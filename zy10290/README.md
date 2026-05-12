# 社群秒杀补单台

一个完整的社群秒杀订单管理系统，支持库存管理、补单审批、支付回调处理、发货退款等核心功能。

## 功能特性

### 核心功能
- 📦 **库存管理**：库存锁定、确认扣减、释放回滚，防止超卖负数
- 📝 **订单管理**：订单列表、详情查看、状态流转
- 🔄 **补单流程**：补单申请、审批（通过/拒绝）、幂等处理
- 💳 **支付回调**：支持重复回调幂等，超时自动释放库存
- 🚚 **发货管理**：物流单号录入，发货状态追踪
- 💰 **退款处理**：退款申请、库存回滚选项
- 📊 **库存日志**：完整的库存变动记录，支持溯源

### 前端页面
- **订单管理**：列表筛选、详情弹窗、导出CSV
- **活动商品**：活动创建、商品添加、库存查看
- **库存日志**：变动类型筛选、幂等键查看
- **数据统计**：订单统计、销售分析、退款统计

### 关键保障
1. **幂等处理**：所有库存操作都有唯一幂等键，重复调用不重复计算
2. **库存永不负数**：每次扣减前校验可用库存，不足拒绝操作
3. **状态机约束**：订单状态严格按流程流转，不允许越权操作
4. **完整日志**：所有库存变动都有记录，支持完整溯源

## 技术栈

### 后端
- **Node.js** + **Express**：Web服务框架
- **better-sqlite3**：嵌入式数据库，无需额外安装
- **UUID**：唯一ID生成
- **dayjs**：时间处理

### 前端
- **React 18**：UI框架
- **Ant Design 5**：组件库
- **Vite**：构建工具
- **Axios**：HTTP客户端

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 初始化数据库和样例数据

```bash
cd backend
node src/scripts/initSampleData.js
```

样例数据包含：
- 五一社群秒杀活动
- 限量版口红、网红面膜套装2款商品
- 7个订单（含正常支付、超时释放、补单被拒绝、退款退货场景）
- 完整的库存变动日志

### 3. 启动服务

#### 方式一：分别启动（推荐开发用）

```bash
# 终端1 - 启动后端服务（端口3001）
cd backend
npm run dev

# 终端2 - 启动前端服务（端口3000）
cd frontend
npm run dev
```

#### 方式二：使用concurrently（推荐演示用）

```bash
npm install -g concurrently
concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

### 4. 访问系统

打开浏览器访问：**http://localhost:3000**

## 系统演示流程

### 场景1：查看样例数据
1. 进入「订单管理」，查看7条样例订单
2. 点击「详情」查看订单的补单记录和库存变动日志
3. 进入「库存变动日志」，查看所有库存操作记录，注意观察幂等键列

### 场景2：补单审批流程
1. 在订单列表找到「支付失败」状态的订单
2. 点击「详情」→「申请补单」，填写申请原因
3. 再次进入详情，点击「批准补单」或「拒绝补单」
4. 观察库存变动日志（批准会锁库存+扣减，拒绝无库存变动）

### 场景3：发货操作
1. 找到「已支付」未发货的订单
2. 进入详情 → 点击「发货」
3. 填写物流单号，确认发货

### 场景4：退款处理
1. 找到已支付的订单
2. 进入详情 → 点击「退款」
3. 选择是否退回库存（损坏不退回，无理由退货退回）
4. 观察库存是否回滚

### 场景5：导出数据
1. 在订单列表页点击「导出」按钮
2. 自动下载CSV格式订单数据

## API接口文档

### 活动相关
- `GET /api/activities` - 获取活动列表
- `POST /api/activities` - 创建活动
- `GET /api/activities/:id/products` - 获取活动商品
- `POST /api/activities/:id/products` - 添加商品

### 订单相关
- `GET /api/orders` - 获取订单列表（支持分页筛选）
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `POST /api/orders/:id/payment-callback` - 支付回调（幂等）
- `POST /api/orders/:id/timeout` - 订单超时处理
- `POST /api/orders/:id/compensation` - 申请补单
- `POST /api/orders/compensation/:id/approve` - 批准补单
- `POST /api/orders/compensation/:id/reject` - 拒绝补单
- `POST /api/orders/:id/ship` - 发货
- `POST /api/orders/:id/refund` - 退款

### 库存日志
- `GET /api/orders/inventory/logs` - 获取库存变动日志

## 数据库表结构

- `flash_sale_activities` - 秒杀活动表
- `flash_sale_products` - 秒杀商品表（含可用/锁定/已售库存字段）
- `flash_sale_orders` - 订单表（含补单相关字段）
- `inventory_change_logs` - 库存变动日志表（核心：idempotent_key幂等键）
- `compensation_applications` - 补单申请表

## 核心业务逻辑说明

### 库存流转机制
```
下单 → 锁定库存（available - locked +）
  ↓
支付成功 → 确认扣减（locked - sold +）
支付失败/超时 → 释放库存（available + locked -）
  ↓
退款退货 → 退回库存（available +）
```

### 幂等键设计规则
- 支付回调：`payment_${transaction_id}`
- 锁定库存：`lock_${product_id}_${user_id}_${timestamp}`
- 确认扣减：`confirm_${order_id}`
- 补单锁定：`compensation_lock_${apply_id}`
- 退款退回：`refund_${order_id}_${timestamp}`

### 状态机约束
```
待支付 → 已支付 → 已发货
   ↓          ↓
已取消      已退款
```

## 目录结构

```
├── backend/                    # 后端项目
│   ├── src/
│   │   ├── index.js           # 服务入口
│   │   ├── database/          # 数据库层
│   │   ├── services/          # 业务服务
│   │   ├── routes/            # API路由
│   │   ├── utils/             # 工具函数
│   │   └── scripts/           # 初始化脚本
│   └── data/                  # 数据库文件目录（自动创建）
│
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── main.jsx           # 入口文件
│   │   ├── App.jsx            # 主应用
│   │   ├── pages/             # 页面组件
│   │   └── utils/             # 工具函数
│   ├── index.html
│   └── vite.config.js
│
└── README.md
```

## 注意事项

1. **数据库**：使用SQLite，无需额外安装数据库，数据自动保存在 `backend/data/` 目录
2. **端口**：后端默认3001，前端默认3000，可在配置文件修改
3. **幂等**：所有涉及库存的操作都要有幂等设计，防止重复提交
4. **库存校验**：任何扣减操作前必须校验可用库存是否充足
5. **日志完整**：建议生产环境添加更完善的操作日志和审计功能

## 扩展建议（生产环境）

1. 替换为MySQL/PostgreSQL等生产数据库
2. 添加用户认证和权限管理
3. 接入真实支付网关
4. 添加WebSocket实时通知
5. 接入物流API查询物流状态
6. 添加定时任务自动处理超时订单
7. 添加完善的监控告警
8. 考虑使用Redis做分布式锁和库存预热
