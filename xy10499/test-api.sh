#!/bin/bash

BASE_URL="http://localhost:3003"

echo "======================================"
echo "门店试吃转化 API 测试"
echo "======================================"
echo ""

echo "1. 创建活动"
echo "------------------------"
ACTIVITY=$(curl -s -X POST $BASE_URL/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "周末特惠试吃周",
    "store_name": "零食工坊旗舰店",
    "start_time": "2026-05-10T00:00:00.000Z",
    "end_time": "2026-05-20T23:59:59.000Z",
    "attribution_window_hours": 24
  }')

ACTIVITY_ID=$(echo "$ACTIVITY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "活动 ID: $ACTIVITY_ID"
echo "$ACTIVITY" | python3 -m json.tool
echo ""

echo "2. 登记库存（10 份夏威夷果，每份 2.5 元）"
echo "------------------------"
INVENTORY=$(curl -s -X POST $BASE_URL/api/inventory \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"product_name\": \"进口夏威夷果\",
    \"unit_cost\": 2.5,
    \"quantity\": 10
  }")
echo "$INVENTORY" | python3 -m json.tool
echo ""

echo "======================================"
echo "场景 1: 正常发放并转化"
echo "======================================"
echo ""
echo "顾客 C001 试吃："
curl -s -X POST $BASE_URL/api/distributions \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C001\",
    \"product_name\": \"进口夏威夷果\",
    \"quantity\": 1
  }" | python3 -m json.tool

echo ""
echo "顾客 C001 关联购买小票 R001："
PURCHASE_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST $BASE_URL/api/purchases \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C001\",
    \"receipt_id\": \"R001\",
    \"purchase_amount\": 89.9,
    \"purchased_at\": \"$PURCHASE_TIME\"
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 2: 无转化"
echo "======================================"
echo ""
echo "顾客 C002 试吃但不购买："
curl -s -X POST $BASE_URL/api/distributions \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C002\",
    \"product_name\": \"进口夏威夷果\",
    \"quantity\": 1
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 3: 库存不足"
echo "======================================"
echo ""
echo "先发放剩余的 8 份（C003-C010）..."
for i in 3 4 5 6 7 8 9 10; do
  CUST_ID=$(printf "C%03d" $i)
  curl -s -X POST $BASE_URL/api/distributions \
    -H "Content-Type: application/json" \
    -d "{\"activity_id\":\"$ACTIVITY_ID\",\"customer_id\":\"$CUST_ID\",\"product_name\":\"进口夏威夷果\",\"quantity\":1}" > /dev/null
done

echo ""
echo "现在库存为 0，C011 尝试领取："
curl -s -X POST $BASE_URL/api/distributions \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C011\",
    \"product_name\": \"进口夏威夷果\",
    \"quantity\": 1
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 4: 浪费数量超过剩余（应失败）"
echo "======================================"
echo ""
echo "登记 2 份浪费（库存为 0，应该失败）："
curl -s -X POST $BASE_URL/api/waste \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"product_name\": \"进口夏威夷果\",
    \"quantity\": 2,
    \"reason\": \"过期变质\"
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 5: 同一顾客重复领取（应失败）"
echo "======================================"
echo ""
echo "C001 再次尝试领取："
curl -s -X POST $BASE_URL/api/distributions \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C001\",
    \"product_name\": \"进口夏威夷果\",
    \"quantity\": 1
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 6: 购买时间超出归因窗口（应失败）"
echo "======================================"
echo ""
echo "C002 购买但时间是 30 小时后（窗口 24 小时）："
curl -s -X POST $BASE_URL/api/purchases \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"$ACTIVITY_ID\",
    \"customer_id\": \"C002\",
    \"receipt_id\": \"R002\",
    \"purchase_amount\": 129.9,
    \"purchased_at\": \"2026-05-25T00:00:00Z\"
  }" | python3 -m json.tool

echo ""
echo "======================================"
echo "场景 7: 活动复盘"
echo "======================================"
echo ""
curl -s -X GET "$BASE_URL/api/activities/$ACTIVITY_ID/review" | python3 -m json.tool
