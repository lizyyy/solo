# 门店库存管理系统 (Store Inventory System)

一个生产级的门店库存管理系统，专门设计用于解决复杂的库存操作场景。

## 核心特性

### 数据一致性保证
- **幂等性控制**：防止重复提交
- **乐观锁**：处理多人同时编辑
- **分布式锁**：关键操作串行化
- **事务管理**：确保 ACID 特性
- **分布式事务**：支持跨服务一致性

### 操作追踪与回放
- **完整审计日志**：所有操作可追溯
- **操作回放**：问题定位和重现
- **版本控制**：支持数据回滚
- **操作快照**：关键节点数据记录

### 导出功能
- **Excel** 格式导出
- **Markdown** 格式导出
- **PDF** 格式导出

## 技术栈

- **后端**: Node.js + NestJS + TypeScript
- **前端**: Vue 3 + TypeScript + Element Plus
- **数据库**: PostgreSQL
- **缓存**: Redis
- **队列**: BullMQ (Redis)
- **ORM**: Prisma
- **API文档**: Swagger/OpenAPI

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── common/         # 公共模块
│   │   │   ├── decorators/ # 装饰器
│   │   │   ├── guards/     # 守卫
│   │   │   ├── interceptors/ # 拦截器
│   │   │   └── filters/    # 异常过滤器
│   │   ├── modules/        # 业务模块
│   │   │   ├── auth/       # 认证模块
│   │   │   ├── store/      # 门店模块
│   │   │   ├── inventory/  # 库存模块
│   │   │   ├── product/    # 商品模块
│   │   │   ├── audit/      # 审计日志模块
│   │   │   └── export/     # 导出模块
│   │   ├── infrastructure/ # 基础设施
│   │   │   ├── redis/      # Redis 配置
│   │   │   ├── prisma/     # Prisma 配置
│   │   │   └── queue/      # 队列配置
│   │   └── main.ts
│   └── prisma/             # 数据库 schema
│
└── frontend/               # 前端应用
    ├── src/
    │   ├── api/           # API 接口
    │   ├── stores/        # 状态管理
    │   ├── views/         # 页面组件
    │   ├── components/    # 通用组件
    │   └── utils/         # 工具函数
    └── package.json
```

## 快速开始

### 前置要求
- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 环境配置

1. 启动 PostgreSQL 和 Redis
2. 创建数据库：
```sql
CREATE DATABASE store_inventory;
```

### 后端启动

```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

后端服务将运行在 `http://localhost:3000`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端将运行在 `http://localhost:5173`

## 核心设计理念

### 1. 幂等性设计
每个操作都需要携带唯一的 `requestId`，系统通过 Redis 记录已处理的请求，防止重复提交。

### 2. 并发控制
- **乐观锁**: 使用 `version` 字段，更新时检查版本号
- **分布式锁**: 关键操作（如调拨）使用 Redlock 确保串行执行
- **数据库事务**: 所有库存变更在事务中执行

### 3. 审计追踪
- 每个操作自动记录审计日志
- 记录操作前后的数据快照
- 支持操作回放，重现问题场景

### 4. 异步任务管理
- 使用 BullMQ 队列管理异步任务
- 任务带有优先级和重试策略
- 支持任务顺序控制和依赖关系

### 5. 缓存策略
- 读写分离缓存
- 缓存失效策略（TTL + 主动失效）
- 缓存穿透保护

## API 文档

启动后端后访问 `http://localhost:3000/api` 查看 Swagger 文档。
