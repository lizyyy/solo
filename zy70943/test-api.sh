#!/usr/bin/env bash

BASE_URL="http://localhost:3000"

echo "======================================"
echo "物流干线异常扣罚 API 测试脚本"
echo "======================================"
echo ""

echo "1. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "123456"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "登录失败: $LOGIN_RESPONSE"
  exit 1
fi

echo "登录成功!"
echo "Token: ${TOKEN:0:50}..."
echo ""

echo "2. 创建批次（第一次提交）..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月华东区域异常扣罚",
    "description": "测试批次",
    "materials": [
      {"material_type": "exception_report", "waybill_no": "WD202405270001", "content": "运单晚点2小时"},
      {"material_type": "photo_evidence", "waybill_no": "WD202405270001", "content": "现场照片"}
    ]
  }')

echo "创建响应: $(echo "$CREATE_RESPONSE" | cut -c1-200)..."
BATCH_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "批次ID: $BATCH_ID"
echo ""

echo "3. 重复提交相同材料（测试去重）..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "重复提交的批次",
    "materials": [
      {"material_type": "exception_report", "waybill_no": "WD202405270001", "content": "运单晚点2小时"},
      {"material_type": "photo_evidence", "waybill_no": "WD202405270001", "content": "现场照片"}
    ]
  }')

echo "去重响应: $DUPLICATE_RESPONSE"
echo ""

echo "4. 创建扣罚明细（晚点）..."
DETAIL1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/deduction-details" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"waybill_no\": \"WD202405270001\",
    \"exception_type\": \"delay\",
    \"exception_time\": 1716768000,
    \"from_city\": \"上海\",
    \"to_city\": \"北京\",
    \"carrier\": \"顺丰速运\",
    \"original_amount\": 5000,
    \"deduction_amount\": 500,
    \"responsible_party\": \"承运商\"
  }")

echo "明细1响应: $(echo "$DETAIL1_RESPONSE" | cut -c1-200)..."
DETAIL1_ID=$(echo "$DETAIL1_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "明细1ID: $DETAIL1_ID"
echo ""

echo "5. 创建扣罚明细（破损）..."
DETAIL2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/deduction-details" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"waybill_no\": \"WD202405270002\",
    \"exception_type\": \"damage\",
    \"exception_time\": 1716770000,
    \"from_city\": \"广州\",
    \"to_city\": \"深圳\",
    \"carrier\": \"圆通速递\",
    \"original_amount\": 3000,
    \"deduction_amount\": 300,
    \"responsible_party\": \"中转仓\"
  }")

DETAIL2_ID=$(echo "$DETAIL2_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "明细2ID: $DETAIL2_ID"
echo ""

echo "6. 处理扣罚明细1（多单核对）..."
PROCESS_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/deduction-details/$DETAIL1_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"confirmed\",
    \"conclusion\": \"经核实，确实晚点2小时，扣罚500元\",
    \"deduction_amount\": 500,
    \"change_reason\": \"核对调度单和GPS轨迹后确认\",
    \"matched_items\": [
      {\"source_type\": \"dispatch_note\", \"source_waybill_no\": \"DD20240527001\", \"matched_amount\": 500},
      {\"source_type\": \"gps_track\", \"source_waybill_no\": \"GPS20240527001\", \"matched_amount\": 0}
    ]
  }")

echo "处理响应: $(echo "$PROCESS_RESPONSE" | cut -c1-200)..."
echo ""

echo "7. 修改扣罚结论（测试审计）..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/deduction-details/$DETAIL1_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"confirmed\",
    \"deduction_amount\": 450,
    \"conclusion\": \"经重新核实，晚点110分钟，扣罚450元\",
    \"change_reason\": \"承运商申诉，实际晚点110分钟\"
  }")

echo "修改响应: $(echo "$UPDATE_RESPONSE" | cut -c1-200)..."
echo ""

echo "8. 查询明细处理轨迹..."
AUDIT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/audit/detail/$DETAIL1_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "审计日志: $(echo "$AUDIT_RESPONSE" | cut -c1-300)..."
echo ""

echo "9. 处理扣罚明细2..."
curl -s -X PUT "$BASE_URL/api/deduction-details/$DETAIL2_ID/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed", "conclusion": "破损确认，扣罚300元"}' > /dev/null
echo "明细2处理完成"
echo ""

echo "10. 归档批次..."
ARCHIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/archive/batch/$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "归档响应: $ARCHIVE_RESPONSE"
echo ""

echo "11. 导出CSV..."
curl -s -X GET "$BASE_URL/api/export/csv?batch_id=$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/deduction_export.csv
echo "CSV已导出到 /tmp/deduction_export.csv"
echo ""

echo "12. 查询统计数据..."
STAT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/export/statistics?batch_id=$BATCH_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "统计数据: $STAT_RESPONSE"
echo ""

echo "======================================"
echo "测试完成!"
echo "======================================"
