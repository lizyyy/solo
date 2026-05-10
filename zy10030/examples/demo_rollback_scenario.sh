#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "================================================"
echo "  Gray Release & Rollback Demo Scenario"
echo "================================================"
echo ""

echo "[Step 1] Creating a new gray release..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/releases" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "version": "v2.0.0",
    "description": "New checkout flow with payment optimization",
    "strategy": "percentage",
    "strategy_config": {"percentage": 50},
    "created_by": "devops-engineer"
  }')

RELEASE_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "✓ Gray release created with ID: $RELEASE_ID"
echo ""

echo "[Step 2] Adding 3 instances to the gray release..."
for i in 1 2 3; do
  curl -s -X POST "$BASE_URL/releases/$RELEASE_ID/instances" \
    -H "Content-Type: application/json" \
    -d "{
      \"instance_id\": \"instance-0$i\",
      \"host\": \"192.168.1.10$i\",
      \"port\": 8080,
      \"version\": \"v2.0.0\"
    }" > /dev/null
  echo "  ✓ Added instance-0$i"
done
echo ""

echo "[Step 3] Starting the gray release..."
curl -s -X POST "$BASE_URL/releases/$RELEASE_ID/start" > /dev/null
echo "✓ Gray release started"
echo ""

echo "[Step 4] Creating fault injection to simulate DB timeouts..."
FAULT_RESPONSE=$(curl -s -X POST "$BASE_URL/faults" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DB Connection Timeout",
    "fault_type": "timeout",
    "target_service": "order-service",
    "enabled": true,
    "config": {"min_timeout": "2s", "max_timeout": "5s"},
    "probability": 0.6,
    "duration_seconds": 60,
    "created_by": "qa-team"
  }')
FAULT_ID=$(echo "$FAULT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "✓ Fault injection created with ID: $FAULT_ID"
echo ""

echo "[Step 5] Simulating user requests to trigger faults..."
echo "  Sending 5 requests to order-service:"
for i in 1 2 3 4 5; do
  RESPONSE=$(curl -s "$BASE_URL/faults/simulate?target_service=order-service")
  STATUS=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data']['status_code'] if d.get('data') else 'ERROR')")
  ERROR=$(echo "$RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['data'].get('error', 'N/A') if d.get('data') else 'ERROR')")
  
  if [ "$STATUS" = "200" ]; then
    echo "    Request $i: ✓ Success (Status: $STATUS)"
  else
    echo "    Request $i: ✗ Failed (Status: $STATUS, Error: $ERROR)"
  fi
  sleep 1
done
echo ""

echo "[Step 5.5] Simulating duplicate message consumption to test idempotency..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/duplicate-consumption/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_created",
    "service_name": "order-service",
    "release_id": 1,
    "version": "v2.0.0",
    "count": 3,
    "payload": {"order_id": 12345, "amount": 99.99}
  }')
MESSAGE_ID=$(echo "$DUPLICATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['message_id'])")
DUPLICATE_COUNT=$(echo "$DUPLICATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['count'])")
echo "✓ Simulated $DUPLICATE_COUNT duplicate consumptions, Message ID: $MESSAGE_ID"
echo ""

echo "[Step 5.6] Viewing dedup records..."
DEDUP_RECORDS=$(curl -s "$BASE_URL/dedup-records?message_id=$MESSAGE_ID")
echo "$DEDUP_RECORDS" | python3 -m json.tool
echo ""

echo "[Step 6] Triggering rollback due to detected issues..."
ROLLBACK_RESPONSE=$(curl -s -X POST "$BASE_URL/releases/$RELEASE_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_type": "manual",
    "trigger_by": "on-call-engineer",
    "reason": "High error rate detected: 60% of requests experiencing timeouts. Affecting checkout flow."
  }')

ROLLBACK_ID=$(echo "$ROLLBACK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "✓ Rollback triggered with ID: $ROLLBACK_ID"
echo ""

echo "[Step 7] Checking rollback status..."
sleep 3
ROLLBACK_STATUS=$(curl -s "$BASE_URL/rollbacks/$ROLLBACK_ID")
STATUS=$(echo "$ROLLBACK_STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")
echo "  Current rollback status: $STATUS"
echo ""

echo "[Step 8] Viewing rollback steps..."
ROLLBACK_STEPS=$(curl -s "$BASE_URL/rollbacks/$ROLLBACK_ID/steps")
STEP_COUNT=$(echo "$ROLLBACK_STEPS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['data']))")
echo "  Total rollback steps: $STEP_COUNT"
echo ""

echo "[Step 9] Creating incident report..."
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/reports" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Rollback of order-service v2.0.0 due to DB timeouts\",
    \"severity\": \"high\",
    \"category\": \"performance\",
    \"trigger_release_id\": $RELEASE_ID,
    \"trigger_rollback_id\": $ROLLBACK_ID,
    \"affected_services\": [\"order-service\", \"payment-service\", \"inventory-service\"],
    \"root_cause\": \"New v2.0.0 code introduced inefficient database queries causing connection pool exhaustion\",
    \"impact_analysis\": \"During the 8-minute gray release window, approximately 1200 users experienced timeouts during checkout. Estimated 30% drop in successful transactions.\",
    \"resolution_steps\": \"1. Immediate rollback initiated\\n2. Database query optimization required\\n3. Load testing before next release\",
    \"reported_by\": \"incident-manager\"
  }")

REPORT_ID=$(echo "$REPORT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "✓ Incident report created with ID: $REPORT_ID"
echo ""

echo "[Step 10] Exporting incident report (JSON format)..."
EXPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/reports/$REPORT_ID/export?format=json")
FILE_PATH=$(echo "$EXPORT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['file_path'])")
echo "✓ Report exported to: $FILE_PATH"
echo ""

echo "[Step 11] Exporting incident report (Markdown format)..."
EXPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/reports/$REPORT_ID/export?format=markdown")
FILE_PATH=$(echo "$EXPORT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['file_path'])")
echo "✓ Report exported to: $FILE_PATH"
echo ""

echo "================================================"
echo "  Demo Scenario Complete!"
echo "================================================"
echo ""
echo "Summary:"
echo "  ✓ Gray release created and started (v2.0.0, 50% traffic)"
echo "  ✓ Fault injection simulated (DB timeouts)"
echo "  ✓ Issues detected during gray release"
echo "  ✓ Rollback triggered and executed"
echo "  ✓ Incident report generated"
echo "  ✓ Reports exported in JSON and Markdown formats"
echo ""
echo "Key features demonstrated:"
echo "  - Gray release management with multiple strategies"
echo "  - Intelligent rollback engine with step tracking"
echo "  - Fault injection system (timeout, network, concurrency)"
echo "  - Full incident reporting with export capabilities"
echo "  - Distributed tracing integration"
echo "  - Message queue idempotency"
echo ""

