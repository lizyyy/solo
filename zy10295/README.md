# 货车轮胎翻新管理台

一个完整的车队轮胎全生命周期管理系统，包含前端管理界面和后端 API 服务。

## 功能特性

### 核心功能
- **车辆看板**：实时监控车队所有车辆的轮胎状态和可用性
- **轮胎管理**：完整的轮胎档案管理，包含品牌、型号、规格等信息
- **生命周期追踪**：完整记录轮胎的每一次操作（装车、拆下、检测、翻新、报废）
- **状态流转控制**：严格的状态机控制，防止非法操作
- **成本管理**：自动统计每一条轮胎的检测、翻新等各项费用
- **数据导出**：支持轮胎列表和事件记录的 CSV 导出

### 业务规则保障
- ✅ 防止同一轮胎同时装车和翻新
- ✅ 检测未通过的轮胎禁止直接装车
- ✅ 已报废轮胎禁止继续流转
- ✅ 防止重复计费
- ✅ 防止重复导入同一胎号

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- UUID

### 前端
- React 18 + TypeScript
- React Router
- Vite
- Axios

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖（用于并发启动）
npm install

# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 启动项目

#### 方式一：一键启动（推荐）

```bash
npm run dev
```

#### 方式二：分别启动

```bash
# 启动后端服务（端口 3001）
cd backend && npm run dev

# 启动前端服务（端口 3000）
cd frontend && npm start
```

### 访问应用

- 前端应用：http://localhost:3000
- 后端 API：http://localhost:3001
- 健康检查：http://localhost:3001/api/health

## 功能模块说明

### 1. 车辆可用性看板
- 查看所有车辆的实时状态（可出车 / 不可出车）
- 可视化展示每辆车的轮胎安装情况
- 统计车辆总数、可用车辆、已装轮胎、缺胎数量
- 显示轮胎状态颜色标识：
  - 🟢 在库 / 检测通过 / 翻新完成
  - 🔵 已装车
  - 🟡 已拆下 / 翻新中
  - 🟣 检测中
  - 🔴 检测未通过
  - ⚪ 已报废

### 2. 轮胎列表管理
- 查看所有轮胎的基本信息和当前状态
- 按状态、所属车辆筛选
- 新增轮胎入库
- 导出轮胎清单 CSV

### 3. 轮胎生命周期详情
- 查看轮胎基本信息和累计成本
- 完整事件时间线记录
- 费用明细 breakdown
- 快捷操作区（根据当前状态显示可用操作）：
  - 装车
  - 拆下
  - 检测
  - 送翻新
  - 完成翻新
  - 报废
- 导出事件记录 CSV

## API 接口说明

### 轮胎相关
- `GET /api/tires` - 获取轮胎列表（支持 status 和 vehicle_id 查询参数）
- `GET /api/tires/:id` - 获取单个轮胎详情
- `GET /api/tires/:id/lifecycle` - 获取轮胎生命周期详情（含事件和成本）
- `GET /api/tires/:id/events` - 获取轮胎事件记录
- `POST /api/tires` - 创建新轮胎
- `POST /api/tires/:id/install` - 装车
- `POST /api/tires/:id/remove` - 拆下
- `POST /api/tires/:id/inspect` - 检测
- `POST /api/tires/:id/retread` - 送翻新
- `POST /api/tires/:id/complete-retread` - 完成翻新
- `POST /api/tires/:id/scrap` - 报废

### 车辆相关
- `GET /api/vehicles` - 获取车辆列表
- `GET /api/vehicles/:id` - 获取单个车辆
- `GET /api/vehicles/availability` - 获取所有车辆可用性状态
- `GET /api/vehicles/:id/availability` - 获取单个车辆可用性
- `GET /api/vehicles/:id/tires` - 获取车辆安装的轮胎
- `POST /api/vehicles` - 创建新车辆

## 轮胎状态流转图

```
在库 (in_stock)
   ↓
   ├─→ 装车 → 已装车 (installed) → 拆下 → 已拆下 (removed)
   └─→ 检测 → 检测中 (inspecting)
                     ↓
           ┌─────────┴─────────┐
           ↓                   ↓
    检测通过 (passed)    检测未通过 (failed)
           ↓                   ↓
    ┌──────┴──────┐      ┌────┴────┐
    ↓             ↓      ↓         ↓
  在库        送翻新   送翻新     报废
    ↓             ↓      ↓
  装车        翻新中   翻新中
                  ↓      ↓
              翻新完成  翻新完成
                  ↓
              ┌───┴───┐
              ↓       ↓
            在库     检测
```

## 演示数据

系统首次启动时会自动创建演示数据，包含：
- 4 辆演示车辆
- 16 条演示轮胎（不同品牌、型号、状态）
- 包含多种操作场景（完整的生命周期流程演示）

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── database.ts     # 数据库初始化和连接
│   │   ├── services/       # 业务逻辑层
│   │   │   ├── tireService.ts      # 轮胎服务
│   │   │   ├── vehicleService.ts   # 车辆服务
│   │   │   └── demoData.ts         # 演示数据生成
│   │   ├── routes/         # API 路由
│   │   │   ├── tires.ts
│   │   │   └── vehicles.ts
│   │   ├── types.ts        # 类型定义
│   │   └── index.ts        # 服务入口
│   ├── data/               # SQLite 数据库文件目录
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # 通用组件
│   │   │   └── Layout.tsx
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.tsx     # 车辆看板
│   │   │   ├── TireList.tsx      # 轮胎列表
│   │   │   └── TireDetail.tsx    # 轮胎详情
│   │   ├── api.ts          # API 客户端
│   │   ├── types.ts        # 类型定义
│   │   ├── App.tsx         # 应用入口
│   │   └── main.tsx        # React 挂载
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json            # 根目录配置
└── README.md
```

## 注意事项

1. 数据库文件存储在 `backend/data/` 目录下，首次启动会自动创建
2. 演示数据只会在数据库为空时创建一次
3. 所有操作都有完整的事件记录，便于审计和追溯
4. 成本会自动关联到对应的事件，避免重复计费

## License

MIT
