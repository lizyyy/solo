# 直播推送系统 (Live Push System)

一个生产级别的直播消息推送系统，专门解决高并发场景下的复杂问题。

## 功能特性

### 核心功能

- ✅ **消息顺序性保证** - 使用 Kafka 分区键 `roomId-senderId` 保证同分区消息有序
- ✅ **幂等性处理** - Redis + Idempotency Key 实现重复提交防护
- ✅ **并发控制** - 分布式锁（写操作）+ 乐观锁（版本号检测）
- ✅ **缓存一致性** - 事件驱动的缓存失效 + 版本控制
- ✅ **事件溯源** - 所有状态变更记录为事件，支持重放
- ✅ **操作追踪** - 全局 Trace ID 贯穿 HTTP → Kafka → 数据库
- ✅ **可靠回滚** - 事件存储支持重放到任意历史版本
- ✅ **报告导出** - 支持 Excel、Markdown、PDF 格式导出

### 管理功能

- 📊 **消息管理** - 创建、查看、编辑、删除、重试消息
- 🔄 **操作回放** - 按消息 ID 或 Trace ID 回放完整操作过程
- 🐛 **问题诊断** - 自动检测异常并给出修复建议
- 📈 **统计报告** - 可视化展示消息统计数据

## 技术栈

### 后端

- **运行时**: Node.js 18+
- **框架**: Express.js + TypeScript
- **消息队列**: Apache Kafka (KafkaJS)
- **数据库**: MongoDB (Mongoose)
- **缓存/锁**: Redis (ioredis)
- **报告导出**: ExcelJS, Puppeteer (可选, PDF)
- **日志**: Winston

### 前端

- **框架**: React 18 + TypeScript
- **UI 组件**: Ant Design 5
- **状态管理**: TanStack Query (React Query)
- **路由**: React Router
- **图表**: Recharts
- **构建工具**: Vite

## 项目结构

```
live-push-system/
├── package.json              # 根配置
├── docker-compose.yml        # 基础设施 Docker 配置
├── .env.example              # 环境变量模板
├── README.md                 # 本文档
└── packages/
    ├── shared/               # 共享类型和工具函数
    │   ├── src/
    │   │   ├── types/        # 类型定义
    │   │   └── utils/        # 工具函数
    │   └── package.json
    ├── backend/              # 后端服务
    │   ├── src/
    │   │   ├── config/       # 配置管理
    │   │   ├── models/       # MongoDB 数据模型
    │   │   ├── services/     # 核心业务服务
    │   │   ├── routes/       # API 路由
    │   │   ├── utils/        # 工具函数
    │   │   └── index.ts      # 服务入口
    │   └── package.json
    └── frontend/             # 前端管理后台
        ├── src/
        │   ├── api/          # API 封装
        │   └── pages/        # 页面组件
        └── package.json
```

## 快速开始

### 前置要求

- Node.js 18+
- npm 9+
- Docker 和 Docker Compose (用于启动基础设施)

### 1. 启动基础设施

使用 Docker Compose 启动 MongoDB、Redis、Kafka：

```bash
# 启动所有依赖服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f mongodb redis kafka
```

服务地址：
- MongoDB: `mongodb://localhost:27017`
- Redis: `localhost:6379`
- Kafka: `localhost:9093` (外部访问)
- Kafka UI: `http://localhost:8080` (Web 管理界面)

### 2. 安装依赖

```bash
# 安装 shared 包
cd packages/shared
npm install
npm run build

# 安装后端依赖
cd ../backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

或者使用根目录脚本（推荐）：

```bash
npm run install:all
```

### 3. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

根据需要修改 `.env` 文件中的配置。

### 4. 启动服务

**启动后端服务：**

```bash
cd packages/backend
npm run dev
# 或
npm run dev:backend
```

后端服务将在 `http://localhost:3000` 启动。

**启动前端服务：**

```bash
cd packages/frontend
npm run dev
# 或
npm run dev:frontend
```

前端服务将在 `http://localhost:5173` 启动，API 请求会自动代理到后端。

### 5. 验证服务

1. 打开浏览器访问 `http://localhost:5173`
2. 检查前端页面是否正常显示
3. 尝试创建消息、查看消息列表

## API 接口

### 消息管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/messages` | 创建消息（支持 Idempotency-Key 幂等） |
| GET | `/api/messages/:id` | 获取消息详情 |
| GET | `/api/messages/room/:roomId` | 获取房间消息列表 |
| PUT | `/api/messages/:id` | 更新消息（乐观锁版本控制） |
| DELETE | `/api/messages/:id` | 删除消息 |
| POST | `/api/messages/:id/retry` | 重试失败消息 |
| POST | `/api/messages/:id/rollback` | 回滚消息到历史版本 |

### 操作回放

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/replay/message/:id` | 回放消息的所有事件 |
| GET | `/api/replay/trace/:traceId` | 按 Trace ID 回放 |
| GET | `/api/replay/compare/:id` | 对比两个版本状态 |
| GET | `/api/replay/diagnose/:id` | 诊断消息问题 |
| GET | `/api/replay/path/:id` | 获取消息执行路径 |

### 报告导出

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/reports/generate` | 生成报告数据 |
| GET | `/api/reports/export/excel/:roomId` | 导出 Excel 报告 |
| GET | `/api/reports/export/markdown/:roomId` | 导出 Markdown 报告 |
| GET | `/api/reports/export/pdf/:roomId` | 导出 PDF 报告 (需要 puppeteer) |

## 核心设计

### 消息顺序性

使用 Kafka 分区键设计保证消息顺序：

```typescript
// 同一房间同一发送者的消息进入同一分区
const partitionKey = `${roomId}-${message.senderId}`;
```

### 幂等性

客户端请求时携带 `Idempotency-Key` 头部：

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{"roomId":"room1","type":"CHAT","content":"Hello"}'
```

系统使用 Redis 原子操作检查幂等键，支持：
- **重复请求检测** - 同一幂等键返回相同结果
- **处理中等待** - 第一次请求未完成时自动等待
- **失败重试** - 上次失败时允许重新处理

### 并发控制

1. **分布式锁** - 写操作获取房间级锁
2. **乐观锁** - 版本号检测并发更新
3. **冲突解决** - 自动合并可编辑字段

### 事件溯源

所有状态变更记录为事件：

```typescript
// 事件类型
enum EventType {
  MESSAGE_CREATED,    // 消息创建
  MESSAGE_UPDATED,    // 消息更新
  MESSAGE_DELETED,    // 消息删除
  MESSAGE_PUSHED,     // 消息推送
  MESSAGE_FAILED,     // 推送失败
  MESSAGE_ROLLBACKED, // 消息回滚
  CONFLICT_OCCURRED,  // 冲突发生
}
```

支持重放事件重建任意历史版本的状态。

## 运维监控

### 健康检查

- Kafka UI: `http://localhost:8080`
- 服务日志: 控制台输出（可配置文件输出）

### 日志格式

```json
{
  "level": "info",
  "message": "Message created",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "traceId": "xxx",
  "messageId": "xxx",
  "roomId": "room1"
}
```

所有日志包含全局 Trace ID，便于问题追踪。

## 常见问题

### 1. MongoDB 连接失败

确保 Docker 容器已启动：

```bash
docker-compose up -d mongodb
docker-compose logs mongodb
```

### 2. Redis 连接失败

检查 Redis 容器状态：

```bash
docker-compose up -d redis
redis-cli ping
```

### 3. Kafka 连接失败

Kafka 启动较慢，等待健康检查通过：

```bash
docker-compose logs -f kafka
# 等待看到 "started (kafka.server.KafkaServer)"
```

### 4. PDF 导出不可用

PDF 导出需要安装 puppeteer（会下载 Chromium，需要较长时间）：

```bash
cd packages/backend
npm install puppeteer
```

### 5. 类型检查失败

重新构建 shared 包：

```bash
cd packages/shared
npm run build
```

## 开发命令

```bash
# 安装所有依赖
npm run install:all

# 构建 shared 包
npm run build:shared

# 启动后端
npm run dev:backend

# 启动前端
npm run dev:frontend

# 类型检查
npm run typecheck

# 类型检查（仅后端）
npm run typecheck:backend

# 类型检查（仅前端）
npm run typecheck:frontend
```

## 许可证

MIT License
