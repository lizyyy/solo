#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "跨仓拣货优先级 API 演示"
echo "=========================================="
echo ""

echo "1. 查看初始库存"
echo "------------------------------------------"
curl -s "$BASE_URL/api/inventory" | python3 -m json.tool
echo ""

echo "2. 导入普通订单 - ORDER001（单仓可满足）"
echo "   购买 SKU001 50件，华东仓有100件"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/import" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORDER001",
    "priority": "normal",
    "items": [
      {"sku": "SKU001", "quantity": 50, "name": "商品A"}
    ]
  }' | python3 -m json.tool
echo ""

echo "3. 导入加急订单 - ORDER002（跨仓拆分）"
echo "   购买 SKU001 200件"
echo "   华东仓100 + 华南仓80 + 华北仓60 = 240总库存"
echo "   减去ORDER001占的50，剩余190"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/import" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORDER002",
    "priority": "urgent",
    "items": [
      {"sku": "SKU001", "quantity": 150, "name": "商品A"}
    ]
  }' | python3 -m json.tool
echo ""

echo "4. 导入库存不足订单 - ORDER003"
echo "   购买 SKU999 100件（不存在的SKU）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/import" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORDER003",
    "priority": "normal",
    "items": [
      {"sku": "SKU999", "quantity": 100, "name": "不存在的商品"}
    ]
  }' | python3 -m json.tool
echo ""

echo "5. 生成波次（加急订单优先）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/waves/generate" | python3 -m json.tool
echo ""

echo "6. 查看各仓库统计"
echo "------------------------------------------"
curl -s "$BASE_URL/api/warehouses/stats" | python3 -m json.tool
echo ""

echo "7. 查看订单 ORDER002 详情（跨仓拆分）"
echo "------------------------------------------"
curl -s "$BASE_URL/api/orders/ORDER002" | python3 -m json.tool
echo ""

echo "8. 查看订单 ORDER003 详情（库存不足）"
echo "------------------------------------------"
curl -s "$BASE_URL/api/orders/ORDER003" | python3 -m json.tool
echo ""

echo "9. 导入用于取消的订单 - ORDER004"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/import" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORDER004",
    "priority": "normal",
    "items": [
      {"sku": "SKU002", "quantity": 30, "name": "商品B"}
    ]
  }' | python3 -m json.tool
echo ""

echo "10. 为 ORDER004 单独生成波次"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/waves/generate?order_nos=ORDER004" | python3 -m json.tool
echo ""

echo "11. 取消 ORDER004，释放库存"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/orders/ORDER004/cancel" | python3 -m json.tool
echo ""

echo "12. 查看 ORDER004 详情（看释放的库存记录）"
echo "------------------------------------------"
curl -s "$BASE_URL/api/orders/ORDER004" | python3 -m json.tool
echo ""

echo "13. 验证库存已释放（查看SKU002库存）"
echo "------------------------------------------"
curl -s "$BASE_URL/api/inventory?sku=SKU002" | python3 -m json.tool
echo ""

echo "14. 查看所有波次列表"
echo "------------------------------------------"
curl -s "$BASE_URL/api/waves" | python3 -m json.tool
echo ""

echo "=========================================="
echo "演示完成！"
echo "=========================================="
