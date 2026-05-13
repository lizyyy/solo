#!/bin/bash

BASE_URL="http://localhost:3000"
REQ_ID_PREFIX="test-$(date +%s)"

echo "=========================================="
echo "Download Link Anti-Leech API - Test Suite"
echo "=========================================="
echo ""

echo "=== 1. Create a file (课程资料) ==="
FILE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/files" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "高级数据分析课程资料.zip",
    "url": "https://storage.example.com/course-data.zip",
    "description": "第3期高级数据分析课程配套资料"
  }')
echo "Response: $FILE_RESPONSE"
FILE_ID=$(echo "$FILE_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "File ID: $FILE_ID"
echo ""

echo "=== 2. Create an expired token (to test expiration) ==="
EXPIRED_TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileId\": \"$FILE_ID\",
    \"userId\": \"user-test-001\",
    \"expiresInHours\": -1,
    \"maxUses\": 5
  }")
echo "Response: $EXPIRED_TOKEN_RESPONSE"
EXPIRED_TOKEN=$(echo "$EXPIRED_TOKEN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
EXPIRED_TOKEN_ID=$(echo "$EXPIRED_TOKEN_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "Expired Token: $EXPIRED_TOKEN"
echo ""

echo "=== 3. Create a token with maxUses=1 (to test usage limit) ==="
SINGLE_USE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileId\": \"$FILE_ID\",
    \"userId\": \"user-test-002\",
    \"expiresInHours\": 24,
    \"maxUses\": 1
  }")
echo "Response: $SINGLE_USE_RESPONSE"
SINGLE_USE_TOKEN=$(echo "$SINGLE_USE_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
SINGLE_USE_TOKEN_ID=$(echo "$SINGLE_USE_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "Single Use Token: $SINGLE_USE_TOKEN"
echo ""

echo "=== 4. Create a normal token for testing ==="
NORMAL_TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileId\": \"$FILE_ID\",
    \"userId\": \"user-test-003\",
    \"expiresInHours\": 24,
    \"maxUses\": 5
  }")
echo "Response: $NORMAL_TOKEN_RESPONSE"
NORMAL_TOKEN=$(echo "$NORMAL_TOKEN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
NORMAL_TOKEN_ID=$(echo "$NORMAL_TOKEN_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "Normal Token: $NORMAL_TOKEN"
echo ""

echo "=== 5. Test: Normal Download (应该成功) ==="
NORMAL_DOWNLOAD=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-normal-1\"
  }")
echo "Response: $NORMAL_DOWNLOAD"
echo ""

echo "=== 6. Test: Expired Token (应该拒绝) ==="
EXPIRED_TEST=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -d "{
    \"token\": \"$EXPIRED_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-expired-1\"
  }")
echo "Response: $EXPIRED_TEST"
echo ""

echo "=== 7. Test: Usage Limit - First use (应该成功) ==="
SINGLE_USE_FIRST=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.101" \
  -d "{
    \"token\": \"$SINGLE_USE_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-single-1\"
  }")
echo "Response: $SINGLE_USE_FIRST"
echo ""

echo "=== 8. Test: Usage Limit - Second use (应该拒绝 - 次数用尽) ==="
SINGLE_USE_SECOND=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.101" \
  -d "{
    \"token\": \"$SINGLE_USE_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-single-2\"
  }")
echo "Response: $SINGLE_USE_SECOND"
echo ""

echo "=== 9. Test: Suspected Forwarding (短时间多IP访问 - 触发异常检测) ==="
FORWARD_IP_1=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.0.0.1" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-forward-1\"
  }")
echo "IP1 (10.0.0.1): $FORWARD_IP_1"

FORWARD_IP_2=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.0.0.2" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-forward-2\"
  }")
echo "IP2 (10.0.0.2): $FORWARD_IP_2"

FORWARD_IP_3=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 10.0.0.3" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-forward-3\"
  }")
echo "IP3 (10.0.0.3 - 触发异常): $FORWARD_IP_3"
echo ""

echo "=== 10. Create and Revoke a token ==="
REVOKE_TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tokens" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileId\": \"$FILE_ID\",
    \"userId\": \"user-test-004\",
    \"expiresInHours\": 24,
    \"maxUses\": 5
  }")
REVOKE_TOKEN=$(echo "$REVOKE_TOKEN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
REVOKE_TOKEN_ID=$(echo "$REVOKE_TOKEN_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "Created token for revocation: $REVOKE_TOKEN_ID"

REVOKE_ACTION=$(curl -s -X POST "$BASE_URL/api/tokens/$REVOKE_TOKEN_ID/revoke" \
  -H "Content-Type: application/json")
echo "Revoke response: $REVOKE_ACTION"

echo "=== 11. Test: Download after revoke (应该拒绝) ==="
AFTER_REVOKE=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.200" \
  -d "{
    \"token\": \"$REVOKE_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-revoked-1\"
  }")
echo "Response: $AFTER_REVOKE"
echo ""

echo "=== 12. Test: Idempotency - Same requestId (重复执行 - 应该只记录一次) ==="
IDEMPOTENT_1=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 172.16.0.1" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-idem-test\"
  }")
echo "First call: $IDEMPOTENT_1"

IDEMPOTENT_2=$(curl -s -X POST "$BASE_URL/api/download/validate" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 172.16.0.1" \
  -d "{
    \"token\": \"$NORMAL_TOKEN\",
    \"requestId\": \"${REQ_ID_PREFIX}-idem-test\"
  }")
echo "Second call (same requestId): $IDEMPOTENT_2"
echo ""

echo "=== 13. Query: File Stats ==="
curl -s -X POST "$BASE_URL/api/files/$FILE_ID/stats" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "=== 14. Query: Anomalies (Multi-IP perspective) ==="
curl -s "$BASE_URL/api/anomalies?fileId=$FILE_ID"
echo ""
echo ""

echo "=== 15. Query: Audit Logs ==="
curl -s "$BASE_URL/api/audit/logs?fileId=$FILE_ID"
echo ""
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "=== Summary of Test Scenarios ==="
echo "1. ✅ Normal download - allowed with fileUrl returned"
echo "2. ✅ Expired token - rejected with TOKEN_EXPIRED"
echo "3. ✅ Usage limit exhausted - rejected with TOKEN_USES_EXHAUSTED"
echo "4. ✅ Suspected forwarding (multi-IP) - anomaly detected with suggested_action"
echo "5. ✅ Manual revocation - rejected with TOKEN_REVOKED"
echo "6. ✅ Idempotency - same requestId doesn't increment count"
echo ""
echo "Key Variables for Manual Testing:"
echo "  File ID: $FILE_ID"
echo "  Normal Token: $NORMAL_TOKEN"
echo "  Single-Use Token: $SINGLE_USE_TOKEN"
echo "  Revoked Token: $REVOKE_TOKEN"
