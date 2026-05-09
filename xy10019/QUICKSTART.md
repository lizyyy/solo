# 门店库存管理系统

## 快速启动

### 方式一：使用 Docker（推荐）

```bash
# 一键启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

启动后访问:
- 前端: http://localhost
- 后端 API: http://localhost:3000/api
- API 文档: http://localhost:3000/api/docs

### 方式二：本地开发

**前置要求:**
- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

**1. 启动数据库**
```bash
# 使用 Docker 启动数据库
docker run -d --name postgres \
  -e POSTGRES_DB=store_inventory \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

docker run -d --name redis -p 6379:6379 redis:7
```

**2. 配置环境变量**
```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，配置数据库和 Redis 连接
```

**3. 安装依赖并初始化**
```bash
# 后端
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed

# 前端
cd ../frontend
npm install
```

**4. 启动服务**
```bash
# 后端终端
cd backend
npm run start:dev

# 前端终端
cd frontend
npm run dev
```

访问:
- 前端: http://localhost:5173
- 后端: http://localhost:3000/api
- API 文档: http://localhost:3000/api/docs

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 经理 | manager | manager123 |
| 操作员 | operator | operator123 |

## 项目结构

```
.
├── backend/                 # 后端服务 (NestJS)
│   ├── src/
│   │   ├── common/          # 公共模块
│   │   ├── modules/         # 业务模块
│   │   │   ├── auth/        # 认证
│   │   │   ├── store/       # 门店
│   │   │   ├── product/     # 商品
│   │   │   ├── inventory/   # 库存
│   │   │   ├── audit/       # 审计
│   │   │   └── export/      # 导出
│   │   └── infrastructure/  # 基础设施
│   │       ├── prisma/      # 数据库
│   │       ├── redis/       # 缓存/锁
│   │       └── queue/       # 队列
│   └── prisma/              # 数据库 Schema
│
├── frontend/                # 前端应用 (Vue 3)
│   └── src/
│       ├── api/             # API 接口
│       ├── views/           # 页面
│       ├── stores/          # 状态管理
│       └── utils/           # 工具函数
│
└── docker-compose.yml       # Docker 编排
```

## 核心功能

### 1. 数据一致性保证

**幂等性控制:**
- 每个请求携带唯一的 `X-Request-Id` 头
- 使用 Redis + 数据库双重校验
- 防止重复提交

**乐观锁:**
- 所有库存表带有 `version` 字段
- 更新时校验版本号
- 版本不一致自动返回错误

**分布式锁:**
- 使用 Redis Redlock 实现
- 关键操作（调拨、批量调整）串行化
- 自动续期和释放

**事务管理:**
- 所有库存操作在事务中执行
- 调拨操作使用跨门店事务
- 支持事务回滚

### 2. 操作追踪与回放

**审计日志:**
- 自动记录所有增删改操作
- 记录操作前后的数据快照
- 记录操作人、IP、时间等信息

**操作回放:**
- 按请求 ID 查看完整操作链
- 按时间轴回放操作过程
- 支持数据快照对比

**历史版本:**
- 支持查看任意时间点的实体状态
- 支持查看操作统计（变更字段、操作次数等）

### 3. 异步任务管理

**队列系统:**
- 使用 BullMQ 管理异步任务
- 支持任务优先级和重试策略
- 支持任务依赖关系

**任务状态追踪:**
- 实时查看任务进度
- 任务执行日志记录
- 失败任务支持手动重试

### 4. 导出功能

**Excel:**
- 多工作表（汇总、库存明细、变动记录、调拨记录）
- 样式美化、数据格式化
- 支持公式计算

**Markdown:**
- 纯文本格式，便于版本控制
- 表格格式清晰
- 支持 Markdown 预览

**PDF:**
- 专业的报表格式
- 支持页眉页脚
- 支持水印

## API 文档

启动后端后访问: http://localhost:3000/api/docs

### 主要接口

**库存管理:**
- `GET /api/inventory` - 库存列表
- `POST /api/inventory/adjust` - 调整库存
- `POST /api/inventory/change-price` - 变更价格
- `GET /api/inventory/records` - 变动记录

**调拨管理:**
- `GET /api/inventory/transfers` - 调拨单列表
- `POST /api/inventory/transfers` - 创建调拨
- `PUT /api/inventory/transfers/:id/complete` - 完成调拨
- `PUT /api/inventory/transfers/:id/cancel` - 取消调拨

**审计日志:**
- `GET /api/audit` - 审计日志列表
- `GET /api/audit/replay/:id` - 回放操作
- `GET /api/audit/request/:requestId` - 按请求查看

**报表导出:**
- `POST /api/export/inventory` - 同步导出
- `POST /api/export/inventory/async` - 异步导出
- `GET /api/export/tasks` - 任务列表

## 架构设计

### 并发控制策略

```
┌─────────────────────────────────────────────────┐
│                    请求处理                       │
├─────────────────────────────────────────────────┤
│  1. 幂等性检查 (Redis + DB)                      │
│     ↓                                            │
│  2. 分布式锁 (Redlock)                           │
│     ↓                                            │
│  3. 数据库事务 (Prisma Transaction)              │
│     ↓                                            │
│  4. 乐观锁校验 (Version Check)                   │
│     ↓                                            │
│  5. 数据更新                                      │
│     ↓                                            │
│  6. 释放锁                                        │
│     ↓                                            │
│  7. 记录幂等结果                                  │
└─────────────────────────────────────────────────┘
```

### 数据一致性保证

```sql
-- 乐观锁示例
UPDATE inventory 
SET quantity = quantity + 10, version = version + 1
WHERE id = ? AND version = ?

-- 如果影响行数为 0，说明数据已被修改
```

### 审计日志结构

```typescript
interface AuditLog {
  id: string;
  requestId: string;           // 用于回放
  operation: CREATE | UPDATE | DELETE | ...;
  entity: INVENTORY | PRODUCT | ...;
  entityId: string;
  beforeSnapshot: JSON;        // 操作前快照
  afterSnapshot: JSON;         // 操作后快照
  changedFields: string[];     // 变更字段
  userId: string;
  operatorName: string;
  ipAddress: string;
  timestamp: Date;
}
```

## 监控与运维

### 健康检查
- 后端健康检查: `GET /api/health`
- 数据库连接: Prisma 自动管理
- Redis 连接: ioredis 自动重连

### 日志
- 请求日志: 记录所有 API 调用
- 审计日志: 记录所有数据变更
- 错误日志: 记录异常和堆栈

### 性能优化
- Redis 缓存热点数据
- 数据库索引优化
- 异步任务处理耗时操作

## 开发指南

### 添加新模块
```bash
# 后端
cd backend
nest g module modules/<name>
nest g service modules/<name>
nest g controller modules/<name>
```

### 数据库迁移
```bash
# 创建迁移
npx prisma migrate dev --name <migration-name>

# 部署迁移
npx prisma migrate deploy
```

### 测试
```bash
# 后端单元测试
cd backend
npm run test

# 后端 E2E 测试
npm run test:e2e

# 代码检查
npm run lint
```

## 安全建议

1. **生产环境必须修改:**
   - JWT_SECRET
   - 数据库密码
   - Redis 密码

2. **启用 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书

3. **限流策略**
   - 配置 API 限流
   - 防止暴力破解

4. **定期备份**
   - 数据库定时备份
   - 审计日志归档

## 许可证

MIT License
