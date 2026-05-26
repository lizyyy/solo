#!/bin/bash

echo "====================================="
echo "校园宿舍维修评分 API 完整测试流程"
echo "====================================="
echo ""

BASE_URL="http://localhost:3000"

echo "1. 创建评分批次"
echo "-------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "2024年5月第一周维修评分",
    "created_by": "张管理员",
    "records": [
      {
        "dormitory": "1号楼",
        "room_number": "101",
        "student_id": "2021001",
        "student_name": "张三",
        "repair_type": "水电维修",
        "repair_date": "2024-05-01",
        "initial_score": 85,
        "initial_comment": "师傅态度很好，修得快"
      },
      {
        "dormitory": "2号楼",
        "room_number": "203",
        "student_id": "2021002",
        "student_name": "李四",
        "repair_type": "门窗维修",
        "repair_date": "2024-05-02",
        "initial_score": 30,
        "initial_comment": "非常不满意"
      }
    ]
  }')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

BATCH_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch']['id'])" 2>/dev/null)
RECORD_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][1]['id'])" 2>/dev/null)

echo "批次ID: $BATCH_ID"
echo "李四的记录ID: $RECORD_ID"
echo ""

echo "2. 重复提交测试（同一批材料）"
echo "-------------------------"
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "重复提交",
    "created_by": "李管理员",
    "records": [
      {
        "dormitory": "1号楼",
        "room_number": "101",
        "student_id": "2021001",
        "student_name": "张三",
        "repair_type": "水电维修",
        "repair_date": "2024-05-01",
        "initial_score": 85,
        "initial_comment": "师傅态度很好，修得快"
      },
      {
        "dormitory": "2号楼",
        "room_number": "203",
        "student_id": "2021002",
        "student_name": "李四",
        "repair_type": "门窗维修",
        "repair_date": "2024-05-02",
        "initial_score": 30,
        "initial_comment": "非常不满意"
      }
    ]
  }')

echo "$DUPLICATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DUPLICATE_RESPONSE"
echo ""

echo "3. 学生提交申诉（李四）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/api/scores/$RECORD_ID/appeal" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"modified_by\": \"李四\",
    \"appeal_score\": 60,
    \"appeal_reason\": \"后续师傅重新上门维修了，虽然慢但修好了\"
  }" | python3 -m json.tool 2>/dev/null
echo ""

echo "4. 后勤复核评分（标记恶意低分）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/api/scores/$RECORD_ID/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"modified_by\": \"王主任\",
    \"review_score\": 80,
    \"review_reason\": \"经核查，维修师傅按规范完成工作，学生评价过于极端\",
    \"is_malicious_low_score\": true,
    \"malicious_reason\": \"学生因个人情绪故意打低分，与实际维修情况不符\"
  }" | python3 -m json.tool 2>/dev/null
echo ""

echo "5. 查看审计日志（追踪修改记录）"
echo "-------------------------"
curl -s "$BASE_URL/api/reports/batches/$BATCH_ID/audit" | python3 -m json.tool 2>/dev/null
echo ""

echo "6. 更新批次状态为人工确认"
echo "-------------------------"
curl -s -X PATCH "$BASE_URL/api/batches/$BATCH_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "manual_confirm"}' | python3 -m json.tool 2>/dev/null
echo ""

echo "7. 下载评分报告 CSV"
echo "-------------------------"
curl -s "$BASE_URL/api/reports/batches/$BATCH_ID/download" -o maintenance_report.csv
echo "报告已保存到 maintenance_report.csv"
head -5 maintenance_report.csv
echo ""

echo "8. 下载审计报告 CSV"
echo "-------------------------"
curl -s "$BASE_URL/api/reports/batches/$BATCH_ID/audit/download" -o audit_report.csv
echo "审计报告已保存到 audit_report.csv"
head -5 audit_report.csv
echo ""

echo "9. 查看所有批次列表"
echo "-------------------------"
curl -s "$BASE_URL/api/batches" | python3 -m json.tool 2>/dev/null
echo ""

echo "====================================="
echo "测试完成！"
echo "====================================="
