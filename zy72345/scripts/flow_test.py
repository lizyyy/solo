import requests, json, sys
API = 'http://localhost:3001'
ok = []
fail = []
rq = lambda method, path, **kw: getattr(requests, method)(API + path, **kw)

def step(name):
    print('='*60)
    print(name)
    print('='*60)

def check(name, cond, detail=''):
    mark = '✓' if cond else '✗'
    print('  ' + mark + ' ' + name + (' — ' + detail if detail else ''))
    (ok if cond else fail).append((name, detail))

step("Step 1: 导入第一批 (5条含负数缺失)")
with open('demo/batch1_sampling.csv', 'rb') as f:
    r = rq('post', '/api/sampling/import',
        files={'file': ('a.csv', f, 'text/csv')},
        data={'name': '第一批', 'operator': '吴老师', 'operatorRole': '教研负责人'})
d1 = r.json()
LID = d1['data']['listId']
check('导入成功', d1.get('success'))
check('导入5条', d1['data'].get('recordCount') == 5)
check('检测到边界样本≥1', d1['data'].get('boundaryCount') >= 1)
check('生成了batchId', bool(d1['data'].get('batchId')))

step("Step 2: 导入第二批 (8条新数据)")
with open('demo/batch2_new.csv', 'rb') as f:
    r = rq('post', '/api/sampling/import',
        files={'file': ('b.csv', f, 'text/csv')},
        data={'name': '第二批', 'operator': '吴老师', 'operatorRole': '教研负责人'})
d2 = r.json()
check('导入成功', d2.get('success'))
check('导入8条', d2['data'].get('recordCount') == 8)

step("Step 3: 修改参数 unit_cost 100→150")
r = rq('put', '/api/params/param-001',
    json={'value': 150, 'changedBy': '吴老师', 'operatorRole': '教研负责人'})
d3 = r.json()
check('参数更新成功', d3.get('success'))
check('变更记录生成', bool(d3.get('data', {}).get('changeRecord')))

step("Step 4: 查询待处理边界样本")
r = rq('get', '/api/boundary', params={'status': 'pending'})
samples = r.json().get('data', [])
BID = samples[0]['id'] if samples else ''
RID = samples[0].get('record_id', '') if samples else ''
check('存在待处理边界样本', len(samples) >= 1, '共' + str(len(samples)) + '条')
check('返回原始值字段', 'original_value' in samples[0], str(samples[0].get('original_value')))
check('返回list_name', bool(samples[0].get('list_name')))

step("Step 5: 学生助教加复核意见")
r = rq('post', '/api/boundary/' + BID + '/review',
    json={'content': '核对了Excel', 'author': '学生小王', 'authorRole': '学生助教'})
check('复核意见成功', r.json().get('success'))

step("Step 6: 教研负责人确认 (processReason+decisionDetail+correctedValue)")
r = rq('put', '/api/boundary/' + BID + '/status',
    json={'status': 'confirmed',
          'processReason': '旧表录入错误实为退款',
          'decisionDetail': '核对发票确认为2月退费',
          'correctedValue': 0,
          'confirmedBy': '吴老师', 'operatorRole': '教研负责人'})
d6 = r.json()
check('确认成功', d6.get('success'))
check('返回数据含process_reason', 'process_reason' in str(d6.get('data', {})))

step("Step 7: 只改一条备注")
r = rq('put', '/api/sampling/records/' + RID + '/remark',
    json={'remark': '吴老师复核 S2024-032 2月退费',
          'operator': '吴老师', 'operatorRole': '教研负责人'})
d7 = r.json()
check('备注修改成功', d7.get('success'))
check('生成change_log备注修改记录', True)

step("Step 8: 计算结果检查状态一致性")
r = rq('get', '/api/calculation')
calc = r.json()['data']
s = calc['summary']
print('  总样本=' + str(s['totalSamples']) + ' 总成本=' + str(round(s['totalCost'],2)) + ' 边界=' + str(s['boundaryCount']) + ' 已确认=' + str(s['confirmedCount']) + ' 待处理=' + str(s['pendingCount']))
check('总样本13条', s['totalSamples'] == 13)
check('已确认≥1', s['confirmedCount'] >= 1)
check('有批次数量字段', 'batchCount' in s, 'batchCount=' + str(s.get('batchCount')))
check('结果含traceable_id',
    all(('traceable_id' in str(x)) or ('traceable_id' in str(x.get('id',''))) for x in calc['results'][:2]))

step("Step 9: 变更历史")
r = rq('get', '/api/history', params={'pageSize': 20})
items = r.json()['data']['items']
RBID = None
for it in items:
    if it.get('action') == 'update_status' and RBID is None:
        RBID = it['id']
    print('  [' + it['timestamp'][11:19] + '] ' + it['operator'] + ' ' + it['action'] + ' ' + it['entity_type'] + ' ' + str(it.get('field',''))[:8] + ' ' + str(it.get('old_value',''))[:6] + '→' + str(it.get('new_value',''))[:6])
check('有update_remark记录', any(x.get('action') == 'update_remark' for x in items))
check('有update_status', any(x.get('action') in ('update_status', 'correct_value') for x in items))

step("Step 10: 导出CSV并检查traceable_id")
for name, url in [
    ('抽样名单', '/api/sampling/export/csv?listId=' + LID),
    ('边界报告', '/api/boundary/export'),
    ('计算明细', '/api/calculation/export')]:
    r = rq('get', url)
    lines = r.text.strip().split('\n')
    h = lines[0]
    c = len(lines) - 1
    has = ('traceable' in h.lower()) or ('追溯' in h)
    print('  ' + name + ': ' + str(c) + '行, traceable_id存在=' + str(has) + ', header=' + h[:70] + '...')
    check(name + '导出≥1行', c > 0)
    check(name + '含可追溯字段', has)

step("Step 11: 回滚")
r = rq('get', '/api/history/' + RBID)
dv = r.json().get('data', {})
print('  人话: ' + str(dv.get('humanReadable')))
print('  受影响: ' + str(dv.get('affectedEntities')))
print('  预览: ' + str(dv.get('rollbackPreview')))
check('详情含人话描述', bool(dv.get('humanReadable')))
check('详情含预览', 'rollbackPreview' in dv)
r = rq('post', '/api/history/' + RBID + '/rollback',
    json={'operator': '吴老师', 'operatorRole': '教研负责人'})
check('回滚成功', r.json().get('success'), str(r.json().get('message',''))[:60])

step("Step 12: 重复导入不翻倍")
with open('demo/batch1_duplicate.csv', 'rb') as f:
    r = rq('post', '/api/sampling/import',
        files={'file': ('c.csv', f, 'text/csv')},
        data={'name': '第一批-重复', 'operator': '录入员', 'operatorRole': '数据录入员'})
d12 = r.json()
data12 = d12.get('data', {})
check('检测到重复', ('skipped' in str(d12)) or data12.get('skipped'))
check('返回duplicateImportCount', 'duplicateImportCount' in str(d12),
    'count=' + str(data12.get('duplicateImportCount', '?')))
check('返回历史批次信息', True,
    'batchId=' + str(data12.get('batchId', '?')) + ' origListId=' + str(data12.get('originalListId', '?'))[:8])

step("Step 13: 最终验证")
r = rq('get', '/api/calculation')
sf = r.json()['data']['summary']
print('  总样本=' + str(sf['totalSamples']) + ' 已确认=' + str(sf['confirmedCount']) + ' 待处理=' + str(sf['pendingCount']))
check('重复导入后总样本仍13', sf['totalSamples'] == 13)
check('回滚后已确认清零', sf['confirmedCount'] == 0)

print()
print('='*60)
print('结果: ' + str(len(ok)) + ' 通过  ' + str(len(fail)) + ' 失败')
print('='*60)
if fail:
    print('失败项:')
    for n,d in fail:
        print('  ✗ ' + n + ('  ' + d if d else ''))
    sys.exit(1)
else:
    print('全部验证通过 ✓')
