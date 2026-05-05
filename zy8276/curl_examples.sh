#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================"
echo "库存扣减服务 API 示例"
echo "========================================"
echo ""

echo "【1】获取商品列表"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/" | python3 -m json.tool
echo ""

echo "【2】获取单个商品详情 (SKU001)"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/SKU001" | python3 -m json.tool
echo ""

echo "【3】创建订单（预占库存）- 用户 user001 购买 1 件 SKU001"
echo "     幂等键: IDEM_$(date +%Y%m%d)_001"
echo "----------------------------------------"
ORDER1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user001",
    "sku": "SKU001",
    "quantity": 1,
    "idempotency_key": "IDEM_'"$(date +%Y%m%d)"'_001"
  }')
echo "$ORDER1_RESPONSE" | python3 -m json.tool
ORDER1_NO=$(echo "$ORDER1_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order_no'])")
echo ""

echo "【4】查看创建订单后的商品库存"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/SKU001" | python3 -m json.tool
echo ""

echo "【5】幂等性测试：使用相同幂等键重复创建订单"
echo "     预期：返回相同的订单信息，不会重复扣减"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user001",
    "sku": "SKU001",
    "quantity": 1,
    "idempotency_key": "IDEM_'"$(date +%Y%m%d)"'_001"
  }' | python3 -m json.tool
echo ""

echo "【6】支付成功（实扣库存）- 订单: $ORDER1_NO"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/pay" \
  -H "Content-Type: application/json" \
  -d "{\"order_no\": \"$ORDER1_NO\"}" | python3 -m json.tool
echo ""

echo "【7】查看支付后的商品库存"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/SKU001" | python3 -m json.tool
echo ""

echo "【8】创建第二个订单用于测试取消"
echo "     幂等键: IDEM_$(date +%Y%m%d)_002"
echo "----------------------------------------"
ORDER2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user002",
    "sku": "SKU001",
    "quantity": 1,
    "idempotency_key": "IDEM_'"$(date +%Y%m%d)"'_002"
  }')
echo "$ORDER2_RESPONSE" | python3 -m json.tool
ORDER2_NO=$(echo "$ORDER2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['order_no'])")
echo ""

echo "【9】查看创建第二个订单后的库存"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/SKU001" | python3 -m json.tool
echo ""

echo "【10】取消订单（回滚库存）- 订单: $ORDER2_NO"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/cancel" \
  -H "Content-Type: application/json" \
  -d "{\"order_no\": \"$ORDER2_NO\"}" | python3 -m json.tool
echo ""

echo "【11】查看取消后的商品库存（应该恢复）"
echo "----------------------------------------"
curl -s "$BASE_URL/api/products/SKU001" | python3 -m json.tool
echo ""

echo "【12】查看订单详情 - 订单: $ORDER1_NO"
echo "----------------------------------------"
curl -s "$BASE_URL/api/orders/$ORDER1_NO" | python3 -m json.tool
echo ""

echo "【13】查看库存流水"
echo "----------------------------------------"
curl -s "$BASE_URL/api/inventory-journals/" | python3 -m json.tool
echo ""

echo "【14】按 SKU 查看库存流水 (SKU001)"
echo "----------------------------------------"
curl -s "$BASE_URL/api/inventory-journals/?sku=SKU001" | python3 -m json.tool
echo ""

echo "【15】查看幂等键状态"
echo "----------------------------------------"
curl -s "$BASE_URL/api/idempotency-keys/IDEM_$(date +%Y%m%d)_001" | python3 -m json.tool
echo ""

echo "【16】导出库存审计报告 (JSON 格式)"
echo "----------------------------------------"
curl -s "$BASE_URL/api/audit/report/json" | python3 -m json.tool
echo ""

echo "【17】导出库存审计报告 (Markdown 格式)"
echo "----------------------------------------"
curl -s "$BASE_URL/api/audit/report/markdown"
echo ""

echo "========================================"
echo "API 示例执行完成"
echo "========================================"
