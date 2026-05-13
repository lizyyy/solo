#!/bin/bash

BASE_URL="http://localhost:3000"
SECURITY_TOKEN="token-security-service"
ADMIN_TOKEN="token-admin-service"
CUSTOMER_SERVICE_TOKEN="token-customer-service"

USER_ID="user-1"
TENANT_ID="tenant-1"

echo "=========================================="
echo "场景 1: 正常登录流程"
echo "=========================================="
echo ""

echo "1. 用户登录创建会话（带设备指纹）"
DEVICE1_FP='{"browser":"Chrome","os":"macOS","screen":"1920x1080","userAgent":"Mozilla/5.0 Chrome/120.0"}'
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"deviceFingerprintData\":${DEVICE1_FP}}")
echo "响应:"
echo "${LOGIN_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${LOGIN_RESPONSE}"
SESSION1_ID=$(echo "${LOGIN_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['sessionId'])")
DEVICE1_ID=$(echo "${LOGIN_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['deviceFingerprintId'])")
echo "会话ID: ${SESSION1_ID}"
echo "设备指纹ID: ${DEVICE1_ID}"
echo ""

echo "2. 刷新令牌（正常会话）"
REFRESH_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION1_ID}/refresh")
echo "响应:"
echo "${REFRESH_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${REFRESH_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 2: 多设备登录"
echo "=========================================="
echo ""

echo "3. 用户在第二台设备登录"
DEVICE2_FP='{"browser":"Safari","os":"iOS","screen":"1170x2532","userAgent":"Mozilla/5.0 Safari/605.1"}'
LOGIN2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"deviceFingerprintData\":${DEVICE2_FP}}")
echo "响应:"
echo "${LOGIN2_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${LOGIN2_RESPONSE}"
SESSION2_ID=$(echo "${LOGIN2_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['sessionId'])")
DEVICE2_ID=$(echo "${LOGIN2_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['deviceFingerprintId'])")
echo "会话ID: ${SESSION2_ID}"
echo "设备指纹ID: ${DEVICE2_ID}"
echo ""

echo "=========================================="
echo "场景 3: 写入风险事件"
echo "=========================================="
echo ""

echo "4. 安全系统检测到异常，写入高风险事件"
RISK_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/risk-events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SECURITY_TOKEN}" \
  -d "{
    \"userId\": \"${USER_ID}\",
    \"deviceFingerprintId\": \"${DEVICE2_ID}\",
    \"riskLevel\": \"high\",
    \"evidence\": {
      \"type\": \"unusual_location\",
      \"description\": \"检测到来自异常地理位置的登录\",
      \"ip\": \"192.168.1.100\",
      \"location\": \"Beijing, CN\",
      \"previousLocation\": \"Shanghai, CN\",
      \"confidence\": 0.95
    }
  }")
echo "响应:"
echo "${RISK_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RISK_RESPONSE}"
RISK_EVENT_ID=$(echo "${RISK_RESPONSE}" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "风险事件ID: ${RISK_EVENT_ID}"
echo ""

echo "=========================================="
echo "场景 4: 预览踢出影响"
echo "=========================================="
echo ""

echo "5. 预览单设备踢出影响"
PREVIEW_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/kick/preview" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SECURITY_TOKEN}" \
  -d "{
    \"userId\": \"${USER_ID}\",
    \"deviceFingerprintId\": \"${DEVICE2_ID}\"
  }")
echo "响应:"
echo "${PREVIEW_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${PREVIEW_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 5: 单设备踢出（低风险策略）"
echo "=========================================="
echo ""

echo "6. 踢出异常设备（仅踢出设备2的会话）"
KICK_SINGLE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/kick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SECURITY_TOKEN}" \
  -d "{
    \"userId\": \"${USER_ID}\",
    \"deviceFingerprintId\": \"${DEVICE2_ID}\",
    \"reason\": \"检测到异常位置登录\",
    \"evidence\": {\"riskEventId\": \"${RISK_EVENT_ID}\"}
  }")
echo "响应:"
echo "${KICK_SINGLE_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${KICK_SINGLE_RESPONSE}"
echo ""

echo "7. 验证设备1会话仍可刷新"
REFRESH1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION1_ID}/refresh")
echo "设备1会话刷新响应:"
echo "${REFRESH1_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${REFRESH1_RESPONSE}"
echo ""

echo "8. 验证设备2会话无法刷新"
REFRESH2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION2_ID}/refresh")
echo "设备2会话刷新响应:"
echo "${REFRESH2_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${REFRESH2_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 6: 全量踢出（高风险策略）"
echo "=========================================="
echo ""

echo "9. 踢出用户所有设备（高风险）"
KICK_ALL_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/kick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SECURITY_TOKEN}" \
  -d "{
    \"userId\": \"${USER_ID}\",
    \"riskLevel\": \"high\",
    \"reason\": \"账号疑似被盗，全面踢出\",
    \"evidence\": {\"riskEventId\": \"${RISK_EVENT_ID}\"},
    \"restrictLogin\": true,
    \"restrictDurationMinutes\": 1440
  }")
echo "响应:"
echo "${KICK_ALL_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${KICK_ALL_RESPONSE}"
echo ""

echo "10. 验证设备1会话也被踢出"
REFRESH1_AGAIN=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION1_ID}/refresh")
echo "设备1会话刷新响应:"
echo "${REFRESH1_AGAIN}" | python3 -m json.tool 2>/dev/null || echo "${REFRESH1_AGAIN}"
echo ""

echo "11. 验证用户无法创建新会话（登录限制）"
NEW_LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"deviceFingerprintData\":${DEVICE1_FP}}")
echo "新登录响应:"
echo "${NEW_LOGIN_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${NEW_LOGIN_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 7: 解除登录限制"
echo "=========================================="
echo ""

echo "12. 解除用户的登录限制"
UNRESTRICT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/login-restrictions/${USER_ID}/unrestrict" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d "{\"reason\": \"用户身份已验证，解除限制\"}")
echo "响应:"
echo "${UNRESTRICT_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${UNRESTRICT_RESPONSE}"
echo ""

echo "13. 验证用户现在可以创建新会话"
AFTER_UNRESTRICT=$(curl -s -X POST "${BASE_URL}/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_ID}\",\"deviceFingerprintData\":${DEVICE1_FP}}")
echo "新登录响应:"
echo "${AFTER_UNRESTRICT}" | python3 -m json.tool 2>/dev/null || echo "${AFTER_UNRESTRICT}"
NEW_SESSION_ID=$(echo "${AFTER_UNRESTRICT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['sessionId'])")
echo "新会话ID: ${NEW_SESSION_ID}"
echo ""

echo "=========================================="
echo "场景 8: 审计查询（客服视角）"
echo "=========================================="
echo ""

echo "14. 查询用户审计记录（客服视角）"
AUDIT_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/audit/users/${USER_ID}" \
  -H "Authorization: Bearer ${CUSTOMER_SERVICE_TOKEN}")
echo "响应:"
echo "${AUDIT_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${AUDIT_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 9: 重复踢出（幂等性测试）"
echo "=========================================="
echo ""

echo "15. 再次踢出已被踢出的会话（应该返回已踢出）"
REKICK_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/sessions/${SESSION1_ID}/kick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SECURITY_TOKEN}" \
  -d "{\"reason\": \"重复测试\"}")
echo "响应:"
echo "${REKICK_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${REKICK_RESPONSE}"
echo ""

echo "=========================================="
echo "场景 10: 租户管理员操作（需要原因）"
echo "=========================================="
echo ""

echo "16. 租户管理员不带原因踢出（应该失败）"
TENANT_ADMIN_FAIL=$(curl -s -X POST "${BASE_URL}/api/sessions/${NEW_SESSION_ID}/kick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token-tenant-admin-1" \
  -d "{}")
echo "响应（应该失败）:"
echo "${TENANT_ADMIN_FAIL}" | python3 -m json.tool 2>/dev/null || echo "${TENANT_ADMIN_FAIL}"
echo ""

echo "17. 租户管理员带原因踢出（应该成功）"
TENANT_ADMIN_SUCCESS=$(curl -s -X POST "${BASE_URL}/api/sessions/${NEW_SESSION_ID}/kick" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token-tenant-admin-1" \
  -d "{\"reason\": \"租户管理员安全操作，用户主动请求踢出\"}")
echo "响应:"
echo "${TENANT_ADMIN_SUCCESS}" | python3 -m json.tool 2>/dev/null || echo "${TENANT_ADMIN_SUCCESS}"
echo ""

echo "=========================================="
echo "所有示例场景执行完毕！"
echo "=========================================="
