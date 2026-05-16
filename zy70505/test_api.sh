#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================"
echo "设备事件顺序修复API - 测试脚本"
echo "========================================"

echo ""
echo "1. 健康检查"
curl -s "$BASE_URL/api/health" | python3 -m json.tool

echo ""
echo "2. 创建事件1 - 正常顺序 (设备 DEV001, 序号 1)"
curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_sequence": 1,
    "event_type": "POWER_ON",
    "event_data": {"room": "Beijing-A", "voltage": 220},
    "receive_time": "2024-01-15T10:00:00",
    "room_id": "room-beijing-01"
  }' | python3 -m json.tool

echo ""
echo "3. 创建事件2 - 正常顺序 (设备 DEV001, 序号 2)"
curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_sequence": 2,
    "event_type": "SENSOR_READ",
    "event_data": {"temperature": 25.5, "humidity": 60},
    "receive_time": "2024-01-15T10:01:00",
    "room_id": "room-beijing-01"
  }' | python3 -m json.tool

echo ""
echo "4. 创建事件3 - 乱序 (设备 DEV001, 序号 4 - 跳号)"
curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_sequence": 4,
    "event_type": "STATUS_UPDATE",
    "event_data": {"status": "running"},
    "receive_time": "2024-01-15T10:02:00",
    "room_id": "room-shanghai-01"
  }' | python3 -m json.tool

echo ""
echo "5. 创建事件4 - 重复序号 (设备 DEV001, 序号 2 - 重复)"
curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_sequence": 2,
    "event_type": "DUPLICATE_TEST",
    "event_data": {"note": "this is duplicate"},
    "receive_time": "2024-01-15T10:03:00",
    "room_id": "room-guangzhou-01"
  }' | python3 -m json.tool

echo ""
echo "6. 查询所有事件"
curl -s "$BASE_URL/api/events?device_id=DEV001" | python3 -m json.tool

echo ""
echo "7. 查询冲突记录"
curl -s "$BASE_URL/api/conflicts?device_id=DEV001" | python3 -m json.tool

echo ""
echo "8. 推进事件状态 (事件ID 1 -> processing)"
curl -s -X POST "$BASE_URL/api/events/1/status?target_status=processing" | python3 -m json.tool

echo ""
echo "9. 推进事件状态 (事件ID 1 -> fixed)"
curl -s -X POST "$BASE_URL/api/events/1/status?target_status=fixed" | python3 -m json.tool

echo ""
echo "10. 人工修正 (事件ID 4 - 重复序号2 修正为 3)"
curl -s -X POST "$BASE_URL/api/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_id": 4,
    "corrected_sequence": 3,
    "reason": "跨机房延迟导致重复，实际应为序号3",
    "operator": "客服张三"
  }' | python3 -m json.tool

echo ""
echo "11. 生成时间线报告"
curl -s "$BASE_URL/api/timeline/DEV001" | python3 -m json.tool

echo ""
echo "12. 导出设备数据"
curl -s "$BASE_URL/api/export/DEV001" | python3 -m json.tool

echo ""
echo "========================================"
echo "测试完成！"
echo "========================================"
