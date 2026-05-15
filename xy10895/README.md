# 内部 API 目录站

一个基于 Node.js + Express + SQLite 后端，React + TypeScript + Ant Design 前端的全栈 API 目录管理系统。

## 功能特性

### 核心功能
- **API 目录列表** - 支持按名称、描述、端点搜索，按状态、方法、权限筛选
- **API 详情页面** - 包含基本信息、权限要求、示例请求、变更时间线
- **状态管理** - 支持 API 状态流转（草稿 -> 审核中 -> 活跃 -> 废弃 -> 归档）
- **批量导入** - 支持 CSV 文件批量导入 API 条目
- **报告导出** - 支持 JSON/CSV 格式导出 API 目录报告
- **收藏功能** - 用户可以收藏常用 API
- **负责人管理** - 管理 API 负责人信息

### 业务规则
- **目录检索** - 全文搜索 API 名称、描述、端点
- **权限说明** - 4 级权限等级（public/internal/confidential/restricted）
- **示例维护** - 每个 API 可维护多个请求/响应示例
- **负责人确认** - 创建 API 时可指定负责人
- **变更订阅** - 所有 API 变更自动记录时间线

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- Joi 参数校验
- Multer 文件上传
- CSV 解析/生成

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Ant Design 组件库
- React Router 路由
- Axios HTTP 客户端

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── server.js       # 服务入口
│   │   ├── routes/         # 路由定义
│   │   ├── controllers/      # 控制器
│   │   ├── middleware/     # 中间件
│   │   ├── config/         # 配置
│   │   ├── rules/          # 业务规则
│   │   └── scripts/        # 初始化脚本
│   └── package.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API 服务
│   │   ├── App.tsx       # 主应用
│   │   └── main.tsx      # 入口文件
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## 本地运行说明

### 前置要求
- Node.js >= 16.x
- npm 或 yarn

### 启动后端服务

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 初始化数据库（创建表并插入示例数据）
npm run init-db

# 启动开发服务器
npm start
```

后端服务将在 `http://localhost:3001` 启动

### 启动前端服务

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

## API 接口示例

### 健康检查
```bash
GET http://localhost:3001/api/health
```

**响应:**
```json
{
  "success": true,
  "message": "API Catalog service is running"
}
```

### 获取 API 列表
```bash
GET http://localhost:3001/api/apis?page=1&limit=20&search=用户&status=active
```

**响应:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "获取用户信息",
        "description": "根据用户ID获取用户详细信息",
        "endpoint": "/api/v1/users/:id",
        "method": "GET",
        "status": "active",
        "permission_level": "internal",
        "version": "1.0.0",
        "owner_name": "张三",
        "favorite_count": 0,
        "example_count": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3
    }
  }
}
```

### 创建新 API
```bash
POST http://localhost:3001/api/apis
Content-Type: application/json

{
  "name": "删除商品",
  "description": "删除指定商品记录",
  "endpoint": "/api/v1/products/:id",
  "method": "DELETE",
  "permission_level": "restricted",
  "version": "1.0.0"
}
```

**成功响应:**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "删除商品",
    "status": "draft",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 更新 API 状态
```bash
PATCH http://localhost:3001/api/apis/1/status
Content-Type: application/json

{
  "new_status": "deprecated",
  "changed_by": "admin@company.com",
  "reason": "API 已废弃，使用新接口替代"
}
```

### 添加示例请求
```bash
POST http://localhost:3001/api/apis/1/examples
Content-Type: application/json

{
  "title": "正常请求示例",
  "request_body": "{}",
  "response_body": "{\"id\": 1, \"name\": \"用户A\"}",
  "headers": "{\"Authorization\": \"Bearer token\"}"
}
```

### 获取负责人列表
```bash
GET http://localhost:3001/api/owners
```

### 导出报告
```bash
GET http://localhost:3001/api/export?format=json
GET http://localhost:3001/api/export?format=csv
```

### 收藏/取消收藏 API
```bash
POST http://localhost:3001/api/favorites/1/toggle
Content-Type: application/json

{
  "user_email": "user@example.com"
}
```

## 故意失败的路径示例

以下是一些会导致 API 调用失败的场景，用于测试错误处理：

### 1. 端点格式验证失败
```bash
POST http://localhost:3001/api/apis
Content-Type: application/json

{
  "name": "测试 API",
  "endpoint": "/v1/test",
  "method": "GET",
  "permission_level": "internal",
  "version": "1.0.0"
}
```

**失败原因:** 端点必须以 `/api` 开头

**响应:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["\"endpoint\" with value \"/v1/test\" fails to match the required pattern: /^\\/api/"]
}
```

### 2. 无效的状态转换
```bash
PATCH http://localhost:3001/api/apis/1/status
Content-Type: application/json

{
  "new_status": "active",
  "changed_by": "admin@company.com",
  "reason": "直接激活"
}
```

**失败原因:** 假设当前 API 状态为 `draft`，不能直接转换为 `active`，必须先经过 `reviewing` 状态

**响应:**
```json
{
  "success": false,
  "error": "Invalid status transition",
  "details": "Cannot transition from draft to active"
}
```

### 3. 版本号格式错误
```bash
POST http://localhost:3001/api/apis
Content-Type: application/json

{
  "name": "测试 API",
  "endpoint": "/api/v1/test",
  "method": "GET",
  "permission_level": "internal",
  "version": "v1.0"
}
```

**失败原因:** 版本号格式必须为 `x.y.z` 格式

**响应:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["\"version\" with value \"v1.0\" fails to match the required pattern: /^\\d+\\.\\d+\\.\\d+$/"]
}
```

### 4. 查询不存在的 API
```bash
GET http://localhost:3001/api/apis/9999
```

**失败原因:** API ID 不存在

**响应:**
```json
{
  "success": false,
  "error": "API entry not found"
}
```

### 5. 创建负责人邮箱重复
```bash
POST http://localhost:3001/api/owners
Content-Type: application/json

{
  "name": "张三",
  "email": "zhangsan@company.com",
  "department": "技术部"
}
```

**失败原因:** 邮箱已存在

**响应:**
```json
{
  "success": false,
  "error": "Owner with this email already exists"
}
```

## 状态流转图

```
draft (草稿)
  ↓
reviewing (审核中)
  ↓
active (活跃) ←→ deprecated (废弃)
  ↓
archived (归档)
```

## 权限等级说明

- **public** - 公开访问，无需认证
- **internal** - 内部访问，需要登录用户
- **confidential** - 机密访问，需要管理员权限
- **restricted** - 受限访问，需要超级管理员权限

## 开发提示

1. 数据库文件位于 `backend/data/api_catalog.db`
2. 首次运行需要执行 `npm run init-db` 初始化数据库
3. 前端通过 Vite 代理 `/api` 路径到后端服务
4. 所有 API 变更都会自动记录到变更日志

## 许可证

MIT
