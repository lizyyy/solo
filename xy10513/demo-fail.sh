#!/bin/bash

BASE_URL="http://localhost:3001"
MEMBER_ID="DEMO002"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
ORDER_NO="FAIL_ORDER_${TIMESTAMP}"

echo "================================================"
echo "    会员积分过期 API - 异常处理演示"
echo "================================================"
echo ""

print_separator() {
    echo ""
    echo "------------------------------------------------"
    echo ""
}

print_step() {
    echo ""
    echo ">>> 步骤 $1: $2"
    echo ""
}

print_json() {
    echo "$1" | python3 -c "import sys,json; print(json.dumps(json.loads(sys.stdin.read()), ensure_ascii=False, indent=4))" 2>/dev/null || echo "$1"
}

print_step 1 "获取会员初始余额"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID")
print_json "$response"
print_separator

print_step 2 "异常1: 消费积分超过可用余额"
payload=$(cat <<'EOF'
{"memberId":"DEMO002","points":99999,"orderNo":"OVERDRAFT_TEST_001","description":"overdraft test"}
EOF
)
response=$(curl -s -X POST "$BASE_URL/api/consume" -H "Content-Type: application/json" -d "$payload")
print_json "$response"
print_separator

print_step 3 "异常2: 冻结积分超过可用余额"
payload=$(cat <<'EOF'
{"memberId":"DEMO002","points":99999,"freezeRef":"FREEZE_OVERDRAFT_001","reason":"freeze overdraft test"}
EOF
)
response=$(curl -s -X POST "$BASE_URL/api/freeze" -H "Content-Type: application/json" -d "$payload")
print_json "$response"
print_separator

print_step 4 "异常3: 退款不存在的订单"
payload=$(cat <<'EOF'
{"memberId":"DEMO002","orderNo":"NON_EXISTENT_ORDER_001","points":100,"description":"refund non-existent order"}
EOF
)
response=$(curl -s -X POST "$BASE_URL/api/refund" -H "Content-Type: application/json" -d "$payload")
print_json "$response"
print_separator

print_step 5 "异常4: 退款超过已消费金额"
echo "先消费 200 积分..."
CONSUME_ORDER="CONSUME_FOR_REFUND_${TIMESTAMP}"
payload="{\"memberId\":\"${MEMBER_ID}\",\"points\":200,\"orderNo\":\"${CONSUME_ORDER}\",\"description\":\"test order for refund\"}"
response=$(curl -s -X POST "$BASE_URL/api/consume" -H "Content-Type: application/json" -d "$payload")
print_json "$response"

echo ""
echo "现在尝试退款 500（超过已消费的 200）:"
payload="{\"memberId\":\"${MEMBER_ID}\",\"orderNo\":\"${CONSUME_ORDER}\",\"points\":500,\"description\":\"exceed refund test\"}"
response=$(curl -s -X POST "$BASE_URL/api/refund" -H "Content-Type: application/json" -d "$payload")
print_json "$response"
print_separator

print_step 6 "异常5: 解冻不存在的冻结记录"
response=$(curl -s -X POST "$BASE_URL/api/freeze/non_existent_freeze_001/unfreeze" -H "Content-Type: application/json" -d "{}")
print_json "$response"
print_separator

print_step 7 "异常6: 人工修正 - 积分不能为负数"
BATCHES=$(curl -s "$BASE_URL/api/batches/member/$MEMBER_ID")
BATCH_ID=$(echo "$BATCHES" | grep -o '"batch_id":"[^"]*"' | head -n1 | cut -d'"' -f4)

if [ -n "$BATCH_ID" ]; then
    payload=$(printf '{"memberId":"%s","batchId":"%s","newAvailable":-100,"reason":"negative points test","operator":"tester"}' "$MEMBER_ID" "$BATCH_ID")
    response=$(curl -s -X POST "$BASE_URL/api/adjust" -H "Content-Type: application/json" -d "$payload")
    print_json "$response"
else
    echo "No batches found"
fi
print_separator

print_step 8 "异常7: 查询不存在的会员"
response=$(curl -s "$BASE_URL/api/members/NON_EXISTENT_MEMBER_999")
print_json "$response"
print_separator

print_step 9 "查询账本确认没有异常交易产生"
response=$(curl -s "$BASE_URL/api/ledger/$MEMBER_ID?limit=10")
echo "Ledger records (should only have normal transactions):"
print_json "$response"
print_separator

echo "================================================"
echo "    异常处理演示完成！"
echo "================================================"
echo ""
echo "Key Points:"
echo "  1. All failed operations have clear error codes"
echo "  2. Failed operations don't affect ledger"
echo "  3. Balance remains consistent"
echo ""
