# 客服 SLA 回调站

一个全栈 Web/API 应用，用于处理工单系统 SLA 超时事件的回调推送，支持失败补发。

## 功能特性

- **事件管理**：创建、查询 SLA 超时事件
- **自动重试**：回调失败自动重试，支持配置重试策略
- **手动补发**：支持手动选择失败事件进行批量重试
- **去重保护**：基于事件Key防止重复推送
- **响应记录**：完整记录每次回调的请求和响应信息
- **数据导出**：支持导出事件数据为 CSV 格式
- **监控面板**：实时查看事件统计和状态
- **API 接口**：完整的 RESTful API 支持

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite 数据库
- axios (HTTP 客户端)
- json2csv (数据导出)

### 前端
- React 18 + TypeScript
- Vite
- Ant Design
- React Router
- axios

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.ts        # 入口文件
│   │   ├── routes.ts       # API 路由
│   │   ├── services.ts     # 业务逻辑
│   │   ├── database.ts     # 数据库操作
│   │   └── types.ts        # 类型定义
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── main.tsx       # 入口文件
│   │   ├── App.tsx        # 主应用组件
│   │   ├── api.ts         # API 客户端
│   │   ├── types.ts       # 类型定义
│   │   └── pages/         # 页面组件
│   │       ├── Dashboard.tsx
│   │       ├── Events.tsx
│   │       ├── EventDetail.tsx
│   │       ├── RetryBatches.tsx
│   │       └── Settings.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── package.json           # 根项目配置
```

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 启动开发环境

```bash
# 方式一：分别启动（推荐）
# 终端1：启动后端服务
cd backend && npm run dev

# 终端2：启动前端服务
cd frontend && npm run dev

# 方式二：使用 concurrently 同时启动
npm run dev
```

- 后端服务运行在: http://localhost:3000
- 前端应用运行在: http://localhost:5173

## API 接口

### 事件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/events | 创建超时事件 |
| GET | /api/events | 查询事件列表 |
| GET | /api/events/:id | 获取事件详情 |
| POST | /api/events/:id/retry | 手动重试事件 |

### 补发批次

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/retry-batches | 创建补发批次 |
| GET | /api/retry-batches | 查询补发批次列表 |

### 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sla-rules | 获取 SLA 规则列表 |
| GET | /api/callback-targets | 获取回调目标列表 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/export/events | 导出事件数据 (CSV) |

### 查询参数

所有列表接口支持以下查询参数：

- `status`: 状态过滤
- `ticketId`: 工单 ID 过滤
- `startTime`: 开始时间 (ISO 格式)
- `endTime`: 结束时间 (ISO 格式)
- `page`: 页码 (默认 1)
- `pageSize`: 每页条数 (默认 20)

## 数据模型

### Ticket (工单)
```typescript
{
  id: string;
  ticketId: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### SLARule (SLA 规则)
```typescript
{
  id: string;
  name: string;
  description?: string;
  priority: string;
  timeoutMinutes: number;
  warningMinutes?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CallbackTarget (回调目标)
```typescript
{
  id: string;
  name: string;
  description?: string;
  url: string;
  method: 'POST' | 'GET' | 'PUT';
  headers?: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  retryIntervalMs: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### TimeoutEvent (超时事件)
```typescript
{
  id: string;
  eventKey: string;           // 用于去重的唯一标识
  ticketId: string;
  slaRuleId: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retrying';
  triggeredAt: Date;
  nextRetryAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### RetryBatch (补发批次)
```typescript
{
  id: string;
  eventIds: string[];
  triggeredBy: string;
  reason: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  successCount: number;
  failedCount: number;
  createdAt: Date;
}
```

### ResponseSummary (响应摘要)
```typescript
{
  id: string;
  eventId: string;
  targetId: string;
  status: 'success' | 'failed';
  statusCode?: number;
  responseBody?: string;
  errorMessage?: string;
  durationMs: number;
  requestedAt: Date;
  respondedAt: Date;
}
```

## 使用示例

### 创建超时事件

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "TICKET-001",
    "slaRuleId": "rule-1",
    "eventKey": "TICKET-001-SLA1-123456",
    "ticketData": {
      "title": "用户反馈登录问题",
      "content": "无法正常登录系统",
      "priority": "high"
    }
  }'
```

### 查询事件列表

```bash
curl "http://localhost:3000/api/events?status=failed&page=1&pageSize=10"
```

### 手动重试事件

```bash
curl -X POST http://localhost:3000/api/events/{event-id}/retry \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "目标服务已恢复",
    "triggeredBy": "admin"
  }'
```

## 核心规则

1. **事件去重**：基于 `eventKey` 字段，重复的事件 Key 会被拒绝
2. **自动重试**：回调失败后会根据配置自动重试，达到最大次数后标记为失败
3. **异步处理**：事件创建后会立即返回，回调处理在后台异步执行
4. **完整记录**：每次回调的请求和响应信息都会被完整记录
5. **状态流转**：pending -> processing -> success/failed/retrying

## 前端功能

### 总览页面
- 事件统计卡片（总数、成功、失败、待处理）
- 成功率统计
- 最近事件列表

### 事件列表
- 支持按状态、工单 ID、时间范围筛选
- 支持创建新事件
- 支持手动重试失败事件
- 支持导出数据

### 事件详情
- 事件基本信息
- 回调响应记录（可展开查看响应内容和错误信息）
- 手动重试按钮

### 补发批次
- 查看所有补发批次记录
- 显示成功/失败计数

### 配置管理
- 查看 SLA 规则配置
- 查看回调目标配置
- 系统说明和 API 文档

## 生产部署

### 构建
```bash
npm run build
```

### 启动生产服务
```bash
cd backend && npm start
```

## License

MIT
