#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/feature-flag"

echo "=========================================="
echo "  特征开关命中审计 API - 测试脚本"
echo "=========================================="
echo ""

echo "1. 测试正常请求 - 命中分桶"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_normal_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "normal_user_001",
    "userAttributes": {
      "userId": "normal_user_001",
      "country": "CN",
      "userSegment": "new"
    }
  }' | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "2. 测试重复请求 - 应该被拦截返回 409"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_normal_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "normal_user_001",
    "userAttributes": {}
  }' | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "3. 测试覆盖用户 - QA账号强制命中"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_override_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "qa_user_001",
    "userAttributes": {}
  }' | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "4. 查询失败记录"
echo "------------------------------------------"
curl -s "$BASE_URL/audit/failed" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "5. 查询审计记录列表"
echo "------------------------------------------"
curl -s "$BASE_URL/audit?page=0&size=5" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "6. 人工补偿失败记录"
echo "------------------------------------------"
curl -X POST "$BASE_URL/audit/3/compensate?compensatedBy=admin_test" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "7. 导出审计记录"
echo "------------------------------------------"
curl -s -o audit_export.csv "$BASE_URL/audit/export?experimentKey=button_color_test"
echo "导出完成，文件: audit_export.csv"
echo ""

echo "=========================================="
echo "  测试完成!"
echo "=========================================="
