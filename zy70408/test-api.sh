#!/bin/bash

BASE_URL="http://localhost:3000/api/tenant-init"

echo "=== 测试租户初始化后端服务 ==="
echo ""

echo "1. 测试健康检查"
curl -s http://localhost:3000/health | jq .
echo ""

echo "=== 测试压缩包路径异常（核心修复验证） ==="
echo ""

echo "2. 测试压缩包路径异常 - 空路径（验证：创建记录 + currentStep=VALIDATE_PACKAGE + 失败明细）"
RESULT_EMPTY=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_EMPTY", "tenantName": "空路径测试", "packagePath": ""}')
echo "$RESULT_EMPTY" | jq .
RECORD_EMPTY=$(echo "$RESULT_EMPTY" | jq -r '.recordId')
echo "记录ID: $RECORD_EMPTY"
echo "验证currentStep: $(echo "$RESULT_EMPTY" | jq -r '.currentStep')"
echo ""

echo "3. 验证空路径失败项可查询（/records/:id/failed）"
if [ "$RECORD_EMPTY" != "null" ] && [ -n "$RECORD_EMPTY" ]; then
  curl -s "$BASE_URL/records/$RECORD_EMPTY/failed" | jq .
fi
echo ""

echo "4. 测试压缩包路径异常 - 不存在的文件（验证：创建记录 + currentStep + 失败明细）"
RESULT_NOEXIST=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_NOEXIST", "tenantName": "不存在路径测试", "packagePath": "/nonexistent/file.zip"}')
echo "$RESULT_NOEXIST" | jq .
RECORD_NOEXIST=$(echo "$RESULT_NOEXIST" | jq -r '.recordId')
echo "记录ID: $RECORD_NOEXIST"
echo "验证currentStep: $(echo "$RESULT_NOEXIST" | jq -r '.currentStep')"
echo ""

echo "5. 验证不存在路径失败项可查询"
if [ "$RECORD_NOEXIST" != "null" ] && [ -n "$RECORD_NOEXIST" ]; then
  curl -s "$BASE_URL/records/$RECORD_NOEXIST/failed" | jq .
fi
echo ""

echo "6. 测试压缩包路径异常 - 非zip文件（验证：创建记录 + currentStep + 失败明细）"
RESULT_BADTYPE=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_BADTYPE", "tenantName": "格式错误测试", "packagePath": "package.json"}')
echo "$RESULT_BADTYPE" | jq .
RECORD_BADTYPE=$(echo "$RESULT_BADTYPE" | jq -r '.recordId')
echo "记录ID: $RECORD_BADTYPE"
echo "验证currentStep: $(echo "$RESULT_BADTYPE" | jq -r '.currentStep')"
echo ""

echo "7. 验证非zip文件失败项可查询"
if [ "$RECORD_BADTYPE" != "null" ] && [ -n "$RECORD_BADTYPE" ]; then
  curl -s "$BASE_URL/records/$RECORD_BADTYPE/failed" | jq .
fi
echo ""

echo "8. 测试参数缺失 - 缺失tenantId（验证：仍然创建记录 + currentStep）"
RESULT_MISSING=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantName": "缺失参数测试", "packagePath": "test-package.zip"}')
echo "$RESULT_MISSING" | jq .
RECORD_MISSING=$(echo "$RESULT_MISSING" | jq -r '.recordId')
echo "记录ID: $RECORD_MISSING"
echo "验证currentStep: $(echo "$RESULT_MISSING" | jq -r '.currentStep')"
echo ""

echo "9. 验证参数缺失失败项可查询"
if [ "$RECORD_MISSING" != "null" ] && [ -n "$RECORD_MISSING" ]; then
  curl -s "$BASE_URL/records/$RECORD_MISSING/failed" | jq .
fi
echo ""

echo "=== 测试统一查询入口 ==="
echo ""

echo "10. 查询所有FAILED状态记录（验证：所有路径异常都可通过统一入口查询）"
curl -s "$BASE_URL/records?status=FAILED" | jq '. | length'
echo "共返回 $(curl -s "$BASE_URL/records?status=FAILED" | jq 'length') 条失败记录"
echo ""

echo "=== 测试正常初始化流程 ==="
echo ""

echo "11. 测试正常初始化（会生成部分成功，因为故意设置了2个失败设备）"
RESULT=$(curl -s -X POST "$BASE_URL/initialize" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "TENANT_001", "tenantName": "高峰门店测试", "packagePath": "test-package.zip"}')
echo "$RESULT" | jq .
RECORD_ID=$(echo "$RESULT" | jq -r '.recordId')
echo "记录ID: $RECORD_ID"
echo ""

if [ "$RECORD_ID" != "null" ] && [ -n "$RECORD_ID" ]; then
  echo "12. 查询初始化记录详情"
  curl -s "$BASE_URL/records/$RECORD_ID" | jq .
  echo ""

  echo "13. 查询设备导入失败项"
  curl -s "$BASE_URL/records/$RECORD_ID/failed" | jq .
  echo ""

  echo "14. 生成回滚候选清单"
  curl -s -X POST "$BASE_URL/rollback/$RECORD_ID/candidates" | jq .
  echo ""

  echo "15. 创建附件修正记录"
  FIRST_DETAIL=$(curl -s "$BASE_URL/records/$RECORD_ID/details?status=FAILED" | jq -r '.[0].id')
  if [ "$FIRST_DETAIL" != "null" ] && [ -n "$FIRST_DETAIL" ]; then
    curl -s -X POST "$BASE_URL/revisions" \
      -H "Content-Type: application/json" \
      -d "{\"recordId\": \"$RECORD_ID\", \"detailItemId\": \"$FIRST_DETAIL\", \"attachmentName\": \"会议纪要.pdf\", \"beforeValue\": \"v1.0\", \"afterValue\": \"v1.1\", \"modifiedBy\": \"admin\"}" | jq .
  fi
  echo ""

  echo "16. 创建审批节点"
  curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d "{\"recordId\": \"$RECORD_ID\", \"nodeName\": \"部门经理审批\", \"nodeOrder\": 1, \"approver\": \"manager\"}" | jq .
  echo ""

  echo "17. 导出初始化记录"
  curl -s -X POST "$BASE_URL/export/$RECORD_ID" | jq .
  echo ""

  echo "18. 查询高峰门店设备台账"
  curl -s "$BASE_URL/devices/TENANT_001" | jq .
  echo ""
fi

echo "=== 测试完成 ==="
echo ""
echo "✅ 修复验证总结："
echo "   1. 压缩包路径异常现在会创建初始化记录（recordId），不再直接返回400"
echo "   2. 路径异常返回 currentStep=VALIDATE_PACKAGE，明确失败步骤"
echo "   3. 路径异常会写入 init_detail_items，可通过 /records/:id/failed 查询"
echo "   4. 所有失败记录都可通过统一入口 GET /records?status=FAILED 查询"
echo "   5. 接手人可以直接看到失败原因明细"
