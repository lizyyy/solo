#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=========================================="
echo "  母婴门店积分计算 API 测试脚本"
echo "=========================================="
echo ""

echo "1. 健康检查..."
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. 导入会员数据..."
curl -s -X POST "$BASE_URL/api/upload/members" \
  -F "file=@members.json;type=application/json" | python3 -m json.tool
echo ""

echo "3. 导入活动规则..."
curl -s -X POST "$BASE_URL/api/upload/rules" \
  -F "file=@rules.json;type=application/json" | python3 -m json.tool
echo ""

echo "4. 上传小票CSV并计算积分（第一次）..."
RESULT=$(curl -s -X POST "$BASE_URL/api/upload/receipts" \
  -F "file=@receipts.csv;type=text/csv")
echo "$RESULT" | python3 -m json.tool
echo ""

BATCH_ID=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('batchId', ''))")

echo "5. 再次上传相同CSV（测试幂等性，应该提示重复）..."
curl -s -X POST "$BASE_URL/api/upload/receipts" \
  -F "file=@receipts.csv;type=text/csv" | python3 -m json.tool
echo ""

if [ -n "$BATCH_ID" ]; then
  echo "6. 查询批次报告: $BATCH_ID"
  curl -s "$BASE_URL/api/batch/$BATCH_ID" | python3 -m json.tool
  echo ""

  echo "7. 提取一条成功记录的traceId进行追溯查询..."
  TRACE_ID=$(echo "$RESULT" | python3 -c "import sys, json; data=json.load(sys.stdin); items=data.get('report',{}).get('items',{}).get('success',[]); print(items[0]['traceId'] if items else '')")
  
  if [ -n "$TRACE_ID" ]; then
    echo "   追溯ID: $TRACE_ID"
    curl -s "$BASE_URL/api/trace/$TRACE_ID" | python3 -m json.tool
    echo ""
  fi

  echo "8. 查询某会员的积分记录..."
  curl -s "$BASE_URL/api/member/13800138001" | python3 -m json.tool
  echo ""
fi

echo "9. 查看所有活动规则..."
curl -s "$BASE_URL/api/rules" | python3 -m json.tool
echo ""

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
