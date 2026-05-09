# 活动报名系统 - 快速开始指南

## 项目结构

```
xy10040/
├── ARCHITECTURE.md          # 系统架构设计文档
├── QUICKSTART.md           # 本文件
├── backend/                # 后端服务 (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/         # 配置模块
│   │   ├── database/       # 数据库连接和迁移
│   │   ├── middleware/     # Express中间件
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑层
│   │   ├── types/          # TypeScript类型定义
│   │   ├── utils/          # 工具函数
│   │   ├── app.ts          # Express应用
│   │   └── index.ts        # 服务入口
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/               # 前端应用 (React + TypeScript + Vite)
    ├── src/
    │   ├── components/     # React组件
    │   ├── lib/            # API客户端
    │   ├── pages/          # 页面组件
    │   ├── store/          # 状态管理
    │   ├── types/          # 类型定义
    │   ├── main.tsx        # 应用入口
    │   └── index.css       # 样式
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── tailwind.config.js
```

---

## 系统核心特性

### 1. 防重复提交
- **机制**: 幂等性Token (`X-Idempotency-Token`)
- **实现**: SHA256请求哈希 + 24小时有效期
- **位置**: `backend/src/services/idempotency.service.ts`

### 2. 并发控制
- **乐观锁**: `version` 字段，更新时检查版本
- **分布式锁**: PostgreSQL实现，支持超时自动释放
- **事务隔离**: 报名操作使用 `SERIALIZABLE` 级别
- **位置**: 
  - `backend/src/services/lock.service.ts`
  - `backend/src/services/registration.service.ts:43-112`

### 3. 操作追踪与回放
- **事件溯源**: 所有状态变更记录到 `event_log` 表
- **回放机制**: 支持按时间点重建状态
- **请求追踪**: `X-Request-Id` 贯穿全链路
- **位置**: `backend/src/services/event-log.service.ts`

### 4. 导出功能
- **Excel**: `ExcelJS` 生成，包含汇总和明细sheet
- **Markdown**: 结构化文本，支持表格
- **PDF**: `PDFKit` 生成，美观的排版
- **位置**: `backend/src/services/export.service.ts`

---

## 前置要求

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 12.0
- **npm** 或 **yarn**

---

## 快速启动

### 第一步: 安装依赖

```bash
# 后端
cd backend
npm install

# 前端 (新开终端)
cd frontend
npm install
```

### 第二步: 配置环境变量

```bash
# 后端
cd backend
cp .env.example .env

# 编辑 .env，修改数据库连接信息
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_NAME=event_registration
```

### 第三步: 创建数据库

```sql
-- 在 PostgreSQL 中执行
CREATE DATABASE event_registration;
```

### 第四步: 启动后端

```bash
cd backend
npm run dev
```

后端会自动运行数据库迁移，创建所有表。

### 第五步: 启动前端

```bash
cd frontend
npm run dev
```

### 第六步: 访问应用

- 前端: http://localhost:5173
- 后端API: http://localhost:3000
- 健康检查: http://localhost:3000/health

---

## API 使用指南

### 防重复提交

```typescript
// 客户端生成 UUID 作为幂等性 token
const idempotencyToken = crypto.randomUUID();

// 发送请求时携带
const response = await fetch('/api/registrations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Token': idempotencyToken,  // 关键！
  },
  body: JSON.stringify(registrationData),
});

// 即使网络超时重发，服务端也会返回相同的响应
// 重复请求不会创建重复数据
```

### 并发编辑 (乐观锁)

```typescript
// 1. 先获取资源
const event = await fetch(`/api/events/${eventId}`).then(r => r.json());
const currentVersion = event.version;

// 2. 更新时携带 If-Match 头
const response = await fetch(`/api/events/${eventId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'If-Match': currentVersion.toString(),  // 关键！
  },
  body: JSON.stringify(updatedData),
});

// 3. 如果版本已被修改，返回 412 状态码
if (response.status === 412) {
  // 提示用户刷新数据后重试
  alert('数据已被他人修改，请刷新后重试');
}
```

### 操作回放

```bash
# 获取某个活动的所有操作历史
GET /api/event-log/aggregate/event/{eventId}

# 查看某个请求的完整操作链
GET /api/event-log/request/{requestId}

# 按时间点回放（重建状态）
GET /api/event-log/replay/event/{eventId}?toTime=2024-01-01T12:00:00Z
```

### 导出报告

```typescript
// Excel
GET /api/exports/event/{eventId}?format=excel

// Markdown
GET /api/exports/event/{eventId}?format=markdown

// PDF
GET /api/exports/event/{eventId}?format=pdf

// 包含已取消的报名
GET /api/exports/event/{eventId}?format=excel&includeCancelled=true
```

---

## 核心API列表

| 方法 | 路径 | 描述 | 幂等 | 版本控制 |
|------|------|------|------|----------|
| GET | `/api/events` | 获取活动列表 | - | - |
| POST | `/api/events` | 创建活动 | ✅ | - |
| GET | `/api/events/:id` | 获取活动详情 | - | - |
| PUT | `/api/events/:id` | 更新活动 | ✅ | ✅ If-Match |
| DELETE | `/api/events/:id` | 取消活动 | ✅ | ✅ If-Match |
| POST | `/api/registrations` | 创建报名 | ✅ | - |
| GET | `/api/registrations/event/:id` | 获取活动报名 | - | - |
| PUT | `/api/registrations/:id` | 更新报名 | ✅ | ✅ If-Match |
| DELETE | `/api/registrations/:id` | 取消报名 | ✅ | ✅ If-Match |
| GET | `/api/event-log` | 查询操作日志 | - | - |
| GET | `/api/event-log/replay/:type/:id` | 操作回放 | - | - |
| GET | `/api/exports/event/:id` | 导出报告 | - | - |

---

## 并发场景测试

### 场景1: 重复报名

```bash
# 同一个请求发送多次 (使用相同的 idempotency token)
TOKEN=$(uuidgen)

# 第一次请求
curl -X POST http://localhost:3000/api/registrations \
  -H "X-Idempotency-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"xxx","userId":"user1","userName":"张三","userEmail":"test@test.com"}'

# 第二次请求 (完全相同)
curl -X POST http://localhost:3000/api/registrations \
  -H "X-Idempotency-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"xxx","userId":"user1","userName":"张三","userEmail":"test@test.com"}'

# 结果: 只创建了一条报名记录
```

### 场景2: 并发报名 (名额有限)

```bash
# 模拟50人同时报名，但活动只有30个名额
# 系统保证:
# 1. 不会超卖（超过30人）
# 2. 每个人最多只能报一次
# 3. 所有操作都有日志

# 分布式锁 + SERIALIZABLE 隔离级别保证数据一致性
```

### 场景3: 并发编辑

```bash
# 用户A和用户B同时编辑同一个活动
# 用户A: 获取版本1，修改标题
# 用户B: 获取版本1，修改时间

# 用户A提交: 成功，版本变为2
# 用户B提交: 失败，返回412 Precondition Failed

# 用户B需要:
# 1. 重新获取最新数据（版本2）
# 2. 合并自己的修改
# 3. 再次提交
```

---

## 数据模型

### 核心表

```
events                    活动表
├── id                    UUID 主键
├── title                 活动标题
├── start_time / end_time 时间
├── max_participants      最大人数
├── current_participants  当前人数
├── status                状态 (draft/active/cancelled/completed)
└── version               版本号 (乐观锁)

registrations             报名表
├── id                    UUID 主键
├── event_id              活动ID
├── user_id               用户ID
├── status                状态 (pending/confirmed/cancelled/waitlisted)
└── version               版本号

event_log                 操作日志 (事件溯源核心)
├── id                    自增ID
├── aggregate_type        聚合类型 (event/registration)
├── aggregate_id          聚合ID
├── event_type            事件类型
├── payload               事件数据 (JSONB)
├── timestamp             时间戳
└── request_id            请求ID (全链路追踪)

idempotency_tokens        幂等Token
├── token                 UUID 主键
├── request_hash          请求SHA256哈希
├── response_code/body    缓存的响应
└── expires_at            过期时间

distributed_locks         分布式锁
├── lock_key              锁键
├── holder_id             持有者ID
└── expires_at            过期时间
```

---

## 监控和调试

### 查看操作日志

前端进入活动详情页，底部会显示完整的操作日志，包含:
- 事件类型 (EVENT_CREATED, REGISTRATION_CANCELLED 等)
- 发生时间
- 请求ID (用于追踪)
- 操作来源 (IP地址)

### 问题排查

```bash
# 1. 查看某个请求的完整操作链
GET /api/event-log/request/{requestId}

# 2. 回放事件，重建某个时间点的状态
GET /api/event-log/replay/event/{eventId}?toTime={timestamp}

# 3. 检查幂等Token状态
SELECT * FROM idempotency_tokens WHERE token = 'xxx';

# 4. 检查当前锁
SELECT * FROM distributed_locks WHERE expires_at > NOW();
```

---

## 生产环境部署建议

### 1. 数据库
- 使用连接池 (已配置 max=20)
- 启用读写分离
- 定期备份 `event_log` 表（历史数据不会被修改）

### 2. 应用服务
- 多实例部署 (无状态)
- 负载均衡
- 健康检查: `GET /health`

### 3. 监控
- 追踪 `X-Request-Id` 贯穿全链路
- 监控慢查询 (超过100ms会记录警告日志)
- 监控锁等待时间

### 4. 安全
- 生产环境必须修改 `JWT_SECRET`
- 启用 HTTPS
- 添加用户认证 (当前示例简化处理)

---

## 后续扩展建议

### 1. 添加用户认证
- JWT Token 认证
- 角色权限管理 (管理员/普通用户)

### 2. 添加实时通知
- WebSocket 推送报名变更
- 活动时间变更通知

### 3. 集成 Redis
- 替代 PostgreSQL 分布式锁
- 缓存热门活动数据
- 发布订阅模式

### 4. 添加单元测试
- 并发场景测试
- 幂等性测试
- 边界条件测试

---

## 技术栈总结

**后端**
- Node.js + Express
- TypeScript
- PostgreSQL (pg 驱动)
- ExcelJS / PDFKit (导出)
- Winston (日志)

**前端**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)
- Axios
- Lucide React (图标)

**设计模式**
- 事件溯源 (Event Sourcing)
- 乐观锁 (Optimistic Locking)
- 分布式锁 (Distributed Locks)
- 幂等性模式 (Idempotency)
- 工作单元 (Unit of Work)
