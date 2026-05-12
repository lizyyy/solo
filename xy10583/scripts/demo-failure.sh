#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo -e "\n\033[1;31m===============================================\033[0m"
echo -e "\033[1;31m  用车调度费用API - 失败场景演示\033[0m"
echo -e "\033[1;31m  展示异常处理、错误消息、状态变化\033[0m"
echo -e "\033[1;31m===============================================\033[0m"

echo -e "\n\033[1;33m场景1：跨城行程未审批就派单（应该失败）\033[0m"
echo "创建跨城行程（150公里）..."
CREATE1=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: FAIL-INTERCITY-001" \
  -d '{
    "employeeId": "EMP100",
    "employeeName": "测试员工",
    "department": "SALES",
    "pickup": "北京",
    "dropoff": "济南",
    "distanceKm": 150,
    "scheduledTime": "2024-01-18T09:00:00Z"
  }')
TRIP1_ID=$(echo "$CREATE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "行程ID: $TRIP1_ID"
echo "审批状态: $(echo "$CREATE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['intercityApproval'])")"

echo -e "\n\033[91m尝试在审批前派单（应该失败）...\033[0m"
DISPATCH_FAIL=$(curl -s -X POST "$BASE_URL/trips/$TRIP1_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV001", "driverName": "张三"}')
echo "失败原因: $(echo "$DISPATCH_FAIL" | python3 -c "import sys, json; print(json.load(sys.stdin)['error'])")"

echo -e "\n\033[1;33m场景2：查询不存在的行程\033[0m"
echo -e "\033[91m查询不存在的行程ID...\033[0m"
QUERY_FAIL=$(curl -s "$BASE_URL/trips/non-existent-id")
echo "失败原因: $(echo "$QUERY_FAIL" | python3 -c "import sys, json; print(json.load(sys.stdin)['error'])")"

echo -e "\n\033[1;33m场景3：重复结算但使用不同的idempotencyKey（应该失败）\033[0m"
echo "创建一个新行程..."
CREATE2=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: FAIL-DUP-SETTLE" \
  -d '{
    "employeeId": "EMP101",
    "employeeName": "测试员工2",
    "department": "TECH",
    "pickup": "中关村",
    "dropoff": "国贸",
    "distanceKm": 15,
    "scheduledTime": "2024-01-18T14:00:00Z"
  }')
TRIP2_ID=$(echo "$CREATE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

echo "完成整个行程流程..."
curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV002", "driverName": "李四"}' > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/driver-arrive" > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/start" > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/end" \
  -H "Content-Type: application/json" \
  -d '{"endTime": "2024-01-18T14:30:00Z"}' > /dev/null

echo "首次结算（成功）..."
SETTLE1=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP2_ID\", \"idempotencyKey\": \"FAIL-KEY-1\", \"operator\": \"测试\"}")
echo "首次结算成功"

echo -e "\033[91m使用不同的idempotencyKey再次结算（应该失败）...\033[0m"
SETTLE_FAIL=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP2_ID\", \"idempotencyKey\": \"FAIL-KEY-2\", \"operator\": \"测试\"}")
echo "失败原因: $(echo "$SETTLE_FAIL" | python3 -c "import sys, json; print(json.load(sys.stdin)['error'])")"

echo -e "\n\033[1;33m场景4：部门预算检查\033[0m"
echo "销售部预算检查（预算50000，检查60000元是否足够）..."
BUDGET_CHECK=$(curl -s "$BASE_URL/departments/SALES/budget?amount=60000")
echo "能否负担: $(echo "$BUDGET_CHECK" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['canAfford'])")"
echo "剩余预算: ¥$(echo "$BUDGET_CHECK" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['remaining'])")"

echo -e "\n\033[1;31m===============================================\033[0m"
echo -e "\033[1;31m  失败场景演示完成！\033[0m"
echo -e "\033[1;31m===============================================\033[0m"
echo -e "\033[93m展示的异常处理：\033[0m"
echo -e "\033[93m  1. 跨城行程未审批就派单（返回明确错误）\033[0m"
echo -e "\033[93m  2. 查询不存在的行程（返回404错误）\033[0m"
echo -e "\033[93m  3. 重复结算（使用不同key时失败，确保幂等）\033[0m"
echo -e "\033[93m  4. 部门预算不足检查\033[0m"
echo -e "\n\033[93m所有错误都包含：\033[0m"
echo -e "\033[93m  ✓ success: false 标记\033[0m"
echo -e "\033[93m  ✓ 详细的错误消息\033[0m"
echo -e "\033[93m  ✓ 时间戳\033[0m"
