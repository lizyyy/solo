#!/bin/bash

BASE_URL="http://localhost:8080/api/recalculate"

echo "=== 业务事件重算 API 测试脚本 ==="
echo ""

IDEMPOTENCY_KEY="test-$(date +%Y%m%d%H%M%S)"

echo "1. 创建重算批次 (幂等性测试)"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchName": "Q1交易数据重算",
    "description": "针对2024年Q1的所有交易数据进行重新计算",
    "idempotencyKey": "'"$IDEMPOTENCY_KEY"'",
    "eventScope": {
      "scopeType": "TIME_RANGE",
      "startTime": "2024-01-01T00:00:00",
      "endTime": "2024-03-31T23:59:59",
      "eventTypes": ["TRADE", "REFUND", "TRANSFER"],
      "filterExpression": "status = 'SUCCESS'"
    },
    "ruleIds": [1, 2],
    "operator": "test_user"
  }')

echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

BATCH_NO=$(echo "$CREATE_RESPONSE" | grep -o '"batchNo":"[^"]*"' | cut -d'"' -f4)
echo "批次号: $BATCH_NO"
echo ""

echo "2. 重复提交测试 (相同幂等键)"
echo "--- 再次提交相同请求，应该返回已存在的批次 ---"
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchName": "Q1交易数据重算",
    "idempotencyKey": "'"$IDEMPOTENCY_KEY"'",
    "eventScope": {
      "scopeType": "TIME_RANGE",
      "startTime": "2024-01-01T00:00:00",
      "endTime": "2024-03-31T23:59:59"
    },
    "operator": "test_user"
  }' | python3 -m json.tool 2>/dev/null || echo "解析失败"
echo ""

if [ -n "$BATCH_NO" ]; then
  echo "3. 查询批次详情"
  curl -s -X GET "$BASE_URL/batches/$BATCH_NO" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "4. 执行校验"
  curl -s -X POST "$BASE_URL/batches/$BATCH_NO/validate?operator=test_user" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "5. 开始沙箱重算"
  curl -s -X POST "$BASE_URL/batches/$BATCH_NO/recalculate?operator=test_user" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "6. 对比结果"
  curl -s -X POST "$BASE_URL/batches/$BATCH_NO/compare?operator=test_user" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "7. 发布结果"
  curl -s -X POST "$BASE_URL/batches/$BATCH_NO/publish?approved=true&reason=对比结果符合预期&operator=test_user" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "8. 查看状态历史"
  curl -s -X GET "$BASE_URL/batches/$BATCH_NO/history" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "9. 导出结果"
  curl -s -X GET "$BASE_URL/batches/$BATCH_NO/export" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "10. 撤销发布"
  curl -s -X POST "$BASE_URL/batches/$BATCH_NO/revoke?reason=发现数据异常&operator=admin" | python3 -m json.tool 2>/dev/null
  echo ""

  echo "11. 查看最终状态"
  curl -s -X GET "$BASE_URL/batches/$BATCH_NO" | python3 -m json.tool 2>/dev/null
  echo ""

else
  echo "无法获取批次号，跳过后续测试"
fi

echo "=== 测试完成 ==="
