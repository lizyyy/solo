#!/bin/bash

BASE_URL="http://localhost:3001/api/orders"

echo "========================================"
echo "配送路径 ETA API - Curl 示例"
echo "========================================"
echo ""

echo "--- 场景1：正常配送流程 ---"
echo ""

echo "1. 创建配送订单"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "张三",
    "destinationAddress": "北京市朝阳区望京SOHO",
    "destinationLat": 40.0031,
    "destinationLon": 116.4808,
    "originAddress": "北京市朝阳区国贸中心",
    "originLat": 39.9087,
    "originLon": 116.4594,
    "riderId": "rider_001",
    "baseEtaMinutes": 30,
    "priority": "normal"
  }')
echo "创建订单响应："
echo "$ORDER_RESPONSE" | python3 -m json.tool
ORDER_ID=$(echo "$ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $ORDER_ID"
echo ""

sleep 2

echo "2. 骑手上报第一次位置"
curl -s -X POST "$BASE_URL/$ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_001",
    "latitude": 39.9100,
    "longitude": 116.4600,
    "speed": 25.5,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

sleep 2

echo "3. 骑手上报第二次位置（更接近目的地）"
curl -s -X POST "$BASE_URL/$ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_001",
    "latitude": 39.9500,
    "longitude": 116.4700,
    "speed": 28.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "4. 查询当前 ETA 及详情"
curl -s "$BASE_URL/$ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "5. 订单签收"
curl -s -X POST "$BASE_URL/$ORDER_ID/sign" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_001",
    "signedBy": "张三",
    "signatureType": "direct",
    "notes": "本人签收"
  }' | python3 -m json.tool
echo ""

echo "6. 签收后查询 ETA"
curl -s "$BASE_URL/$ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "--- 场景2：天气延迟 ---"
echo ""

echo "1. 创建新订单"
WEATHER_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "李四",
    "destinationAddress": "北京市海淀区中关村",
    "destinationLat": 39.9847,
    "destinationLon": 116.3064,
    "originAddress": "北京市西城区西单",
    "originLat": 39.9087,
    "originLon": 116.3728,
    "riderId": "rider_002",
    "baseEtaMinutes": 45,
    "priority": "normal"
  }')
WEATHER_ORDER_ID=$(echo "$WEATHER_ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $WEATHER_ORDER_ID"
echo ""

echo "2. 查询初始 ETA"
echo "初始 ETA 查询："
curl -s "$BASE_URL/$WEATHER_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "3. 上报天气延迟（只影响海淀区）"
DELAY_RESPONSE=$(curl -s -X POST "$BASE_URL/$WEATHER_ORDER_ID/delay" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "weather",
    "reason": "海淀区突降暴雨，道路积水",
    "delayMinutes": 20,
    "affectedAreas": ["海淀区", "中关村"]
  }')
echo "天气延迟响应："
echo "$DELAY_RESPONSE" | python3 -m json.tool
echo ""

echo "4. 查询延迟后的 ETA"
echo "延迟后 ETA 查询："
curl -s "$BASE_URL/$WEATHER_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "--- 场景3：骑手改派 ---"
echo ""

echo "1. 创建新订单"
REASSIGN_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "王五",
    "destinationAddress": "北京市东城区王府井",
    "destinationLat": 39.9142,
    "destinationLon": 116.4108,
    "originAddress": "北京市朝阳区三里屯",
    "originLat": 39.9340,
    "originLon": 116.4517,
    "riderId": "rider_003",
    "baseEtaMinutes": 25,
    "priority": "normal"
  }')
REASSIGN_ORDER_ID=$(echo "$REASSIGN_ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $REASSIGN_ORDER_ID"
echo ""

echo "2. 原骑手上报位置"
curl -s -X POST "$BASE_URL/$REASSIGN_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_003",
    "latitude": 39.9350,
    "longitude": 116.4520,
    "speed": 20.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "3. 骑手离线，进行改派"
REASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/$REASSIGN_ORDER_ID/reassign" \
  -H "Content-Type: application/json" \
  -d '{
    "newRiderId": "rider_004",
    "reason": "rider_offline"
  }')
echo "改派响应："
echo "$REASSIGN_RESPONSE" | python3 -m json.tool
echo ""

echo "4. 新骑手上报位置"
curl -s -X POST "$BASE_URL/$REASSIGN_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_004",
    "latitude": 39.9200,
    "longitude": 116.4300,
    "speed": 25.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "5. 旧骑手误报位置（应该被标记为旧骑手数据）"
curl -s -X POST "$BASE_URL/$REASSIGN_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_003",
    "latitude": 39.9400,
    "longitude": 116.4600,
    "speed": 22.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "6. 查询改派后的 ETA"
echo "改派后 ETA 查询："
curl -s "$BASE_URL/$REASSIGN_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "--- 场景4：优先级插队 ---"
echo ""

echo "1. 创建普通订单"
PRIORITY_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "赵六",
    "destinationAddress": "北京市丰台区北京西站",
    "destinationLat": 39.8949,
    "destinationLon": 116.3225,
    "originAddress": "北京市朝阳区北京站",
    "originLat": 39.9044,
    "originLon": 116.4271,
    "riderId": "rider_005",
    "baseEtaMinutes": 40,
    "priority": "normal"
  }')
PRIORITY_ORDER_ID=$(echo "$PRIORITY_ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $PRIORITY_ORDER_ID"
echo ""

echo "2. 查询初始 ETA（普通优先级）"
echo "普通优先级 ETA："
curl -s "$BASE_URL/$PRIORITY_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "3. 升级为高优先级"
curl -s -X PATCH "$BASE_URL/$PRIORITY_ORDER_ID/priority" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high"
  }' | python3 -m json.tool
echo ""

echo "4. 查询高优先级 ETA"
echo "高优先级 ETA："
curl -s "$BASE_URL/$PRIORITY_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "5. 进一步升级为加急优先级"
curl -s -X PATCH "$BASE_URL/$PRIORITY_ORDER_ID/priority" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent"
  }' | python3 -m json.tool
echo ""

echo "6. 查询加急优先级 ETA"
echo "加急优先级 ETA："
curl -s "$BASE_URL/$PRIORITY_ORDER_ID/eta" | python3 -m json.tool
echo ""

echo "--- 场景5：签收后继续上传位置（迟到数据） ---"
echo ""

echo "1. 创建订单并签收"
LATE_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "钱七",
    "destinationAddress": "北京市石景山区八角游乐园",
    "destinationLat": 39.9056,
    "destinationLon": 116.2228,
    "originAddress": "北京市海淀区五棵松",
    "originLat": 39.9087,
    "originLon": 116.2759,
    "riderId": "rider_006",
    "baseEtaMinutes": 20,
    "priority": "normal"
  }')
LATE_ORDER_ID=$(echo "$LATE_ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $LATE_ORDER_ID"
echo ""

echo "2. 订单签收"
curl -s -X POST "$BASE_URL/$LATE_ORDER_ID/sign" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_006",
    "signedBy": "钱七",
    "signatureType": "direct"
  }' | python3 -m json.tool
echo ""

echo "3. 签收后继续上传位置（应该被标记为迟到数据）"
curl -s -X POST "$BASE_URL/$LATE_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_006",
    "latitude": 39.9056,
    "longitude": 116.2228,
    "speed": 0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "--- 场景6：重复位置上报（幂等处理） ---"
echo ""

echo "1. 创建订单"
IDEMPOTENT_ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "孙八",
    "destinationAddress": "北京市通州区运河商务区",
    "destinationLat": 39.9022,
    "destinationLon": 116.6568,
    "originAddress": "北京市朝阳区CBD",
    "originLat": 39.9148,
    "originLon": 116.4605,
    "riderId": "rider_007",
    "baseEtaMinutes": 35,
    "priority": "normal"
  }')
IDEMPOTENT_ORDER_ID=$(echo "$IDEMPOTENT_ORDER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "订单ID: $IDEMPOTENT_ORDER_ID"
echo ""

echo "2. 第一次上报位置"
curl -s -X POST "$BASE_URL/$IDEMPOTENT_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_007",
    "latitude": 39.9150,
    "longitude": 116.4610,
    "speed": 30.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "3. 相同位置重复上报（应该被忽略）"
curl -s -X POST "$BASE_URL/$IDEMPOTENT_ORDER_ID/track" \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "rider_007",
    "latitude": 39.9150,
    "longitude": 116.4610,
    "speed": 30.0,
    "isOnline": true
  }' | python3 -m json.tool
echo ""

echo "========================================"
echo "所有示例执行完成"
echo "========================================"
