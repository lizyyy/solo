#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== API 客户端证书续租系统测试 ==="
echo ""

echo "1. 创建合作方..."
PARTNER_RESP=$(curl -s -X POST "$BASE_URL/partners" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试合作方",
    "code": "TEST_PARTNER_001",
    "description": "用于测试的合作方",
    "contact_name": "张三",
    "contact_email": "zhangsan@example.com",
    "contact_phone": "13800138000",
    "request_id": "req_partner_001"
  }')
echo "响应: $PARTNER_RESP"
PARTNER_ID=$(echo $PARTNER_RESP | jq -r '.data.id')
echo "合作方ID: $PARTNER_ID"
echo ""

echo "2. 创建第一个证书(旧证，即将过期)..."
CERT1_RESP=$(curl -s -X POST "$BASE_URL/certs" \
  -H "Content-Type: application/json" \
  -d "{
    \"partner_id\": \"$PARTNER_ID\",
    \"serial_number\": \"SN1234567890\",
    \"subject\": \"CN=Test Client Cert 1,O=Test Org,C=CN\",
    \"issuer\": \"CN=Test CA,O=Test Org,C=CN\",
    \"not_before\": \"2024-01-01T00:00:00Z\",
    \"not_after\": \"2024-06-30T23:59:59Z\",
    \"fingerprint\": \"SHA256:abcdef1234567890abcdef1234567890\",
    \"cert_content\": \"-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----\",
    \"remark\": \"旧证书\",
    \"request_id\": \"req_cert_001\"
  }")
echo "响应: $CERT1_RESP"
CERT1_ID=$(echo $CERT1_RESP | jq -r '.data.id')
echo "证书1ID: $CERT1_ID"
echo ""

echo "3. 创建第二个证书(新证)..."
CERT2_RESP=$(curl -s -X POST "$BASE_URL/certs" \
  -H "Content-Type: application/json" \
  -d "{
    \"partner_id\": \"$PARTNER_ID\",
    \"serial_number\": \"SN0987654321\",
    \"subject\": \"CN=Test Client Cert 2,O=Test Org,C=CN\",
    \"issuer\": \"CN=Test CA,O=Test Org,C=CN\",
    \"not_before\": \"2024-06-01T00:00:00Z\",
    \"not_after\": \"2025-05-31T23:59:59Z\",
    \"fingerprint\": \"SHA256:0987654321abcdef0987654321abcdef\",
    \"cert_content\": \"-----BEGIN CERTIFICATE-----\nMII...\n-----END CERTIFICATE-----\",
    \"remark\": \"新证书\",
    \"request_id\": \"req_cert_002\"
  }")
echo "响应: $CERT2_RESP"
CERT2_ID=$(echo $CERT2_RESP | jq -r '.data.id')
echo "证书2ID: $CERT2_ID"
echo ""

echo "4. 创建验证请求..."
VERIFY_REQ_RESP=$(curl -s -X POST "$BASE_URL/verifications" \
  -H "Content-Type: application/json" \
  -d "{
    \"partner_id\": \"$PARTNER_ID\",
    \"new_cert_id\": \"$CERT2_ID\",
    \"old_cert_id\": \"$CERT1_ID\",
    \"verification_type\": \"API_CONNECTIVITY\",
    \"verification_data\": \"测试连接数据\",
    \"request_id\": \"req_verify_001\"
  }")
echo "响应: $VERIFY_REQ_RESP"
VERIFY_ID=$(echo $VERIFY_REQ_RESP | jq -r '.data.id')
echo "验证请求ID: $VERIFY_ID"
echo ""

echo "5. 执行验证(通过)..."
VERIFY_RESP=$(curl -s -X POST "$BASE_URL/verifications/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"verification_id\": \"$VERIFY_ID\",
    \"status\": \"SUCCESS\",
    \"verification_result\": \"验证通过，API连接正常\",
    \"verifier\": \"admin\",
    \"request_id\": \"req_verify_exec_001\"
  }")
echo "响应: $VERIFY_RESP"
echo ""

echo "6. 先全量启用旧证书作为当前证书..."
OLD_FULL_RESP=$(curl -s -X POST "$BASE_URL/certs/full-enable" \
  -H "Content-Type: application/json" \
  -d "{
    \"cert_id\": \"$CERT1_ID\",
    \"operator\": \"admin\",
    \"reason\": \"启用旧证书\",
    \"request_id\": \"req_full_old_001\"
  }")
echo "响应: $OLD_FULL_RESP"
echo ""

echo "7. 灰度启用新证书(50%)..."
GRAY_RESP=$(curl -s -X POST "$BASE_URL/certs/gray-enable" \
  -H "Content-Type: application/json" \
  -d "{
    \"cert_id\": \"$CERT2_ID\",
    \"gray_percent\": 50,
    \"operator\": \"admin\",
    \"reason\": \"灰度发布测试\",
    \"request_id\": \"req_gray_001\"
  }")
echo "响应: $GRAY_RESP"
echo ""

echo "8. 全量启用新证书..."
FULL_RESP=$(curl -s -X POST "$BASE_URL/certs/full-enable" \
  -H "Content-Type: application/json" \
  -d "{
    \"cert_id\": \"$CERT2_ID\",
    \"operator\": \"admin\",
    \"reason\": \"全量发布\",
    \"request_id\": \"req_full_001\"
  }")
echo "响应: $FULL_RESP"
echo ""

echo "9. 查看启用历史..."
HISTORY_RESP=$(curl -s -X GET "$BASE_URL/renewal/history?partner_id=$PARTNER_ID")
echo "响应: $HISTORY_RESP"
echo ""

echo "10. 测试幂等性(重复创建合作方)..."
DUP_RESP=$(curl -s -X POST "$BASE_URL/partners" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试合作方",
    "code": "TEST_PARTNER_001",
    "description": "用于测试的合作方",
    "contact_name": "张三",
    "contact_email": "zhangsan@example.com",
    "contact_phone": "13800138000",
    "request_id": "req_partner_001"
  }')
echo "响应: $DUP_RESP"
echo ""

echo "11. 触发续租提醒(提前30天)..."
REMINDER_RESP=$(curl -s -X POST "$BASE_URL/renewal/reminders/trigger" \
  -H "Content-Type: application/json" \
  -d "{
    \"partner_id\": \"$PARTNER_ID\",
    \"days_ahead\": 30,
    \"request_id\": \"req_trigger_reminder_001\"
  }")
echo "响应: $REMINDER_RESP"
echo ""

echo "12. 查询待发送提醒..."
LIST_REMINDER_RESP=$(curl -s -X GET "$BASE_URL/renewal/reminders?partner_id=$PARTNER_ID&is_sent=false")
echo "响应: $LIST_REMINDER_RESP"
echo ""

echo "13. 回退到旧证书..."
ROLLBACK_RESP=$(curl -s -X POST "$BASE_URL/renewal/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"partner_id\": \"$PARTNER_ID\",
    \"cert_id\": \"$CERT1_ID\",
    \"reason\": \"新证书出现问题，回退到旧证书\",
    \"operator\": \"admin\",
    \"request_id\": \"req_rollback_001\"
  }")
echo "响应: $ROLLBACK_RESP"
echo ""

echo "14. 导出证书列表CSV..."
curl -s -X GET "$BASE_URL/export/certs?partner_id=$PARTNER_ID" -o /tmp/certs_export.csv
echo "导出完成，文件大小: $(wc -l /tmp/certs_export.csv)"
echo ""

echo "15. 导出启用历史CSV..."
curl -s -X GET "$BASE_URL/export/history?partner_id=$PARTNER_ID" -o /tmp/history_export.csv
echo "导出完成，文件大小: $(wc -l /tmp/history_export.csv)"
echo ""

echo "=== 测试完成 ==="
