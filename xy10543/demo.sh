#!/bin/bash

BASE_URL="http://localhost:8000"

print_separator() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
}

execute_curl() {
    local step_name=$1
    shift
    echo ""
    echo ">> $step_name"
    echo "   命令: $@"
    echo ""
    response=$(eval "$@")
    echo "   响应:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

MERGE_NO=""
REPORT_NO=""

print_separator "【场景一】安全合并 - M002 并入 M001（同手机号同姓名）"

echo "步骤 1: 查看两个会员的当前资产"
response=$(curl -s "$BASE_URL/api/members/M001")
echo "M001 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M001 积分: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['points'] if d['success'] else 'N/A')")"

response=$(curl -s "$BASE_URL/api/members/M002")
echo "M002 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M002 积分: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['points'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 2: 资产试算"
response=$(curl -s -X POST "$BASE_URL/api/merges/preview" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M002","target_member_no":"M001"}')
echo "可合并: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['is_mergeable'] if d['success'] else 'N/A')")"
echo "预计目标储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['estimated_target_balance'] if d['success'] else 'N/A')")"
echo "预计目标积分: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['estimated_target_points'] if d['success'] else 'N/A')")"
warnings=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['warnings'] if d['success'] else '[]')")
echo "警告: $warnings"

echo ""
echo "步骤 3: 发起并卡申请（带幂等键 IDEM-001）"
response=$(curl -s -X POST "$BASE_URL/api/merges/initiate" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M002","target_member_no":"M001","reason":"顾客换手机号后重复注册","operator":"客服小王","idempotency_key":"IDEM-001"}')
MERGE_NO=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['merge_no'] if d['success'] else '')")
echo "并卡单号: $MERGE_NO"
echo "当前状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 4: 重复调用（验证幂等性）"
response=$(curl -s -X POST "$BASE_URL/api/merges/initiate" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M002","target_member_no":"M001","reason":"顾客换手机号后重复注册","operator":"客服小王","idempotency_key":"IDEM-001"}')
echo "是否幂等: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['is_idempotent'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 5: 确认并执行合并"
response=$(curl -s -X POST "$BASE_URL/api/merges/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"merge_no\":\"$MERGE_NO\",\"operator\":\"客服小王\",\"remark\":\"已电话确认顾客意愿\"}")
echo "执行结果: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'] if d['success'] else d['message'])")"
echo "最终状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 6: 查看合并后的会员资产"
response=$(curl -s "$BASE_URL/api/members/M001")
echo "M001 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M001 积分: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['points'] if d['success'] else 'N/A')")"
echo "M001 状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

response=$(curl -s "$BASE_URL/api/members/M002")
echo "M002 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M002 积分: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['points'] if d['success'] else 'N/A')")"
echo "M002 状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 7: 查看并卡详情和历史记录"
response=$(curl -s "$BASE_URL/api/merges/$MERGE_NO")
echo "历史记录数量: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']['histories']) if d['success'] else 0)")"
echo "审核记录数量: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']['reviews']) if d['success'] else 0)")"

echo ""
echo "步骤 8: 生成并卡报告"
response=$(curl -s -X POST "$BASE_URL/api/reports/generate" \
  -H "Content-Type: application/json" \
  -d "{\"merge_no\":\"$MERGE_NO\",\"report_type\":\"detailed\",\"operator\":\"客服小王\"}")
REPORT_NO=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['report_no'] if d['success'] else '')")
echo "报告编号: $REPORT_NO"

echo ""
echo "步骤 9: 下载报告（预览前 500 字符）"
response=$(curl -s "$BASE_URL/api/reports/$REPORT_NO/download")
echo "${response:0:500}..."

print_separator "【场景二】信息冲突待审 - M004 并入 M003（同手机号不同姓名）"

echo "步骤 1: 资产试算（查看冲突）"
response=$(curl -s -X POST "$BASE_URL/api/merges/preview" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M004","target_member_no":"M003"}')
echo "可合并: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['is_mergeable'] if d['success'] else 'N/A')")"
conflicts=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['conflicts'] if d['success'] else '[]')")
echo "冲突: $conflicts"

echo ""
echo "步骤 2: 发起并卡申请"
response=$(curl -s -X POST "$BASE_URL/api/merges/initiate" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M004","target_member_no":"M003","reason":"姓名拼写错误导致重复","operator":"客服小李"}')
MERGE_NO2=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['merge_no'] if d['success'] else '')")
echo "并卡单号: $MERGE_NO2"
echo "当前状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 3: 人工审核姓名冲突（通过）"
response=$(curl -s -X POST "$BASE_URL/api/merges/review" \
  -H "Content-Type: application/json" \
  -d "{\"merge_no\":\"$MERGE_NO2\",\"conflict_type\":\"name\",\"decision\":\"accept\",\"after_value\":\"李四\",\"explanation\":\"李四五是李四的别名，经顾客确认使用李四\",\"operator\":\"主管老张\"}")
echo "审核结果: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'] if d['success'] else d['message'])")"
echo "审核后状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 4: 确认执行合并"
response=$(curl -s -X POST "$BASE_URL/api/merges/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"merge_no\":\"$MERGE_NO2\",\"operator\":\"客服小李\"}")
echo "执行结果: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'] if d['success'] else d['message'])")"

print_separator "【场景三】储值异常拦截 - M005 并入 M006（余额为负）"

echo "步骤 1: 资产试算"
response=$(curl -s -X POST "$BASE_URL/api/merges/preview" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M005","target_member_no":"M006"}')
echo "可合并: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['is_mergeable'] if d['success'] else 'N/A')")"
echo "失败原因: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['reason_if_not_mergeable'] if d['success'] and d['data'] else d['message'])")"

echo ""
echo "步骤 2: 尝试发起并卡申请"
response=$(curl -s -X POST "$BASE_URL/api/merges/initiate" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M005","target_member_no":"M006","reason":"测试异常拦截","operator":"客服测试"}')
echo "请求结果: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print('成功' if d['success'] else '失败')")"
echo "消息: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'])")"

print_separator "【场景四】撤销窗口 - 演示撤销功能"

echo "步骤 1: 先创建额外的测试会员"
curl -s -X POST "$BASE_URL/api/members" \
  -H "Content-Type: application/json" \
  -d '{"member_no":"M007","name":"钱七","phone":"13800000005","balance":100.0,"points":200}' > /dev/null

curl -s -X POST "$BASE_URL/api/members" \
  -H "Content-Type: application/json" \
  -d '{"member_no":"M008","name":"钱七","phone":"13800000005","balance":50.0,"points":100}' > /dev/null

echo ""
echo "步骤 2: 发起并卡申请"
response=$(curl -s -X POST "$BASE_URL/api/merges/initiate" \
  -H "Content-Type: application/json" \
  -d '{"source_member_no":"M008","target_member_no":"M007","reason":"测试撤销功能","operator":"客服测试"}')
MERGE_NO3=$(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['merge_no'] if d['success'] else '')")
echo "并卡单号: $MERGE_NO3"
echo "状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['merge']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 3: 撤销并卡"
response=$(curl -s -X POST "$BASE_URL/api/merges/cancel" \
  -H "Content-Type: application/json" \
  -d "{\"merge_no\":\"$MERGE_NO3\",\"operator\":\"客服测试\",\"remark\":\"顾客临时改变主意\"}")
echo "撤销结果: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['message'] if d['success'] else d['message'])")"
echo "撤销后状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

echo ""
echo "步骤 4: 验证会员资产未改变"
response=$(curl -s "$BASE_URL/api/members/M007")
echo "M007 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M007 状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

response=$(curl -s "$BASE_URL/api/members/M008")
echo "M008 储值: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['balance'] if d['success'] else 'N/A')")"
echo "M008 状态: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['status'] if d['success'] else 'N/A')")"

print_separator "【查询演示】按手机号查询并卡记录"

response=$(curl -s -X POST "$BASE_URL/api/merges/query" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000001"}')
echo "找到记录数: $(echo $response | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']) if d['success'] else 0)")"

print_separator "演示完成！"
echo ""
echo "关键结果总结:"
echo "  - 安全合并 (M002->M001): $MERGE_NO"
echo "  - 冲突审核 (M004->M003): $MERGE_NO2"
echo "  - 撤销演示 (M008->M007): $MERGE_NO3"
echo "  - 报告编号: $REPORT_NO"
echo ""
echo "可通过以下命令查看详细报告:"
echo "  curl $BASE_URL/api/reports/$REPORT_NO/download"
echo ""
