# 配置管理服务 (Config Manager)

一个本地运行的 Go 后端服务，用于管理内部服务共用的配置发布。实现了 **"先校验、再灰度、能回滚、能查账"** 的完整配置发布链路。

## 核心特性

- **Schema 校验**: 配置提交前进行 JSON Schema 类型校验
- **版本管理**: 每个配置项有多版本历史，支持 diff 对比
- **灰度发布**: 支持按租户、地区、百分比进行灰度
- **发布控制**: 支持暂停、继续、回滚操作
- **客户端缓存**: 支持 ETag 机制，减少无效传输
- **审计日志**: 所有操作都有完整的审计记录
- **报告导出**: 支持 JSON 和 Markdown 格式的发布报告

## 数据模型

### 核心实体

1. **Tenant (租户)**: 多租户隔离
2. **Service (服务)**: 每个租户下的具体服务
3. **ConfigItem (配置项)**: 具体的配置定义，包含 JSON Schema
4. **ConfigVersion (配置版本)**: 配置值的历史版本
5. **Release (发布批次)**: 一次发布可以包含多个配置版本变更
6. **Client (客户端)**: 拉取配置的服务实例
7. **ClientPull (拉取记录)**: 记录每次客户端拉取行为
8. **AuditLog (审计日志)**: 所有操作的审计记录

### 发布状态

| 状态 | 说明 |
|------|------|
| `draft` | 草稿 |
| `pending` | 待发布 |
| `rolling` | 灰度中 |
| `paused` | 已暂停 |
| `completed` | 已全量 |
| `rolled_back` | 已回滚 |

## 快速开始

### 环境要求

- Go 1.21+
- SQLite3 (通过 go-sqlite3 驱动)

### 安装依赖

```bash
go mod tidy
```

### 启动服务

```bash
# 普通启动
go run cmd/server/main.go

# 带种子数据启动（用于演示）
go run cmd/server/main.go --seed

# 指定端口和数据库路径
go run cmd/server/main.go --port 8080 --db ./my_config.db
```

服务启动后访问: http://localhost:8080/health

## API 文档

### 公共请求头

| 头名 | 说明 |
|------|------|
| `X-Operator` | 操作人标识，用于审计日志 |
| `Content-Type` | `application/json` |

### 1. 配置版本管理

#### 校验配置值
```bash
POST /api/v1/configs/{config_id}/validate

# 示例
curl -X POST http://localhost:8080/api/v1/configs/c_001/validate \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "value": {
      "max_qps": 500,
      "window_sec": 60
    }
  }'
```

响应 (校验通过):
```json
{
  "valid": true,
  "config_key": "rate_limit"
}
```

响应 (校验失败):
```json
{
  "valid": false,
  "config_key": "rate_limit",
  "errors": [
    {
      "field": "max_qps",
      "message": "Invalid type. Expected: integer, given: string",
      "value": "not_a_number"
    }
  ]
}
```

#### 创建新版本
```bash
POST /api/v1/configs/{config_id}/versions

# 示例
curl -X POST http://localhost:8080/api/v1/configs/c_001/versions \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "value": {
      "max_qps": 500,
      "window_sec": 60
    }
  }'
```

#### 版本 Diff
```bash
GET /api/v1/versions/{old_version_id}/diff/{new_version_id}

# 示例
curl http://localhost:8080/api/v1/versions/v_001/diff/v_004
```

响应:
```json
{
  "config_key": "rate_limit",
  "old_version": 1,
  "new_version": 2,
  "old_value": {
    "max_qps": 100,
    "window_sec": 60
  },
  "new_value": {
    "max_qps": 500,
    "window_sec": 60
  },
  "operation": "update"
}
```

### 2. 发布管理

#### 创建发布批次
```bash
POST /api/v1/releases

# 示例：灰度 30%，仅限 zh_CN 地区
curl -X POST http://localhost:8080/api/v1/releases \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "tenant_id": "t_001",
    "service_id": "s_001",
    "name": "限流升级 + 新功能开启",
    "config_changes": ["v_004", "v_005"],
    "gray_rule": {
      "percentage": 30,
      "regions": ["zh_CN"]
    }
  }'
```

灰度规则 (`gray_rule`) 字段说明:

| 字段 | 类型 | 说明 |
|------|------|------|
| `percentage` | int | 灰度百分比 (0-100)，必填 |
| `regions` | []string | 可选，指定地区列表，如 `["zh_CN", "en_US"]` |
| `tenant_ids` | []string | 可选，指定租户列表 |

#### 启动发布
```bash
POST /api/v1/releases/{release_id}/start

# 示例
curl -X POST http://localhost:8080/api/v1/releases/{release_id}/start \
  -H "X-Operator: admin"
```

#### 暂停发布
```bash
POST /api/v1/releases/{release_id}/pause

# 示例
curl -X POST http://localhost:8080/api/v1/releases/{release_id}/pause \
  -H "X-Operator: admin"
```

#### 继续发布
```bash
POST /api/v1/releases/{release_id}/resume

# 示例
curl -X POST http://localhost:8080/api/v1/releases/{release_id}/resume \
  -H "X-Operator: admin"
```

#### 完成发布（全量）
```bash
POST /api/v1/releases/{release_id}/complete

# 示例
curl -X POST http://localhost:8080/api/v1/releases/{release_id}/complete \
  -H "X-Operator: admin"
```

#### 回滚发布
```bash
POST /api/v1/releases/{release_id}/rollback

# 示例
curl -X POST http://localhost:8080/api/v1/releases/{release_id}/rollback \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "reason": "观察到错误率上升，需要回滚"
  }'
```

### 3. 客户端拉取配置

```bash
GET /api/v1/clients/{tenant_id}/{service_id}/{client_id}/configs

# 头信息
# X-Region: 客户端地区（可选，默认 default）
# If-None-Match: 上次的 ETag（可选，用于缓存）

# 示例 1：首次拉取
curl http://localhost:8080/api/v1/clients/t_001/s_001/client_001/configs \
  -H "X-Region: zh_CN" \
  -i  # 显示响应头

# 示例 2：使用 ETag 缓存
curl http://localhost:8080/api/v1/clients/t_001/s_001/client_001/configs \
  -H "X-Region: zh_CN" \
  -H "If-None-Match: \"abc123...\""
```

响应 (200 OK):
```json
{
  "rate_limit": {
    "max_qps": 100,
    "window_sec": 60
  },
  "feature_new_checkout": {
    "enabled": false
  },
  "region_policy": {
    "zh_CN": {
      "priority": 1,
      "tax_rate": 0.13
    },
    "en_US": {
      "priority": 2,
      "tax_rate": 0.08
    }
  }
}
```

响应头包含 ETag:
```
ETag: "a1b2c3d4e5f6..."
```

当配置未变化时返回 `304 Not Modified`。

### 4. 发布报告

```bash
GET /api/v1/releases/{release_id}/report?format={json|markdown}

# 示例：JSON 格式
curl http://localhost:8080/api/v1/releases/{release_id}/report

# 示例：Markdown 格式
curl http://localhost:8080/api/v1/releases/{release_id}/report?format=markdown
```

报告包含:
- 发布基本信息（ID、名称、状态、时间）
- 灰度规则
- 变更摘要（配置项、版本变化、客户端命中率）
- 校验失败项
- 回滚记录
- 待处理风险

### 5. 健康检查

```bash
GET /health

# 示例
curl http://localhost:8080/health
```

## 运行演示

### 1. 启动服务（带种子数据）

```bash
go run cmd/server/main.go --seed
```

种子数据包含:
- 租户: `t_001` (内部租户)
- 服务: `s_001` (订单服务)
- 配置项:
  - `rate_limit` (限流配置) - 已发布版本 v1 (100 QPS)，草稿版本 v2 (500 QPS)
  - `feature_new_checkout` (新结账功能) - 已发布 v1 (关闭)，草稿 v2 (开启)
  - `region_policy` (地区策略) - 已发布 v1

### 2. 运行演示脚本

```bash
chmod +x scripts/demo.sh
./scripts/demo.sh
```

脚本会演示:
1. 健康检查
2. 配置校验（合法值 vs 非法值）
3. 版本差异预览
4. 创建灰度发布批次
5. 启动发布
6. 模拟多个客户端拉取（部分命中灰度）
7. ETag 缓存测试
8. 暂停发布
9. 生成发布报告 (JSON + Markdown)
10. 回滚发布
11. 回滚后的报告
12. 异常输入测试（灰度比例超过 100）

## 运行测试

```bash
# 运行所有测试
go test ./...

# 运行指定包的测试
go test ./internal/service/... -v
```

测试覆盖:
- 配置值 Schema 校验
- 灰度规则验证
- 灰度规则匹配逻辑
- 版本创建
- 报告导出 (JSON/Markdown)

## 错误响应

所有错误返回统一格式:

```json
{
  "error": "错误描述信息",
  "code": "错误码（可选）"
}
```

常见错误码:

| 错误码 | 说明 |
|--------|------|
| `tenant_not_found` | 租户不存在 |
| `service_not_found` | 服务不存在 |
| `config_not_found` | 配置项不存在 |
| `version_not_found` | 版本不存在 |
| `release_not_found` | 发布批次不存在 |
| `invalid_gray_percentage` | 灰度比例无效 (0-100) |
| `invalid_release_status` | 无效的发布状态 |
| `validation_failed` | 配置校验失败 |
| `schema_invalid` | Schema 本身无效 |
| `tenant_mismatch` | 租户不匹配 |

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go         # 服务入口
├── internal/
│   ├── api/
│   │   └── handler.go      # HTTP 处理器
│   ├── model/
│   │   └── model.go        # 数据模型和类型定义
│   ├── service/
│   │   ├── config_service.go    # 业务逻辑
│   │   └── config_service_test.go
│   └── store/
│       └── store.go        # SQLite 存储层
├── scripts/
│   └── demo.sh             # 演示脚本
├── go.mod
├── go.sum
└── README.md
```

## 灰度规则匹配逻辑

客户端是否命中灰度发布的判断顺序:

1. **租户过滤**: 如果 `gray_rule.tenant_ids` 非空，客户端租户必须在列表中
2. **地区过滤**: 如果 `gray_rule.regions` 非空，客户端地区必须在列表中
3. **百分比过滤**: 基于客户端 ID 哈希取模 `% 100 < percentage`

百分比计算使用 SHA256 哈希，确保相同客户端每次判断结果一致。

## 审计日志

所有关键操作都会记录审计日志，包含:

- `action`: 操作类型
- `resource_id`: 资源 ID
- `resource_type`: 资源类型
- `tenant_id`: 租户 ID
- `operator`: 操作人 (来自 `X-Operator` 头)
- `created_at`: 操作时间
- `details`: 操作详情 (JSON)

已记录的操作类型:

| 操作 | 说明 |
|------|------|
| `create_version` | 创建配置版本 |
| `create_release` | 创建发布批次 |
| `start_release` | 启动发布 |
| `pause_release` | 暂停发布 |
| `resume_release` | 继续发布 |
| `complete_release` | 完成发布 |
| `rollback_release` | 回滚发布 |

回滚日志的 `details` 字段特别包含:
- `from_version`: 回滚前版本
- `to_version`: 回滚后版本
- `reason`: 回滚原因
- `affected_clients`: 受影响客户端数

## 注意事项

1. **本地开发**: 这是一个本地开发用的服务，生产环境需要考虑:
   - 并发控制 (分布式锁)
   - 数据库高可用
   - 认证授权
   - 限流和监控

2. **灰度百分比**: 百分比是基于客户端 ID 哈希的概率性命中，不是严格的按数量计数。

3. **ETag 缓存**: ETag 基于所有配置项的版本组合生成，任一配置变化都会导致 ETag 变化。

4. **回滚逻辑**: 回滚会将配置版本恢复到上一个已发布状态，并记录完整的审计信息。
