#!/bin/bash

set -e

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() {
    echo ""
    echo "============================================================"
    echo "  $1"
    echo "============================================================"
    echo ""
}

assert() {
    local name="$1"
    local condition="$2"
    local expected="$3"
    local actual="$4"
    
    if [ "$condition" = "contains" ]; then
        if echo "$actual" | grep -q "$expected"; then
            echo -e "${GREEN}  ✓ $name${NC}"
            ((PASS++))
        else
            echo -e "${RED}  ✗ $name${NC}"
            echo "    期望包含: $expected"
            echo "    实际输出: $actual"
            ((FAIL++))
        fi
    elif [ "$condition" = "equals" ]; then
        if [ "$actual" = "$expected" ]; then
            echo -e "${GREEN}  ✓ $name${NC}"
            ((PASS++))
        else
            echo -e "${RED}  ✗ $name${NC}"
            echo "    期望: $expected"
            echo "    实际: $actual"
            ((FAIL++))
        fi
    fi
}

wait_for_server() {
    echo "等待服务启动..."
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            echo "服务已就绪"
            return 0
        fi
        sleep 1
    done
    echo "错误：服务启动超时"
    exit 1
}

echo ""
echo "################################################################"
echo "#   演出票务限购 API - CURL 测试脚本"
echo "#   说明：请先在另一个终端运行 'npm start' 启动服务"
echo "################################################################"

if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo ""
    echo "✓ 检测到服务已运行"
else
    echo ""
    echo -e "${YELLOW}未检测到运行中的服务，请先执行：${NC}"
    echo "    终端 1: npm start"
    echo "    终端 2: npm run test:curl"
    echo ""
    exit 1
fi

echo ""
echo "⚠️  此脚本会创建真实数据用于演示"
echo "⚠️  每次运行前建议清空数据库：rm -rf ./data"
echo ""
read -p "确认继续? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

print_header "1. 创建演出"

echo "  创建周杰伦演唱会..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/shows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "周杰伦「嘉年华」世界巡回演唱会 - 北京站",
    "startTime": "2024-12-20 19:30:00",
    "venue": "北京鸟巢体育场",
    "description": "2024 年度最期待演唱会"
  }')

echo "  响应: $RESPONSE"
SHOW_ID=$(echo "$RESPONSE" | sed -n 's/.*"showId":"\([^"]*\)".*/\1/p')
assert "演出创建成功" "contains" '"success":true' "$RESPONSE"
assert "返回演出 ID" "contains" "showId" "$RESPONSE"

print_header "2. 创建票档"

echo "  创建 VIP 内场票 (2888 元，10 张)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/shows/$SHOW_ID/tiers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP 内场票",
    "price": 2888,
    "totalQuantity": 10,
    "perIdCardLimit": 2,
    "perAccountLimit": 4,
    "perPaymentLimit": 2
  }')
echo "  响应: $RESPONSE"
VIP_TIER_ID=$(echo "$RESPONSE" | sed -n 's/.*"tierId":"\([^"]*\)".*/\1/p')
assert "VIP 票档创建成功" "contains" '"success":true' "$RESPONSE"

echo "  创建普通看台票 (888 元，5 张)..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/shows/$SHOW_ID/tiers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "普通看台票",
    "price": 888,
    "totalQuantity": 5,
    "perIdCardLimit": 2,
    "perAccountLimit": 2,
    "perPaymentLimit": 1
  }')
echo "  响应: $RESPONSE"
NORMAL_TIER_ID=$(echo "$RESPONSE" | sed -n 's/.*"tierId":"\([^"]*\)".*/\1/p')
assert "普通票档创建成功" "contains" '"success":true' "$RESPONSE"

print_header "3. 查看票档库存"

echo "  查看 VIP 票档详情..."
RESPONSE=$(curl -s "$BASE_URL/api/shows/tiers/$VIP_TIER_ID")
echo "  响应: $RESPONSE"
assert "VIP 票档信息正常" "contains" '"available":10' "$RESPONSE"
assert "价格显示正确" "contains" '"priceDisplay":"¥2,888.00"' "$RESPONSE"

print_header "4. 用户 A 购买 VIP 票（成功）"

echo "  用户 A 下单购买 1 张 VIP 票..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"user_001\",
    \"idCardNo\": \"110101199001011234\",
    \"paymentChannel\": \"alipay_001\",
    \"quantity\": 1,
    \"holders\": [{\"name\": \"张三\", \"idCard\": \"110101199001011234\"}]
  }")
echo "  响应: $RESPONSE"
USER_A_ORDER_ID=$(echo "$RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
assert "下单成功" "contains" '"code":"ORDER_CREATED"' "$RESPONSE"
assert "状态为待支付" "contains" '"status":"pending_payment"' "$RESPONSE"

echo "  用户 A 完成支付..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/$USER_A_ORDER_ID/pay")
echo "  响应: $RESPONSE"
assert "支付成功" "contains" '"code":"PAYMENT_SUCCESS"' "$RESPONSE"
assert "订单状态已支付" "contains" '"status":"paid"' "$RESPONSE"

echo "  验证库存已扣减..."
RESPONSE=$(curl -s "$BASE_URL/api/shows/tiers/$VIP_TIER_ID")
assert "库存从 10 减到 9" "contains" '"available":9' "$RESPONSE"

print_header "5. 用户 A 尝试超证件限购（应被拦截）"

echo "  用户 A 用同一证件再买 2 张..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"user_001\",
    \"idCardNo\": \"110101199001011234\",
    \"paymentChannel\": \"alipay_001\",
    \"quantity\": 2
  }")
echo "  响应: $RESPONSE"
assert "被限购拦截" "contains" '"code":"LIMIT_ID_CARD"' "$RESPONSE"
assert "包含限购说明" "contains" "限购" "$RESPONSE"
assert "标记为限购拦截" "contains" '"action":"限购拦截"' "$RESPONSE"

print_header "6. 用户 A 买第 2 张（达到上限）"

echo "  用户 A 再买 1 张（累计 2 张，刚好达限）..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"user_001\",
    \"idCardNo\": \"110101199001011234\",
    \"paymentChannel\": \"alipay_001\",
    \"quantity\": 1
  }")
echo "  响应: $RESPONSE"
assert "下单成功" "contains" '"success":true' "$RESPONSE"
USER_A_ORDER_ID_2=$(echo "$RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

echo "  完成支付..."
curl -s -X POST "$BASE_URL/api/orders/$USER_A_ORDER_ID_2/pay" > /dev/null

print_header "7. 用户 B 用被占用支付渠道（应被拦截）"

echo "  用户 B 用新账号新证件，但用同一支付宝渠道..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"user_002\",
    \"idCardNo\": \"110101199001011235\",
    \"paymentChannel\": \"alipay_001\",
    \"quantity\": 1
  }")
echo "  响应: $RESPONSE"
assert "被支付渠道限购拦截" "contains" '"code":"LIMIT_PAYMENT"' "$RESPONSE"

echo "  用户 B 换用微信支付..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"user_002\",
    \"idCardNo\": \"110101199001011235\",
    \"paymentChannel\": \"wechat_001\",
    \"quantity\": 1
  }")
echo "  响应: $RESPONSE"
assert "换渠道后下单成功" "contains" '"success":true' "$RESPONSE"

print_header "8. 风控拦截测试"

echo "  被拉黑账号尝试购票..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d "{
    \"tierId\": \"$VIP_TIER_ID\",
    \"accountId\": \"risk_account_001\",
    \"idCardNo\": \"110101199001019999\",
    \"paymentChannel\": \"alipay_risk\",
    \"quantity\": 1
  }")
echo "  响应: $RESPONSE"
assert "被风控拦截" "contains" '"code":"RISK_BLOCKED_ACCOUNT"' "$RESPONSE"
assert "标记为风控拦截" "contains" '"action":"风控拦截"' "$RESPONSE"

print_header "9. 查看销售报表"

echo "  查看演出销售报表..."
RESPONSE=$(curl -s "$BASE_URL/api/shows/$SHOW_ID/report")
echo "  响应: $RESPONSE"
assert "报表生成成功" "contains" '"success":true' "$RESPONSE"
assert "包含已售数量" "contains" '"soldTickets"' "$RESPONSE"
assert "包含营收金额" "contains" '"totalRevenue"' "$RESPONSE"
assert "包含票档明细" "contains" '"VIP 内场票"' "$RESPONSE"

echo "  查看系统总览..."
RESPONSE=$(curl -s "$BASE_URL/api/admin/dashboard")
echo "  响应: $RESPONSE"
assert "系统报表正常" "contains" '"activeShows":1' "$RESPONSE"

print_header "测试结果汇总"

echo ""
echo "  通过: $PASS 项"
echo "  失败: $FAIL 项"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}  ✓ 所有 CURL 测试通过！${NC}"
    echo ""
    echo "  下一步建议："
    echo "    1. 运行 Node.js 端到端测试: npm run test"
    echo "    2. 查看订单列表: curl $BASE_URL/api/orders"
    echo "    3. 查看补偿任务: curl $BASE_URL/api/admin/compensation/tasks"
    echo "    4. 测试退票流程: curl -X POST $BASE_URL/api/orders/{orderId}/refund"
    exit 0
else
    echo -e "${RED}  ✗ 有 $FAIL 项测试失败${NC}"
    exit 1
fi
