#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"
OPERATOR="test-user"

echo "=== 数据库连接池保护 API 测试脚本 ==="
echo ""

echo "1. 创建保护规则 (订单查询接口)"
CREATE_RULE_RESPONSE=$(curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "订单查询连接池保护",
    "api_path": "/api/order/query",
    "pool_name": "order-db-pool",
    "description": "保护订单查询接口，防止连接池耗尽",
    "thresholds": {
      "max_active_conn": 50,
      "max_wait_time_ms": 3000,
      "slow_query_time_ms": 500,
      "error_rate_threshold": 0.1
    },
    "action": "circuit_break",
    "action_params": {
      "fallback_response": "系统繁忙，请稍后重试"
    },
    "request_id": "req-'$(date +%s)'"
  }')
echo "$CREATE_RULE_RESPONSE"
echo ""
RULE_ID=$(echo "$CREATE_RULE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "规则 ID: $RULE_ID"
echo ""

echo "2. 重复提交相同 RequestID (验证防重机制)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "订单查询连接池保护",
    "api_path": "/api/order/query",
    "pool_name": "order-db-pool",
    "description": "保护订单查询接口，防止连接池耗尽",
    "thresholds": {
      "max_active_conn": 50,
      "max_wait_time_ms": 3000,
      "slow_query_time_ms": 500,
      "error_rate_threshold": 0.1
    },
    "action": "circuit_break",
    "action_params": {
      "fallback_response": "系统繁忙，请稍后重试"
    },
    "request_id": "req-'$(date +%s)'"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('重复提交返回相同规则，验证成功')"
echo ""

echo "3. 创建第二条规则 (支付接口)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "支付接口连接池保护",
    "api_path": "/api/payment/create",
    "pool_name": "payment-db-pool",
    "description": "保护支付接口",
    "thresholds": {
      "max_active_conn": 30,
      "max_wait_time_ms": 2000,
      "slow_query_time_ms": 300,
      "error_rate_threshold": 0.05
    },
    "action": "reject_new_conn",
    "action_params": {},
    "request_id": "req-pay-'$(date +%s)'"
  }'
echo ""

echo "4. 列出所有规则"
curl -s "$BASE_URL/rules"
echo ""

echo "5. 上报连接统计数据（正常情况）"
curl -s -X POST "$BASE_URL/stats/connection" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "'"$RULE_ID"'",
    "api_path": "/api/order/query",
    "pool_name": "order-db-pool",
    "active_conn": 30,
    "idle_conn": 20,
    "wait_count": 5,
    "wait_time_avg_ms": 150
  }'
echo ""

echo "6. 上报慢查询记录"
for i in 1 2 3; do
  curl -s -X POST "$BASE_URL/stats/slow-query" \
    -H "Content-Type: application/json" \
    -d "{
      \"api_path\": \"/api/order/query\",
      \"sql\": \"SELECT * FROM orders WHERE user_id = $i\",
      \"duration_ms\": $((600 + RANDOM % 400)),
      \"trace_id\": \"trace-$(date +%s)-$i\"
    }"
    echo ""
    sleep 0.1
done

echo "7. 上报异常连接统计（触发保护阈值）"
curl -s -X POST "$BASE_URL/stats/connection" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "'"$RULE_ID"'",
    "api_path": "/api/order/query",
    "pool_name": "order-db-pool",
    "active_conn": 80,
    "idle_conn": 5,
    "wait_count": 50,
    "wait_time_avg_ms": 5000
  }'
echo ""

echo "8. 触发保护机制"
curl -s -X POST "$BASE_URL/protection/trigger" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{\"rule_id\": \"$RULE_ID\"}"
echo ""

echo "9. 查看规则状态（应为 triggered）"
curl -s "$BASE_URL/rules/$RULE_ID"
echo ""

echo "10. 查看概览统计"
curl -s "$BASE_URL/stats/overview"
echo ""

echo "11. 确认恢复"
EVENT_ID="event-$(date +%s)"
curl -s -X POST "$BASE_URL/protection/restore" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"rule_id\": \"$RULE_ID\",
    \"event_id\": \"$EVENT_ID\",
    \"reason\": \"已排查问题，连接池恢复正常\",
    \"check_data\": {
      \"active_conn\": 25,
      \"wait_time_ms\": 200,
      \"confirmed_by\": \"dba-team\"
    }
  }"
echo ""

echo "12. 再次查看规则状态（应为 restored）"
curl -s "$BASE_URL/rules/$RULE_ID"
echo ""

echo "13. 查看历史变更记录"
curl -s "$BASE_URL/history?resource_id=$RULE_ID"
echo ""

echo "14. 暂停规则"
curl -s -X PUT "$BASE_URL/rules/$RULE_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "paused"}'
echo ""

echo "15. 导出 CSV 报告 (保存到 report.csv)"
curl -s "$BASE_URL/export" -o report.csv
echo "报告已保存到 report.csv"
cat report.csv
echo ""

echo "=== 测试完成 ==="
echo ""
echo "提示：按 Ctrl+C 停止服务，数据将自动保存到 data.json"
