#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=========================================="
echo "园区访客车位 API 测试脚本"
echo "=========================================="
echo ""

echo "1. 测试服务是否启动..."
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

echo "2. 创建访客张三..."
curl -s -X POST "$BASE_URL/visitors/" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "phone": "13800138001", "company": "测试公司"}' | python3 -m json.tool
echo ""

echo "3. 创建临时车位T100..."
curl -s -X POST "$BASE_URL/parking-spots/" \
  -H "Content-Type: application/json" \
  -d '{"spot_number": "T100", "area": "测试区", "level": "1层", "is_temporary": true}' | python3 -m json.tool
echo ""

echo "4. 测试：创建预约 - 不存在的访客 (预期返回 REJECTED)..."
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" -d "+1 hour")
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" -d "+3 hours")
curl -s -X POST "$BASE_URL/appointments/" \
  -H "Content-Type: application/json" \
  -d "{\"visitor_id\": 99999, \"parking_spot_id\": 1, \"meeting_room\": \"测试会议室\", \"start_time\": \"$START_TIME\", \"end_time\": \"$END_TIME\"}" | python3 -m json.tool
echo ""

echo "5. 测试：创建预约 - 不存在的车位 (预期返回 REJECTED)..."
curl -s -X POST "$BASE_URL/appointments/" \
  -H "Content-Type: application/json" \
  -d "{\"visitor_id\": 1, \"parking_spot_id\": 99999, \"meeting_room\": \"测试会议室\", \"start_time\": \"$START_TIME\", \"end_time\": \"$END_TIME\"}" | python3 -m json.tool
echo ""

echo "6. 正常创建会议预约..."
curl -s -X POST "$BASE_URL/appointments/" \
  -H "Content-Type: application/json" \
  -d "{\"visitor_id\": 1, \"parking_spot_id\": 1, \"meeting_room\": \"测试会议室\", \"start_time\": \"$START_TIME\", \"end_time\": \"$END_TIME\"}" | python3 -m json.tool
echo ""

echo "7. 为预约生成放行码..."
curl -s -X POST "$BASE_URL/appointments/1/pass-code" | python3 -m json.tool
echo ""

echo "8. 获取状态概览（查看 pending_review 统计）..."
curl -s "$BASE_URL/status/overview" | python3 -m json.tool
echo ""

echo "9. 生成占用报告..."
curl -s -X POST "$BASE_URL/reports/generate?generated_by=测试脚本" | python3 -m json.tool
echo ""

echo "10. 测试：人工修正（标记为待复核）..."
curl -s -X POST "$BASE_URL/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{"appointment_id": 1, "new_status": "completed", "correction_reason": "会议提前结束", "corrected_by": "管理员"}' | python3 -m json.tool
echo ""

echo "11. 再次获取状态概览（验证预约 pending_review 计数）..."
curl -s "$BASE_URL/status/overview" | python3 -m json.tool
echo ""

echo "12. 取消会议预约(释放车位)..."
curl -s -X POST "$BASE_URL/appointments/1/cancel" \
  -H "Content-Type: application/json" \
  -d '{"appointment_id": 1, "cancel_reason": "测试取消", "cancelled_by": "测试脚本", "spot_released": true}' | python3 -m json.tool
echo ""

echo "13. 最终状态概览(验证车位释放)..."
curl -s "$BASE_URL/status/overview" | python3 -m json.tool
echo ""

echo "=========================================="
echo "测试完成!"
echo "=========================================="
