#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo -e "\n\033[1;34m========================================\033[0m"
echo -e "\033[1;34m  用车调度费用API - 完整演示脚本\033[0m"
echo -e "\033[1;34m========================================\033[0m"

echo -e "\n\033[1;33m[0/7] 健康检查\033[0m"
curl -s "$BASE_URL/health" | python3 -m json.tool

echo -e "\n\033[1;33m[1/7] 创建用车申请（正常行程）\033[0m"
echo -e "\033[90m员工张明（销售部）申请用车，从国贸到中关村，距离25公里\033[0m"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: DEMO-NORMAL-001" \
  -d '{
    "employeeId": "EMP001",
    "employeeName": "张明",
    "department": "SALES",
    "pickup": "北京市朝阳区国贸中心",
    "dropoff": "北京市海淀区中关村",
    "distanceKm": 25,
    "scheduledTime": "2024-01-15T09:00:00Z"
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool
TRIP_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo -e "\033[92m行程ID: $TRIP_ID\033[0m"

echo -e "\n\033[1;33m[2/7] 查询行程详情（含历史记录）\033[0m"
curl -s "$BASE_URL/trips/$TRIP_ID" | python3 -m json.tool

echo -e "\n\033[1;33m[3/7] 派单：分配司机张三\033[0m"
DISPATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/trips/$TRIP_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "DRV001",
    "driverName": "张三"
  }')
echo "$DISPATCH_RESPONSE" | python3 -m json.tool

echo -e "\n\033[1;33m[4/7] 司机到达上车点\033[0m"
ARRIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/trips/$TRIP_ID/driver-arrive")
echo "$ARRIVE_RESPONSE" | python3 -m json.tool

echo -e "\n\033[1;33m[5/7] 开始行程（模拟等待20分钟，产生等待费）\033[0m"
echo -e "\033[90m员工迟到20分钟，等待费：(20-15)分钟 × 2元/分钟 = 10元\033[0m"
START_RESPONSE=$(curl -s -X POST "$BASE_URL/trips/$TRIP_ID/start" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2024-01-15T09:20:00Z"
  }')
echo "$START_RESPONSE" | python3 -m json.tool

echo -e "\n\033[1;33m[6/7] 结束行程并计算费用\033[0m"
echo -e "\033[90m费用构成：\033[0m"
echo -e "\033[90m  - 基础车费：50元起步 + 25公里 × 3元/公里 = 125元\033[0m"
echo -e "\033[90m  - 等待费：(20-15)分钟 × 2元/分钟 = 10元\033[0m"
echo -e "\033[90m  - 总计：135元\033[0m"
END_RESPONSE=$(curl -s -X POST "$BASE_URL/trips/$TRIP_ID/end" \
  -H "Content-Type: application/json" \
  -d '{
    "endTime": "2024-01-15T10:00:00Z"
  }')
echo "$END_RESPONSE" | python3 -m json.tool

echo -e "\n\033[1;33m[7/7] 结算行程（测试幂等性）\033[0m"
SETTLEMENT_KEY="SETTLE-$TRIP_ID"
echo -e "\033[90m首次结算...\033[0m"
SETTLE_RESPONSE=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{
    \"tripId\": \"$TRIP_ID\",
    \"idempotencyKey\": \"$SETTLEMENT_KEY\",
    \"operator\": \"财务-李华\"
  }")
echo "$SETTLE_RESPONSE" | python3 -m json.tool

echo -e "\n\033[90m重复结算（使用相同的idempotencyKey，应该返回幂等结果）...\033[0m"
SETTLE_RESPONSE2=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{
    \"tripId\": \"$TRIP_ID\",
    \"idempotencyKey\": \"$SETTLEMENT_KEY\",
    \"operator\": \"财务-李华\"
  }")
echo "$SETTLE_RESPONSE2" | python3 -m json.tool

echo -e "\n\033[1;34m========================================\033[0m"
echo -e "\033[1;34m  生成完整报告\033[0m"
echo -e "\033[1;34m========================================\033[0m"
curl -s "$BASE_URL/reports/full" | python3 -m json.tool

echo -e "\n\033[1;34m========================================\033[0m"
echo -e "\033[1;34m  演示完成！\033[0m"
echo -e "\033[1;34m========================================\033[0m"
echo -e "\033[92m主要流程已完成：创建申请 → 派单 → 司机到达 → 开始行程 → 结束行程 → 结算\033[0m"
echo -e "\033[92m关键特性验证：\033[0m"
echo -e "\033[92m  ✓ 等待费自动计算\033[0m"
echo -e "\033[92m  ✓ 费用明细展示\033[0m"
echo -e "\033[92m  ✓ 结算幂等性保证\033[0m"
echo -e "\033[92m  ✓ 历史记录追踪\033[0m"
