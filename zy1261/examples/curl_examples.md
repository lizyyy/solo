# 接口保护策略验证服务 - Curl 示例

## 基础信息
- 服务地址: http://127.0.0.1:8000
- API 文档: http://127.0.0.1:8000/docs

---

## 1. 服务健康检查

```bash
# 检查服务是否运行
curl http://127.0.0.1:8000/health
```

---

## 2. 配置导入

### 2.1 导入所有配置文件

```bash
# 导入 routes.yaml, protection-policy.yaml, dependency-health.jsonl, request-samples.jsonl
curl -X POST "http://127.0.0.1:8000/api/v1/config/import" \
  -F "routes_file=@examples/routes.yaml" \
  -F "protection_policy_file=@examples/protection-policy.yaml" \
  -F "dependency_health_file=@examples/dependency-health.jsonl" \
  -F "request_samples_file=@examples/request-samples.jsonl" \
  -F "create_version=true" \
  -F "version_description=Initial configuration"
```

### 2.2 分别导入配置

```bash
# 只导入路由配置
curl -X POST "http://127.0.0.1:8000/api/v1/config/import" \
  -F "routes_file=@examples/routes.yaml"

# 只导入保护策略
curl -X POST "http://127.0.0.1:8000/api/v1/config/import" \
  -F "protection_policy_file=@examples/protection-policy.yaml"

# 只导入依赖健康数据
curl -X POST "http://127.0.0.1:8000/api/v1/config/import" \
  -F "dependency_health_file=@examples/dependency-health.jsonl"

# 只导入请求样本
curl -X POST "http://127.0.0.1:8000/api/v1/config/import" \
  -F "request_samples_file=@examples/request-samples.jsonl"
```

---

## 3. 策略版本管理

### 3.1 查看所有策略版本

```bash
curl http://127.0.0.1:8000/api/v1/policy/versions

# 按状态过滤
curl "http://127.0.0.1:8000/api/v1/policy/versions?status=active"
```

### 3.2 创建新版本

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/policy/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0.0",
    "description": "First production version",
    "auto_apply": true
  }'
```

### 3.3 激活特定版本

```bash
# 假设版本 ID 为 1
curl -X POST "http://127.0.0.1:8000/api/v1/policy/versions/1/activate"
```

### 3.4 灰度发布

```bash
# 启动灰度发布，10% 流量使用新版本
curl -X POST "http://127.0.0.1:8000/api/v1/policy/canary/start" \
  -H "Content-Type: application/json" \
  -d '{
    "version_id": 2,
    "canary_percentage": 10,
    "keep_old_active": true
  }'

# 调整灰度比例到 50%
curl -X POST "http://127.0.0.1:8000/api/v1/policy/canary/update" \
  -H "Content-Type: application/json" \
  -d '{
    "version_id": 2,
    "canary_percentage": 50
  }'

# 完全发布 (100%)
curl -X POST "http://127.0.0.1:8000/api/v1/policy/canary/update" \
  -H "Content-Type: application/json" \
  -d '{
    "version_id": 2,
    "canary_percentage": 100
  }'
```

### 3.5 回滚

```bash
# 从版本 2 回滚到版本 1
curl -X POST "http://127.0.0.1:8000/api/v1/policy/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "from_version_id": 2,
    "to_version_id": 1
  }'
```

### 3.6 查看当前活动版本

```bash
curl http://127.0.0.1:8000/api/v1/policy/active
```

---

## 4. 请求评估 (核心功能)

### 4.1 正常请求评估

```bash
# 评估一个正常请求
curl -X POST "http://127.0.0.1:8000/api/v1/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/users",
    "method": "GET",
    "headers": {
      "X-User-Id": "user123",
      "Authorization": "Bearer token"
    },
    "query_params": {
      "page": "1",
      "limit": "20"
    },
    "is_dry_run": false
  }'
```

### 4.2 Dry Run 模式

```bash
# Dry run 模式 - 只记录日志，不实际限流
curl -X POST "http://127.0.0.1:8000/api/v1/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/v1/users",
    "method": "GET",
    "is_dry_run": true
  }'
```

### 4.3 批量测试限流

```bash
# 发送 110 个请求来测试限流 (阈值 100)
for i in $(seq 1 110); do
  curl -s -X POST "http://127.0.0.1:8000/api/v1/evaluate" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"/api/v1/users\", \"method\": \"GET\", \"request_identifier\": \"test-user-$i\"}" | jq -r '.decision'
done | sort | uniq -c
```

### 4.4 记录请求结果

```bash
# 先评估请求
RESPONSE=$(curl -s -X POST "http://127.0.0.1:8000/api/v1/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"path": "/api/v1/orders", "method": "POST"}')

REQUEST_ID=$(echo $RESPONSE | jq -r '.request_id')

# 记录成功结果
curl -X POST "http://127.0.0.1:8000/api/v1/evaluate/result" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"is_success\": true,
    \"response_status\": 200,
    \"response_time_ms\": 150.5
  }"

# 或记录失败结果 (用于触发熔断)
curl -X POST "http://127.0.0.1:8000/api/v1/evaluate/result" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"is_success\": false,
    \"response_status\": 500,
    \"response_time_ms\": 2000.0
  }"
```

### 4.5 查询请求日志

```bash
# 通过 request_id 查询日志
curl "http://127.0.0.1:8000/api/v1/evaluate/logs/{request_id}"
```

---

## 5. 依赖健康上报

### 5.1 上报依赖健康状态

```bash
# 上报健康的依赖
curl -X POST "http://127.0.0.1:8000/api/v1/health/report" \
  -H "Content-Type: application/json" \
  -d '{
    "dependency_key": "user-service:api",
    "service_name": "user-service",
    "endpoint": "/api/v1/users",
    "is_healthy": true,
    "error_rate": 0.01,
    "latency_p99_ms": 150,
    "success_count": 9900,
    "failure_count": 100,
    "total_requests": 10000
  }'

# 上报不健康的依赖
curl -X POST "http://127.0.0.1:8000/api/v1/health/report" \
  -H "Content-Type: application/json" \
  -d '{
    "dependency_key": "payment-service:api",
    "service_name": "payment-service",
    "endpoint": "/api/v1/payments",
    "is_healthy": false,
    "error_rate": 0.6,
    "latency_p99_ms": 2000,
    "success_count": 800,
    "failure_count": 1200,
    "total_requests": 2000
  }'
```

### 5.2 查询依赖健康

```bash
# 查询所有依赖健康状态
curl http://127.0.0.1:8000/api/v1/health/dependencies

# 只查询健康的依赖
curl "http://127.0.0.1:8000/api/v1/health/dependencies?healthy_only=true"

# 只查询不健康的依赖
curl "http://127.0.0.1:8000/api/v1/health/dependencies?unhealthy_only=true"

# 查询特定依赖
curl "http://127.0.0.1:8000/api/v1/health/dependencies/user-service:api"
```

---

## 6. 熔断状态管理

### 6.1 查询熔断状态

```bash
# 查询所有熔断器状态
curl http://127.0.0.1:8000/api/v1/health/circuit-breakers

# 查询特定路由的熔断器
curl "http://127.0.0.1:8000/api/v1/health/circuit-breakers?route_key=POST:/api/v1/orders"

# 只查询打开的熔断器
curl http://127.0.0.1:8000/api/v1/health/circuit-breakers/open
```

### 6.2 手动控制熔断

```bash
# 手动打开熔断器
curl -X POST "http://127.0.0.1:8000/api/v1/health/circuit-breakers/open" \
  -H "Content-Type: application/json" \
  -d '{
    "route_key": "POST:/api/v1/orders",
    "reason": "Manual test - simulating circuit open"
  }'

# 手动关闭熔断器
curl -X POST "http://127.0.0.1:8000/api/v1/health/circuit-breakers/closed" \
  -H "Content-Type: application/json" \
  -d '{
    "route_key": "POST:/api/v1/orders",
    "reason": "Manual reset after testing"
  }'
```

### 6.3 健康摘要

```bash
# 获取完整健康摘要
curl http://127.0.0.1:8000/api/v1/health/summary
```

---

## 7. 报告导出

### 7.1 JSON 报告

```bash
# 导出完整 JSON 报告
curl "http://127.0.0.1:8000/api/v1/report/json"

# 带时间范围的报告
curl "http://127.0.0.1:8000/api/v1/report/json?start_time=2026-05-01T00:00:00&end_time=2026-05-05T23:59:59"

# 包含请求样本的报告
curl "http://127.0.0.1:8000/api/v1/report/json?include_samples=true"

# 保存到文件
curl -s "http://127.0.0.1:8000/api/v1/report/json" > report.json
```

### 7.2 Markdown 报告

```bash
# 导出 Markdown 报告
curl "http://127.0.0.1:8000/api/v1/report/markdown"

# 带时间范围
curl "http://127.0.0.1:8000/api/v1/report/markdown?start_time=2026-05-01T00:00:00"

# 保存到文件
curl -s "http://127.0.0.1:8000/api/v1/report/markdown" > report.md
```

### 7.3 坏样例报告

```bash
# 导出坏样例提示报告
curl "http://127.0.0.1:8000/api/v1/report/bad-samples"

# 保存到文件
curl -s "http://127.0.0.1:8000/api/v1/report/bad-samples" > bad_samples.md
```

---

## 8. 配置查询

### 8.1 查询路由配置

```bash
# 查询所有路由
curl http://127.0.0.1:8000/api/v1/config/routes

# 查询特定路由
curl "http://127.0.0.1:8000/api/v1/config/routes/GET:/api/v1/users"
```

### 8.2 查询保护策略

```bash
# 查询所有策略
curl http://127.0.0.1:8000/api/v1/config/policies

# 查询特定策略
curl "http://127.0.0.1:8000/api/v1/config/policies/policy-users-read"
```

---

## 9. 管理操作

### 9.1 重置限流器

```bash
# 重置所有限流器
curl -X POST "http://127.0.0.1:8000/api/v1/admin/reset-rate-limiter"

# 重置特定路由的限流器
curl -X POST "http://127.0.0.1:8000/api/v1/admin/reset-rate-limiter?route_key=GET:/api/v1/users"
```

---

## 10. 完整测试流程示例

```bash
#!/bin/bash

BASE_URL="http://127.0.0.1:8000"

echo "=== 1. 检查服务状态 ==="
curl $BASE_URL/health
echo ""

echo "=== 2. 导入配置 ==="
curl -X POST "$BASE_URL/api/v1/config/import" \
  -F "routes_file=@examples/routes.yaml" \
  -F "protection_policy_file=@examples/protection-policy.yaml" \
  -F "create_version=true"
echo ""

echo "=== 3. 查看策略版本 ==="
curl $BASE_URL/api/v1/policy/versions
echo ""

echo "=== 4. 测试限流 (发送 105 个请求) ==="
for i in $(seq 1 105); do
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/evaluate" \
    -H "Content-Type: application/json" \
    -d '{"path": "/api/v1/users", "method": "GET"}')
  DECISION=$(echo $RESPONSE | jq -r '.decision')
  if [ "$DECISION" = "rate_limited" ]; then
    echo "Request $i: $DECISION (限流触发!)"
  else
    echo "Request $i: $DECISION"
  fi
done
echo ""

echo "=== 5. 测试熔断 ==="
# 先发送多个失败请求
for i in $(seq 1 5); do
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/evaluate" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"/api/v1/orders\", \"method\": \"POST\", \"request_id\": \"fail-test-$i\"}")
  REQUEST_ID=$(echo $RESPONSE | jq -r '.request_id')
  
  # 记录失败
  curl -s -X POST "$BASE_URL/api/v1/evaluate/result" \
    -H "Content-Type: application/json" \
    -d "{\"request_id\": \"$REQUEST_ID\", \"is_success\": false, \"response_status\": 500}"
done

echo "熔断状态:"
curl $BASE_URL/api/v1/health/circuit-breakers/open
echo ""

echo "=== 6. 导出报告 ==="
curl -s "$BASE_URL/api/v1/report/json" > test_report.json
curl -s "$BASE_URL/api/v1/report/markdown" > test_report.md
echo "报告已保存: test_report.json, test_report.md"
```
