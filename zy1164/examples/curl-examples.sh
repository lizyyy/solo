#!/bin/bash

BASE_URL="http://localhost:3000"
TEST_APP_KEY="ak_test_001"

echo "========================================"
echo "接口限流策略验证服务 - curl 示例"
echo "========================================"
echo ""

echo "--- 1. 健康检查 ---"
curl -s "$BASE_URL/health" | jq .
echo ""
echo ""

echo "--- 2. 请求限流检查 (固定窗口算法) ---"
echo "测试 appKey: $TEST_APP_KEY, 路由: /api/users [GET]"
echo "预期: 配额 100/60s"
curl -s -X POST "$BASE_URL/api/rate-limit/check" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$TEST_APP_KEY\",
    \"path\": \"/api/users\",
    \"method\": \"GET\"
  }" | jq .
echo ""
echo ""

echo "--- 3. 并发模拟测试 ---"
echo "模拟 150 个并发请求到 /api/users [GET]"
echo "预期: 配额 100，所以 100 个放行，50 个拒绝"
curl -s -X POST "$BASE_URL/api/rate-limit/simulate/concurrent" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$TEST_APP_KEY\",
    \"path\": \"/api/users\",
    \"method\": \"GET\",
    \"requestCount\": 150
  }" | jq .
echo ""
echo ""

echo "--- 4. 时间线模拟测试 ---"
echo "模拟跨越窗口边界的请求时间线"
curl -s -X POST "$BASE_URL/api/rate-limit/simulate/timeline" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$TEST_APP_KEY\",
    \"path\": \"/api/orders\",
    \"method\": \"GET\",
    \"timestamps\": [
      $(date +%s000),
      $(( $(date +%s000) + 500 )),
      $(( $(date +%s000) + 1000 )),
      $(( $(date +%s000) + 1500 )),
      $(( $(date +%s000) + 2000 ))
    ]
  }" | jq .
echo ""
echo ""

echo "--- 5. 获取统计信息 ---"
curl -s "$BASE_URL/api/rate-limit/stats" | jq .
echo ""
echo ""

echo "--- 6. 导出 Markdown 报告 ---"
echo "报告将下载为 rate-limit-report.md"
curl -s -O -J "$BASE_URL/api/rate-limit/report?format=markdown"
echo "已下载: rate-limit-report.md"
echo ""
echo ""

echo "--- 7. 导出 JSON 报告 ---"
echo "报告将下载为 rate-limit-report.json"
curl -s -O -J "$BASE_URL/api/rate-limit/report?format=json"
echo "已下载: rate-limit-report.json"
echo ""
echo ""

echo "--- 8. 查看请求日志 ---"
curl -s "$BASE_URL/api/rate-limit/logs?limit=10" | jq .
echo ""
echo ""

echo "--- 9. 配置管理: 查看所有 App Keys ---"
curl -s "$BASE_URL/api/config/app-keys" | jq .
echo ""
echo ""

echo "--- 10. 配置管理: 查看所有路由 ---"
curl -s "$BASE_URL/api/config/routes" | jq .
echo ""
echo ""

echo "--- 11. 配置管理: 查看所有限流配置 ---"
curl -s "$BASE_URL/api/config/rate-limit-configs" | jq .
echo ""
echo ""

echo "--- 12. 创建新的 App Key ---"
NEW_APP_KEY="ak_new_test_$(date +%s)"
echo "创建新 App Key: $NEW_APP_KEY"
curl -s -X POST "$BASE_URL/api/config/app-keys" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$NEW_APP_KEY\",
    \"name\": \"新测试应用\",
    \"description\": \"通过 API 创建的测试应用\",
    \"isActive\": true
  }" | jq .
echo ""
echo ""

echo "--- 13. 创建新的限流配置 ---"
echo "为新 App Key 创建配置: 固定窗口，10/60s"
curl -s -X POST "$BASE_URL/api/config/rate-limit-configs" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$NEW_APP_KEY\",
    \"path\": \"/api/users\",
    \"method\": \"GET\",
    \"algorithm\": \"fixed-window\",
    \"limit\": 10,
    \"windowSeconds\": 60,
    \"isActive\": true
  }" | jq .
echo ""
echo ""

echo "--- 14. 测试新配置的限流 ---"
echo "发送 15 个请求 (配额 10) 到新配置的路由"
curl -s -X POST "$BASE_URL/api/rate-limit/simulate/concurrent" \
  -H "Content-Type: application/json" \
  -d "{
    \"appKey\": \"$NEW_APP_KEY\",
    \"path\": \"/api/users\",
    \"method\": \"GET\",
    \"requestCount\": 15
  }" | jq .
echo ""
echo ""

echo "--- 15. 清空测试日志 ---"
echo "清空 $TEST_APP_KEY 的日志"
curl -s -X DELETE "$BASE_URL/api/rate-limit/logs?appKey=$TEST_APP_KEY" | jq .
echo ""
echo ""

echo "========================================"
echo "所有示例执行完成！"
echo "========================================"
