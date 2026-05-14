# 内容发布定时队列系统

一个完整的内容发布定时队列全栈系统，包含内容草稿、发布时间、审核状态、渠道同步的状态机管理。

## 功能特性

### 后端服务
- **内容状态机管理：草稿 → 待审核 → 已通过 → 已排期 → 发布中 → 已发布 → 同步中 → 已同步
- **幂等性保障**：通过 idempotencyKey 防止重复提交
- **重试机制**：发布失败自动重试，支持最大重试次数限制
- **渠道同步**：支持多渠道（官网、微信、微博、小红书、抖音）
- **定时任务**：自动处理到期的排期内容
- **CSV导出**：支持发布日历导出

### 前端应用
- **数据看板**：内容统计、状态分布图表
- **内容管理**：列表、创建、提交审核
- **复核抽屉**：审核操作、撤回原因处理、重试发布
- **时间线**：完整的操作历史记录
- **发布日历**：可视化展示排期内容，支持导出CSV

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- TypeORM + SQLite
- node-cron（定时任务）

### 前端
- React 18
- TypeScript
- Ant Design 5
- Recharts（图表）
- Axios

## 快速开始

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动后端服务

```bash
cd server
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 启动前端应用

```bash
cd client
npm start
```

前端应用将在 http://localhost:3000 启动

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── src/
│   │   ├── entities/     # 数据实体
│   │   │   ├── ContentEntity.ts
│   │   │   ├── ChannelSyncEntity.ts
│   │   └── ReviewRecordEntity.ts
│   ├── services/        # 业务服务
│   │   ├── StateMachineService.ts
│   │   └── ContentService.ts
│   ├── controllers/     # API控制器
│   ├── database.ts       # 数据库配置
│   ├── types.ts        # 类型定义
│   └── index.ts        # 入口文件
├── client/               # 前端应用
│   ├── src/
│   │   ├── components/  # 组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ContentList.tsx
│   │   │   ├── ReviewDrawer.tsx
│   │   │   ├── TimelineView.tsx
│   │   └── CalendarView.tsx
│   ├── services/        # API服务
│   ├── types.ts        # 类型定义
│   ├── App.tsx         # 主应用
│   └── index.tsx       # 入口文件
└── README.md
```

## 状态流转

```
草稿(DRAFT)
  ↓
待审核(PENDING_REVIEW) ←───┐
  ↓                          │
已通过(APPROVED)             │ 驳回修改(REJECT)
  ↓                          │
已排期(SCHEDULED)             │
  ↓                          │
发布中(PUBLISHING)            │
  ↓                          │
┌────┴────┐                   │
↓         ↓                   │
已发布   可重试(RETRYABLE) → 失败(FAILED)
  ↓                          ↑
同步中(SYNCING)               │
  ↓                          │
已同步(SYNCED)               │
  ↓                          │
撤回(WITHDRAWN) → 需复核(NEEDS_REVIEW)
```

## API响应状态码

- `200` - 成功
- `202` - 待审核/待处理
- `403` - 已拦截/禁止
- `409` - 可重试/冲突
- `400` - 参数错误
- `500` - 服务器错误

## 主要功能说明

### 1. 内容创建
- 支持设置标题、内容、作者
- 可选择发布渠道
- 可设置定时发布
- 支持幂等键防止重复创建

### 2. 审核流程
- 提交审核
- 审核通过/驳回/撤回
- 记录审核原因（用于复盘）

### 3. 发布重试
- 发布失败标记为可重试状态
- 支持手动重试发布
- 限制最大重试次数

### 4. 渠道同步
- 每个渠道独立状态管理
- 支持单渠道重试
- 超过重试次数需修正后重试

### 5. 数据看板
- 内容总数统计
- 各状态数量统计
- 状态分布图
- 最近内容列表

### 6. 发布日历
- 月视图展示发布计划
- 点击日期查看详情
- 导出CSV格式

## 开发说明

### 添加新渠道
1. 在 `server/src/types.ts` 的 `ChannelType` 枚举中添加新渠道
2. 在 `client/src/types.ts` 的 `ChannelType` 和 `ChannelLabelMap` 中添加对应配置

### 修改状态流转
1. 在 `server/src/services/StateMachineService.ts` 中修改 `VALID_TRANSITIONS`
2. 前端状态标签和颜色在 `client/src/types.ts` 中配置

## License

MIT
