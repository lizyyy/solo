#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="wangwu@warehouse"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  场景 3: 换仓成功流程                                        ║"
echo "║  订单: SO20250512002 (李四)                                  ║"
echo "║  商品: MacBook x1, iPad x1                                   ║"
echo "║  上海仓库存: MacBook=5 (有货), iPad=0 (缺货)                 ║"
echo "║  北京仓库存: iPad=50 (可换仓)                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "【1/10】创建波次"
echo "  POST /api/waves"
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "warehouse_code": "WH-SH",
    "wave_no": "WAVE-003"
  }')
echo "$CREATE_WAVE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_WAVE"
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo ""

echo "【2/10】添加订单到波次"
echo "  POST /api/waves/{waveId}/orders"
ADD_ORDERS=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "order_nos": ["SO20250512002"]
  }')
echo "$ADD_ORDERS" | python3 -m json.tool 2>/dev/null || echo "$ADD_ORDERS"
echo ""

echo "【3/10】开始拣货"
echo "  POST /api/waves/{waveId}/start-picking"
START_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$START_PICK" | python3 -m json.tool 2>/dev/null || echo "$START_PICK"
echo ""

echo "【4/10】查询订单行ID"
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512002")
MACBOOK_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-003']" 2>/dev/null)
IPAD_LINE_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; [print(l['id']) for l in lines if l['sku_code']=='SKU-004']" 2>/dev/null)
echo "  MacBook 行ID: $MACBOOK_LINE_ID"
echo "  iPad 行ID: $IPAD_LINE_ID"
echo ""

echo "【5/10】报告拣货结果（MacBook拣到，iPad缺货）"
echo "  POST /api/waves/{waveId}/report-picked"
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      {\"order_line_id\": \"$MACBOOK_LINE_ID\", \"picked_qty\": 1},
      {\"order_line_id\": \"$IPAD_LINE_ID\", \"picked_qty\": 0, \"reason\": \"上海仓iPad完全缺货\"}
    ]
  }")
echo "$REPORT_PICK" | python3 -m json.tool 2>/dev/null || echo "$REPORT_PICK"
STOCKOUT_ID=$(echo "$REPORT_PICK" | python3 -c "import sys,json; sos=json.load(sys.stdin)['data']['stockouts']; [print(s['id']) for s in sos]" 2>/dev/null)
echo "  缺货记录ID: $STOCKOUT_ID"
echo ""

echo "【6/10】查询其他仓库可用库存"
echo "  查看北京仓iPad库存"
curl -s "$BASE_URL/api/inventory/WH-BJ/SKU-004" | python3 -m json.tool 2>/dev/null
echo ""

echo "【7/10】生成换仓建议"
echo "  POST /api/waves/stockouts/{stockoutId}/suggest-transfer"
SUGGEST=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/suggest-transfer" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$SUGGEST" | python3 -m json.tool 2>/dev/null || echo "$SUGGEST"
echo ""

echo "【8/10】执行换仓"
echo "  POST /api/waves/stockouts/{stockoutId}/execute-transfer"
TRANSFER=$(curl -s -X POST "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID/execute-transfer" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$TRANSFER" | python3 -m json.tool 2>/dev/null || echo "$TRANSFER"
echo ""

echo "【9/10】查看换仓后库存变化"
echo "  上海仓库存（增加）"
curl -s "$BASE_URL/api/inventory/WH-SH/SKU-004" | python3 -m json.tool 2>/dev/null
echo "  北京仓库存（减少）"
curl -s "$BASE_URL/api/inventory/WH-BJ/SKU-004" | python3 -m json.tool 2>/dev/null
echo ""

echo "【10/10】查看缺货状态历史"
echo "  GET /api/waves/stockouts/{stockoutId}"
curl -s "$BASE_URL/api/waves/stockouts/$STOCKOUT_ID" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】波次报告"
echo "  GET /api/waves/{waveId}/report"
curl -s "$BASE_URL/api/waves/$WAVE_ID/report" | python3 -m json.tool 2>/dev/null
echo ""

echo "✅ 场景 3 完成: 换仓成功流程"
echo "   波次状态: created -> assigned -> picking -> has_stockout"
echo "   缺货状态: pending -> transfer_success"
echo "   库存变化: 北京仓->上海仓 (1台iPad)"
echo ""
