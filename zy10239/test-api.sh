#!/bin/bash

BASE_URL="http://localhost:3000/api"
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

print_header() {
  echo -e "\n${COLOR_BLUE}========================================${COLOR_RESET}"
  echo -e "${COLOR_BLUE}$1${COLOR_RESET}"
  echo -e "${COLOR_BLUE}========================================${COLOR_RESET}"
}

print_success() {
  echo -e "${COLOR_GREEN}✅ $1${COLOR_RESET}"
}

print_error() {
  echo -e "${COLOR_RED}❌ $1${COLOR_RESET}"
}

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 2

# 1. 获取印章列表
print_header "1. 获取所有印章列表"
SEALS_RESPONSE=$(curl -s -X GET "$BASE_URL/seals")
echo "$SEALS_RESPONSE" | jq .

# 提取第一个印章ID
SEAL_ID=$(echo "$SEALS_RESPONSE" | jq -r '.data[0].id')
print_success "获取到印章ID: $SEAL_ID"

# 2. 创建外借申请 - 正常流程
print_header "2. 创建外借申请 (正常流程)"
APP1_RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "'"$SEAL_ID"'",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "签订销售合同",
    "expectedLendDate": "2024-01-15T09:00:00.000Z",
    "expectedReturnDate": "2024-01-16T18:00:00.000Z",
    "reason": "与重要客户签订年度合同"
  }')
echo "$APP1_RESPONSE" | jq .
APP1_ID=$(echo "$APP1_RESPONSE" | jq -r '.data.id')
print_success "创建申请成功，申请ID: $APP1_ID"

# 3. 错误：重复提交相同申请
print_header "3. 错误测试：重复提交相同申请"
DUP_RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "'"$SEAL_ID"'",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "签订销售合同",
    "expectedLendDate": "2024-01-15T09:00:00.000Z",
    "expectedReturnDate": "2024-01-16T18:00:00.000Z",
    "reason": "与重要客户签订年度合同"
  }')
echo "$DUP_RESPONSE" | jq .
if echo "$DUP_RESPONSE" | grep -q "重复提交"; then
  print_success "正确拦截：重复提交被拒绝"
else
  print_error "拦截失败"
fi

# 4. 错误：归还日期早于借出日期
print_header "4. 错误测试：归还日期早于借出日期"
DATE_ERR_RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "'"$SEAL_ID"'",
    "applicantId": "user001",
    "applicantName": "张三",
    "purpose": "测试日期",
    "expectedLendDate": "2024-01-20T09:00:00.000Z",
    "expectedReturnDate": "2024-01-10T18:00:00.000Z",
    "reason": "测试"
  }')
echo "$DATE_ERR_RESPONSE" | jq .
if echo "$DATE_ERR_RESPONSE" | grep -q "早于"; then
  print_success "正确拦截：日期错误被拒绝"
else
  print_error "拦截失败"
fi

# 5. 错误：审批人与申请人相同
print_header "5. 错误测试：审批人与申请人相同"
SELF_APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "user001",
    "approverName": "张三",
    "remark": "自己审批"
  }')
echo "$SELF_APPROVE_RESPONSE" | jq .
if echo "$SELF_APPROVE_RESPONSE" | grep -q "相同"; then
  print_success "正确拦截：自审自批被拒绝"
else
  print_error "拦截失败"
fi

# 6. 正确审批通过
print_header "6. 正确流程：审批通过申请"
APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "admin001",
    "approverName": "李四",
    "remark": "同意，请注意保管"
  }')
echo "$APPROVE_RESPONSE" | jq .
print_success "审批通过"

# 7. 错误：未审批直接出借（创建第二个申请用于测试）
print_header "7. 创建第二个申请用于测试未审批出借"
APP2_RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "sealId": "'"$SEAL_ID"'",
    "applicantId": "user002",
    "applicantName": "赵六",
    "purpose": "采购合同",
    "expectedLendDate": "2024-01-18T09:00:00.000Z",
    "expectedReturnDate": "2024-01-19T18:00:00.000Z",
    "reason": "采购设备"
  }')
APP2_ID=$(echo "$APP2_RESPONSE" | jq -r '.data.id')
print_success "创建第二个申请成功，申请ID: $APP2_ID"

print_header "8. 错误测试：未审批直接出借"
UNAPPROVED_LEND_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP2_ID/lend" \
  -H "Content-Type: application/json" \
  -d '{
    "lenderId": "admin002",
    "lenderName": "王五"
  }')
echo "$UNAPPROVED_LEND_RESPONSE" | jq .
if echo "$UNAPPROVED_LEND_RESPONSE" | grep -q "审批通过"; then
  print_success "正确拦截：未审批出借被拒绝"
else
  print_error "拦截失败"
fi

# 9. 出借第一个申请的印章
print_header "9. 正确流程：出借印章"
LEND_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP1_ID/lend" \
  -H "Content-Type: application/json" \
  -d '{
    "lenderId": "admin002",
    "lenderName": "王五",
    "actualLendDate": "2024-01-15T10:30:00.000Z"
  }')
echo "$LEND_RESPONSE" | jq .
print_success "印章已出借"

# 10. 错误：同一印章同时外借（尝试审批第二个申请）
print_header "10. 错误测试：同一印章同时外借"
SIMUL_LEND_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP2_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "admin001",
    "approverName": "李四"
  }')
echo "$SIMUL_LEND_RESPONSE" | jq .
if echo "$SIMUL_LEND_RESPONSE" | grep -q "已被借出"; then
  print_success "正确拦截：同时外借被拒绝"
else
  print_error "拦截失败"
fi

# 11. 归还印章 - 错误：归还日期早于借出
print_header "11. 错误测试：归还日期早于借出日期"
RETURN_DATE_ERR_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP1_ID/return" \
  -H "Content-Type: application/json" \
  -d '{
    "returnerId": "admin002",
    "returnerName": "王五",
    "actualReturnDate": "2024-01-10T15:00:00.000Z"
  }')
echo "$RETURN_DATE_ERR_RESPONSE" | jq .
if echo "$RETURN_DATE_ERR_RESPONSE" | grep -q "早于"; then
  print_success "正确拦截：归还日期错误被拒绝"
else
  print_error "拦截失败"
fi

# 12. 正确归还印章
print_header "12. 正确流程：归还印章"
RETURN_RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APP1_ID/return" \
  -H "Content-Type: application/json" \
  -d '{
    "returnerId": "admin002",
    "returnerName": "王五",
    "actualReturnDate": "2024-01-16T15:00:00.000Z"
  }')
echo "$RETURN_RESPONSE" | jq .
print_success "印章已归还"

# 13. 查询逾期申请
print_header "13. 查询逾期申请"
OVERDUE_RESPONSE=$(curl -s -X GET "$BASE_URL/overdue")
echo "$OVERDUE_RESPONSE" | jq .
print_success "逾期查询完成"

# 14. 导出使用记录
print_header "14. 导出使用记录 (CSV)"
curl -s -X GET "$BASE_URL/export?startDate=2024-01-01&endDate=2024-12-31" -o seal-records.csv
print_success "使用记录已导出到 seal-records.csv"
cat seal-records.csv

# 15. 获取所有申请列表
print_header "15. 获取所有申请列表"
ALL_APPS_RESPONSE=$(curl -s -X GET "$BASE_URL/applications")
echo "$ALL_APPS_RESPONSE" | jq .

echo -e "\n${COLOR_GREEN}========================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}🎉 所有测试完成！${COLOR_RESET}"
echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
