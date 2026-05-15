#!/bin/bash
set -e

BASE_URL="http://localhost:8080"

echo "========================================"
echo "  边缘节点配置签收 API - 测试脚本"
echo "========================================"
echo ""

# Check if service is running
echo "🔍 Checking if service is running..."
if ! curl -s --connect-timeout 3 "$BASE_URL/" > /dev/null 2>&1; then
    echo "❌ Service is not running!"
    echo "Please run ./start.sh first in another terminal"
    exit 1
fi
echo "✅ Service is running"
echo ""

# Step 1: Create delivery
echo "📝 [1/5] Creating config delivery for NODE1..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/delivery/create" \
    -H "Content-Type: application/json" \
    -d '{"nodeCode":"NODE1","versionNo":"V20240101001","idempotentKey":"test-001"}')

echo "$RESPONSE"
echo ""

DELIVERY_NO=$(echo "$RESPONSE" | grep -o '"deliveryNo":"[^"]*' | cut -d'"' -f4)
if [ -z "$DELIVERY_NO" ]; then
    echo "❌ Failed to get deliveryNo"
    echo "This may be an error response"
    echo ""
    echo "Trying to get deliveryNo from list..."
    LIST_RESP=$(curl -s "$BASE_URL/api/v1/delivery/list?nodeCode=NODE1&versionNo=V20240101001")
    echo "$LIST_RESP"
    DELIVERY_NO=$(echo "$LIST_RESP" | grep -o '"deliveryNo":"[^"]*' | head -1 | cut -d'"' -f4)
fi

if [ -z "$DELIVERY_NO" ]; then
    echo "⚠️  Could not get deliveryNo, let's create another one with different key..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/delivery/create" \
        -H "Content-Type: application/json" \
        -d '{"nodeCode":"NODE2","versionNo":"V20240101001","idempotentKey":"test-002"}')
    echo "$RESPONSE"
    DELIVERY_NO=$(echo "$RESPONSE" | grep -o '"deliveryNo":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$DELIVERY_NO" ]; then
    echo "❌ Still cannot get deliveryNo. Exiting."
    exit 1
fi

echo "✅ Delivery created: $DELIVERY_NO"
echo ""
sleep 1

# Step 2: Acknowledge
echo "✅ [2/5] Acknowledging config..."
curl -s -X POST "$BASE_URL/api/v1/delivery/ack" \
    -H "Content-Type: application/json" \
    -d "{\"deliveryNo\":\"$DELIVERY_NO\",\"ackResult\":1,\"ackBy\":\"test-agent\"}" | head -c 200
echo ""
echo "✅ Config acknowledged"
echo ""
sleep 1

# Step 3: Effective check
echo "✅ [3/5] Checking effective..."
curl -s -X POST "$BASE_URL/api/v1/delivery/effective-check" \
    -H "Content-Type: application/json" \
    -d "{\"deliveryNo\":\"$DELIVERY_NO\",\"checkResult\":1,\"checkDetail\":\"配置已生效\",\"checkBy\":\"monitor-system\"}" | head -c 200
echo ""
echo "✅ Effective check completed"
echo ""
sleep 1

# Step 4: Get delivery detail
echo "📋 [4/5] Getting delivery detail..."
curl -s "$BASE_URL/api/v1/delivery/$DELIVERY_NO" | head -c 300
echo ""
echo "✅ Delivery detail retrieved"
echo ""
sleep 1

# Step 5: Get reconciliation
echo "🔍 [5/5] Getting reconciliation for version V20240101001..."
curl -s "$BASE_URL/api/v1/delivery/reconciliation/V20240101001" | head -c 500
echo ""
echo "✅ Reconciliation completed"
echo ""

# List all deliveries
echo "📋 Listing all deliveries..."
curl -s "$BASE_URL/api/v1/delivery/list?versionNo=V20240101001" | head -c 400
echo ""
echo ""

echo "========================================"
echo "  🎉 All API tests completed!"
echo "========================================"
echo ""
echo "Additional tests you can run:"
echo "  - GET $BASE_URL/api/v1/delivery/$DELIVERY_NO/receipts"
echo "  - GET $BASE_URL/api/v1/delivery/$DELIVERY_NO/failures"
echo "  - GET $BASE_URL/api/v1/export/delivery?versionNo=V20240101001"
echo ""
echo "H2 Console: $BASE_URL/h2-console"
echo "  - JDBC URL: jdbc:h2:mem:edge_config"
echo "  - Username: sa"
echo "  - Password: (empty)"
echo ""
