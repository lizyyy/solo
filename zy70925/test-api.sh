#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "  培训数据校验API - 测试脚本"
echo "========================================"
echo ""

echo "[1/5] 检查服务健康状态..."
curl -s "$BASE_URL/health" | head -c 200
echo ""
echo ""

echo "[2/5] 上传并处理批次数据..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/validation/process" \
  -F "attendanceFile=@samples/attendance.csv" \
  -F "assignmentsFile=@samples/assignments.json" \
  -F "ruleFile=@samples/course-rule.json")

echo "$RESPONSE" | head -c 1500
echo ""
echo ""

BATCH_ID=$(echo "$RESPONSE" | grep -o '"batchId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BATCH_ID" ]; then
  BATCH_ID=$(echo "$RESPONSE" | grep -o '"batchId":"[^"]*"' | tail -1 | cut -d'"' -f4)
fi

echo "[3/5] 获取批次列表..."
curl -s "$BASE_URL/api/validation/batches" | head -c 500
echo ""
echo ""

if [ -n "$BATCH_ID" ]; then
  echo "[4/5] 获取批次 $BATCH_ID 处理结果..."
  curl -s "$BASE_URL/api/validation/result/$BATCH_ID" | head -c 1000
  echo ""
  echo ""
fi

echo "[5/5] 测试重复提交（幂等性验证）..."
curl -s -X POST "$BASE_URL/api/validation/process" \
  -F "attendanceFile=@samples/attendance.csv" \
  -F "assignmentsFile=@samples/assignments.json" \
  -F "ruleFile=@samples/course-rule.json" | head -c 800
echo ""
echo ""

echo "========================================"
echo "  测试完成"
echo "========================================"
