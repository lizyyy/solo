#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 数据契约例外API测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s http://localhost:8080/health
echo ""
echo ""

echo "2. 创建样例数据"
curl -s -X POST "$BASE_URL/sample-data"
echo ""
echo ""

echo "3. 获取所有例外记录"
curl -s "$BASE_URL/exceptions" | python3 -m json.tool
echo ""
echo ""

echo "4. 获取第一个例外的ID"
FIRST_EXCEPTION_ID=$(curl -s "$BASE_URL/exceptions" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")
echo "例外ID: $FIRST_EXCEPTION_ID"
echo ""

echo "5. 审批第一个例外（状态从PENDING到ACTIVE）"
curl -s -X POST "$BASE_URL/exceptions/$FIRST_EXCEPTION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "manager@example.com"}' | python3 -m json.tool
echo ""
echo ""

echo "6. 再次审批同一个例外（预期状态不会推进，返回错误）"
echo "验证幂等性..."
curl -s -X POST "$BASE_URL/exceptions/$FIRST_EXCEPTION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "manager@example.com"}' | python3 -m json.tool
echo ""
echo ""

echo "7. 记录例外命中（user.payment.card_number字段）"
PAYMENT_EXCEPTION_ID=$(curl -s "$BASE_URL/exceptions" | python3 -c "import sys, json; data=json.load(sys.stdin); [print(x['id']) for x in data if x['field_path'] == 'user.payment.card_number']")
curl -s -X POST "$BASE_URL/exceptions/$PAYMENT_EXCEPTION_ID/hit" \
  -H "Content-Type: application/json" \
  -d '{
    "field_path": "user.payment.card_number",
    "actual_value": "****-****-****-1234",
    "expected_value": "valid_format_card_number",
    "source_system": "order-service",
    "request_id": "req-001"
  }' | python3 -m json.tool
echo ""
echo ""

echo "8. 查看命中记录"
curl -s "$BASE_URL/exceptions/$PAYMENT_EXCEPTION_ID/hits" | python3 -m json.tool
echo ""
echo ""

echo "9. 申请恢复"
curl -s -X POST "$BASE_URL/exceptions/$PAYMENT_EXCEPTION_ID/request-recovery" \
  -H "Content-Type: application/json" \
  -d '{"requested_by": "dev@example.com", "recovery_notes": "上游系统改造完成，准备恢复严格校验"}' | python3 -m json.tool
echo ""
echo ""

echo "10. 审批恢复"
curl -s -X POST "$BASE_URL/exceptions/$PAYMENT_EXCEPTION_ID/approve-recovery" \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "security@example.com"}' | python3 -m json.tool
echo ""
echo ""

echo "11. 完成恢复"
curl -s -X POST "$BASE_URL/exceptions/$PAYMENT_EXCEPTION_ID/complete-recovery" | python3 -m json.tool
echo ""
echo ""

echo "12. 查看异常记录"
curl -s "$BASE_URL/anomalies" | python3 -m json.tool
echo ""
echo ""

echo "13. 导出所有恢复报告"
curl -s -o all-reports.csv "$BASE_URL/reports/export-all"
echo "报告已导出到 all-reports.csv"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "API端点列表:"
echo "  POST /api/v1/exceptions - 创建例外"
echo "  GET  /api/v1/exceptions - 查询所有例外"
echo "  GET  /api/v1/exceptions/:id - 查询单个例外"
echo "  POST /api/v1/exceptions/:id/approve - 审批例外"
echo "  POST /api/v1/exceptions/:id/reject - 拒绝例外"
echo "  POST /api/v1/exceptions/:id/hit - 记录命中"
echo "  POST /api/v1/exceptions/:id/request-recovery - 申请恢复"
echo "  POST /api/v1/exceptions/:id/approve-recovery - 审批恢复"
echo "  POST /api/v1/exceptions/:id/complete-recovery - 完成恢复"
echo "  POST /api/v1/exceptions/:id/manual-correction - 人工修正"
echo "  GET  /api/v1/exceptions/:id/hits - 查询命中记录"
echo "  GET  /api/v1/exceptions/:id/export-report - 导出恢复报告"
echo "  GET  /api/v1/anomalies - 查询异常记录"
echo "  POST /api/v1/anomalies/:id/resolve - 解决异常"
echo "  GET  /api/v1/reports/export-all - 导出所有报告"
echo "  POST /api/v1/sample-data - 创建样例数据"
echo "  POST /api/v1/check-expired - 检查并标记过期例外"
