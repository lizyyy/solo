# 社区冷链团购自提管理系统

一个本地运行的社区团长冷链团购自提管理台，专为解决以下痛点设计：
- 📦 供应商到货少货、临期批次问题
- ❄️ 冰柜容量不足、分配混乱问题
- ⏰ 自提时段拥挤、冲突问题
- 💸 邻居取货时才发现要换货或退款

## 技术栈

### 后端
- **Node.js** + **Express.js** - Web服务框架
- **SQLite** + **Sequelize ORM** - 本地持久化存储
- **xlsx** - Excel报表导出
- **dayjs** - 日期时间处理

### 前端
- **Vue 3** + **Vite** - 前端框架
- **Vue Router** - 路由管理
- **Axios** - HTTP请求
- **Bootstrap 5** - UI样式

## 功能特性

### 核心功能
| 功能模块 | 功能描述 |
|---------|---------|
| 🛍️ 商品管理 | 商品SKU、分类、存储温度、保质期设置 |
| 📅 团购批次 | 创建团购活动、设置起止时间和预计到货日期 |
| 📝 订单管理 | 订单创建、查看、自提核销、自提时段调整 |
| 📦 库存管理 | 库存批次录入、临期预警、库存分配查询 |
| ❄️ 冰柜管理 | 冰柜容量监控、使用状态、存放位置管理 |
| ⏰ 自提时段 | 时段创建、容量管理、冲突检测、替代时段建议 |
| ⚠️ 异常处理 | 缺货/临期/质量问题记录、处理建议（退款/调拨）、状态跟踪 |
| 📊 报表导出 | 自提清单、缺货报告、退款报告、每日综合报告、逾期提醒 |

### 智能分配规则
1. **临期优先分配**：保质期短的批次优先分配给订单
   - 已过期：最高优先级（不分配）
   - 紧急临期（≤3天）：次高优先级
   - 临期（≤7天）：中等优先级
   - 正常：低优先级

2. **冰柜容量检查**：
   - 创建库存时自动检查冰柜可用容量
   - 容量满时自动标记状态为 `full`
   - 支持手动分配到其他冰柜

3. **自提时段冲突检测**：
   - 创建时段时检查时间重叠
   - 分配订单时检查剩余容量
   - 已满时段提供替代时段建议

## 项目结构

```
cold-chain-group-purchase/
├── backend/                    # 后端代码
│   ├── config/
│   │   └── database.js         # 数据库配置
│   ├── database/
│   │   └── seed.js             # 种子数据
│   ├── models/
│   │   ├── index.js            # 模型入口和关联
│   │   ├── Product.js          # 商品模型
│   │   ├── GroupBatch.js       # 团购批次模型
│   │   ├── Order.js            # 订单模型
│   │   ├── OrderItem.js        # 订单项模型
│   │   ├── InventoryBatch.js   # 库存批次模型
│   │   ├── Freezer.js          # 冰柜模型
│   │   ├── PickupSlot.js       # 自提时段模型
│   │   ├── Exception.js        # 异常处理模型
│   │   └── InventoryAllocation.js # 库存分配明细
│   ├── routes/
│   │   ├── index.js            # 路由主入口
│   │   ├── productRoutes.js    # 商品API
│   │   ├── groupBatchRoutes.js # 团购批次API
│   │   ├── orderRoutes.js      # 订单API
│   │   ├── inventoryRoutes.js  # 库存API
│   │   ├── freezerRoutes.js    # 冰柜API
│   │   ├── pickupSlotRoutes.js # 自提时段API
│   │   ├── exceptionRoutes.js  # 异常处理API
│   │   └── exportRoutes.js     # 报表导出API
│   ├── services/
│   │   ├── inventoryService.js # 库存分配服务
│   │   ├── pickupSlotService.js # 自提时段服务
│   │   ├── exceptionService.js # 异常处理服务
│   │   └── exportService.js    # 导出服务
│   └── server.js               # 服务器入口
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   │   ├── Dashboard.vue       # 仪表盘
│   │   │   ├── Products.vue        # 商品管理
│   │   │   ├── GroupBatches.vue    # 团购批次
│   │   │   ├── Orders.vue          # 订单列表
│   │   │   ├── OrderDetail.vue     # 订单详情
│   │   │   ├── Inventory.vue       # 库存管理
│   │   │   ├── Freezers.vue        # 冰柜管理
│   │   │   ├── PickupSlots.vue     # 自提时段
│   │   │   ├── Exceptions.vue      # 异常列表
│   │   │   ├── ExceptionDetail.vue # 异常详情
│   │   │   └── Export.vue          # 报表导出
│   │   ├── router/
│   │   │   └── index.js        # 路由配置
│   │   ├── api/
│   │   │   └── index.js        # API封装
│   │   ├── App.vue             # 根组件
│   │   └── main.js             # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/                       # SQLite数据库文件（运行后自动创建）
├── package.json
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
# 安装后端和前端所有依赖
npm run install-all
```

或者手动安装：
```bash
# 后端依赖
npm install

# 前端依赖
cd frontend
npm install
cd ..
```

2. **启动应用**
```bash
# 开发模式（同时启动后端和前端）
npm run dev
```

或者分别启动：
```bash
# 启动后端（端口3000）
npm run server

# 启动前端（端口5173）
npm run client
```

3. **访问系统**
- 前端页面：http://localhost:5173
- 后端API：http://localhost:3000/api

### 首次运行
系统启动时会自动：
1. 创建SQLite数据库文件（`data/database.sqlite`）
2. 同步所有数据表
3. 插入种子数据（包含完整测试场景）

## 测试场景说明

种子数据预置了5个典型测试场景，启动后可以直接体验：

### 1. 🍶 临期酸奶优先分配
**场景描述**：蒙牛纯甄酸奶有两个批次
- 批次1：生产日期 `18天前`，保质期 `仅剩3天`（临期），库存 `15盒`
- 批次2：生产日期 `6天前`，保质期 `15天`（新鲜），库存 `20盒`

**预期行为**：
- 系统自动按**临期优先**规则分配库存
- 张阿姨、李叔叔、王女士的订单优先分配临期批次
- 可在「库存管理」页面查看各批次分配情况

### 2. ❄️ 冰柜容量不足
**场景描述**：
- 冷冻柜B（FREEZER-002）：总容量 `40`，已使用 `38`，剩余 `2`
- 澳洲羊排库存 `3斤`，因冰柜已满**暂未入库**
- 孙叔叔订单订了 `2斤羊排`，无法分配

**预期行为**：
- 冰柜管理页面显示「容量紧张」警告
- 库存列表中羊排批次显示「未分配冰柜」
- 可通过「分配冰柜」功能将库存转移到备用柜

### 3. ⏰ 自提时段爆满
**场景描述**：
- 5月6日（后天）`09:00-10:00` 时段：最大 `5单`，已约 `5单`（已满）
- 该时段有5位邻居：张阿姨、李叔叔、王女士、刘先生、陈阿姨

**预期行为**：
- 自提时段页面显示「已满」状态
- 创建新订单时无法选择已满时段
- 系统会推荐其他可用时段

### 4. 📦 部分缺货订单
**场景描述**：
- 刘先生：订了 `6盒安慕希希腊酸奶`
- 实际库存：`10盒`，已分配 `8盒`
- 刘先生订单只能分配 `6盒` 中的部分

**预期行为**：
- 系统自动创建「缺货异常」
- 异常详情页面显示处理建议：
  - 退款：退还缺货部分的款项
  - 调拨：从其他批次/供应商调货
- 可在「异常处理」页面处理

### 5. 🧊 鲜切水果当天必须送出
**场景描述**：
- 鲜切西瓜、鲜切哈密瓜：保质期仅 `1天`
- 必须在自提当天完成配送

**预期行为**：
- 库存列表显示「紧急临期」标签
- 仪表盘「临期预警」卡片高亮显示
- 导出「临期预警报告」可查看所有临期商品

## 核心流程演示

### 流程1：自提核销
1. 进入「订单管理」页面
2. 找到状态为「已分配」的订单（如张阿姨）
3. 点击「核销自提」按钮
4. 系统会：
   - 更新订单状态为「已自提」
   - 扣减实际库存
   - 更新冰柜使用量

### 流程2：处理缺货异常
1. 进入「异常处理」页面
2. 找到「缺货」类型的异常（刘先生订单）
3. 点击「处理」进入详情
4. 选择处理方式：
   - **退款**：填写退款金额和备注
   - **调拨**：选择新的库存批次和调拨数量
5. 提交后异常状态更新为「已解决」

### 流程3：导出报表
1. 进入「报表导出」页面
2. 选择需要导出的报表类型：
   - 自提清单：按自提时段分组的待提订单
   - 缺货报告：所有缺货异常记录
   - 退款报告：所有已退款记录
   - 每日综合报告：当天的所有数据汇总
   - 逾期提醒：已过自提时间仍未取货的订单
   - 临期预警：保质期≤7天的库存批次
3. 选择日期范围（可选）
4. 点击「导出Excel」按钮

## API接口

### 基础URL
`http://localhost:3000/api`

### 主要接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/dashboard` | 仪表盘统计数据 |
| GET | `/products` | 商品列表 |
| POST | `/products` | 创建商品 |
| GET | `/group-batches` | 团购批次列表 |
| POST | `/group-batches` | 创建团购批次 |
| GET | `/orders` | 订单列表 |
| POST | `/orders` | 创建订单 |
| GET | `/orders/:id` | 订单详情 |
| PUT | `/orders/:id/confirm-pickup` | 自提核销 |
| GET | `/inventory` | 库存列表 |
| GET | `/inventory/stats` | 库存统计 |
| GET | `/inventory/expiring` | 临期库存 |
| POST | `/inventory` | 创建库存批次 |
| PUT | `/inventory/:id/assign-freezer` | 分配冰柜 |
| GET | `/freezers` | 冰柜列表 |
| GET | `/pickup-slots` | 自提时段列表 |
| GET | `/pickup-slots/date/:date` | 按日期查询时段 |
| GET | `/exceptions` | 异常列表 |
| GET | `/exceptions/:id` | 异常详情 |
| POST | `/exceptions/:id/resolve` | 解决异常 |
| GET | `/export/pickup-list` | 导出自提清单 |
| GET | `/export/shortage-report` | 导出缺货报告 |
| GET | `/export/refund-report` | 导出退款报告 |
| GET | `/export/daily-report` | 导出每日报告 |
| GET | `/export/overdue-reminder` | 导出逾期提醒 |
| GET | `/export/expiry-warning` | 导出临期预警 |

## 数据库模型

### 核心模型关系

```
Product (商品)
  └── OrderItem (订单项) ────── Order (订单) ────── PickupSlot (自提时段)
  │                                    │                   │
  └── InventoryBatch (库存批次) ──────┘                   └── GroupBatch (团购批次)
        │
        ├── Freezer (冰柜)
        └── InventoryAllocation (库存分配明细) ── Exception (异常处理)
```

### 状态枚举

| 模型 | 状态字段 | 状态值 |
|------|---------|--------|
| Order | status | `draft`(草稿) `paid`(已付款) `allocated`(已分配) `picked_up`(已自提) `cancelled`(已取消) |
| OrderItem | status | `pending`(待分配) `allocated`(已分配) `partial_allocated`(部分分配) `picked_up`(已自提) `refunded`(已退款) |
| InventoryBatch | status | `in_stock`(在库) `partial_allocated`(部分分配) `allocated`(全部分配) `picked_up`(已出库) |
| Freezer | status | `active`(正常) `full`(已满) `maintenance`(维护中) `disabled`(禁用) |
| PickupSlot | status | `draft`(草稿) `available`(可用) `partial`(部分已满) `full`(已满) `completed`(已完成) |
| Exception | status | `open`(待处理) `processing`(处理中) `resolved`(已解决) `closed`(已关闭) |
| Exception | type | `shortage`(缺货) `expiry`(临期/过期) `quality`(质量问题) `damaged`(损坏) `other`(其他) |

## 常见问题

### Q1: 数据库文件在哪里？
数据库文件在 `data/database.sqlite`，删除此文件可重置所有数据。

### Q2: 如何重置种子数据？
删除 `data/database.sqlite` 文件，然后重启服务器，系统会自动重新创建数据库并插入种子数据。

### Q3: 前端API代理如何配置？
在 `frontend/vite.config.js` 中配置了代理，所有 `/api` 请求会转发到 `http://localhost:3000`。

### Q4: 如何修改端口？
- 后端：修改 `backend/server.js` 中的 `PORT` 变量
- 前端：修改 `frontend/vite.config.js` 中的 `server.port` 和代理目标地址

## 开发说明

### 添加新功能
1. 后端：在 `models/` 添加模型，`routes/` 添加API，`services/` 添加业务逻辑
2. 前端：在 `src/views/` 添加页面，`src/router/` 添加路由，`src/api/` 添加API封装

### 数据备份
定期备份 `data/database.sqlite` 文件即可。

## 许可证

MIT License
