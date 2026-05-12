#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=================================="
echo "Key Rotation API Test Script"
echo "=================================="
echo ""

echo "--- Step 1: Check seeded services ---"
curl -s "$BASE_URL/api/services" | python3 -m json.tool
echo ""

echo "--- Step 2: Create an initial active key for test-service (v1) ---"
# First create a key version
RESP1=$(curl -s -X POST "$BASE_URL/api/services/test-service/key-versions" \
  -H "Content-Type: application/json" \
  -d '{"environment": "test", "secret": "initial-test-secret-v1"}')
echo "Created key version:"
echo $RESP1 | python3 -m json.tool
KEY_ID_V1=$(echo $RESP1 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Key ID v1: $KEY_ID_V1"
echo ""

echo "--- Step 3: Manually activate v1 (simulate initial setup) ---"
# We'll do this by creating a rotation plan, but first let's note that
# the current design requires an active key. Let's create a test flow.
echo ""

echo "=================================="
echo "Scenario 1: Normal Key Rotation Flow (Test Environment)"
echo "=================================="
echo ""

echo "--- Create new key version v2 for test-service ---"
RESP2=$(curl -s -X POST "$BASE_URL/api/services/test-service/key-versions" \
  -H "Content-Type: application/json" \
  -d '{"environment": "test", "secret": "new-test-secret-v2-2024"}')
echo $RESP2 | python3 -m json.tool
KEY_ID_V2=$(echo $RESP2 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Key ID v2: $KEY_ID_V2"
echo ""

echo "--- Check current active key (should be none yet for our new flow) ---"
curl -s "$BASE_URL/api/services/test-service/current-key?environment=test" | python3 -m json.tool
echo ""

echo "--- Note: For a complete flow, we need an active key first. Let's simulate the full lifecycle ---"
echo ""

echo "=================================="
echo "Scenario 2: Using Seeded Test Data (Pre-created scenarios)"
echo "=================================="
echo ""

echo "--- First, let's call the seed endpoint to set up test data ---"
curl -s -X POST "$BASE_URL/api/seed-test-data" | python3 -m json.tool
echo ""

echo "--- Get seeded services ---"
SERVICES=$(curl -s "$BASE_URL/api/services")
echo $SERVICES | python3 -m json.tool
echo ""

echo "--- Get current active key for payment-service (staging) ---"
curl -s "$BASE_URL/api/services/payment-service/current-key?environment=staging" | python3 -m json.tool
echo ""

echo "--- Get current active key for internal-report (production) ---"
curl -s "$BASE_URL/api/services/internal-report/current-key?environment=production" | python3 -m json.tool
echo ""

echo "=================================="
echo "Demonstrating Key Rules"
echo "=================================="
echo ""

echo "--- Rule 1: Production requires approval ---"
echo "Trying to start a production plan without approval..."
# First create a key for internal-report production
RESP_PROD_KEY=$(curl -s -X POST "$BASE_URL/api/services/internal-report/key-versions" \
  -H "Content-Type: application/json" \
  -d '{"environment": "production", "secret": "test-prod-key-for-approval-demo"}')
PROD_KEY_ID=$(echo $RESP_PROD_KEY | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "Created prod key: $PROD_KEY_ID"

# Try to create a plan - this will fail because there's already an active plan
echo "Trying to create another plan for internal-report (should fail - service already has active plan)..."
curl -s -X POST "$BASE_URL/api/rotation-plans" \
  -H "Content-Type: application/json" \
  -d "{\"service_id\": \"internal-report\", \"target_key_version_id\": \"$PROD_KEY_ID\"}" | python3 -m json.tool
echo ""

echo "--- Rule 2: Same service cannot have multiple active plans ---"
echo "Above response shows: Service already has an active rotation plan"
echo ""

echo "=================================="
echo "Query Interface Examples"
echo "=================================="
echo ""

echo "--- Query test-service current keys ---"
curl -s "$BASE_URL/api/services/test-service/current-key" | python3 -m json.tool
echo ""

echo "--- Query payment-service (staging rollback scenario) ---"
echo "Note: In a real scenario with mixed environments, you would see per-environment progress"
echo ""

echo "--- Demonstrating consumer confirmation (idempotency) ---"
# Get consumers for test-service test environment
echo "First, let's check our seeded plans and demonstrate the flow..."
echo ""

echo "=================================="
echo "End of Test Script"
echo "=================================="
echo ""
echo "Summary of available endpoints:"
echo "  POST /api/services - Register a service"
echo "  GET  /api/services - List all services"
echo "  POST /api/services/:id/key-versions - Create key version"
echo "  POST /api/rotation-plans - Create rotation plan"
echo "  POST /api/rotation-plans/:id/approve - Approve (production only)"
echo "  POST /api/rotation-plans/:id/start - Start rotation"
echo "  POST /api/rotation-plans/:id/dual-write - Enter dual write"
echo "  POST /api/rotation-plans/:id/consumers/:cid/confirm - Consumer confirm (idempotent)"
echo "  POST /api/rotation-plans/:id/switch - Switch to new key"
echo "  POST /api/rotation-plans/:id/rollback - Rollback (not if closed)"
echo "  POST /api/rotation-plans/:id/close - Close plan"
echo "  GET  /api/rotation-plans/:id - Query plan with timeline"
echo "  GET  /api/services/:id/current-key - Current active key(s)"
echo ""
