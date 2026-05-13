#!/bin/bash

BASE_URL="http://localhost:8080/api"

echo "=========================================="
echo "接口证据链追踪 API 测试脚本"
echo "=========================================="
echo ""

echo "1. 查询预置的成功证据链 (REQ-TEST-001)"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/REQ-TEST-001" | python -m json.tool 2>/dev/null || curl -s "${BASE_URL}/evidence/REQ-TEST-001"
echo ""
echo ""

echo "2. 查询预置的失败证据链 (REQ-TEST-003)"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/REQ-TEST-003" | python -m json.tool 2>/dev/null || curl -s "${BASE_URL}/evidence/REQ-TEST-003"
echo ""
echo ""

echo "3. 导出 REQ-TEST-003 的摘要"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/summary/REQ-TEST-003"
echo ""
echo ""

echo "4. 按业务单号查询 (ORD-2024-0514-001)"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/business/ORD-2024-0514-001" | python -m json.tool 2>/dev/null || curl -s "${BASE_URL}/evidence/business/ORD-2024-0514-001"
echo ""
echo ""

echo "5. 条件查询 - 只看 FAILED 状态"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/query?status=FAILED" | python -m json.tool 2>/dev/null || curl -s "${BASE_URL}/evidence/query?status=FAILED"
echo ""
echo ""

echo "6. 触发异常 - 查询不存在的记录"
echo "------------------------------------------------"
curl -s "${BASE_URL}/evidence/NOT-EXIST-12345" | python -m json.tool 2>/dev/null || curl -s "${BASE_URL}/evidence/NOT-EXIST-12345"
echo ""
echo ""

echo "7. 触发异常 - 非法状态流转 (SUCCESS -> FAILED)"
echo "------------------------------------------------"
curl -s -X POST "${BASE_URL}/evidence/status" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"REQ-TEST-001","targetStatus":"FAILED","operator":"test"}' \
  | python -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/evidence/status" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"REQ-TEST-001","targetStatus":"FAILED","operator":"test"}'
echo ""
echo ""

echo "8. 创建新证据链 (测试幂等)"
echo "------------------------------------------------"
NEW_REQ_ID="NEW-REQ-$(date +%Y%m%d%H%M%S)"
curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}" \
  | python -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}"
echo ""
echo ""

echo "9. 重复提交 (测试幂等性 - 应该返回 code=0001)"
echo "------------------------------------------------"
curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}" \
  | python -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}"
echo ""
echo ""

echo "10. 参数校验失败测试"
echo "------------------------------------------------"
curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d '{}' \
  | python -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/evidence/create" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo "Swagger UI: ${BASE_URL}/swagger-ui.html"
echo "H2 Console: ${BASE_URL}/h2-console"
