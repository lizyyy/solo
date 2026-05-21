# 样本交接链 API

一个全栈Web应用，用于追踪样本从采集点到实验室的完整交接过程，确保责任可追溯。

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (文件型数据库，数据持久化)

### 前端
- React 18 + TypeScript
- Ant Design
- Vite
- Recharts (图表)

## 核心功能

### 数据模型
- **样本**: 条码、类型、状态、采集点、目的实验室、当前位置、处理人
- **交接记录**: 转出/转入处理人、位置、时间、温度
- **温度记录**: 温度数据、时间、位置
- **异常记录**: 异常类型、描述、处理状态
- **责任链**: 完整的责任追溯链路

### 业务规则
1. **状态机**: 已创建 → 已采集 → 运输中 → 已到达 → 检测中 → 已完成
   - 支持异常状态（EXCEPTION、LOST）
   
2. **温控校验**: 温度范围 2-8°C，超出自动记录异常

3. **异常处理**:
   - 温度超标、延迟、损坏、丢失、地址错误
   - 支持手动补偿恢复流程

4. **责任追踪**: 完整记录每个节点的处理人、时间、位置、动作

5. **数据导出**: CSV格式导出完整交接链路

## 项目结构

```
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── database/       # 数据库连接和初始化
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑服务
│   │   ├── routes/         # API路由
│   │   ├── scripts/        # 数据脚本
│   │   └── index.ts        # 服务入口
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/               # 前端控制台
│   ├── src/
│   │   ├── services/       # API服务
│   │   ├── App.tsx         # 主应用
│   │   └── main.tsx        # 入口文件
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 生成演示数据

```bash
cd backend
npm run seed
```

### 3. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 4. 启动前端服务

```bash
cd frontend
npm run dev
```

前端控制台将在 http://localhost:3000 启动

## API接口

### 样本接口
- `POST /api/samples` - 创建样本
- `GET /api/samples` - 查询所有样本
- `GET /api/samples/statistics` - 统计数据
- `GET /api/samples/:id` - 样本详情
- `GET /api/samples/barcode/:barcode` - 条码查询
- `PATCH /api/samples/:id/status` - 更新状态
- `POST /api/samples/:id/transfer` - 交接样本
- `GET /api/samples/:id/transfers` - 交接记录
- `GET /api/samples/:id/responsibility` - 责任链
- `POST /api/samples/:id/exceptions` - 报告异常
- `POST /api/samples/:id/compensate` - 手动补偿
- `GET /api/samples/:id/export` - 导出链路

### 异常接口
- `GET /api/exceptions` - 查询异常
- `PATCH /api/exceptions/:id/resolve` - 解决异常

## 演示数据

运行 `npm run seed` 后将生成以下样本：
- SAM001: 完整流程，已完成
- SAM002: 检测中
- SAM003: 异常状态（有异常记录）
- SAM004: 运输中
- SAM005: 已采集
- SAM006: 已丢失

## 数据持久化

- SQLite数据库文件位于 `backend/data/sample-chain.db`
- 服务重启后数据不会丢失
- 导出的CSV文件位于 `backend/exports/` 目录
