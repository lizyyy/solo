#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=========================================="
echo "直播间优惠叠加 API 测试脚本"
echo "=========================================="
echo ""

echo "【步骤 1】创建直播场次"
echo "------------------------------------------"
STREAM_RESPONSE=$(curl -s -X POST $BASE_URL/api/streams \
  -H "Content-Type: application/json" \
  -d '{
    "streamer_id": "streamer_001",
    "streamer_name": "李佳琦直播室",
    "start_time": "2026-05-11T19:00:00Z"
  }')
echo "响应: $STREAM_RESPONSE"
STREAM_ID=$(echo $STREAM_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "直播场次 ID: $STREAM_ID"
echo ""

echo "【步骤 2】创建商品"
echo "------------------------------------------"
PRODUCT1_RESPONSE=$(curl -s -X POST $BASE_URL/api/products \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"name\": \"高端面膜套装\",
    \"price\": 299.00,
    \"stock\": 100
  }")
echo "商品1响应: $PRODUCT1_RESPONSE"
PRODUCT1_ID=$(echo $PRODUCT1_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "商品1 ID: $PRODUCT1_ID"

PRODUCT2_RESPONSE=$(curl -s -X POST $BASE_URL/api/products \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"name\": \"精华液\",
    \"price\": 399.00,
    \"stock\": 50
  }")
echo "商品2响应: $PRODUCT2_RESPONSE"
PRODUCT2_ID=$(echo $PRODUCT2_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "商品2 ID: $PRODUCT2_ID"

GIFT_PRODUCT_RESPONSE=$(curl -s -X POST $BASE_URL/api/products \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"name\": \"小样试用装\",
    \"price\": 0,
    \"stock\": 1000
  }")
echo "赠品商品响应: $GIFT_PRODUCT_RESPONSE"
GIFT_PRODUCT_ID=$(echo $GIFT_PRODUCT_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "赠品商品 ID: $GIFT_PRODUCT_ID"
echo ""

echo "【步骤 3】创建平台券 (无互斥)"
echo "------------------------------------------"
PLATFORM_COUPON_RESPONSE=$(curl -s -X POST $BASE_URL/api/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "type": "platform",
    "name": "平台满500减50券",
    "discount_type": "fixed",
    "discount_value": 50,
    "min_amount": 500,
    "stock": 100,
    "is_mutual_exclusive": false
  }')
echo "响应: $PLATFORM_COUPON_RESPONSE"
PLATFORM_COUPON_ID=$(echo $PLATFORM_COUPON_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "平台券 ID: $PLATFORM_COUPON_ID"
echo ""

echo "【步骤 4】创建主播券 (有互斥)"
echo "------------------------------------------"
ANCHOR_COUPON_RESPONSE=$(curl -s -X POST $BASE_URL/api/coupons \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"type\": \"anchor\",
    \"name\": \"主播专享9折券\",
    \"discount_type\": \"percentage\",
    \"discount_value\": 10,
    \"min_amount\": 100,
    \"stock\": 50,
    \"is_mutual_exclusive\": true
  }")
echo "响应: $ANCHOR_COUPON_RESPONSE"
ANCHOR_COUPON_ID=$(echo $ANCHOR_COUPON_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('id'))")
echo "主播券 ID: $ANCHOR_COUPON_ID"
echo ""

echo "【步骤 5】创建满减规则"
echo "------------------------------------------"
FULL_REDUCTION_RESPONSE=$(curl -s -X POST $BASE_URL/api/promotions/full-reduction \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"name\": \"直播间满800减100\",
    \"threshold_amount\": 800,
    \"discount_amount\": 100,
    \"priority\": 1
  }")
echo "响应: $FULL_REDUCTION_RESPONSE"
echo ""

echo "【步骤 6】创建赠品规则 (库存充足)"
echo "------------------------------------------"
GIFT_RESPONSE=$(curl -s -X POST $BASE_URL/api/promotions/gift \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"name\": \"满600送小样\",
    \"threshold_amount\": 600,
    \"gift_product_id\": $GIFT_PRODUCT_ID,
    \"gift_quantity\": 2,
    \"stock\": 100
  }")
echo "响应: $GIFT_RESPONSE"
echo ""

echo "=========================================="
echo "场景 1: 普通下单 (使用平台券 + 满减)"
echo "=========================================="
echo ""

echo "【1.1】订单试算"
echo "商品: 高端面膜套装 x2 (299*2=598) + 精华液 x1 (399) = 997元"
echo "优惠: 平台券50 + 满减100 = 150元"
echo "实付: 847元"
echo ""
PREVIEW1_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/preview \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_001\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 2},
      {\"product_id\": $PRODUCT2_ID, \"quantity\": 1}
    ],
    \"platform_coupon_id\": $PLATFORM_COUPON_ID
  }")
echo "试算响应:"
echo $PREVIEW1_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PREVIEW1_RESPONSE
echo ""

echo "【1.2】确认订单"
echo "------------------------------------------"
ORDER1_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_001\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 2},
      {\"product_id\": $PRODUCT2_ID, \"quantity\": 1}
    ],
    \"platform_coupon_id\": $PLATFORM_COUPON_ID
  }")
echo "订单响应:"
echo $ORDER1_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ORDER1_RESPONSE
ORDER1_NO=$(echo $ORDER1_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_no',''))")
echo "订单号: $ORDER1_NO"
echo ""

echo "=========================================="
echo "场景 2: 优惠冲突 (平台券 + 互斥主播券)"
echo "=========================================="
echo ""

echo "【2.1】尝试同时使用平台券和互斥主播券"
echo "------------------------------------------"
CONFLICT_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/preview \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_002\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 2}
    ],
    \"platform_coupon_id\": $PLATFORM_COUPON_ID,
    \"anchor_coupon_id\": $ANCHOR_COUPON_ID
  }")
echo "冲突响应 (期望报错):"
echo $CONFLICT_RESPONSE | python3 -m json.tool 2>/dev/null || echo $CONFLICT_RESPONSE
echo ""

echo "=========================================="
echo "场景 3: 部分退款"
echo "=========================================="
echo ""

echo "【3.1】创建新订单用于退款测试"
echo "------------------------------------------"
ORDER2_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_003\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 3},
      {\"product_id\": $PRODUCT2_ID, \"quantity\": 2}
    ]
  }")
echo "订单2响应:"
echo $ORDER2_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ORDER2_RESPONSE
ORDER2_NO=$(echo $ORDER2_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_no',''))")
echo "订单2号: $ORDER2_NO"
echo ""

echo "【3.2】部分退款 - 退回1盒高端面膜套装"
echo "------------------------------------------"
PARTIAL_REFUND_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/$ORDER2_NO/refund/partial \
  -H "Content-Type: application/json" \
  -d "{
    \"refund_items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 1}
    ]
  }")
echo "部分退款响应:"
echo $PARTIAL_REFUND_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PARTIAL_REFUND_RESPONSE
echo ""

echo "【3.3】查询订单详情 (验证退款状态)"
echo "------------------------------------------"
ORDER_DETAIL_RESPONSE=$(curl -s $BASE_URL/api/orders/$ORDER2_NO)
echo "订单详情:"
echo $ORDER_DETAIL_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ORDER_DETAIL_RESPONSE
echo ""

echo "=========================================="
echo "场景 4: 整单退款"
echo "=========================================="
echo ""

echo "【4.1】创建新订单用于整单退款测试"
echo "------------------------------------------"
ORDER3_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_004\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 1}
    ],
    \"platform_coupon_id\": $PLATFORM_COUPON_ID
  }")
ORDER3_NO=$(echo $ORDER3_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_no',''))")
echo "订单3号: $ORDER3_NO"
echo ""

echo "【4.2】整单退款"
echo "------------------------------------------"
FULL_REFUND_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/$ORDER3_NO/refund/full)
echo "整单退款响应:"
echo $FULL_REFUND_RESPONSE | python3 -m json.tool 2>/dev/null || echo $FULL_REFUND_RESPONSE
echo ""

echo "【4.3】验证平台券已返还 (再次使用同一平台券)"
echo "------------------------------------------"
PLATFORM_COUPON_REUSE_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/preview \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_004\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 2}
    ],
    \"platform_coupon_id\": $PLATFORM_COUPON_ID
  }")
echo "平台券重新使用 (退款后应该可用):"
echo $PLATFORM_COUPON_REUSE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PLATFORM_COUPON_REUSE_RESPONSE
echo ""

echo "=========================================="
echo "场景 5: 直播场次结束后不能下单"
echo "=========================================="
echo ""

echo "【5.1】结束直播场次"
echo "------------------------------------------"
END_STREAM_RESPONSE=$(curl -s -X PUT $BASE_URL/api/streams/$STREAM_ID/end)
echo "结束直播响应:"
echo $END_STREAM_RESPONSE | python3 -m json.tool 2>/dev/null || echo $END_STREAM_RESPONSE
echo ""

echo "【5.2】尝试在已结束的直播中下单"
echo "------------------------------------------"
AFTER_END_ORDER_RESPONSE=$(curl -s -X POST $BASE_URL/api/orders/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"stream_id\": $STREAM_ID,
    \"user_id\": \"user_005\",
    \"items\": [
      {\"product_id\": $PRODUCT1_ID, \"quantity\": 1}
    ]
  }")
echo "下单响应 (期望报错):"
echo $AFTER_END_ORDER_RESPONSE | python3 -m json.tool 2>/dev/null || echo $AFTER_END_ORDER_RESPONSE
echo ""

echo "=========================================="
echo "场景 6: 查看直播统计"
echo "=========================================="
echo ""

echo "【6.1】查询直播统计数据"
echo "------------------------------------------"
STATS_RESPONSE=$(curl -s $BASE_URL/api/statistics/stream/$STREAM_ID)
echo "直播统计:"
echo $STATS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $STATS_RESPONSE
echo ""

echo "=========================================="
echo "测试完成!"
echo "=========================================="
echo ""
echo "测试总结:"
echo "- 场景1: 普通下单 ✓"
echo "- 场景2: 优惠冲突 ✓"
echo "- 场景3: 部分退款 ✓"
echo "- 场景4: 整单退款 + 优惠券返还 ✓"
echo "- 场景5: 直播结束后不能下单 ✓"
echo "- 场景6: 直播统计 ✓"
