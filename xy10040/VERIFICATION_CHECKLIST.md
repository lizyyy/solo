# 验证清单 - 活动报名系统

## 已修复的问题

### 1. 数据库迁移失败 ✅
**问题**: `migration_history` 表在 v7 才创建，但 `getLatestVersion()` 在一开始就尝试查询它
**修复**: 
- 将 `create_migration_history_table` 移到 v0，首先执行
- 其他表从 v1 开始
**文件**: `backend/src/database/migrations/index.ts`

### 2. created_by 非 UUID 问题 ✅
**问题**: 表定义 `created_by UUID NOT NULL`，但代码写入 `'system'` 这样的字符串
**修复**: 将以下字段从 `UUID` 改为 `VARCHAR(64)`:
- `events.created_by`
- `registrations.user_id`
- `event_log.aggregate_id`
- `event_log.user_id`
- `event_log.request_id`
- `idempotency_tokens.token`
- `idempotency_tokens.user_id`
- `distributed_locks.holder_id`
**文件**: `backend/src/database/migrations/index.ts`

### 3. 前端报名入口 ✅
**问题**: EventDetail 页面没有"我要报名"按钮
**修复**: 在 EventDetail 组件中添加了:
- "我要报名"按钮（仅当活动状态为 active 时显示）
- "编辑活动"按钮
- "取消活动"按钮
**文件**: `frontend/src/components/EventDetail.tsx` 和 `frontend/src/pages/Home.tsx`

### 4. 编辑/取消活动状态依赖错误 ✅
**问题**: `updateEvent` 只依赖 `get().currentEvent` 获取版本号，从列表页取消时 currentEvent 为 null
**修复**: `updateEvent` 现在会:
1. 首先检查传入的 `providedVersion` 参数
2. 然后检查 `currentEvent`（如果 ID 匹配）
3. 最后检查 `events` 数组
**文件**: `frontend/src/store/app.ts`

### 5. 异步任务处理 ✅
**问题**: 只有表结构，没有实际的任务处理器
**修复**: 实现了完整的异步任务系统:
- `AsyncTaskService`: 任务入队、轮询、执行、重试、死信队列
- `SEND_NOTIFICATION` 处理器: 发送报名确认通知
- `SYNC_CACHE` 处理器: 同步缓存
- 集成到 `registrationService.create()` 中
**文件**: `backend/src/services/async-task.service.ts` 和 `backend/src/index.ts`

### 6. 缓存更新机制 ✅
**问题**: 只有文档，没有实现
**修复**: 实现了内存缓存系统:
- `CacheService`: 事件缓存、报名列表缓存、TTL 过期
- 写操作后自动失效相关缓存
- 集成到 `registrationService.create()` 中
**文件**: `backend/src/services/cache.service.ts`

### 7. 回滚补偿机制 ✅
**问题**: 只有文档，没有实现
**修复**: 实现了 Saga 模式补偿系统:
- `Saga` 类: 步骤执行、失败补偿
- `CompensationService`: 报名补偿（取消报名 + 减少人数）
- 集成到 `registrationService.create()` 的 catch 块
**文件**: `backend/src/services/compensation.service.ts`

---

## 运行验证

### 步骤 1: 安装依赖
```bash
cd backend
npm install

cd ../frontend
npm install
```

### 步骤 2: 配置数据库
```bash
cd backend
cp .env.example .env
# 编辑 .env，修改数据库连接信息
```

创建数据库:
```sql
CREATE DATABASE event_registration;
```

### 步骤 3: 验证后端
```bash
cd backend
npm run dev
```

预期输出:
```
info: Starting event registration system...
info: Starting database migrations...
info: Applying migration: v0 - create_migration_history_table
info: Migration applied: v0 - create_migration_history_table
info: Applying migration: v1 - create_events_table
...
info: All migrations completed successfully
info: Async task service started with handlers: SEND_NOTIFICATION, SYNC_CACHE
info: Server is running on port 3000
```

### 步骤 4: 测试 API
```bash
# 健康检查
curl http://localhost:3000/health

# 创建活动（使用幂等性Token）
TOKEN=$(uuidgen)
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Token: $TOKEN" \
  -d '{
    "title": "测试活动",
    "startTime": "2026-06-01T10:00:00Z",
    "endTime": "2026-06-01T12:00:00Z",
    "maxParticipants": 100
  }'

# 启动前端
cd ../frontend
npm run dev
```

### 步骤 5: 测试完整流程
1. 访问 http://localhost:5173
2. 点击"创建活动"，填写信息并创建
3. 点击活动进入详情页
4. 点击"我要报名"，填写信息
5. 查看操作日志（应该显示 REGISTRATION_CREATED 事件）
6. 点击"导出报告" -> "导出 Excel"

---

## 核心特性验证清单

| 特性 | 验证方法 | 预期结果 |
|------|----------|----------|
| 重复提交 | 使用相同的 X-Idempotency-Token 发送两次请求 | 只创建1条记录，第二次返回相同响应 |
| 乐观锁 | 两个人同时编辑同一个活动（使用相同 version） | 第二个编辑失败，返回 412 |
| 分布式锁 | 同时发起多个报名请求 | 不超卖，每人只能报一次 |
| 事件溯源 | 查看活动详情的操作日志 | 显示所有操作历史 |
| 异步任务 | 查看服务器日志 | 报名后显示 "Task enqueued" 和 "Task completed" |
| 导出功能 | 点击导出按钮 | 下载文件成功 |
| 补偿机制 | （可选）模拟报名后失败 | 日志显示 "attempting compensation" |

---

## 关键文件位置

| 功能 | 文件路径 |
|------|----------|
| 数据库迁移 | `backend/src/database/migrations/index.ts` |
| 异步任务服务 | `backend/src/services/async-task.service.ts` |
| 缓存服务 | `backend/src/services/cache.service.ts` |
| 补偿服务 | `backend/src/services/compensation.service.ts` |
| 报名服务 | `backend/src/services/registration.service.ts` |
| 活动详情 | `frontend/src/components/EventDetail.tsx` |
| 前端状态 | `frontend/src/store/app.ts` |
