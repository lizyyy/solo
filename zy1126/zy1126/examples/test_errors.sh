#!/bin/bash

# Performance Tracker 错误处理测试脚本
# 这个脚本展示了各种异常输入的错误返回

set +e

BASE_URL="http://localhost:8080"

echo "=========================================="
echo "Performance Tracker 错误处理测试"
echo "=========================================="
echo ""

# 检查服务是否启动
echo "1. 检查服务是否启动..."
HEALTH_CHECK=$(curl -s "$BASE_URL/health" || echo "{}")
if [ -z "$HEALTH_CHECK" ] || [ "$HEALTH_CHECK" = "{}" ]; then
    echo "❌ 服务未启动，请先运行: go run cmd/api/main.go"
    exit 1
fi
echo "✅ 服务运行正常"
echo ""

# 创建一个项目用于测试
echo "创建测试项目..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "error-test-project",
        "description": "错误处理测试项目",
        "service_name": "test-service",
        "version": "v1.0.0"
    }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*$')
echo "测试项目 ID: $PROJECT_ID"
echo ""

# 测试 1: 无效的项目 ID
echo "=========================================="
echo "测试 1: 无效的项目 ID"
echo "=========================================="
echo "请求: GET /api/v1/projects/99999"
echo ""
curl -s "$BASE_URL/api/v1/projects/99999" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/v1/projects/99999"
echo ""
echo ""

# 测试 2: 无效的并发参数
echo "=========================================="
echo "测试 2: 无效的并发参数 (concurrency = 0)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 0}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 0}" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 3: 无效的并发参数 (负数)
echo "=========================================="
echo "测试 3: 无效的并发参数 (concurrency = -5)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": -5}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": -5}" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 4: 无效的 RPS 参数
echo "=========================================="
echo "测试 4: 无效的 RPS 参数 (target_rps = -10)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"target_rps\": -10}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"target_rps\": -10}" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 5: 无效的超时参数
echo "=========================================="
echo "测试 5: 无效的超时参数 (timeout_ms = 0)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"timeout_ms\": 0}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"timeout_ms\": 0}" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 6: 无效的总请求数
echo "=========================================="
echo "测试 6: 无效的总请求数 (total_requests = -100)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"total_requests\": -100}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test\", \"concurrency\": 5, \"total_requests\": -100}" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 7: 无效的错误率预算
echo "=========================================="
echo "测试 7: 无效的错误率预算 (error_rate_max = 1.5, 超过 1.0)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"GET\", \"path\": \"/api/test\", \"error_rate_max\": 1.5}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "GET", "path": "/api/test", "error_rate_max": 1.5}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 8: 无效的错误率预算 (负数)
echo "=========================================="
echo "测试 8: 无效的错误率预算 (error_rate_max = -0.1, 负数)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"GET\", \"path\": \"/api/test\", \"error_rate_max\": -0.1}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "GET", "path": "/api/test", "error_rate_max": -0.1}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 9: 无效的 p95 延迟预算
echo "=========================================="
echo "测试 9: 无效的 p95 延迟预算 (p95_max_ms = 0)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"GET\", \"path\": \"/api/test\", \"p95_max_ms\": 0}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "GET", "path": "/api/test", "p95_max_ms": 0}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 10: 无效的 p95 延迟预算 (负数)
echo "=========================================="
echo "测试 10: 无效的 p95 延迟预算 (p95_max_ms = -100)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"GET\", \"path\": \"/api/test\", \"p95_max_ms\": -100}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "GET", "path": "/api/test", "p95_max_ms": -100}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 11: 缺少必需字段 (路由缺少 method)
echo "=========================================="
echo "测试 11: 缺少必需字段 (路由缺少 method)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"path\": \"/api/test\"}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"path": "/api/test"}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 12: 缺少必需字段 (路由缺少 path)
echo "=========================================="
echo "测试 12: 缺少必需字段 (路由缺少 path)"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"GET\"}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "GET"}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 13: 缺少必需字段 (运行任务缺少 project_id)
echo "=========================================="
echo "测试 13: 缺少必需字段 (运行任务缺少 project_id)"
echo "=========================================="
echo "请求: POST /api/v1/runs"
echo "Body: {\"name\": \"test\", \"concurrency\": 5}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d '{"name": "test", "concurrency": 5}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 14: 无效的 HTTP 方法
echo "=========================================="
echo "测试 14: 无效的 HTTP 方法 (method = \"INVALID\")"
echo "=========================================="
echo "请求: POST /api/v1/projects/$PROJECT_ID/routes"
echo "Body: {\"method\": \"INVALID\", \"path\": \"/api/test\"}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/routes" \
    -H "Content-Type: application/json" \
    -d '{"method": "INVALID", "path": "/api/test"}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 15: 无效的运行任务 ID
echo "=========================================="
echo "测试 15: 无效的运行任务 ID (对比分析)"
echo "=========================================="
echo "请求: GET /api/v1/compare?run_id=99999"
echo ""
curl -s "$BASE_URL/api/v1/compare?run_id=99999" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 16: 无效的运行任务 ID (归因分析)
echo "=========================================="
echo "测试 16: 无效的运行任务 ID (归因分析)"
echo "=========================================="
echo "请求: GET /api/v1/analysis/attribution?run_id=99999"
echo ""
curl -s "$BASE_URL/api/v1/analysis/attribution?run_id=99999" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 17: 无效的 JSON 格式
echo "=========================================="
echo "测试 17: 无效的 JSON 格式"
echo "=========================================="
echo "请求: POST /api/v1/projects"
echo "Body: {invalid json}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects" \
    -H "Content-Type: application/json" \
    -d '{invalid json}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 18: 启动已完成的运行任务
echo "=========================================="
echo "测试 18: 启动已完成的运行任务 (先创建并启动一个任务)"
echo "=========================================="
# 先创建一个运行任务
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": $PROJECT_ID, \"name\": \"test-run-1\", \"concurrency\": 1, \"total_requests\": 1}")
RUN_ID=$(echo "$RUN_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*$')

# 启动它
curl -s -X POST "$BASE_URL/api/v1/runs/$RUN_ID/start" > /dev/null

# 等待完成
sleep 3

# 再次启动
echo "请求: POST /api/v1/runs/$RUN_ID/start (任务已完成)"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs/$RUN_ID/start" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 19: 停止不存在的运行任务
echo "=========================================="
echo "测试 19: 停止不存在的运行任务"
echo "=========================================="
echo "请求: POST /api/v1/runs/99999/stop"
echo ""
curl -s -X POST "$BASE_URL/api/v1/runs/99999/stop" | python3 -m json.tool 2>/dev/null
echo ""
echo ""

# 测试 20: 无效的 Content-Type
echo "=========================================="
echo "测试 20: 无效的 Content-Type (使用 text/plain 而不是 application/json)"
echo "=========================================="
echo "请求: POST /api/v1/projects"
echo "Content-Type: text/plain"
echo ""
curl -s -X POST "$BASE_URL/api/v1/projects" \
    -H "Content-Type: text/plain" \
    -d '{"name": "test"}' | python3 -m json.tool 2>/dev/null
echo ""
echo ""

echo "=========================================="
echo "错误处理测试完成！"
echo "=========================================="
echo ""
echo "测试项目 ID: $PROJECT_ID"
echo "测试运行任务 ID: $RUN_ID"
echo ""
