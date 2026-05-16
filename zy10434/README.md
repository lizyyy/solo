# Export Quota API - 异步导出配额管理系统

## 概述

这是一个服务端异步导出配额管理API系统，用于解决大文件导出任务拖慢后台的问题。系统按租户维度进行配额限制，提供完整的任务生命周期管理、拒绝原因追踪和用量报告导出功能。

## 技术栈

- **Go 1.21+** - 后端语言
- **Gin Web Framework** - HTTP框架
- **SQLite3** - 本地持久化存储
- **UUID** - 唯一标识符生成

## 核心特性

### 数据模型

1. **Tenant (租户)** - 租户隔离和配额配置
   - 最大并发任务数 (max_concurrent)
   - 每日最大导出总大小 (max_daily_size)
   - 最大排队任务数 (max_queue_size)

2. **ExportTask (导出任务)** - 任务完整生命周期
   - 状态流转：pending → queued → running → completed/failed/rejected
   - 原始请求存储 (raw_request)
   - 处理日志 (processing_log)
   - 下载链接 (download_url)

3. **QuotaWindow (配额窗口)** - 配额消耗追踪
   - 每日重置机制
   - 已用大小/已用计数
   - 支持人工调整

4. **TaskHistory (任务历史)** - 完整状态变更审计
   - 每次状态变更记录
   - 操作人信息
   - 变更原因

### 核心规则

1. **配额扣减** - 任务开始执行时扣减配额
2. **窗口重置** - 每日配额窗口自动重置
3. **任务排队** - 并发满时任务进入队列，按优先级排序
4. **拒绝归因** - 任务被拒绝时记录详细原因
5. **用量导出** - 支持CSV格式导出任务数据

### 拒绝原因

- `quota_exceeded` - 配额超出
- `concurrent_limit` - 并发限制
- `queue_full` - 队列已满
- `file_too_large` - 文件过大
- `tenant_disabled` - 租户禁用
- `invalid_request` - 请求无效

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## API 接口文档

### 健康检查
```
GET /api/v1/health
```

### 初始化样例数据
```
POST /api/v1/seed
```

### 租户管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/tenants | 创建租户 |
| GET | /api/v1/tenants | 获取所有租户 |
| GET | /api/v1/tenants/:id | 获取租户详情 |
| PUT | /api/v1/tenants/:id | 更新租户配置 |
| GET | /api/v1/tenants/:tenant_id/status | 获取租户配额状态 |
| POST | /api/v1/tenants/:tenant_id/adjust-quota | 人工调整配额 |

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/tasks | 创建导出任务 |
| GET | /api/v1/tasks/:id | 获取任务详情(含历史) |
| GET | /api/v1/tenants/:tenant_id/tasks | 获取租户任务列表 |
| POST | /api/v1/tasks/:id/complete | 标记任务完成 |
| POST | /api/v1/tasks/:id/fail | 标记任务失败 |
| POST | /api/v1/tasks/:id/retry | 人工重试任务 |
| POST | /api/v1/tenants/:tenant_id/process-tasks | 处理下一批排队任务 |
| GET | /api/v1/tenants/:tenant_id/export-csv | 导出任务CSV报告 |

### 请求示例

#### 创建租户
```bash
curl -X POST http://localhost:8080/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tenant",
    "max_concurrent": 3,
    "max_daily_size": 1073741824,
    "max_queue_size": 10
  }'
```

#### 创建导出任务
```bash
curl -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-uuid-here",
    "file_name": "export.csv",
    "file_size": 10485760,
    "file_type": "csv",
    "priority": 1
  }'
```

#### 获取租户配额状态
```bash
curl http://localhost:8080/api/v1/tenants/{tenant_id}/status
```

响应示例:
```json
{
  "quota_window": {
    "id": "...",
    "tenant_id": "...",
    "window_type": "daily",
    "window_start": "2024-01-01T00:00:00Z",
    "window_end": "2024-01-02T00:00:00Z",
    "used_size": 52428800,
    "used_count": 3,
    "max_size": 536870912,
    "max_count": 100
  },
  "tasks": {
    "completed": 2,
    "failed": 0,
    "queued": 2,
    "rejected": 1,
    "running": 2
  },
  "tenant": {
    "id": "...",
    "max_concurrent": 2,
    "max_daily_size": 536870912,
    "max_queue_size": 5,
    "name": "Demo Tenant"
  }
}
```

## 状态机边界

### 允许的状态转换

```
pending → queued → running → completed
                          → failed
        → rejected
queued → running → completed
                → failed
                → queued (retry)
running → completed
        → failed
failed → queued (retry)
rejected → queued (retry)
```

### 关键边界检查

1. **任务创建时**
   - 检查租户是否存在
   - 检查单个文件大小限制
   - 检查队列是否已满
   - 检查每日配额是否足够

2. **任务启动时**
   - 检查并发数限制
   - 再次确认配额
   - 扣减配额

3. **任务完成/失败时**
   - 记录完成时间
   - 记录下载链接（成功时）
   - 记录失败原因（失败时）

## 错误处理

所有异常路径都会保留:
- 原始请求内容 (raw_request)
- 处理日志 (processing_log)
- 状态变更历史 (task_history)
- 拒绝详情 (reject_detail)

## 项目结构

```
export-quota-api/
├── main.go                  # 程序入口
├── go.mod                   # 依赖管理
├── models/
│   └── models.go           # 数据模型定义
├── storage/
│   └── sqlite.go           # SQLite持久化层
├── service/
│   └── quota_manager.go    # 配额管理核心逻辑
├── api/
│   ├── handlers.go         # API处理器
│   └── router.go           # 路由定义
├── test_api.sh             # API测试脚本
└── README.md               # 项目文档
```

## 数据库表

- **tenants** - 租户配置表
- **export_tasks** - 导出任务表
- **quota_windows** - 配额窗口表
- **task_history** - 任务历史表
- **usage_reports** - 用量报告表

## 使用场景

1. **正常流程** - 创建任务 → 自动排队 → 异步执行 → 完成/失败
2. **配额超限** - 创建任务时检测到配额不足，立即拒绝并记录原因
3. **并发满** - 任务进入队列等待
4. **队列满** - 直接拒绝任务
5. **文件过大** - 超过单文件大小限制
6. **人工介入** - 调整配额、重试任务

## 注意事项

1. 配额窗口基于自然日重置（当地时区）
2. 任务优先级越高，越先被执行
3. 原始请求会被完整保存，便于故障排查
4. 所有状态变更都有审计日志
5. 支持跨域请求，便于前端集成
