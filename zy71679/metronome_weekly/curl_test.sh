#!/bin/bash
BASE=http://127.0.0.1:8000
C="curl -s"

pp() { python3 -m json.tool 2>/dev/null || cat; }

echo "=========================================="
echo "0. 健康检查"
echo "=========================================="
$C $BASE/ | pp

echo ""
echo "=========================================="
echo "1. 创建学生"
echo "=========================================="
$C -X POST $BASE/api/students \
  -H 'Content-Type: application/json' \
  -d '{"name":"小明","instrument":"drums"}' | pp

echo ""
echo "=========================================="
echo "2. 正常练习记录 — 含 BPM 变速漏分段 + 弱拍误判"
echo "   beat 5/7 偏差 45/52ms，远超强拍平均 -> 弱拍误判"
echo "   segment 0-200 到 350-800 中间缺 201-349 -> 漏分段自动补推 BPM100"
echo "=========================================="
$C -X POST $BASE/api/practice-records \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"practiced_at":"2026-05-26T10:00:00","bpm":80,"duration_seconds":600,"time_signature":"4/4","raw_deviations":[{"beat_index":0,"is_weak_beat":false,"deviation_ms":5.2},{"beat_index":1,"is_weak_beat":true,"deviation_ms":12.1},{"beat_index":2,"is_weak_beat":false,"deviation_ms":3.8},{"beat_index":3,"is_weak_beat":true,"deviation_ms":8.5},{"beat_index":4,"is_weak_beat":false,"deviation_ms":4.1},{"beat_index":5,"is_weak_beat":true,"deviation_ms":45.0},{"beat_index":6,"is_weak_beat":false,"deviation_ms":3.2},{"beat_index":7,"is_weak_beat":true,"deviation_ms":52.3}],"bpm_change_segments":[{"start_beat":0,"end_beat":200,"bpm":80,"is_inferred":false},{"start_beat":350,"end_beat":800,"bpm":120,"is_inferred":false}]}' | pp

echo ""
echo "=========================================="
echo "3. 重复提交同一条记录 -> 409 被拒绝"
echo "=========================================="
$C -w '\nHTTP:%{http_code}\n' -X POST $BASE/api/practice-records \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"practiced_at":"2026-05-26T10:00:00","bpm":80,"duration_seconds":600,"time_signature":"4/4","raw_deviations":[]}'

echo ""
echo "=========================================="
echo "4. 补录一条正常记录 (第二天，偏差更小)"
echo "=========================================="
$C -X POST $BASE/api/practice-records/backfill \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"practiced_at":"2026-05-27T10:00:00","bpm":100,"duration_seconds":900,"time_signature":"4/4","raw_deviations":[{"beat_index":0,"is_weak_beat":false,"deviation_ms":6.1},{"beat_index":1,"is_weak_beat":true,"deviation_ms":9.3},{"beat_index":2,"is_weak_beat":false,"deviation_ms":5.0},{"beat_index":3,"is_weak_beat":true,"deviation_ms":7.2}]}' | pp

echo ""
echo "=========================================="
echo "5. 补录重复 -> is_duplicate_flagged=true"
echo "=========================================="
$C -X POST $BASE/api/practice-records/backfill \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"practiced_at":"2026-05-27T10:00:00","bpm":100,"duration_seconds":900,"time_signature":"4/4","raw_deviations":[{"beat_index":0,"is_weak_beat":false,"deviation_ms":6.1}]}' | pp

echo ""
echo "=========================================="
echo "6. 偏差统计 (本周)"
echo "=========================================="
$C "$BASE/api/practice-records/statistics?student_id=1&week_start=2026-05-25T00:00:00&week_end=2026-05-31T23:59:59" | pp

echo ""
echo "=========================================="
echo "7. 分段对比"
echo "=========================================="
$C "$BASE/api/practice-records/segment-comparison?student_id=1&week_start=2026-05-25T00:00:00&week_end=2026-05-31T23:59:59" | pp

echo ""
echo "=========================================="
echo "8. 老师点评 v1"
echo "=========================================="
$C -X POST $BASE/api/comments \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"week_start":"2026-05-25T00:00:00","week_end":"2026-05-31T23:59:59","content":"本周弱拍偏差较大，需要多练2/4拍"}' | pp

echo ""
echo "=========================================="
echo "9. 老师点评 v2 (覆盖 v1)"
echo "=========================================="
$C -X POST $BASE/api/comments \
  -H 'Content-Type: application/json' \
  -d '{"student_id":1,"week_start":"2026-05-25T00:00:00","week_end":"2026-05-31T23:59:59","content":"经确认弱拍偏差为刻意重音，实际进步明显"}' | pp

echo ""
echo "=========================================="
echo "10. 点评历史 — v1/v2 覆盖链完整可见"
echo "=========================================="
$C "$BASE/api/comments/history/1?week_start=2026-05-25T00:00:00" | pp

echo ""
echo "=========================================="
echo "11. 人工确认 record 1: pending -> confirmed"
echo "=========================================="
$C -X POST $BASE/api/confirmations \
  -H 'Content-Type: application/json' \
  -d '{"practice_record_id":1,"action":"confirm","operator":"王老师","note":"弱拍偏差经人工确认是刻意重音"}' | pp

echo ""
echo "=========================================="
echo "12. 确认前后变化 — 审计日志 before/after 可追溯"
echo "=========================================="
$C "$BASE/api/confirmations/history/1" | pp

echo ""
echo "=========================================="
echo "13. 重复确认 -> 400 拒绝"
echo "=========================================="
$C -w '\nHTTP:%{http_code}\n' -X POST $BASE/api/confirmations \
  -H 'Content-Type: application/json' \
  -d '{"practice_record_id":1,"action":"confirm","operator":"王老师"}'

echo ""
echo "=========================================="
echo "14. 生成周报"
echo "=========================================="
$C -X POST "$BASE/api/reports/weekly?student_id=1&week_start=2026-05-25T00:00:00&week_end=2026-05-31T23:59:59" | pp

echo ""
echo "=========================================="
echo "15. 进步解释 (含家长总结)"
echo "=========================================="
$C "$BASE/api/reports/progress?student_id=1&current_week_start=2026-05-25T00:00:00&current_week_end=2026-05-31T23:59:59&prev_week_start=2026-05-18T00:00:00&prev_week_end=2026-05-24T23:59:59" | pp

echo ""
echo "=========================================="
echo "16. 导出周报 JSON"
echo "=========================================="
$C "$BASE/api/reports/export?student_id=1&week_start=2026-05-25T00:00:00&week_end=2026-05-31T23:59:59&format=json" | pp

echo ""
echo "=========================================="
echo "17. 导出周报 CSV"
echo "=========================================="
$C "$BASE/api/reports/export?student_id=1&week_start=2026-05-25T00:00:00&week_end=2026-05-31T23:59:59&format=csv"

echo ""
echo ""
echo "=========================================="
echo "18. 审计日志总览"
echo "=========================================="
$C "$BASE/api/audit-logs?limit=20" | pp

echo ""
echo "=========================================="
echo "19. 按实体查审计日志"
echo "=========================================="
$C "$BASE/api/audit-logs?entity_type=practice_record&entity_id=1" | pp

echo ""
echo "=========================================="
echo "20. 驳回 record 2 (演示 reject)"
echo "=========================================="
$C -X POST $BASE/api/confirmations \
  -H 'Content-Type: application/json' \
  -d '{"practice_record_id":2,"action":"reject","operator":"王老师","note":"这条是补录的重复数据，偏差不准"}' | pp

echo ""
echo "=========================================="
echo "21. record 2 确认历史 (含 reject)"
echo "=========================================="
$C "$BASE/api/confirmations/history/2" | pp

echo ""
echo "=========================================="
echo "全部测试完成！"
echo "=========================================="
