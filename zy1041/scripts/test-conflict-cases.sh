#!/bin/bash

BASE_URL="http://localhost:3000"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🧪 测试场景: 冲突/禁带品/超时/重复请求                  ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "【场景 1】禁带品过滤测试"
echo "─────────────────────────────────────────"
echo ""
echo "创建请求单: 生鲜水果 (将被禁带生鲜的行程过滤)"
REQUEST1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_charlie",
    "pickup_location": "便利店",
    "dropoff_location": "3号楼",
    "item_type": "生鲜水果",
    "weight": 3.0,
    "volume": 5.0,
    "latest_delivery_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "tip_amount": 15
  }')
REQUEST1_ID=$(echo "$REQUEST1_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "请求单ID: $REQUEST1_ID"
echo ""

echo "创建行程1 (禁带品: 生鲜, 易碎) - Jerry"
TRIP1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_jerry",
    "start_location": "2号楼",
    "waypoints": ["便利店", "快递柜"],
    "destination": "3号楼",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 10,
    "available_capacity_volume": 20,
    "forbidden_items": ["生鲜", "易碎"]
  }')
TRIP1_ID=$(echo "$TRIP1_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "行程1 ID: $TRIP1_ID (禁带生鲜)"
echo ""

echo "创建行程2 (无禁带品) - Sam"
TRIP2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_sam",
    "start_location": "便利店",
    "waypoints": ["2号楼"],
    "destination": "3号楼",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 20,
    "available_capacity_volume": 40,
    "forbidden_items": []
  }')
TRIP2_ID=$(echo "$TRIP2_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "行程2 ID: $TRIP2_ID (无禁带品)"
echo ""

echo "匹配结果 (应该看到: Jerry的行程因禁带品被过滤，Sam的行程匹配成功)"
echo "─────────────────────────────────────────"
MATCH_RESULT=$(curl -s "$BASE_URL/api/matching/request/$REQUEST1_ID")
echo "$MATCH_RESULT" | python3 -m json.tool
echo ""
echo ""

echo "【场景 2】容量限制测试"
echo "─────────────────────────────────────────"
echo ""
echo "创建请求单: 大件包裹 (15kg, 30L)"
REQUEST2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_david",
    "pickup_location": "快递柜",
    "dropoff_location": "停车场",
    "item_type": "大件包裹",
    "weight": 15.0,
    "volume": 30.0,
    "latest_delivery_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "tip_amount": 25
  }')
REQUEST2_ID=$(echo "$REQUEST2_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "请求单ID: $REQUEST2_ID (15kg, 30L)"
echo ""

echo "创建小容量行程 (只能带5kg) - Tom"
TRIP3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_tom_2",
    "start_location": "快递柜",
    "waypoints": [],
    "destination": "停车场",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 5,
    "available_capacity_volume": 10,
    "forbidden_items": []
  }')
TRIP3_ID=$(echo "$TRIP3_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "小容量行程ID: $TRIP3_ID (5kg, 10L) - 应该被过滤"
echo ""

echo "创建大容量行程 (能带20kg) - Sam2"
TRIP4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_sam_2",
    "start_location": "快递柜",
    "waypoints": [],
    "destination": "停车场",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 20,
    "available_capacity_volume": 40,
    "forbidden_items": []
  }')
TRIP4_ID=$(echo "$TRIP4_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "大容量行程ID: $TRIP4_ID (20kg, 40L) - 应该匹配成功"
echo ""

echo "匹配结果 (应该看到: Tom的行程因容量被过滤，Sam的行程匹配成功)"
echo "─────────────────────────────────────────"
MATCH_RESULT2=$(curl -s "$BASE_URL/api/matching/request/$REQUEST2_ID")
echo "$MATCH_RESULT2" | python3 -m json.tool
echo ""
echo ""

echo "【场景 3】重复接单/并发抢单测试"
echo "─────────────────────────────────────────"
echo ""
echo "创建新的测试请求单"
REQUEST3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_test",
    "pickup_location": "星巴克",
    "dropoff_location": "1号楼",
    "item_type": "咖啡",
    "weight": 0.5,
    "volume": 1.0,
    "latest_delivery_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "tip_amount": 10
  }')
REQUEST3_ID=$(echo "$REQUEST3_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "请求单ID: $REQUEST3_ID"
echo ""

echo "创建行程"
TRIP5_RESPONSE=$(curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_tom_3",
    "start_location": "星巴克",
    "waypoints": [],
    "destination": "1号楼",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 10,
    "available_capacity_volume": 20,
    "forbidden_items": []
  }')
TRIP5_ID=$(echo "$TRIP5_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "行程ID: $TRIP5_ID"
echo ""

echo "测试1: Tom第一次接单 (应该成功)"
echo "─────────────────────────────────────────"
LOCK1=$(curl -s -X POST "$BASE_URL/api/orders/lock" \
  -H "Content-Type: application/json" \
  -d "{\"request_id\": \"$REQUEST3_ID\", \"traveler_id\": \"user_tom_3\"}")
echo "$LOCK1" | python3 -m json.tool
echo ""

echo "测试2: Tom重复接单 (应该返回幂等成功，提示已锁定)"
echo "─────────────────────────────────────────"
LOCK2=$(curl -s -X POST "$BASE_URL/api/orders/lock" \
  -H "Content-Type: application/json" \
  -d "{\"request_id\": \"$REQUEST3_ID\", \"traveler_id\": \"user_tom_3\"}")
echo "$LOCK2" | python3 -m json.tool
echo ""

echo "测试3: Jerry抢单 (应该失败，因为已被Tom锁定)"
echo "─────────────────────────────────────────"
LOCK3=$(curl -s -X POST "$BASE_URL/api/orders/lock" \
  -H "Content-Type: application/json" \
  -d "{\"request_id\": \"$REQUEST3_ID\", \"traveler_id\": \"user_jerry_2\"}")
echo "$LOCK3" | python3 -m json.tool
echo ""
echo ""

echo "【场景 4】非法状态流转测试"
echo "─────────────────────────────────────────"
echo ""
echo "创建新订单用于测试非法流转"
REQUEST4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "requester_id": "user_test2",
    "pickup_location": "前台",
    "dropoff_location": "2号楼",
    "item_type": "文件",
    "weight": 0.3,
    "volume": 0.5,
    "latest_delivery_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "tip_amount": 5
  }')
REQUEST4_ID=$(echo "$REQUEST4_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")

curl -s -X POST "$BASE_URL/api/trips" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_id": "user_tom_4",
    "start_location": "前台",
    "waypoints": [],
    "destination": "2号楼",
    "departure_time": "'"$(date -v+1H +%Y-%m-%dT%H:%M:%S)"'",
    "arrival_time": "'"$(date -v+4H +%Y-%m-%dT%H:%M:%S)"'",
    "available_capacity_weight": 10,
    "available_capacity_volume": 20,
    "forbidden_items": []
  }' > /dev/null

LOCK4=$(curl -s -X POST "$BASE_URL/api/orders/lock" \
  -H "Content-Type: application/json" \
  -d "{\"request_id\": \"$REQUEST4_ID\", \"traveler_id\": \"user_tom_4\"}")
ORDER4_ID=$(echo "$LOCK4" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['order']['id'])")
echo "订单ID: $ORDER4_ID (当前状态: locked)"
echo ""

echo "测试1: 发起人Alice尝试取消 (应该成功，locked状态可以取消)"
echo "─────────────────────────────────────────"
CANCEL1=$(curl -s -X POST "$BASE_URL/api/orders/cancel" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\": \"$ORDER4_ID\", \"actor_id\": \"user_test2\", \"actor_type\": \"requester\", \"reason\": \"不需要了\"}")
echo "$CANCEL1" | python3 -m json.tool
echo ""

echo "测试2: 尝试在已取消的订单上确认 (应该失败，非法状态流转)"
echo "─────────────────────────────────────────"
INVALID_CONFIRM=$(curl -s -X POST "$BASE_URL/api/orders/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\": \"$ORDER4_ID\", \"actor_id\": \"user_test2\", \"actor_type\": \"requester\"}")
echo "$INVALID_CONFIRM" | python3 -m json.tool
echo ""

echo "测试3: 尝试在已取消的订单上送达 (应该失败，终止状态无法变更)"
echo "─────────────────────────────────────────"
INVALID_DELIVER=$(curl -s -X POST "$BASE_URL/api/orders/deliver" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\": \"$ORDER4_ID\", \"traveler_id\": \"user_tom_4\"}")
echo "$INVALID_DELIVER" | python3 -m json.tool
echo ""
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   ✅ 冲突场景测试完成！                                    ║"
echo "║                                                            ║"
echo "║   测试覆盖:                                                 ║"
echo "║   1. 禁带品过滤 - 生鲜被禁带生鲜的行程过滤                  ║"
echo "║   2. 容量限制 - 15kg物品被5kg容量的行程过滤                 ║"
echo "║   3. 重复接单 - 同一人重复接单返回幂等成功                  ║"
echo "║   4. 并发抢单 - 第二人抢单被拒绝                           ║"
echo "║   5. 非法流转 - 已取消订单无法再确认/送达                   ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
