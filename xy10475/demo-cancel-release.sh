#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "演示 4: 取消订单并释放复核记录"
echo "=========================================="

echo ""
echo "1. 登录获取 token..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"checker01","password":"checker123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "登录失败，请先运行: npm run init-db && npm start"
  exit 1
fi

echo "Token: ${TOKEN:0:30}..."

echo ""
echo "2. 创建出库单..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/outbound/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderNo": "SO-2024-CANCEL",
    "items": [
      {"sku": "SKU001", "barcode": "BAR001", "product_name": "商品A", "expected_qty": 2}
    ]
  }')

ORDER_ID=$(echo $CREATE_RESPONSE | jq -r '.id')
echo "创建的订单ID: $ORDER_ID"

echo ""
echo "3. 扫描部分商品..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "4. 查看取消前的状态..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.order, .items'

echo ""
echo "5. 取消订单并释放复核记录..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/cancel" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason":"客户取消订单"}' | jq

echo ""
echo "6. 查看取消后的状态（扫描数量已重置）..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.order, .items'

echo ""
echo "7. 尝试对已取消订单进行扫码..."
echo "期望: 返回 ORDER_CANCELLED 错误"
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "8. 查看复核员错误率统计..."
curl -s -X GET "$BASE_URL/api/outbound/stats/checker-errors" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "=========================================="
echo "取消订单并释放复核记录演示完成！"
echo "=========================================="
