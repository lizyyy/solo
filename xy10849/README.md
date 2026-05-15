# RAG 来源新鲜度控制台

一个偏技术方向的全栈 Web/API 应用，用于监控 RAG 问答系统中文档引用的新鲜度。

## 功能特性

### 后端能力
- ✅ 处理重复调用（幂等性支持）
- ✅ 异常返回处理
- ✅ 状态查询
- ✅ 数据导出（CSV）

### 数据模型
- **数据源**：管理原始文档来源
- **抓取批次**：记录每次抓取操作
- **引用片段**：RAG 系统引用的文档片段
- **过期规则**：定义新鲜度检测规则
- **刷新任务**：管理文档刷新任务
- **告警记录**：记录过期告警

### 业务规则
- 来源索引
- 过期检测
- 刷新队列
- 引用追踪
- 新鲜度报告

## 技术栈
- **后端**：Node.js + Express
- **数据库**：SQLite 3
- **前端**：原生 HTML/JS/CSS
- **其他**：uuid, csv-writer, moment

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

该命令会创建所有必要的数据表。

### 3. 填充测试数据

```bash
npm run seed
```

该命令会填充包含各种场景的测试数据：
- ✅ 成功场景：数据源抓取成功、任务成功完成
- ❌ 失败场景：数据源抓取失败、任务执行失败
- 🔄 重复提交：幂等性测试数据
- 🛠️  人工修正：标记为人工修复的任务
- ⚠️  过期检测：已过期的文档片段

### 4. 启动服务

```bash
npm start
# 或者开发模式（自动重启）
npm run dev
```

服务启动后访问：http://localhost:3000

### 5. 导出数据

```bash
npm run export
```

导出的 CSV 文件位于 `exports/` 目录。

## 前端控制台使用说明

访问 http://localhost:3000 即可进入控制台，包含以下功能：

### 📊 总览页
- 关键指标统计卡片（活跃数据源、文档片段数、过期数量、新鲜度等）
- 各数据源新鲜度详情（带进度条可视化）
- 待处理任务列表（可直接点击执行）

### 📄 引用片段页
- 所有文档片段列表
- 新鲜度标签（绿色/黄色/红色区分）
- 过期状态标识
- 导出报告按钮

### 🔄 刷新任务页
- 所有刷新任务列表（包含各种状态）
- 新建任务按钮（支持幂等Key）
- 失败任务操作：重试、人工修复
- 显示重试次数和人工修复标记

### ⚠️ 告警记录页
- 所有告警记录
- 告警级别标签（critical/high/medium/low）
- 未解决告警可标记为已解决

### 📦 数据源管理页
- 数据源列表
- 新增数据源按钮
- 删除数据源功能

## API 接口文档

### 数据源管理

#### 创建数据源
```http
POST /api/data-sources
Content-Type: application/json

{
    "name": "产品文档库",
    "type": "web",
    "url": "https://docs.example.com",
    "config": {}
}
```

#### 查询数据源列表
```http
GET /api/data-sources?status=active&limit=50&offset=0
```

#### 查询数据源详情
```http
GET /api/data-sources/{id}
```

#### 更新数据源
```http
PUT /api/data-sources/{id}
Content-Type: application/json

{
    "name": "新名称",
    "type": "api",
    "status": "active"
}
```

#### 删除数据源
```http
DELETE /api/data-sources/{id}
```

### 抓取批次

#### 创建抓取批次
```http
POST /api/crawl-batches
Content-Type: application/json

{
    "data_source_id": "uuid"
}
```

#### 查询抓取批次
```http
GET /api/crawl-batches?data_source_id={id}&status=completed
```

#### 更新批次状态
```http
PUT /api/crawl-batches/{id}/status
Content-Type: application/json

{
    "status": "completed",
    "success_count": 15,
    "failed_count": 0
}
```

### 引用片段

#### 创建引用片段
```http
POST /api/snippets
Content-Type: application/json

{
    "data_source_id": "uuid",
    "crawl_batch_id": "uuid",
    "content": "文档内容...",
    "last_modified_at": "2024-01-01T00:00:00Z",
    "fingerprint": "content-hash"
}
```

#### 查询引用片段
```http
GET /api/snippets?data_source_id={id}&is_expired=true
```

#### 查看引用历史
```http
GET /api/snippets/{id}/references
```

### 刷新任务（支持幂等）

#### 创建刷新任务
```http
POST /api/refresh-tasks
Content-Type: application/json

{
    "snippet_id": "uuid",
    "data_source_id": "uuid",
    "priority": "high",
    "idempotency_key": "unique-key-for-deduplication"
}
```

**幂等性说明**：如果提供了 `idempotency_key`，相同 key 的重复请求会直接返回已创建的任务，避免重复创建。

#### 查询刷新任务
```http
GET /api/refresh-tasks?status=pending&data_source_id={id}
```

#### 更新任务状态
```http
PUT /api/refresh-tasks/{id}/status
Content-Type: application/json

{
    "status": "running"  // pending, running, completed, failed
}
```

#### 重试任务
```http
POST /api/refresh-tasks/{id}/retry
```

#### 人工修复任务
```http
POST /api/refresh-tasks/{id}/manual-fix
Content-Type: application/json

{
    "fixed_by": "张三",
    "fix_note": "手动更新了文档链接"
}
```

### 新鲜度报告

#### 获取总览统计
```http
GET /api/reports/overview
```

响应示例：
```json
{
    "active_data_sources": 3,
    "total_snippets": 8,
    "expired_snippets": 3,
    "freshness_rate": "62.50",
    "pending_tasks": 1,
    "running_tasks": 1,
    "failed_tasks": 1,
    "active_alerts": 3
}
```

#### 获取数据源新鲜度详情
```http
GET /api/reports/freshness
```

#### 导出报告
```http
GET /api/reports/export
```

### 告警管理

#### 创建告警
```http
POST /api/alerts
Content-Type: application/json

{
    "type": "freshness",
    "level": "high",
    "message": "检测到过期文档",
    "related_id": "uuid",
    "related_type": "snippet"
}
```

#### 查询告警
```http
GET /api/alerts?level=critical&is_resolved=false
```

#### 解决告警
```http
PUT /api/alerts/{id}/resolve
Content-Type: application/json

{
    "resolved_by": "admin",
    "resolve_note": "已手动更新文档"
}
```

### 新鲜度规则

#### 创建规则
```http
POST /api/freshness-rules
Content-Type: application/json

{
    "name": "过期检测规则",
    "rule_type": "expiration",
    "condition": "last_modified_at < NOW() - 30 DAY",
    "action": "mark_expired",
    "priority": 100
}
```

#### 查询规则
```http
GET /api/freshness-rules
```

#### 启用/禁用规则
```http
PUT /api/freshness-rules/{id}/toggle
```

### 健康检查

```http
GET /api/health
```

## 测试场景说明

### ✅ 成功场景
- 数据源"产品文档库"抓取成功（15个成功）
- 刷新任务成功完成状态
- 告警成功标记为已解决

### ❌ 失败场景
- 数据源"知识库V2"抓取失败（20个全部失败）
- 刷新任务执行失败，带有错误信息
- 连续3次重试失败的任务

### 🔄 重复提交测试
创建任务时使用相同的 `idempotency_key`：
```bash
# 第一次请求
curl -X POST http://localhost:3000/api/refresh-tasks \
  -H "Content-Type: application/json" \
  -d '{"snippet_id": "test-id", "data_source_id": "source-id", "idempotency_key": "my-unique-key-123"}'

# 第二次请求（相同key）
curl -X POST http://localhost:3000/api/refresh-tasks \
  -H "Content-Type: application/json" \
  -d '{"snippet_id": "test-id", "data_source_id": "source-id", "idempotency_key": "my-unique-key-123"}'
# 返回幂等结果，不会重复创建
```

### 🛠️ 人工修正场景
- 失败任务可以通过"人工修复"按钮标记为已解决
- 记录修复人和修复说明
- 前端显示人工修复标记

### ⚠️ 过期检测
- 系统预置3个过期文档片段
- 新鲜度分数低于50%的片段
- 过期状态自动标记

## 目录结构

```
rag-freshness-console/
├── server/
│   ├── index.js              # 服务入口
│   ├── db.js                 # 数据库连接
│   ├── routes/               # API 路由
│   │   ├── dataSources.js    # 数据源路由
│   │   ├── crawlBatches.js   # 抓取批次路由
│   │   ├── snippets.js       # 引用片段路由
│   │   ├── refreshTasks.js   # 刷新任务路由
│   │   ├── alerts.js         # 告警路由
│   │   ├── reports.js        # 报告路由
│   │   └── freshnessRules.js # 规则路由
│   ├── services/             # 业务服务
│   │   └── idempotencyService.js  # 幂等性服务
│   └── scripts/              # 工具脚本
│       ├── initDB.js         # 数据库初始化
│       ├── seedData.js       # 测试数据填充
│       └── exportData.js     # 数据导出
├── public/
│   └── index.html            # 前端控制台
├── exports/                  # 导出文件目录
├── package.json
└── README.md
```

## 常见问题

### Q: 如何重置数据库？
A: 删除 `rag-freshness.db` 文件，然后重新运行 `npm run init-db` 和 `npm run seed`。

### Q: 幂等性是如何实现的？
A: 通过 `idempotency_keys` 表存储请求的唯一标识和响应结果，相同 key 的请求直接返回缓存结果。

### Q: 支持哪些导出格式？
A: 目前支持 CSV 格式，可以通过前端按钮或 API 接口导出。

### Q: 如何自定义新鲜度规则？
A: 可以通过 API 创建自定义的新鲜度规则，设置条件和触发动作。

## 许可证

MIT
