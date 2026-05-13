# 接口读写分流 API (Read-Write Split API)

一个基于 Go 开发的 API 读写分流服务，用于根据策略自动将请求路由到不同的数据库角色，支持误命中纠偏和分流报告。

## 功能特性

- ✅ **策略管理**：创建、查询、启用/禁用分流策略
- ✅ **智能匹配**：基于路径、方法、查询参数进行策略匹配
- ✅ **读写分流**：自动识别读/写操作，分配对应数据库角色
- ✅ **请求去重**：相同 RequestID 不会重复处理，避免脏数据
- ✅ **命中记录**：完整记录每次请求的匹配结果和处理状态
- ✅ **人工纠偏**：支持对误命中记录进行人工修正
- ✅ **状态推进**：支持记录状态流转（pending → correct/incorrect → revoked）
- ✅ **数据导出**：支持 CSV 格式导出命中记录
- ✅ **统计报告**：生成分流准确率和策略效果分析报告

## 技术栈

- **语言**: Go 1.21+
- **Web 框架**: Gin
- **数据库**: SQLite
- **依赖管理**: Go Modules

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run cmd/server/main.go
```

或指定参数：

```bash
go run cmd/server/main.go -port 8080 -db split_api.db
```

服务默认在 `http://localhost:8080` 启动。

### 3. 运行演示数据（可选）

在另一个终端运行：

```bash
go run scripts/demo_data.go
```

这将自动创建演示策略、模拟各类请求，并生成测试报告。

## 核心 API 接口

### 健康检查

```bash
GET /health
```

### 策略管理

#### 创建策略

```bash
POST /api/v1/strategies
Content-Type: application/json

{
  "path": "/api/v1/orders",
  "method": "POST",
  "query_params": {"action": "create"},
  "operation_type": "write",
  "db_role": "writer",
  "description": "Order creation - write operation",
  "priority": 20
}
```

#### 查询所有策略

```bash
GET /api/v1/strategies
```

#### 查询单个策略

```bash
GET /api/v1/strategies/:id
```

#### 更新策略状态

```bash
PUT /api/v1/strategies/:id/status
Content-Type: application/json

{
  "status": "disabled"
}
```

### 请求处理

#### 处理请求（核心分流接口）

```bash
POST /api/v1/process
Content-Type: application/json

{
  "path": "/api/v1/orders",
  "method": "POST",
  "query_params": {"action": "create"},
  "request_id": "req_123456"  // 可选，用于去重
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "request_id": "req_123456",
    "hit_record_id": "abc123",
    "matched": true,
    "strategy_id": "strat_001",
    "operation_type": "write",
    "db_role": "writer",
    "status": "pending",
    "need_correction": false,
    "message": ""
  }
}
```

### 命中记录管理

#### 查询命中记录（分页）

```bash
GET /api/v1/records?page=1&page_size=20&status=pending&path=/orders
```

查询参数：
- `page`: 页码（默认 1）
- `page_size`: 每页大小（默认 20）
- `strategy_id`: 策略 ID 过滤
- `status`: 状态过滤（pending/correct/incorrect/revoked）
- `path`: 路径模糊匹配
- `start_time` / `end_time`: 时间范围过滤

#### 查询单个命中记录

```bash
GET /api/v1/records/:id
```

#### 推进记录状态

```bash
PUT /api/v1/records/:id/status
Content-Type: application/json
X-User-ID: admin_001

{
  "status": "correct",
  "user_id": "admin_001",
  "note": "Verified correct routing"
}
```

#### 应用纠偏动作

```bash
PUT /api/v1/records/:id/correction
Content-Type: application/json
X-User-ID: admin_001

{
  "action": "adjust",
  "note": "Should have used reader for validation first",
  "user_id": "admin_001"
}
```

纠偏动作类型：
- `none`: 无需纠正（标记为正确）
- `adjust`: 策略调整
- `block`: 拦截/阻断
- `manual`: 人工处理

#### 撤销记录

```bash
DELETE /api/v1/records/:id
X-User-ID: admin_001
```

### 报告与导出

#### 获取分流报告

```bash
GET /api/v1/report?start_time=2024-01-01T00:00:00Z&end_time=2024-01-31T23:59:59Z
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_hits": 100,
    "correct_hits": 85,
    "incorrect_hits": 10,
    "pending_hits": 5,
    "revoked_hits": 0,
    "accuracy_rate": 85.0,
    "strategy_breakdown": {
      "strat_001": 50,
      "strat_002": 35
    },
    "operation_breakdown": {
      "read": 60,
      "write": 40
    },
    "time_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    }
  }
}
```

#### 导出命中记录（CSV）

```bash
GET /api/v1/report/export
```

## 被拦截的关键路径

**路径**: `/api/v1/orders` (POST 方法，携带 `action=create` 参数)

该路径会被策略匹配，自动路由到 `writer` 数据库角色进行写操作。

测试命令：

```bash
curl -X POST http://localhost:8080/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/orders",
    "method": "POST",
    "query_params": {"action": "create"}
  }'
```

## 数据模型

### Strategy（策略）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 策略唯一标识 |
| path | string | 请求路径 |
| method | string | HTTP 方法 |
| query_params | map | 查询参数匹配条件 |
| operation_type | string | 操作类型（read/write） |
| db_role | string | 分配的数据库角色 |
| description | string | 描述 |
| status | string | 状态（enabled/disabled） |
| priority | int | 优先级（数值越大越优先） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### HitRecord（命中记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录唯一标识 |
| request_id | string | 请求 ID（唯一） |
| strategy_id | string | 匹配的策略 ID |
| path | string | 请求路径 |
| method | string | HTTP 方法 |
| query_params | map | 实际查询参数 |
| matched_operation | string | 匹配的操作类型 |
| actual_operation | string | 实际操作类型 |
| db_role_used | string | 使用的数据库角色 |
| status | string | 状态（pending/correct/incorrect/revoked） |
| correction_action | string | 纠偏动作 |
| correction_note | string | 纠偏备注 |
| corrected_by | string | 纠偏人 |
| corrected_at | datetime | 纠偏时间 |
| created_at | datetime | 创建时间 |

## 状态流转

```
pending (待审核)
    ├─→ correct (审核正确)
    ├─→ incorrect (审核错误)
    └─→ revoked (已撤销)

incorrect (已错误)
    └─→ revoked (已撤销)

correct (已正确)
    └─→ revoked (已撤销)
```

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 主程序入口
├── internal/
│   ├── model/
│   │   └── model.go         # 数据模型定义
│   ├── storage/
│   │   └── sqlite.go        # SQLite 存储层
│   ├── service/
│   │   └── service.go       # 业务逻辑层
│   ├── handler/
│   │   └── handler.go       # HTTP 处理器
│   └── middleware/
│       └── middleware.go    # Gin 中间件
├── pkg/
│   └── utils/
│       └── utils.go         # 工具函数
├── scripts/
│   └── demo_data.go         # 演示数据生成脚本
├── docs/                     # 文档目录
├── go.mod                    # Go 模块定义
├── go.sum                    # 依赖版本锁定
└── README.md                 # 项目说明文档
```

## 配置说明

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-port` | 8080 | 服务监听端口 |
| `-db` | split_api.db | SQLite 数据库文件路径 |

## 常见问题

### Q: 如何添加新的分流策略？

A: 通过 `POST /api/v1/strategies` 接口创建策略，指定路径、方法、参数匹配条件和对应的操作类型、数据库角色。

### Q: 重复提交请求会怎样？

A: 系统会根据 `request_id` 进行去重，相同的 `request_id` 只会处理一次，后续请求会直接返回已有结果。

### Q: 策略匹配的优先级是怎样的？

A: 策略按 `priority` 字段排序（数值越大越优先），先匹配高优先级策略。匹配条件包括：路径前缀、HTTP 方法、查询参数包含关系。

### Q: 如何导出命中记录进行分析？

A: 访问 `GET /api/v1/report/export` 接口，会返回 CSV 格式的文件，包含所有命中记录。

## 许可证

MIT License
