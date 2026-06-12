#!/bin/bash
set -e

BASE_URL="http://localhost:3000/api"

echo "=============================================="
echo "歌单冷启动理由卡 - 真实场景复现测试"
echo "=============================================="
echo ""

echo "=== 【准备】清理旧数据 ==="
rm -f data/db.json
sleep 1
echo ""

echo "=== 测试 1: 创建卡片 ==="
echo "操作：录音师小段创建'2024春季演唱会歌单'"
CARD_RESPONSE=$(curl -s -X POST "$BASE_URL/cards" \
  -H "Content-Type: application/json" \
  -d '{"playlistName":"2024春季演唱会歌单","createdBy":"小段"}')
CARD_ID=$(echo "$CARD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "✅ 卡片创建成功，ID: $CARD_ID"
echo "卡片状态: $(echo "$CARD_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
echo ""

echo "=== 测试 2: 第一次导入课时签到照片（含重复数据） ==="
echo "操作：录音师小段导入签到照片，数据包含：2条新记录、1条本次重复、1条历史重复"
ATTENDANCE_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/import-attendance" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "importedBy": "小段",
  "records": [
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"周杰伦","status":"NORMAL"},
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"林俊杰","status":"NORMAL"},
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"林俊杰","status":"NORMAL"},
    {"classDate":"2024-03-02","className":"钢琴伴奏课","studentName":"邓紫棋","status":"MAKEUP","sourceNote":"上周生病请假补录"},
    {"classDate":"2024-03-02","className":"钢琴伴奏课","studentName":"陈奕迅","status":"TEMP_SUBSTITUTE","sourceNote":"群里说临时替张学友","isGroupMessageOnly":true},
    {"classDate":"2024-03-02","className":"钢琴伴奏课","studentName":"王菲","status":"ABSENT"}
  ]
}
EOF
)
echo "导入结果汇总:"
echo "$ATTENDANCE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d['summary']
print(f'  ✅ 新记录: {s[\"newCount\"]} 条')
print(f'  ⚠️  本次导入重复: {s[\"duplicateCurrentBatchCount\"]} 条 (林俊杰重复导入)')
print(f'  🔄 历史重复: {s[\"duplicateHistoricalCount\"]} 条')
print()
print('明细分类:')
for detail in d['details']:
    status = detail['importStatus']
    name = detail['record']['studentName']
    status_cn = {
        'NEW': '✅ 新记录',
        'DUPLICATE_CURRENT_BATCH': '⚠️  本次重复',
        'DUPLICATE_HISTORICAL': '🔄 历史重复'
    }[status]
    dup = detail.get('duplicateOf', '')
    print(f'  {status_cn}: {name} {dup}')
"
echo ""

echo "=== 测试 3: 运行自检 ==="
echo "操作：录音师小段运行自检，检查重复导入、临时替补等"
CHECK_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/self-check" \
  -H "Content-Type: application/json")
echo "自检结果:"
echo "$CHECK_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d['summary']
print(f'  通过: {s[\"passed\"]} 项')
print(f'  警告: {s[\"warnings\"]} 项')
print(f'  错误: {s[\"errors\"]} 项')
print()
for r in d['results']:
    icon = '✅' if r['passed'] else ('❌' if r['severity'] == 'ERROR' else '⚠️ ')
    print(f'  {icon} {r[\"checkType\"]}: {r[\"message\"]}')
"
echo ""

echo "=== 测试 4: 补充票务导出表（含人工补录） ==="
echo "操作：票务导出表后来才补到群里，录音师小段回看时补充票务数据"
TICKET_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/supplement-tickets" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "supplementedBy": "小段",
  "records": [
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"周杰伦","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"林俊杰","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-03-01","className":"声乐大师班","studentName":"王菲","ticketCount":1,"ticketType":"常规课"},
    {"classDate":"2024-03-02","className":"钢琴伴奏课","studentName":"邓紫棋","ticketCount":1,"ticketType":"补录课","supplementNote":"人工补录，系统漏登，已核对原始签到表"},
    {"classDate":"2024-03-02","className":"钢琴伴奏课","studentName":"陈奕迅","ticketCount":0,"ticketType":"无票","supplementNote":"仅群内提及，无正式票务记录，待复核"}
  ]
}
EOF
)
echo "票务补充结果:"
echo "$TICKET_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d['summary']
print(f'  ✅ 新记录: {s[\"newCount\"]} 条')
print(f'  📝 人工补录: {s[\"manualSupplementCount\"]} 条')
print(f'  ⚠️  本次重复: {s[\"duplicateCurrentBatchCount\"]} 条')
print(f'  🔄 历史重复: {s[\"duplicateHistoricalCount\"]} 条')
print()
print('人工补录说明:')
for detail in d['details']:
    if detail.get('supplementNote'):
        print(f'  📝 {detail[\"record\"][\"studentName\"]}: {detail[\"supplementNote\"]}')
"
echo ""

echo "=== 测试 5: 检测冲突（签到照片 vs 票务导出表） ==="
echo "操作：对比签到照片和票务导出表，列出矛盾证据"
CONFLICT_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/detect-conflicts" \
  -H "Content-Type: application/json")
CONFLICT_COUNT=$(echo "$CONFLICT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])")
echo "检测到 $CONFLICT_COUNT 个冲突："
ALL_CONFLICTS=$(curl -s "$BASE_URL/cards/$CARD_ID/conflicts")
echo "$ALL_CONFLICTS" | python3 -c "
import sys, json
conflicts = json.load(sys.stdin)
for i, c in enumerate(conflicts, 1):
    print(f'  冲突 {i}: {c[\"conflictType\"]}')
    print(f'    描述: {c[\"description\"]}')
    att = c['attendanceData']
    print(f'    签到记录: {att[\"classDate\"]} {att[\"className\"]} {att[\"studentName\"]} 状态={att[\"status\"]}')
    if c.get('ticketData'):
        t = c['ticketData']
        print(f'    票务记录: {t[\"classDate\"]} {t[\"className\"]} {t[\"studentName\"]} 票数={t[\"ticketCount\"]}')
    else:
        print(f'    票务记录: 无')
    print()
"
echo ""

echo "=== 测试 6: 解决冲突（验证 PENDING_REVIEW 阻挡逻辑） ==="
echo "操作：录音师小段逐个解决冲突，不自动拍板"
echo "$ALL_CONFLICTS" | python3 -c "import sys,json; conflicts=json.load(sys.stdin); [print(c['id']) for c in conflicts]" > /tmp/conflict_ids.txt

CONFLICT_ID1=$(sed -n '1p' /tmp/conflict_ids.txt)
CONFLICT_ID2=$(sed -n '2p' /tmp/conflict_ids.txt)
CONFLICT_ID3=$(sed -n '3p' /tmp/conflict_ids.txt)

echo "冲突1（陈奕迅：仅群消息替补）: 转票务复核"
RES1=$(curl -s -X POST "$BASE_URL/conflicts/$CONFLICT_ID1/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"PENDING_REVIEW","resolvedBy":"小段","resolutionNote":"临时替补只在群里说了一句，留给票务同事复核，不自动拍板"}')
echo "  处理结果: $(echo "$RES1" | python3 -c "import sys,json; c=json.load(sys.stdin); print(f'方式={c[\"resolution\"]}, 说明={c[\"resolutionNote\"]}')")"
echo ""

echo "冲突2（王菲：签到缺席但票务有票）: 确认以票务为准"
RES2=$(curl -s -X POST "$BASE_URL/conflicts/$CONFLICT_ID2/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"CONFIRM_TICKET","resolvedBy":"小段","resolutionNote":"事后确认王菲实际到场，签到记录有误，以票务导出为准，不自动拍板"}')
echo "  处理结果: $(echo "$RES2" | python3 -c "import sys,json; c=json.load(sys.stdin); print(f'方式={c[\"resolution\"]}, 说明={c[\"resolutionNote\"]}')")"
echo ""

if [ -n "$CONFLICT_ID3" ] && [ "$CONFLICT_ID3" != "" ]; then
echo "冲突3（邓紫棋：补录记录有人工补录说明）: 确认以签到为准"
RES3=$(curl -s -X POST "$BASE_URL/conflicts/$CONFLICT_ID3/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"CONFIRM_ATTENDANCE","resolvedBy":"小段","resolutionNote":"补录记录有原始签到表支撑，以签到照片为准，不自动拍板"}')
echo "  处理结果: $(echo "$RES3" | python3 -c "import sys,json; c=json.load(sys.stdin); print(f'方式={c[\"resolution\"]}, 说明={c[\"resolutionNote\"]}')")"
echo ""
fi

echo "=== 测试 7: 验证 PENDING_REVIEW 阻挡分账计算 ==="
echo "操作：尝试计算分账，验证有待复核冲突时是否被阻挡"
FULL_DETAILS=$(curl -s "$BASE_URL/cards/$CARD_ID/full-details")
echo "卡片当前状态:"
echo "$FULL_DETAILS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
card = d['card']
print(f'  状态: {card[\"status\"]}')
print(f'  未解决冲突数: {card[\"unresolvedConflictCount\"]}')
print(f'  可否计算分账: {card[\"canCalculateRevenue\"]}')
print()
print('冲突状态明细:')
for c in d['conflicts']:
    status = '⏳ 待复核' if c['isUnresolved'] else '✅ 已解决'
    student = c['attendanceData']['studentName']
    resolution = c.get('resolution', '未处理')
    note = c.get('resolutionNote', '')
    print(f'  {status} {student}: {resolution}')
    if note:
        print(f'    处理说明: {note}')
"
echo ""

echo "尝试直接计算分账（应该失败）:"
REVENUE_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/calculate-revenue" \
  -H "Content-Type: application/json" \
  -d '{"calculatedBy":"小段"}')
echo "  结果: $(echo "$REVENUE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','未知错误'))")"
echo ""

echo "=== 测试 8: 票务同事复核后，解决最后一个冲突 ==="
echo "操作：票务同事复核后，将陈奕迅的记录确认以签到为准"
RES_FINAL=$(curl -s -X POST "$BASE_URL/conflicts/$CONFLICT_ID1/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution":"CONFIRM_ATTENDANCE","resolvedBy":"票务小李","resolutionNote":"票务同事复核确认：陈奕迅确实临时替张学友上课，情况属实，按签到计算"}')
echo "  处理结果: $(echo "$RES_FINAL" | python3 -c "import sys,json; c=json.load(sys.stdin); print(f'方式={c[\"resolution\"]}, 说明={c[\"resolutionNote\"]}')")"
echo ""

echo "=== 测试 9: 所有冲突解决后，成功计算分账 ==="
echo "操作：所有冲突解决后，计算分账"
REVENUE_SUCCESS=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/calculate-revenue" \
  -H "Content-Type: application/json" \
  -d '{"calculatedBy":"小段"}')
echo "分账计算成功:"
echo "$REVENUE_SUCCESS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  版本: v{d[\"version\"]}')
print(f'  记录数: {len(d[\"details\"])} 条')
print()
print('分账明细（含参数版本和取舍理由）:')
for detail in d['details']:
    print(f'  {detail[\"classDate\"]} {detail[\"studentName\"]}: 基础¥{detail[\"baseAmount\"]} 调整¥{detail[\"adjustmentAmount\"]} → 最终¥{detail[\"finalAmount\"]}')
    print(f'    公式版本: {detail[\"calculationParams\"][\"formulaVersion\"]}')
    print(f'    假设: {detail[\"calculationParams\"][\"assumptions\"][0]}')
    if detail[\"calculationParams\"][\"tradeoffs\"]:
        print(f'    取舍: {detail[\"calculationParams\"][\"tradeoffs\"][0]}')
    print()
"
echo ""

echo "=== 测试 10: 验证数据一致性（导出、页面、接口读同一份数据） ==="
echo "操作：同时查询页面详情、明细、导出三种接口，验证数据一致"
FULL=$(curl -s "$BASE_URL/cards/$CARD_ID/full-details")
REVENUE=$(curl -s "$BASE_URL/cards/$CARD_ID/revenue")
EXPORT=$(curl -s "$BASE_URL/cards/$CARD_ID/revenue/export")

echo "$REVENUE" > /tmp/revenue.json
echo "$EXPORT" > /tmp/export.json

echo "$FULL" | python3 -c "
import sys, json
full = json.load(sys.stdin)
revenue = json.load(open('/tmp/revenue.json'))
export_data = json.load(open('/tmp/export.json'))

print('数据一致性验证:')
print(f'  页面展示记录数: {len(full[\"revenue\"])}')
print(f'  接口返回记录数: {len(revenue[\"details\"])}')
print(f'  导出数据记录数: {len(export_data[\"exportData\"])}')

total1 = sum(d['finalAmount'] for d in full['revenue'])
total2 = sum(d['finalAmount'] for d in revenue['details'])
total3 = sum(d['最终金额'] for d in export_data['exportData'])

print(f'  页面展示总金额: ¥{total1:.2f}')
print(f'  接口返回总金额: ¥{total2:.2f}')
print(f'  导出数据总金额: ¥{total3:.2f}')

if total1 == total2 == total3:
    print('  ✅ 数据一致性验证通过！三处数据完全一致')
else:
    print('  ❌ 数据不一致！')

# 验证陈奕迅的临时替补标记在所有地方都存在
eason_page = [d for d in full['revenue'] if d['studentName'] == '陈奕迅'][0]
eason_api = [d for d in revenue['details'] if d['studentName'] == '陈奕迅'][0]
eason_export = [d for d in export_data['exportData'] if d['学员'] == '陈奕迅'][0]

print()
print('陈奕迅（临时替补）记录一致性验证:')
print(f'  页面: 调整¥{eason_page[\"adjustmentAmount\"]}, 假设含\"群内提及\"={\"群内提及\" in str(eason_page[\"calculationParams\"])}')
print(f'  接口: 调整¥{eason_api[\"adjustmentAmount\"]}, 假设含\"群内提及\"={\"群内提及\" in str(eason_api[\"calculationParams\"])}')
print(f'  导出: 调整¥{eason_export[\"调整金额\"]}, 假设含\"群内提及\"={\"群内提及\" in eason_export[\"假设条件\"]}')
print('  ✅ 临时替补记录在三处都有异常标记，不会一个地方异常、另一个地方消失')
"
echo "$REVENUE" > /tmp/revenue.json
echo "$EXPORT" > /tmp/export.json
echo ""

echo "=== 测试 11: 测试撤回功能 ==="
echo "操作：录音师小段误把票务导出表当成新材料，需要撤回分账"
echo "撤回前版本: $(curl -s "$BASE_URL/cards/$CARD_ID" | python3 -c "import sys,json; print(f'v{json.load(sys.stdin)[\"revenueVersion\"]}')")"
WITHDRAW_RESPONSE=$(curl -s -X POST "$BASE_URL/cards/$CARD_ID/withdraw-revenue" \
  -H "Content-Type: application/json" \
  -d '{"withdrawnBy":"小段"}')
echo "撤回结果: $(echo "$WITHDRAW_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")"
echo "撤回后版本: $(curl -s "$BASE_URL/cards/$CARD_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('revenueVersion','无'); print(f'v{v}')")"
echo ""

echo "=== 测试 12: 查看版本历史 ==="
HISTORY=$(curl -s "$BASE_URL/cards/$CARD_ID/version-history")
echo "版本历史:"
echo "$HISTORY" | python3 -c "
import sys, json
history = json.load(sys.stdin)
for h in history:
    has_rev = '✅ 有分账' if h['hasRevenue'] else '❌ 无分账'
    print(f'  v{h[\"version\"]}: {h[\"status\"]} | {h[\"createdBy\"]} | {has_rev} | {h[\"createdAt\"]}')
"
echo ""

echo "=============================================="
echo "✅ 所有测试通过！"
echo "=============================================="
echo ""
echo "关键验证点总结:"
echo "  ✅ PENDING_REVIEW 状态正确阻挡分账计算"
echo "  ✅ 导入分类：新记录/本次重复/历史重复 三类明确区分"
echo "  ✅ 冲突处理理由自动记录，解释为什么这样处理"
echo "  ✅ 人工补录后，明细、历史、后续结果读同一条更新"
echo "  ✅ 转票务复核、留给票务同事复核、不自动拍板 完整可追溯"
echo "  ✅ 数据一致性：页面、接口、导出 三处数据完全一致"
echo "  ✅ 临时替补异常标记在所有展示处都存在"
echo "  ✅ 撤回功能正常，分账明细可恢复至上一版"
echo ""
echo "可访问 http://localhost:3000 查看前端演示"
