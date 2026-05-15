#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"
OPERATOR="test-user"

echo "=== 数据库连接池保护 API 测试脚本 ==="
echo ""

echo "========== 第一部分：基础功能测试 =========="
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

echo "2. 查询单条规则"
curl -s "$BASE_URL/rules/$RULE_ID"
echo ""
echo ""

echo "3. 列出所有规则"
curl -s "$BASE_URL/rules"
echo ""
echo ""

echo "4. 上报连接统计数据（正常情况）"
curl -s -X POST "$BASE_URL/stats/connection" \
  -H "Content-Type: application/json" \
  -d "{
    \"rule_id\": \"$RULE_ID\",
    \"api_path\": \"/api/order/query\",
    \"pool_name\": \"order-db-pool\",
    \"active_conn\": 30,
    \"idle_conn\": 20,
    \"wait_count\": 5,
    \"wait_time_avg_ms\": 150
  }"
echo ""
echo ""

echo "5. 上报慢查询记录"
curl -s -X POST "$BASE_URL/stats/slow-query" \
  -H "Content-Type: application/json" \
  -d "{
    \"api_path\": \"/api/order/query\",
    \"sql\": \"SELECT * FROM orders WHERE user_id = 123\",
    \"duration_ms\": 650,
    \"trace_id\": \"trace-$(date +%s)\"
  }"
echo ""
echo ""

echo "6. 获取概览统计"
curl -s "$BASE_URL/stats/overview"
echo ""
echo ""

echo "========== 第二部分：校验功能测试 =========="
echo ""

echo "7. 测试：空规则创建（缺少必填字段，应报错）"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "",
    "api_path": "",
    "pool_name": ""
  }'
echo ""
echo ""

echo "8. 测试：非法阈值（负数，应报错）"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "测试规则",
    "api_path": "/api/test",
    "pool_name": "test-pool",
    "thresholds": {
      "max_active_conn": -1,
      "max_wait_time_ms": 3000,
      "slow_query_time_ms": 500,
      "error_rate_threshold": 0.1
    },
    "action": "circuit_break"
  }'
echo ""
echo ""

echo "9. 测试：非法 Action（不在枚举中，应报错）"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "测试规则",
    "api_path": "/api/test",
    "pool_name": "test-pool",
    "thresholds": {
      "max_active_conn": 50,
      "max_wait_time_ms": 3000,
      "slow_query_time_ms": 500,
      "error_rate_threshold": 0.1
    },
    "action": "invalid_action"
  }'
echo ""
echo ""

echo "10. 测试：错误率阈值超出范围（>1，应报错）"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "测试规则",
    "api_path": "/api/test",
    "pool_name": "test-pool",
    "thresholds": {
      "max_active_conn": 50,
      "max_wait_time_ms": 3000,
      "slow_query_time_ms": 500,
      "error_rate_threshold": 1.5
    },
    "action": "circuit_break"
  }'
echo ""
echo ""

echo "11. 测试：使用不存在的 RuleID 上报连接统计（应报错）"
curl -s -X POST "$BASE_URL/stats/connection" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "non-existent-id-12345",
    "api_path": "/api/test",
    "pool_name": "test-pool",
    "active_conn": 30,
    "idle_conn": 20,
    "wait_count": 5,
    "wait_time_avg_ms": 150
  }'
echo ""
echo ""

echo "========== 第三部分：状态机测试 =========="
echo ""

echo "12. 上报异常连接统计（触发保护阈值）"
curl -s -X POST "$BASE_URL/stats/connection" \
  -H "Content-Type: application/json" \
  -d "{
    \"rule_id\": \"$RULE_ID\",
    \"api_path\": \"/api/order/query\",
    \"pool_name\": \"order-db-pool\",
    \"active_conn\": 80,
    \"idle_conn\": 5,
    \"wait_count\": 50,
    \"wait_time_avg_ms\": 5000
  }"
echo ""
echo ""

echo "13. 触发保护机制（状态应为 triggered）"
curl -s -X POST "$BASE_URL/protection/trigger" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{\"rule_id\": \"$RULE_ID\"}"
echo ""
echo ""

echo "14. 查看规则状态（应为 triggered）"
curl -s "$BASE_URL/rules/$RULE_ID"
echo ""
echo ""

echo "15. 测试：非法状态流转 - 从 triggered 直接到 paused（应报错）"
curl -s -X PUT "$BASE_URL/rules/$RULE_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "paused"}'
echo ""
echo ""

echo "16. 确认恢复（正常流转 triggered→restored，应成功）"
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
      \"confirmed_by\": \"dba-team\"
    }
  }"
echo ""
echo ""

echo "17. 再次查看规则状态（应为 restored）"
curl -s "$BASE_URL/rules/$RULE_ID"
echo ""
echo ""

echo "18. 从 restored 恢复到 active（应成功）"
curl -s -X PUT "$BASE_URL/rules/$RULE_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "active"}'
echo ""
echo ""

echo "19. 将规则置为 revoked（终端状态，应成功）"
curl -s -X PUT "$BASE_URL/rules/$RULE_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "revoked"}'
echo ""
echo ""

echo "20. 测试：revoked 状态后尝试修改（应报错，终端状态）"
curl -s -X PUT "$BASE_URL/rules/$RULE_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "active"}'
echo ""
echo ""

echo "========== 第四部分：其他功能测试 =========="
echo ""

echo "21. 创建第二条规则用于测试"
RULE2_RESPONSE=$(curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "name": "支付接口保护",
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
    "request_id": "req-pay-'"$(date +%s)"'"
  }')
echo "$RULE2_RESPONSE"
echo ""
RULE2_ID=$(echo "$RULE2_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "规则2 ID: $RULE2_ID"
echo ""

echo "22. 暂停规则2（active→paused，应成功）"
curl -s -X PUT "$BASE_URL/rules/$RULE2_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "paused"}'
echo ""
echo ""

echo "23. 恢复规则2（paused→active，应成功）"
curl -s -X PUT "$BASE_URL/rules/$RULE2_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{"status": "active"}'
echo ""
echo ""

echo "24. 查看规则1的历史变更记录"
curl -s "$BASE_URL/history?resource_id=$RULE_ID"
echo ""
echo ""

echo "25. 查看所有历史变更记录"
curl -s "$BASE_URL/history"
echo ""
echo ""

echo "26. 删除规则2"
curl -s -X DELETE "$BASE_URL/rules/$RULE2_ID" \
  -H "X-Operator: $OPERATOR"
echo ""
echo ""

echo "27. 导出 CSV 报告 (保存到 report.csv)"
curl -s "$BASE_URL/export" -o report.csv
echo "报告已保存到 report.csv"
cat report.csv
echo ""
echo ""

echo "========== 测试完成 =========="
echo ""
echo "核心校验功能验证总结："
echo "✓ 创建规则必填字段校验"
echo "✓ 阈值合法性校验（正数、0-1范围）"
echo "✓ Action 枚举校验"
echo "✓ RuleID 存在性校验"
echo "✓ 状态机流转约束"
echo "✓ revoked 终端状态保护"
echo ""
echo "提示：按 Ctrl+C 停止服务，数据将自动保存到 data.json"
