# 数据契约例外 API

一个用于管理数据契约例外规则的后端服务，解决上下游临时允许字段为空，但例外到期后容易忘记恢复严格校验的问题。

## 技术栈

- Go 1.x
- Gin Web Framework
- GORM ORM
- SQLite (本地持久化)

## 核心功能

### 数据模型

- **DataContract**: 数据契约定义
- **ExceptionRecord**: 例外记录（核心模型，包含状态、字段路径、到期时间等）
- **HitRecord**: 命中记录（记录例外被触发的次数和详情）
- **RecoveryReport**: 恢复报告（恢复审批和导出）
- **AnomalyRecord**: 异常记录（保存原始输入和处理结论）

### 状态流转

```
PENDING (待审批) → ACTIVE (生效中) → EXPIRED (已到期)
     ↓                    ↓                    ↓
REJECTED (已拒绝)    RECOVERY_REQUESTED (申请恢复)
                          ↓
                    RECOVERY_APPROVED (恢复已批准)
                          ↓
                    RECOVERED (已恢复)
```

### 核心规则

1. **字段路径匹配**: 精确匹配 `user.profile.email` 格式的字段路径
2. **例外到期检查**: 自动检查并标记已过期的例外
3. **命中统计**: 记录每次例外触发的详情和累计次数
4. **恢复审批流程**: 申请 → 审批 → 完成恢复
5. **幂等性保证**: 重复提交状态推进操作不会产生副作用

## API 接口

### 例外管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/exceptions` | 创建例外 |
| GET | `/api/v1/exceptions` | 查询所有例外 |
| GET | `/api/v1/exceptions/:id` | 查询单个例外 |
| POST | `/api/v1/exceptions/:id/approve` | 审批例外 (PENDING→ACTIVE) |
| POST | `/api/v1/exceptions/:id/reject` | 拒绝例外 (PENDING→REJECTED) |
| POST | `/api/v1/exceptions/:id/hit` | 记录命中 |
| POST | `/api/v1/exceptions/:id/request-recovery` | 申请恢复 |
| POST | `/api/v1/exceptions/:id/approve-recovery` | 审批恢复 |
| POST | `/api/v1/exceptions/:id/complete-recovery` | 完成恢复 |
| POST | `/api/v1/exceptions/:id/manual-correction` | 人工修正状态 |
| GET | `/api/v1/exceptions/:id/hits` | 查询命中记录 |
| GET | `/api/v1/exceptions/:id/export-report` | 导出恢复报告 |

### 异常管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/anomalies` | 查询所有异常记录 |
| POST | `/api/v1/anomalies/:id/resolve` | 标记异常为已解决 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reports/export-all` | 导出所有恢复报告 (CSV) |

### 工具接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/sample-data` | 创建样例数据 |
| POST | `/api/v1/check-expired` | 检查并标记过期例外 |

## 快速开始

### 安装依赖

```bash
go mod tidy
```

### 启动服务

```bash
go run cmd/main.go
```

服务将在 `http://localhost:8080` 启动

### 运行测试

```bash
cd examples
chmod +x test.sh
./test.sh
```

## 使用示例

### 1. 创建例外

```bash
curl -X POST http://localhost:8080/api/v1/exceptions \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": "contract-123",
    "field_path": "user.profile.email",
    "exception_reason": "临时允许历史遗留空邮箱数据",
    "created_by": "admin@example.com",
    "expire_date": "2024-12-31T23:59:59Z"
  }'
```

### 2. 审批例外

```bash
curl -X POST http://localhost:8080/api/v1/exceptions/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "manager@example.com"}'
```

### 3. 记录命中

```bash
curl -X POST http://localhost:8080/api/v1/exceptions/{id}/hit \
  -H "Content-Type: application/json" \
  -d '{
    "field_path": "user.profile.email",
    "actual_value": "",
    "expected_value": "valid_email",
    "source_system": "user-service",
    "request_id": "req-001"
  }'
```

### 4. 验证幂等性

重复调用审批接口，第二次会返回冲突错误，确保状态不会被错误推进：

```bash
# 第一次成功
curl -X POST http://localhost:8080/api/v1/exceptions/{id}/approve ...

# 第二次返回 409 Conflict
curl -X POST http://localhost:8080/api/v1/exceptions/{id}/approve ...
```

### 5. 导出报告

```bash
curl -o report.csv http://localhost:8080/api/v1/exceptions/{id}/export-report
```

## 项目结构

```
data-contract-exception-api/
├── cmd/
│   └── main.go           # 程序入口
├── models/
│   └── models.go         # 数据模型和请求/响应结构
├── store/
│   └── store.go          # 数据访问层 (SQLite/GORM)
├── service/
│   └── service.go        # 业务逻辑层 (状态机、核心规则)
├── handler/
│   └── handler.go        # HTTP 处理器 (Gin)
├── examples/
│   └── test.sh           # 测试脚本
├── go.mod
├── go.sum
└── README.md
```

## 验收要点

1. **正常流程**: 创建 → 审批 → 记录命中 → 申请恢复 → 审批恢复 → 完成恢复
2. **幂等性验证**: 重复提交同一动作，状态不会被推进两次，返回适当的错误
3. **异常记录**: 所有异常路径都会保存原始输入和处理结论，可通过 `/api/v1/anomalies` 查询
4. **报告导出**: 导出的 CSV 报告包含完整的例外信息和命中明细，可追溯
