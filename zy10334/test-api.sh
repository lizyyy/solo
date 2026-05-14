#!/bin/bash

BASE_URL="http://localhost:8080/api/evidence"

# 安全格式化 JSON: 使用 python3/python，都没有则原样输出
format_json() {
    if command -v python3 > /dev/null 2>&1; then
        python3 -m json.tool 2>/dev/null || cat
    elif command -v python > /dev/null 2>&1; then
        python -m json.tool 2>/dev/null || cat
    else
        cat
    fi
}

echo "=========================================="
echo "接口证据链追踪 API 测试脚本"
echo "=========================================="
echo ""

echo "1. 查询预置的成功证据链 (REQ-TEST-001)"
echo "------------------------------------------------"
RESPONSE=$(curl -s "${BASE_URL}/REQ-TEST-001")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "2. 查询预置的失败证据链 (REQ-TEST-003)"
echo "------------------------------------------------"
RESPONSE=$(curl -s "${BASE_URL}/REQ-TEST-003")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "3. 导出 REQ-TEST-003 的摘要"
echo "------------------------------------------------"
curl -s "${BASE_URL}/summary/REQ-TEST-003"
echo ""
echo ""

echo "4. 按业务单号查询 (ORD-2024-0514-001)"
echo "------------------------------------------------"
RESPONSE=$(curl -s "${BASE_URL}/business/ORD-2024-0514-001")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "5. 条件查询 - 只看 FAILED 状态"
echo "------------------------------------------------"
RESPONSE=$(curl -s "${BASE_URL}/query?status=FAILED")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "6. 触发异常 - 查询不存在的记录"
echo "------------------------------------------------"
RESPONSE=$(curl -s "${BASE_URL}/NOT-EXIST-12345")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "7. 触发异常 - 非法状态流转 (SUCCESS -> FAILED)"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST "${BASE_URL}/status" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"REQ-TEST-001","targetStatus":"FAILED","operator":"test"}')
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "8. 创建新证据链 (测试幂等)"
echo "------------------------------------------------"
NEW_REQ_ID="NEW-REQ-$(date +%Y%m%d%H%M%S)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "9. 重复提交 (测试幂等性 - 应该返回 code=0001)"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST "${BASE_URL}/create" \
  -H "Content-Type: application/json" \
  -d "{\"businessNo\":\"NEW-ORDER-001\",\"requestId\":\"${NEW_REQ_ID}\",\"sourceSystem\":\"TEST\",\"operator\":\"tester\"}")
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "10. 参数校验失败测试"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST "${BASE_URL}/create" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "11. 添加处理动作"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST "${BASE_URL}/action" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"REQ-TEST-003","actionType":"INTERNAL_TRANSFORM","actionName":"内部状态转换","operator":"system"}')
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "12. 添加人工备注"
echo "------------------------------------------------"
RESPONSE=$(curl -s -X POST "${BASE_URL}/remark" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"REQ-TEST-003","remarkContent":"客户反馈已跟进","operator":"support-001"}')
echo "$RESPONSE" | format_json
echo ""
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo "Swagger UI: http://localhost:8080/swagger-ui.html"
echo "H2 Console: http://localhost:8080/h2-console"
