# 🔐 幂等键审计服务

用于追踪和分析API幂等请求的全栈Web应用，帮助解决重复提交问题。

## ✨ 功能特性

### 核心规则
- **请求指纹比对** - 使用SHA256生成请求指纹，检测相同幂等键下的请求内容变化
- **结果复用** - 相同指纹的重复请求自动返回首次响应结果
- **冲突拦截** - 请求指纹不匹配时标记为冲突状态
- **过期清理** - 自动管理幂等键生命周期
- **审计检索** - 完整记录所有请求历史和状态变更

### 前端功能
- 📊 **统计概览** - 总记录数、活跃、冲突、复用统计
- 🔍 **列表筛选** - 按服务、状态、幂等键搜索
- 📋 **详情时间线** - 查看完整请求历史和审计轨迹
- ⚡ **模拟请求** - 一键模拟首次/重复/冲突请求
- 📥 **批量导入** - JSON格式批量导入记录
- 📤 **报告导出** - CSV格式导出审计报告

### 后端API
- `POST /api/records` - 创建或查询幂等记录
- `GET /api/records` - 查询记录列表（支持筛选）
- `GET /api/records/:id` - 获取记录详情
- `PUT /api/records/:id/status` - 更新记录状态
- `GET /api/statistics` - 获取统计数据
- `POST /api/cleanup` - 清理过期记录
- `GET /api/export` - 导出CSV报告
- `POST /api/import` - 批量导入
- `POST /api/simulate` - 模拟幂等请求

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite（持久化存储）
- **前端**: 原生 HTML/CSS/JavaScript
- **依赖**:
  - `sqlite3` - 数据库驱动
  - `csv-writer` - CSV导出
  - `cors` - 跨域支持
  - `multer` - 文件上传

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化演示数据（可选）

```bash
npm run init-demo
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 📁 项目结构

```
idempotency-audit-service/
├── server/
│   ├── index.js              # 服务入口
│   ├── routes/
│   │   └── api.js           # API路由
│   ├── controllers/
│   │   └── idempotencyController.js  # 控制器
│   ├── services/
│   │   └── idempotencyService.js     # 业务逻辑
│   ├── database/
│   │   └── schema.js        # 数据库初始化
│   └── scripts/
│       └── init-demo.js     # 演示数据脚本
├── public/
│   ├── index.html           # 前端页面
│   ├── styles.css           # 样式文件
│   └── app.js              # 前端逻辑
├── data/                     # 数据目录（自动创建）
│   ├── idempotency-audit.db
│   └── downloads/
├── package.json
└── README.md
```

## 🧪 使用演示

1. 启动服务后访问 `http://localhost:3000`

2. **模拟请求流程**：
   - 点击"⚡ 模拟请求"按钮
   - 填写幂等键、选择服务和API端点
   - 点击"发送请求" - 首次请求创建新记录
   - 再次点击"发送请求" - 相同指纹复用响应
   - 点击"发送冲突请求" - 修改请求体触发冲突检测

3. **查看详情**：
   - 在列表中点击"详情"按钮
   - 查看请求指纹、历史时间线、冲突原因

4. **导出报告**：
   - 点击"📤 导出报告"下载CSV格式审计报告

## 🔑 核心概念

### 幂等键 (Idempotency Key)
- 客户端在请求头中传递的唯一标识符，用于标识同一个业务操作

### 请求指纹 (Request Fingerprint)
- 使用SHA256哈希生成的请求内容摘要
- 包含：HTTP方法 + API端点 + 请求体 + 关键请求头
- 用于检测同一幂等键下的请求内容是否一致

### 状态流转
```
active (活跃) → 首次请求成功
   ↓
conflict (冲突) → 请求指纹不匹配
   ↓
expired (过期) → 超过24小时有效期
```

## 📊 数据模型

### idempotency_keys（幂等键表）
- `idempotency_key` - 幂等键（唯一）
- `service_name` - 服务名称
- `api_endpoint` - API端点
- `request_fingerprint` - 请求指纹SHA256
- `request_method` - HTTP方法
- `request_body` - 请求体JSON
- `first_request_at` - 首次请求时间
- `last_request_at` - 最后请求时间
- `first_response_status` - 首次响应状态码
- `first_response_body` - 首次响应体JSON
- `request_count` - 请求次数
- `status` - 状态：active/conflict/expired
- `conflict_reason` - 冲突原因
- `expires_at` - 过期时间

### request_logs（请求日志表）
- 记录所有请求历史
- 标记是否复用响应或冲突
- 记录每个请求的时间戳

### audit_trails（审计轨迹表）
- 记录状态变更历史
- 记录操作人、变更原因、时间戳

## 📝 License

MIT
