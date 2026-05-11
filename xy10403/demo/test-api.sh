#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========================================"
echo "  园区门禁访客 API 测试流程"
echo "========================================"
echo ""

TOKEN_ADMIN=""
TOKEN_APPROVER=""
TOKEN_GATE1=""
VISITOR_CODE_NORMAL=""
VISITOR_CODE_EXPIRED=""
VISITOR_CODE_DUPLICATE=""

echo "【1】用户登录，获取Token"
echo "----------------------------------------"

echo ""
echo "1.1 管理员登录"
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}')
echo "响应: $ADMIN_RESPONSE"
TOKEN_ADMIN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")
echo "Admin Token: $TOKEN_ADMIN"

echo ""
echo "1.2 审批员登录"
APPROVER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"approver","password":"123456"}')
echo "响应: $APPROVER_RESPONSE"
TOKEN_APPROVER=$(echo "$APPROVER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")
echo "Approver Token: $TOKEN_APPROVER"

echo ""
echo "1.3 闸口操作员登录"
GATE1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"gate1","password":"123456"}')
echo "响应: $GATE1_RESPONSE"
TOKEN_GATE1=$(echo "$GATE1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])")
echo "Gate1 Token: $TOKEN_GATE1"

echo ""
echo "【2】被访人管理"
echo "----------------------------------------"

echo ""
echo "2.1 查询被访人列表"
curl -s -X GET "$BASE_URL/employees?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【3】获取闸口列表"
echo "----------------------------------------"
curl -s -X GET "$BASE_URL/gates" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "========================================"
echo "  场景一：正常入离园流程"
echo "========================================"
echo ""

echo "【3.1】创建访客预约（张三的访客）"
APPT_NORMAL=$(curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "陈经理",
    "id_card": "110101199001011001",
    "phone": "13900139001",
    "company": "客户公司A",
    "visit_purpose": "商务洽谈",
    "visitor_count": 2,
    "employee_id": 1,
    "visit_start_time": "'"$(date -v +1H '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v +4H '+%Y-%m-%d %H:%M:%S')"'",
    "access_gates": ["GATE001", "GATE002"],
    "vehicles": [
      {"plate_number": "京A12345", "vehicle_type": "轿车", "color": "黑色"}
    ]
  }')
echo "响应: $APPT_NORMAL"
APPT_ID_NORMAL=$(echo "$APPT_NORMAL" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
VISITOR_CODE_NORMAL=$(echo "$APPT_NORMAL" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['visitor_code'])")
echo ""
echo "预约ID: $APPT_ID_NORMAL"
echo "访客码: $VISITOR_CODE_NORMAL"

echo ""
echo "【3.2】审批通过预约"
curl -s -X POST "$BASE_URL/approvals/$APPT_ID_NORMAL/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_APPROVER"

echo ""
echo ""
echo "【3.3】入园核销（东门闸口）"
curl -s -X POST "$BASE_URL/gates/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_GATE1" \
  -d "{
    \"visitor_code\": \"$VISITOR_CODE_NORMAL\",
    \"gate_id\": \"GATE001\"
  }"

echo ""
echo ""
echo "【3.4】离园核销（东门闸口）"
curl -s -X POST "$BASE_URL/gates/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_GATE1" \
  -d "{
    \"visitor_code\": \"$VISITOR_CODE_NORMAL\",
    \"gate_id\": \"GATE001\"
  }"

echo ""
echo ""
echo "========================================"
echo "  场景二：过期拦截"
echo "========================================"
echo ""

echo "【4.1】创建已过期预约（访问时间在过去）"
APPT_EXPIRED=$(curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "李访客",
    "id_card": "110101199001011002",
    "phone": "13900139002",
    "company": "过期测试公司",
    "visit_purpose": "测试过期拦截",
    "visitor_count": 1,
    "employee_id": 2,
    "visit_start_time": "'"$(date -v -3H '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v -1H '+%Y-%m-%d %H:%M:%S')"'",
    "access_gates": ["GATE001"],
    "vehicles": [
      {"plate_number": "京B67890", "vehicle_type": "SUV", "color": "白色"}
    ]
  }')
echo "响应: $APPT_EXPIRED"
APPT_ID_EXPIRED=$(echo "$APPT_EXPIRED" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
VISITOR_CODE_EXPIRED=$(echo "$APPT_EXPIRED" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['visitor_code'])")
echo ""
echo "预约ID: $APPT_ID_EXPIRED"
echo "访客码: $VISITOR_CODE_EXPIRED"

echo ""
echo "【4.2】审批通过过期预约"
curl -s -X POST "$BASE_URL/approvals/$APPT_ID_EXPIRED/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_APPROVER"

echo ""
echo ""
echo "【4.3】手动执行过期回收"
curl -s -X POST "$BASE_URL/recycle/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【4.4】尝试入园（应该被拦截）"
echo ""
echo "预期结果：预约已过期，无法入园"
echo ""
curl -s -X POST "$BASE_URL/gates/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_GATE1" \
  -d "{
    \"visitor_code\": \"$VISITOR_CODE_EXPIRED\",
    \"gate_id\": \"GATE001\"
  }"

echo ""
echo ""
echo "========================================"
echo "  场景三：重复核销拦截"
echo "========================================"
echo ""

echo "【5.1】创建有效预约"
APPT_DUPLICATE=$(curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "王重复",
    "id_card": "110101199001011003",
    "phone": "13900139003",
    "company": "重复测试公司",
    "visit_purpose": "测试重复核销",
    "visitor_count": 1,
    "employee_id": 3,
    "visit_start_time": "'"$(date -v +30M '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v +3H '+%Y-%m-%d %H:%M:%S')"'",
    "access_gates": ["GATE001"],
    "vehicles": []
  }')
echo "响应: $APPT_DUPLICATE"
APPT_ID_DUPLICATE=$(echo "$APPT_DUPLICATE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
VISITOR_CODE_DUPLICATE=$(echo "$APPT_DUPLICATE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['visitor_code'])")
echo ""
echo "预约ID: $APPT_ID_DUPLICATE"
echo "访客码: $VISITOR_CODE_DUPLICATE"

echo ""
echo "【5.2】审批通过"
curl -s -X POST "$BASE_URL/approvals/$APPT_ID_DUPLICATE/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_APPROVER"

echo ""
echo ""
echo "【5.3】第一次入园（成功）"
curl -s -X POST "$BASE_URL/gates/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_GATE1" \
  -d "{
    \"visitor_code\": \"$VISITOR_CODE_DUPLICATE\",
    \"gate_id\": \"GATE001\"
  }"

echo ""
echo ""
echo "【5.4】第二次入园（应该被拦截-重复核销）"
echo ""
echo "预期结果：重复核销：访客已在园内"
echo ""
curl -s -X POST "$BASE_URL/gates/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_GATE1" \
  -d "{
    \"visitor_code\": \"$VISITOR_CODE_DUPLICATE\",
    \"gate_id\": \"GATE001\"
  }"

echo ""
echo ""
echo "========================================"
echo "  场景四：其他校验场景"
echo "========================================"
echo ""

echo "【6.1】同一证件重复预约校验"
echo ""
echo "尝试为同一身份证在相同时间创建另一个预约"
curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "王重复-克隆",
    "id_card": "110101199001011003",
    "phone": "13900139099",
    "company": "重复测试公司",
    "visit_purpose": "测试证件重复",
    "visitor_count": 1,
    "employee_id": 1,
    "visit_start_time": "'"$(date -v +1H '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v +2H '+%Y-%m-%d %H:%M:%S')"'",
    "access_gates": ["GATE001"]
  }'

echo ""
echo ""
echo "【6.2】车牌占用校验"
echo ""
echo "尝试使用已被陈经理预约占用的车牌京A12345"
curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "车牌测试",
    "id_card": "110101199001011099",
    "phone": "13900139099",
    "company": "车牌测试公司",
    "visit_purpose": "测试车牌占用",
    "visitor_count": 1,
    "employee_id": 2,
    "visit_start_time": "'"$(date -v +1H '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v +3H '+%Y-%m-%d %H:%M:%S')"'",
    "access_gates": ["GATE001"],
    "vehicles": [
      {"plate_number": "京A12345", "vehicle_type": "轿车", "color": "黑色"}
    ]
  }'

echo ""
echo ""
echo "【6.3】被访人无效校验"
echo ""
echo "先停用员工张三，再尝试预约"
curl -s -X PUT "$BASE_URL/employees/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"status":"inactive"}'

echo ""
echo "尝试预约已停用的员工"
curl -s -X POST "$BASE_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{
    "visitor_name": "被访人测试",
    "id_card": "110101199001011088",
    "phone": "13900139088",
    "company": "测试公司",
    "visit_purpose": "测试被访人无效",
    "visitor_count": 1,
    "employee_id": 1,
    "visit_start_time": "'"$(date -v +1H '+%Y-%m-%d %H:%M:%S')"'",
    "visit_end_time": "'"$(date -v +3H '+%Y-%m-%d %H:%M:%S')"'"
  }'

echo ""
echo "恢复员工张三为有效状态"
curl -s -X PUT "$BASE_URL/employees/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -d '{"status":"active"}'

echo ""
echo ""
echo "========================================"
echo "  【7】历史查询和汇总导出"
echo "========================================"
echo ""

echo "【7.1】查询通行记录（按访客名）"
curl -s -X GET "$BASE_URL/queries/records?visitor_name=陈&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【7.2】查询通行记录（按车牌）"
curl -s -X GET "$BASE_URL/queries/records?plate_number=京A&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【7.3】查询通行记录（按闸口）"
curl -s -X GET "$BASE_URL/queries/records?gate_id=GATE001&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【7.4】查询通行记录（按日期）"
curl -s -X GET "$BASE_URL/queries/records?start_date=$(date '+%Y-%m-%d')&end_date=$(date '+%Y-%m-%d')&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【7.5】今日统计"
curl -s -X GET "$BASE_URL/queries/statistics" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "【7.6】导出今日异常通行汇总"
curl -s -X GET "$BASE_URL/queries/exception-summary" \
  -H "Authorization: Bearer $TOKEN_ADMIN"

echo ""
echo ""
echo "========================================"
echo "  测试完成！"
echo "========================================"
