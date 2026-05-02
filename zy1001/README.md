# 小团队客服工单台

一个轻量级的客服工单管理系统，适合 5-10 人的小团队内部使用。

## 功能特性

### 核心功能
- **工单列表**：查看所有工单，支持按负责人、状态、优先级、标签和关键词筛选
- **工单详情**：查看客户信息、问题描述、处理记录、评论区、状态变化时间线
- **新建/编辑工单**：填写标题、客户、优先级、问题描述等信息
- **状态流转**：严格的状态流转规则
  - 待处理 → 处理中 → 待确认 → 已关闭
  - 已关闭的工单不能修改正文，但可以继续追加评论

### 实用功能
- **CSV 导入**：支持从 Excel/CSV 批量导入历史工单，导入后显示成功/失败记录
- **CSV 导出**：支持将当前筛选结果导出为 CSV，方便周会分享
- **前后端双重校验**：前端表单提示，后端严格校验

### 数据持久化
- 使用 SQLite 文件数据库，数据存储在 `server/data/tickets.db`
- 刷新页面数据不丢失

## 技术栈

**后端**：
- Node.js + Express + TypeScript
- better-sqlite3（SQLite 数据库）
- csv-parse/csv-stringify（CSV 处理）

**前端**：
- React + TypeScript + Vite
- Ant Design（UI 组件库）
- React Router（路由）
- dayjs（日期处理）

## 项目结构

```
zy1001/
├── server/                    # 后端项目
│   ├── src/
│   │   ├── database/         # 数据库连接和初始化
│   │   │   ├── connection.ts
│   │   │   └── init.ts
│   │   ├── dao/              # 数据访问层
│   │   │   ├── ticketDao.ts
│   │   │   ├── commentDao.ts
│   │   │   └── statusHistoryDao.ts
│   │   ├── routes/           # API 路由
│   │   │   └── tickets.ts
│   │   ├── validators/       # 校验逻辑
│   │   │   └── index.ts
│   │   ├── utils/            # 工具函数
│   │   │   └── csvHandler.ts
│   │   ├── types/            # 类型定义
│   │   │   └── index.ts
│   │   └── index.ts          # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── client/                    # 前端项目
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── TicketList.tsx    # 工单列表页
│   │   │   ├── TicketDetail.tsx  # 工单详情页
│   │   │   └── TicketForm.tsx    # 新建/编辑工单页
│   │   ├── services/         # API 服务
│   │   │   └── api.ts
│   │   ├── types/            # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx           # 主应用组件
│   │   ├── main.tsx          # 入口文件
│   │   └── index.css         # 全局样式
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

**1. 安装后端依赖**

```bash
cd server
npm install
```

**2. 安装前端依赖**

```bash
cd ../client
npm install
```

### 启动服务

**1. 启动后端服务**

```bash
cd server
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

**2. 启动前端服务（新开一个终端窗口）**

```bash
cd client
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

### 访问应用

打开浏览器访问：`http://localhost:3000`

## API 接口

### 工单管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tickets | 获取工单列表（支持筛选） |
| GET | /api/tickets/metadata | 获取元数据（状态、优先级、负责人、标签） |
| GET | /api/tickets/:id | 获取工单详情 |
| POST | /api/tickets | 创建工单 |
| PUT | /api/tickets/:id | 更新工单 |
| POST | /api/tickets/:id/status | 更新工单状态 |

### 评论管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tickets/:id/comments | 获取工单评论 |
| POST | /api/tickets/:id/comments | 添加评论 |

### CSV 导入导出

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/tickets/import | 导入 CSV |
| POST | /api/tickets/export | 导出 CSV |

## 状态流转规则

```
┌──────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────┐
│  待处理  │───>│  处理中  │───>│     待确认       │───>│  已关闭  │
│ pending  │    │in_progress│   │pending_confirmation│   │  closed  │
└──────────┘    └──────────┘    └──────────────────┘    └──────────┘
                                           ^
                                           │
                                        可回退
```

**流转限制**：
- 待处理 → 处理中
- 处理中 → 待确认
- 待确认 → 处理中 或 已关闭
- 已关闭：不能再修改状态，也不能修改正文内容，但可以继续添加评论

## CSV 格式说明

### 导入格式

CSV 文件需要包含以下列：

| 列名 | 必填 | 说明 |
|------|------|------|
| 标题 | 是 | 工单标题 |
| 客户名称 | 是 | 客户姓名 |
| 客户联系方式 | 是 | 电话/微信/邮箱等 |
| 问题描述 | 是 | 详细问题描述 |
| 优先级 | 否 | 低/中/高/紧急，默认"中" |
| 负责人 | 否 | 处理人姓名 |
| 标签 | 否 | 多个标签用逗号分隔 |

也支持英文列名：title, customerName, customerContact, description, priority, assignee, tags

### 示例 CSV

```csv
标题,客户名称,客户联系方式,问题描述,优先级,负责人,标签
登录问题,张三,13800138000,用户反映无法登录系统,高,李四,登录,认证
付款失败,王五,wangwu@example.com,用户付款后订单状态未更新,紧急,赵六,支付,订单
```

## 数据备份

SQLite 数据库文件位于 `server/data/tickets.db`，定期备份此文件即可。

## 生产部署

### 构建生产版本

**后端**：
```bash
cd server
npm run build
npm start
```

**前端**：
```bash
cd client
npm run build
```

构建后的前端文件位于 `client/dist` 目录，可以部署到任何静态文件服务器。

### 环境变量

后端支持以下环境变量：
- `PORT`: 服务端口，默认 3001

## 开发说明

### 前端 API 代理

前端开发环境通过 Vite 的代理功能将 `/api` 开头的请求转发到后端 `http://localhost:3001`，配置见 `client/vite.config.ts`。

### 类型共享

前后端各自维护类型定义文件，保持一致即可。如果需要更完善的类型共享，可以考虑使用 monorepo 方案。

## 许可证

MIT License
