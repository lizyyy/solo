# 内容审核申诉工作台

一个完整的内容审核申诉管理系统，支持申诉创建、审核流转、证据附件、角色权限、搜索筛选、操作日志和数据导出。

## 功能特性

### 核心业务流程
- **申诉创建**：新建申诉工单，支持多种内容类型（文本、图片、视频、音频、链接等）
- **审核队列**：管理员分配/操作员领取申诉
- **申诉流转**：待处理 → 处理中 → 待复核 → 已通过/已驳回
- **证据附件**：支持多文件上传，作为申诉证据
- **二次复核**：操作员处理后提交复核，复核员最终裁决
- **历史追溯**：完整的状态流转记录和操作日志

### 系统特性
- **角色权限**：三级角色体系（管理员/复核员/操作员）
- **搜索筛选**：支持状态、类型、关键词、时间范围等多维度搜索
- **操作日志**：全量操作审计，可查询可导出
- **数据导出**：申诉列表、申诉详情、操作日志均可导出CSV
- **数据安全**：JWT 认证，状态和证据持久化不丢失

## 项目结构

```
.
├── backend/              # 后端服务
│   ├── src/
│   │   ├── database.js   # SQLite 数据库初始化
│   │   ├── index.js      # 服务入口
│   │   ├── middleware/   # 中间件（JWT认证）
│   │   ├── routes/       # API 路由
│   │   └── utils/        # 工具函数（日志记录）
│   ├── data/             # SQLite 数据库文件（自动创建）
│   └── uploads/          # 附件存储目录（自动创建）
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── api/          # API 封装
│   │   ├── context/      # React Context（认证状态）
│   │   ├── components/   # 公共组件
│   │   └── pages/        # 页面组件
│   └── vite.config.js    # Vite 配置
└── package.json          # 根 package（npm workspaces）
```

## 快速开始

### 前置要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

同时启动前后端：

```bash
npm run dev
```

或者分别启动：

```bash
# 后端（端口 3001）
npm run dev:backend

# 前端（端口 5173）
npm run dev:frontend
```

### 访问地址
- 前端：http://localhost:5173
- 后端 API：http://localhost:3001/api

### 生产部署

```bash
# 构建
npm run build

# 启动
npm run start
```

## 测试账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | admin123 | 系统管理员 | 全部权限，分配操作员，查看日志 |
| reviewer | reviewer123 | 复核员 | 复核申诉，查看申诉 |
| operator | operator123 | 操作员 | 领取、处理申诉，提交复核 |

## 业务流程说明

### 1. 申诉创建
- 任意角色可创建申诉
- 填写标题、内容、类型、来源等信息

### 2. 申诉分配/领取
- **管理员**：可在列表页直接分配给指定操作员
- **操作员**：可在列表页领取待处理的申诉
- 申诉状态从「待处理」变为「处理中」

### 3. 申诉处理
- 操作员处理自己领取的申诉
- 可上传证据附件
- 填写处理意见（建议通过/建议驳回）
- 提交后状态变为「待复核」

### 4. 复核裁决
- 复核员查看申诉详情和处理意见
- 可复核通过或复核驳回
- 状态变为「已通过」或「已驳回」，申诉完结

### 5. 数据导出
- 申诉列表可批量导出
- 单条申诉可导出完整详情（含流转记录、附件列表）
- 操作日志仅管理员可导出

## API 接口概览

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `GET /api/auth/users` - 获取所有用户

### 申诉
- `GET /api/appeals` - 申诉列表
- `GET /api/appeals/stats` - 统计数据
- `GET /api/appeals/:id` - 申诉详情
- `POST /api/appeals` - 创建申诉
- `PUT /api/appeals/:id` - 更新申诉
- `POST /api/appeals/:id/assign` - 分配操作员（管理员）
- `POST /api/appeals/:id/pickup` - 领取申诉（操作员）
- `POST /api/appeals/:id/submit-review` - 提交复核
- `POST /api/appeals/:id/review` - 复核（复核员）

### 附件
- `POST /api/attachments/:appealId/upload` - 上传附件
- `GET /api/attachments/:id/download` - 下载附件
- `DELETE /api/attachments/:id` - 删除附件

### 导出
- `GET /api/export/appeals` - 导出申诉列表
- `GET /api/export/appeal/:id` - 导出申诉详情

### 操作日志（管理员）
- `GET /api/logs` - 日志列表
- `GET /api/logs/export` - 导出日志

## 状态流转

```
待处理 ──→ 处理中 ──→ 待复核 ──→ 已通过
   │          │          │
   └──────────┴──────────┴──→ 已驳回
```

## 技术栈

- **后端**：Node.js + Express + SQLite (better-sqlite3) + JWT
- **前端**：React 18 + Ant Design 5 + Vite + React Router
- **文件上传**：express-fileupload
- **数据导出**：json2csv

## 注意事项

1. **数据库**：首次启动自动创建 SQLite 数据库和演示用户
2. **附件存储**：文件存储在 `backend/uploads/` 目录
3. **Token**：JWT Token 有效期 24 小时
4. **数据持久化**：所有状态流转和证据附件都持久化到数据库，确保不丢失
