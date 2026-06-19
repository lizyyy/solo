import urllib.request, json, sys

def api(path, method='GET', data=None):
    url = f'http://localhost:8000/api{path}'
    if data:
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method=method)
    else:
        req = urllib.request.Request(url, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"ERROR {e.code}: {err}", file=sys.stderr)
        sys.exit(1)

SAMPLES = [
    ('30.2591, 121.9634, 12.5m', 'latlng_with_distance', False, '经纬度+测距距离，正常'),
    ('X:1500mm Y:3200mm Z:5800mm', 'metric', False, '纯米制坐标，正常'),
    ('31.2304/121.4737 X:2000mm', 'mixed', True, '经纬度+米制坐标混用，待复核'),
]

print("=" * 70)
print("  坐标判别口径验证 — 三条真实样例完整走通")
print("=" * 70)
print()

all_ok = True

print("--- Step 1: 导入三条样例 ---")
r = api('/import', 'POST', {
    'batch_id': 'BATCH-VERIFY-20260619',
    'records': [
        {'raw_data': s[0], 'distance': 12.5 if i == 0 else (3.2 if i == 1 else 5.8)}
        for i, s in enumerate(SAMPLES)
    ]
})
assert r['imported'] == 3, f"Expected 3 imported, got {r['imported']}"
assert r['mixed_coord_count'] == 1, f"Expected 1 mixed, got {r['mixed_coord_count']}"
print(f"✅ 导入成功：3 条新增，1 条标记为坐标混用")
print()

records = api('/records')
assert len(records) == 3, f"Expected 3 records, got {len(records)}"
print("--- Step 2: 核对列表结果（每条的 coord_type 和 needs_review）---")
for i, (expected_raw, expected_type, expected_needs_review, desc) in enumerate(SAMPLES):
    rec = records[i]
    type_ok = rec['coord_type'] == expected_type
    review_ok = rec['needs_review'] == expected_needs_review
    status = '✅' if type_ok and review_ok else '❌'
    if not (type_ok and review_ok):
        all_ok = False
    print(f"{status} \"{expected_raw}\"")
    print(f"   期望: coord_type={expected_type}, needs_review={expected_needs_review}")
    print(f"   实际: coord_type={rec['coord_type']}, needs_review={rec['needs_review']}")
    print(f"   说明: {desc}")
    print()

print("--- Step 3: 核对详情页警告类型 ---")
for i, (expected_raw, expected_type, expected_needs_review, _) in enumerate(SAMPLES):
    rec = records[i]
    trace = api(f'/traceback/{rec["id"]}')
    is_mixed = trace['record']['coord_type'] == 'mixed'
    is_latlng_with_distance = trace['record']['coord_type'] == 'latlng_with_distance'
    
    warning_msg = None
    if is_mixed and trace['record']['needs_review']:
        warning_msg = '⚠️ 经纬度与米制混用，待巡检组复核'
    elif is_latlng_with_distance and not trace['record']['needs_review']:
        warning_msg = '✅ 经纬度+测距距离，正常'
    else:
        warning_msg = '正常'
    
    status = '✅'
    if is_mixed and not trace['record']['needs_review']:
        status = '❌'
        all_ok = False
    if is_latlng_with_distance and trace['record']['needs_review']:
        status = '❌'
        all_ok = False
    print(f"{status} \"{expected_raw}\" -> {warning_msg}")
print()

print("--- Step 4: 快照历史验证 ---")
mixed_rec = [r for r in records if r['coord_type'] == 'mixed'][0]
latlng_dist_rec = [r for r in records if r['coord_type'] == 'latlng_with_distance'][0]
metric_rec = [r for r in records if r['coord_type'] == 'metric'][0]

for name, rec in [('经纬度+测距', latlng_dist_rec), ('纯米制', metric_rec), ('混用', mixed_rec)]:
    trace = api(f'/traceback/{rec["id"]}')
    assert len(trace['snapshots']) == 1, f"{name}: Expected 1 snapshot after import, got {len(trace['snapshots'])}"
    assert trace['snapshots'][0]['stage'] == 'imported', f"{name}: Expected stage 'imported'"
    assert trace['snapshots'][0]['snapshot_data']['needs_review'] == rec['needs_review'], f"{name}: needs_review mismatch in snapshot"
    print(f"✅ {name}: 1 个 imported 快照，needs_review={rec['needs_review']}")
print()

print("--- Step 5: 工程师许工补看备注 ---")
for rec in [latlng_dist_rec, mixed_rec]:
    r = api('/remark', 'POST', {
        'record_id': rec['id'],
        'author': '许工',
        'content': f'已查看，{rec["coord_type"]}坐标{"需要现场复核" if rec["needs_review"] else "正常"}'
    })
    trace = api(f'/traceback/{rec["id"]}')
    stages = [s['stage'] for s in trace['snapshots']]
    assert 'engineer_reviewed' in stages, f"Missing engineer_reviewed snapshot for {rec['coord_type']}"
    print(f"✅ {rec['coord_type']}: 工程师已查看，快照历史新增 engineer_reviewed 阶段")
print()

print("--- Step 6: 许工修改备注，验证改前改后 ---")
remarks = api(f'/traceback/{mixed_rec["id"]}')['remarks']
remark_id = remarks[0]['id']
old_content = remarks[0]['content']
new_content = old_content + '，补充：东侧集装箱也有位移'
api(f'/remark/{remark_id}', 'PUT', {
    'new_content': new_content,
    'changed_by': '许工',
    'reason': '补充东侧信息'
})
history = api(f'/remark/{remark_id}/history')
assert len(history) == 1, f"Expected 1 change log, got {len(history)}"
assert history[0]['old_value'] == old_content
assert history[0]['new_value'] == new_content
assert history[0]['changed_by'] == '许工'
print(f"✅ 备注变更历史：改前='{old_content[:20]}...' -> 改后='{new_content[:20]}...'")
print(f"   操作人: {history[0]['changed_by']}, 理由: {history[0]['reason']}")
print()

print("--- Step 7: 现场班组说明更新（3条分别走） ---")
report_ids = []
for rec in [latlng_dist_rec, metric_rec, mixed_rec]:
    why_kept = '坐标清晰可解释' if rec['coord_type'] != 'mixed' else '坐标混用但现场确认有障碍物，需追踪'
    missing = '无' if rec['coord_type'] != 'mixed' else '缺少精确坐标校验报告'
    owner = 'crew' if rec['coord_type'] != 'mixed' else 'inspection'
    desc = '正常作业' if rec['coord_type'] != 'mixed' else '巡检组现场复测坐标'
    
    r = api('/crew-briefing', 'POST', {
        'record_id': rec['id'],
        'why_kept': why_kept,
        'missing_materials': missing,
        'next_step_owner': owner,
        'next_step_description': desc,
        'param_version': 'v2.1-2026Q2',
        'param_tradeoff_reason': '优先保证检出率，精度损失<0.3m可接受'
    })
    report_ids.append((rec['coord_type'], r['id']))
    trace = api(f'/traceback/{rec["id"]}')
    stages = [s['stage'] for s in trace['snapshots']]
    assert 'crew_briefed' in stages, f"Missing crew_briefed for {rec['coord_type']}"
    print(f"✅ {rec['coord_type']}: 班组说明已提交，下一步找 {'巡检组' if owner == 'inspection' else '现场班组'}")
print()

print("--- Step 8: 报告导出内容核对 ---")
for coord_type, report_id in report_ids:
    r = api(f'/report/{report_id}')
    text = r['report_text']
    
    checks = {
        '参数版本 v2.1-2026Q2': 'v2.1-2026Q2' in text,
        '取舍理由 <0.3m': '0.3m' in text,
        '坐标类型': coord_type in text,
        '巡检组或许工': ('巡检组' in text) or ('许工' in text),
    }
    
    if coord_type == 'mixed':
        checks['混用警告 ⚠️'] = '⚠️' in text and '请勿直接判正常' in text
    elif coord_type == 'latlng_with_distance':
        checks['经纬度+测距说明 ℹ️'] = ('ℹ️' in text) or ('经纬度+测距距离' in text)
    
    all_pass = all(checks.values())
    if not all_pass:
        all_ok = False
    
    status = '✅' if all_pass else '❌'
    print(f"{status} {coord_type} 报告内容核对:")
    for k, v in checks.items():
        print(f"   {'✓' if v else '✗'} {k}")
    
    print(f"   报告预览（首200字）:")
    print(f"   {text[:200].replace(chr(10), chr(10) + '   ')}")
    print()

print("=" * 70)
if all_ok:
    print("  ✅ 全部验证通过！坐标判别口径已修正")
else:
    print("  ❌ 部分验证失败")
print("=" * 70)
sys.exit(0 if all_ok else 1)
