#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== Tenant Migration API Test Script ==="
echo ""

echo "1. Health Check..."
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. Create Migration Task..."
CREATE_RESP=$(curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant-001",
    "source_cluster_id": "cluster-source-01",
    "target_cluster_id": "cluster-target-01",
    "operator": "admin"
  }')
echo "$CREATE_RESP" | jq .
TASK_ID=$(echo "$CREATE_RESP" | jq -r '.task_id')
echo "Task ID: $TASK_ID"
echo ""

echo "3. Get Migration Task Detail..."
curl -s "$BASE_URL/migrations/$TASK_ID" | jq .
echo ""

echo "4. Validate Migration..."
VALIDATE_RESP=$(curl -s -X POST "$BASE_URL/migrations/validate" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"operator\": \"admin\"
  }")
echo "$VALIDATE_RESP" | jq .
echo ""

echo "5. Advance to DUAL_WRITING phase..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"DUAL_WRITING\",
    \"operator\": \"admin\",
    \"remark\": \"开始双写\"
  }" | jq .
echo ""

echo "6. Advance to VERIFYING phase..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"VERIFYING\",
    \"operator\": \"admin\",
    \"remark\": \"双写数据一致性校验\"
  }" | jq .
echo ""

echo "7. Advance to SWITCHING_READ phase..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"SWITCHING_READ\",
    \"operator\": \"admin\",
    \"remark\": \"切换读流量\"
  }" | jq .
echo ""

echo "8. Advance to COMPLETED phase..."
curl -s -X POST "$BASE_URL/migrations/advance" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"target_phase\": \"COMPLETED\",
    \"operator\": \"admin\",
    \"remark\": \"迁移完成\"
  }" | jq .
echo ""

echo "9. Get Migration History..."
curl -s "$BASE_URL/migrations/$TASK_ID/history" | jq .
echo ""

echo "10. Get Validation Report..."
curl -s "$BASE_URL/migrations/$TASK_ID/report" | jq .
echo ""

echo "11. List All Migration Tasks..."
curl -s "$BASE_URL/migrations" | jq .
echo ""

echo "=== Test Complete ==="
