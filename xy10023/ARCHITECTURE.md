# 客服跟进系统架构设计

## 1. 系统概述

这是一个企业级客服跟进管理系统，专为长期使用设计。系统需要处理复杂的业务场景，确保数据一致性和操作可追溯性。

### 核心挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| 重复提交 | 幂等性设计 + 请求唯一ID |
| 多人同时编辑 | 乐观锁 + 版本号控制 + 实时协作提示 |
| 异步任务顺序错乱 | 有向无环图(DAG)任务编排 + 顺序号控制 |
| 缓存没更新 | 写穿透 + 缓存失效策略 + 版本校验 |
| 数据回滚失败 | 事件溯源 + 补偿事务 + 数据快照 |
| 操作无法追踪 | 完整事件日志 + 操作回放机制 |

---

## 2. 技术架构

### 2.1 技术栈

**后端:**
- Node.js 18+ + Express.js
- TypeScript 5.0+
- PostgreSQL 14+ (关系型数据库)
- Redis 6+ (缓存 + 消息队列)
- Bull (任务队列)

**前端:**
- React 18+
- TypeScript
- Ant Design 5.0+
- Zustand (状态管理)
- React Query (数据同步)

### 2.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  管理面板   │  │  工单中心   │  │  操作回放面板       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│              React + Ant Design + Zustand                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API / WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│                        API网关层                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  身份认证  │  限流  │  幂等校验  │  审计日志            │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                        业务服务层                            │
│  ┌───────────┐  ┌───────────┐  ┌─────────┐  ┌───────────┐  │
│  │ 工单服务  │  │ 跟进服务  │  │ 通知服务│  │ 导出服务  │  │
│  └───────────┘  └───────────┘  └─────────┘  └───────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              事件溯源引擎 (Event Sourcing)             │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                        数据层                                │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  PostgreSQL      │  │  Redis (缓存 + 分布式锁 + 队列)   │ │
│  │  - 工单快照表    │  │                                  │ │
│  │  - 事件日志表    │  │  ┌────────────────────────────┐  │ │
│  │  - 幂等记录表    │  │  │  Bull 任务队列            │  │ │
│  │  - 用户权限表    │  │  │  - 异步任务处理           │  │ │
│  └──────────────────┘  │  │  - 任务依赖管理           │  │ │
│                        │  └────────────────────────────┘  │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心设计模式

### 3.1 事件溯源 (Event Sourcing)

**核心思想**: 不直接更新状态，而是保存所有导致状态变化的事件。当前状态可以通过重放事件来重建。

**事件类型**:
- `TicketCreated` - 工单创建
- `FollowUpAdded` - 添加跟进记录
- `StatusChanged` - 状态变更
- `AssigneeChanged` - 负责人变更
- `CompensationApplied` - 补偿操作

**优势**:
1. 完整的操作历史记录
2. 支持操作回放和审计
3. 便于故障排查
4. 支持时间点查询

### 3.2 幂等性设计

**实现方式**:
1. 每个请求携带唯一的 `requestId`
2. 服务端在 `idempotency_records` 表中记录已处理的请求
3. 重复请求直接返回缓存的响应结果

```typescript
// 请求头
X-Request-Id: uuid-v4
X-Idempotency-Key: client-generated-key
```

### 3.3 乐观锁并发控制

**实现方式**:
1. 每个数据记录包含 `version` 字段
2. 更新时必须携带当前版本号
3. 版本不匹配则返回冲突错误
4. 前端自动获取最新数据并重试（可选）

```sql
UPDATE tickets 
SET status = 'completed', version = version + 1 
WHERE id = $1 AND version = $2;
```

### 3.4 分布式锁

使用 Redis 实现分布式锁，防止关键操作的并发问题：

```typescript
const lock = await redis.set(`lock:ticket:${ticketId}`, 'owner', {
  NX: true,  // 只有当键不存在时才设置
  EX: 30    // 30秒过期
});
```

### 3.5 任务编排

使用 Bull 队列 + DAG（有向无环图）管理任务依赖：

```typescript
// 任务依赖示例
const taskGraph = {
  'send-notification': { dependencies: ['update-status'] },
  'update-status': { dependencies: ['validate-data'] },
  'validate-data': { dependencies: [] }
};
```

---

## 4. 数据模型设计

### 4.1 核心表结构

```sql
-- 工单快照表（当前状态）
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  customer_id UUID NOT NULL,
  assignee_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  category VARCHAR(100),
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 事件日志表（事件溯源核心）
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,      -- 关联的实体ID（如ticketId）
  aggregate_type VARCHAR(50) NOT NULL, -- 'ticket', 'followup'
  event_type VARCHAR(100) NOT NULL,    -- 'TicketCreated', 'StatusChanged'
  event_data JSONB NOT NULL,           -- 事件具体数据
  version INTEGER NOT NULL,            -- 版本号，确保顺序
  request_id UUID,                     -- 幂等请求ID
  operator_id UUID NOT NULL,           -- 操作人ID
  operator_type VARCHAR(50) NOT NULL,  -- 'user', 'system'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (aggregate_id, version)
);

-- 跟进记录表
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  content TEXT NOT NULL,
  follow_up_type VARCHAR(50) NOT NULL, -- 'call', 'message', 'compensation'
  promised_action VARCHAR(500),        -- 承诺的动作
  promised_deadline TIMESTAMP,         -- 承诺完成时间
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  assignee_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 幂等记录表
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE NOT NULL,
  idempotency_key VARCHAR(255),
  endpoint VARCHAR(255) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(50) NOT NULL, -- 'processing', 'completed', 'failed'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- 任务日志表
CREATE TABLE task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name VARCHAR(100) NOT NULL,
  task_type VARCHAR(50) NOT NULL, -- 'async', 'compensation'
  correlation_id UUID NOT NULL,   -- 关联ID，用于追踪整个流程
  parent_task_id UUID,            -- 父任务ID
  status VARCHAR(50) NOT NULL,    -- 'pending', 'running', 'completed', 'failed', 'rollback'
  payload JSONB,
  result JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'agent', -- 'admin', 'supervisor', 'agent'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4.2 索引策略

```sql
-- 事件表索引
CREATE INDEX idx_events_aggregate ON events(aggregate_id, version);
CREATE INDEX idx_events_operator ON events(operator_id, created_at);
CREATE INDEX idx_events_type ON events(event_type, created_at);

-- 工单表索引
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);

-- 跟进表索引
CREATE INDEX idx_followups_ticket ON follow_ups(ticket_id);
CREATE INDEX idx_followups_deadline ON follow_ups(promised_deadline) 
  WHERE status = 'pending';
```

---

## 5. 核心流程设计

### 5.1 创建工单流程

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 客户端   │───▶│ 幂等校验层   │───▶│ 事件存储     │───▶│ 状态快照     │
└──────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                     │                    │                    │
                     ▼                    ▼                    ▼
              检查requestId         写入TicketCreated      更新tickets表
              是否已处理            事件到events表         (投影)
```

### 5.2 并发更新处理

```
用户A获取工单 v1 ──▶ 修改数据 ──▶ 提交更新(带v1) ──▶ ✓ 成功，版本变为v2
用户B获取工单 v1 ──▶ 修改数据 ──▶ 提交更新(带v1) ──▶ ✗ 版本冲突
                                                    │
                                                    ▼
                                              获取最新数据v2
                                                    │
                                                    ▼
                                              合并变更或提示用户
```

### 5.3 异步任务处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        任务编排引擎                              │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 任务A    │───▶│ 任务B    │───▶│ 任务C    │───▶│ 任务D    │  │
│  │(验证数据)│    │(更新状态)│    │(发送通知)│    │(记录日志)│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                │                │                │      │
│       ▼                ▼                ▼                ▼      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    补偿事务链                           │  │
│  │  任务D失败 ──▶ 回滚任务C ──▶ 回滚任务B ──▶ 回滚任务A  │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 操作回放流程

```
1. 指定时间点或事件范围
2. 从events表按version顺序读取事件
3. 逐步应用事件到初始状态
4. 重建该时间点的完整状态
5. 对比当前状态，分析差异
```

---

## 6. API 设计

### 6.1 工单管理

```
POST   /api/tickets              # 创建工单
GET    /api/tickets              # 工单列表
GET    /api/tickets/:id          # 工单详情
PUT    /api/tickets/:id          # 更新工单（带版本号）
PATCH  /api/tickets/:id/status   # 变更状态
```

### 6.2 跟进管理

```
POST   /api/tickets/:id/followups        # 添加跟进
GET    /api/tickets/:id/followups        # 跟进列表
PUT    /api/followups/:id                # 更新跟进
POST   /api/followups/:id/complete       # 完成跟进
POST   /api/followups/:id/compensate     # 补偿操作
```

### 6.3 事件与审计

```
GET    /api/tickets/:id/events           # 事件历史
GET    /api/tickets/:id/replay?version=N # 重放至指定版本
GET    /api/audit/trail                  # 审计日志
POST   /api/audit/replay                 # 回放指定操作
```

### 6.4 导出功能

```
POST   /api/exports/tickets              # 导出门票报告
GET    /api/exports/:id/download         # 下载导出文件
```

---

## 7. 缓存策略

### 7.1 缓存层级

```
L1: 前端本地缓存 (React Query)
    - 5分钟TTL，自动失效
    - 后台刷新机制

L2: Redis 分布式缓存
    - 工单详情: 10分钟TTL
    - 用户信息: 30分钟TTL
    - 统计数据: 5分钟TTL

L3: 数据库查询结果缓存
    - 复杂查询结果缓存
```

### 7.2 缓存更新策略

```typescript
// 写穿透模式
async updateTicket(id: string, data: UpdateTicketDto, version: number) {
  // 1. 更新数据库
  const result = await this.db.update(id, data, version);
  
  // 2. 立即更新缓存
  await this.redis.set(`ticket:${id}`, result, { EX: 600 });
  
  // 3. 发布更新通知
  await this.redis.publish('ticket-updates', JSON.stringify({ id, version: result.version }));
  
  return result;
}
```

---

## 8. 错误处理与恢复

### 8.1 异常分类

| 类型 | 处理策略 | 示例 |
|------|----------|------|
| 瞬时错误 | 自动重试（指数退避） | 网络超时、数据库连接失败 |
| 业务错误 | 返回明确错误码 | 版本冲突、权限不足 |
| 系统错误 | 记录日志 + 告警 | 内存溢出、磁盘满 |

### 8.2 数据恢复机制

```typescript
// 快照 + 事件重放恢复
async restoreToVersion(ticketId: string, targetVersion: number) {
  // 1. 获取该版本之前的所有事件
  const events = await this.eventStore.getEventsUpToVersion(
    ticketId, 
    targetVersion
  );
  
  // 2. 从初始状态开始重放
  let state = this.getInitialState();
  for (const event of events) {
    state = this.applyEvent(state, event);
  }
  
  // 3. 创建恢复快照
  await this.createRestorationSnapshot(ticketId, state);
  
  return state;
}
```

---

## 9. 导出功能设计

### 9.1 支持格式

| 格式 | 适用场景 | 库 |
|------|----------|-----|
| Excel | 数据分析、报表 | exceljs |
| Markdown | 文档记录、知识库 | 自定义生成 |
| PDF | 正式报告、打印 | puppeteer / pdfmake |

### 9.2 导出流程

```
1. 用户选择导出条件（时间范围、状态、负责人等）
2. 系统异步生成导出任务
3. 任务完成后发送通知
4. 用户下载生成的文件
5. 文件保留7天后自动清理
```

---

## 10. 监控与告警

### 10.1 关键指标

- API 响应时间（P95）
- 错误率
- 任务队列积压
- 缓存命中率
- 并发冲突次数

### 10.2 告警规则

- 错误率 > 5% 持续5分钟
- 任务队列积压 > 1000
- 并发冲突率 > 10%
- 服务不可达

---

## 11. 安全设计

### 11.1 认证授权

- JWT Token 认证
- RBAC 权限模型
- API 访问频率限制

### 11.2 数据安全

- 敏感数据加密存储
- 操作日志不可篡改
- 定期数据备份

---

## 12. 部署架构

```
                    ┌─────────────┐
                    │   Nginx     │
                    │ (负载均衡)  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  API Server │ │  API Server │ │  Worker     │
    │   (Node.js) │ │   (Node.js) │ │  (任务处理) │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌──────────┐    ┌──────────────┐   ┌──────────┐
   │ PostgreSQL│   │    Redis     │   │  对象存储 │
   │  (主从)   │   │ (哨兵模式)   │   │  (文件)   │
   └──────────┘    └──────────────┘   └──────────┘
```
