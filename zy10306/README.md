# 请求采样规则 API

## 项目简介

这是一个基于 Go 实现的请求采样规则管理系统，提供完整的规则创建、校验、状态管理和历史记录功能。

## 核心功能

- **规则下发**: 创建采样规则，定义路径模式、租户标签、采样率、时间窗口和最大命中数
- **窗口控制**: 自动检查时间窗口有效性，过期规则自动处理
- **租户过滤**: 支持按租户标签进行权限控制
- **命中计数**: 实时统计采样命中次数
- **到期回收**: 自动回收过期规则，支持自动恢复
- **去重机制**: 防止重复提交制造脏数据

## 快速开始

### 安装依赖

```bash
go mod tidy
```

### 启动服务

```bash
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

## API 接口

### 1. 创建规则

**POST** `/api/v1/rules`

请求体:
```json
{
  "request_id": "req_001",
  "rule_name": "测试规则",
  "path_pattern": "/api/test",
  "tenant_tags": ["tenant_a", "tenant_b"],
  "sample_rate": 0.5,
  "window_start": "2024-01-01T00:00:00Z",
  "window_end": "2025-12-31T23:59:59Z",
  "max_hits": 100,
  "auto_recover": true,
  "operator": "admin"
}
```

### 2. 激活规则

**POST** `/api/v1/rules/:id/activate`

请求体:
```json
{
  "operator": "admin"
}
```

### 3. 校验规则（采样判断）

**POST** `/api/v1/rules/validate`

请求体:
```json
{
  "rule_id": 1,
  "request_id": "request_123",
  "tenant_tag": "tenant_a",
  "path": "/api/test/endpoint"
}
```

### 4. 更新规则状态

**POST** `/api/v1/rules/status`

请求体:
```json
{
  "rule_id": 1,
  "new_status": "paused",
  "operator": "admin",
  "description": "暂停规则"
}
```

### 5. 查询所有规则

**GET** `/api/v1/rules`

### 6. 查询单个规则

**GET** `/api/v1/rules/:id`

### 7. 查询命中记录

**GET** `/api/v1/rules/:id/hits`

### 8. 查询历史记录

**GET** `/api/v1/rules/:id/history`

## 如何造数据

### 创建规则示例

```bash
curl -X POST http://localhost:8080/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test_rule_001",
    "rule_name": "API测试规则",
    "path_pattern": "/api/v1",
    "tenant_tags": ["tenant_1", "tenant_2"],
    "sample_rate": 0.8,
    "window_start": "2024-01-01T00:00:00Z",
    "window_end": "2025-12-31T23:59:59Z",
    "max_hits": 1000,
    "auto_recover": true,
    "operator": "test_user"
  }'
```

### 激活规则

```bash
curl -X POST http://localhost:8080/api/v1/rules/1/activate \
  -H "Content-Type: application/json" \
  -d '{"operator": "test_user"}'
```

### 批量采样测试

```bash
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/v1/rules/validate \
    -H "Content-Type: application/json" \
    -d "{
      \"rule_id\": 1,
      \"request_id\": \"req_$i\",
      \"tenant_tag\": \"tenant_1\",
      \"path\": \"/api/v1/test\"
    }"
  echo ""
done
```

## 如何触发异常

### 1. 重复提交（触发去重）

使用相同的 `request_id` 重复创建规则：

```bash
curl -X POST http://localhost:8080/api/v1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test_rule_001",
    "rule_name": "重复规则",
    "path_pattern": "/api/test",
    "tenant_tags": ["tenant_a"],
    "sample_rate": 0.5,
    "window_start": "2024-01-01T00:00:00Z",
    "window_end": "2025-12-31T23:59:59Z",
    "max_hits": 100,
    "auto_recover": false,
    "operator": "test_user"
  }'
```

### 2. 租户不允许

使用未授权的租户标签：

```bash
curl -X POST http://localhost:8080/api/v1/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "request_id": "test_tenant",
    "tenant_tag": "unauthorized_tenant",
    "path": "/api/v1/test"
  }'
```

### 3. 路径不匹配

使用不匹配的路径：

```bash
curl -X POST http://localhost:8080/api/v1/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "request_id": "test_path",
    "tenant_tag": "tenant_1",
    "path": "/other/path"
  }'
```

### 4. 无效状态转换

直接将 pending 状态改为 expired：

```bash
curl -X POST http://localhost:8080/api/v1/rules/status \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "new_status": "expired",
    "operator": "test_user",
    "description": "测试无效转换"
  }'
```

### 5. 重复提交 validate 请求（验证去重）

使用相同的 rule_id + request_id 重复请求：

```bash
# 第一次请求
curl -X POST http://localhost:8080/api/v1/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "request_id": "test_duplicate_001",
    "tenant_tag": "tenant_1",
    "path": "/api/v1/test"
  }'

# 重复请求（返回相同结果，不消耗 max_hits）
curl -X POST http://localhost:8080/api/v1/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": 1,
    "request_id": "test_duplicate_001",
    "tenant_tag": "tenant_1",
    "path": "/api/v1/test"
  }'
```

## 如何查看处理记录

### 查看命中记录

```bash
curl http://localhost:8080/api/v1/rules/1/hits
```

### 查看历史操作记录

```bash
curl http://localhost:8080/api/v1/rules/1/history
```

### 查看规则详情

```bash
curl http://localhost:8080/api/v1/rules/1
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待激活 |
| active | 激活中 |
| paused | 已暂停 |
| expired | 已过期 |
| recovered | 已恢复 |

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 403 | 租户无权限 |
| 404 | 规则不存在 |
| 500 | 服务器内部错误 |

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 主程序入口
├── internal/
│   ├── models/
│   │   └── models.go        # 数据模型
│   ├── repository/
│   │   ├── database.go      # 数据库配置
│   │   └── repository.go    # 数据访问层
│   ├── service/
│   │   └── service.go       # 业务逻辑层
│   └── handler/
│       └── handler.go       # API 处理层
├── go.mod
├── go.sum
└── README.md
```
