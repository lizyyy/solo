#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== Rollback Test Script ==="
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

echo "2. Validate Migration..."
curl -s -X POST "$BASE_URL/migrations/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"operator\": \"admin\"
  }" | jq .
echo ""

echo "3. Advance to DUAL_WRITING phase..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"DUAL_WRITING\",
    \"operator\": \"admin\",
    \"remark\": \"开始双写\"
  }" | jq .
echo ""

echo "4. Get Task Detail (see rollback points)..."
curl -s "$BASE_URL/migrations/$TASK_ID" | jq '.rollback_points'
echo ""

echo "5. Rollback Migration..."
curl -s -X POST "$BASE_URL/migrations/rollback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"rollback_point_id\": \"\",
    \"operator\": \"admin\",
    \"reason\": \"发现数据不一致，回滚\"
  }" | jq .
echo ""

echo "6. Get Final Task Status..."
curl -s "$BASE_URL/migrations/$TASK_ID" | jq '{status: .status, current_phase: .current_phase}'
echo ""

echo "7. Get Migration History..."
curl -s "$BASE_URL/migrations/$TASK_ID/history" | jq '.histories | .[] | {from: .from_status, to: .to_status, remark: .remark}'
echo ""

echo "=== Rollback Test Complete ==="
