#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 环境开关防误触服务 API 测试 ==="
echo ""

echo "1. 创建开关项"
curl -s -X POST "$BASE_URL/switch" \
  -H "Content-Type: application/json" \
  -d '{"name": "功能开关A", "description": "控制新功能A的开关", "category": "feature"}' | jq .
echo ""

echo "2. 创建审批票 - 幂等性测试（第一次）"
TICKET1=$(curl -s -X POST "$BASE_URL/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "test_key_001",
    "switch_id": "SW001",
    "environment": "test",
    "risk_level": "low",
    "operator_id": "op001",
    "operator_name": "张三",
    "operator_email": "zhangsan@example.com",
    "change_type": "enable",
    "target_value": true,
    "reason": "功能上线测试"
  }')
echo "$TICKET1" | jq .
TICKET_ID=$(echo "$TICKET1" | jq -r '.data.id')
echo "审批票ID: $TICKET_ID"
echo ""

echo "3. 重复创建审批票 - 验证幂等性（应该返回相同结果）"
curl -s -X POST "$BASE_URL/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "test_key_001",
    "switch_id": "SW001",
    "environment": "test",
    "risk_level": "low",
    "operator_id": "op001",
    "operator_name": "张三",
    "operator_email": "zhangsan@example.com",
    "change_type": "enable",
    "target_value": true,
    "reason": "功能上线测试"
  }' | jq .
echo ""

echo "4. 校验审批票"
curl -s -X POST "$BASE_URL/ticket/validate" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\": \"$TICKET_ID\"}" | jq .
echo ""

echo "5. 审批审批票"
curl -s -X POST "$BASE_URL/ticket/approve" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\": \"$TICKET_ID\", \"approver_id\": \"admin001\"}" | jq .
echo ""

echo "6. 执行审批票"
RESULT=$(curl -s -X POST "$BASE_URL/ticket/execute" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\": \"$TICKET_ID\"}")
echo "$RESULT" | jq .
RESULT_ID=$(echo "$RESULT" | jq -r '.data.id')
echo ""

echo "7. 重复执行 - 验证幂等性（应该返回相同结果）"
curl -s -X POST "$BASE_URL/ticket/execute" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\": \"$TICKET_ID\"}" | jq .
echo ""

echo "8. 查询审批票详情"
curl -s -X GET "$BASE_URL/ticket?id=$TICKET_ID" | jq .
echo ""

echo "9. 查询变更结果"
curl -s -X GET "$BASE_URL/result?id=$RESULT_ID" | jq .
echo ""

echo "10. 测试风险拦截 - 生产环境high风险应该被拒绝"
TICKET2=$(curl -s -X POST "$BASE_URL/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "test_key_002",
    "switch_id": "SW001",
    "environment": "prod",
    "risk_level": "high",
    "operator_id": "op001",
    "operator_name": "张三",
    "operator_email": "zhangsan@example.com",
    "change_type": "enable",
    "target_value": true,
    "reason": "生产环境高风险操作"
  }')
echo "$TICKET2" | jq .
TICKET_ID2=$(echo "$TICKET2" | jq -r '.data.id')
echo ""

echo "11. 校验高风险审批票 - 应该被拦截"
curl -s -X POST "$BASE_URL/ticket/validate" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\": \"$TICKET_ID2\"}" | jq .
echo ""

echo "12. 查询历史记录列表"
curl -s -X GET "$BASE_URL/tickets?page=1&page_size=10" | jq .
echo ""

echo "13. 导出历史记录"
curl -s -X GET "$BASE_URL/export" | jq .
echo ""

echo "=== 测试完成 ==="
