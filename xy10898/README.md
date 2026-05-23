# API Playground 历史库

> 🔬 解决开发者真实痛点：调试接口后保存请求时不泄露敏感参数的全栈Web应用

## ✨ 核心特性

### 🔒 敏感数据保护
- **自动检测**：识别 password, token, secret, api_key, auth 等敏感字段
- **多层遮蔽**：支持 partial(部分遮蔽), full(完全遮蔽), hash(哈希脱敏)
- **安全存储**：所有敏感数据在持久化前已脱敏

### 🔄 请求工作流
- **状态机管理**：pending → reviewing → approved/rejected → archived
- **审核追踪**：完整的状态变更历史和审核意见
- **重复检测**：基于请求哈希的重复提交防止

### 📊 数据管理
- **环境隔离**：Development / Production / Staging 多环境
- **收藏夹**：常用请求快速访问
- **数据导出**：JSON 和 CSV 格式导出
- **共享链接**：带权限控制的分享功能

## 🏗️ 技术栈

### 后端
- **Node.js** + **Express** - Web框架
- **SQLite3** - 轻量级数据库
- **UUID** - 唯一标识符
- **Crypto** - 哈希和加密功能

### 前端
- **React 18** - UI框架
- **React Router** - 路由管理
- **Axios** - HTTP客户端
- **Vite** - 构建工具
- **Bootstrap 5** - CSS框架

## 🚀 快速开始

### 前置要求
- Node.js >= 16.x
- npm 或 yarn

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 初始化数据库和样例数据

```bash
# 方式1：使用项目根目录脚本
npm run seed

# 方式2：进入后端目录
cd server && npm run seed
```

这会创建：
- 2个环境（Development / Production）
- 5个示例请求（包含成功、失败、待审核等状态）
- 多个响应记录（包含错误响应）
- 4条审核历史记录
- 2个收藏记录
- 1个共享记录

### 启动应用

```bash
# 方式1：同时启动前后端
npm run dev

# 方式2：分别启动
# 终端1 - 后端（端口3001）
cd server && npm run dev

# 终端2 - 前端（端口5173）
cd client && npm run dev
```

启动后访问：
- 前端UI: http://localhost:5173
- 后端API: http://localhost:3001
- 健康检查: http://localhost:3001/api/health

## 🎯 功能演示

### 1. ✅ 成功场景 - 创建新请求

**步骤：**
1. 点击 "New Request"
2. 填写名称：`User Login Test`
3. 选择方法：`POST`
4. 填写URL：`/api/auth/login`
5. Headers填写：
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
   }
   ```
6. Body填写：
   ```json
   {
     "username": "test_user",
     "password": "mySecretPass123",
     "remember_me": true
   }
   ```
7. 点击 "Create Request"

**预期结果：**
- ✅ 请求创建成功（状态201）
- ✅ `Authorization` header 被自动检测并遮蔽
- ✅ `password` 字段被自动检测并遮蔽
- ✅ 请求初始状态为 `pending`
- 🔍 可在详情页查看被遮蔽的敏感字段

---

### 2. ⚠️ 重复提交场景 - 防重复机制

**步骤：**
1. 先按上述成功场景创建一个请求
2. 再次填写 **完全相同** 的内容（相同URL + 相同Headers + 相同Body）
3. 点击 "Create Request" 或 "Test Duplicate Detection"

**预期结果：**
- ❌ 请求被拒绝（状态409 Conflict）
- 📋 显示错误信息：`Duplicate request`
- 🔗 显示已存在请求的ID
- 💡 演示了基于请求内容哈希的幂等性保护

---

### 3. 🔄 状态流转 - 审核工作流

**步骤：**
1. 从Dashboard点击任意请求进入详情页
2. 查看右侧 "Available Actions" 区域
3. 点击状态转换按钮（如 `→ reviewing`）
4. 在弹窗中填写审核意见并提交
5. 查看底部 "Review History" 时间线

**状态流转图：**
```
pending ──→ reviewing ──→ approved ──→ archived
   │           │           ↑
   │           └────→ rejected
   │                       ↑
   └───────────────────────┘
```

**预期结果：**
- ✅ 状态按规则转换
- ✅ 审核记录添加到时间线
- ✅ 记录操作人和操作时间
- ✅ 评论内容永久保存

---

### 4. ❌ 异常响应 - 错误处理

**查看样例：**
1. 从Dashboard点击 `User Login - Failure (Wrong Password)`
2. 展开 Response accordion
3. 查看：
   - 红色错误标识 badge
   - 错误消息展示
   - 响应时间记录

**预期结果：**
- ⚠️ 错误响应有明显的视觉标识
- 📝 完整的错误信息记录
- ⏱️ 响应时间追踪
- 📊 错误状态码显示

---

### 5. 📥 数据导出 - 报表功能

**步骤：**
1. 在Dashboard页面右上角
2. 点击 "Export JSON" 或 "Export CSV"
3. 文件自动下载

**或单个请求导出：**
1. 进入请求详情页
2. 点击 "Export" 按钮

**预期结果：**
- 📄 完整的请求元数据
- 📊 响应统计信息
- 📜 审核历史摘要
- 💾 支持JSON和CSV两种格式

---

### 6. 🔍 搜索过滤 - 数据检索

**步骤：**
1. 在Dashboard的搜索框输入关键词（如 "login"）
2. 使用状态下拉框筛选（如只看 "pending" 状态）
3. 点击 "Clear Filters" 重置

**预期结果：**
- 🔍 按名称和URL模糊搜索
- 📊 实时统计更新
- ⚡ 客户端快速过滤

---

### 7. ⭐ 收藏功能 - 快速访问

**步骤：**
1. 进入任意请求详情页
2. 点击 "⭐ Favorite" 按钮
3. 再次点击会提示已收藏

**预期结果：**
- ✅ 收藏关系创建
- 🔒 防止重复收藏
- 📋 用户级收藏隔离

---

### 8. 🔗 共享功能 - 权限控制

**API调用示例：**
```bash
# 创建共享链接
curl -X POST http://localhost:3001/api/share \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "your-request-uuid",
    "shared_by": "developer",
    "permission_level": "view",
    "expires_in": 3600
  }'

# 通过token访问共享内容
curl http://localhost:3001/api/share/token/{share_token}
```

**权限级别：**
- `view` - 仅查看基本信息（脱敏后）
- `edit` - 完整访问权限

## 📡 API 文档

### 请求管理

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/requests` | 创建新请求 |
| `GET` | `/api/requests` | 查询请求列表（支持过滤） |
| `GET` | `/api/requests/:id` | 获取单个请求详情 |
| `PATCH` | `/api/requests/:id/status` | 更新请求状态 |
| `POST` | `/api/requests/:id/response` | 添加响应记录 |

### 环境管理

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/environments` | 创建环境 |
| `GET` | `/api/environments` | 获取所有环境 |
| `GET` | `/api/environments/:id` | 获取单个环境 |
| `PATCH` | `/api/environments/:id` | 更新环境 |

### 收藏夹

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/favorites` | 添加收藏 |
| `GET` | `/api/favorites` | 获取收藏列表 |
| `DELETE` | `/api/favorites/:id` | 取消收藏 |

### 数据导出

| 方法 | 端点 | 描述 |
|------|------|------|
| `GET` | `/api/export/requests` | 导出所有请求 |
| `GET` | `/api/export/requests/:id` | 导出单个请求详情 |

### 共享功能

| 方法 | 端点 | 描述 |
|------|------|------|
| `POST` | `/api/share` | 创建共享链接 |
| `GET` | `/api/share/token/:token` | 通过token访问共享内容 |
| `GET` | `/api/share` | 获取共享列表 |
| `DELETE` | `/api/share/:id` | 撤销共享 |

## 🗄️ 数据模型

### Environments
- `id`: UUID主键
- `name`: 环境名称
- `description`: 描述
- `variables`: 环境变量JSON
- `created_at`, `updated_at`: 时间戳

### Requests
- `id`: UUID主键
- `environment_id`: 关联环境
- `name`: 请求名称
- `method`: HTTP方法
- `url`: 请求URL
- `headers`: 请求头JSON（已脱敏）
- `body`: 请求体JSON（已脱敏）
- `sensitive_fields`: 敏感字段列表JSON
- `status`: 状态 (pending/reviewing/approved/rejected/archived)
- `created_by`: 创建者
- `request_hash`: 请求内容哈希（用于重复检测）

### Responses
- `id`: UUID主键
- `request_id`: 关联请求
- `status_code`: HTTP状态码
- `headers`: 响应头JSON
- `body`: 响应体JSON
- `response_time`: 响应时间（ms）
- `is_error`: 是否为错误响应
- `error_message`: 错误消息

### Reviews
- `id`: UUID主键
- `request_id`: 关联请求
- `reviewer_id`: 审核人
- `action`: 操作类型
- `comment`: 审核意见
- `previous_status`: 之前状态
- `new_status`: 新状态
- `created_at`: 创建时间

### Favorites
- `id`: UUID主键
- `request_id`: 关联请求
- `user_id`: 用户ID
- `note`: 备注
- `created_at`: 创建时间

### SharedRecords
- `id`: UUID主键
- `request_id`: 关联请求
- `share_token`: 分享token
- `shared_by`: 分享人
- `permission_level`: 权限级别
- `expires_at`: 过期时间

## 🧪 测试脚本

### 使用 curl 测试API

```bash
# 1. 健康检查
curl http://localhost:3001/api/health

# 2. 创建一个包含敏感数据的请求
curl -X POST http://localhost:3001/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment API Test",
    "method": "POST",
    "url": "/api/payment/create",
    "headers": {
      "Content-Type": "application/json",
      "X-API-Key": "sk_live_abcdefghijklmnop"
    },
    "body": {
      "amount": 99.99,
      "currency": "USD",
      "card_number": "4242424242424242",
      "cvv": "123"
    },
    "created_by": "tester"
  }'

# 3. 获取所有请求
curl http://localhost:3001/api/requests

# 4. 测试重复提交（使用相同的body再次提交）

# 5. 导出数据
curl -O http://localhost:3001/api/export/requests?format=json
```

## 📁 项目结构

```
api-playground-history/
├── server/                    # 后端
│   ├── src/
│   │   ├── index.js          # 应用入口
│   │   ├── database.js       # 数据库配置
│   │   ├── routes/           # API路由
│   │   │   ├── requests.js
│   │   │   ├── environments.js
│   │   │   ├── favorites.js
│   │   │   ├── export.js
│   │   │   └── share.js
│   │   └── utils/            # 工具函数
│   │       ├── maskUtils.js  # 敏感数据遮蔽
│   │       └── statusMachine.js # 状态机
│   ├── scripts/
│   │   └── seed.js           # 种子数据脚本
│   └── data/                 # SQLite数据库文件
├── client/                    # 前端
│   ├── src/
│   │   ├── App.jsx           # 主应用
│   │   ├── main.jsx          # 入口
│   │   ├── index.css         # 样式
│   │   ├── components/       # 组件
│   │   │   ├── Layout.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── MethodBadge.jsx
│   │   └── pages/            # 页面
│   │       ├── Dashboard.jsx
│   │       ├── RequestDetail.jsx
│   │       └── CreateRequest.jsx
│   └── index.html
├── package.json
└── README.md
```

## 🔮 核心实现原理

### 敏感字段遮蔽算法
```javascript
// 检测：基于字段名模式匹配
const sensitivePatterns = [
  /password/i, /secret/i, /token/i,
  /api[_-]?key/i, /auth/i, /credential/i
];

// 遮蔽策略
const maskStrategies = {
  partial: (val) => val[0] + '*'.repeat(val.length-2) + val[val.length-1],
  full: () => '***',
  hash: (val) => sha256(val).substring(0, 8)
};
```

### 请求哈希生成
```javascript
// 标准化 headers + body + method + url
const normalizedData = normalize(request);
const requestHash = crypto.createHash('md5')
  .update(JSON.stringify(normalizedData))
  .digest('hex');
```

### 状态机校验
```javascript
const STATUS_TRANSITIONS = {
  pending: ['reviewing', 'archived'],
  reviewing: ['approved', 'rejected', 'pending'],
  approved: ['archived'],
  rejected: ['pending', 'reviewing', 'archived'],
  archived: ['pending']
};
```

## 📝 开发要点

### 后端启动
- 端口：3001
- 数据库：自动创建于 `server/data/database.db`
- CORS：已配置允许 localhost:5173

### 前端启动
- 端口：5173
- API代理：`/api/*` → `http://localhost:3001/api/*`
- 热重载：已启用

## 🤝 扩展建议

1. **用户认证**：集成 JWT / OAuth2
2. **团队协作**：多用户 / 组织支持
3. **Webhook**：状态变更通知
4. **版本对比**：请求变更diff查看
5. **实时同步**：WebSocket 推送更新

## 📄 许可证

MIT License
