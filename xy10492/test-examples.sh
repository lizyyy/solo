#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=========================================="
echo "团购核销防串码 API 测试脚本"
echo "=========================================="
echo ""

echo "1. 健康检查"
echo "-----------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

echo "2. 场景一：正常核销（上海餐饮券在上海门店）"
echo "-----------------"
echo "请求：上海餐饮券 FOOD-SH-001-ABC123 在上海门店 STORE001 核销"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FOOD-SH-001-ABC123",
    "storeId": "STORE001",
    "requestId": "REQ-NORMAL-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "3. 场景二：跨门店拒绝（上海券在北京门店核销）"
echo "-----------------"
echo "请求：北京餐饮券 FOOD-BJ-002-XYZ789 在上海门店 STORE001 核销"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FOOD-BJ-002-XYZ789",
    "storeId": "STORE001",
    "requestId": "REQ-CROSS-STORE-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "4. 场景三：退款后拒绝（已退款券码核销）"
echo "-----------------"
echo "请求：已退款亲子券 FAMILY-BJ-004-GHI012 在任意门店核销"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FAMILY-BJ-004-GHI012",
    "storeId": "STORE004",
    "requestId": "REQ-REFUNDED-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "5. 场景四：重复核销幂等（同一 requestId 再次提交）"
echo "-----------------"
echo "第一次请求：亲子券 FAMILY-SH-003-DEF456 在 STORE003 核销"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FAMILY-SH-003-DEF456",
    "storeId": "STORE003",
    "requestId": "REQ-IDEMPOTENT-001"
  }' | python3 -m json.tool
echo ""
echo "第二次请求：使用相同的 requestId 再次提交（应返回相同结果，不重复核销）"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FAMILY-SH-003-DEF456",
    "storeId": "STORE003",
    "requestId": "REQ-IDEMPOTENT-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "6. 场景五：已核销券码拒绝（幂等之外的重复核销）"
echo "-----------------"
echo "请求：已核销券 FOOD-SH-005-JKL345 再次核销"
curl -s -X POST "$BASE_URL/api/coupons/redeem" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FOOD-SH-005-JKL345",
    "storeId": "STORE001",
    "requestId": "REQ-REDEEMED-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "7. 统计查询：查看所有统计数据"
echo "-----------------"
curl -s "$BASE_URL/api/statistics" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
