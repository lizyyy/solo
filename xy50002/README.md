# 🪑 Furniture Customer Service Platform

一个为海外家具电商客服团队打造的售后协同工作台。

## 功能特性

### 核心功能
- **客服工作台（首页）**：Dashboard 展示关键指标统计、图表分析和最近工单
- **工单管理**：创建、查看、编辑售后工单，支持多条件筛选和搜索
- **订单管理**：新增订单、CSV 批量导入订单、搜索订单
- **订单详情**：按订单查看完整的售后相关信息

### 订单维度查看
- **商品信息**：SKU、名称、价格、尺寸、规格
- **包裹和物流轨迹**：完整的物流时间线追踪
- **客户消息**：历史沟通记录
- **破损证据**：客户提供的损坏照片和附件
- **保修期检查**：自动判断是否在保修期内
- **备件库存**：相关商品的备件可用库存
- **退换/补发方案**：处理退款、换货、补发

### 高级功能
- **SLA 计时**：
  - Critical: 4 小时响应
  - High: 24 小时响应
  - Medium: 48 小时响应
  - Low: 72 小时响应
  - 实时显示剩余时间和超时警告

- **自动风险判断**：
  - 基于订单金额、工单类型、国际订单、消息数量、运费争议等因素
  - 自动计算风险等级（高/中/低）
  - 客服可手动改判

- **客服备注和动作记录**：
  - 内部备注（仅团队可见）
  - 完整的处理动作时间线

- **工单导出**：
  - Markdown 格式：包含完整工单详情、沟通记录、解决方案等
  - CSV 格式：用于数据统计和交接

- **持久化存储**：SQLite 数据库，刷新不丢失数据

## 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- CSV 解析 (csv-parse)

### 前端
- React 18
- Vite
- React Router

## 快速开始

### 环境要求
- Node.js 16 或更高版本
- npm 或 yarn

### 安装和运行

**1. 安装后端依赖**
```bash
cd backend
npm install
```

**2. 安装前端依赖**
```bash
cd ../frontend
npm install
```

**3. 启动后端服务（终端 1）**
```bash
cd backend
npm start
```
后端将在 http://localhost:3001 运行

**4. 启动前端服务（终端 2）**
```bash
cd frontend
npm run dev
```
前端将在 http://localhost:5173 运行

**5. 打开浏览器访问**
```
http://localhost:5173
```

首次启动时，后端会自动初始化数据库并插入示例数据。

## 项目结构

```
.
├── backend/                    # 后端
│   ├── package.json
│   ├── server.js              # Express 服务器
│   ├── data/                  # SQLite 数据库文件目录
│   │   └── support.db         # 自动生成
│   └── scripts/
│       ├── init-db.js         # 数据库初始化脚本
│       └── sample-data.js     # 示例数据
├── frontend/                   # 前端
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       ├── utils.js           # 工具函数
│       ├── pages/             # 页面组件
│       │   ├── Dashboard.jsx
│       │   ├── TicketsPage.jsx
│       │   ├── TicketDetail.jsx
│       │   ├── OrdersPage.jsx
│       │   └── SparePartsPage.jsx
│       └── components/        # 通用组件
│           ├── CreateTicketModal.jsx
│           ├── AddNoteModal.jsx
│           ├── AddActionModal.jsx
│           ├── CreateReturnModal.jsx
│           ├── CreateReplacementModal.jsx
│           ├── CreateOrderModal.jsx
│           └── ImportOrdersModal.jsx
└── README.md
```

## API 接口

### 工单相关
- `GET /api/dashboard` - Dashboard 统计数据
- `GET /api/tickets` - 工单列表（支持筛选）
- `GET /api/tickets/:id` - 工单详情
- `POST /api/tickets` - 创建工单
- `PUT /api/tickets/:id` - 更新工单
- `POST /api/tickets/:id/notes` - 添加备注
- `POST /api/tickets/:id/actions` - 记录动作
- `POST /api/tickets/:id/returns` - 创建退款/退货
- `POST /api/tickets/:id/replacements` - 创建补发
- `GET /api/tickets/:id/export/markdown` - 导出 Markdown
- `GET /api/tickets/:id/export/csv` - 导出 CSV

### 订单相关
- `GET /api/orders` - 订单列表
- `POST /api/orders` - 创建订单
- `POST /api/import/orders` - 批量导入订单

### 其他
- `GET /api/products` - 商品列表
- `GET /api/spare-parts` - 备件库存
- `POST /api/spare-parts/:sku/reserve` - 锁定备件库存

## 示例数据

系统内置了 4 个典型场景的示例工单：

1. **TKT-001 - 沙发划痕和坐垫缝隙** (John Smith, $1,299.99)
   - 类型：运输破损
   - 优先级：High
   - 风险：Medium
   - 状态：处理中

2. **TKT-002 - 餐桌腿断裂 - 国际运输** (Emma Johnson, 英国, $899.99)
   - 类型：运输破损
   - 优先级：Critical ⚠️
   - 风险：High
   - 状态：等待客户回复
   - 特点：国际订单，退换货运费争议

3. **TKT-003 - 缺少五金件** (Michael Brown, 德国, $1,599.99)
   - 类型：缺少配件
   - 优先级：High
   - 风险：Medium
   - 状态：待处理
   - 特点：订单价值高

4. **TKT-004 - 保修期内椅子轮子损坏** (Sarah Davis, $599.99)
   - 类型：保修
   - 优先级：Medium
   - 风险：Low
   - 状态：已解决 ✅
   - 特点：已处理补发

## 常见售后场景

### 尺寸问题
- 查看商品规格 (dimensions)
- 提供部分退款或换货方案
- 考虑退货运费（尤其是国际订单）

### 运输破损
- 检查客户提供的破损证据
- 查看物流轨迹确认送达状态
- 评估责任方（卖家/物流/客户）
- 提供：退款 / 部分退款 / 补发部件 / 换货

### 缺少五金件
- 查看备件库存
- 快速补发相关配件
- 记录库存锁定

### 跨境退换货运费争议
- 系统自动标记高风险
- 比较退货运费 vs 商品价值
- 优先考虑：部分退款 + 保留商品
- 必要时：与物流商索赔

## 重新初始化数据库

如需重置数据库并重新生成示例数据：

```bash
cd backend
rm -rf data
npm start
```

## 许可证

MIT License
