# 器械消毒灭菌追溯系统

## 项目简介

这是一个完整的器械消毒灭菌追溯全栈Web应用系统，实现了器械包管理、回收登记、清洗记录、灭菌批次、失败隔离、科室发放等全流程追溯管理。

## 功能特性

### 核心功能
- **数据概览**：统计卡片展示、异常看板、图表统计
- **器械包管理**：器械包CRUD、状态管理、修改历史
- **回收登记**：科室回收记录管理、修改历史
- **清洗记录**：清洗过程记录、清洗结果管理
- **灭菌批次**：灭菌批次管理、参数记录
- **失败隔离**：异常原因记录、隔离管理、纠正措施
- **科室发放**：发放记录管理

### 高级功能
- **修改历史**：所有关键数据修改前后值对比
- **异常管理**：明确的异常原因和处理流程
- **报表导出**：Excel报表导出，支持按责任人和时间筛选
- **搜索过滤**：多维度数据筛选
- **数据可视化**：图表展示科室回收、处理人工作量等

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite3
- ExcelJS (Excel导出)
- Day.js (日期处理)

### 前端
- React 18 + TypeScript
- Vite
- Ant Design
- Axios
- ECharts (数据可视化)

## 快速开始

### 前置要求
- Node.js >= 16.x
- npm 或 yarn

### 安装与启动

#### 1. 安装后端依赖
```bash
cd backend
npm install
```

#### 2. 初始化数据库
```bash
# 创建表结构
npm run init-db

# 插入示例数据
npm run seed
```

#### 3. 启动后端服务
```bash
npm run dev
# 服务运行在 http://localhost:5000
```

#### 4. 安装前端依赖
```bash
cd ../frontend
npm install
```

#### 5. 启动前端服务
```bash
npm run dev
# 服务运行在 http://localhost:3000
```

## 项目结构

```
.
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── database/          # 数据库配置
│   │   │   └── index.ts
│   │   ├── routes/            # API路由
│   │   │   ├── packages.ts    # 器械包
│   │   │   ├── recovery.ts    # 回收登记
│   │   │   ├── cleaning.ts    # 清洗记录
│   │   │   ├── sterilization.ts # 灭菌批次
│   │   │   ├── isolation.ts   # 失败隔离
│   │   │   ├── distribution.ts # 科室发放
│   │   │   └── statistics.ts  # 统计报表
│   │   ├── utils/             # 工具函数
│   │   │   └── history.ts     # 修改历史
│   │   ├── scripts/           # 脚本
│   │   │   ├── initDB.ts      # 数据库初始化
│   │   │   └── seedData.ts    # 种子数据
│   │   └── server.ts          # 服务入口
│   ├── data/                  # SQLite数据库文件
│   ├── package.json
│   └── tsconfig.json
└── frontend/                   # 前端应用
    ├── src/
    │   ├── pages/             # 页面组件
    │   │   ├── Dashboard.tsx  # 数据概览
    │   │   ├── Packages.tsx   # 器械包管理
    │   │   ├── Recovery.tsx   # 回收登记
    │   │   ├── Cleaning.tsx   # 清洗记录
    │   │   ├── Sterilization.tsx # 灭菌批次
    │   │   ├── Isolation.tsx  # 失败隔离
    │   │   ├── Distribution.tsx # 科室发放
    │   │   └── Report.tsx     # 报表导出
    │   ├── services/          # API服务
    │   │   └── api.ts
    │   ├── types/             # 类型定义
    │   │   └── index.ts
    │   ├── App.tsx            # 主应用组件
    │   ├── main.tsx           # 入口文件
    │   └── index.css          # 样式
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── index.html
```

## 关键API接口

### 器械包
- `GET /api/packages` - 获取器械包列表
- `GET /api/packages/:id` - 获取器械包详情
- `GET /api/packages/:id/history` - 获取修改历史
- `POST /api/packages` - 创建器械包
- `PUT /api/packages/:id` - 更新器械包
- `DELETE /api/packages/:id` - 删除器械包

### 回收登记
- `GET /api/recovery` - 获取回收记录列表
- `POST /api/recovery` - 创建回收记录
- `PUT /api/recovery/:id` - 更新回收记录

### 清洗记录
- `GET /api/cleaning` - 获取清洗记录列表
- `POST /api/cleaning` - 创建清洗记录
- `PUT /api/cleaning/:id` - 更新清洗记录

### 灭菌批次
- `GET /api/sterilization` - 获取灭菌批次列表
- `POST /api/sterilization` - 创建灭菌批次
- `PUT /api/sterilization/:id` - 更新灭菌批次

### 失败隔离
- `GET /api/isolation` - 获取隔离记录列表
- `POST /api/isolation` - 创建隔离记录
- `PUT /api/isolation/:id` - 更新隔离记录

### 科室发放
- `GET /api/distribution` - 获取发放记录列表
- `POST /api/distribution` - 创建发放记录
- `PUT /api/distribution/:id` - 更新发放记录

### 统计报表
- `GET /api/statistics` - 获取统计概览
- `GET /api/statistics/anomalies` - 获取异常数据
- `GET /api/statistics/report` - 获取报表数据
- `GET /api/statistics/export` - 导出Excel报表

## 报表导出

报表导出支持以下筛选条件：
- 开始日期
- 结束日期
- 处理人

导出内容包括：
- 回收记录
- 清洗记录
- 发放记录

## 数据库表结构

### 主要数据表
- `instrument_packages` - 器械包表
- `recovery_records` - 回收记录表
- `cleaning_records` - 清洗记录表
- `sterilization_batches` - 灭菌批次表
- `failure_isolations` - 失败隔离表
- `department_distributions` - 科室发放表
- `modification_history` - 修改历史表

## 开发命令

### 后端
```bash
npm run dev          # 开发模式启动
npm run build        # 构建生产版本
npm start            # 生产模式启动
npm run init-db      # 初始化数据库表
npm run seed         # 插入种子数据
```

### 前端
```bash
npm run dev          # 开发模式启动
npm run build        # 构建生产版本
npm run preview      # 预览生产版本
```

## 注意事项

1. 首次启动前请确保已运行`npm run init-db`初始化数据库
2. 种子数据包含示例数据，可根据实际需求修改
3. 数据库文件位于`backend/data/sterilization.db`
4. 前端代理配置在`vite.config.ts`中，可根据需要修改后端地址

## 许可证

MIT
