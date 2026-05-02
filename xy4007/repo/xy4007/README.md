# 手机维修店工单排班系统

一个专为小型手机维修店设计的工单管理系统，帮助店家高效管理换屏、换电池、检测等维修工单，告别微信群和纸本记录的混乱。

## 功能特性

### 核心功能
- **接单表单**：录入客户信息、设备信息、故障描述、报价、预计完成时间、维修师傅分配
- **工单看板**：按状态分类展示所有工单，一目了然
- **多维度筛选**：按日期、维修师傅、状态筛选工单
- **工单详情抽屉**：查看完整工单信息、状态历史、添加备注
- **状态流转**：支持从"待检测"到"已完成"的完整流程推进
- **数据持久化**：使用 SQLite 数据库，刷新页面数据不丢失

### 状态流转
```
待检测 → 待报价 → 维修中 → 待取机 → 已完成
   ↓         ↓         ↓         ↓
   └───────→ 已取消 ←────────┘
```

### 数据校验
- **手机号格式验证**：确保客户手机号格式正确
- **时间验证**：预计完成时间不能早于接单时间
- **预约冲突检查**：同一维修师傅同一时段不能被重复预约

### 数据导入导出
- **CSV 导入**：批量导入旧工单数据
- **CSV 导出**：一键导出当日工单

## 技术栈

### 后端
- Node.js + Express
- SQLite3（数据库）
- 其他依赖：cors, body-parser, multer, csv-parser, json2csv

### 前端
- React 18 + TypeScript
- Vite（构建工具）
- Tailwind CSS（样式框架）
- Lucide React（图标库）

## 项目结构

```
xy4007/
├── backend/                    # 后端项目
│   ├── package.json
│   ├── src/
│   │   ├── index.js           # 入口文件
│   │   ├── database/
│   │   │   ├── db.js          # 数据库连接
│   │   │   └── init.js        # 数据库初始化
│   │   ├── controllers/
│   │   │   ├── orderController.js      # 工单控制器
│   │   │   ├── technicianController.js # 维修师傅控制器
│   │   │   └── csvController.js        # CSV 控制器
│   │   ├── routes/
│   │   │   ├── orders.js      # 工单路由
│   │   │   ├── technicians.js # 维修师傅路由
│   │   │   └── csv.js         # CSV 路由
│   │   └── utils/
│   │       └── validators.js  # 验证工具
│   └── data/                  # 数据库文件目录（运行时创建）
│
├── frontend/                   # 前端项目
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx           # 入口文件
│       ├── App.tsx            # 主应用
│       ├── index.css          # 全局样式
│       ├── types/
│       │   └── index.ts       # 类型定义
│       ├── services/
│       │   └── api.ts         # API 服务
│       ├── constants/
│       │   └── statusFlow.ts  # 状态流转配置
│       └── components/
│           ├── CreateOrderForm.tsx   # 接单表单
│           ├── OrderCard.tsx         # 工单卡片
│           └── OrderDrawer.tsx       # 工单详情抽屉
│
└── README.md
```

## 安装说明

### 环境要求
- Node.js 16+ （建议使用 Node.js 18+）
- npm 或 yarn

### 步骤一：安装后端依赖

```bash
cd backend
npm install
```

### 步骤二：初始化数据库

```bash
# 在 backend 目录下运行
npm run init-db
```

这将创建 SQLite 数据库文件并初始化表结构，同时会默认创建 3 个维修师傅：
- 张师傅
- 李师傅
- 王师傅

### 步骤三：安装前端依赖

```bash
cd ../frontend
npm install
```

### 步骤四：启动应用

**方式一：分别启动前后端（开发模式）**

```bash
# 第一个终端：启动后端
cd backend
npm run dev

# 第二个终端：启动前端
cd frontend
npm run dev
```

**方式二：使用 npm start 启动**

```bash
# 启动后端
cd backend
npm start

# 启动前端
cd frontend
npm run dev
```

### 访问应用

启动成功后，在浏览器中访问：
- 前端应用：http://localhost:3000
- 后端 API：http://localhost:3001

## 使用指南

### 新建工单
1. 点击右上角「新建工单」按钮
2. 填写客户信息（姓名、手机号）
3. 填写设备信息（品牌、型号、IMEI）
4. 填写工单信息（故障描述、报价、预计完成时间、维修师傅）
5. 点击「创建工单」

### 查看工单看板
工单按照 6 种状态分类展示：
- 待检测
- 待报价
- 维修中
- 待取机
- 已完成
- 已取消

### 推进工单状态
每个工单卡片上显示可推进的下一步状态，点击即可推进。

例如：
- 待检测 → 待报价 或 已取消
- 维修中 → 待取机 或 已取消
- 待取机 → 已完成 或 已取消

### 查看工单详情
点击任意工单卡片即可打开详情抽屉，查看：
- 客户信息
- 设备信息
- 工单信息
- 状态历史（时间线）
- 备注列表

在详情页中可以：
- 编辑工单信息
- 推进状态
- 添加备注

### 筛选工单
使用顶部筛选条件：
- **日期**：按接单日期筛选
- **维修师傅**：按分配的维修师傅筛选
- **状态**：按工单状态筛选

点击「重置筛选」可恢复默认。

### 导出当日工单
1. 点击顶部「导出当日」按钮
2. 系统会自动下载 CSV 格式的当日工单

### 导入旧工单
1. 点击顶部「导入」按钮
2. 选择 CSV 格式的工单文件
3. 点击「开始导入」

#### CSV 文件格式要求
必填列：
- 客户姓名
- 客户电话
- 设备品牌
- 设备型号
- 故障描述

可选列：
- IMEI
- 维修师傅（需与系统中的师傅姓名一致）
- 报价
- 预计完成时间
- 状态
- 创建时间

示例 CSV：
```csv
客户姓名,客户电话,设备品牌,设备型号,故障描述,维修师傅,报价
张三,13800138000,iPhone,15 Pro,换屏,张师傅,1200
李四,13900139000,华为,Mate 60,换电池,李师傅,299
```

## API 文档

### 健康检查
```
GET /api/health
```

### 工单 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/orders | 获取工单列表 |
| GET | /api/orders/:id | 获取工单详情 |
| POST | /api/orders | 创建工单 |
| PUT | /api/orders/:id | 更新工单 |
| PUT | /api/orders/:id/status | 更新工单状态 |
| POST | /api/orders/:id/notes | 添加备注 |

**获取工单列表查询参数**：
- `date`：日期（YYYY-MM-DD）
- `technician_id`：维修师傅 ID
- `status`：状态

### 维修师傅 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/technicians | 获取维修师傅列表 |
| POST | /api/technicians | 创建维修师傅 |
| PUT | /api/technicians/:id | 更新维修师傅 |
| DELETE | /api/technicians/:id | 删除维修师傅 |

### CSV API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/csv/export/today | 导出当日工单 |
| POST | /api/csv/import | 导入工单 |

## 数据库表结构

### technicians（维修师傅）
- `id`：主键
- `name`：姓名
- `phone`：电话
- `created_at`：创建时间

### customers（客户）
- `id`：主键
- `name`：姓名
- `phone`：电话（唯一）
- `created_at`：创建时间

### devices（设备）
- `id`：主键
- `customer_id`：关联客户
- `brand`：品牌
- `model`：型号
- `imei`：序列号
- `created_at`：创建时间

### orders（工单）
- `id`：主键
- `customer_id`：关联客户
- `device_id`：关联设备
- `technician_id`：关联维修师傅
- `fault_description`：故障描述
- `quote`：报价
- `estimated_completion_time`：预计完成时间
- `status`：状态
- `created_at`：创建时间
- `updated_at`：更新时间

### status_history（状态历史）
- `id`：主键
- `order_id`：关联工单
- `old_status`：旧状态
- `new_status`：新状态
- `changed_by`：操作人
- `changed_at`：操作时间
- `note`：备注

### notes（备注）
- `id`：主键
- `order_id`：关联工单
- `content`：内容
- `created_by`：创建人
- `created_at`：创建时间

## 常见问题

### 数据库文件在哪里？
数据库文件位于 `backend/data/repair-shop.db`。

### 如何重置数据库？
删除 `backend/data/repair-shop.db` 文件，然后重新运行：
```bash
npm run init-db
```

### 如何添加更多维修师傅？
可以通过 API 添加，或者直接在初始化脚本 `backend/src/database/init.js` 中添加更多默认数据。

### 前端代理配置
前端开发服务器已配置代理，`/api/*` 请求会自动转发到 `http://localhost:3001`。

## 许可证

MIT License
