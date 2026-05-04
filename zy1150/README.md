# Go HTTP 中间件链路诊断服务

一个本地运行的 Go HTTP 中间件链路诊断服务，帮助小团队排查"每个中间件单看都没问题，但串起来就出事故"的问题。

## 功能特性

### 🔍 诊断规则

服务内置了 10 条诊断规则，能够识别常见的中间件问题：

| 规则名称 | 严重程度 | 描述 |
|---------|---------|------|
| `recover_not_outermost` | Critical | Recover 中间件没有放在最外层，或完全缺失 |
| `cors_preflight_blocked_by_auth` | High | CORS 中间件在 auth 之后，导致预检请求被拦截 |
| `auth_before_tenant` | High | Auth 中间件在 tenant 解析之前，可能导致跨租户访问 |
| `rate_limit_key_wrong` | High | 限流 key 配置错误（如使用 IP 而非用户 ID） |
| `context_key_overwritten` | High | Context key 被不同中间件覆盖 |
| `body_read_multiple_times` | Medium | Request body 被多个中间件重复读取 |
| `timeout_context_not_propagated` | High | Timeout/context 没有继续传递 |
| `trace_header_lost` | Medium | Trace header 在中间件链路中丢失 |
| `idempotency_key_conflict` | High | 幂等键冲突或配置错误 |
| `middleware_not_calling_next` | Critical | 中间件没有调用 next，导致请求被截断 |

### 📦 支持的数据格式

- **routes.yaml** - 路由定义（服务、方法、路径、中间件链）
- **middlewares.yaml** - 中间件定义（名称、类型、配置）
- **request-traces.jsonl** - 请求追踪数据（trace_id、headers、body 读取次数、响应）
- **context-events.jsonl** - 上下文事件（context 操作、header 变化、next 调用）
- **policies.yaml** - 诊断策略配置

### 🌐 HTTP API

| 方法 | 端点 | 描述 |
|-----|------|------|
| GET | `/health` | 健康检查 |
| POST | `/import?type=<type>&file=<path>` | 导入数据（types: routes, middlewares, request-traces, context-events, policies） |
| GET | `/routes` | 列出所有路由 |
| GET | `/routes/<id>` | 获取路由详情（含中间件链路） |
| GET | `/routes/<id>/chain` | 获取路由链路分析 |
| GET | `/routes/<id>?suggestion=true` | 获取中间件顺序建议 |
| POST | `/diagnostics/run` | 运行所有诊断规则 |
| GET | `/risks` | 列出所有检测到的风险 |
| GET | `/risks?status=<status>` | 按状态筛选风险 |
| PATCH | `/risks/<id>/status` | 更新风险状态 |
| POST | `/replay` | 回放请求 |
| GET | `/export?format=<format>` | 导出报告（formats: json, markdown, csv） |
| GET | `/traces/<id>` | 获取请求追踪详情 |
| GET | `/traces/<id>?events=true` | 获取请求追踪及上下文事件 |
| POST | `/rules/reload` | 重新加载诊断规则 |

## 快速开始

### 环境要求

- Go 1.21+
- SQLite（通过 modernc.org/sqlite 纯 Go 实现，无需 CGO）

### 安装与运行

```bash
# 克隆项目
cd middleware-diagnostic

# 安装依赖
go mod download

# 运行服务
go run cmd/server/main.go -port 8080 -db ./data/diagnostic.db
```

### 使用演示脚本

```bash
# 运行完整演示（启动服务、导入数据、运行诊断、导出报告）
chmod +x demo.sh
./demo.sh

# 或运行 API 示例脚本
chmod +x examples.sh
./examples.sh
```

## 项目结构

```
middleware-diagnostic/
├── cmd/
│   └── server/
│       └── main.go              # 服务入口
├── internal/
│   ├── database/
│   │   └── database.go          # SQLite 数据库初始化
│   ├── diagnostic/
│   │   ├── engine.go            # 诊断引擎核心
│   │   └── engine_test.go       # 诊断引擎测试
│   ├── exporter/
│   │   └── exporter.go          # 报告导出（JSON/Markdown/CSV）
│   ├── handler/
│   │   └── handler.go           # HTTP 处理器
│   ├── importer/
│   │   └── importer.go          # 数据导入器
│   ├── model/
│   │   └── models.go            # 数据模型定义
│   └── service/
│       └── service.go           # 业务逻辑层
├── testdata/
│   ├── routes.yaml              # 样例路由数据
│   ├── middlewares.yaml         # 样例中间件数据
│   ├── request-traces.jsonl     # 样例请求追踪
│   ├── context-events.jsonl     # 样例上下文事件
│   └── policies.yaml            # 样例策略配置
├── demo.sh                       # 演示脚本
├── examples.sh                   # API 示例脚本
├── go.mod
└── go.sum
```

## 数据格式说明

### routes.yaml

```yaml
routes:
  - service_name: "api-gateway"
    method: "POST"
    path: "/api/v1/users"
    description: "Create user endpoint"
    middlewares:
      - "auth-jwt"
      - "tenant-resolver"
      - "rate-limiter"
```

### middlewares.yaml

```yaml
middlewares:
  - name: "panic-recover"
    type: "recover"
    description: "Recover from panics"
    config:
      log_panic: true
      
  - name: "auth-jwt"
    type: "auth"
    description: "JWT authentication"
    config:
      header_name: "Authorization"
```

### request-traces.jsonl

```json
{"trace_id": "trace-001", "service_name": "api-gateway", "method": "POST", "path": "/api/v1/users", "headers": {"Content-Type": "application/json"}, "body_read_count": 2, "status_code": 201}
{"trace_id": "trace-002", "service_name": "api-gateway", "method": "GET", "path": "/api/v1/users/123", "headers": {"X-Trace-ID": "trace-002"}, "body_read_count": 0, "status_code": 200}
```

### context-events.jsonl

```json
{"trace_id": "trace-001", "middleware_name": "auth-jwt", "event_type": "context_set", "key": "user_id", "value": "user-123"}
{"trace_id": "trace-001", "middleware_name": "tenant-resolver", "event_type": "context_set", "key": "user_id", "value": "user-456", "old_value": "user-123"}
{"trace_id": "trace-003", "middleware_name": "auth-jwt", "event_type": "next_not_called", "key": "preflight_blocked"}
```

## 使用示例

### 1. 导入数据

```bash
# 导入中间件定义
curl -X POST "http://localhost:8080/import?type=middlewares&file=./testdata/middlewares.yaml"

# 导入路由定义
curl -X POST "http://localhost:8080/import?type=routes&file=./testdata/routes.yaml"

# 导入请求追踪
curl -X POST "http://localhost:8080/import?type=request-traces&file=./testdata/request-traces.jsonl"

# 导入上下文事件
curl -X POST "http://localhost:8080/import?type=context-events&file=./testdata/context-events.jsonl"
```

### 2. 运行诊断

```bash
curl -X POST http://localhost:8080/diagnostics/run
```

响应示例：
```json
{
    "total_risks": 9,
    "by_severity": {
        "critical": 2,
        "high": 5,
        "medium": 2
    },
    "by_category": {
        "ordering": 6,
        "context": 2,
        "request": 1
    },
    "risks": [...]
}
```

### 3. 查看风险

```bash
# 查看所有风险
curl http://localhost:8080/risks

# 只查看新发现的风险
curl "http://localhost:8080/risks?status=new"
```

### 4. 查看路由详情

```bash
# 查看路由详情
curl http://localhost:8080/routes/1

# 查看链路分析
curl http://localhost:8080/routes/1/chain

# 获取顺序建议
curl "http://localhost:8080/routes/1?suggestion=true"
```

### 5. 导出报告

```bash
# 导出 JSON 报告
curl "http://localhost:8080/export?format=json" > report.json

# 导出 Markdown 报告
curl "http://localhost:8080/export?format=markdown" > report.md

# 导出 CSV 报告
curl "http://localhost:8080/export?format=csv" > report.csv
```

### 6. 管理风险状态

```bash
# 标记为已确认
curl -X PATCH -H "Content-Type: application/json" \
    -d '{"status":"confirmed"}' \
    http://localhost:8080/risks/1/status

# 标记为误报
curl -X PATCH -H "Content-Type: application/json" \
    -d '{"status":"false_positive"}' \
    http://localhost:8080/risks/1/status

# 标记为已解决
curl -X PATCH -H "Content-Type: application/json" \
    -d '{"status":"resolved"}' \
    http://localhost:8080/risks/1/status
```

## 诊断规则详情

### 1. Recover 位置检查 (`recover_not_outermost`)

**检测条件：**
- 路由没有配置 recover 中间件
- Recover 中间件不在位置 0（最外层）

**影响：** Panic 可能不会被捕获，导致服务崩溃

**建议：** 将 recover 中间件移到中间件链的最外层

---

### 2. CORS 预检检查 (`cors_preflight_blocked_by_auth`)

**检测条件：** CORS 中间件的位置 > auth 中间件的位置

**影响：** CORS 预检请求（OPTIONS）会被 auth 中间件拦截，导致跨域请求失败

**建议：** 将 CORS 中间件移到 auth 中间件之前

---

### 3. Tenant-Auth 顺序检查 (`auth_before_tenant`)

**检测条件：**
- 路由有 auth 但没有 tenant 中间件
- Auth 中间件的位置 < tenant 中间件的位置

**影响：** Auth 验证时无法获取正确的租户上下文，可能导致权限判断错误或跨租户数据访问

**建议：** 调整顺序：先解析 tenant，再执行 auth 验证

---

### 4. 限流 Key 检查 (`rate_limit_key_wrong`)

**检测条件：**
- 限流中间件没有配置 key_source
- 使用了 `ip` 或 `remote_addr` 作为 key_source

**影响：** 基于 IP 的限流在 NAT 或代理环境下可能不准确

**建议：** 使用 user_id、tenant_id 等更可靠的标识

---

### 5. Context Key 覆盖检查 (`context_key_overwritten`)

**检测条件：** 同一个 context key 被不同中间件设置

**影响：** Context 污染，数据混乱

**建议：** 不同中间件使用不同的 context key

---

### 6. Body 多次读取检查 (`body_read_multiple_times`)

**检测条件：** `body_read_count > 1`

**影响：** Go 的 http.Request.Body 只能读取一次，多次读取可能导致 body 为空

**建议：** 使用 io.NopCloser 包装 body 或使用缓冲机制

---

### 7. Context 传递检查 (`timeout_context_not_propagated`)

**检测条件：** 存在 `context_missing` 类型事件，涉及 timeout/deadline/cancel 相关的 key

**影响：** Timeout 没有传递下去，可能导致请求挂起或资源泄漏

**建议：** 确保在所有中间件中正确传递 context

---

### 8. Trace Header 检查 (`trace_header_lost`)

**检测条件：**
- 请求头中没有 x-trace-id、traceparent、x-request-id、x-b3-traceid
- 存在 `header_lost` 类型事件

**影响：** 分布式追踪链路断裂

**建议：** 确保中间件正确转发 trace 相关的 header

---

### 9. 幂等键检查 (`idempotency_key_conflict`)

**检测条件：** 同一个幂等键值被多个请求使用

**影响：** 幂等键冲突可能导致重复请求被错误处理

**建议：** 检查幂等键生成逻辑，确保唯一性

---

### 10. Next 调用检查 (`middleware_not_calling_next`)

**检测条件：** 存在 `next_not_called` 类型事件

**影响：** 请求被中间件截断，后续中间件和 handler 不会执行

**建议：** 检查中间件逻辑，确保所有路径都调用了 `next.ServeHTTP()`

## 常见问题场景

### 场景 1：跨租户读数据

**问题描述：** 用户 A 能够看到用户 B 的数据

**可能原因：** Auth 中间件在 tenant 解析之前执行

**诊断检测：** `auth_before_tenant` 规则

**解决方案：**
```yaml
# 错误的顺序
middlewares:
  - auth-jwt        # 先验证，此时还不知道租户
  - tenant-resolver

# 正确的顺序
middlewares:
  - tenant-resolver # 先解析租户
  - auth-jwt        # 再在租户上下文中验证
```

### 场景 2：Body 被读空

**问题描述：** Handler 中读取 body 时发现为空

**可能原因：** 某个中间件已经读取过 body，但没有重置

**诊断检测：** `body_read_multiple_times` 规则

**解决方案：**
```go
// 正确的 body 读取方式
func ReadBodyTwice(r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    r.Body = io.NopCloser(bytes.NewBuffer(body)) // 重置
    
    // 后续可以再次读取
    body2, _ := io.ReadAll(r.Body)
}
```

### 场景 3：Panic 没被 Recover

**问题描述：** 服务偶尔崩溃，但明明有 recover 中间件

**可能原因：** Recover 中间件不在最外层

**诊断检测：** `recover_not_outermost` 规则

**解决方案：**
```yaml
# 错误的顺序
middlewares:
  - auth-jwt
  - panic-recover   # 位置 1，不是最外层

# 正确的顺序
middlewares:
  - panic-recover   # 位置 0，最外层
  - auth-jwt
```

### 场景 4：预检请求被鉴权挡住

**问题描述：** 跨域请求失败，OPTIONS 请求返回 401

**可能原因：** CORS 中间件在 auth 之后

**诊断检测：** `cors_preflight_blocked_by_auth` 规则

**解决方案：**
```yaml
# 错误的顺序
middlewares:
  - auth-jwt        # 会拦截 OPTIONS 请求
  - cors-handler

# 正确的顺序
middlewares:
  - cors-handler    # 先处理预检请求
  - auth-jwt
```

### 场景 5：Trace ID 丢失

**问题描述：** 分布式追踪链路断裂

**可能原因：** 某个中间件没有转发 trace header

**诊断检测：** `trace_header_lost` 规则

**解决方案：** 确保所有中间件正确转发以下 header：
- `x-trace-id`
- `traceparent`
- `x-request-id`
- `x-b3-traceid`

## 运行测试

```bash
# 运行诊断引擎测试
go test ./internal/diagnostic/... -v

# 运行所有测试
go test ./... -v
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
