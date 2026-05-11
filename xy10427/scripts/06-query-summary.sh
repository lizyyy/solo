#!/bin/bash

BASE_URL="http://localhost:3000"
BATCH_ID=$(cat /tmp/meal_subsidy_batch_id.txt 2>/dev/null || echo "")

if [ -z "$BATCH_ID" ]; then
  echo "请先执行 05-calculate.sh"
  exit 1
fi

echo "=== 按部门查询汇总（含应发、暂缓、异常原因）==="
echo "Batch ID: $BATCH_ID"
echo ""

curl -s "$BASE_URL/api/summary/$BATCH_ID" | python3 -m json.tool

echo ""
echo ""
