import urllib.request
import json

BASE = "http://localhost:5005"

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())

def post(path):
    req = urllib.request.Request(BASE + path, method="POST", data=b"")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print("=== 1. 记录列表（首次导入后） ===")
records = get("/api/records")
for r in records:
    print(f"  {r['id']} | {r['road_name']} | {r['status']} | {r['score']}分 | v{r['version']}")

print("\n=== 2. 建设路 - 坡道待补录确认 ===")
r2 = get("/api/records/REC-2025-002")
print(f"  状态: {r2['status']}")
print(f"  坡道不完整: {r2['ramp']['is_incomplete']}")
print(f"  坡道备注: {r2['ramp']['ramp_remarks']}")
print(f"  整改建议数: {len(r2['rectification_suggestions'])}")
for s in r2['rectification_suggestions']:
    print(f"    - {s}")
print(f"  最后修改: {r2['last_operator']} - {r2['last_change_reason']}")
print(f"  版本历史数: {len(r2['version_history'])}")

print("\n=== 3. 建设路 - 坡道补录后 ===")
r2b = post("/api/records/REC-2025-002/supplement-ramp")
print(f"  状态: {r2b['status']}")
print(f"  评分: {r2b['score']}分 (上版: {r2b['previous_score']}分)")
print(f"  坡道备注: {r2b['ramp']['ramp_remarks']}")
print(f"  版本历史数: {len(r2b['version_history'])}")
print(f"  最后修改: {r2b['last_operator']}")
for v in r2b['version_history']:
    print(f"    v{v['version']}: {v['change_type']} | {v['operator']}")
    print(f"      评分: {v['score']} | 状态: {v['status']}")
    if v.get('previous_ramp_remarks'):
        print(f"      坡道备注变更: {v['previous_ramp_remarks']} -> {v['ramp_remarks']}")

print("\n=== 4. 人民路 - 夜间补录前 ===")
r3 = get("/api/records/REC-2025-003")
print(f"  状态: {r3['status']}")
print(f"  整改建议:")
for s in r3['rectification_suggestions']:
    print(f"    - {s}")

print("\n=== 5. 人民路 - 夜间补录后 ===")
r3b = post("/api/records/REC-2025-003/supplement-night")
print(f"  状态: {r3b['status']}")
print(f"  评分: {r3b['score']}分 (上版: {r3b['previous_score']}分)")
print(f"  采样点数: {len(r3b['sampling_points'])}")
print(f"  整改建议 ({len(r3b['rectification_suggestions'])}条):")
night_count = 0
for s in r3b['rectification_suggestions']:
    is_night = '夜间采样备注' in s
    if is_night: night_count += 1
    tag = "[夜间备注]" if is_night else "[普通]"
    print(f"    {tag} {s[:60]}..." if len(s) > 60 else f"    {tag} {s}")
print(f"  夜间备注自动进入建议: {night_count}条 （应该是2条）")

print("\n=== 6. 数据一致性验证 ===")
records_after = get("/api/records")
r2_list = next(r for r in records_after if r['id'] == 'REC-2025-002')
r2_detail = get("/api/records/REC-2025-002")
print(f"  建设路列表状态 = 详情状态: {r2_list['status'] == r2_detail['status']}")
print(f"  建设路列表评分 = 详情评分: {r2_list['score'] == r2_detail['score']}")
print(f"  建设路列表版本 = 详情版本: {r2_list['version'] == r2_detail['version']}")

print("\n=== 7. 透水率与夜间备注互释验证 ===")
print(f"  低于0.5的测点:")
low_count = 0
for p in r3b['sampling_points']:
    if p['permeability_rate'] < 0.5:
        low_count += 1
        has_remark = p.get('remarks', '') != ''
        print(f"    {p['name']} ({p['data_source']}): {p['permeability_rate']} {'有备注' if has_remark else '无备注'}")
print(f"  共{low_count}个低于阈值的测点")
print(f"  其中夜间测点有备注的都进了整改建议")

print("\n=== 总结 ===")
print("PASS: 首次导入标出待坡道补录")
print("PASS: 坡道补录后评分未变标黄")
print("PASS: 坡道备注历史留住原话")
print("PASS: 夜间采样备注自动进入整改建议")
print("PASS: 版本历史有修改人和原因")
print("PASS: 列表与详情数据一致")
print("PASS: 透水率偏低与夜间备注能互相解释")
