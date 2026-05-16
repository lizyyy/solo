#!/bin/bash

BASE_URL="http://localhost:8000"
DEVICE_ID="TEST_$(date +%s)"

echo "========================================"
echo "设备事件顺序修复API - 验收测试"
echo "使用设备ID: $DEVICE_ID"
echo "========================================"

echo ""
echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/api/health" | python3 -m json.tool

echo ""
echo "=== 2. 创建事件1 - 序号 1 ==="
RESP=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_id\": \"$DEVICE_ID\",
    \"event_sequence\": 1,
    \"event_type\": \"POWER_ON\",
    \"event_data\": {\"voltage\": 220},
    \"receive_time\": \"2024-01-15T10:00:00\",
    \"room_id\": \"room-beijing-01\"
  }")
echo "$RESP" | python3 -m json.tool
EVENT1_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo ""
echo "=== 3. 创建事件2 - 序号 2 ==="
RESP=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_id\": \"$DEVICE_ID\",
    \"event_sequence\": 2,
    \"event_type\": \"SENSOR_READ\",
    \"receive_time\": \"2024-01-15T10:01:00\"
  }")
echo "$RESP" | python3 -m json.tool
EVENT2_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo ""
echo "=== 4. 创建事件3 - 序号 3 ==="
RESP=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_id\": \"$DEVICE_ID\",
    \"event_sequence\": 3,
    \"event_type\": \"STATUS_UPDATE\",
    \"receive_time\": \"2024-01-15T10:02:00\"
  }")
echo "$RESP" | python3 -m json.tool
EVENT3_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo ""
echo "=== 5. 验证序号排序 (按 event_sequence 升序: 1,2,3) ==="
echo "查询事件列表，验证返回顺序应为 [1,2,3]:"
curl -s "$BASE_URL/api/events?device_id=$DEVICE_ID" | python3 -c "
import sys,json
events = json.load(sys.stdin)
seqs = [e['event_sequence'] for e in events]
print(f'返回序号列表: {seqs}')
print(f'排序正确: {seqs == sorted(seqs)}')"

echo ""
echo "=== 6. 重复推进同一状态验证 (幂等性测试) ==="
echo "事件ID $EVENT1_ID: pending -> processing..."
curl -s -X POST "$BASE_URL/api/events/$EVENT1_ID/status?target_status=processing" | python3 -m json.tool
echo ""
echo "再次推进 processing -> processing (应该失败):"
curl -s -X POST "$BASE_URL/api/events/$EVENT1_ID/status?target_status=processing" | python3 -m json.tool
echo ""
echo "正确推进 processing -> fixed:"
curl -s -X POST "$BASE_URL/api/events/$EVENT1_ID/status?target_status=fixed" | python3 -m json.tool

echo ""
echo "=== 7. 创建冲突事件 - 重复序号 2 ==="
echo "创建序号 2 (已存在，产生冲突):"
RESP=$(curl -s -X POST "$BASE_URL/api/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_id\": \"$DEVICE_ID\",
    \"event_sequence\": 2,
    \"event_type\": \"DUPLICATE_EVENT\",
    \"receive_time\": \"2024-01-15T10:03:00\"
  }")
echo "$RESP" | python3 -m json.tool
EVENT4_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo ""
echo "=== 8. 查看冲突记录 ==="
curl -s "$BASE_URL/api/conflicts?device_id=$DEVICE_ID" | python3 -m json.tool

echo ""
echo "=== 9. 人工修正 ==="
echo "修正事件 $EVENT4_ID: 序号 2 -> 4:"
curl -s -X POST "$BASE_URL/api/manual-correction" \
  -H "Content-Type: application/json" \
  -d "{
    \"device_id\": \"$DEVICE_ID\",
    \"event_id\": $EVENT4_ID,
    \"corrected_sequence\": 4,
    \"reason\": \"跨机房延迟导致序号重复，实际应为4\",
    \"operator\": \"测试员\"
  }" | python3 -m json.tool

echo ""
echo "=== 10. 导出数据验证异常解释 ==="
echo "查看 conflict_explanations 字段:"
curl -s "$BASE_URL/api/export/$DEVICE_ID" | python3 -c "
import sys,json
data = json.load(sys.stdin)
print('=== Summary ===')
print(f'Total events: {data[\"summary\"][\"total_events\"]}')
print(f'Total conflicts: {data[\"summary\"][\"total_conflicts\"]}')
print(f'Total corrections: {data[\"summary\"][\"total_corrections\"]}')
print('')
print('=== Conflict Explanations ===')
for c in data['conflict_explanations']:
    print(f'  - 类型: {c[\"conflict_type\"]}')
    print(f'    详情: {c[\"conflict_detail\"]}')
    print(f'    解决方案: {c[\"resolution\"]}')
    print(f'    结论: {c[\"conclusion\"]}')
    print('')"

echo ""
echo "=== 11. 最终事件列表 (修正后) ==="
curl -s "$BASE_URL/api/events?device_id=$DEVICE_ID" | python3 -c "
import sys,json
events = json.load(sys.stdin)
print('序号 | 状态 | 事件类型')
print('-' * 30)
for e in events:
    print(f'{e[\"event_sequence\"]:4d} | {e[\"status\"]:15s} | {e[\"event_type\"]}')"

echo ""
echo "========================================"
echo "验收完成! 使用设备: $DEVICE_ID"
echo "========================================"
