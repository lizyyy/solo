#!/bin/bash

echo "========================================"
echo "家电安装 API 演示"
echo "========================================"
echo ""

BASE_URL="http://localhost:3001"

echo "1. 查看师傅列表"
echo "-----------------"
curl -s "$BASE_URL/api/technicians" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/technicians"
echo ""

echo "2. 查看配件库存"
echo "-----------------"
curl -s "$BASE_URL/api/parts" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/parts"
echo ""

echo "3. 创建订单"
echo "-----------------"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: customer_service" \
  -d '{
    "customerId": "DEMO001",
    "customerName": "演示客户",
    "customerPhone": "13900139000",
    "address": "北京市朝阳区演示小区1号楼",
    "applianceType": "空调",
    "applianceModel": "演示型号",
    "partCodes": ["AIRCON-BRACKET", "AIRCON-PIPE"]
  }')
echo "$ORDER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ORDER_RESPONSE"

ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo ""

if [ -n "$ORDER_ID" ]; then
  echo "4. 分配师傅 (获取第一个可用师傅)"
  echo "-----------------"
  TECHS=$(curl -s "$BASE_URL/api/technicians")
  TECH_ID=$(echo "$TECHS" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  
  START_TIME=$(date -u -v+2d "+%Y-%m-%dT09:00:00.000Z" 2>/dev/null || date -u -d "+2 days" "+%Y-%m-%dT09:00:00.000Z")
  END_TIME=$(date -u -v+2d "+%Y-%m-%dT11:00:00.000Z" 2>/dev/null || date -u -d "+2 days" "+%Y-%m-%dT11:00:00.000Z")
  
  echo "师傅ID: $TECH_ID"
  echo "预约时间: $START_TIME - $END_TIME"
  echo ""
  
  ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/assign-technician" \
    -H "Content-Type: application/json" \
    -H "X-Operator: scheduler" \
    -d "{
      \"technicianId\": \"$TECH_ID\",
      \"startTime\": \"$START_TIME\",
      \"endTime\": \"$END_TIME\"
    }")
  echo "$ASSIGN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSIGN_RESPONSE"
  echo ""

  echo "5. 分配配件"
  echo "-----------------"
  PARTS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/allocate-parts" \
    -H "Content-Type: application/json" \
    -H "X-Operator: system")
  echo "$PARTS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PARTS_RESPONSE"
  echo ""

  echo "6. 发送预约确认"
  echo "-----------------"
  CONFIRM_SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/send-confirmation" \
    -H "Content-Type: application/json" \
    -H "X-Operator: system")
  echo "$CONFIRM_SEND_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_SEND_RESPONSE"
  
  CONFIRM_ID=$(echo "$CONFIRM_SEND_RESPONSE" | grep -o '"id":"[^"]*' | grep -v "$ORDER_ID" | head -1 | cut -d'"' -f4)
  echo ""

  if [ -n "$CONFIRM_ID" ]; then
    echo "7. 客户确认预约"
    echo "-----------------"
    CONFIRM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/confirm" \
      -H "Content-Type: application/json" \
      -H "X-Operator: customer" \
      -d "{\"confirmationId\": \"$CONFIRM_ID\"}")
    echo "$CONFIRM_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_RESPONSE"
    echo ""
  fi

  echo "8. 查看订单详情 (含事件时间线)"
  echo "-----------------"
  curl -s "$BASE_URL/api/orders/$ORDER_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/$ORDER_ID"
  echo ""

  echo "9. 查看配件库存变化"
  echo "-----------------"
  curl -s "$BASE_URL/api/parts" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/parts"
  echo ""

  echo "10. 生成订单报告 (文本格式)"
  echo "-----------------"
  curl -s "$BASE_URL/api/orders/$ORDER_ID/report?format=text"
  echo ""
fi

echo "========================================"
echo "演示完成！"
echo "========================================"
