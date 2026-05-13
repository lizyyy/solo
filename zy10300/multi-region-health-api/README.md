# 多区域服务健康聚合 API

一个基于 Go 实现的多区域服务健康状态管理系统，支持探针归一、依赖聚合、降级状态机、恢复确认和健康摘要功能。

## 技术栈

- **框架**: Gin (HTTP Web Framework)
- **ORM**: GORM
- **数据库**: SQLite (本地持久化)
- **UUID**: Google UUID

## 项目结构

```
multi-region-health-api/
├── models/          # 数据模型定义
│   └── models.go
├── handlers/        # HTTP 处理器
│   └── handlers.go
├── services/        # 业务逻辑层
│   └── health_service.go
├── db/             # 数据库初始化
│   └── database.go
├── main.go         # 程序入口
├── go.mod
├── go.sum
├── test_data.sh    # 测试数据脚本
└── README.md
```

## 数据模型

### 核心实体

1. **Region (区域)**: 数据中心区域信息
2. **Service (服务)**: 微服务实例，关联区域
3. **ProbeResult (探针结果)**: 服务健康检测结果
4. **Dependency (依赖关系)**: 服务间依赖
5. **DegradeAction (降级动作)**: 降级状态变更记录
6. **RecoveryRecord (恢复记录)**: 人工恢复确认记录

### 状态定义

**健康状态 (HealthStatus)**:
- `healthy`: 健康
- `degraded`: 降级
- `unhealthy`: 不健康
- `unknown`: 未知

**降级状态 (DegradeStatus)**:
- `normal`: 正常
- `warning`: 警告
- `degrading`: 降级中
- `degraded`: 已降级
- `recovering`: 恢复中

## 启动方式

### 1. 安装依赖

```bash
cd multi-region-health-api
go mod tidy
```

### 2. 启动服务

```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 运行测试数据

```bash
# 确保服务已启动
./test_data.sh
```

## 关键接口

### 基础健康检查

```bash
GET /health
```

### 区域管理

```bash
# 创建区域
POST /api/v1/regions
{
  "name": "北京区域",
  "code": "bj",
  "description": "北京主数据中心"
}

# 查询所有区域
GET /api/v1/regions

# 区域健康摘要
GET /api/v1/regions/:region_id/summary
```

### 服务管理

```bash
# 创建服务
POST /api/v1/services
{
  "region_id": "xxx",
  "name": "用户服务",
  "code": "user-service",
  "description": "用户认证与管理"
}

# 查询服务列表
GET /api/v1/services?region_id=xxx

# 查询单个服务
GET /api/v1/services/:service_id
```

### 健康探针

```bash
# 提交探针结果
POST /api/v1/services/:service_id/probes
{
  "request_id": "req-001",      # 用于幂等性
  "probe_type": "http",
  "raw_status": "200",            # 会被归一化
  "metrics": "latency:12ms",
  "error_msg": ""
}

# 探针历史
GET /api/v1/services/:service_id/probes/history?limit=20
```

### 降级状态机

```bash
# 推进降级状态
POST /api/v1/services/:service_id/degrade/transition
{
  "request_id": "degrade-001",    # 用于幂等性
  "reason": "service unhealthy",
  "triggered_by": "health_monitor"
}

# 降级历史
GET /api/v1/services/:service_id/degrade/history?limit=20
```

### 恢复确认

```bash
# 人工确认恢复
POST /api/v1/services/:service_id/recovery/confirm
{
  "request_id": "recovery-001",   # 用于幂等性
  "degrade_action_id": "xxx",
  "confirmed_by": "ops-admin",
  "confirm_type": "manual",
  "description": "人工确认服务已恢复",
  "is_success": true
}
```

### 依赖管理

```bash
# 创建服务依赖
POST /api/v1/services/:service_id/dependencies
{
  "dependent_service_id": "xxx",
  "dependency_type": "required",
  "is_critical": true
}

# 查询服务依赖
GET /api/v1/services/:service_id/dependencies
```

## 核心业务规则

### 1. 探针归一化

系统会将不同探针的原始状态归一化为标准健康状态：

| 原始状态示例 | 归一化状态 |
|------------|----------|
| 200, ok, success | healthy |
| degraded, warning, slow, partial | degraded |
| 500, 502, 503, error, timeout, failed | unhealthy |
| 其他 | unknown |

### 2. 依赖聚合

服务健康状态会考虑其依赖服务的状态：
- 任何关键依赖不健康 → 本服务受影响
- 支持递归检查依赖链
- 可区分关键/非关键依赖

### 3. 降级状态机

状态流转规则：
```
normal → warning → degrading → degraded → recovering → normal
```

触发条件：
- 服务自身或依赖降级 → warning
- 服务自身或依赖不健康 → degrading
- 持续不健康 → degraded
- 服务恢复健康 → recovering
- 人工确认恢复 → normal

### 4. 幂等性保证

所有写操作都通过 `request_id` 保证幂等性：
- 重复提交相同 `request_id` 不会创建重复记录
- 返回已存在的记录而非报错
- 防止网络重试安全

### 5. 健康摘要

按区域聚合健康统计：
- 各状态服务数量
- 区域整体健康状态
- 支持实时计算

## 会被拦截的路径示例

### 1. 无效状态转换拦截

```bash
# 服务在 normal 状态直接尝试恢复确认（会被拦截）
POST /api/v1/services/:service_id/recovery/confirm
```
**错误**: `{"error": "service not in recovering state"}`

### 2. 自依赖拦截

```bash
# 尝试让服务依赖自己（会被拦截）
POST /api/v1/services/:service_id/dependencies
{
  "dependent_service_id": ":service_id",  # 与 service_id 相同
  ...
}
```
**错误**: `{"error": "cannot depend on self"}`

### 3. 不存在的服务拦截

```bash
# 给不存在的服务提交探针（会被拦截）
POST /api/v1/services/nonexistent-id/probes
```
**错误**: `{"error": "service not found"}`

### 4. 不存在的区域拦截

```bash
# 查询不存在区域的摘要（会被拦截）
GET /api/v1/regions/nonexistent-id/summary
```
**错误**: `{"error": "region not found"}`

### 5. 无状态变更拦截

```bash
# 在 normal 状态下服务健康时尝试降级（会被拦截）
POST /api/v1/services/:service_id/degrade/transition
```
**错误**: `{"error": "no degrade condition met"}`

## API 响应码说明

| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 / 业务规则不满足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 数据库文件

SQLite 数据库文件为 `health_api.db`，位于项目根目录，包含所有表结构和数据。

## 注意事项

1. 所有写操作都需要 `request_id` 保证幂等性
2. 降级状态转换必须按状态机规则进行
3. 恢复确认只能在 `recovering` 状态下进行
4. 服务不能依赖自己
5. 探针结果会自动更新服务健康状态
