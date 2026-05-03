#!/bin/bash

BASE_URL="http://localhost:3000"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🧪 测试场景: 正常撮合接单流程                            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "【步骤 1】检查服务健康状态"
echo "─────────────────────────────────────────"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 2】创建新的请求单 (Alice要带咖啡)"
echo "─────────────────────────────────────────"
REQUEST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_alice",
    "pickup_location": "星巴克",
    "dropoff_location": "2号楼",
    "item_type": "咖啡饮料",
    "weight": 0.5,
    "volume": 1.0,
    "latest_delivery_time": "'"$(date -v+2H +%Y-%m-%dT%H:%M:%S)"'",
    "tip_amount": 8,
    "notes": "热拿铁，少糖"
  }')

REQUEST_ID=$(echo "$REQUEST_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "创建的请求单ID: $REQUEST_ID"
echo "$REQUEST_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 3】创建顺路人Tom的行程"
echo "─────────────────────────────────────────"
TRIP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_tom",
    "start_location": "1号楼",
    "waypoints": ["星巴克", "前台"],
    "destination": "地铁口",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 5,
    "available_capacity_volume": 10,
    "forbidden_items": []
  }')

TRIP_ID=$(echo "$TRIP_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "创建的行程ID: $TRIP_ID"
echo "$TRIP_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 4】为请求单匹配行程 (撮合接口)"
echo "─────────────────────────────────────────"
MATCH_RESPONSE=$(curl -s "$BASE_URL/api/matching/request/$REQUEST_ID")
echo "$MATCH_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 5】计算具体的匹配分数详情"
echo "─────────────────────────────────────────"
SCORE_RESPONSE=$(curl -s "$BASE_URL/api/matching/score?request_id=$REQUEST_ID&trip_id=$TRIP_ID")
echo "$SCORE_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 6】Tom锁定订单 (接单)"
echo "─────────────────────────────────────────"
LOCK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/lock" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"traveler_id\": \"user_tom\"
  }")

ORDER_ID=$(echo "$LOCK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('order', {}).get('id', 'none'))")
echo "创建的订单ID: $ORDER_ID"
echo "$LOCK_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 7】Alice确认订单"
echo "─────────────────────────────────────────"
CONFIRM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/confirm" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"actor_id\": \"user_alice\",
    \"actor_type\": \"requester\"
  }")
echo "$CONFIRM_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 8】Tom标记取到物品"
echo "─────────────────────────────────────────"
PICKUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/pickup" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"traveler_id\": \"user_tom\"
  }")
echo "$PICKUP_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 9】Tom标记送达"
echo "─────────────────────────────────────────"
DELIVER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/deliver" \
  -H "Content-Type: application/json" \
  -d "{
    \"order_id\": \"$ORDER_ID\",
    \"traveler_id\": \"user_tom\"
  }")
echo "$DELIVER_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 10】查看订单最终状态和审计日志"
echo "─────────────────────────────────────────"
STATUS_RESPONSE=$(curl -s "$BASE_URL/api/orders/$ORDER_ID")
echo "$STATUS_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "【步骤 11】导出请求单的Markdown审计日报"
echo "─────────────────────────────────────────"
curl -s "$BASE_URL/api/audit/request/$REQUEST_ID/markdown"
echo ""
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   ✅ 正常流程测试完成！                                    ║"
echo "║                                                            ║"
echo "║   流程回顾:                                                 ║"
echo "║   1. 创建请求单                                            ║"
echo "║   2. 创建行程                                              ║"
echo "║   3. 撮合匹配                                              ║"
echo "║   4. 锁定订单 (接单)                                       ║"
echo "║   5. 发起人确认                                            ║"
echo "║   6. 顺路人取货                                            ║"
echo "║   7. 顺路人送达                                            ║"
echo "║   8. 查看审计日志                                          ║"
echo "║                                                            ║"
echo "║   订单状态流转:                                             ║"
echo "║   pending_matching → locked → both_confirmed →           ║"
echo "║   picked_up → delivered                                   ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
