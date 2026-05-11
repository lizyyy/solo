#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "演示 2: 错货拦截 (扫错商品)"
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
echo "2. 创建出库单（包含商品A和商品B）..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/outbound/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderNo": "SO-2024-WRONG",
    "items": [
      {"sku": "SKU001", "barcode": "BAR001", "product_name": "商品A", "expected_qty": 1},
      {"sku": "SKU002", "barcode": "BAR002", "product_name": "商品B", "expected_qty": 1}
    ]
  }')

ORDER_ID=$(echo $CREATE_RESPONSE | jq -r '.id')
echo "创建的订单ID: $ORDER_ID"

echo ""
echo "3. 扫描正确的商品A..."
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "4. 故意扫描错误商品（不在订单中的商品C，条码 WRONG999）..."
echo "期望: 返回 WRONG_SKU 错误，拦截出库"
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"WRONG999"}' | jq

echo ""
echo "5. 尝试扫描多余数量的商品A（商品A已达到应发数量）..."
echo "期望: 返回 OVERSCAN 错误"
curl -s -X POST "$BASE_URL/api/outbound/orders/$ORDER_ID/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barcode":"BAR001"}' | jq

echo ""
echo "6. 查看错误记录和操作日志..."
curl -s -X GET "$BASE_URL/api/outbound/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.scanRecords, .operationLogs'

echo ""
echo "=========================================="
echo "错货拦截演示完成！"
echo "=========================================="
