#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "========================================="
echo "审计证据水印API 测试脚本"
echo "========================================="
echo ""

echo "[1/12] 健康检查..."
curl -s "http://localhost:3000/health" | python3 -m json.tool
echo ""

echo "[2/12] 创建证据包 (正常流程)..."
PACKAGE_RESPONSE=$(curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-2024-001",
    "evidenceType": "financial_report",
    "fileName": "audit_report_2024.pdf",
    "fileHash": "abc123def456",
    "description": "年度财务审计报告"
  }')
echo "$PACKAGE_RESPONSE" | python3 -m json.tool
PACKAGE_ID=$(echo "$PACKAGE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Package ID: $PACKAGE_ID"
echo ""

echo "[3/12] 查询证据包..."
curl -s "$BASE_URL/packages/$PACKAGE_ID" | python3 -m json.tool
echo ""

echo "[4/12] 列出所有证据包..."
curl -s "$BASE_URL/packages" | python3 -m json.tool
echo ""

echo "[5/12] 创建下载人..."
DOWNLOADER_RESPONSE=$(curl -s -X POST "$BASE_URL/downloaders" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "name": "张三",
    "department": "内审部",
    "email": "zhangsan@company.com"
  }')
echo "$DOWNLOADER_RESPONSE" | python3 -m json.tool
DOWNLOADER_ID=$(echo "$DOWNLOADER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Downloader ID: $DOWNLOADER_ID"
echo ""

echo "[6/12] 创建水印..."
curl -s -X POST "$BASE_URL/watermarks" \
  -H "Content-Type: application/json" \
  -d "{
    \"packageId\": \"$PACKAGE_ID\",
    \"downloaderId\": \"$DOWNLOADER_ID\",
    \"customText\": \"机密-仅供内部使用\"
  }" | python3 -m json.tool
echo ""

echo "[7/12] 重复创建同一水印 (测试幂等性)..."
echo ">> 再次调用相同接口，应该返回已有记录，不创建重复..."
curl -s -X POST "$BASE_URL/watermarks" \
  -H "Content-Type: application/json" \
  -d "{
    \"packageId\": \"$PACKAGE_ID\",
    \"downloaderId\": \"$DOWNLOADER_ID\",
    \"customText\": \"机密-仅供内部使用\"
  }" | python3 -m json.tool
echo ""

echo "[8/12] 创建授权..."
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/authorizations" \
  -H "Content-Type: application/json" \
  -d "{
    \"packageId\": \"$PACKAGE_ID\",
    \"downloaderId\": \"$DOWNLOADER_ID\",
    \"scope\": \"download\",
    \"grantedBy\": \"admin\"
  }")
echo "$AUTH_RESPONSE" | python3 -m json.tool
AUTH_ID=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "Authorization ID: $AUTH_ID"
echo ""

echo "[9/12] 记录下载..."
curl -s -X POST "$BASE_URL/downloads" \
  -H "Content-Type: application/json" \
  -d "{
    \"packageId\": \"$PACKAGE_ID\",
    \"downloaderId\": \"$DOWNLOADER_ID\",
    \"ipAddress\": \"192.168.1.100\"
  }" | python3 -m json.tool
echo ""

echo "[10/12] 人工修正..."
curl -s -X PATCH "$BASE_URL/packages/$PACKAGE_ID/correct" \
  -H "Content-Type: application/json" \
  -d "{
    \"corrections\": {
      \"description\": \"2024年度财务审计报告-修订版\"
    },
    \"correctedBy\": \"admin\"
  }" | python3 -m json.tool
echo ""

echo "[11/12] 查看失败记录 (包含之前的失败)..."
curl -s "$BASE_URL/failures" | python3 -m json.tool
echo ""

echo "[12/12] 导出追踪数据..."
curl -s "$BASE_URL/export?packageId=$PACKAGE_ID" | python3 -m json.tool
echo ""

echo "========================================="
echo "异常流程测试"
echo "========================================="
echo ""

echo "[异常1] 创建不完整的证据包 (缺少必填字段)..."
curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-2024-002",
    "fileName": "missing_fields.pdf"
  }' | python3 -m json.tool
echo ""

echo "[异常2] 无效的状态流转 (直接从 created 到 downloaded)..."
curl -s -X PATCH "$BASE_URL/packages/$PACKAGE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "downloaded",
    "reason": "无效状态转换测试"
  }' | python3 -m json.tool
echo ""

echo "[异常3] 未授权的下载尝试..."
TEMP_PACKAGE=$(curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "CASE-2024-999",
    "evidenceType": "test",
    "fileName": "test.pdf",
    "fileHash": "test123"
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

curl -s -X POST "$BASE_URL/downloads" \
  -H "Content-Type: application/json" \
  -d "{
    \"packageId\": \"$TEMP_PACKAGE\",
    \"downloaderId\": \"$DOWNLOADER_ID\",
    \"ipAddress\": \"10.0.0.1\"
  }" | python3 -m json.tool
echo ""

echo "========================================="
echo "测试完成！查看最终失败记录..."
echo "========================================="
curl -s "$BASE_URL/failures" | python3 -m json.tool
echo ""

echo "测试脚本执行完毕！"
