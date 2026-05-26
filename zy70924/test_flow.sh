#!/bin/bash
set -e

API="http://localhost:3001/api"

echo "=== 1. 创建批次 ==="
BATCH=$(curl -s -X POST "$API/batches" \
  -H "Content-Type: application/json" \
  -d '{"course_name":"企业内训课程","course_code":"TRAIN-001","batch_number":"2024-04","start_date":"2024-04-01","end_date":"2024-04-05","created_by":"admin","rules":{"min_attendance_rate":0.8,"late_threshold_minutes":30,"min_homework_score":60}}')
echo "$BATCH" | python3 -m json.tool
BATCH_ID=$(echo "$BATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "批次ID: $BATCH_ID"

echo ""
echo "=== 2. 导入签到CSV ==="
curl -s -X POST "$API/batches/$BATCH_ID/import/attendance" \
  -F "operator=admin" \
  -F "file=@examples/sample_attendance.csv" | python3 -m json.tool

echo ""
echo "=== 3. 导入作业 ==="
HOMEWORK_BODY=$(python3 -c "
import json
with open('examples/sample_homework.json') as f:
    d = json.load(f)
d['operator'] = 'admin'
print(json.dumps(d, ensure_ascii=False))
")
curl -s -X POST "$API/batches/$BATCH_ID/import/homework" \
  -H "Content-Type: application/json" \
  -d "$HOMEWORK_BODY" | python3 -m json.tool

echo ""
echo "=== 4. 生成证书 ==="
curl -s -X POST "$API/batches/$BATCH_ID/certificates/generate" \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin"}' | python3 -m json.tool

echo ""
echo "=== 5. 查询记录 ==="
curl -s "$API/query?batch_id=$BATCH_ID" | python3 -m json.tool

echo ""
echo "=== 6. 出勤率报告 ==="
curl -s "$API/batches/$BATCH_ID/attendance-report" | python3 -m json.tool

echo ""
echo "=== 7. 审计日志 ==="
curl -s "$API/batches/$BATCH_ID/audit-logs" | python3 -m json.tool

echo ""
echo "=== 8. 学员完整明细(含处理历史) ==="
curl -s "$API/query/student/$BATCH_ID/E003" | python3 -m json.tool

echo ""
echo "=== 9. 导出CSV ==="
curl -s "$API/query/export?batch_id=$BATCH_ID"

echo ""
echo "=== 10. 验证导出数量 ==="
curl -s "$API/query/verify-count?batch_id=$BATCH_ID" | python3 -m json.tool
