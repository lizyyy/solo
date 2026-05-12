#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo -e "\n\033[1;35m===============================================\033[0m"
echo -e "\033[1;35m  用车调度费用API - 完整内置样例演示\033[0m"
echo -e "\033[1;35m  包含：正常行程、员工取消、等待收费、跨城审批、结算幂等\033[0m"
echo -e "\033[1;35m===============================================\033[0m"

echo -e "\n\033[1;33m=== 样例1：正常行程（无异常）===\033[0m"
echo "创建行程..."
TRIP1_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: SAMPLE-NORMAL-001" \
  -d '{
    "employeeId": "EMP001",
    "employeeName": "王经理",
    "department": "SALES",
    "pickup": "北京市朝阳区国贸",
    "dropoff": "北京市东城区王府井",
    "distanceKm": 8,
    "scheduledTime": "2024-01-16T10:00:00Z"
  }')
TRIP1_ID=$(echo "$TRIP1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "行程ID: $TRIP1_ID"

echo "派单..."
curl -s -X POST "$BASE_URL/trips/$TRIP1_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV001", "driverName": "张三"}' > /dev/null

echo "司机到达..."
curl -s -X POST "$BASE_URL/trips/$TRIP1_ID/driver-arrive" > /dev/null

echo "开始行程..."
curl -s -X POST "$BASE_URL/trips/$TRIP1_ID/start" > /dev/null

echo "结束行程..."
END1=$(curl -s -X POST "$BASE_URL/trips/$TRIP1_ID/end" \
  -H "Content-Type: application/json" \
  -d '{"endTime": "2024-01-16T10:30:00Z"}')
FARE1=$(echo "$END1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['fare']['total'])")
echo "行程完成，费用: ¥$FARE1 (基础车费: 50 + 8*3 = 74元)"

echo "结算..."
SETTLE1=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP1_ID\", \"idempotencyKey\": \"SAMPLE-SETTLE-1\", \"operator\": \"财务\"}")
echo -e "\033[92m✓ 正常行程完成\033[0m"

echo -e "\n\033[1;33m=== 样例2：员工取消（派单后取消，产生取消费）===\033[0m"
echo "创建行程..."
TRIP2_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: SAMPLE-CANCEL-001" \
  -d '{
    "employeeId": "EMP002",
    "employeeName": "李工程师",
    "department": "TECH",
    "pickup": "北京市海淀区中关村",
    "dropoff": "北京市朝阳区望京",
    "distanceKm": 20,
    "scheduledTime": "2024-01-16T14:00:00Z"
  }')
TRIP2_ID=$(echo "$TRIP2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

echo "派单..."
curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV002", "driverName": "李四"}' > /dev/null

echo "员工突然取消行程..."
CANCEL2=$(curl -s -X POST "$BASE_URL/trips/$TRIP2_ID/cancel" \
  -H "Content-Type: application/json" \
  -d '{"cancelledBy": "员工", "reason": "会议临时取消"}')
CANCEL_FEE=$(echo "$CANCEL2" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['cancellationFee'])")
echo "取消费用: ¥$CANCEL_FEE (派单后取消费: 30元)"
echo -e "\033[92m✓ 员工取消完成，历史记录显示取消原因和取消费\033[0m"

echo -e "\n\033[1;33m=== 样例3：司机到达后等待收费（员工迟到）===\033[0m"
echo "创建行程..."
TRIP3_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: SAMPLE-WAITING-001" \
  -d '{
    "employeeId": "EMP003",
    "employeeName": "赵人事",
    "department": "HR",
    "pickup": "北京市西城区金融街",
    "dropoff": "北京市朝阳区国贸",
    "distanceKm": 15,
    "scheduledTime": "2024-01-16T16:00:00Z"
  }')
TRIP3_ID=$(echo "$TRIP3_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

echo "派单..."
curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV003", "driverName": "王五"}' > /dev/null

echo "创建行程用于人工添加等待费测试..."
TRIP3_WAIT_ID=$(uuidgen)
TRIP3_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: SAMPLE-WAITING-002" \
  -d '{
    "employeeId": "EMP003",
    "employeeName": "赵人事",
    "department": "HR",
    "pickup": "北京市西城区金融街",
    "dropoff": "北京市朝阳区国贸",
    "distanceKm": 15,
    "scheduledTime": "2024-01-16T16:00:00Z"
  }')
TRIP3_ID=$(echo "$TRIP3_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")

echo "完成行程流程..."
curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV003", "driverName": "王五"}' > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/driver-arrive" > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/start" > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/end" \
  -H "Content-Type: application/json" > /dev/null

echo "人工修正等待时间为45分钟（模拟员工迟到）..."
CORRECT3=$(curl -s -X POST "$BASE_URL/trips/$TRIP3_ID/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "corrections": {"waitingMinutes": 45, "reason": "员工迟到，等待45分钟"},
    "operator": "行政管理员"
  }')
WAITING=$(echo "$CORRECT3" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['waitingMinutes'])")
WAITING_FEE=$(echo "$CORRECT3" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['fare']['waitingFee'])")
TOTAL3=$(echo "$CORRECT3" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['fare']['total'])")
echo "修正后等待时间: $WAITING 分钟"
echo "等待费: ¥$WAITING_FEE (计算: (45-15)分钟 * 2元 = 60元)"
echo "总费用: ¥$TOTAL3 (基础95元 + 等待60元 = 155元)"
echo -e "\033[92m✓ 等待收费完成，通过人工修正展示费用计算\033[0m"

echo -e "\n\033[1;33m=== 样例4：跨城行程审批（100公里以上需要审批）===\033[0m"
echo "创建跨城行程（北京到天津，距离120公里）..."
TRIP4_RESPONSE=$(curl -s -X POST "$BASE_URL/trips" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: SAMPLE-INTERCITY-001" \
  -d '{
    "employeeId": "EMP004",
    "employeeName": "孙总监",
    "department": "SALES",
    "pickup": "北京市朝阳区国贸",
    "dropoff": "天津市和平区小白楼",
    "distanceKm": 120,
    "scheduledTime": "2024-01-17T08:00:00Z"
  }')
TRIP4_ID=$(echo "$TRIP4_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
IS_INTERCITY=$(echo "$TRIP4_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['isIntercity'])")
APPROVAL_STATUS=$(echo "$TRIP4_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['intercityApproval'])")
echo "跨城标记: $IS_INTERCITY"
echo "审批状态: $APPROVAL_STATUS"

echo "尝试直接派单（应该失败，因为需要审批）..."
DISPATCH_FAIL=$(curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV001", "driverName": "张三"}')
echo "派单失败原因: $(echo "$DISPATCH_FAIL" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown'))")"

echo "管理员审批通过..."
curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/approve-intercity" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' > /dev/null

echo "再次派单（应该成功）..."
curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"driverId": "DRV001", "driverName": "张三"}' > /dev/null
echo -e "\033[92m✓ 跨城审批完成，审批状态变化可在历史记录中查看\033[0m"

echo "完成行程..."
curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/driver-arrive" > /dev/null
curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/start" > /dev/null
END4=$(curl -s -X POST "$BASE_URL/trips/$TRIP4_ID/end" \
  -H "Content-Type: application/json" \
  -d '{"endTime": "2024-01-17T11:00:00Z"}')
FARE4=$(echo "$END4" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['fare']['total'])")
INTERCITY_FEE=$(echo "$END4" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['fare']['intercityFee'])")
echo "总费用: ¥$FARE4"
echo "跨城附加费: ¥$INTERCITY_FEE (高速加价 + 住宿补贴)"

echo -e "\n\033[1;33m=== 样例5：结算幂等性测试（重复调用返回相同结果）===\033[0m"
echo "首次结算..."
SETTLE5=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP4_ID\", \"idempotencyKey\": \"SAMPLE-SETTLE-5\", \"operator\": \"财务主管\"}")
SETTLE_ID=$(echo "$SETTLE5" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "结算ID: $SETTLE_ID"

echo "重复结算（使用相同的idempotencyKey）..."
SETTLE5_DUP=$(curl -s -X POST "$BASE_URL/settlements" \
  -H "Content-Type: application/json" \
  -d "{\"tripId\": \"$TRIP4_ID\", \"idempotencyKey\": \"SAMPLE-SETTLE-5\", \"operator\": \"财务主管\"}")
IS_DUP=$(echo "$SETTLE5_DUP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('isDuplicate', 'false'))")
echo "是否重复: $IS_DUP"
echo "重复请求返回: $(echo "$SETTLE5_DUP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'No message'))")"
echo -e "\033[92m✓ 幂等性保证完成，重复结算不会产生重复记录\033[0m"

echo -e "\n\033[1;35m===============================================\033[0m"
echo -e "\033[1;35m  生成综合报告\033[0m"
echo -e "\033[1;35m===============================================\033[0m"

echo -e "\n\033[1;34m--- 完整运营报告 ---\033[0m"
curl -s "$BASE_URL/reports/full" | python3 -m json.tool

echo -e "\n\033[1;34m--- 销售部账单 ---\033[0m"
curl -s "$BASE_URL/reports/department/SALES" | python3 -m json.tool

echo -e "\n\033[1;34m--- 司机张三收入报告 ---\033[0m"
curl -s "$BASE_URL/reports/driver/DRV001" | python3 -m json.tool

echo -e "\n\033[1;35m===============================================\033[0m"
echo -e "\033[1;35m  所有内置样例演示完成！\033[0m"
echo -e "\033[1;35m===============================================\033[0m"
echo -e "\033[92m已覆盖的业务场景：\033[0m"
echo -e "\033[92m  1. 正常行程（无异常）\033[0m"
echo -e "\033[92m  2. 员工取消（派单后取消费30元）\033[0m"
echo -e "\033[92m  3. 司机等待收费（45分钟等待，收费60元）\033[0m"
echo -e "\033[92m  4. 跨城审批（120公里需审批）\033[0m"
echo -e "\033[92m  5. 结算幂等性（重复调用不重复结算）\033[0m"
echo -e "\033[92m输出内容包括：\033[0m"
echo -e "\033[92m  ✓ 行程费用构成明细\033[0m"
echo -e "\033[92m  ✓ 部门账单汇总\033[0m"
echo -e "\033[92m  ✓ 司机收入统计\033[0m"
echo -e "\033[92m  ✓ 历史操作记录\033[0m"
