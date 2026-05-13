# 租户迁移切换 API

## 项目概述

这是一个标准化的租户数据迁移切换 API 服务，基于 Go 语言实现，提供完整的迁移流程管理、状态机控制、双写校验、流量切换和回滚能力。

## 技术栈

- **Go 1.20+**
- **Gin Web Framework** - HTTP 服务
- **GORM** - ORM 框架
- **SQLite** - 持久化存储
- **Logrus** - 日志框架

## 核心功能

### 1. 迁移状态机

完整的状态流转：
```
CREATED → VALIDATING → VALIDATION_PASSED → DUAL_WRITING → VERIFYING → SWITCHING_READ → COMPLETED
                                                              ↓
                                                         ROLLING_BACK → ROLLED_BACK
```

### 2. 校验项

- 源集群连通性检查
- 目标集群连通性检查
- 表结构一致性检查
- 索引一致性检查
- 数据行数对比
- 数据一致性校验
- 写入性能校验

### 3. 核心能力

- **双写校验**：同时写入源集群和目标集群，验证数据一致性
- **读流量切换**：平滑切换读流量到目标集群
- **回滚控制**：支持按回滚点回滚，每个阶段自动创建回滚点
- **验证报告**：生成详细的校验报告，包含通过率和各项检查结果
- **幂等性保证**：同一租户+相同集群组合只能有一个进行中的任务

## 快速开始

### 1. 启动服务

```bash
# 编译并启动
go run cmd/api/main.go

# 或使用 go run 直接运行
cd cmd/api && go run main.go
```

服务启动后监听 `http://localhost:8080`

### 2. 初始化数据

服务启动时会自动创建示例数据：
- **租户**: `tenant-001` (客户A), `tenant-002` (客户B)
- **源集群**: `cluster-source-01` (源集群-北京)
- **目标集群**: `cluster-target-01` (目标集群-上海)

## API 接口说明

### 基础路径

`http://localhost:8080/api/v1`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/migrations` | 创建迁移任务 |
| POST | `/migrations/validate` | 执行迁移校验 |
| POST | `/migrations/advance` | 推进迁移状态 |
| POST | `/migrations/rollback` | 执行回滚 |
| GET | `/migrations` | 查询迁移任务列表 |
| GET | `/migrations/:id` | 查询任务详情 |
| GET | `/migrations/:id/history` | 查询状态变更历史 |
| GET | `/migrations/:id/report` | 查询验证报告 |

## 使用指南

### 1. 创建迁移任务

**请求**:
```bash
curl -X POST http://localhost:8080/api/v1/migrations \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-001",
    "source_cluster_id": "cluster-source-01",
    "target_cluster_id": "cluster-target-01",
    "operator": "admin"
  }'
```

**响应**:
```json
{
  "task_id": "task-xxx",
  "status": "CREATED",
  "current_phase": "CREATED"
}
```

### 2. 执行迁移校验

**请求**:
```bash
curl -X POST http://localhost:8080/api/v1/migrations/validate \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-xxx",
    "operator": "admin"
  }'
```

**响应**包含 7 项检查结果，总检查数、通过数、失败数。

### 3. 推进迁移状态

**请求**:
```bash
curl -X POST http://localhost:8080/api/v1/migrations/advance \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-xxx",
    "target_phase": "DUAL_WRITING",
    "operator": "admin",
    "remark": "开始双写阶段"
  }'
```

**可用的目标阶段**:
- `VALIDATION_PASSED` - 校验通过
- `DUAL_WRITING` - 双写阶段
- `VERIFYING` - 双写数据验证
- `SWITCHING_READ` - 切换读流量
- `COMPLETED` - 完成

### 4. 执行回滚

**请求**:
```bash
curl -X POST http://localhost:8080/api/v1/migrations/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-xxx",
    "rollback_point_id": "rb-xxx",
    "operator": "admin",
    "reason": "发现数据不一致"
  }'
```

## 如何测试

### 运行完整迁移流程

```bash
./scripts/test_api.sh
```

### 测试回滚功能

```bash
./scripts/test_rollback.sh
```

### 测试幂等性和异常场景

```bash
./scripts/test_idempotency.sh
```

## 异常场景说明

### 1. 重复创建任务（幂等性验证）

**触发方式**：对同一租户 + 相同源/目标集群重复调用创建接口

**预期结果**: 返回 `DUPLICATE_TASK` 错误码

```json
{
  "code": "DUPLICATE_TASK",
  "message": "该租户已有进行中的迁移任务"
}
```

### 2. 非法状态转换

**触发方式**：跳过校验直接推进到双写阶段

**示例**: 从 `CREATED` 状态直接推进到 `DUAL_WRITING`

**预期结果**: 返回 `STATUS_TRANSITION_ERROR` 错误码，提示允许的目标状态

### 3. 任务不存在

**触发方式**：查询或操作一个不存在的任务 ID

**预期结果**: 返回 `TASK_NOT_FOUND` 错误码

### 4. 租户/集群不存在

**触发方式**：使用不存在的 tenant_id 或 cluster_id 创建任务

**预期结果**: 返回 `TENANT_NOT_FOUND` 或 `CLUSTER_NOT_FOUND`

## 查看处理记录

### 1. 查看任务详情

```bash
curl http://localhost:8080/api/v1/migrations/{task_id}
```

返回内容包含：
- 基本任务信息（状态、阶段、租户、集群）
- 校验项列表（每项的状态、预期值、实际值）
- 回滚点列表
- 状态变更历史

### 2. 查看状态变更历史

```bash
curl http://localhost:8080/api/v1/migrations/{task_id}/history
```

每条历史记录包含：
- `from_status` - 原状态
- `to_status` - 新状态
- `operator` - 操作人
- `remark` - 备注
- `created_at` - 操作时间

### 3. 查看验证报告

```bash
curl http://localhost:8080/api/v1/migrations/{task_id}/report
```

报告内容：
- 总检查数
- 通过数
- 失败数
- 通过率百分比
- 详细检查内容

### 4. 查看任务列表

```bash
# 查看所有任务
curl http://localhost:8080/api/v1/migrations

# 按租户筛选
curl "http://localhost:8080/api/v1/migrations?tenant_id=tenant-001"

# 按状态筛选
curl "http://localhost:8080/api/v1/migrations?status=COMPLETED"
```

## 数据模型说明

### 核心数据对象

**MigrationTask（迁移任务）**:
- 租户、源集群、目标集群关联
- 当前状态和阶段
- 重试计数
- 创建/更新/完成时间

**CheckItem（校验项）**:
- 关联迁移任务
- 检查类型（连通性、schema、数据、性能）
- 状态（待执行、运行中、通过、失败）
- 预期值 vs 实际值

**RollbackPoint（回滚点）**:
- 每个阶段自动创建
- 保存快照数据
- 用于精准回滚

**MigrationHistory（状态变更历史）**:
- 记录每次状态流转
- 操作人和备注
- 审计追踪

**ValidationReport（验证报告）**:
- 汇总校验结果
- 计算通过率
- 结构化报告内容

**DualWriteRecord（双写记录）**:
- 记录双写操作
- 源和目标写入结果
- 一致性标记

## 项目结构

```
tenant-migration-api/
├── cmd/
│   └── api/
│       └── main.go              # 程序入口
├── internal/
│   ├── models/
│   │   ├── models.go            # 数据模型
│   │   ├── dto.go               # 请求/响应 DTO
│   │   └── errors.go            # 错误定义
│   ├── service/
│   │   ├── statemachine.go      # 状态机实现
│   │   └── migration_service.go # 业务逻辑
│   ├── repository/
│   │   ├── database.go          # 数据库初始化
│   │   └── migration_repo.go    # 数据访问层
│   └── handler/
│       └── migration_handler.go # API 处理器
├── pkg/
│   ├── logger/
│   │   └── logger.go            # 日志工具
│   ├── utils/
│   │   └── id.go                # ID 生成器
│   └── middleware/
│       └── cors.go              # CORS 中间件
├── scripts/
│   ├── test_api.sh              # 完整流程测试
│   ├── test_rollback.sh         # 回滚测试
│   └── test_idempotency.sh      # 幂等性测试
├── go.mod
├── go.sum
└── README.md
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `INVALID_REQUEST` | 请求参数错误 |
| `TASK_NOT_FOUND` | 任务不存在 |
| `TENANT_NOT_FOUND` | 租户不存在 |
| `CLUSTER_NOT_FOUND` | 集群不存在 |
| `STATUS_TRANSITION_ERROR` | 状态转换不合法 |
| `VALIDATION_FAILED` | 校验失败 |
| `DUAL_WRITE_FAILED` | 双写失败 |
| `ROLLBACK_FAILED` | 回滚失败 |
| `DUPLICATE_TASK` | 重复任务（幂等性） |
| `TASK_IN_PROGRESS` | 任务进行中 |
| `INTERNAL_ERROR` | 内部错误 |

## 注意事项

1. **数据库文件**: SQLite 数据库文件 `tenant_migration.db` 会在程序启动时自动创建
2. **示例数据**: 首次启动会自动创建示例租户和集群数据
3. **幂等性**: 同一租户在相同源/目标集群之间只能有一个进行中的迁移任务
4. **状态机**: 必须按照状态机定义的顺序推进，不能跳过阶段
5. **回滚点**: 每个阶段转换时会自动创建回滚点，可用于后续回滚
