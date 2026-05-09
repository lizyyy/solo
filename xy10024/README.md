# 设备借用管理系统

一个企业级的设备借用管理系统，采用事件溯源架构设计，支持完整的操作追踪和回放。

## 技术栈

- **后端**: Go + Gin + GORM + PostgreSQL + Redis
- **前端**: Vue 3 + Element Plus + Pinia + Axios
- **部署**: Docker + Docker Compose

## 核心特性

### 1. 事件溯源架构
- 所有状态变更通过事件记录
- 支持完整的状态回放
- 自动生成快照优化性能

### 2. 并发控制
- **乐观锁**: 使用版本号防止并发更新冲突
- **悲观锁**: Redis 分布式锁防止竞态条件
- **Idempotency Key**: 防止重复提交

### 3. 数据一致性
- 数据库事务保证原子性
- 事件和状态同时更新
- 缓存主动失效机制

### 4. 完整追踪
- 所有操作记录审计日志
- 支持按请求ID追踪
- 支持事件历史回放

### 5. 报告导出
- Excel 格式导出
- Markdown 格式导出
- PDF 格式导出

## 快速开始

### 方式一: Docker Compose (推荐)

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问: http://localhost

默认账号: `admin` / `admin123`

### 方式二: 本地开发

#### 1. 启动数据库和缓存

```bash
# 启动 PostgreSQL
docker run -d \
  --name device-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=device_borrow \
  -p 5432:5432 \
  postgres:15-alpine

# 启动 Redis
docker run -d \
  --name device-redis \
  -p 6379:6379 \
  redis:7-alpine

# 初始化数据库
docker cp database/schema.sql device-postgres:/
docker exec device-postgres psql -U postgres -d device_borrow -f /schema.sql
```

#### 2. 启动后端

```bash
cd backend

# 复制环境变量
cp .env.example .env

# 安装依赖
go mod download

# 运行
go run main.go
```

后端运行在: http://localhost:8080

#### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

前端运行在: http://localhost:3000

## API 文档

### 认证
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/register` - 用户注册

### 用户
- `GET /api/v1/users/me` - 获取当前用户
- `GET /api/v1/users` - 获取用户列表
- `GET /api/v1/users/:id` - 获取用户详情
- `PUT /api/v1/users/:id` - 更新用户

### 设备
- `GET /api/v1/devices` - 获取设备列表
- `GET /api/v1/devices/:id` - 获取设备详情
- `POST /api/v1/devices` - 创建设备
- `PUT /api/v1/devices/:id` - 更新设备
- `DELETE /api/v1/devices/:id` - 删除设备

### 借用
- `GET /api/v1/borrows` - 获取借用记录列表
- `GET /api/v1/borrows/:id` - 获取借用记录详情
- `POST /api/v1/borrows` - 借用设备
- `POST /api/v1/borrows/:id/return` - 归还设备
- `GET /api/v1/borrows/user/:userId` - 获取用户借用历史

### 审计和事件
- `GET /api/v1/audit` - 获取审计日志
- `GET /api/v1/audit/:resourceType/:resourceId` - 获取资源历史
- `GET /api/v1/events/:aggregateType/:aggregateId` - 获取事件历史
- `POST /api/v1/events/replay/:aggregateType/:aggregateId` - 回放聚合状态
- `GET /api/v1/events/request/:requestId` - 按请求ID获取事件

### 导出
- `GET /api/v1/export/report?format=excel|markdown|pdf` - 导出报告

## 并发控制示例

### 乐观锁 (前端)
```javascript
async function updateDevice(device) {
  try {
    await api.updateDevice(device.id, {
      name: device.name,
      status: device.status
    }, device.version)  // 传入当前版本号
  } catch (error) {
    if (error.response?.status === 409) {
      // 版本冲突，刷新数据重试
      const latest = await api.getDevice(device.id)
      // 提示用户或合并更改
    }
  }
}
```

### 去重 (前端)
```javascript
// 自动在请求头中添加 X-Idempotency-Key
// 服务端会缓存相同 key 的请求响应
const response = await api.borrowDevice({
  device_id: 'xxx',
  purpose: '项目测试'
})

// 即使网络重试，也不会重复借用
```

## 事件回放示例

```bash
# 获取设备事件历史
curl http://localhost:8080/api/v1/events/device/<device-id>

# 回放设备状态
curl -X POST http://localhost:8080/api/v1/events/replay/device/<device-id>

# 按请求ID追踪
curl http://localhost:8080/api/v1/events/request/<request-id>
```

## 数据库设计

### 核心表
- `users` - 用户表
- `devices` - 设备表
- `borrow_records` - 借用记录表
- `events` - 事件表 (事件溯源核心)
- `audit_logs` - 审计日志表
- `snapshots` - 快照表 (性能优化)
- `dedup_records` - 去重记录表

### 事件类型
- `device.created` - 设备创建
- `device.updated` - 设备更新
- `device.deleted` - 设备删除
- `device.borrowed` - 设备借出
- `device.returned` - 设备归还
- `borrow.created` - 借用创建
- `borrow.completed` - 借用完成
- `user.created` - 用户创建
- `user.updated` - 用户更新

## 监控和调试

### 健康检查
```bash
curl http://localhost:8080/health
```

### 查看请求追踪
每个响应都包含 `X-Request-ID` 头，可用于追踪整个请求链路。

### 查看事件序列
```sql
-- 查看所有事件按顺序排列
SELECT * FROM events ORDER BY sequence ASC;

-- 查看特定资源的事件
SELECT * FROM events 
WHERE aggregate_type = 'device' AND aggregate_id = '<id>'
ORDER BY event_version ASC;
```

## 生产部署建议

1. **安全性**:
   - 修改默认 JWT_SECRET
   - 使用强密码
   - 启用 HTTPS
   - 配置防火墙规则

2. **高可用**:
   - PostgreSQL 主从复制
   - Redis 集群
   - 应用层负载均衡

3. **监控**:
   - 配置 Prometheus + Grafana
   - 日志聚合 (ELK/Loki)
   - 告警机制

4. **备份**:
   - 定期数据库备份
   - 事件表归档策略

## 许可证

MIT License
