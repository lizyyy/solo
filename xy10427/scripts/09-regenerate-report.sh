#!/bin/bash

BASE_URL="http://localhost:3000"
BATCH_ID=$(cat /tmp/meal_subsidy_batch_id.txt 2>/dev/null || echo "")

if [ -z "$BATCH_ID" ]; then
  echo "请先执行 05-calculate.sh"
  exit 1
fi

echo "=== 重新生成发放报表（复核后）==="
echo "Batch ID: $BATCH_ID"
echo ""

curl -X POST "$BASE_URL/api/regenerate-report/$BATCH_ID" \
  -H "Content-Type: application/json"

echo ""
echo ""

echo "=== 查询发放报表 ==="
curl -s "$BASE_URL/api/payout-report/$BATCH_ID" | python3 -m json.tool

echo ""
echo ""
