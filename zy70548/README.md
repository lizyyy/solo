# 异步作业撤销API (Async Job Cancel API)

内部使用的异步作业撤销系统，支持批量作业撤销、状态追踪、人工修正和报告导出。

## 核心特性

- **状态切分**: PENDING → CONFIRMED → INTERCEPTED → CANCELED / COMPENSATED
- **未执行撤销**: 自动拦截 PENDING 状态的任务
- **已执行保护**: COMPLETED / FAILED 任务不受影响
- **原因留痕**: 所有操作记录操作员、时间、原因代码
- **报告导出**: 支持 JSON/CSV 格式导出完整审计记录
- **失败路径**: 保留原始输入、处理依据、最终结论

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm start
```

## API 接口

### 基础信息

- **Base URL**: `http://localhost:3000/api/cancel-requests`
- **Health Check**: `GET /health`
- **Constants**: `GET /api/constants`

### 1. 创建撤销请求

```http
POST /api/cancel-requests
Content-Type: application/json

{
  "jobId": "JOB-2024-001",
  "jobName": "月度数据同步作业",
  "tasks": [
    { "taskId": "T001", "taskName": "数据抽取", "executionStatus": "PENDING" },
    { "taskId": "T002", "taskName": "数据转换", "executionStatus": "RUNNING" },
    { "taskId": "T003", "taskName": "数据加载", "executionStatus": "COMPLETED" },
    { "taskId": "T004", "taskName": "索引重建", "executionStatus": "FAILED" }
  ],
  "reason": {
    "code": "WRONG_CONDITION",
    "message": "用户提交大批量作业后发现条件选错",
    "operator": "admin",
    "evidence": "ticket-12345"
  },
  "retainResultPolicy": "ALL"
}
```

**任务执行状态 (TaskExecutionStatus)**:
- `PENDING` - 待执行
- `RUNNING` - 执行中
- `COMPLETED` - 已完成
- `FAILED` - 失败
- `CANCELED` - 已撤销

**结果保留策略 (RetainResultPolicy)**:
- `ALL` - 保留所有结果
- `NONE` - 不保留结果
- `PARTIAL` - 部分保留

### 2. 查询撤销请求列表

```http
GET /api/cancel-requests?status=PENDING&page=1&pageSize=20
```

**查询参数**:
- `jobId` - 作业ID
- `status` - 状态过滤
- `operator` - 操作员
- `startTime` - 开始时间
- `endTime` - 结束时间
- `page` - 页码 (默认: 1)
- `pageSize` - 每页条数 (默认: 20)

### 3. 获取单个撤销请求详情

```http
GET /api/cancel-requests/:requestId
```

### 4. 确认撤销请求

```http
POST /api/cancel-requests/:requestId/confirm
Content-Type: application/json

{
  "operator": "manager"
}
```

**撤销请求状态 (CancelRequestStatus)**:
- `PENDING` - 待处理（初始状态）
- `CONFIRMED` - 已确认
- `INTERCEPTED` - 拦截中
- `CANCELED` - 已撤销
- `COMPENSATED` - 已补偿（无任务可撤销）

### 5. 执行撤销处理

```http
POST /api/cancel-requests/:requestId/process
```

**处理规则**:
- PENDING 任务 → 标记为 CANCELED（已拦截）
- RUNNING 任务 → 标记为 CANCELED（已撤销）
- COMPLETED 任务 → 保持不变（受保护）
- FAILED 任务 → 保持不变（受保护）

### 6. 更新状态（手动）

```http
PATCH /api/cancel-requests/:requestId/status
Content-Type: application/json

{
  "status": "COMPENSATED",
  "operator": "admin",
  "reason": "经确认所有任务已完成，无需撤销"
}
```

### 7. 人工修正任务状态

```http
POST /api/cancel-requests/:requestId/manual-correction
Content-Type: application/json

{
  "taskId": "T002",
  "newStatus": "COMPLETED",
  "operator": "admin",
  "reason": "任务实际已执行完成，系统状态有误"
}
```

### 8. 添加操作员备注

```http
POST /api/cancel-requests/:requestId/notes
Content-Type: application/json

{
  "operator": "admin",
  "note": "已电话通知用户，撤销处理预计10分钟完成"
}
```

### 9. 导出完整记录

```http
GET /api/cancel-requests/:requestId/export?format=json
GET /api/cancel-requests/:requestId/export?format=csv
```

### 10. 导出撤销报告

```http
GET /api/cancel-requests/:requestId/reports/:reportId/export?format=json
GET /api/cancel-requests/:requestId/reports/:reportId/export?format=csv
```

## 数据模型

### CancelRequest（撤销请求）

| 字段 | 类型 | 说明 |
|------|------|------|
| requestId | string | 请求ID（UUID） |
| jobId | string | 作业ID |
| jobName | string | 作业名称 |
| status | CancelRequestStatus | 当前状态 |
| tasks | Task[] | 任务列表 |
| reasons | Reason[] | 原因/备注历史 |
| retainResultPolicy | RetainResultPolicy | 结果保留策略 |
| reports | Report[] | 撤销报告列表 |
| failurePaths | FailurePath[] | 失败路径记录 |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |
| confirmedAt | Date | 确认时间 |
| completedAt | Date | 完成时间 |

### FailurePath（失败路径记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| originalInput | unknown | 原始输入 |
| processingBasis | string | 处理依据 |
| conclusion | string | 最终结论 |
| occurredAt | Date | 发生时间 |

## 使用示例

### 完整撤销流程

```bash
# 1. 创建撤销请求
curl -X POST http://localhost:3000/api/cancel-requests \
  -H "Content-Type: application/json" \
  -d @examples/create-request.json

# 2. 确认请求（假设返回的 requestId 是 abc-123）
curl -X POST http://localhost:3000/api/cancel-requests/abc-123/confirm \
  -H "Content-Type: application/json" \
  -d '{"operator": "manager"}'

# 3. 执行撤销处理
curl -X POST http://localhost:3000/api/cancel-requests/abc-123/process

# 4. 查看处理结果
curl http://localhost:3000/api/cancel-requests/abc-123

# 5. 导出报告（CSV格式）
curl -O http://localhost:3000/api/cancel-requests/abc-123/export?format=csv
```

## 项目结构

```
src/
├── types/
│   └── index.ts         # 类型定义和枚举
├── store/
│   └── CancelRequestStore.ts  # 数据存储层
├── services/
│   ├── CancelRequestService.ts  # 业务逻辑服务
│   └── ExportService.ts        # 导出服务
├── routes/
│   └── cancelRequest.ts  # API 路由
└── index.ts           # 应用入口
```

## 注意事项

1. 当前使用内存存储，生产环境请替换为数据库
2. 状态转换有严格校验，不允许跳跃式转换
3. 所有操作都会记录失败路径，便于审计追溯
4. 已完成/失败的任务受保护，不会被撤销影响
