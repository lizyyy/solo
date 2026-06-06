#!/bin/bash
set -e

BASE_URL="http://localhost:3000/api"

echo "=== 1. 创建卡片 ==="
CARD_RESPONSE=$(curl -s -X POST "$BASE_URL/cards" \
  -H "Content-Type: application/json" \
  -d '{"playlistName":"夏日清凉歌单","createdBy":"小段"}')
CARD_ID=$(echo "$CARD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "卡片ID: $CARD_ID"
echo "$CARD_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 2. 导入签到数据 ==="
ATTENDANCE_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/import-attendance" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "importedBy": "小段",
  "records": [
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"张三","status":"NORMAL"},
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"李四","status":"NORMAL"},
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"王五","status":"ABSENT"},
    {"classDate":"2024-01-16","className":"钢琴进阶班","studentName":"赵六","status":"MAKEUP","sourceNote":"上周请假补录"},
    {"classDate":"2024-01-16","className":"钢琴进阶班","studentName":"钱七","status":"TEMP_SUBSTITUTE","sourceNote":"群里说临时替孙八","isGroupMessageOnly":true}
  ]
}
EOF
)
echo "$ATTENDANCE_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 3. 运行自检 ==="
CHECK_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/self-check" \
  -H "Content-Type: application/json")
echo "$CHECK_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 4. 补充票务数据 ==="
TICKET_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/supplement-tickets" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "supplementedBy": "小段",
  "records": [
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"张三","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"李四","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-01-15","className":"声乐入门班","studentName":"王五","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-01-16","className":"钢琴进阶班","studentName":"赵六","ticketCount":1,"ticketType":"补录课","supplementNote":"系统补录"}
  ]
}
EOF
)
echo "$TICKET_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 5. 检测冲突 ==="
CONFLICT_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/detect-conflicts" \
  -H "Content-Type: application/json")
echo "$CONFLICT_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 6. 查看所有冲突 ==="
ALL_CONFLICTS=$(curl -s "$BASE_URL/cards/$CARD_ID/conflicts")
echo "$ALL_CONFLICTS" | python3 -m json.tool
echo ""

echo "=== 7. 尝试计算分账（应该失败，因为有未解决的冲突） ==="
REVENUE_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/calculate-revenue" \
  -H "Content-Type: application/json" \
  -d '{"calculatedBy":"小段"}')
echo "$REVENUE_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 8. 解决第一个冲突 ==="
FIRST_CONFLICT_ID=$(echo "$ALL_CONFLICTS" | python3 -c "import sys,json; conflicts=json.load(sys.stdin); print(conflicts[0]['id'])")
echo "解决冲突: $FIRST_CONFLICT_ID"
RESOLVE_RESPONSE=$(curl -s -X POST "$BASE_URL/conflicts/$FIRST_CONFLICT_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"PENDING_REVIEW","resolvedBy":"小段"}')
echo "$RESOLVE_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 9. 解决第二个冲突 ==="
SECOND_CONFLICT_ID=$(echo "$ALL_CONFLICTS" | python3 -c "import sys,json; conflicts=json.load(sys.stdin); print(conflicts[1]['id'])")
echo "解决冲突: $SECOND_CONFLICT_ID"
RESOLVE_RESPONSE2=$(curl -s -X POST "$BASE_URL/conflicts/$SECOND_CONFLICT_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"CONFIRM_TICKET","resolvedBy":"小段"}')
echo "$RESOLVE_RESPONSE2" | python3 -m json.tool
echo ""

echo "=== 10. 解决第三个冲突（如果有） ==="
THIRD_CONFLICT_ID=$(echo "$ALL_CONFLICTS" | python3 -c "import sys,json; conflicts=json.load(sys.stdin); print(conflicts[2]['id'] if len(conflicts)>=3 else '')")
if [ -n "$THIRD_CONFLICT_ID" ]; then
  echo "解决冲突: $THIRD_CONFLICT_ID"
  RESOLVE_RESPONSE3=$(curl -s -X POST "$BASE_URL/conflicts/$THIRD_CONFLICT_ID/resolve" \
    -H "Content-Type: application/json" \
    -d '{"resolution":"CONFIRM_ATTENDANCE","resolvedBy":"小段"}')
  echo "$RESOLVE_RESPONSE3" | python3 -m json.tool
fi
echo ""

echo "=== 11. 再次计算分账 ==="
REVENUE_RESPONSE2=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/calculate-revenue" \
  -H "Content-Type: application/json" \
  -d '{"calculatedBy":"小段"}')
echo "$REVENUE_RESPONSE2" | python3 -m json.tool
echo ""

echo "=== 12. 查看分账明细 ==="
REVENUE_DETAILS=$(curl -s "$BASE_URL/cards/$CARD_ID/revenue")
echo "$REVENUE_DETAILS" | python3 -m json.tool
echo ""

echo "=== 13. 撤回分账版本 ==="
WITHDRAW_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/withdraw-revenue" \
  -H "Content-Type: application/json" \
  -d '{"withdrawnBy":"小段"}')
echo "$WITHDRAW_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 14. 查看版本历史 ==="
HISTORY=$(curl -s "$BASE_URL/cards/$CARD_ID/version-history")
echo "$HISTORY" | python3 -m json.tool
echo ""

echo "=== 15. 查看完整详情 ==="
FULL_DETAILS=$(curl -s "$BASE_URL/cards/$CARD_ID/full-details")
echo "$FULL_DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('卡片状态:', d['card']['status'])
print('当前版本:', d['card']['currentVersion'])
print('签到记录数:', len(d['attendance']))
print('票务记录数:', len(d['tickets']))
print('冲突记录数:', len(d['conflicts']))
print('分账记录数:', len(d['revenue']))
print('历史版本数:', len(d['versionHistory']))
"
echo ""

echo "=== 测试完成！ ==="
echo "前端页面: http://localhost:3000"
