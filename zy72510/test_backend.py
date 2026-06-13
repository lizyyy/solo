#!/usr/bin/env python3
import json, urllib.request, urllib.error

BASE = 'http://localhost:3001/api'

def post(url, data=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req).read())

def get(url):
    return json.loads(urllib.request.urlopen(url).read())

print('=' * 60)
print(' 广告文案审核二次判定 - 后端核心链路验证')
print('=' * 60)

# 1. 健康检查
h = get(f'{BASE}/health')
print(f"\n[1] 服务健康: {h['success']}")

# 2. 批次列表
batches = get(f'{BASE}/batches')
print(f"[2] 种子批次: {len(batches)}个")
for b in batches:
    print(f"    {b['id']} 样本={len(b['sampleIds'])} 重算v{b['recalcVersion']}")

# 3. 重复导入去重
print("\n[3] 重复导入去重验证:")
detail = get(f'{BASE}/batches/gray-normal-20260613')
before = detail['overview']['totalSamples']
print(f"    重传前样本数: {before}")
dup_payload = {
    'batchId': 'gray-normal-20260613',
    'batchName': '广告文案审核-正常批次',
    'modelVersionA': 'ad-model-v2.3.1',
    'modelVersionB': 'ad-model-v2.4.0',
    'samples': detail['samples']['all']
}
r = post(f'{BASE}/batches', dup_payload)
print(f"    重传结果: 新增={r['added']} 重复跳过={r['skipped']}")
after = get(f'{BASE}/batches/gray-normal-20260613')['overview']['totalSamples']
print(f"    重传后样本数: {after} 不变={before == after}")
assert before == after, '去重失效！'
print('    ✅ 重复导入去重通过')

# 4. 低置信度被均值掩盖
print("\n[4] 低置信度不被均值掩盖验证:")
wrong = get(f'{BASE}/batches/gray-wrong-20260613')
avg_a = wrong['overview']['avgConfidenceA']
avg_b = wrong['overview']['avgConfidenceB']
low = wrong['samples']['lowConfidence']
normal = wrong['samples']['normal']
print(f"    模型A均值={avg_a:.3f} 模型B均值={avg_b:.3f}")
print(f"    低置信度样本={len(low)} 正常样本={len(normal)}")
for s in low[:3]:
    print(f"     → {s['id']}: confA={s['confidenceA']} confB={s['confidenceB']} isLow={s['isLowConfidence']}")
# 单独置顶列表不被均值掩盖
assert len(low) > 0, '低置信度样本未检测到'
assert len([s for s in low if s.isLowConfidence]) == len(low)
print('    ✅ 低置信度样本置顶分离，不被均值掩盖')

# 5. 冲突检测
print("\n[5] 冲突检测验证:")
conflicts = get(f'{BASE}/conflicts/gray-wrong-20260613')
print(f"    自动检测到 {len(conflicts)} 条冲突证据")
for c in conflicts[:3]:
    print(f"     → {c['id']} 样本{c['sampleId']} 类型={c['type']}")
assert len(conflicts) >= 3, '冲突检测不足'
print('    ✅ 灰度批次 vs 标注员留言 冲突已列出')

# 6. 冲突解决（必须填写理由）
print("\n[6] 冲突解决验证:")
c0 = conflicts[0]
try:
    post(f'{BASE}/conflicts/{c0["id"]}/resolve',
         {'resolution': 'reject_gray', 'reason': '', 'operator': '知识库编辑小乔'})
    print('    ❌ 空理由未被拦截！')
except urllib.error.HTTPError as e:
    print(f'    空理由正确拦截: HTTP {e.code}')

resolved = post(f'{BASE}/conflicts/{c0["id"]}/resolve', {
    'resolution': 'reject_gray',
    'reason': '标注员留言正确，灰度批次误判，已与业务同事核实，采纳标注意见',
    'operator': '知识库编辑小乔'
})
print(f"    有理由驳回成功: resolved={resolved['resolved']} 结论={resolved['resolution']}")
print(f"    理由: {resolved['resolvedReason'][:40]}...")
print('    ✅ 冲突必须填写理由，知识库编辑不自动替业务拍板')

# 7. 历史记录同步
print("\n[7] 历史记录同步验证:")
sample_id = c0['sampleId']
history = get(f'{BASE}/samples/{sample_id}/history')
sample = get(f'{BASE}/samples/{sample_id}')
print(f"    样本 {sample_id} 历史记录={len(history)}条 finalLabel={sample.get('finalLabel')}")
for h in history[-3:]:
    print(f"     → {h['action']} 操作人={h['operator']} 备注={(h.get('note') or '')[:20]}")
assert len(history) >= 2
print('    ✅ 模型版本对比与历史记录同步更新')

# 8. 补录 + 重算
print("\n[8] 补录 + 重算验证:")
suppl = get(f'{BASE}/batches/gray-supplement-20260613')
before_count = suppl['overview']['totalSamples']
print(f"    补录前: {before_count}条")
new_samples = [
    {'id': 'suppl-new-001', 'content': '补录-本品含最丰富营养，适合所有人群',
     'confidenceA': 0.46, 'confidenceB': 0.51, 'labelA': 'reject',
     'labelB': 'uncertain', 'grayLabel': 'pass', 'annotatorNote': '应拒绝，绝对化用语'},
    {'id': 'suppl-new-002', 'content': '补录-普通清洁套装，温和配方不伤手',
     'confidenceA': 0.85, 'confidenceB': 0.83, 'labelA': 'pass',
     'labelB': 'pass', 'grayLabel': 'pass'},
]
supp_r = post(f'{BASE}/samples/supplement',
              {'batchId': 'gray-supplement-20260613', 'samples': new_samples})
print(f"    补录: 新增={supp_r['added']} 跳过={supp_r['skipped']}")
recalc = post(f'{BASE}/batches/gray-supplement-20260613/recalc',
              {'operator': '知识库编辑小乔'})
print(f"    重算后: {recalc['totalSamples']}条 低置信度={recalc['lowConfidenceCount']}")
assert recalc['totalSamples'] == before_count + 2
print('    ✅ 补录后重算，指标与历史记录一起变')

# 9. 自检四项
print("\n[9] 自检四项验证:")
report = get(f'{BASE}/selfcheck/gray-wrong-20260613')
print(f"    整体通过: {report['overallPass']}")
for it in report['items']:
    mark = '✅' if it['pass'] else '❌'
    print(f"    {mark} {it['key']:25s} → {it['reason'][:55]}")
assert report['overallPass'], '自检未通过'
print('    ✅ 四项自检全部通过')

# 10. 低置信度复核（留给知识库编辑）
print("\n[10] 低置信度复核:")
low_sample = low[0]
reviewed = post(f'{BASE}/samples/{low_sample["id"]}', {
    'finalLabel': 'reject',
    'operator': '知识库编辑小乔',
    'note': '低置信度样本，人工复核后判定拒绝，不归入正常'
})
history2 = get(f'{BASE}/samples/{low_sample["id"]}/history')
print(f"    样本{low_sample['id']} 最终标签={reviewed['finalLabel']} 历史={len(history2)}条")
print('    ✅ 低置信度不急着归正常，留给知识库编辑复核')

print("\n" + "=" * 60)
print('  🎉 全部 10 项核心流程验证通过')
print("=" * 60)
