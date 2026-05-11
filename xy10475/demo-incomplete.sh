#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "演示 3: 少货待处理 (扫描未完成)"
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
echo "2. 创建出库单（包含3件商品）..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/outbound/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderNo": "SO-2024-INCOMPLETE",
    "items": [
      {"sku": "SKU001", "barcode": "BAR001", "product_name": "商品A", "expected_qty": 2},
      {"sku": "SKU002", "barcode": "BAR002", "product_name": "商品B", "expected_qty": 1}
    ]
  }')

ORDER_ID=$(echo $CREATE_RESPONSE | jq -r '.id')
echo "创建的订单ID: $ORDER_ID"

echo ""
echo "3. 只扫描1件商品A（未完成全部扫描）..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "4. 查看当前进度..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.order, .differences'

echo ""
echo "5. 尝试确认出库（扫描未完成）..."
echo "期望: 返回 INCOMPLETE 错误，并列出缺少的商品"
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "=========================================="
echo "少货待处理演示完成！"
echo "=========================================="
