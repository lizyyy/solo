#!/bin/bash

BASE_URL="http://localhost:3001/api"

AGENT_001="AGENT_001"
AGENT_002="AGENT_002"
SUP_001="SUP_001"

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_CYAN='\033[0;36m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
echo -e "${COLOR_CYAN}   订阅客服退款 API - 演示脚本${COLOR_RESET}"
echo -e "${COLOR_CYAN}========================================${COLOR_RESET}"
echo ""

wait_for_server() {
  echo "等待服务启动..."
  for i in {1..30}; do
    if curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
      echo "服务已就绪！"
      return 0
    fi
    sleep 1
  done
  echo "错误：服务启动超时"
  exit 1
}

print_section() {
  echo ""
  echo -e "${COLOR_YELLOW}--- $1 ---${COLOR_RESET}"
  echo ""
}

print_curl() {
  echo -e "${COLOR_CYAN}curl 命令:${COLOR_RESET}"
  echo "  $1"
  echo ""
}

print_response() {
  echo -e "${COLOR_CYAN}响应:${COLOR_RESET}"
  echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

wait_for_server

echo ""
echo -e "${COLOR_GREEN}服务已连接到 ${BASE_URL}${COLOR_RESET}"
echo ""

print_section "1. 健康检查"
RESPONSE=$(curl -s "${BASE_URL}/health")
print_curl "curl ${BASE_URL}/health"
print_response "$RESPONSE"

print_section "2. 查看可用的订阅计划"
RESPONSE=$(curl -s "${BASE_URL}/plans")
print_curl "curl ${BASE_URL}/plans"
print_response "$RESPONSE"

print_section "3. 查看可用的优惠券"
RESPONSE=$(curl -s "${BASE_URL}/coupons")
print_curl "curl ${BASE_URL}/coupons"
print_response "$RESPONSE"

print_section "4. 查看客服人员"
RESPONSE=$(curl -s "${BASE_URL}/agents")
print_curl "curl ${BASE_URL}/agents"
print_response "$RESPONSE"

print_section "场景1：试用期内全额退款（正常流程）"
echo "用户在试用期内申请退款，应全额退还"

SUBSCRIPTION_RESPONSE=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"monthly_standard\",
    \"userId\": \"DEMO_USER_001\",
    \"userName\": \"演示用户-小陈\",
    \"agentId\": \"${AGENT_001}\"
  }")

print_curl "curl -X POST ${BASE_URL}/subscriptions -d '{\"planId\":\"monthly_standard\",...}'"
print_response "$SUBSCRIPTION_RESPONSE"

SUBSCRIPTION_ID=$(echo "$SUBSCRIPTION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

PAYMENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"subscriptionId\": \"${SUBSCRIPTION_ID}\",
    \"agentId\": \"${AGENT_001}\"
  }")

print_curl "curl -X POST ${BASE_URL}/payments -d '{\"subscriptionId\":\"...\",\"agentId\":\"${AGENT_001}\"}'"
print_response "$PAYMENT_RESPONSE"

ORDER_ID=$(echo "$PAYMENT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

CALC_RESPONSE=$(curl -s -X POST "${BASE_URL}/refunds/calculate" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID}\"
  }")

print_curl "curl -X POST ${BASE_URL}/refunds/calculate -d '{\"orderId\":\"${ORDER_ID}\"}'"
print_response "$CALC_RESPONSE"

REFUND_RESPONSE=$(curl -s -X POST "${BASE_URL}/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID}\",
    \"agentId\": \"${AGENT_001}\",
    \"reason\": \"用户在试用期内决定不使用产品\"
  }")

print_curl "curl -X POST ${BASE_URL}/refunds -d '{\"orderId\":\"...\",\"reason\":\"试用期取消\"}'"
print_response "$REFUND_RESPONSE"

REFUND_ID=$(echo "$REFUND_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

REVIEW_RESPONSE=$(curl -s -X POST "${BASE_URL}/refunds/${REFUND_ID}/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"${AGENT_001}\",
    \"approved\": true,
    \"supervisorNote\": \"试用期内正常退款\"
  }")

print_curl "curl -X POST ${BASE_URL}/refunds/${REFUND_ID}/review -d '{\"approved\":true}'"
print_response "$REVIEW_RESPONSE"

echo ""
echo -e "${COLOR_GREEN}✓ 场景1完成：试用期内¥99全额退款已批准${COLOR_RESET}"

print_section "场景2：金额为零的退款（自动处理）"
echo "订单已到期，退款金额为0，系统自动处理"

SUBSCRIPTION_RESPONSE2=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"monthly_pro\",
    \"userId\": \"DEMO_USER_002\",
    \"userName\": \"演示用户-小王\",
    \"agentId\": \"${AGENT_002}\"
  }")

SUBSCRIPTION_ID2=$(echo "$SUBSCRIPTION_RESPONSE2" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

PAYMENT_RESPONSE2=$(curl -s -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"subscriptionId\": \"${SUBSCRIPTION_ID2}\",
    \"agentId\": \"${AGENT_002}\",
    \"couponId\": \"NEW_USER_50\"
  }")

ORDER_ID2=$(echo "$PAYMENT_RESPONSE2" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

print_curl "curl -X POST ${BASE_URL}/refunds/calculate -d '{\"orderId\":\"...\",\"partialDays\":30}'"

CALC_RESPONSE2=$(curl -s -X POST "${BASE_URL}/refunds/calculate" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID2}\",
    \"partialDays\": 30
  }")

print_response "$CALC_RESPONSE2"

REFUND_RESPONSE2=$(curl -s -X POST "${BASE_URL}/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID2}\",
    \"agentId\": \"${AGENT_002}\",
    \"reason\": \"订阅已到期，用户询问退款\",
    \"partialDays\": 30
  }")

print_curl "curl -X POST ${BASE_URL}/refunds -d '{\"orderId\":\"...\",\"partialDays\":30}'"
print_response "$REFUND_RESPONSE2"

echo ""
echo -e "${COLOR_GREEN}✓ 场景2完成：退款金额¥0，系统自动处理${COLOR_RESET}"

print_section "场景3：年付+优惠券+大额退款需主管复核"
echo "年付计划使用优惠券后实付金额较高，退款需主管审批"

SUBSCRIPTION_RESPONSE3=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"yearly_standard\",
    \"userId\": \"DEMO_USER_003\",
    \"userName\": \"演示用户-小李\",
    \"agentId\": \"${AGENT_001}\"
  }")

SUBSCRIPTION_ID3=$(echo "$SUBSCRIPTION_RESPONSE3" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

PAYMENT_RESPONSE3=$(curl -s -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"subscriptionId\": \"${SUBSCRIPTION_ID3}\",
    \"agentId\": \"${AGENT_001}\",
    \"couponId\": \"FIRST_YEAR_200\"
  }")

print_curl "curl -X POST ${BASE_URL}/payments -d '{\"couponId\":\"FIRST_YEAR_200\"}'"
print_response "$PAYMENT_RESPONSE3"

ORDER_ID3=$(echo "$PAYMENT_RESPONSE3" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

REFUND_RESPONSE3=$(curl -s -X POST "${BASE_URL}/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID3}\",
    \"agentId\": \"${AGENT_001}\",
    \"reason\": \"使用30天后公司业务调整，需要退款\",
    \"partialDays\": 30
  }")

print_curl "curl -X POST ${BASE_URL}/refunds -d '{\"partialDays\":30}'"
print_response "$REFUND_RESPONSE3"

REFUND_ID3=$(echo "$REFUND_RESPONSE3" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo ""
echo "尝试用普通客服审批（应该失败）..."
REVIEW_FAIL=$(curl -s -X POST "${BASE_URL}/refunds/${REFUND_ID3}/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"${AGENT_001}\",
    \"approved\": true
  }")

print_curl "curl -X POST .../review -d '{\"agentId\":\"${AGENT_001}\",...}'"
print_response "$REVIEW_FAIL"

echo ""
echo "用主管账号审批..."
REVIEW_SUCCESS=$(curl -s -X POST "${BASE_URL}/refunds/${REFUND_ID3}/review" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"${SUP_001}\",
    \"approved\": true,
    \"supervisorNote\": \"情况属实，同意全额退款\"
  }")

print_curl "curl -X POST .../review -d '{\"agentId\":\"${SUP_001}\",...}'"
print_response "$REVIEW_SUCCESS"

echo ""
echo -e "${COLOR_GREEN}✓ 场景3完成：主管审批通过大额退款${COLOR_RESET}"

print_section "场景4：重复请求幂等处理"
echo "5分钟内重复提交相同退款请求，系统返回已有数据"

SUBSCRIPTION_RESPONSE4=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"monthly_standard\",
    \"userId\": \"DEMO_USER_004\",
    \"userName\": \"演示用户-小张\",
    \"agentId\": \"${AGENT_002}\"
  }")

SUBSCRIPTION_ID4=$(echo "$SUBSCRIPTION_RESPONSE4" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

PAYMENT_RESPONSE4=$(curl -s -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"subscriptionId\": \"${SUBSCRIPTION_ID4}\",
    \"agentId\": \"${AGENT_002}\"
  }")

ORDER_ID4=$(echo "$PAYMENT_RESPONSE4" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "第一次提交退款申请..."
REFUND1=$(curl -s -X POST "${BASE_URL}/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID4}\",
    \"agentId\": \"${AGENT_002}\",
    \"reason\": \"重复提交测试\"
  }")
REFUND_ID4=$(echo "$REFUND1" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
REFUND_AMOUNT1=$(echo "$REFUND1" | grep -o '"refundAmount":[^,]*' | head -1 | cut -d':' -f2)

print_curl "curl -X POST ${BASE_URL}/refunds (第一次)"
print_response "$REFUND1"

echo ""
echo "快速重复提交第二次（幂等处理）..."
REFUND2=$(curl -s -X POST "${BASE_URL}/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"${ORDER_ID4}\",
    \"agentId\": \"${AGENT_002}\",
    \"reason\": \"重复提交测试\"
  }")

print_curl "curl -X POST ${BASE_URL}/refunds (第二次 - 5分钟内)"
print_response "$REFUND2"

IS_DUPLICATE=$(echo "$REFUND2" | grep '"isDuplicate":true')
if [ -n "$IS_DUPLICATE" ]; then
  echo ""
  echo -e "${COLOR_GREEN}✓ 场景4完成：幂等处理生效，重复请求返回已有数据${COLOR_RESET}"
else
  echo ""
  echo -e "${COLOR_YELLOW}⚠ 场景4：未检测到重复（可能是时间差）${COLOR_RESET}"
fi

print_section "场景5：查看操作日志"
echo "记录了所有客服操作"

LOGS_RESPONSE=$(curl -s "${BASE_URL}/logs")
print_curl "curl ${BASE_URL}/logs"
print_response "$LOGS_RESPONSE"

print_section "场景6：今日对账"
echo "按日期统计退款总额、未结案数量和异常原因"

RECON_RESPONSE=$(curl -s "${BASE_URL}/reconciliation")
print_curl "curl ${BASE_URL}/reconciliation"
print_response "$RECON_RESPONSE"

echo ""
echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}   所有演示场景完成！${COLOR_RESET}"
echo -e "${COLOR_GREEN}========================================${COLOR_RESET}"
echo ""
echo "常用 curl 命令参考："
echo ""
echo "  # 健康检查"
echo "  curl ${BASE_URL}/health"
echo ""
echo "  # 创建订阅"
echo "  curl -X POST ${BASE_URL}/subscriptions \\"
echo "    -H \"Content-Type: application/json\" \\"
echo '    -d {"planId":"monthly_standard","userId":"USER_001","userName":"用户","agentId":"AGENT_001"}'
echo ""
echo "  # 登记付款"
echo "  curl -X POST ${BASE_URL}/payments \\"
echo "    -H \"Content-Type: application/json\" \\"
echo '    -d {"subscriptionId":"...","agentId":"AGENT_001","couponId":"NEW_USER_50"}'
echo ""
echo "  # 试算退款金额"
echo "  curl -X POST ${BASE_URL}/refunds/calculate \\"
echo "    -H \"Content-Type: application/json\" \\"
echo '    -d {"orderId":"..."}'
echo ""
echo "  # 提交退款申请"
echo "  curl -X POST ${BASE_URL}/refunds \\"
echo "    -H \"Content-Type: application/json\" \\"
echo '    -d {"orderId":"...","agentId":"AGENT_001","reason":"退款原因"}'
echo ""
echo "  # 审核退款"
echo "  curl -X POST ${BASE_URL}/refunds/{退款ID}/review \\"
echo "    -H \"Content-Type: application/json\" \\"
echo '    -d {"agentId":"AGENT_001","approved":true}'
echo ""
echo "  # 对账（指定日期）"
echo "  curl ${BASE_URL}/reconciliation?date=2026-05-11"
echo ""
echo "  # 操作日志"
echo "  curl ${BASE_URL}/logs"
echo ""
