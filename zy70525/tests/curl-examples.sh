#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "=== Event Sourcing Correction API - Test Script ==="
echo ""

echo "1. Health Check"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. Create Aggregate"
AGGREGATE_RESPONSE=$(curl -s -X POST "$BASE_URL/aggregates" \
  -H "Content-Type: application/json" \
  -d '{"type": "Order"}')
echo "$AGGREGATE_RESPONSE" | python3 -m json.tool
AGGREGATE_ID=$(echo "$AGGREGATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Aggregate ID: $AGGREGATE_ID"
echo ""

echo "3. Add Original Event 1"
EVENT1_RESPONSE=$(curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"aggregateId\": \"$AGGREGATE_ID\",
    \"eventType\": \"OrderCreated\",
    \"payload\": {
      \"orderId\": \"ORD-001\",
      \"customerId\": \"CUST-001\",
      \"amount\": 100.00,
      \"status\": \"PENDING\"
    }
  }")
echo "$EVENT1_RESPONSE" | python3 -m json.tool
EVENT1_ID=$(echo "$EVENT1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Event 1 ID: $EVENT1_ID"
echo ""

echo "4. Add Original Event 2"
EVENT2_RESPONSE=$(curl -s -X POST "$BASE_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"aggregateId\": \"$AGGREGATE_ID\",
    \"eventType\": \"OrderUpdated\",
    \"payload\": {
      \"amount\": 150.00,
      \"status\": \"CONFIRMED\"
    }
  }")
echo "$EVENT2_RESPONSE" | python3 -m json.tool
EVENT2_ID=$(echo "$EVENT2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Event 2 ID: $EVENT2_ID"
echo ""

echo "5. Create Correction for Event 1"
CORRECTION_RESPONSE=$(curl -s -X POST "$BASE_URL/corrections" \
  -H "Content-Type: application/json" \
  -d "{
    \"originalEventId\": \"$EVENT1_ID\",
    \"reason\": \"Customer discount was not applied - amount should be 90.00\",
    \"correctedPayload\": {
      \"orderId\": \"ORD-001\",
      \"customerId\": \"CUST-001\",
      \"amount\": 90.00,
      \"status\": \"PENDING\",
      \"discountApplied\": true
    },
    \"operator\": \"admin@example.com\"
  }")
echo "$CORRECTION_RESPONSE" | python3 -m json.tool
CORRECTION_ID=$(echo "$CORRECTION_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Correction ID: $CORRECTION_ID"
echo ""

echo "6. Attempt to create duplicate correction (should fail - protection)"
curl -s -X POST "$BASE_URL/corrections" \
  -H "Content-Type: application/json" \
  -d "{
    \"originalEventId\": \"$EVENT1_ID\",
    \"reason\": \"Duplicate attempt\",
    \"correctedPayload\": {\"amount\": 80.00},
    \"operator\": \"admin@example.com\"
  }" | python3 -m json.tool
echo ""

echo "7. Get Correction Details"
curl -s "$BASE_URL/corrections/$CORRECTION_ID" | python3 -m json.tool
echo ""

echo "8. Replay and Validate Correction"
curl -s -X POST "$BASE_URL/corrections/$CORRECTION_ID/replay" | python3 -m json.tool
echo ""

echo "9. Attempt to replay again (should fail - idempotent)"
curl -s -X POST "$BASE_URL/corrections/$CORRECTION_ID/replay" | python3 -m json.tool
echo ""

echo "10. Generate Correction Report"
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/corrections/$CORRECTION_ID/report")
echo "$REPORT_RESPONSE" | python3 -m json.tool
REPORT_ID=$(echo "$REPORT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Report ID: $REPORT_ID"
echo ""

echo "11. Apply Correction"
curl -s -X POST "$BASE_URL/corrections/$CORRECTION_ID/apply" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin@example.com"}' | python3 -m json.tool
echo ""

echo "12. Attempt to apply again (should fail - idempotent)"
curl -s -X POST "$BASE_URL/corrections/$CORRECTION_ID/apply" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin@example.com"}' | python3 -m json.tool
echo ""

echo "13. Export Report"
curl -s "$BASE_URL/reports/$REPORT_ID/export" | python3 -m json.tool
echo ""

echo "14. List All Corrections"
curl -s "$BASE_URL/corrections" | python3 -m json.tool
echo ""

echo "15. Get Aggregate with all events and corrections"
curl -s "$BASE_URL/aggregates/$AGGREGATE_ID" | python3 -m json.tool
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary of created entities:"
echo "Aggregate ID: $AGGREGATE_ID"
echo "Event 1 ID: $EVENT1_ID"
echo "Event 2 ID: $EVENT2_ID"
echo "Correction ID: $CORRECTION_ID"
echo "Report ID: $REPORT_ID"
