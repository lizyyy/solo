#!/bin/bash

BASE_URL="http://localhost:3000/api"
HEADER1="x-operator: 系统管理员"
HEADER2="x-operator-role: admin"

echo "=== 社区食堂配餐系统 API 测试 ==="
echo ""

echo "1. 获取老人列表"
curl -s -H "$HEADER1" -H "$HEADER2" "$BASE_URL/elders" | head -c 500
echo ""
echo ""

echo "2. 获取餐食列表"
curl -s -H "$HEADER1" -H "$HEADER2" "$BASE_URL/meals" | head -c 500
echo ""
echo ""

echo "3. 检查配餐冲突 (张大爷 + 海鲜套餐)"
echo "应该被拦截：糖尿病禁忌 + 海鲜花生过敏"
curl -s -H "$HEADER1" -H "$HEADER2" -G "$BASE_URL/assignments/check-conflict" \
  --data-urlencode "elderId=..." --data-urlencode "mealId=..." 2>/dev/null || echo "请先运行 seed-data.ts 获取实际的ID"
echo ""
echo ""

echo "4. 获取配餐列表"
curl -s -H "$HEADER1" -H "$HEADER2" "$BASE_URL/assignments" | head -c 1000
echo ""
echo ""

echo "5. 获取审计日志"
curl -s -H "$HEADER1" -H "$HEADER2" "$BASE_URL/audit-logs" | head -c 500
echo ""
echo ""

echo "6. 获取报告汇总"
curl -s -H "$HEADER1" -H "$HEADER2" -X POST "$BASE_URL/report/summary" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""
echo ""

echo "测试完成！"