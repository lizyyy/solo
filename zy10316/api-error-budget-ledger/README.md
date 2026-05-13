# API 错误预算账本

一个用于管理 API 服务错误预算的单体后端服务，支持预算扣减、豁免审批、服务冻结和时间线追踪。

## 项目架构

```
api-error-budget-ledger/
├── cmd/
│   └── server/
│       └── main.go          # 服务入口
├── internal/
│   ├── model/               # 数据模型
│   │   ├── models.go        # 核心数据结构
│   │   └── dto.go           # 请求/响应 DTO
│   ├── storage/             # 存储层
│   │   └── storage.go       # 内存存储实现
│   ├── service/             # 业务逻辑层
│   │   ├── budget_service.go # 预算核心逻辑
│   │   └── export_service.go # 导出服务
│   └── handler/             # HTTP 处理器
│       └── http_handler.go  # REST API 处理
└── examples/
    ├── demo.html            # Web 管理界面
    └── client.go            # Go 客户端示例
```

## 核心概念

### 数据对象

- **服务接口 (Service)**: 受保护的 API 服务
- **错误预算 (ErrorBudget)**: 分配给服务的错误配额
- **请求窗口 (RequestWindow)**: 时间窗口内的统计聚合
- **扣减事件 (DeductEvent)**: 每次 API 错误的扣减记录
- **豁免说明 (Exemption)**: 扣减的豁免申请和审批
- **冻结动作 (FreezeAction)**: 服务的冻结/解冻记录
- **时间线 (Timeline)**: 所有关键操作的审计记录

### 核心规则

1. **预算扣减**: API 错误自动从预算中扣除相应额度
2. **窗口聚合**: 按时间窗口统计请求和错误数据
3. **冻结触发**: 预算耗尽或手动操作时冻结服务
4. **豁免审批**: 误报的错误可以申请豁免补偿
5. **幂等处理**: 重复请求不会造成重复扣减

## API 接口

### 预算管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/budgets | 创建错误预算 |
| GET | /api/v1/budgets/{id} | 查询预算状态 |
| POST | /api/v1/budgets/{id}/deduct | 扣减预算 |
| GET | /api/v1/budgets/{id}/timeline | 获取时间线 |
| GET | /api/v1/budgets/{id}/export | 导出账本 |

### 冻结管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/freezes | 冻结服务 |
| POST | /api/v1/freezes/unfreeze | 解冻服务 |

### 豁免管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/exemptions | 申请豁免 |
| POST | /api/v1/exemptions/review | 审批豁免 |

## 快速开始

### 1. 运行服务

```bash
cd api-error-budget-ledger
go mod tidy
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

### 2. 使用 Web 管理界面

在浏览器中打开 `examples/demo.html` 文件即可使用可视化管理界面。

### 3. 运行命令行演示

```bash
go run examples/client.go
```

## API 使用示例

### 创建预算

```bash
curl -X POST http://localhost:8080/api/v1/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "payment-service",
    "total_budget": 100,
    "window_duration": 3600000000000
  }'
```

响应:
```json
{
  "budget_id": "uuid-xxx",
  "service_id": "payment-service",
  "total_budget": 100,
  "remaining_budget": 100,
  "status": "active",
  "window_id": "uuid-yyy"
}
```

### 扣减预算（模拟 API 错误）

```bash
curl -X POST http://localhost:8080/api/v1/budgets/{budget_id}/deduct \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-12345",
    "source": "api_error",
    "amount": 10,
    "error_message": "500 Internal Server Error"
  }'
```

### 查询预算状态

```bash
curl http://localhost:8080/api/v1/budgets/{budget_id}
```

响应:
```json
{
  "budget_id": "uuid-xxx",
  "service_id": "payment-service",
  "total_budget": 100,
  "remaining_budget": 90,
  "budget_used": 10,
  "usage_percent": 10,
  "status": "active",
  "is_frozen": false,
  "current_window": {
    "window_id": "uuid-yyy",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-01T01:00:00Z",
    "total_calls": 5,
    "error_count": 1,
    "deducted": 10
  }
}
```

### 冻结服务

```bash
curl -X POST http://localhost:8080/api/v1/freezes \
  -H "Content-Type: application/json" \
  -d '{
    "budget_id": "{budget_id}",
    "reason": "manual",
    "description": "紧急维护",
    "frozen_by": "admin"
  }'
```

### 获取时间线

```bash
curl http://localhost:8080/api/v1/budgets/{budget_id}/timeline?limit=20
```

### 导出账本

```bash
curl http://localhost:8080/api/v1/budgets/{budget_id}/export
```

导出数据包含:
- 预算汇总信息
- 所有扣减事件
- 所有豁免记录
- 所有冻结记录
- 所有窗口数据
- 完整时间线

## 核心特性

### 1. 幂等扣减

使用 `request_id` 实现幂等性，同一个请求 ID 重复提交只会扣减一次。

### 2. 自动窗口滚动

当前时间窗口过期后会自动创建新窗口，数据持续统计。

### 3. 审计时间线

所有关键操作都有时间戳记录:
- 预算创建
- 预算扣减
- 豁免申请/审批
- 服务冻结/解冻
- 窗口滚动

### 4. 冻结保护

- 预算耗尽自动冻结
- 支持手动冻结/解冻
- 冻结期间无法扣减预算

### 5. 豁免补偿机制

- 可以为误报的错误申请豁免
- 审批通过后预算会得到补偿
- 补偿记录完整追踪

## 数据导出

导出的账本数据可用于:
- 问题排查和根因分析
- SLA 合规性审计
- 团队绩效分析
- 预算优化决策

## 注意事项

- 当前版本使用内存存储，重启后数据会丢失
- 生产环境建议替换为持久化存储（如 Redis、数据库等）
- 可根据实际需求调整扣减策略和冻结阈值
