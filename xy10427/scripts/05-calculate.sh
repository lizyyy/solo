#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 执行餐补计算 ==="
echo "计算周期: 2025-01-15 至 2025-01-16"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2025-01-15",
    "periodEnd": "2025-01-16",
    "ruleId": "RULE_2025"
  }')

echo "$RESPONSE"

BATCH_ID=$(echo "$RESPONSE" | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)

echo ""
echo ""
echo "=== 保存 batchId 到文件 ==="
echo "$BATCH_ID" > /tmp/meal_subsidy_batch_id.txt
echo "Batch ID: $BATCH_ID"
echo ""

echo "=== 查询异常明细 ==="
curl -s "$BASE_URL/api/abnormals/$BATCH_ID" | python3 -m json.tool

echo ""
echo ""
