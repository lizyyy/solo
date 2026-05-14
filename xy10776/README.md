# 数据看板注释系统

一个完整的全栈数据看板注释管理系统，包含后端API服务和前端管理界面。

## 功能特性

### 后端功能
- **注释事件管理**：创建、查询、更新注释事件
- **状态机流转**：完整的审批状态流转（草稿 → 待审批 → 已通过 → 已发布 → 已归档）
- **幂等性保证**：基于request_id防止重复调用
- **重试限制**：最大3次重试机制
- **版本管理**：每次状态变更自动创建版本快照
- **版本回放**：支持历史版本查看和回放
- **洞察导出**：支持JSON和Excel格式导出，包含注释概览、审批时间线、生效范围、版本历史、重新计算记录
- **生效范围**：支持指定图表、指标、维度、日期范围和全局生效

### 前端功能
- **统计卡片**：展示注释总数、各状态数量和指标统计
- **详情时间线**：可视化展示审批历史
- **版本列表**：查看和回放历史版本
- **审批工作流**：可视化的步骤展示和操作按钮
- **修正路径**：审批失败后的修正流程提示
- **洞察导出**：一键导出Excel报告

## 项目结构

```
.
├── backend/                 # 后端Node.js服务
│   ├── src/
│   │   ├── database/       # 数据库相关
│   │   │   ├── schema.sql  # 数据库表结构
│   │   │   └── db.js       # 数据库连接
│   │   ├── models/         # 数据模型
│   │   │   ├── Annotation.js
│   │   │   ├── ChartMetric.js
│   │   │   └── Export.js
│   │   ├── routes/         # API路由
│   │   │   ├── annotations.js
│   │   │   ├── metrics.js
│   │   │   └── export.js
│   │   ├── scripts/        # 脚本
│   │   │   └── init-db.js
│   │   └── index.js        # 入口文件
│   └── package.json
└── frontend/               # 前端React应用
    ├── src/
    │   ├── services/       # API服务
    │   │   └── api.js
    │   ├── components/     # React组件
    │   │   ├── StatisticCards.jsx
    │   │   ├── ApprovalTimeline.jsx
    │   │   ├── VersionList.jsx
    │   │   ├── AnnotationDetail.jsx
    │   │   └── ApprovalWorkflow.jsx
    │   ├── App.jsx         # 主应用
    │   └── index.js        # 入口文件
    ├── public/
    └── package.json
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 http://localhost:3001 启动

### 2. 初始化示例数据（可选）

```bash
npm run init-db
```

### 3. 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端应用将在 http://localhost:3000 启动

## 状态机流转说明

```
草稿(draft)
    ↓
待审批(pending_approval) ←──────────┐
    ↓                                │
已通过(approved)                     │ (修正后)
    ↓                                │
已发布(published)                    │
    ↓                                │
已归档(archived)                     │
                                      │
被驳回(rejected) → 待修正(correction_pending)
