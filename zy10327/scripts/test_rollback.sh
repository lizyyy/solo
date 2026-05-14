#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

assert() {
    local test_name=$1
    local condition=$2
    local actual=$3
    local expected=$4
    
    if [ "$condition" = "equals" ]; then
        if [ "$actual" = "$expected" ]; then
            echo -e "${GREEN}  ✓ PASS${NC}: $test_name"
            echo -e "     Expected: $expected"
            echo -e "     Actual:   $actual"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            echo -e "${RED}  ✗ FAIL${NC}: $test_name"
            echo -e "     Expected: $expected"
            echo -e "     Actual:   $actual"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    elif [ "$condition" = "contains" ]; then
        if echo "$actual" | grep -q "$expected"; then
            echo -e "${GREEN}  ✓ PASS${NC}: $test_name"
            echo -e "     Contains: $expected"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            echo -e "${RED}  ✗ FAIL${NC}: $test_name"
            echo -e "     Should contain: $expected"
            echo -e "     Actual: $actual"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    fi
}

echo "========================================"
echo "  Rollback Functionality Test Script"
echo "========================================"
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

echo "2. Validate Migration (creates first rollback point with phase VALIDATION_PASSED)..."
VALIDATE_RESP=$(curl -s -X POST "$BASE_URL/migrations/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"operator\": \"admin\"
  }")
echo "$VALIDATE_RESP" | jq '{status, passed_checks, failed_checks}'
echo ""

echo "3. Advance to DUAL_WRITING phase (creates second rollback point with phase DUAL_WRITING)..."
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
ROLLBACK_POINT_PHASE=$(echo "$TASK_DETAIL" | jq -r '.rollback_points[0].phase')
echo "Using Rollback Point ID: $ROLLBACK_POINT_ID"
echo "Rollback Point Phase: $ROLLBACK_POINT_PHASE"
echo ""

echo "========================================"
echo "  Testing Error Scenarios"
echo "========================================"
echo ""

echo "5. Test Empty RollbackPointID (should fail with INVALID_REQUEST)..."
EMPTY_RB_RESP=$(curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"\",
    \"operator\": \"admin\",
    \"reason\": \"测试空回滚点\"
  }")
echo "$EMPTY_RB_RESP" | jq .
EMPTY_RB_CODE=$(echo "$EMPTY_RB_RESP" | jq -r '.code')
assert "Empty rollback_point_id returns INVALID_REQUEST" "equals" "$EMPTY_RB_CODE" "INVALID_REQUEST"
echo ""

echo "6. Test Invalid RollbackPointID (should fail with ROLLBACK_POINT_NOT_FOUND)..."
INVALID_RB_RESP=$(curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"invalid-rb-id-12345\",
    \"operator\": \"admin\",
    \"reason\": \"测试不存在的回滚点\"
  }")
echo "$INVALID_RB_RESP" | jq .
INVALID_RB_CODE=$(echo "$INVALID_RB_RESP" | jq -r '.code')
assert "Invalid rollback_point_id returns ROLLBACK_POINT_NOT_FOUND" "equals" "$INVALID_RB_CODE" "ROLLBACK_POINT_NOT_FOUND"
echo ""

echo "========================================"
echo "  Testing Valid Rollback with Snapshot Restore"
echo "========================================"
echo ""

echo "7. Execute Valid Rollback to phase: $ROLLBACK_POINT_PHASE..."
ROLLBACK_RESP=$(curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"$ROLLBACK_POINT_ID\",
    \"operator\": \"admin\",
    \"reason\": \"发现数据不一致，执行回滚\"
  }")
echo "$ROLLBACK_RESP" | jq .
ROLLBACK_STATUS=$(echo "$ROLLBACK_RESP" | jq -r '.status')
ROLLBACK_PHASE=$(echo "$ROLLBACK_RESP" | jq -r '.rolled_back_to_phase')
echo ""

echo "8. Assert Rollback Response Values..."
assert "Rollback status is ROLLED_BACK" "equals" "$ROLLBACK_STATUS" "ROLLED_BACK"
assert "Rolled back to phase matches rollback point phase" "equals" "$ROLLBACK_PHASE" "$ROLLBACK_POINT_PHASE"
echo ""

echo "9. Get Final Task Status from Database..."
FINAL_TASK=$(curl -s "$BASE_URL/migrations/$TASK_ID")
echo "$FINAL_TASK" | jq '{status: .status, current_phase: .current_phase}'
FINAL_STATUS=$(echo "$FINAL_TASK" | jq -r '.status')
FINAL_PHASE=$(echo "$FINAL_TASK" | jq -r '.current_phase')
echo ""

echo "10. Assert Database State (Persistence Verification)..."
echo -e "${YELLOW}  === CRITICAL VERIFICATION ===${NC}"
echo -e "${YELLOW}  Verifying snapshot was persisted to database${NC}"
assert "Task status in database is ROLLED_BACK" "equals" "$FINAL_STATUS" "ROLLED_BACK"
assert "Task current_phase in database matches rollback point phase (PERSISTED!)" "equals" "$FINAL_PHASE" "$ROLLBACK_POINT_PHASE"
echo -e "${YELLOW}  =============================${NC}"
echo ""

echo "11. Get Migration History (verify rollback was recorded)..."
HISTORY=$(curl -s "$BASE_URL/migrations/$TASK_ID/history")
echo "$HISTORY" | jq '.histories | .[] | {from_status, to_status, remark}'
HISTORY_REMARK=$(echo "$HISTORY" | jq -r '.histories[0].remark')
assert "History remark contains restored phase" "contains" "$HISTORY_REMARK" "恢复至阶段"
echo ""

echo "========================================"
echo "  Testing Idempotency: Duplicate Rollback"
echo "========================================"
echo ""

echo "12. Test Duplicate Rollback (should fail with ALREADY_ROLLED_BACK)..."
DUPLICATE_RB_RESP=$(curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"$ROLLBACK_POINT_ID\",
    \"operator\": \"admin\",
    \"reason\": \"重复回滚测试\"
  }")
echo "$DUPLICATE_RB_RESP" | jq .
DUPLICATE_RB_CODE=$(echo "$DUPLICATE_RB_RESP" | jq -r '.code')
assert "Duplicate rollback returns ALREADY_ROLLED_BACK" "equals" "$DUPLICATE_RB_CODE" "ALREADY_ROLLED_BACK"
echo ""

echo "========================================"
echo "  Test Summary"
echo "========================================"
echo ""
echo "  Total Tests: $((PASS_COUNT + FAIL_COUNT))"
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
else
    echo -e "  ${GREEN}Failed: $FAIL_COUNT${NC}"
fi
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}========================================"
    echo "  ❌ Some tests FAILED"
    echo -e "========================================${NC}"
    exit 1
else
    echo -e "${GREEN}========================================"
    echo "  ✓ All tests PASSED"
    echo -e "========================================${NC}"
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
    echo "  ✓ Snapshot data parsing and usage"
    echo -e "  ${GREEN}✓ Snapshot restoration PERSISTED to database${NC}"
fi
