#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "演示 1: 正常出库流程"
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
    "orderNo": "SO-2024-001",
    "items": [
      {"sku": "SKU001", "barcode": "BAR001", "product_name": "商品A", "expected_qty": 2},
      {"sku": "SKU002", "barcode": "BAR002", "product_name": "商品B", "expected_qty": 1}
    ]
  }')

ORDER_ID=$(echo $CREATE_RESPONSE | jq -r '.id')
echo "创建的订单ID: $ORDER_ID"

echo ""
echo "3. 查看订单初始状态..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.order, .items'

echo ""
echo "4. 扫码复核 - 商品A (第1件)..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "5. 扫码复核 - 商品A (第2件)..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "6. 扫码复核 - 商品B..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR002"}' | jq

echo ""
echo "7. 确认出库..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "8. 查看最终状态..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.order, .scanRecords[0:5]'

echo ""
echo "=========================================="
echo "正常出库演示完成！"
echo "=========================================="
