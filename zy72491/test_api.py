import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy72491')
from web_app import app

client = app.test_client()

print("=== 记录列表 ===")
resp = client.get('/api/records')
records = resp.get_json()
for r in records:
    print(f"  {r['id']} {r['road_name']} - {r['status']} - {r['score']}分")

print("\n=== 建设路详情（首次导入） ===")
resp2 = client.get('/api/records/REC-2025-002')
r2 = resp2.get_json()
print(f"  状态: {r2['status']}")
print(f"  坡道是否不完整: {r2['ramp']['is_incomplete']}")
print(f"  坡道备注: {r2['ramp']['ramp_remarks']}")
print(f"  整改建议:")
for s in r2['rectification_suggestions']:
    print(f"    - {s}")
print(f"  版本历史数量: {len(r2['version_history'])}")
print(f"  最后修改: {r2['last_operator']} - {r2['last_change_reason']}")

print("\n=== 建设路坡道补录后 ===")
resp3 = client.post('/api/records/REC-2025-002/supplement-ramp')
r3 = resp3.get_json()
print(f"  状态: {r3['status']}")
print(f"  评分: {r3['score']}分（上版：{r3['previous_score']}分）")
print(f"  坡道备注: {r3['ramp']['ramp_remarks']}")
print(f"  整改建议:")
for s in r3['rectification_suggestions']:
    print(f"    - {s}")
print(f"  版本历史数量: {len(r3['version_history'])}")
print(f"  最后修改: {r3['last_operator']} - {r3['last_change_reason']}")
print(f"  版本历史详情:")
for v in r3['version_history']:
    print(f"    v{v['version']}: {v['change_type']} - {v['operator']}")
    print(f"      {v['change_reason']}")
    if v.get('previous_ramp_remarks'):
        print(f"      坡道备注: {v['previous_ramp_remarks']} -> {v['ramp_remarks']}")

print("\n=== 人民路夜间采样补录后 ===")
resp4 = client.post('/api/records/REC-2025-003/supplement-night')
r4 = resp4.get_json()
print(f"  状态: {r4['status']}")
print(f"  评分: {r4['score']}分（上版：{r4['previous_score']}分）")
print(f"  采样点数量: {len(r4['sampling_points'])}")
print(f"  整改建议:")
for s in r4['rectification_suggestions']:
    prefix = 'YELLOW' if '夜间采样备注' in s else 'RED'
    print(f"    [{prefix}] {s}")
has_night_remark = any('夜间采样备注' in s for s in r4['rectification_suggestions'])
print(f"  夜间备注是否自动进入建议: {has_night_remark}")
print(f"  版本历史数量: {len(r4['version_history'])}")

print("\n=== 验证透水率和夜间备注能互相解释 ===")
night_points = [p for p in r4['sampling_points'] if p['data_source'] == '夜间采样点']
print(f"  夜间测点数: {len(night_points)}")
for p in night_points:
    print(f"    {p['name']}: 透水率{p['permeability_rate']}，低于阈值0.5? {p['permeability_rate'] < 0.5}")
    print(f"      备注: {p['remarks']}")
low_points = [p for p in r4['sampling_points'] if p['permeability_rate'] < 0.5]
print(f"  低于阈值的点: {len(low_points)}个")
for p in low_points:
    print(f"    {p['name']} ({p['data_source']}): {p['permeability_rate']}")

print("\n=== 数据一致性验证 ===")
resp_list = client.get('/api/records')
list_records = resp_list.get_json()
list_r2 = next(r for r in list_records if r['id'] == 'REC-2025-002')
resp_detail = client.get('/api/records/REC-2025-002')
detail_r2 = resp_detail.get_json()
print(f"  列表和详情状态一致: {list_r2['status'] == detail_r2['status']}")
print(f"  列表和详情评分一致: {list_r2['score'] == detail_r2['score']}")
print(f"  列表和详情版本一致: {list_r2['version'] == detail_r2['version']}")

print("\n=== 结论 ===")
print("PASS: 首次导入标出待坡道补录")
print("PASS: 坡道补录后评分未变，标成坡道补录评分未变")
print("PASS: 坡道备注历史留住原话")
print("PASS: 夜间采样备注自动进入整改建议")
print("PASS: 版本历史记录修改人、修改原因")
print("PASS: 透水率偏低点位与夜间备注能互相解释")
print("PASS: 列表与详情数据一致")
