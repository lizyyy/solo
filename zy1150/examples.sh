#!/bin/bash

# Go HTTP 中间件链路诊断服务 - API 调用示例
# 包含正常场景和异常场景的 curl 示例

set -e

BASE_URL="http://localhost:8080"

echo "=========================================="
echo "  Go HTTP 中间件链路诊断服务 - API 示例"
echo "=========================================="
echo ""

# 检查服务是否运行
check_service() {
    if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo "❌ 服务未运行，请先启动服务:"
        echo "   go run cmd/server/main.go -port 8080 -db ./data/diagnostic.db"
        exit 1
    fi
    echo "✅ 服务运行正常"
    echo ""
}

# 函数：执行 API 调用并显示结果
call_api() {
    local method=$1
    local endpoint=$2
    local description=$3
    local body=$4
    
    echo "=== $description ==="
    echo "方法: $method"
    echo "URL: $BASE_URL$endpoint"
    
    if [ -n "$body" ]; then
        echo "请求体: $body"
        result=$(curl -s -X "$method" -H "Content-Type: application/json" -d "$body" "$BASE_URL$endpoint")
    else
        result=$(curl -s -X "$method" "$BASE_URL$endpoint")
    fi
    
    echo ""
    echo "响应:"
    echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
    echo ""
    echo "-----------------------------------------"
    echo ""
}

check_service

echo "=========================================="
echo "  第一部分：正常场景示例"
echo "=========================================="
echo ""

# 1. 健康检查
call_api "GET" "/health" "1. 健康检查"

# 2. 导入中间件定义
call_api "POST" "/import?type=middlewares&file=./testdata/middlewares.yaml" "2. 导入中间件定义 (YAML)"

sleep 1

# 3. 导入路由定义
call_api "POST" "/import?type=routes&file=./testdata/routes.yaml" "3. 导入路由定义 (YAML)"

sleep 1

# 4. 导入请求追踪数据
call_api "POST" "/import?type=request-traces&file=./testdata/request-traces.jsonl" "4. 导入请求追踪数据 (JSONL)"

sleep 1

# 5. 导入上下文事件数据
call_api "POST" "/import?type=context-events&file=./testdata/context-events.jsonl" "5. 导入上下文事件数据 (JSONL)"

sleep 1

# 6. 导入策略定义
call_api "POST" "/import?type=policies&file=./testdata/policies.yaml" "6. 导入策略定义 (YAML)"

sleep 1

# 7. 查看所有路由
call_api "GET" "/routes" "7. 查看所有路由列表"

echo "=========================================="
echo "  第二部分：异常/错误场景示例"
echo "=========================================="
echo ""

# 错误场景 1: 缺少必要参数
echo "=== 错误场景 1: 导入时缺少 type 参数 ==="
echo "方法: POST"
echo "URL: $BASE_URL/import?file=./testdata/routes.yaml"
result=$(curl -s -X POST "$BASE_URL/import?file=./testdata/routes.yaml")
echo ""
echo "响应 (预期错误):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 2: 无效的 type 参数
echo "=== 错误场景 2: 无效的 type 参数 ==="
echo "方法: POST"
echo "URL: $BASE_URL/import?type=invalid_type&file=./testdata/routes.yaml"
result=$(curl -s -X POST "$BASE_URL/import?type=invalid_type&file=./testdata/routes.yaml")
echo ""
echo "响应 (预期错误):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 3: 文件不存在
echo "=== 错误场景 3: 导入不存在的文件 ==="
echo "方法: POST"
echo "URL: $BASE_URL/import?type=routes&file=/nonexistent/path.yaml"
result=$(curl -s -X POST "$BASE_URL/import?type=routes&file=/nonexistent/path.yaml")
echo ""
echo "响应 (预期错误):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 4: 无效的路由 ID
echo "=== 错误场景 4: 查询不存在的路由 ==="
echo "方法: GET"
echo "URL: $BASE_URL/routes/999999"
result=$(curl -s "$BASE_URL/routes/999999")
echo ""
echo "响应 (预期 404):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 5: 无效的风险状态
echo "=== 错误场景 5: 更新风险时使用无效状态 ==="
echo "方法: PATCH"
echo "URL: $BASE_URL/risks/1/status"
echo "请求体: {\"status\": \"invalid_status\"}"
result=$(curl -s -X PATCH -H "Content-Type: application/json" -d '{"status": "invalid_status"}' "$BASE_URL/risks/1/status")
echo ""
echo "响应 (预期错误):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 6: 不支持的导出格式
echo "=== 错误场景 6: 不支持的导出格式 ==="
echo "方法: GET"
echo "URL: $BASE_URL/export?format=xml"
result=$(curl -s "$BASE_URL/export?format=xml")
echo ""
echo "响应 (预期错误):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 错误场景 7: 错误的 HTTP 方法
echo "=== 错误场景 7: 对 POST 端点使用 GET 方法 ==="
echo "方法: GET (应该是 POST)"
echo "URL: $BASE_URL/import?type=routes&file=./testdata/routes.yaml"
result=$(curl -s "$BASE_URL/import?type=routes&file=./testdata/routes.yaml")
echo ""
echo "响应 (预期 405 Method Not Allowed):"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

echo "=========================================="
echo "  第三部分：核心功能示例"
echo "=========================================="
echo ""

sleep 1

# 运行诊断
echo "=== 8. 运行所有诊断规则 (检测中间件问题) ==="
echo "方法: POST"
echo "URL: $BASE_URL/diagnostics/run"
for i in {1..5}; do
    result=$(curl -s -X POST "$BASE_URL/diagnostics/run")
    if echo "$result" | grep -q "SQLITE_BUSY\|database is locked"; then
        echo "数据库繁忙，重试 $i/5..."
        sleep 2
    else
        break
    fi
done
echo ""
echo "响应:"
echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 查看检测到的风险
call_api "GET" "/risks" "9. 查看所有检测到的风险"

# 按状态筛选风险
call_api "GET" "/risks?status=new" "10. 只查看新发现的风险"

# 查看路由详情和中间件链路
call_api "GET" "/routes/1" "11. 查看路由 ID=1 的详细信息 (含中间件链路)"

# 查看路由链路分析
call_api "GET" "/routes/1/chain" "12. 查看路由 ID=1 的链路分析"

# 查看中间件顺序建议
echo "=== 13. 查看路由 ID=1 的中间件顺序建议 ==="
echo "方法: GET"
echo "URL: $BASE_URL/routes/1?suggestion=true"
result=$(curl -s "$BASE_URL/routes/1?suggestion=true")
echo ""
echo "响应 (文本格式建议):"
echo "$result"
echo ""
echo "-----------------------------------------"
echo ""

# 查看请求追踪
call_api "GET" "/traces/trace-001" "14. 查看请求追踪 trace-001"

# 查看请求追踪及上下文事件
call_api "GET" "/traces/trace-001?events=true" "15. 查看请求追踪 trace-001 及所有上下文事件"

echo "=========================================="
echo "  第四部分：报告导出示例"
echo "=========================================="
echo ""

# 创建输出目录
mkdir -p ./output

# 导出 JSON 报告
echo "=== 16. 导出 JSON 格式报告 ==="
echo "方法: GET"
echo "URL: $BASE_URL/export?format=json"
curl -s "$BASE_URL/export?format=json" > ./output/report-api.json
echo "报告已保存到: ./output/report-api.json"
echo ""

# 导出 Markdown 报告
echo "=== 17. 导出 Markdown 格式报告 ==="
echo "方法: GET"
echo "URL: $BASE_URL/export?format=markdown"
curl -s "$BASE_URL/export?format=markdown" > ./output/report-api.md
echo "报告已保存到: ./output/report-api.md"
echo ""

# 导出 CSV 报告
echo "=== 18. 导出 CSV 格式报告 ==="
echo "方法: GET"
echo "URL: $BASE_URL/export?format=csv"
curl -s "$BASE_URL/export?format=csv" > ./output/report-api.csv
echo "报告已保存到: ./output/report-api.csv"
echo ""

echo "=========================================="
echo "  第五部分：请求回放示例"
echo "=========================================="
echo ""

# 回放请求
call_api "POST" "/replay" "19. 回放请求 (模拟请求重放)" '{"trace_ids": ["trace-001", "trace-002"]}'

# 不带参数的回放（默认前 100 条）
call_api "POST" "/replay" "20. 回放默认前 100 条请求" '{}'

echo "=========================================="
echo "  第六部分：规则重载示例"
echo "=========================================="
echo ""

# 重载诊断规则
call_api "POST" "/rules/reload" "21. 重新加载诊断规则"

echo "=========================================="
echo "  示例完成"
echo "=========================================="
echo ""
echo "生成的文件:"
ls -la ./output/ 2>/dev/null || echo "  (无输出文件)"
echo ""
echo "提示:"
echo "  - 查看 Markdown 报告: cat ./output/report-api.md"
echo "  - 查看 JSON 报告: cat ./output/report-api.json | python3 -m json.tool"
echo "  - 查看 CSV 报告: cat ./output/report-api.csv"
echo ""
