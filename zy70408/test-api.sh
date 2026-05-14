#!/bin/bash

BASE_URL="http://localhost:3000/api/tenant-init"

echo "=== 测试租户初始化后端服务 ==="
echo ""

echo "1. 测试健康检查"
curl -s http://localhost:3000/health | jq .
echo ""

echo "2. 测试压缩包路径异常 - 空路径"
curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_001", "tenantName": "高峰门店测试", "packagePath": ""}' | jq .
echo ""

echo "3. 测试压缩包路径异常 - 不存在的文件"
curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_001", "tenantName": "高峰门店测试", "packagePath": "/nonexistent/file.zip"}' | jq .
echo ""

echo "4. 测试压缩包路径异常 - 非zip文件"
curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_001", "tenantName": "高峰门店测试", "packagePath": "package.json"}' | jq .
echo ""

echo "5. 测试正常初始化（会生成部分成功，因为故意设置了2个失败设备）"
RESULT=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_001", "tenantName": "高峰门店测试", "packagePath": "test-package.zip"}')
echo "$RESULT" | jq .
RECORD_ID=$(echo "$RESULT" | jq -r '.recordId')
echo "记录ID: $RECORD_ID"
echo ""

if [ "$RECORD_ID" != "null" ] && [ -n "$RECORD_ID" ]; then
  echo "6. 查询初始化记录详情"
  curl -s "$BASE_URL/records/$RECORD_ID" | jq .
  echo ""

  echo "7. 查询失败项"
  curl -s "$BASE_URL/records/$RECORD_ID/failed" | jq .
  echo ""

  echo "8. 生成回滚候选清单"
  curl -s -X POST "$BASE_URL/rollback/$RECORD_ID/candidates" | jq .
  echo ""

  echo "9. 创建附件修正记录"
  FIRST_DETAIL=$(curl -s "$BASE_URL/records/$RECORD_ID/details?status=FAILED" | jq -r '.[0].id')
  if [ "$FIRST_DETAIL" != "null" ] && [ -n "$FIRST_DETAIL" ]; then
    curl -s -X POST "$BASE_URL/revisions" \
      -H "Content-Type: application/json" \
      -d "{\"recordId\": \"$RECORD_ID\", \"detailItemId\": \"$FIRST_DETAIL\", \"attachmentName\": \"会议纪要.pdf\", \"beforeValue\": \"v1.0\", \"afterValue\": \"v1.1\", \"modifiedBy\": \"admin\"}" | jq .
  fi
  echo ""

  echo "10. 创建审批节点"
  curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d "{\"recordId\": \"$RECORD_ID\", \"nodeName\": \"部门经理审批\", \"nodeOrder\": 1, \"approver\": \"manager\"}" | jq .
  echo ""

  echo "11. 导出初始化记录"
  curl -s -X POST "$BASE_URL/export/$RECORD_ID" | jq .
  echo ""

  echo "12. 查询高峰门店设备台账"
  curl -s "$BASE_URL/devices/TENANT_001" | jq .
  echo ""
fi

echo "=== 测试完成 ==="
echo ""
echo "提示：失败项已单独保存，可以通过 GET /api/tenant-init/records/:recordId/failed 查看"
echo "提示：成功和失败路径都可以通过 GET /api/tenant-init/records?status=xxx 查询"
echo "提示：开通失败时会返回 currentStep 字段指示停在哪个初始化步骤"
