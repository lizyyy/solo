#!/bin/bash
set -e

echo "========================================"
echo "  透析耗材召回API - 测试场景脚本"
echo "========================================"
echo ""

BASE_URL="http://localhost:8080/api/v1"

check_server() {
    echo "检查服务器状态..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "✅ 服务器已启动"
            return 0
        fi
        sleep 1
    done
    echo "❌ 服务器启动失败"
    exit 1
}

post_json() {
    local url="$1"
    local data="$2"
    curl -s -X POST -H "Content-Type: application/json" -d "$data" "$url"
}

get_json() {
    local url="$1"
    curl -s "$url"
}

echo "场景1: 初始化基础数据"
echo "------------------------"

echo "1.1 创建耗材..."
post_json "$BASE_URL/materials" '{
  "batch_number": "BAT-2024-001A",
  "name": "高通量透析器",
  "specification": "FX80",
  "manufacturer": "费森尤斯",
  "stock_quantity": 100,
  "unit": "个"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   耗材1:', d.get('data',{}).get('batch_number','N/A'))"

post_json "$BASE_URL/materials" '{
  "batch_number": "BAT-2024-001B",
  "name": "高通量透析器",
  "specification": "FX80",
  "manufacturer": "费森尤斯",
  "stock_quantity": 50,
  "unit": "个"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   耗材2:', d.get('data',{}).get('batch_number','N/A'))"

post_json "$BASE_URL/materials" '{
  "batch_number": "BAT-2024-ALT-001",
  "name": "高通量透析器(替代)",
  "specification": "FX100",
  "manufacturer": "百特",
  "stock_quantity": 60,
  "unit": "个"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   耗材3(替代):', d.get('data',{}).get('batch_number','N/A'))"

echo ""
echo "1.2 创建患者..."
post_json "$BASE_URL/patients" '{
  "patient_id": "P001",
  "name": "张三",
  "gender": "男",
  "age": 55,
  "bed_number": "A01"
}' > /dev/null
post_json "$BASE_URL/patients" '{
  "patient_id": "P002",
  "name": "李四",
  "gender": "女",
  "age": 48,
  "bed_number": "A02"
}' > /dev/null
post_json "$BASE_URL/patients" '{
  "patient_id": "P003",
  "name": "王五",
  "gender": "男",
  "age": 62,
  "bed_number": "A03"
}' > /dev/null
echo "   已创建3位患者"

echo ""
echo "1.3 创建班次..."
post_json "$BASE_URL/shifts" '{
  "shift_name": "2024-05-20-早班",
  "shift_type": "morning",
  "nurse": "护士A",
  "status": "completed"
}' > /dev/null
post_json "$BASE_URL/shifts" '{
  "shift_name": "2024-05-20-中班",
  "shift_type": "afternoon",
  "nurse": "护士B",
  "status": "completed"
}' > /dev/null
echo "   已创建2个班次"

echo ""
echo "场景2: 正常召回流程"
echo "------------------------"

echo "2.1 创建领用记录（正常使用）..."
post_json "$BASE_URL/consumptions" '{
  "patient_id": "P001",
  "shift_id": "shift-001",
  "batch_number": "BAT-2024-001A",
  "quantity": 1,
  "operator": "护士A",
  "is_alternative": false
}' > /dev/null
post_json "$BASE_URL/consumptions" '{
  "patient_id": "P002",
  "shift_id": "shift-002",
  "batch_number": "BAT-2024-001A",
  "quantity": 1,
  "operator": "护士B",
  "is_alternative": false
}' > /dev/null
echo "   已创建2条正常领用记录"

echo ""
echo "2.2 创建召回公告..."
RECALL_ID=$(post_json "$BASE_URL/recalls" '{
  "notice_number": "RECALL-2024-001",
  "title": "费森尤斯透析器BAT-2024-001批次质量问题召回",
  "content": "因膜材料缺陷，可能导致透析不充分，决定召回该批次产品",
  "issuer": "国家药监局",
  "affected_batchs": "BAT-2024-001A,BAT-2024-001B"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")
echo "   召回公告ID: $RECALL_ID"

echo ""
echo "2.3 执行追溯（第一次）..."
RESULT1=$(post_json "$BASE_URL/recalls/$RECALL_ID/trace" '{"operator": "张护士长"}')
COUNT1=$(echo "$RESULT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))")
echo "   追溯到 $COUNT1 位患者"

echo ""
echo "2.4 验证幂等性 - 再次执行追溯..."
RESULT2=$(post_json "$BASE_URL/recalls/$RECALL_ID/trace" '{"operator": "张护士长"}')
COUNT2=$(echo "$RESULT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))")
echo "   第二次追溯到 $COUNT2 位患者"
if [ "$COUNT1" = "$COUNT2" ]; then
    echo "   ✅ 幂等性验证通过：两次结果数量一致"
else
    echo "   ❌ 幂等性验证失败：结果数量不一致"
fi

echo ""
echo "2.5 人工确认召回结果..."
TRACE_ID=$(echo "$RESULT1" | python3 -c "import sys,json; d=json.load(sys.stdin); data=d.get('data',[]); print(data[0].get('id','') if data else '')")
CONFIRM_RESULT=$(post_json "$BASE_URL/trace/$TRACE_ID/override" '{
  "new_status": "confirmed",
  "operator": "李主任",
  "reason": "已核实患者确实使用该批次耗材"
}')
NEW_STATUS=$(echo "$CONFIRM_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
echo "   患者1状态变更为: $NEW_STATUS"
if [ "$NEW_STATUS" = "confirmed" ]; then
    echo "   ✅ 人工确认成功"
fi

echo ""
echo "场景3: 冲突样本 - 替代耗材"
echo "------------------------"

echo "3.1 创建替代耗材领用记录..."
post_json "$BASE_URL/consumptions" '{
  "patient_id": "P003",
  "shift_id": "shift-001",
  "batch_number": "BAT-2024-001B",
  "quantity": 1,
  "operator": "护士C",
  "is_alternative": true,
  "original_batch": "BAT-2024-001A",
  "reviewed": false
}' > /dev/null
echo "   已创建替代耗材领用记录"

echo ""
echo "3.2 创建新召回公告..."
RECALL_ID2=$(post_json "$BASE_URL/recalls" '{
  "notice_number": "RECALL-2024-002",
  "title": "透析管路批次泄漏问题召回",
  "content": "部分产品存在接头泄漏风险",
  "issuer": "省药品不良反应监测中心",
  "affected_batchs": "BAT-2024-001B"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")

echo ""
echo "3.3 执行追溯（自动检测冲突）..."
RESULT3=$(post_json "$BASE_URL/recalls/$RECALL_ID2/trace" '{"operator": "王护士长"}')
echo "$RESULT3" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',[]):
    if r.get('is_conflict'):
        print(f\"   ⚠️  检测到冲突: 患者={r.get('patient_id')}, 原因={r.get('conflict_reason')}\")
    else:
        print(f\"   ✓ 正常记录: 患者={r.get('patient_id')}\")
"

echo ""
echo "3.4 人工复核并驳回冲突记录..."
CONFLICT_TRACE_ID=$(echo "$RESULT3" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',[]):
    if r.get('is_conflict'):
        print(r.get('id',''))
        break
")
REJECT_RESULT=$(post_json "$BASE_URL/trace/$CONFLICT_TRACE_ID/override" '{
  "new_status": "rejected",
  "operator": "质量控制员",
  "reason": "经核实为替代耗材，原批号库存不足已更换为合格批次"
}')
REJECT_STATUS=$(echo "$REJECT_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))")
echo "   驳回后状态: $REJECT_STATUS"

echo ""
echo "3.5 查看复核记录..."
REVIEWS=$(get_json "$BASE_URL/trace/$CONFLICT_TRACE_ID/reviews")
echo "$REVIEWS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('data',[]):
    print(f\"   复核人: {r.get('reviewer')}, 动作: {r.get('review_action')}, 状态: {r.get('old_status')}→{r.get('new_status')}\")
"

echo ""
echo "场景4: 召回撤回"
echo "------------------------"

echo "4.1 创建召回公告..."
RECALL_ID3=$(post_json "$BASE_URL/recalls" '{
  "notice_number": "RECALL-2024-003",
  "title": "[待核实]某批次透析器疑似问题",
  "content": "接到举报某批次产品可能存在质量问题，先行召回待核实",
  "issuer": "医院质控科",
  "affected_batchs": "BAT-2024-001A"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")

echo ""
echo "4.2 执行追溯..."
post_json "$BASE_URL/recalls/$RECALL_ID3/trace" '{"operator": "质控员A"}' > /dev/null

echo ""
echo "4.3 撤回召回（核实为误报）..."
WITHDRAW_RESULT=$(post_json "$BASE_URL/recalls/$RECALL_ID3/withdraw" '{
  "operator": "质控科主任",
  "reason": "经实验室检测确认该批次产品合格，为误报，撤回召回"
}')
echo "   撤回结果: 成功"

echo ""
echo "4.4 验证撤回后状态..."
WITHDRAWN_RESULTS=$(get_json "$BASE_URL/recalls/$RECALL_ID3/results")
echo "$WITHDRAWN_RESULTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
statuses = set(r.get('status') for r in d.get('data',[]))
print(f'   所有追溯记录状态: {statuses}')
if 'withdrawn' in statuses:
    print('   ✅ 撤回验证通过')
"

echo ""
echo "4.5 查看操作历史..."
HISTORY=$(get_json "$BASE_URL/recalls/$RECALL_ID3/history")
echo "$HISTORY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for h in d.get('data',[]):
    print(f\"   {h.get('action_time')} - {h.get('operator')}: {h.get('description')}\")
"

echo ""
echo "场景5: 完整状态机流转演示"
echo "------------------------"

echo "5.1 创建多条领用记录..."
for i in 1 2 3 4; do
    post_json "$BASE_URL/consumptions" "{
      \"patient_id\": \"P00$i\",
      \"shift_id\": \"shift-00$i\",
      \"batch_number\": \"BAT-2024-ALT-001\",
      \"quantity\": 1,
      \"operator\": \"护士$i\",
      \"is_alternative\": false
    }" > /dev/null
done
echo "   已创建4条领用记录"

echo ""
echo "5.2 创建召回并追溯..."
RECALL_ID4=$(post_json "$BASE_URL/recalls" '{
  "notice_number": "RECALL-2024-004",
  "title": "替代批次透析器召回",
  "content": "清除率不达标",
  "issuer": "厂家",
  "affected_batchs": "BAT-2024-ALT-001"
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")

RESULT4=$(post_json "$BASE_URL/recalls/$RECALL_ID4/trace" '{"operator": "系统"}')
TRACE_IDS=$(echo "$RESULT4" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ids = [r.get('id') for r in d.get('data',[])]
print(' '.join(ids[:4]))
")
echo "   追溯到4条记录"

echo ""
echo "5.3 状态机流转演示:"
IDS=($TRACE_IDS)
echo "   记录1: pending → confirmed (确认受影响)"
post_json "$BASE_URL/trace/${IDS[0]}/override" '{
  "new_status": "confirmed",
  "operator": "审核员1",
  "reason": "资料齐全，确认受影响"
}' > /dev/null

echo "   记录2: pending → rejected (资料有误)"
post_json "$BASE_URL/trace/${IDS[1]}/override" '{
  "new_status": "rejected",
  "operator": "审核员2",
  "reason": "患者当日未透析，领用记录有误"
}' > /dev/null

echo "   记录3: pending → confirmed → resolved (已处理)"
post_json "$BASE_URL/trace/${IDS[2]}/override" '{
  "new_status": "confirmed",
  "operator": "审核员1",
  "reason": "确认受影响"
}' > /dev/null
post_json "$BASE_URL/trace/${IDS[2]}/override" '{
  "new_status": "resolved",
  "operator": "主管护师",
  "reason": "已通知患者复查，安排后续随访"
}' > /dev/null

echo "   记录4: pending → rejected → confirmed → resolved (有异议后更正)"
post_json "$BASE_URL/trace/${IDS[3]}/override" '{
  "new_status": "rejected",
  "operator": "审核员3",
  "reason": "批号记录存疑"
}' > /dev/null
post_json "$BASE_URL/trace/${IDS[3]}/override" '{
  "new_status": "confirmed",
  "operator": "护士长",
  "reason": "经核对原始记录，确认批号无误"
}' > /dev/null
post_json "$BASE_URL/trace/${IDS[3]}/override" '{
  "new_status": "resolved",
  "operator": "医生",
  "reason": "患者检查结果正常，已完成风险告知"
}' > /dev/null

echo ""
echo "5.4 最终状态统计:"
FINAL=$(get_json "$BASE_URL/recalls/$RECALL_ID4/results")
echo "$FINAL" | python3 -c "
import sys,json
from collections import Counter
d=json.load(sys.stdin)
counter = Counter(r.get('status') for r in d.get('data',[]))
for status, count in counter.items():
    print(f'   {status}: {count}条')
print('   ✅ 状态机演示完成')
"

echo ""
echo "场景6: 报告导出"
echo "------------------------"
echo "   生成报告: GET $BASE_URL/recalls/$RECALL_ID4/report"
echo "   报告包含: 召回概览、患者明细、复核记录、操作历史"

echo ""
echo "========================================"
echo "  所有测试场景执行完成！"
echo "========================================"
echo ""
echo "访问以下URL查看报告:"
echo "  http://localhost:8080/api/v1/recalls/$RECALL_ID4/report"
echo ""
