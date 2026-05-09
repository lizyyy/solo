# 直播推送系统 (Live Push System)

一个稳定可靠的直播消息推送系统，专注于流程稳定性，解决高并发场景下的消息顺序、延迟、重复提交、并发冲突等问题。

## 功能特性

### 核心稳定性保证
- **消息顺序保证**：使用 Redis Streams 消息队列，确保消息按顺序处理
- **幂等性控制**：通过 X-Idempotency-Key 防止重复提交
- **并发锁机制**：分布式锁防止多人同时修改同一条数据
- **自动重试机制**：任务失败后自动重试，支持手动重试
- **断网重试**：前端网络中断时保存请求，恢复后自动重试

### 系统功能
- 用户认证与权限管理（管理员、操作员、查看者）
- 推送消息管理（创建、编辑、取消、删除、重试）
- 推送类型支持（广播、定向、系统）
- 优先级队列
- 定时发送
- 操作审计日志（所有关键操作可追溯）
- Excel 报告导出

### 技术架构
- **后端**：Node.js + Express + MongoDB + Redis
- **前端**：Vue 3 + TypeScript + Element Plus
- **消息队列**：Redis Streams
- **容器化**：Docker + Docker Compose

## 快速开始

### 方式一：Docker 启动（推荐）

```bash
# 克隆项目
cd xy10017

# 启动所有服务
docker-compose up -d

# 初始化测试数据（首次启动后执行）
docker exec live-push-backend node src/scripts/seed.js
```

访问 http://localhost 即可使用系统

### 方式二：本地开发

#### 环境要求
- Node.js >= 18
- MongoDB >= 6
- Redis >= 7

#### 启动后端

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 启动开发服务器
npm run dev

# 初始化测试数据（新终端）
node src/scripts/seed.js
```

#### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 即可使用

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员（所有权限） |
| operator | operator123 | 操作员（可管理推送） |
| viewer | viewer123 | 查看者（只读权限） |

## API 文档

### 认证接口

#### 登录
```
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}
```

#### 获取当前用户
```
GET /api/auth/profile
Authorization: Bearer <token>
```

### 推送管理接口

#### 创建推送
```
POST /api/push
Headers:
  X-Idempotency-Key: <unique-key>
  Authorization: Bearer <token>

{
  "title": "消息标题",
  "content": "消息内容",
  "pushType": "broadcast", // broadcast | targeted | system
  "targetUsers": ["user1", "user2"], // targeted 类型需要
  "priority": 0, // -10 到 10
  "scheduledAt": "2024-01-01T12:00:00Z" // 可选，定时发送
}
```

#### 获取推送列表
```
GET /api/push?page=1&limit=20&status=sent
Query Parameters:
  - page: 页码
  - limit: 每页数量
  - status: 状态筛选 (pending|queued|processing|sent|failed|cancelled)
  - pushType: 类型筛选 (broadcast|targeted|system)
  - keyword: 搜索关键词
```

#### 更新推送
```
PUT /api/push/:id
Headers:
  Authorization: Bearer <token>
```

#### 取消推送
```
POST /api/push/:id/cancel
```

#### 重试推送
```
POST /api/push/:id/retry
```

#### 删除推送
```
DELETE /api/push/:id
```

#### 获取统计信息
```
GET /api/push/statistics
```

### 审计日志接口

#### 获取操作日志
```
GET /api/audit?page=1&limit=20
Query Parameters:
  - page: 页码
  - limit: 每页数量
  - action: 操作类型
  - userId: 用户ID
  - resourceType: 资源类型
  - startDate: 开始日期
  - endDate: 结束日期
```

### 报告导出接口

#### 导出推送报告
```
GET /api/reports/push/export?startDate=2024-01-01&endDate=2024-12-31
```

#### 导出审计报告
```
GET /api/reports/audit/export
```

## 系统架构说明

### 消息处理流程

1. **提交阶段**
   - 生成唯一的幂等性 Key
   - 保存消息到数据库，状态为 `queued`
   - 消息加入 Redis Stream

2. **处理阶段**
   - Worker 从 Stream 读取消息
   - 状态更新为 `processing`
   - 执行推送逻辑

3. **完成阶段**
   - 成功：状态更新为 `sent`，记录送达数量
   - 失败：检查重试次数，未超限则重新排队

### 并发控制

- **分布式锁**：使用 Redis SETNX 实现资源锁
- **乐观锁**：MongoDB 版本字段检测冲突
- **请求锁**：幂等性请求处理期间的互斥锁

### 重试机制

- **自动重试**：Worker 内部自动重试失败消息
- **手动重试**：用户界面手动触发重试
- **断网重试**：前端离线请求本地存储，联网后自动重试

## 目录结构

```
xy10017/
├── backend/
│   ├── src/
│   │   ├── config/          # 配置
│   │   ├── middleware/      # 中间件（认证、幂等性、并发锁）
│   │   ├── models/          # 数据模型
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务服务
│   │   ├── utils/           # 工具函数
│   │   ├── scripts/         # 脚本（数据初始化）
│   │   └── server.js        # 入口文件
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── layouts/         # 布局组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # 状态管理
│   │   ├── styles/          # 样式
│   │   ├── types/           # TypeScript 类型
│   │   ├── views/           # 页面组件
│   │   ├── App.vue
│   │   └── main.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   └── package.json
├── docker-compose.yml
├── .env
└── README.md
```

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| MONGO_URI | MongoDB 连接串 | mongodb://localhost:27017/live_push |
| REDIS_URL | Redis 连接串 | redis://localhost:6379 |
| JWT_SECRET | JWT 密钥 | your-secret-key |
| JWT_EXPIRES_IN | Token 有效期 | 7d |
| MAX_RETRY_ATTEMPTS | 最大重试次数 | 3 |
| RETRY_DELAY_MS | 重试延迟（毫秒） | 5000 |
| CONSUMER_GROUP | Redis 消费者组 | push-consumers |

## 监控与调试

### 健康检查
```
GET /health
```

### 日志
- 系统日志输出到控制台
- 所有关键操作记录到数据库审计日志
- 可通过 API 导出日志报告

### 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理（定时任务） |
| queued | 已加入队列 |
| processing | 正在处理 |
| sent | 发送成功 |
| failed | 发送失败 |
| cancelled | 已取消 |

## 故障处理

### 常见问题

1. **消息积压**
   - 检查 Redis Stream 状态
   - 增加 Worker 实例（支持水平扩展）

2. **重试耗尽**
   - 查看错误信息，修复问题后手动重试
   - 调整 `MAX_RETRY_ATTEMPTS` 配置

3. **并发冲突**
   - 系统会返回 409 错误
   - 稍后重试或刷新数据后再操作

### 数据一致性

- 所有写操作都有审计日志
- 消息状态变更完整记录
- 支持版本回滚追溯

## License

MIT
