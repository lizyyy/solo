#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 任务取消传播 API - 测试数据生成 ==="
echo ""

check_service() {
    echo "检查服务状态..."
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            echo "服务已启动 ✓"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo ""
    echo "服务启动超时，请先运行 ./start.sh 启动服务"
    exit 1
}

check_service

echo ""
echo "1. 创建主任务 MAIN_TASK_001"
curl -s -X POST "$BASE_URL/tasks/" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_001",
    "name": "数据导出任务",
    "description": "导出年度报表数据"
  }' | python3 -m json.tool 2>/dev/null || echo "创建成功"

echo ""
echo "2. 创建3个子任务"
for i in 1 2 3; do
  echo "  - SUB_TASK_00${i}"
  curl -s -X POST "$BASE_URL/tasks/MAIN_TASK_001/sub-tasks/" \
    -H "Content-Type: application/json" \
    -d "{
      \"sub_task_id\": \"SUB_TASK_00${i}\",
      \"name\": \"子任务${i}\",
      \"description\": \"子任务${i}描述\",
      \"order\": ${i}
    }" > /dev/null 2>&1
done

echo ""
echo "3. 为子任务添加临时资源"
curl -s -X POST "$BASE_URL/sub-tasks/SUB_TASK_001/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_001",
    "resource_type": "temp_file",
    "resource_location": "/tmp/data_001.csv",
    "size_bytes": 1024000
  }' > /dev/null 2>&1

curl -s -X POST "$BASE_URL/sub-tasks/SUB_TASK_002/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_002",
    "resource_type": "temp_file",
    "resource_location": "/tmp/data_002.csv",
    "size_bytes": 2048000
  }' > /dev/null 2>&1

curl -s -X POST "$BASE_URL/sub-tasks/SUB_TASK_003/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_003",
    "resource_type": "database_connection",
    "resource_location": "db://temp_session",
    "size_bytes": 0
  }' > /dev/null 2>&1

echo ""
echo "4. 发起取消请求"
curl -s -X POST "$BASE_URL/tasks/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_001",
    "reason_code": "USER_CANCELLED",
    "reason_message": "用户主动取消任务",
    "triggered_by": "admin",
    "suppress_notification": false,
    "idempotency_key": "demo_request_001"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "5. 执行取消传播"
curl -s -X POST "$BASE_URL/tasks/MAIN_TASK_001/propagate" | python3 -m json.tool 2>/dev/null

echo ""
echo "6. 查询传播进度"
curl -s "$BASE_URL/tasks/MAIN_TASK_001/progress" | python3 -m json.tool 2>/dev/null

echo ""
echo "7. 查询任务详情"
curl -s "$BASE_URL/tasks/MAIN_TASK_001" | python3 -m json.tool 2>/dev/null

echo ""
echo "8. 查询清理结果"
curl -s "$BASE_URL/tasks/MAIN_TASK_001/cleanup-results" | python3 -m json.tool 2>/dev/null

echo ""
echo "=== 测试数据生成完成 ==="
echo ""
echo "你可以访问: $BASE_URL/docs 查看完整的 API 文档"
echo ""
