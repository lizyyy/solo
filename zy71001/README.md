# 机组人员补偿 API

基于 Go + Gin + SQLite 的航司机组人员补偿申请管理系统，支持补偿申请的提交、两级审批流程、幂等性保障和操作追溯。

## 项目简介

本系统为航空公司提供机组人员（机长、乘务员等）的加班补偿申请和审批管理功能。主要功能包括：

- **基础数据管理**：基地、机组人员、航班段信息管理
- **补偿申请**：支持提交加班补偿申请，自动进行数据校验
- **幂等性保障**：通过 Idempotency-Key 头防止重复提交
- **两级审批流程**：组长审批 → 主管审批 → 最终批准
- **操作追溯**：完整记录申请的所有状态变更历史
- **数据导出**：支持 CSV 格式导出申请数据
- **补偿汇总**：按人员统计补偿时长汇总

## 技术栈

- **后端框架**：Gin Web Framework
- **数据库**：SQLite3
- **编程语言**：Go 1.x
- **数据格式**：JSON

## API 文档

所有 API 前缀：`/api/v1`

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务健康检查 |

**响应示例：**
```json
{
  "status": "ok",
  "time": "2024-01-15T10:30:00Z"
}
```

### 基地管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/bases` | 获取基地列表 |
| POST | `/bases` | 创建新基地 |

**创建基地请求体：**
```json
{
  "name": "北京基地",
  "code": "PEK",
  "city": "北京"
}
```

### 机组人员管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/crew` | 获取机组人员列表 |
| POST | `/crew` | 创建新机组人员 |

**创建机组人员请求体：**
```json
{
  "name": "张三",
  "employee_no": "CA001",
  "base_id": "base-uuid",
  "position": "机长",
  "phone": "13800138000",
  "email": "zhangsan@airline.com"
}
```

### 航班段管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/flight-segments` | 获取航班段列表 |
| POST | `/flight-segments` | 创建新航班段 |

**创建航班段请求体：**
```json
{
  "flight_no": "CA1234",
  "departure_city": "北京",
  "arrival_city": "上海",
  "departure_time": "2024-01-15T08:00:00Z",
  "arrival_time": "2024-01-15T10:30:00Z",
  "actual_departure": "2024-01-15T08:30:00Z",
  "actual_arrival": "2024-01-15T11:00:00Z",
  "delay_minutes": 30,
  "flight_date": "2024-01-15",
  "crew_id": "crew-uuid"
}
```

### 补偿申请管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/applications` | 获取申请列表 |
| POST | `/applications` | 提交补偿申请（幂等） |
| GET | `/applications/:id` | 获取申请详情 |
| GET | `/applications/:id/trace` | 获取申请追溯日志 |
| POST | `/applications/:id/generate-compensation` | 生成补偿记录 |
| POST | `/applications/:id/leader-approve` | 组长审批 |
| POST | `/applications/:id/supervisor-approve` | 主管审批 |
| POST | `/applications/:id/final-approve` | 最终批准 |
| POST | `/applications/:id/reject` | 拒绝申请 |
| GET | `/applications/export/csv` | 导出 CSV |

**提交补偿申请请求体：**
```json
{
  "crew_id": "crew-uuid",
  "flight_no": "CA1234",
  "flight_date": "2024-01-15",
  "departure_city": "北京",
  "departure_time": "2024-01-15T08:00:00Z",
  "arrival_time": "2024-01-15T10:30:00Z",
  "delay_minutes": 30,
  "compensation_type": "overtime",
  "compensation_hours": 2.5,
  "remarks": "航班延误加班"
}
```

**审批请求体：**
```json
{
  "approver_id": "approver-uuid",
  "approver_name": "李主管",
  "reject_reason": ""
}
```

### 补偿记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/compensations` | 获取补偿记录列表 |
| GET | `/compensations/summary` | 获取补偿汇总 |

## 幂等检查说明

### 实现方式

系统通过 HTTP 请求头 `Idempotency-Key` 实现幂等性保障。

### 使用方法

在提交补偿申请时，在请求头中添加 `Idempotency-Key`：

```bash
curl -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: your-unique-key-12345" \
  -d '{...}'
```

### 工作原理

1. **客户端生成唯一键**：客户端为每个请求生成一个唯一的幂等键
2. **服务端校验**：服务端接收请求后，先检查数据库中是否存在该幂等键
3. **重复请求处理**：
   - 如果已存在：直接返回原有申请记录，不创建新申请
   - 如果不存在：创建新申请并记录该幂等键

### 重复响应格式

**首次提交（200 OK）：**
```json
{
  "id": "app-uuid",
  "crew_id": "crew-uuid",
  "flight_no": "CA1234",
  "status": "pending",
  "idempotent": false,
  "message": "Application submitted successfully"
}
```

**重复提交（200 OK）：**
```json
{
  "id": "app-uuid",
  "crew_id": "crew-uuid",
  "flight_no": "CA1234",
  "status": "pending",
  "idempotent": true,
  "message": "Request already processed, returning existing application"
}
```

### 自动幂等键生成

如果客户端未提供 `Idempotency-Key`，系统会自动基于以下字段生成哈希键：
- `crew_id`（机组人员ID）
- `flight_no`（航班号）
- `flight_date`（航班日期）

确保同一人员同一航班的申请自动具有幂等性。

## 两级审批流程说明

### 状态流转图

```
pending（待审批）
    │
    ├─→ leader_approved（组长已批准）
    │       │
    │       ├─→ supervisor_approved（主管已批准）
    │       │       │
    │       │       └─→ approved（最终批准）
    │       │
    │       └─→ rejected（已拒绝）
    │
    └─→ rejected（已拒绝）
```

### 状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| `pending` | 待审批，申请已提交等待组长审批 | 组长审批、拒绝 |
| `leader_approved` | 组长已批准，等待主管审批 | 主管审批、拒绝 |
| `supervisor_approved` | 主管已批准，等待最终批准 | 最终批准、拒绝 |
| `approved` | 已批准，补偿申请生效 | 无 |
| `rejected` | 已拒绝，申请作废 | 无 |

### 审批流程

1. **提交申请**：机组人员提交补偿申请，状态为 `pending`
2. **组长审批**：组长审核申请，通过后状态变为 `leader_approved`
3. **主管审批**：主管审核申请，通过后状态变为 `supervisor_approved`
4. **最终批准**：管理员最终确认，状态变为 `approved`，补偿生效

**任意阶段**都可以拒绝申请，状态变为 `rejected`，流程终止。

### 操作追溯

每个状态变更都会记录到 `processing_logs` 表，包含：
- 操作类型（status_change）
- 变更前后状态
- 操作人ID和姓名
- 操作详情/备注
- 操作IP地址
- 操作时间

通过 `/applications/:id/trace` 接口可以查询完整的审批历史。

## 启动方式

### 环境要求

- Go 1.18+
- SQLite3（已内嵌驱动）

### 编译运行

```bash
# 克隆项目
cd crew-compensation-api

# 下载依赖
go mod download

# 编译
go build -o crew-compensation-api ./cmd/api

# 启动服务
./crew-compensation-api
```

### 直接运行

```bash
go run ./cmd/api/main.go
```

### 服务地址

服务启动后监听在 `http://localhost:8080`

### 数据库

系统使用 SQLite 数据库，首次启动会自动创建：
- 数据库文件：`crew_compensation.db`
- 自动创建所有数据表和索引

## 测试

项目提供 `test_api.sh` 脚本用于快速测试 API 接口：

```bash
# 确保服务已启动
./crew-compensation-api

# 新开终端执行测试
chmod +x test_api.sh
./test_api.sh
```

## 目录结构

```
crew-compensation-api/
├── cmd/
│   └── api/
│       └── main.go           # 程序入口
├── internal/
│   ├── database/
│   │   └── database.go       # 数据库初始化
│   ├── handlers/
│   │   └── handlers.go       # API 处理器
│   ├── models/
│   │   └── models.go         # 数据模型
│   └── services/
│       ├── status_service.go    # 状态流转服务
│       └── validation_service.go # 校验和幂等服务
├── go.mod
├── go.sum
├── README.md
└── test_api.sh              # API 测试脚本
```

## 数据模型

### 核心表结构

- **bases**：基地表
- **crew_members**：机组人员表
- **flight_segments**：航班段表
- **applications**：补偿申请表
- **compensation_summaries**：补偿汇总表
- **processing_logs**：处理日志表

## License

MIT
