# 插件市场审核台 - 完整全栈项目

## 项目概述

这是一个完整的插件市场审核平台，包含后端服务和前端应用。系统实现了插件版本的完整生命周期管理，包括安全扫描、人工审核、版本上架/下架、审核意见修正等功能。

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite 数据库
- JSON2CSV 导出

### 前端
- React 18 + TypeScript
- Vite 构建工具
- React Router 路由
- Axios HTTP 客户端
- Tailwind CSS 样式
- Lucide React 图标库

## 主要功能

### 核心规则
1. **版本上架复核**：审核通过后可提交复核，确保发布质量
2. **幂等性调用**：支持幂等性创建版本，避免重复提交
3. **失败重试限制**：安全扫描失败可重试，默认最多3次
4. **接口状态区分**：
   - SUCCESS：成功
   - PENDING_REVIEW：待复核
   - BLOCKED：已拦截
   - RETRYABLE：可重试

### 审核意见修正路径
- 支持对审核意见进行修正
- 记录修正理由和修正人
- 版本上架的处理理由可被复盘
- 修正记录在时间线中完整展示

### 权限声明变更处理
- 权限声明变化后自动进入复核流程
- 需要重新审核才能上架
- 变更记录在时间线中追踪

### 导出功能
下架记录按以下维度分组导出：
- 负责人（处理人）
- 时间（处理时间）
- 安全扫描结果（严重/高危/中危问题统计）

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.ts       # 服务入口
│   │   ├── database.ts     # 数据库操作
│   │   ├── stateMachine.ts # 状态机逻辑
│   │   ├── routes.ts       # API 路由
│   │   └── types.ts        # 类型定义
│   └── package.json
└── frontend/               # 前端应用
    ├── src/
    │   ├── components/     # 组件
    │   ├── pages/          # 页面
    │   ├── api.ts          # API 封装
    │   ├── types.ts        # 类型定义
    │   ├── utils.ts        # 工具函数
    │   └── App.tsx         # 应用入口
    └── package.json
```

## 版本状态机

状态流转：
```
草稿 → 已提交 → 安全扫描中
                    ↓
              ┌───────────────────┐
              │ 安全通过 → 待审核  │
              └─────────┬─────────┘
                        ↓
              ┌───────────────────┐
              │  审核通过 ↔ 待复核  │
              └─────────┬─────────┘
                        ↓
                    已上架 → 已下架
                        ↓
                      已归档
```

## 快速开始

### 启动后端服务
```bash
cd backend
npm install
npm run dev
```
后端服务运行在 http://localhost:3001

### 启动前端应用
```bash
cd frontend
npm install
npm run dev
```
前端应用运行在 http://localhost:3000

## API 接口

### 插件管理
- `GET /api/plugins` - 获取插件列表
- `POST /api/plugins` - 创建插件

### 版本管理
- `GET /api/versions` - 获取版本列表
- `GET /api/versions/:id` - 获取版本详情
- `POST /api/versions` - 创建版本（支持幂等性）
- `POST /api/versions/:id/submit` - 提交审核
- `POST /api/versions/:id/retry-scan` - 重试扫描
- `POST /api/versions/:id/review` - 审核处理
- `POST /api/versions/:id/recheck` - 提交复核
- `POST /api/versions/:id/publish` - 上架
- `POST /api/versions/:id/unpublish` - 下架
- `PUT /api/versions/:id/permissions` - 更新权限声明

### 审核意见
- `POST /api/review-opinions/:id/correct` - 修正审核意见

### 统计与导出
- `GET /api/statistics` - 获取统计数据
- `GET /api/export/unpublish-records` - 导下架记录（CSV）

## 前端页面

1. **概览页** - 统计卡片 + 最近版本列表
2. **版本列表** - 所有版本的完整列表
3. **版本详情** - 详情时间线 + 权限声明 + 安全扫描 + 审核意见 + 操作按钮
4. **统计页** - 完整统计数据 + 统计说明
5. **导出页** - 数据导出功能入口

## 特色功能

1. **完整时间线** - 记录版本生命周期内的所有操作
2. **权限声明管理** - 支持必填/可选权限，支持修改后复核
3. **安全扫描追踪** - 记录每次扫描结果和发现的问题
4. **审核意见修正** - 支持对审核意见进行修正并记录理由
5. **清晰状态标识** - 前端展示与后端接口状态严格对齐
