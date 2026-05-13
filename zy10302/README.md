# 批量任务租约 API

基于 Go + SQLite 实现的批量任务租约管理系统，专为分布式任务调度设计。

## 核心功能

- **任务池管理：创建、查询、状态跟踪
- **租约机制：领取、续约保活、超时抢占、释放
- **结果提交：幂等性保证，重复提交拦截
- **时间线记录：完整操作审计
- **问题排查：诊断报告导出

## API 端点

### 任务管理
- `POST /tasks` - 创建任务
- `GET /tasks/{id}` - 获取任务详情
- `GET /tasks/list` - 列出任务（支持 status 过滤）

### 租约管理
- `POST /lease/acquire` - 领取租约
- `POST /lease/renew` - 续约保活
- `POST /lease/release` - 释放租约

### 结果提交
- `POST /result/submit` - 提交执行结果

### 诊断与排查
- `GET /timeline/{task_id}` - 获取任务时间线
- `GET /diagnostics/export` - 导出诊断报告（支持 format=text）

## 快速开始

```bash
# 安装依赖
go mod tidy

# 运行服务
go run main.go

# 服务默认运行在 :8080
```

## 使用示例

### 1. 创建任务
```bash
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "data-processing-001",
    "payload": "{\"file\":\"data.csv\"}",
    "priority": 10,
    "lease_timeout": 300,
    "max_retries": 3
  }'
```

### 2. 领取租约
```bash
curl -X POST http://localhost:8080/lease/acquire \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK_ID_FROM_CREATE",
    "holder_id": "worker-01",
    "holder_name": "Data Processor Node 1"
  }'
```

### 3. 续约保活
```bash
curl -X POST http://localhost:8080/lease/renew \
  -H "Content-Type: application/json" \
  -d '{
    "lease_id": "LEASE_ID_FROM_ACQUIRE",
    "holder_id": "worker-01"
  }'
```

### 4. 提交结果
```bash
curl -X POST http://localhost:8080/result/submit \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK_ID",
    "lease_id": "LEASE_ID",
    "holder_id": "worker-01",
    "status": "success",
    "result_data": "{\"records\": 1000, \"status\": \"completed\"}",
    "started_at": "2024-01-01T12:00:00Z"
  }'
```

### 5. 查看时间线
```bash
curl http://localhost:8080/timeline/TASK_ID
```

### 6. 导出诊断报告
```bash
curl http://localhost:8080/diagnostics/export?format=text
```

## 核心规则

### 租约超时抢占：
- 每个任务同一时间只能被一个持有者持有
- 租约过期后其他持有者可以抢占
- 只有租约持有者可以续约或释放

### 重复执行拦截：
- 任务一旦提交结果，无法再次提交会被拦截
- 结果具有幂等性保证

### 状态流转：
- pending → leased → running → completed/failed

## 数据模型

### Task（任务）
- ID, Name, Payload
- Status: pending/leased/running/completed/failed
- Priority, CreatedAt, UpdatedAt
- LeaseTimeout, MaxRetries, RetryCount

### Lease（租约）
- ID, TaskID, HolderID, HolderName
- AcquiredAt, ExpiresAt, RenewCount, IsActive

### ExecutionResult（执行结果）
- TaskID, LeaseID, HolderID
- Status, ResultData, ErrorMessage
- StartedAt, CompletedAt, DurationMs

### ReleaseRecord（释放记录）
- TaskID, LeaseID, HolderID
- ReleasedAt, ReleaseType, Reason, PreemptedBy

### TimelineEvent（时间线事件）
- TaskID, LeaseID, EventType
- HolderID, Message, Details
- CreatedAt
