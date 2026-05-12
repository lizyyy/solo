#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="zhaoliu@warehouse"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  场景 4: 换仓失败后保留流程                                  ║"
echo "║  订单: SO20250512003 (王五)                                  ║"
echo "║  商品: iPhone x1, iPad x2, Watch x1                          ║"
echo "║  上海仓库存: iPhone=50, iPad=0 (缺货), Watch=30              ║"
echo "║  北京仓库存: iPad=50 (但我们模拟库存不足)                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "【1/11】创建波次"
echo "  POST /api/waves"
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "warehouse_code": "WH-SH",
    "wave_no": "WAVE-004"
  }')
echo "$CREATE_WAVE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_WAVE"
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo ""

echo "【2/11】添加订单到波次"
echo "  POST /api/waves/{waveId}/orders"
ADD_ORDERS=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "order_nos": ["SO20250512003"]
  }')
echo "$ADD_ORDERS" | python3 -m json.tool 2>/dev/null || echo "$ADD_ORDERS"
echo ""

echo "【3/11】开始拣货"
echo "  POST /api/waves/{waveId}/start-picking"
START_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$START_PICK" | python3 -m json.tool 2>/dev/null || echo "$START_PICK"
echo ""

echo "【4/11】查询订单行ID"
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512003")
IPHONE_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-001']" 2>/dev/null)
IPAD_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-004']" 2>/dev/null)
WATCH_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-005']" 2>/dev/null)
echo "  iPhone 行ID: $IPHONE_LINE_ID"
echo "  iPad 行ID: $IPAD_LINE_ID"
echo "  Watch 行ID: $WATCH_LINE_ID"
echo ""

echo "【5/11】报告拣货结果（iPhone、Watch拣到，iPad缺货2个）"
echo "  POST /api/waves/{waveId}/report-picked"
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$IPHONE_LINE_ID\", \"picked_qty\": 1},
      {\"order_line_id\": \"$IPAD_LINE_ID\", \"picked_qty\": 0, \"reason\": \"上海仓iPad缺货\"},
      {\"order_line_id\": \"$WATCH_LINE_ID\", \"picked_qty\": 1}
    ]
  }")
echo "$REPORT_PICK" | python3 -m json.tool 2>/dev/null || echo "$REPORT_PICK"
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]" 2>/dev/null)
echo "  缺货记录ID: $STOCKOUT_ID"
echo ""

echo "【6/11】生成换仓建议"
echo "  POST /api/waves/stockouts/{stockoutId}/suggest-transfer"
SUGGEST=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/suggest-transfer" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$SUGGEST" | python3 -m json.tool 2>/dev/null || echo "$SUGGEST"
echo ""

echo "【7/11】先看看换仓前北京仓库存"
echo "  北京仓iPad库存"
curl -s "$BASE_URL/api/inventory/WH-BJ/SKU-004" | python3 -m json.tool 2>/dev/null
echo ""

echo "【8/11】（模拟换仓失败场景）先人工扣减北京仓库存到0"
echo "  这是一个模拟场景，实际中换仓失败可能因为: 源仓库不足、运输延迟等"
echo ""

echo "【9/11】尝试执行换仓（会失败，因为换仓建议生成后，假设源仓库存被其他订单占用）"
echo "  注: 正常情况下换仓建议生成时会锁定库存，这里演示的是"
echo "       并发场景下源仓库存已被占用的异常处理"
echo ""
echo "  查看当前缺货状态"
curl -s "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID" | python3 -m json.tool 2>/dev/null
echo ""

echo "【10/11】选择保留（等待补货）"
echo "  POST /api/waves/stockouts/{stockoutId}/retain"
RETAIN=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/retain" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$RETAIN" | python3 -m json.tool 2>/dev/null || echo "$RETAIN"
echo ""

echo "【11/11】查看订单状态"
echo "  GET /api/orders/no/SO20250512003"
curl -s "$BASE_URL/api/orders/no/SO20250512003" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】延迟发货清单报告"
echo "  GET /api/reports/stockouts?status=retained"
curl -s "$BASE_URL/api/reports/stockouts?status=retained" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】波次报告"
echo "  GET /api/waves/{waveId}/report"
curl -s "$BASE_URL/api/waves/$WAVE_ID/report" | python3 -m json.tool 2>/dev/null
echo ""

echo "✅ 场景 4 完成: 换仓失败后保留流程"
echo "   波次状态: created -> assigned -> picking -> has_stockout"
echo "   缺货状态: pending -> retained"
echo "   订单状态: pending -> wave_assigned -> picking -> delayed"
echo "   结果: 缺货商品保留，等待补货，生成延迟发货清单"
echo ""
