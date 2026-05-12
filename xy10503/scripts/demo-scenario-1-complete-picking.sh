#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="zhangsan@warehouse"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  场景 1: 完整拣货流程（无缺货）                              ║"
echo "║  订单: SO20250512004 (赵六)                                  ║"
echo "║  商品: AirPods Pro 2 x3, Apple Watch x2                      ║"
echo "║  上海仓库存: SKU-002=100, SKU-005=30 (库存充足)              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "【1/6】创建波次"
echo "  POST /api/waves"
CREATE_WAVE=$(curl -s -X POST "$BASE_URL/api/waves" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "warehouse_code": "WH-SH",
    "wave_no": "WAVE-001"
  }')
echo "$CREATE_WAVE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_WAVE"
WAVE_ID=$(echo "$CREATE_WAVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo ""

echo "【2/6】查看初始库存"
echo "  GET /api/inventory?warehouse_code=WH-SH"
curl -s "$BASE_URL/api/inventory?warehouse_code=WH-SH" | python3 -m json.tool 2>/dev/null
echo ""

echo "【3/6】添加订单到波次"
echo "  POST /api/waves/{waveId}/orders"
ADD_ORDERS=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "order_nos": ["SO20250512004"]
  }')
echo "$ADD_ORDERS" | python3 -m json.tool 2>/dev/null || echo "$ADD_ORDERS"
echo ""

echo "【4/6】查询订单状态（加入波次后）"
echo "  GET /api/orders/no/SO20250512004"
ORDER_DATA=$(curl -s "$BASE_URL/api/orders/no/SO20250512004")
echo "$ORDER_DATA" | python3 -m json.tool 2>/dev/null
ORDER_ID=$(echo "$ORDER_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
LINE_IDS=$(echo "$ORDER_DATA" | python3 -c "import sys,json; lines=json.load(sys.stdin)['data']['lines']; print(' '.join([l['id'] for l in lines]))" 2>/dev/null)
echo "  订单ID: $ORDER_ID"
echo "  行ID: $LINE_IDS"
echo ""

echo "【5/6】开始拣货"
echo "  POST /api/waves/{waveId}/start-picking"
START_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/start-picking" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR")
echo "$START_PICK" | python3 -m json.tool 2>/dev/null || echo "$START_PICK"
echo ""

echo "【6/6】确认拣货完成"
echo "  POST /api/waves/{waveId}/report-picked"
REPORT_PICK=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/report-picked" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d "{
    \"picked_results\": [
      $(echo "$LINE_IDS" | tr ' ' '\n' | while read lid; do
        echo "{\"order_line_id\": \"$lid\", \"picked_qty\": 3}" 2>/dev/null | head -1
      done | paste -sd ',' -)
    ]
  }")
echo "$REPORT_PICK" | python3 -m json.tool 2>/dev/null || echo "$REPORT_PICK"
echo ""

echo "【查询】波次报告"
echo "  GET /api/waves/{waveId}/report"
curl -s "$BASE_URL/api/waves/$WAVE_ID/report" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】拣货后库存变化"
echo "  GET /api/waves/{waveId}/inventory-report"
curl -s "$BASE_URL/api/waves/$WAVE_ID/inventory-report" | python3 -m json.tool 2>/dev/null
echo ""

echo "【查询】订单状态历史"
echo "  GET /api/orders/no/SO20250512004"
curl -s "$BASE_URL/api/orders/no/SO20250512004" | python3 -m json.tool 2>/dev/null
echo ""

echo "✅ 场景 1 完成: 完整拣货流程（无缺货）"
echo "   波次状态: created -> assigned -> picking -> partial_picked"
echo "   订单状态: pending -> wave_assigned -> picking"
echo ""
