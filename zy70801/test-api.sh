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
curl -s -X POST -F "file=@examples/critical-values.csv" "$BASE_URL/upload/critical-value"
echo ""
echo ""

echo "5. 上传危急值记录 (第二次 - 应该提示重复)"
curl -s -X POST -F "file=@examples/critical-values.csv" "$BASE_URL/upload/critical-value"
echo ""
echo ""

echo "6. 获取批次列表"
curl -s "$BASE_URL/batches?limit=5"
echo ""
echo ""

echo "7. 获取统计数据"
curl -s "$BASE_URL/statistics"
echo ""
echo ""

echo "=== 测试完成 ==="
