#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== Idempotency Test Script ==="
echo ""

echo "1. First Create Migration Task (should succeed)..."
curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-001",
    "source_cluster_id": "cluster-source-01",
    "target_cluster_id": "cluster-target-01",
    "operator": "admin"
  }' | jq .
echo ""

echo "2. Second Create Migration Task (same tenant + clusters - should fail with DUPLICATE_TASK)..."
curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-001",
    "source_cluster_id": "cluster-source-01",
    "target_cluster_id": "cluster-target-01",
    "operator": "admin"
  }' | jq .
echo ""

echo "3. Test Invalid Status Transition (try to advance from CREATED to DUAL_WRITING directly)..."
TASKS_RESP=$(curl -s "$BASE_URL/migrations?tenant_id=tenant-001")
TASK_ID=$(echo "$TASKS_RESP" | jq -r '.tasks[0].id')
echo "Task ID: $TASK_ID"

curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"DUAL_WRITING\",
    \"operator\": \"admin\",
    \"remark\": \"跳过校验直接双写\"
  }" | jq .
echo ""

echo "4. Test Invalid Task ID..."
curl -s "$BASE_URL/migrations/invalid-task-id" | jq .
echo ""

echo "=== Idempotency Test Complete ==="
