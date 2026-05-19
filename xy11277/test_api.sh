#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "======================================"
echo "  仓库夜班排班管理系统 - API 测试"
echo "======================================"

echo ""
echo "1. 检查服务健康状态..."
curl -s "http://localhost:8000/health" | python3 -m json.tool

echo ""
echo "2. 获取叉车列表..."
FORKLIFTS=$(curl -s "$BASE_URL/forklifts")
echo "$FORKLIFTS" | python3 -m json.tool
FORKLIFT_ID=$(echo "$FORKLIFTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "叉车ID: $FORKLIFT_ID"

echo ""
echo "3. 获取充电桩列表..."
STATIONS=$(curl -s "$BASE_URL/charging-stations")
echo "$STATIONS" | python3 -m json.tool
STATION_ID=$(echo "$STATIONS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "充电桩ID: $STATION_ID"

echo ""
echo "4. 获取司机列表（敏感字段已脱敏）..."
DRIVERS=$(curl -s "$BASE_URL/drivers")
echo "$DRIVERS" | python3 -m json.tool
DRIVER_ID=$(echo "$DRIVERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "司机ID: $DRIVER_ID"

echo ""
echo "5. 创建任务1..."
TASK1=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A区货物搬运",
    "description": "搬运A1-A10货架的货物",
    "priority": "high",
    "estimated_duration": 60,
    "idempotency_key": "task_001_$(date +%s)"
  }')
echo "$TASK1" | python3 -m json.tool
TASK1_ID=$(echo "$TASK1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "任务1 ID: $TASK1_ID"

echo ""
echo "6. 创建任务2..."
TASK2=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "B区货物盘点",
    "description": "盘点B区所有货物",
    "priority": "normal",
    "estimated_duration": 45,
    "idempotency_key": "task_002_$(date +%s)"
  }')
echo "$TASK2" | python3 -m json.tool
TASK2_ID=$(echo "$TASK2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])")
echo "任务2 ID: $TASK2_ID"

echo ""
echo "7. 测试幂等性 - 重复创建任务1..."
curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "A区货物搬运",
    "description": "重复提交测试",
    "priority": "high",
    "estimated_duration": 60,
    "idempotency_key": "task_001_$(date +%s)"
  }' | python3 -m json.tool

echo ""
echo "8. 查询任务列表..."
curl -s "$BASE_URL/tasks" | python3 -m json.tool

echo ""
echo "9. 创建排班..."
SCHEDULE_DATE=$(date +%Y-%m-%d)
echo "排班日期: $SCHEDULE_DATE"
curl -s -X POST "$BASE_URL/schedules" \
  -H "Content-Type: application/json" \
  -d "{
    \"schedule_date\": \"$SCHEDULE_DATE\",
    \"shift\": \"night\",
    \"driver_id\": \"$DRIVER_ID\",
    \"forklift_id\": \"$FORKLIFT_ID\",
    \"task_ids\": [\"$TASK1_ID\", \"$TASK2_ID\"],
    \"idempotency_key\": \"schedule_001_$(date +%s)\"
  }" | python3 -m json.tool

echo ""
echo "10. 查询排班列表..."
curl -s "$BASE_URL/schedules" | python3 -m json.tool

echo ""
echo "11. 锁定资源 - 锁定叉车..."
curl -s -X POST "$BASE_URL/locks" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"forklift\",
    \"resource_id\": \"$FORKLIFT_ID\",
    \"reason\": \"维修保养\",
    \"expire_seconds\": 3600
  }" | python3 -m json.tool

echo ""
echo "12. 查询活动锁定..."
curl -s "$BASE_URL/locks" | python3 -m json.tool

echo ""
echo "13. 解锁资源..."
curl -s -X POST "$BASE_URL/locks/unlock" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"forklift\",
    \"resource_id\": \"$FORKLIFT_ID\"
  }" | python3 -m json.tool

echo ""
echo "14. 上报异常..."
curl -s -X POST "$BASE_URL/exceptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"exception_type\": \"forklift_fault\",
    \"description\": \"叉车刹车失灵\",
    \"severity\": \"high\",
    \"forklift_id\": \"$FORKLIFT_ID\"
  }" | python3 -m json.tool

echo ""
echo "15. 查询异常列表..."
EXCEPTIONS=$(curl -s "$BASE_URL/exceptions")
echo "$EXCEPTIONS" | python3 -m json.tool
EXCEPTION_ID=$(echo "$EXCEPTIONS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'])")
echo "异常ID: $EXCEPTION_ID"

echo ""
echo "16. 解决异常..."
curl -s -X POST "$BASE_URL/exceptions/$EXCEPTION_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "更换刹车片，已修复"
  }' | python3 -m json.tool

echo ""
echo "17. 开始充电..."
curl -s -X POST "$BASE_URL/charging-stations/$STATION_ID/start-charging?forklift_id=$FORKLIFT_ID" | python3 -m json.tool

echo ""
echo "18. 停止充电..."
curl -s -X POST "$BASE_URL/charging-stations/$STATION_ID/stop-charging" | python3 -m json.tool

echo ""
echo "19. 生成日报..."
curl -s -X POST "$BASE_URL/reports/daily" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_date\": \"$SCHEDULE_DATE\",
    \"shift\": \"night\"
  }" | python3 -m json.tool

echo ""
echo "20. 查询报表列表..."
curl -s "$BASE_URL/reports" | python3 -m json.tool

echo ""
echo "======================================"
echo "  主流程测试完成！"
echo "======================================"
