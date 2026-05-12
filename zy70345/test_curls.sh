#!/bin/bash

BASE_URL="http://localhost:3001"

echo "=== 客户数据删除 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health"
echo ""
echo ""

echo "2. 场景一：完全删除（客户 C003 - 王五，数据都超过保留期）"
echo "   创建删除请求..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C003",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "王五",
      "email": "wangwu@example.com",
      "phone": "13800138003"
    }
  }')

echo "$CREATE_RESPONSE"
REQUEST_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "   请求ID: $REQUEST_ID"
echo ""

if [ -n "$REQUEST_ID" ]; then
  echo "   扫描数据..."
  curl -s "$BASE_URL/api/deletion/requests/$REQUEST_ID/scan"
  echo ""
  echo ""
  
  echo "   分析删除 eligibility..."
  curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID/analyze"
  echo ""
  echo ""
  
  echo "   执行删除..."
  curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID/execute"
  echo ""
  echo ""
  
  echo "   完成并生成证明..."
  curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID/complete"
  echo ""
  echo ""
fi

echo "3. 场景二：部分保留（客户 C001 - 张三，有订单在保留期内）"
echo "   创建删除请求..."
CREATE_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }')

echo "$CREATE_RESPONSE2"
REQUEST_ID2=$(echo "$CREATE_RESPONSE2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "   请求ID: $REQUEST_ID2"
echo ""

if [ -n "$REQUEST_ID2" ]; then
  echo "   扫描数据..."
  curl -s "$BASE_URL/api/deletion/requests/$REQUEST_ID2/scan"
  echo ""
  echo ""
  
  echo "   分析删除 eligibility..."
  ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/analyze")
  echo "$ANALYZE_RESPONSE"
  echo ""
  echo ""
  
  echo "   执行删除..."
  curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/execute"
  echo ""
  echo ""
  
  echo "   完成并生成证明..."
  COMPLETE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/complete")
  echo "$COMPLETE_RESPONSE"
  echo ""
  echo ""
  
  CERT_NUMBER=$(echo "$COMPLETE_RESPONSE" | grep -o '"certificate_number":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$CERT_NUMBER" ]; then
    echo "   查询合规视角证明..."
    curl -s "$BASE_URL/api/deletion/certificates/$CERT_NUMBER?view=compliance"
    echo ""
    echo ""
    
    echo "   查询客户视角证明..."
    curl -s "$BASE_URL/api/deletion/certificates/$CERT_NUMBER?view=customer"
    echo ""
    echo ""
  fi
fi

echo "4. 场景三：身份验证失败（客户 C002 - 李四，验证信息错误）"
echo "   创建删除请求..."
curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C002",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "李四",
      "email": "wrong@example.com"
    }
  }'
echo ""
echo ""

echo "5. 场景四：重复请求测试"
echo "   再次创建 C001 的删除请求（应该失败）..."
curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }'
echo ""
echo ""

echo "6. 合规仪表板查询"
curl -s "$BASE_URL/api/deletion/compliance/dashboard"
echo ""
echo ""

echo "=== 测试完成 ==="
