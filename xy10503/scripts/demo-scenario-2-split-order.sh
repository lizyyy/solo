#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="lisi@warehouse"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  场景 2: 部分缺货拆单流程                                    ║"
echo "║  订单: SO20250512001 (张三)                                  ║"
echo "║  商品: iPhone 15 Pro x2, AirPods Pro x1                      ║"
echo "║  上海仓库存: SKU-001=50 (只拣1个,缺货1个), SKU-002=100       ║"
echo "║  北京仓库存: SKU-001=100 (可换仓)                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "【1/9】创建波次"
echo "  POST /api/waves"
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "warehouse_code": "WH-SH",
    "wave_no": "WAVE-002"
  }')
echo "$CREATE_WAVE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_WAVE"
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo ""

echo "【2/9】添加订单到波次"
echo "  POST /api/waves/{waveId}/orders"
ADD_ORDERS=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "order_nos": ["SO20250512001"]
  }')
echo "$ADD_ORDERS" | python3 -m json.tool 2>/dev/null || echo "$ADD_ORDERS"
echo ""

echo "【3/9】开始拣货"
echo "  POST /api/waves/{waveId}/start-picking"
START_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$START_PICK" | python3 -m json.tool 2>/dev/null || echo "$START_PICK"
echo ""

echo "【4/9】查询订单行ID（需要用于报告拣货）"
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512001")
echo "$ORDER_DATA" | python3 -m json.tool 2>/dev/null
IPHONE_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-001']" 2>/dev/null)
AIRPODS_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-002']" 2>/dev/null)
echo "  iPhone 行ID: $IPHONE_LINE_ID"
echo "  AirPods 行ID: $AIRPODS_LINE_ID"
echo ""

echo "【5/9】报告拣货结果（iPhone拣到1个，缺货1个）"
echo "  POST /api/waves/{waveId}/report-picked"
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$IPHONE_LINE_ID\", \"picked_qty\": 1, \"reason\": \"库存不足，只找到1台\"},
      {\"order_line_id\": \"$AIRPODS_LINE_ID\", \"picked_qty\": 1}
    ]
  }")
echo "$REPORT_PICK" | python3 -m json.tool 2>/dev/null || echo "$REPORT_PICK"
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]" 2>/dev/null)
echo "  缺货记录ID: $STOCKOUT_ID"
echo ""

echo "【6/9】查询缺货详情"
echo "  GET /api/waves/stockouts/{stockoutId}"
curl -s "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID" | python3 -m json.tool 2>/dev/null
echo ""

echo "【7/9】查询波次状态（has_stockout）"
echo "  GET /api/waves/{waveId}"
curl -s "$BASE_URL/api/waves/$WAVE_ID" | python3 -m json.tool 2>/dev/null
echo ""

echo "【8/9】选择拆单处理缺货"
echo "  POST /api/waves/stockouts/{stockoutId}/split"
SPLIT_RESULT=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/split" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$SPLIT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SPLIT_RESULT"
echo ""

echo "【9/9】查询订单层级关系（父订单 + 子订单）"
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512001")
ORDER_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "  GET /api/orders/{orderId}/hierarchy"
curl -s "$BASE_URL/api/orders/$ORDER_ID/hierarchy" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】波次报告"
echo "  GET /api/waves/{waveId}/report"
curl -s "$BASE_URL/api/waves/$WAVE_ID/report" | python3 -m json.tool 2>/dev/null
echo ""

echo "✅ 场景 2 完成: 部分缺货拆单流程"
echo "   波次状态: created -> assigned -> picking -> has_stockout"
echo "   缺货状态: pending -> split"
echo "   订单状态: pending -> wave_assigned -> picking -> partial_picked"
echo "   生成子单: SO20250512001-S1 (缺货商品拆出)"
echo ""
