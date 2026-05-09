# 活动报名系统架构设计

## 系统概述
一个面向长期使用的活动报名系统，核心关注数据一致性、操作可追溯性和复杂场景处理。

## 核心设计原则

### 1. 数据一致性
- 所有关键操作使用数据库事务
- 乐观锁处理并发编辑
- 分布式锁防止资源竞争
- 幂等性Token防止重复提交

### 2. 操作可追溯性
- 事件溯源（Event Sourcing）模式
- 所有状态变更记录为事件
- 支持时间点回放
- 完整的审计日志

### 3. 容错与恢复
- Saga模式处理分布式事务
- 补偿操作实现回滚
- 死信队列处理失败消息

---

## 数据模型设计

### 核心表结构

#### 1. events（活动表）
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    max_participants INTEGER NOT NULL DEFAULT 0,
    current_participants INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    CHECK (start_time < end_time),
    CHECK (current_participants <= max_participants)
);
```

#### 2. registrations（报名表）
```sql
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    user_id UUID NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_phone VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    notes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);
```

#### 3. event_log（事件日志表 - 操作追踪核心）
```sql
CREATE TABLE event_log (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID,
    request_id UUID,
    ip_address VARCHAR(45),
    INDEX idx_aggregate (aggregate_type, aggregate_id),
    INDEX idx_timestamp (timestamp)
);
```

#### 4. idempotency_tokens（幂等Token表）
```sql
CREATE TABLE idempotency_tokens (
    token UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing'
);
```

#### 5. distributed_locks（分布式锁表）
```sql
CREATE TABLE distributed_locks (
    lock_key VARCHAR(255) PRIMARY KEY,
    holder_id UUID NOT NULL,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
```

#### 6. async_tasks（异步任务表）
```sql
CREATE TABLE async_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status_priority (status, priority DESC, created_at)
);
```

---

## 并发控制策略

### 1. 乐观锁（Optimistic Locking）
- 使用 `version` 字段
- 更新时检查版本号
- 版本冲突时抛出 `ConcurrencyError`

### 2. 分布式锁（Distributed Locks）
- 使用 PostgreSQL 实现
- 支持超时自动释放
- 用于报名名额抢占等关键操作

### 3. 数据库事务
- 所有写操作使用事务
- 报名操作使用 SERIALIZABLE 隔离级别
- 触发器保证数据约束

---

## 操作追踪与回放

### 事件类型定义
```typescript
enum EventType {
    EVENT_CREATED = 'EVENT_CREATED',
    EVENT_UPDATED = 'EVENT_UPDATED',
    EVENT_CANCELLED = 'EVENT_CANCELLED',
    EVENT_TIME_CHANGED = 'EVENT_TIME_CHANGED',
    
    REGISTRATION_CREATED = 'REGISTRATION_CREATED',
    REGISTRATION_UPDATED = 'REGISTRATION_UPDATED',
    REGISTRATION_CANCELLED = 'REGISTRATION_CANCELLED',
    REGISTRATION_CONFIRMED = 'REGISTRATION_CONFIRMED',
}
```

### 回放机制
1. 从 `event_log` 按时间顺序获取事件
2. 应用事件处理器重建状态
3. 支持按时间点截断
4. 支持快照优化

---

## 异步任务处理

### 任务类型
- 发送通知邮件
- 生成导出文件
- 同步缓存
- 数据清理

### 保证顺序
- 同一资源的任务串行执行
- 使用任务队列分区
- 依赖任务链式执行

---

## API 设计

### 幂等性设计
- 客户端生成 `X-Idempotency-Token`
- 服务端检查并记录
- 重复请求返回缓存响应

### 版本控制
- `If-Match` 头传递版本号
- 不匹配返回 412 Precondition Failed

---

## 缓存策略

### 缓存更新
- 写操作后立即失效缓存
- 使用发布订阅通知更新
- 缓存键包含版本号

### 缓存结构
```
event:{id}:v{version}           # 活动详情
event:{id}:registrations:v{v}   # 报名列表
events:list:v{v}                # 活动列表
```
