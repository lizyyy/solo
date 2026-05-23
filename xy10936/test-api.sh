#!/bin/bash

echo "========================================"
echo "  废品回收称重 API 测试脚本"
echo "========================================"

BASE_URL="http://localhost:3000/api"

echo ""
echo "1. 健康检查"
curl -s $BASE_URL/health | head -50
echo ""

echo ""
echo "2. 获取客户列表"
curl -s $BASE_URL/customers | head -200
echo ""

echo ""
echo "3. 获取品类列表"
curl -s $BASE_URL/categories | head -200
echo ""

echo ""
echo "4. 创建称重记录（正常路径）"
curl -s -X POST $BASE_URL/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1050.5,
    "tare_weight": 50.5,
    "operator": "测试员"
  }'
echo ""

echo ""
echo "5. 测试坏数据路径 - 毛重小于皮重"
curl -s -X POST $BASE_URL/weighing \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 50.0,
    "tare_weight": 100.0,
    "operator": "测试员"
  }'
echo ""

echo ""
echo "6. 查看异常记录"
curl -s $BASE_URL/exceptions | head -300
echo ""

echo ""
echo "========================================"
echo "  测试完成！请检查以上输出"
echo "========================================"
