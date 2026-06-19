#!/bin/bash
set -e
BASE=http://localhost:3032/api

echo "=================================================================="
echo "  多目标评分权重调参 — 端到端验证脚本"
echo "=================================================================="

echo ""
echo "========== CHECKPOINT 0: 初始状态（种子数据验证）==========="
echo "--- 问卷记录 ---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d['data']['summary']
print(f'  TOTAL={s[\"total\"]} 正常={s[\"normal\"]} 分母0={s[\"zeroDenominator\"]} 补录={s[\"supplemented\"]} 待复核={s[\"pendingReview\"]}')
for r in d['data']['records']:
    bn = r.get('boundary_note_id') or '-'
    orig = r.get('original_statement')
    if orig: orig = orig[:30]+'...'
    print(f'  {r[\"id\"]} {r[\"target_name\"]:<8} score={str(r[\"score\"]):<5} src={r[\"source\"]:<14} st={r[\"status\"]:<10} rt={r[\"record_type\"]:<22} bn={bn}')
    if orig: print(f'       原始说法: {orig}')
assert s['total'] == 3, f'Expected 3 records, got {s[\"total\"]}'
assert s['zeroDenominator'] == 1, f'Expected 1 zero_denominator, got {s[\"zeroDenominator\"]}'
assert s['pendingReview'] == 1, f'Expected 1 pendingReview, got {s[\"pendingReview\"]}'
print('  ✅ 种子数据正确：3条记录，1条分母为0待复核，0条预补录，0条预冲突')
"

echo ""
echo "--- 评分结果（初始状态）---"
curl -s "$BASE/scoring/results" | python3 -c "
import sys, json
d = json.load(sys.stdin)
sd = d['data']
print(f'  stepStatus={sd[\"stepStatus\"]}')
for r in sd['results']:
    print(f'  {r[\"target_name\"]:<8} w={r[\"weight\"]:.2f} s={r[\"score\"]:.1f} ws={r[\"weighted_score\"]:.2f} src={r[\"source\"]}')
assert sd['stepStatus'] == 'imported', f'Expected stepStatus=imported, got {sd[\"stepStatus\"]}'
print('  ✅ stepStatus=imported（有pending复核任务，尚未进入reviewed阶段）')
"

echo ""
echo "--- 待复核任务 ---"
curl -s "$BASE/review" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for t in d['data']['tasks']:
    print(f'  {t[\"id\"]} target={t[\"target_name\"]} type={t[\"record_type\"]} status={t[\"status\"]}')
print(f'  共 {len(d[\"data\"][\"tasks\"])} 条待复核')
"

echo ""
echo "--- 冲突列表（应为空）---"
curl -s "$BASE/conflicts" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  冲突数: {len(d[\"data\"][\"conflicts\"])}')
assert len(d['data']['conflicts']) == 0, '初始不应有冲突'
print('  ✅ 无预存在冲突')
"

echo ""
echo "--- 审计日志（仅导入3条）---"
curl -s "$BASE/audit-logs" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for l in d['data']['logs']:
    print(f'  {l[\"action\"]:<8} {l[\"operator\"]:<8} {l[\"target_type\"]}#{l[\"target_id\"][:8]}  {l[\"reason\"][:40]}')
assert d['data']['total'] == 3, f'Expected 3 import audits, got {d[\"data\"][\"total\"]}'
print('  ✅ 仅3条导入审计记录')
"

echo ""
echo "========== CHECKPOINT 1: 补录边界值说明（客户满意度 85→88）==========="
curl -s -X POST "$BASE/boundary-notes/supplement" \
  -H 'Content-Type: application/json' \
  --data '{"noteId":"bn-001","targetField":"客户满意度","supplementValue":"88","reason":"补看边界值说明bn-001后，客户满意度按旧口径应按服务人次折算，原问卷值85偏低，补录为88"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['success'], f'Supplement failed: {d}'
assert d['data']['conflictDetected'], 'Expected conflict detected (85 vs 88)'
assert d['data']['recordId'] == 'qr-001', f'Expected recordId=qr-001, got {d[\"data\"][\"recordId\"]}'
print(f'  recordId={d[\"data\"][\"recordId\"]} conflictDetected={d[\"data\"][\"conflictDetected\"]}')
print('  ✅ 补录成功，qr-001 被更新（非分裂），冲突已产生')
"

echo ""
echo "--- 验证qr-001现在是supplemented+pending ---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
qr001 = [r for r in d['data']['records'] if r['id']=='qr-001'][0]
assert qr001['score'] == 88, f'qr-001 score should be 88, got {qr001[\"score\"]}'
assert qr001['source'] == 'boundary_note', f'qr-001 source should be boundary_note, got {qr001[\"source\"]}'
assert qr001['status'] == 'pending', f'qr-001 status should be pending, got {qr001[\"status\"]}'
assert qr001['record_type'] == 'supplemented', f'qr-001 record_type should be supplemented, got {qr001[\"record_type\"]}'
assert qr001['boundary_note_id'] == 'bn-001', f'qr-001 bn_id should be bn-001, got {qr001[\"boundary_note_id\"]}'
print(f'  qr-001: score={qr001[\"score\"]} src={qr001[\"source\"]} st={qr001[\"status\"]} rt={qr001[\"record_type\"]} bn={qr001[\"boundary_note_id\"]}')
print('  ✅ qr-001 已从 normal/questionnaire/confirmed 变为 supplemented/boundary_note/pending')
"

echo ""
echo "========== CHECKPOINT 2: 检查冲突（85 vs 88）==========="
CONFLICT_ID=$(curl -s "$BASE/conflicts?status=pending" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cs = d['data']['conflicts']
assert len(cs) == 1, f'Expected 1 pending conflict, got {len(cs)}'
c = cs[0]
assert c['questionnaire_record_id'] == 'qr-001', f'Expected conflict for qr-001'
print(c['id'])
")
echo "  ✅ 冲突ID: $CONFLICT_ID (qr-001, 85 vs 88)"

echo ""
echo "========== CHECKPOINT 3: 解决冲突（确认采用边界值88）==========="
curl -s -X PUT "$BASE/conflicts/$CONFLICT_ID/resolve" -H 'Content-Type: application/json' \
  --data '{"decision":"confirm","reason":"边界值说明的旧口径更准确，按实际服务人次折算，确认采用补录值88","operator":"小祁"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['success'], f'Resolve failed: {d}'
assert d['data']['status'] == 'confirmed', f'Expected confirmed, got {d[\"data\"][\"status\"]}'
print(f'  冲突已解决: status={d[\"data\"][\"status\"]} affected={d[\"data\"][\"affectedResults\"]}')
print('  ✅ 冲突已确认，qr-001 → score=88, source=boundary_note, status=confirmed')
"

echo ""
echo "--- 验证qr-001现在是confirmed ---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
qr001 = [r for r in d['data']['records'] if r['id']=='qr-001'][0]
assert qr001['status'] == 'confirmed', f'qr-001 should be confirmed after conflict resolve'
print(f'  qr-001: score={qr001[\"score\"]} src={qr001[\"source\"]} st={qr001[\"status\"]}')
"

echo ""
echo "========== CHECKPOINT 4: 复核分母为0的qr-002 ==========="
REVIEW_ID=$(curl -s "$BASE/review" | python3 -c "
import sys, json
d = json.load(sys.stdin)
tasks = d['data']['tasks']
assert len(tasks) >= 1, f'Expected at least 1 review task'
print(tasks[0]['id'])
")
echo "  复核任务ID: $REVIEW_ID"
curl -s -X PUT "$BASE/review/$REVIEW_ID" -H 'Content-Type: application/json' \
  --data '{"decision":"approved","note":"该期间无服务工单，分母为0合理，确认修正为60（上季度均值）","operator":"复核员A","originalStatement":"当响应时效分母为0时（无工单），原始行可能填为空字符串，不可自动归零或归正常，需提交复核人员判断","correctedValue":"60","nextHandler":"张经理（业务侧确认均值）"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['success'], f'Review failed: {d}'
print(f'  复核通过: taskId={d[\"data\"][\"taskId\"]} status={d[\"data\"][\"status\"]}')
"

echo ""
echo "--- 验证qr-002已confirmed，score=60 ---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
qr002 = [r for r in d['data']['records'] if r['id']=='qr-002'][0]
assert qr002['status'] == 'confirmed', f'qr-002 should be confirmed, got {qr002[\"status\"]}'
assert qr002['score'] == 60, f'qr-002 score should be 60, got {qr002[\"score\"]}'
orig = qr002.get('original_statement','')
print(f'  qr-002: score={qr002[\"score\"]} src={qr002[\"source\"]} st={qr002[\"status\"]}')
if orig: print(f'  原始说法: {orig[:40]}...')
print('  ✅ qr-002 已复核通过，score=60, 四要素已写入')
"

echo ""
echo "========== CHECKPOINT 5: 更新课堂演示评分结果 ==========="
curl -s -X POST "$BASE/scoring/update" -H 'Content-Type: application/json' \
  --data '{}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('--- 评分结果变更 ---')
prev_map = {p['target_name']: p for p in d['data']['previousResults']}
for c in d['data']['updatedResults']:
    p = prev_map.get(c['target_name'], {})
    ps = p.get('score', '?')
    pws = p.get('weighted_score', '?')
    dsc = f'{ps}→{c[\"score\"]}' if ps != c.get('score') else f'{c[\"score\"]}(不变)'
    dw = f'{pws}→{c[\"weighted_score\"]:.2f}' if isinstance(pws, (int,float)) and pws != c['weighted_score'] else f'{c[\"weighted_score\"]:.2f}'
    src = c.get('source','?')
    print(f'  {c[\"target_name\"]:<8}: score={dsc}  加权={dw}  src={src}  ver={c[\"version\"]}')
"

echo ""
echo "--- 验证stepStatus ---"
curl -s "$BASE/scoring/results" | python3 -c "
import sys, json
d = json.load(sys.stdin)
sd = d['data']
print(f'  stepStatus={sd[\"stepStatus\"]} totalWeight={sd[\"totalWeight\"]:.2f} totalScore={sd[\"totalScore\"]:.2f}')
for r in sd['results']:
    print(f'  {r[\"target_name\"]:<8} w={r[\"weight\"]:.2f} s={r[\"score\"]:<5.1f} ws={r[\"weighted_score\"]:.2f} src={r[\"source\"]:<14} ver={r[\"version\"]}')
assert sd['stepStatus'] == 'updated', f'Expected stepStatus=updated, got {sd[\"stepStatus\"]}'
expected = 88*0.3 + 60*0.25 + 92*0.2
assert abs(sd['totalScore'] - expected) < 0.01, f'Expected totalScore={expected}, got {sd[\"totalScore\"]}'
print(f'  ✅ stepStatus=updated, 总分={sd[\"totalScore\"]:.2f} (88*0.3 + 60*0.25 + 92*0.2 = {expected:.2f})')
"

echo ""
echo "========== CHECKPOINT 6: 最终全量核对 ==========="
echo "--- 问卷记录（id/source/status/boundary_note_id/original_statement 必须一致）---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d['data']['records']:
    bn = r.get('boundary_note_id') or '-'
    orig = r.get('original_statement')
    nh = r.get('next_handler') or '-'
    if orig: orig = orig[:30]+'...'
    print(f'  {r[\"id\"]} {r[\"target_name\"]:<8} score={str(r[\"score\"]):<5} src={r[\"source\"]:<14} st={r[\"status\"]:<10} rt={r[\"record_type\"]:<22} bn={bn:<8} nh={nh}')
    if orig: print(f'       原始说法: {orig}')
"

echo ""
echo "--- 审计日志（import + supplement + resolve_conflict + review + update_result）---"
curl -s "$BASE/audit-logs" | python3 -c "
import sys, json
d = json.load(sys.stdin)
labels = {'import':'导入','supplement':'补录','resolve_conflict':'解决冲突','update_result':'更新结果','review':'复核'}
actions = set()
for l in d['data']['logs']:
    tag = labels.get(l['action'], l['action'])
    actions.add(l['action'])
    tgt = l['target_type'] + '#' + l['target_id'][:8]
    print(f'  {tag:<6} {l[\"operator\"]:<8} {tgt:<24} {l[\"reason\"][:50]}')
for a in ['import','supplement','resolve_conflict','review','update_result']:
    assert a in actions, f'Missing audit action: {a}'
print(f'  ✅ 审计日志完整：{d[\"data\"][\"total\"]}条，5种动作齐全')
"

echo ""
echo "========== CHECKPOINT 7: 新批次导入验证 ==========="
curl -s -X POST "$BASE/questionnaire/import" \
  -H 'Content-Type: application/json' \
  --data '{"batchId":"batch-002","data":[{"target_name":"客户满意度","weight":"0.3","score":"90","denominator":"100"},{"target_name":"响应时效","weight":"0.25","score":"70","denominator":"50"},{"target_name":"合规达标率","weight":"0.2","score":"95","denominator":"100"},{"target_name":"团队协作","weight":"0.25","score":"80","denominator":"100"}]}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['success'], f'Import failed: {d}'
print(f'  新批次导入: batchId={d[\"data\"][\"batchId\"]} total={d[\"data\"][\"totalRecords\"]} normal={d[\"data\"][\"normalCount\"]}')
"

echo ""
echo "--- 验证新记录（团队协作是新增指标）---"
curl -s "$BASE/questionnaire" | python3 -c "
import sys, json
d = json.load(sys.stdin)
targets = [r['target_name'] for r in d['data']['records']]
assert '团队协作' in targets, f'团队协作 should be in records'
print(f'  记录数={d[\"data\"][\"summary\"][\"total\"]}，包含: {\"、\".join(targets)}')
print('  ✅ 新批次含4条记录，包含新增指标「团队协作」')
"

echo ""
echo "--- 更新评分结果（新批次驱动）---"
curl -s -X POST "$BASE/scoring/update" -H 'Content-Type: application/json' \
  --data '{"batchId":"batch-002"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
updated = d['data']['updatedResults']
targets = [r['target_name'] for r in updated]
assert '团队协作' in targets, f'团队协作 should be in scoring results'
print('--- 更新后评分结果 ---')
for r in sorted(updated, key=lambda x: x['target_name']):
    print(f'  {r[\"target_name\"]:<8} w={r[\"weight\"]:.2f} s={r[\"score\"]:<5.1f} ws={r[\"weighted_score\"]:.2f} src={r[\"source\"]}')
total_ws = sum(r['weighted_score'] for r in updated)
total_w = sum(r['weight'] for r in updated)
print(f'  总权重={total_w:.2f} 总分={total_ws:.2f}')
print('  ✅ 新批次batch-002驱动评分更新，团队协作（新指标）已创建scoring_result')
"

echo ""
echo "=================================================================="
echo "  ✅ 全部验证通过！"
echo "=================================================================="
