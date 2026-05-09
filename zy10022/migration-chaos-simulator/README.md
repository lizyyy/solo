# Migration Chaos Simulator

数据迁移混沌实验平台 - 在上线前模拟线上环境的各种异常情况，确保迁移脚本的健壮性。

## 项目概述

这是一个企业级后端工程化项目，专为验证数据库迁移脚本在真实线上环境下的表现而设计。通过注入各种故障（高并发、网络中断、服务超时、消息重复等），可以发现迁移脚本中的潜在问题。

### 核心特性

1. **混沌实验引擎** - 8种故障类型注入
   - 高并发 (`high_concurrency`)
   - 服务超时 (`timeout`)
   - 网络中断与重试 (`network_drop`)
   - 重复请求 (`duplicate_request`)
   - 消息重复消费 (`duplicate_message`)
   - 慢查询 (`slow_query`)
   - 数据库连接断开 (`connection_drop`)
   - 锁竞争 (`lock_contention`)

2. **迁移模拟器**
   - 多步骤迁移执行
   - 每步事务保护
   - 自动回滚机制
   - Dry Run 预演
   - 数据完整性校验
   - 风险等级评估

3. **全链路追踪**
   - Trace/Span 模型
   - 事件记录
   - 性能指标采集
   - 实时 WebSocket 推送

4. **报告生成**
   - JSON / Markdown / HTML 多格式
   - 健康评分 (0-100)
   - 智能建议
   - 问题定位

## 技术栈

**后端:**
- Go 1.21
- Gin (HTTP Framework)
- pgx (PostgreSQL Driver)
- RabbitMQ Client
- Zap (Logging)
- Viper (Config)

**前端:**
- React 18
- Material-UI 5
- React Query
- Recharts
- WebSocket

**基础设施:**
- PostgreSQL 15
- RabbitMQ 3.12
- Docker & Docker Compose

## 快速开始

### 前置要求

- Docker & Docker Compose
- Go 1.21+ (用于本地开发)
- Node.js 18+ (用于本地前端开发)

### 一键启动

```bash
# 克隆项目
cd migration-chaos-simulator

# 启动所有服务
make up

# 查看日志
make logs
```

服务访问:
- 前端 Dashboard: http://localhost:3000
- 后端 API: http://localhost:8080
- RabbitMQ 管理: http://localhost:15672 (guest/guest)

### 本地开发

```bash
# 启动基础设施（PostgreSQL + RabbitMQ）
docker-compose up -d postgres rabbitmq

# 后端开发
make dev-backend

# 前端开发（新终端）
make dev-frontend
```

## 核心概念

### 工作流程

```
1. 创建迁移脚本
       ↓
2. Dry Run 预演（无实际变更）
       ↓
3. 分析风险等级
       ↓
4. 配置混沌实验（同时运行迁移 + 故障注入）
       ↓
5. 实时监控指标
       ↓
6. 查看报告，获取改进建议
       ↓
7. 优化后再次演练
```

### 混沌实验类型说明

| 类型 | 风险 | 场景 | 验证点 |
|------|------|------|--------|
| 高并发 | 高 | 大量并发请求 | 锁竞争、死锁、连接池 |
| 服务超时 | 中 | 请求处理超时 | 事务处理、超时回滚 |
| 网络中断 | 高 | 网络抖动 | 重试机制、幂等性 |
| 重复请求 | 高 | 重试导致重复提交 | 幂等性设计 |
| 消息重复消费 | 高 | MQ 重复投递 | 消费者幂等 |
| 慢查询 | 中 | 大表变更 | 性能影响评估 |
| 连接断开 | 关键 | DB 连接中断 | 故障恢复、一致性 |
| 锁竞争 | 高 | 资源竞争 | 死锁检测、隔离级别 |

### 迁移步骤类型

- **DDL**: 表结构变更
- **DML**: 数据变更
- **Index Build**: 索引构建
- **Constraint**: 约束添加
- **Data Check**: 数据校验

## API 文档

### 健康检查
```
GET /api/v1/health
```

### 混沌实验

```bash
# 获取所有实验类型
GET /api/v1/chaos/types

# 创建实验
POST /api/v1/chaos/experiments
{
  "name": "高并发测试",
  "type": "high_concurrency",
  "config": {
    "duration": "60s",
    "concurrent_users": 100,
    "requests_per_second": 500
  }
}

# 停止实验
POST /api/v1/chaos/experiments/:id/stop

# 查看报告
GET /api/v1/chaos/experiments/:id/report
```

### 数据迁移

```bash
# 获取模板
GET /api/v1/migrations/templates

# 预演
POST /api/v1/migrations/dry-run
{
  "name": "添加用户邮箱字段",
  "version": "1.0.0",
  "steps": [...]
}

# 分析计划
POST /api/v1/migrations/plan

# 执行迁移
POST /api/v1/migrations/execute
```

### 报告导出

```bash
GET /api/v1/reports/export?experiment_id=xxx&format=json
GET /api/v1/reports/export?migration_id=xxx&format=markdown
GET /api/v1/reports/export?experiment_id=xxx&migration_id=yyy&format=html
```

### WebSocket 实时事件

```
ws://localhost:8080/api/v1/ws/events
```

事件类型:
- `experiment_started`
- `experiment_stopped`
- `migration_started`
- `migration_completed`
- `error_occurred`

## 最佳实践

### 1. 准备阶段

```sql
-- 1. 先生成测试数据
psql -f migrations/test_data_generator.sql

-- 2. 查看测试数据量
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM orders;
```

### 2. 实验策略

**标准演练流程:**
1. 先 Dry Run 迁移脚本
2. 检查风险等级（Critical 需特别关注）
3. 运行基础混沌实验验证系统稳定性
4. 运行迁移 + 混沌组合实验
5. 分析报告，获取改进建议
6. 修复问题后重新演练

### 3. 推荐实验组合

**最小可用演练:**
- 迁移: 添加列 (低风险)
- 混沌: 高并发 + 网络中断 (30秒)

**完整演练:**
- 迁移: 添加唯一约束 (高风险)
- 混沌: 全部类型 (60秒)

**极端演练:**
- 迁移: 表结构重构
- 混沌: 全部类型 + 连接断开 (5分钟)

## 项目结构

```
migration-chaos-simulator/
├── backend/                    # Go 后端
│   ├── cmd/
│   │   └── server/
│   │       └── main.go         # 入口
│   ├── internal/
│   │   ├── api/                # HTTP API + WebSocket
│   │   ├── chaos/              # 混沌引擎
│   │   ├── config/             # 配置管理
│   │   ├── logger/             # 日志
│   │   ├── migration/          # 迁移模拟器
│   │   ├── queue/              # RabbitMQ 客户端
│   │   ├── reporter/           # 报告生成
│   │   ├── storage/            # 数据库连接池
│   │   └── tracer/             # 全链路追踪
│   ├── config/
│   │   └── config.yaml
│   ├── go.mod
│   └── Dockerfile
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   ├── App.js
│   │   ├── api.js
│   │   └── index.js
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
├── migrations/                 # 示例 SQL 脚本
├── docker-compose.yml
├── Makefile
└── README.md
```

## 配置说明

### 后端配置 (`backend/config/config.yaml`)

```yaml
server:
  port: 8080
  mode: debug

database:
  host: localhost
  port: 5432
  user: postgres
  password: postgres
  database: chaos_sim

rabbitmq:
  host: localhost
  port: 5672
  user: guest
  password: guest

chaos:
  enabled: true
  max_concurrent_experiments: 10

tracer:
  enabled: true
  buffer_size: 10000
```

## 故障排查

### 常见问题

**Q: 后端连接数据库失败**
```bash
# 检查 PostgreSQL 是否启动
docker-compose ps postgres
docker-compose logs postgres
```

**Q: WebSocket 连接失败**
- 检查端口 8080 是否开放
- 确认 CORS 配置
- 查看后端日志中的 WebSocket 相关错误

**Q: 实验总是失败**
- 检查资源限制（Docker 内存）
- 查看后端 panic 日志
- 减少并发数重试

## 生产使用建议

1. **不要直接在生产数据库运行** - 使用克隆的生产数据
2. **逐步增加复杂度** - 从简单实验开始
3. **记录每次演练** - 报告是改进的基础
4. **自动化演练** - 集成到 CI/CD 流程

## 许可证

MIT License
