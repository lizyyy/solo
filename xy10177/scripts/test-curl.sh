#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "会议室资源冲突 API - 完整测试流程"
echo "========================================"
echo ""

wait_for_server() {
    echo "等待服务器启动..."
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            echo "服务器已就绪"
            return 0
        fi
        sleep 1
    done
    echo "服务器启动超时"
    exit 1
}

json_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\"[^,}]*" | sed -E 's/.*"'"$field"'":\s*"([^"]*)".*/\1/' | head -1
}

wait_for_server
echo ""

echo "========================================"
echo "步骤 1: 创建测试资源"
echo "========================================"

echo ""
echo "1.1 创建会议室 A101"
ROOM1=$(curl -s -X POST "$BASE_URL/api/resources/rooms" \
    -H "Content-Type: application/json" \
    -d '{"name": "A101 - 大型会议室", "capacity": 20, "location": "1楼东区"}')
echo "$ROOM1"
ROOM1_ID=$(json_field "$ROOM1" "id")
echo "会议室 A101 ID: $ROOM1_ID"

echo ""
echo "1.2 创建会议室 A102"
ROOM2=$(curl -s -X POST "$BASE_URL/api/resources/rooms" \
    -H "Content-Type: application/json" \
    -d '{"name": "A102 - 中型会议室", "capacity": 10, "location": "1楼东区"}')
echo "$ROOM2"
ROOM2_ID=$(json_field "$ROOM2" "id")
echo "会议室 A102 ID: $ROOM2_ID"

echo ""
echo "1.3 创建投屏设备"
DEVICE1=$(curl -s -X POST "$BASE_URL/api/resources/devices" \
    -H "Content-Type: application/json" \
    -d '{"name": "投影仪-01", "type": "projector", "room_id": null}')
echo "$DEVICE1"
DEVICE1_ID=$(json_field "$DEVICE1" "id")
echo "投影仪 ID: $DEVICE1_ID"

echo ""
echo "1.4 创建茶歇服务"
CATERING1=$(curl -s -X POST "$BASE_URL/api/resources/catering" \
    -H "Content-Type: application/json" \
    -d '{"name": "茶歇套餐 A", "description": "咖啡、茶点、水果"}')
echo "$CATERING1"
CATERING1_ID=$(json_field "$CATERING1" "id")
echo "茶歇 ID: $CATERING1_ID"

echo ""
echo "========================================"
echo "步骤 2: 创建第一个会议（预定会议室）"
echo "========================================"

echo ""
echo "2.1 创建会议 1（9:00-10:00）"
MEETING1=$(curl -s -X POST "$BASE_URL/api/meetings/book" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"产品评审会议\",
        \"organizer\": \"张三\",
        \"start_time\": \"2026-05-15 09:00:00\",
        \"end_time\": \"2026-05-15 10:00:00\",
        \"room_id\": \"$ROOM1_ID\",
        \"device_id\": \"$DEVICE1_ID\",
        \"catering_id\": \"$CATERING1_ID\"
    }")
echo "$MEETING1"
MEETING1_ID=$(json_field "$MEETING1" "id")
echo "会议 1 ID: $MEETING1_ID"

echo ""
echo "========================================"
echo "步骤 3: 尝试创建冲突会议（验证冲突检测）"
echo "========================================"

echo ""
echo "3.1 尝试创建同一时间的会议（预期冲突）"
CONFLICT_MEETING=$(curl -s -X POST "$BASE_URL/api/meetings/book" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"另一个会议\",
        \"organizer\": \"李四\",
        \"start_time\": \"2026-05-15 09:30:00\",
        \"end_time\": \"2026-05-15 10:30:00\",
        \"room_id\": \"$ROOM1_ID\"
    }")
echo "$CONFLICT_MEETING"

echo ""
echo "========================================"
echo "步骤 4: 会议改期事务（核心功能）"
echo "========================================"

echo ""
echo "4.1 先检查改期是否会冲突"
CHECK_RESCHEDULE=$(curl -s "$BASE_URL/api/meetings/$MEETING1_ID/check-reschedule?start_time=2026-05-15%2014:00:00&end_time=2026-05-15%2015:00:00")
echo "$CHECK_RESCHEDULE"

echo ""
echo "4.2 执行改期事务（改到 14:00-15:00，换会议室 A102）"
RESCHEDULE_RESULT=$(curl -s -X POST "$BASE_URL/api/meetings/$MEETING1_ID/reschedule" \
    -H "Content-Type: application/json" \
    -d "{
        \"start_time\": \"2026-05-15 14:00:00\",
        \"end_time\": \"2026-05-15 15:00:00\",
        \"room_id\": \"$ROOM2_ID\",
        \"actor\": \"张三\"
    }")
echo "$RESCHEDULE_RESULT"

TRANSACTION_ID=$(json_field "$RESCHEDULE_RESULT" "transaction_id")
echo "事务 ID: $TRANSACTION_ID"

echo ""
echo "4.3 查看事务详情（包含所有步骤）"
TRANSACTION_DETAIL=$(curl -s "$BASE_URL/api/transactions/$TRANSACTION_ID")
echo "$TRANSACTION_DETAIL"

echo ""
echo "========================================"
echo "步骤 5: 查看历史记录"
echo "========================================"

echo ""
echo "5.1 查看会议历史记录"
HISTORY=$(curl -s "$BASE_URL/api/meetings/$MEETING1_ID/history")
echo "$HISTORY"

echo ""
echo "========================================"
echo "步骤 6: 日历导出"
echo "========================================"

echo ""
echo "6.1 导出单个会议日历"
curl -s "$BASE_URL/api/meetings/$MEETING1_ID/calendar" -o "meeting-$MEETING1_ID.ics"
echo "日历已保存到 meeting-$MEETING1_ID.ics"

echo ""
echo "6.2 导出所有会议日历"
curl -s "$BASE_URL/api/meetings/calendar" -o "all-calendar.ics"
echo "日历已保存到 all-calendar.ics"

echo ""
echo "========================================"
echo "步骤 7: 取消会议（完整事务）"
echo "========================================"

echo ""
echo "7.1 取消会议"
CANCEL_RESULT=$(curl -s -X POST "$BASE_URL/api/meetings/$MEETING1_ID/cancel" \
    -H "Content-Type: application/json" \
    -d '{
        "actor": "张三"
    }')
echo "$CANCEL_RESULT"

echo ""
echo "========================================"
echo "步骤 8: 验证资源已释放"
echo "========================================"

echo ""
echo "8.1 检查会议室可用性（应该可用了）"
AVAILABILITY=$(curl -s "$BASE_URL/api/resources/rooms/$ROOM1_ID/availability?start_time=2026-05-15%2009:00:00&end_time=2026-05-15%2010:00:00")
echo "$AVAILABILITY"

echo ""
echo "8.2 查看取消后的会议状态"
MEETING_DETAIL=$(curl -s "$BASE_URL/api/meetings/$MEETING1_ID")
echo "$MEETING_DETAIL"

echo ""
echo "========================================"
echo "完整测试流程完成！"
echo "========================================"
echo ""
echo "关键 ID 记录："
echo "  会议室 A101: $ROOM1_ID"
echo "  会议室 A102: $ROOM2_ID"
echo "  投影仪: $DEVICE1_ID"
echo "  茶歇: $CATERING1_ID"
echo "  会议 1: $MEETING1_ID"
echo "  改期事务: $TRANSACTION_ID"
