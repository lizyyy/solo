#!/bin/bash

set -e

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo ""
echo "========================================"
echo "  商场快闪摊位用电审批 API 验收脚本"
echo "========================================"
echo ""

echo "[步骤 0] 安装依赖并启动服务..."
echo "----------------------------------------"

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

echo "正在启动服务（后台运行）..."
node server.js &
SERVER_PID=$!
sleep 3

echo ""
echo "[步骤 1] 健康检查"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/health"
HEALTH_RESULT=$(curl -s "$BASE_URL/api/health")
echo "结果:"
echo "$HEALTH_RESULT" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESULT"

echo ""
echo "[步骤 2] 查看所有状态说明"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/statuses"
STATUS_RESULT=$(curl -s "$BASE_URL/api/statuses")
echo "结果:"
echo "$STATUS_RESULT" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESULT"

echo ""
echo "[步骤 3] 查看 1F 楼层容量（申请前）"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/floors/1F/capacity"
FLOOR_RESULT=$(curl -s "$BASE_URL/api/floors/1F/capacity")
echo "结果:"
echo "$FLOOR_RESULT" | python3 -m json.tool 2>/dev/null || echo "$FLOOR_RESULT"

echo ""
echo "[步骤 4] 创建第一个用电申请（正常场景）"
echo "----------------------------------------"
echo "申请内容: 1F-A01摊位，活动 3天，总功率 20kW"
REQ_ID_1="req-create-${TIMESTAMP}-001"

CREATE_REQUEST_1='{
  "applicant_name": "张三",
  "applicant_contact": "13800138001",
  "activity_name": "夏季服装促销",
  "booth_code": "1F-A01",
  "start_time": "2026-06-01T10:00:00.000Z",
  "end_time": "2026-06-03T22:00:00.000Z",
  "devices": [
    {
      "device_name": "空调",
      "device_type": "制冷设备",
      "power_kw": 5,
      "quantity": 2
    },
    {
      "device_name": "LED展示屏",
      "device_type": "展示设备",
      "power_kw": 8,
      "quantity": 1
    },
    {
      "device_name": "收银机",
      "device_type": "电子设备",
      "power_kw": 2,
      "quantity": 1
    }
  ]
}'

echo "执行 curl 命令创建申请..."
CREATE_RESULT_1=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_1" \
  -d "$CREATE_REQUEST_1")

echo "结果:"
echo "$CREATE_RESULT_1" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_1"

APPLICATION_NO_1=$(echo "$CREATE_RESULT_1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['application_no'])" 2>/dev/null || echo "")

if [ -n "$APPLICATION_NO_1" ]; then
    echo ""
    echo "申请编号: $APPLICATION_NO_1"
fi

echo ""
echo "[步骤 5] 重复提交同一请求（测试幂等性）"
echo "----------------------------------------"
echo "使用相同的 X-Request-Id 再次提交..."

CREATE_RESULT_1_DUP=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_1" \
  -d "$CREATE_REQUEST_1")

echo "结果（应与步骤4完全相同，不会创建新申请）:"
echo "$CREATE_RESULT_1_DUP" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_1_DUP"

echo ""
echo "[步骤 6] 提交审批（DRAFT -> PENDING_APPROVAL）"
echo "----------------------------------------"
REQ_ID_SUBMIT="req-submit-${TIMESTAMP}-001"
SUBMIT_REQUEST='{"action": "SUBMIT", "remark": "申请材料已完整，请审批"}'

echo "执行 curl 命令提交审批..."
SUBMIT_RESULT=$(curl -s -X POST "$BASE_URL/api/applications/$APPLICATION_NO_1/advance" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_SUBMIT" \
  -d "$SUBMIT_REQUEST")

echo "结果:"
echo "$SUBMIT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SUBMIT_RESULT"

echo ""
echo "[步骤 7] 查看 1F 楼层容量（有1个待审批申请占用容量）"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/floors/1F/capacity"
FLOOR_RESULT_2=$(curl -s "$BASE_URL/api/floors/1F/capacity")
echo "结果:"
echo "$FLOOR_RESULT_2" | python3 -m json.tool 2>/dev/null || echo "$FLOOR_RESULT_2"

echo ""
echo "[步骤 8] 审批通过（PENDING_APPROVAL -> APPROVED）"
echo "----------------------------------------"
REQ_ID_APPROVE="req-approve-${TIMESTAMP}-001"
APPROVE_REQUEST='{"action": "APPROVE", "remark": "容量充足，同意用电申请"}'

echo "执行 curl 命令审批通过..."
APPROVE_RESULT=$(curl -s -X POST "$BASE_URL/api/applications/$APPLICATION_NO_1/advance" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_APPROVE" \
  -d "$APPROVE_REQUEST")

echo "结果:"
echo "$APPROVE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$APPROVE_RESULT"

echo ""
echo "[步骤 9] 创建第二个申请 - 测试容量冲突（异常场景1）"
echo "----------------------------------------"
echo "申请内容: 1F-A02摊位，同一时段，总功率 80kW（超过剩余容量）"
REQ_ID_2="req-create-${TIMESTAMP}-002"

CREATE_REQUEST_2='{
  "applicant_name": "李四",
  "applicant_contact": "13800138002",
  "activity_name": "家电展销",
  "booth_code": "1F-A02",
  "start_time": "2026-06-01T10:00:00.000Z",
  "end_time": "2026-06-03T22:00:00.000Z",
  "devices": [
    {
      "device_name": "大型展示冰箱",
      "device_type": "制冷设备",
      "power_kw": 20,
      "quantity": 4
    }
  ]
}'

echo "执行 curl 命令创建申请（预期失败：楼层容量不足）..."
CREATE_RESULT_2=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_2" \
  -d "$CREATE_REQUEST_2")

echo "结果（应返回 CAPACITY_EXCEEDED 错误）:"
echo "$CREATE_RESULT_2" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_2"

echo ""
echo "[步骤 10] 创建第三个申请 - 测试时段冲突（异常场景2）"
echo "----------------------------------------"
echo "申请内容: 1F-A01摊位（已被占用），同时段小功率申请"
REQ_ID_3="req-create-${TIMESTAMP}-003"

CREATE_REQUEST_3='{
  "applicant_name": "王五",
  "applicant_contact": "13800138003",
  "activity_name": "小商品促销",
  "booth_code": "1F-A01",
  "start_time": "2026-06-02T10:00:00.000Z",
  "end_time": "2026-06-02T22:00:00.000Z",
  "devices": [
    {
      "device_name": "普通照明",
      "device_type": "照明",
      "power_kw": 1,
      "quantity": 5
    }
  ]
}'

echo "执行 curl 命令创建申请（预期失败：时段冲突）..."
CREATE_RESULT_3=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_3" \
  -d "$CREATE_REQUEST_3")

echo "结果（应返回 TIME_CONFLICT 错误）:"
echo "$CREATE_RESULT_3" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_3"

echo ""
echo "[步骤 11] 创建第四个申请 - 测试缺字段（异常场景3）"
echo "----------------------------------------"
echo "申请内容: 缺少必要字段"
REQ_ID_4="req-create-${TIMESTAMP}-004"

CREATE_REQUEST_4='{
  "applicant_name": "赵六",
  "booth_code": "1F-B01"
}'

echo "执行 curl 命令创建申请（预期失败：字段校验错误）..."
CREATE_RESULT_4=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_4" \
  -d "$CREATE_REQUEST_4")

echo "结果（应返回 VALIDATION_ERROR 错误）:"
echo "$CREATE_RESULT_4" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_4"

echo ""
echo "[步骤 12] 创建一个正常的新申请用于撤回测试"
echo "----------------------------------------"
REQ_ID_5="req-create-${TIMESTAMP}-005"

CREATE_REQUEST_5='{
  "applicant_name": "孙七",
  "applicant_contact": "13800138005",
  "activity_name": "图书展销",
  "booth_code": "1F-B01",
  "start_time": "2026-07-01T10:00:00.000Z",
  "end_time": "2026-07-05T22:00:00.000Z",
  "devices": [
    {
      "device_name": "书架照明灯",
      "device_type": "照明",
      "power_kw": 0.5,
      "quantity": 10
    }
  ]
}'

echo "执行 curl 命令创建申请..."
CREATE_RESULT_5=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_5" \
  -d "$CREATE_REQUEST_5")

echo "结果:"
echo "$CREATE_RESULT_5" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT_5"

APPLICATION_NO_5=$(echo "$CREATE_RESULT_5" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['application_no'])" 2>/dev/null || echo "")

echo ""
echo "[步骤 13] 撤回申请"
echo "----------------------------------------"
REQ_ID_WITHDRAW="req-withdraw-${TIMESTAMP}-001"
WITHDRAW_REQUEST='{"reason": "活动取消，申请撤回"}'

echo "执行 curl 命令撤回申请..."
WITHDRAW_RESULT=$(curl -s -X POST "$BASE_URL/api/applications/$APPLICATION_NO_5/withdraw" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_WITHDRAW" \
  -d "$WITHDRAW_REQUEST")

echo "结果:"
echo "$WITHDRAW_RESULT" | python3 -m json.tool 2>/dev/null || echo "$WITHDRAW_RESULT"

echo ""
echo "[步骤 14] 创建申请用于修改测试"
echo "----------------------------------------"
REQ_ID_6="req-create-${TIMESTAMP}-006"

CREATE_REQUEST_6='{
  "applicant_name": "周八",
  "applicant_contact": "13800138006",
  "activity_name": "珠宝展示",
  "booth_code": "2F-A01",
  "start_time": "2026-06-10T10:00:00.000Z",
  "end_time": "2026-06-15T22:00:00.000Z",
  "devices": [
    {
      "device_name": "展柜射灯",
      "device_type": "照明",
      "power_kw": 0.5,
      "quantity": 20
    }
  ]
}'

echo "执行 curl 命令创建申请..."
CREATE_RESULT_6=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_6" \
  -d "$CREATE_REQUEST_6")

APPLICATION_NO_6=$(echo "$CREATE_RESULT_6" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['application_no'])" 2>/dev/null || echo "")
echo "申请编号: $APPLICATION_NO_6"

echo ""
echo "[步骤 15] 修改申请（增加设备功率）"
echo "----------------------------------------"
REQ_ID_MODIFY="req-modify-${TIMESTAMP}-001"

MODIFY_REQUEST='{
  "devices": [
    {
      "device_name": "展柜射灯",
      "device_type": "照明",
      "power_kw": 0.5,
      "quantity": 20
    },
    {
      "device_name": "LED大屏",
      "device_type": "展示设备",
      "power_kw": 5,
      "quantity": 1
    }
  ]
}'

echo "执行 curl 命令修改申请..."
MODIFY_RESULT=$(curl -s -X PUT "$BASE_URL/api/applications/$APPLICATION_NO_6" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $REQ_ID_MODIFY" \
  -d "$MODIFY_REQUEST")

echo "结果:"
echo "$MODIFY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$MODIFY_RESULT"

echo ""
echo "[步骤 16] 查询所有申请汇总"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/applications"
QUERY_RESULT=$(curl -s "$BASE_URL/api/applications")
echo "结果:"
echo "$QUERY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$QUERY_RESULT"

echo ""
echo "[步骤 17] 按状态查询 - 待审批状态"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/applications?status=PENDING_APPROVAL"
QUERY_PENDING=$(curl -s "$BASE_URL/api/applications?status=PENDING_APPROVAL")
echo "结果:"
echo "$QUERY_PENDING" | python3 -m json.tool 2>/dev/null || echo "$QUERY_PENDING"

echo ""
echo "[步骤 18] 查询第一个申请的详细信息"
echo "----------------------------------------"
echo "执行: curl $BASE_URL/api/applications/$APPLICATION_NO_1"
DETAIL_RESULT=$(curl -s "$BASE_URL/api/applications/$APPLICATION_NO_1")
echo "结果:"
echo "$DETAIL_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DETAIL_RESULT"

echo ""
echo "========================================"
echo "  验收测试完成！"
echo "========================================"
echo ""
echo "已完成的测试场景:"
echo "  ✓ 正常创建申请"
echo "  ✓ 幂等性测试（重复请求）"
echo "  ✓ 状态流转（草稿→待审批→通过）"
echo "  ✓ 楼层容量冲突校验"
echo "  ✓ 时段冲突校验"
echo "  ✓ 必填字段校验"
echo "  ✓ 撤回申请"
echo "  ✓ 修改申请"
echo "  ✓ 查询申请列表和汇总"
echo "  ✓ 查询申请详情"
echo ""
echo "测试数据摘要:"
echo "  第一个申请编号: $APPLICATION_NO_1"
echo "  撤回的申请编号: $APPLICATION_NO_5"
echo "  修改的申请编号: $APPLICATION_NO_6"
echo ""

read -p "是否停止服务? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kill $SERVER_PID 2>/dev/null
    echo "服务已停止"
else
    echo "服务继续运行中，PID: $SERVER_PID"
    echo "可使用以下命令停止: kill $SERVER_PID"
fi
