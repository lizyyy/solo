#!/bin/bash

echo "====================================="
echo "验证：恶意低分必须提供复核理由"
echo "====================================="
echo ""

BASE_URL="http://localhost:3000"

echo "1. 创建测试批次"
echo "-------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "验证恶意低分规则测试",
    "created_by": "测试员",
    "records": [
      {
        "dormitory": "3号楼",
        "room_number": "301",
        "student_id": "2021999",
        "student_name": "测试学生",
        "repair_type": "水电维修",
        "repair_date": "2024-05-10",
        "initial_score": 20,
        "initial_comment": "差评"
      }
    ]
  }')

BATCH_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch']['id'])" 2>/dev/null)
RECORD_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['id'])" 2>/dev/null)

echo "批次ID: $BATCH_ID"
echo "记录ID: $RECORD_ID"
echo ""

echo "2. 测试：标记恶意低分但不提供理由（应该失败）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/api/scores/$RECORD_ID/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"modified_by\": \"王主任\",
    \"review_score\": 85,
    \"review_reason\": \"经核查维修正常\",
    \"is_malicious_low_score\": true
  }" | python3 -m json.tool 2>/dev/null
echo ""

echo "3. 测试：标记恶意低分并提供理由（应该成功）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/api/scores/$RECORD_ID/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"modified_by\": \"王主任\",
    \"review_score\": 85,
    \"review_reason\": \"经核查维修正常\",
    \"is_malicious_low_score\": true,
    \"malicious_reason\": \"学生与维修人员有私人恩怨，故意打低分\"
  }" | python3 -m json.tool 2>/dev/null
echo ""

echo "4. 测试：不标记恶意低分（不需要恶意理由，应该成功）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/api/scores/$RECORD_ID/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"modified_by\": \"王主任\",
    \"review_score\": 90,
    \"review_reason\": \"经核查维修正常，学生评价合理\"
  }" | python3 -m json.tool 2>/dev/null
echo ""

echo "5. 验证审计日志"
echo "-------------------------"
curl -s "$BASE_URL/api/reports/batches/$BATCH_ID/audit" | python3 -m json.tool 2>/dev/null
echo ""

echo "====================================="
echo "验证完成！"
echo "====================================="
