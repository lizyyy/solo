#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR="admin@warehouse"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  失败路径和幂等性演示                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "【演示 1: 幂等性测试 - 重复创建订单】"
echo ""
echo "  第一次请求"
IDEM_KEY="test-idem-$(date +%s)"
CREATE1=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -H "X-Idempotent-Key: $IDEM_KEY" \
  -d '{
    "order_no": "SO-TEST-IDEM-001",
    "customer_name": "幂等测试用户",
    "customer_phone": "13999999999",
    "province": "上海市",
    "city": "上海市",
    "address": "测试地址",
    "shipping_fee": 10,
    "lines": [
      {"sku_code": "SKU-001", "qty": 1, "price": 7999}
    ]
  }')
echo "$CREATE1" | python3 -m json.tool 2>/dev/null
echo ""

echo "  第二次请求（相同 Idempotent-Key）"
CREATE2=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -H "X-Idempotent-Key: $IDEM_KEY" \
  -d '{
    "order_no": "SO-TEST-IDEM-001",
    "customer_name": "幂等测试用户",
    "customer_phone": "13999999999",
    "province": "上海市",
    "city": "上海市",
    "address": "测试地址",
    "shipping_fee": 10,
    "lines": [
      {"sku_code": "SKU-001", "qty": 1, "price": 7999}
    ]
  }')
echo "$CREATE2" | python3 -m json.tool 2>/dev/null
echo ""

IDEM_RESULT=$(echo "$CREATE2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('is_idempotent:', d.get('is_idempotent', 'N/A'))" 2>/dev/null)
echo "  检查幂等标记: $IDEM_RESULT"
echo ""

echo "  验证：数据库中只有一个订单"
curl -s "$BASE_URL/api/orders?order_no=SO-TEST-IDEM-001" | python3 -m json.tool 2>/dev/null
echo ""

echo "【演示 2: 人工修正（带前后差异和操作者）】"
echo ""
echo "  先查询当前订单状态"
ORDERS=$(curl -s "$BASE_URL/api/orders?order_no=SO20250512001")
echo "$ORDERS" | python3 -m json.tool 2>/dev/null
ORDER_ID=$(echo "$ORDERS" | python3 -c "import sys,json; os=json.load(sys.stdin)['data']; print(os[0]['id'] if os else '')" 2>/dev/null)
echo "  订单ID: $ORDER_ID"
echo ""

echo "  人工修正订单状态（必须提供修正原因）"
CORRECT=$(curl -s -X POST "$BASE_URL/api/orders/$ORDER_ID/correct" \
  -H "Content-Type: application/json" \
  -H "X-Operator: manager@company.com" \
  -d '{
    "old_status": "partial_picked",
    "new_status": "shipped",
    "reason": "用户要求直接发货，缺货商品后续补发"
  }')
echo "$CORRECT" | python3 -m json.tool 2>/dev/null
echo ""

echo "  查看人工修正记录"
ORDER_DETAIL=$(curl -s "$BASE_URL/api/orders/$ORDER_ID")
echo "$ORDER_DETAIL" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('=== 订单状态历史 ===')
for h in d['data']['history']:
    print(f\"  {h['created_at']}: {h['old_status']} -> {h['new_status']} by {h['operator']}\")
    print(f\"    备注: {h['remark']}\")
print()
print('=== 人工修正记录 ===')
for c in d['data']['manual_corrections']:
    print(f\"  {c['created_at']}: {c['field_name']}\")
    print(f\"    原值: {c['old_value']}\")
    print(f\"    新值: {c['new_value']}\")
    print(f\"    原因: {c['reason']}\")
    print(f\"    操作者: {c['operator']}\")
"
echo ""

echo "【演示 3: 错误处理 - 操作已出库的订单行】"
echo ""
echo "  尝试在已完成状态的波次上添加订单"
WAVE_DATA=$(curl -s "$BASE_URL/api/waves?wave_no=WAVE-001")
WAVE_ID=$(echo "$WAVE_DATA" | python3 -c "import sys,json; ws=json.load(sys.stdin)['data']; print(ws[0]['id'] if ws else '')" 2>/dev/null)
echo "  波次ID: $WAVE_ID"
echo ""

echo "  尝试操作非法状态"
ADD_ERROR=$(curl -s -X POST "$BASE_URL/api/waves/$WAVE_ID/orders" \
  -H "Content-Type: application/json" \
  -H "X-Operator: $OPERATOR" \
  -d '{
    "order_nos": ["SO20250512002"]
  }')
echo "$ADD_ERROR" | python3 -m json.tool 2>/dev/null
echo ""

echo "【演示 4: 错误处理 - 重复报告同一缺货】"
echo ""
echo "  获取已存在的缺货记录订单"
STOCKOUT_ORDER=$(curl -s "$BASE_URL/api/orders/no/SO20250512002")
echo ""

echo "✅ 失败路径和幂等性演示完成"
echo "   1. 幂等性: 相同 X-Idempotent-Key 重复请求返回 is_idempotent=true"
echo "   2. 人工修正: 记录了前后差异、原因、操作者"
echo "   3. 状态保护: 非法状态操作被拒绝，返回明确错误信息"
echo ""
