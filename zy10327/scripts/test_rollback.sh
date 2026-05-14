#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== Rollback Functionality Test Script ==="
echo ""

echo "1. Create Migration Task..."
CREATE_RESP=$(curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-002",
    "source_cluster_id": "cluster-source-01",
    "target_cluster_id": "cluster-target-01",
    "operator": "admin"
  }')
echo "$CREATE_RESP" | jq .
TASK_ID=$(echo "$CREATE_RESP" | jq -r '.task_id')
echo "Task ID: $TASK_ID"
echo ""

echo "2. Validate Migration (creates first rollback point)..."
curl -s -X POST "$BASE_URL/migrations/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"operator\": \"admin\"
  }" | jq '{status, passed_checks, failed_checks}'
echo ""

echo "3. Advance to DUAL_WRITING phase (creates second rollback point)..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"DUAL_WRITING\",
    \"operator\": \"admin\",
    \"remark\": \"开始双写\"
  }" | jq '{prev_status, curr_status}'
echo ""

echo "4. Get Task Detail (list all rollback points)..."
TASK_DETAIL=$(curl -s "$BASE_URL/migrations/$TASK_ID")
echo "$TASK_DETAIL" | jq '.rollback_points[] | {id, phase}'
ROLLBACK_POINT_ID=$(echo "$TASK_DETAIL" | jq -r '.rollback_points[0].id')
echo "Using Rollback Point ID: $ROLLBACK_POINT_ID"
echo ""

echo "=== Testing Error Scenarios ==="
echo ""

echo "5. Test Empty RollbackPointID (should fail)..."
curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"\",
    \"operator\": \"admin\",
    \"reason\": \"测试空回滚点\"
  }" | jq .
echo ""

echo "6. Test Invalid RollbackPointID (should fail)..."
curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"invalid-rb-id-12345\",
    \"operator\": \"admin\",
    \"reason\": \"测试不存在的回滚点\"
  }" | jq .
echo ""

echo "=== Testing Valid Rollback ==="
echo ""

echo "7. Execute Valid Rollback..."
ROLLBACK_RESP=$(curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"$ROLLBACK_POINT_ID\",
    \"operator\": \"admin\",
    \"reason\": \"发现数据不一致，执行回滚\"
  }")
echo "$ROLLBACK_RESP" | jq .
echo ""

echo "8. Get Final Task Status..."
curl -s "$BASE_URL/migrations/$TASK_ID" | jq '{status: .status, current_phase: .current_phase}'
echo ""

echo "9. Get Migration History (verify rollback was recorded)..."
curl -s "$BASE_URL/migrations/$TASK_ID/history" | jq '.histories | .[] | {from_status, to_status, remark}'
echo ""

echo "=== Testing Idempotency: Duplicate Rollback ==="
echo ""

echo "10. Test Duplicate Rollback (should fail with ALREADY_ROLLED_BACK)..."
curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"$ROLLBACK_POINT_ID\",
    \"operator\": \"admin\",
    \"reason\": \"重复回滚测试\"
  }" | jq .
echo ""

echo "=== Rollback Test Complete ==="
echo ""
echo "Summary of validations implemented:"
echo "  ✓ Task existence check"
echo "  ✓ Status transition validation"
echo "  ✓ Empty rollback_point_id check"
echo "  ✓ Rollback point existence check"
echo "  ✓ Rollback point belongs to task check"
echo "  ✓ Duplicate rollback prevention"
echo "  ✓ Rollback history auditing"
echo "  ✓ Phase-based restore logic"
