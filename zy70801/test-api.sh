#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 检验科危急值整合系统 API 测试 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | head -5
echo ""
echo ""

echo "2. 上传值班表"
curl -s -X POST -F "file=@examples/duty-schedule.csv" "$BASE_URL/upload/duty" | head -20
echo ""
echo ""

echo "3. 上传回告记录"
curl -s -X POST -F "file=@examples/callbacks.json" "$BASE_URL/upload/callback" | head -20
echo ""
echo ""

echo "4. 上传危急值记录 (第一次)"
RESULT=$(curl -s -X POST -F "file=@examples/critical-values.csv" "$BASE_URL/upload/critical-value")
echo "$RESULT"
echo ""
echo ""

echo "5. 上传危急值记录 (第二次 - 应该提示重复)"
curl -s -X POST -F "file=@examples/critical-values.csv" "$BASE_URL/upload/critical-value"
echo ""
echo ""

NORMAL_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -3 | tail -1 | cut -d'"' -f4)
echo "6. 创建单条医生确认记录 (针对正常项: $NORMAL_ID)"
curl -s -X POST -H "Content-Type: application/json" -d "{
  \"criticalValueId\": \"$NORMAL_ID\",
  \"confirmer\": \"张主任\",
  \"confirmerPhone\": \"13700137001\",
  \"confirmResult\": \"confirmed\",
  \"confirmNote\": \"已复核，情况属实，已通知临床科室\"
}" "$BASE_URL/confirm"
echo ""
echo ""

echo "7. 值班主任复核追溯 (查看确认记录是否存在)"
curl -s "$BASE_URL/critical-values/$NORMAL_ID/review"
echo ""
echo ""

echo "8. 获取批次列表"
curl -s "$BASE_URL/batches?limit=5"
echo ""
echo ""

echo "9. 获取统计数据"
curl -s "$BASE_URL/statistics"
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "提示: 可使用以下命令单独查询复核追溯:"
echo "curl $BASE_URL/critical-values/$NORMAL_ID/review"
