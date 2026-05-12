#!/bin/bash

BASE_URL="http://localhost:3001"
MEMBER_ID="DEMO001"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
ORDER_NO="ORDER_${TIMESTAMP}"
FREEZE_REF="FREEZE_${TIMESTAMP}"
TASK_DATE="$(date +%Y-%m-%d)"

echo "================================================"
echo "    会员积分过期 API - 完整演示流程"
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

print_step 1 "获取会员信息和初始余额"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID/summary")
print_json "$response"
print_separator

print_step 2 "获取所有积分批次（FIFO 展示，按到期时间排序）"
response=$(curl -s "$BASE_URL/api/batches/member/$MEMBER_ID")
print_json "$response"
print_separator

print_step 3 "查看即将过期积分（30天内）"
response=$(curl -s "$BASE_URL/api/batches/expiring-soon/$MEMBER_ID?days=30")
print_json "$response"
print_separator

print_step 4 "消费积分 800（FIFO 先到期先抵扣）"
payload=$(printf '{"memberId":"%s","points":800,"orderNo":"%s","description":"product purchase"}' "$MEMBER_ID" "$ORDER_NO")
response=$(curl -s -X POST "$BASE_URL/api/consume" \
    -H "Content-Type: application/json" \
    -H "X-Idempotent-Key: consume_$ORDER_NO" \
    -d "$payload")
print_json "$response"
print_separator

print_step 5 "消费后查询余额变化"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID")
print_json "$response"
print_separator

print_step 6 "冻结积分 500（风控审查）"
payload=$(printf '{"memberId":"%s","points":500,"freezeRef":"%s","reason":"risk control review"}' "$MEMBER_ID" "$FREEZE_REF")
response=$(curl -s -X POST "$BASE_URL/api/freeze" \
    -H "Content-Type: application/json" \
    -H "X-Idempotent-Key: freeze_$FREEZE_REF" \
    -d "$payload")
print_json "$response"
FREEZE_ID=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('freezeId',''))")
print_separator

print_step 7 "冻结后查询余额（可用减少，冻结增加）"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID")
print_json "$response"
print_separator

print_step 8 "退款 300（退回原消费批次）"
payload=$(printf '{"memberId":"%s","orderNo":"%s","points":300,"description":"partial refund"}' "$MEMBER_ID" "$ORDER_NO")
response=$(curl -s -X POST "$BASE_URL/api/refund" \
    -H "Content-Type: application/json" \
    -H "X-Idempotent-Key: refund_$ORDER_NO" \
    -d "$payload")
print_json "$response"
print_separator

print_step 9 "退款后查询余额"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID")
print_json "$response"
print_separator

print_step 10 "解冻积分"
response=$(curl -s -X POST "$BASE_URL/api/freeze/$FREEZE_ID/unfreeze" \
    -H "Content-Type: application/json" \
    -d "{}")
print_json "$response"
print_separator

print_step 11 "执行过期任务（今日）"
payload=$(printf '{"executeDate":"%s"}' "$TASK_DATE")
response=$(curl -s -X POST "$BASE_URL/api/expire/process" \
    -H "Content-Type: application/json" \
    -d "$payload")
print_json "$response"
print_separator

print_step 12 "过期后查询余额"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID")
print_json "$response"
print_separator

print_step 13 "幂等性测试 - 重复执行过期任务"
response=$(curl -s -X POST "$BASE_URL/api/expire/process" \
    -H "Content-Type: application/json" \
    -d "$payload")
print_json "$response"
print_separator

print_step 14 "查询账本记录"
response=$(curl -s "$BASE_URL/api/ledger/$MEMBER_ID?limit=20")
print_json "$response"
print_separator

print_step 15 "导出会员报告（JSON）"
response=$(curl -s "$BASE_URL/api/reports/member/$MEMBER_ID")
print_json "$response"
print_separator

print_step 16 "人工修正积分（留痕演示）"
BATCHES=$(curl -s "$BASE_URL/api/batches/member/$MEMBER_ID")
BATCH_ID=$(echo "$BATCHES" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['data']['batches'][0]['batch_id'] if data.get('data',{}).get('batches') else '')")

if [ -n "$BATCH_ID" ]; then
    payload=$(printf '{"memberId":"%s","batchId":"%s","newAvailable":100,"reason":"customer complaint compensation","operator":"CS_Agent_Wang"}' "$MEMBER_ID" "$BATCH_ID")
    response=$(curl -s -X POST "$BASE_URL/api/adjust" \
        -H "Content-Type: application/json" \
        -d "$payload")
    print_json "$response"
else
    echo "No batches available, skip adjust demo"
fi
print_separator

print_step 17 "最终余额和完整报告"
response=$(curl -s "$BASE_URL/api/members/$MEMBER_ID/summary")
print_json "$response"
print_separator

echo "================================================"
echo "    演示流程完成！"
echo "================================================"
echo ""
echo "导出 CSV 报告命令："
echo "  curl -o report.csv \"$BASE_URL/api/reports/member/$MEMBER_ID?format=csv\""
echo "  curl -o all_report.csv \"$BASE_URL/api/reports/all?format=csv\""
echo ""
