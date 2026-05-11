# 日志分析系统 (Log Analyzer)

一个专业级别的日志分析系统，用于追踪和分析复杂的线上问题。支持异常检测、操作回放、报告导出等功能。

## 功能特性

### 🔍 智能异常检测
- **重复操作检测** - 5秒内相同操作重复提交
- **并发冲突检测** - 多用户同时修改同一资源
- **异步任务顺序错乱** - 异步任务执行顺序异常
- **缓存问题检测** - 缓存过期或版本不一致
- **数据回滚失败** - ROLLBACK 操作执行失败

### 🎬 操作追踪回放
- 完整的时间线可视化
- 可控制播放速度 (0.5x - 3x)
- 单步前进/后退
- 调用关系树展示
- 关键路径（错误/异常）高亮
- 追踪内搜索功能

### 📊 多格式报告导出
- **Excel (.xlsx)** - 多工作表，包含概览、日志详情、异常分析
- **Markdown** - 结构化技术文档
- **PDF** - 正式报告格式
- **JSON** - 程序可处理格式

## 快速开始

### 方式一：开发模式（推荐用于验证）

#### 前置条件
- Node.js 18+

#### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

#### 启动服务

**方式 A：无 MongoDB 模式（最简单，适合快速验证）**

系统支持**内存降级模式**，无需安装 MongoDB 即可体验所有功能。

```bash
# 启动后端（会自动检测 MongoDB，不可用时自动切换到内存模式）
cd backend
npm run dev

# 启动前端（新终端）
cd frontend
npm run dev
```

系统启动时会显示：
```
⚠️  MongoDB 连接失败: ...
⚠️  正在切换到内存降级模式...
✅  已切换到内存降级模式。注意：重启后数据将丢失。
```

**方式 B：使用 MongoDB（持久化存储）**

```bash
# 启动 MongoDB（如果使用 Docker）
docker run -d -p 27017:27017 mongo:6.0

# 启动后端
cd backend
npm run dev

# 启动前端
cd frontend
npm run dev
```

#### 生成测试数据

```bash
cd backend
npm run generate:data
```

#### 访问系统

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001
- 健康检查: http://localhost:3001/health

### 方式二：Docker Compose

#### 前置条件
- Docker
- Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问: http://localhost

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 后端服务端口 | 3001 |
| `MONGO_URI` | MongoDB 连接地址 | mongodb://localhost:27017/log_analyzer |
| `SKIP_MONGO` | 跳过 MongoDB，强制使用内存模式 | false |

## API 接口

### 日志管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/logs/ingest` | 摄入日志（支持批量） |
| GET | `/api/logs/search` | 搜索日志 |
| GET | `/api/logs/statistics` | 获取统计信息 |
| GET | `/api/logs/services` | 获取服务列表 |
| GET | `/api/logs/:id` | 获取单条日志详情 |

### 追踪回放

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/replay/traces` | 获取追踪列表 |
| GET | `/api/replay/trace/:traceId` | 获取完整时间线 |
| GET | `/api/replay/trace/:traceId/summary` | 获取追踪摘要 |
| GET | `/api/replay/trace/:traceId/step/:index` | 获取单步详情 |
| GET | `/api/replay/trace/:traceId/critical` | 获取关键路径 |
| GET | `/api/replay/trace/:traceId/search` | 在追踪内搜索 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/generate` | 生成报告（json/excel/markdown/pdf） |
| POST | `/api/reports/preview` | 预览报告数据 |
| GET | `/api/reports` | 获取报告列表 |
| GET | `/api/reports/:reportId` | 获取报告详情 |
| POST | `/api/reports/:reportId/export` | 导出已有报告 |

## 使用示例

### 发送日志

```javascript
const axios = require('axios');

// 单条日志
await axios.post('http://localhost:3001/api/logs/ingest', {
  traceId: 'trace-001',
  spanId: 'span-001',
  timestamp: new Date().toISOString(),
  level: 'INFO',
  source: 'web',
  service: 'order-service',
  operation: 'CREATE',
  message: '用户创建订单',
  userId: 'user-123',
  details: {
    orderId: 'ORD-001',
    amount: 999.00
  },
  status: 'SUCCESS',
  duration: 150
});

// 批量日志
await axios.post('http://localhost:3001/api/logs/ingest', [
  { /* 日志1 */ },
  { /* 日志2 */ },
  { /* 日志3 */ }
]);
```

### 生成报告

```javascript
const response = await axios.post('http://localhost:3001/api/reports/generate', {
  format: 'excel',  // json | excel | markdown | pdf
  startTime: '2024-01-01T00:00:00.000Z',
  endTime: '2024-01-31T23:59:59.999Z',
  level: 'ERROR',    // 可选
  service: 'order-service',  // 可选
  userId: 'user-123',       // 可选
  anomalies: ['DUPLICATE', 'CONCURRENCY']  // 可选
}, { responseType: 'blob' });

// 保存文件
const fs = require('fs');
fs.writeFileSync('report.xlsx', response.data);
```

## 日志字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| traceId | string | 是 | 追踪链唯一标识 |
| spanId | string | 是 | 单步唯一标识 |
| parentSpanId | string | 否 | 父步骤ID，用于构建调用树 |
| timestamp | Date | 是 | 日志时间 |
| level | enum | 是 | DEBUG/INFO/WARN/ERROR/FATAL |
| service | string | 是 | 服务名称 |
| operation | string | 是 | 操作类型 |
| message | string | 是 | 日志消息 |
| userId | string | 否 | 用户ID |
| status | enum | 否 | START/PROCESSING/SUCCESS/FAILED/ROLLBACK/TIMEOUT/END |
| duration | number | 否 | 耗时(ms) |
| tags | string[] | 否 | 标签，如 ['async', 'cache'] |
| details | object | 否 | 详细信息，异常检测会使用 |

## 异常检测规则

### DUPLICATE (重复操作)
- 检测条件：5秒内相同操作 + 相同请求体
- 触发场景：用户重复点击提交按钮

### CONCURRENCY (并发冲突)
- 检测条件：1秒内不同用户修改同一资源
- 触发场景：多人同时编辑同一条数据

### ASYNC_OUT_OF_ORDER (异步错乱)
- 检测条件：异步任务的 expectedOrder 与执行顺序不一致
- 触发场景：消息队列顺序错乱

### CACHE_STALE (缓存问题)
- 检测条件：
  - 缓存过期超过 5 分钟未更新
  - 数据库更新后缓存版本不一致
- 触发场景：缓存失效、更新失败

### ROLLBACK_FAILED (回滚失败)
- 检测条件：ROLLBACK 操作 status 为 FAILED
- 触发场景：事务回滚失败

## 项目结构

```
log-analyzer/
├── backend/
│   ├── src/
│   │   ├── config/          # 配置
│   │   ├── controllers/     # 控制器
│   │   ├── data/            # 数据访问层
│   │   ├── models/          # 数据模型
│   │   ├── routes/          # 路由
│   │   ├── services/        # 业务逻辑
│   │   └── index.js         # 入口
│   ├── scripts/             # 工具脚本
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # 组件
│   │   ├── pages/           # 页面
│   │   ├── services/        # API 服务
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 许可证

MIT
