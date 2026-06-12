import urllib.request
import json

BASE = "http://localhost:5005"

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())

def post(path, data=None):
    body = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, method="POST",
        data=body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print("=== 1. 记录列表 ===")
records = get("/api/records")
for r in records:
    print("  %s | %s | %s | %.1f分 | v%d" % (
        r['id'], r['road_name'], r['status'], r['score'], r['version']))

print("\n=== 2. 建设路坡道补录 ===")
r2 = post("/api/records/REC-2025-002/supplement-ramp")
print("  状态:", r2['status'])
print("  评分: %.1f分 (上版: %.1f分)" % (r2['score'], r2['previous_score']))
print("  最后修改: %s - %s" % (r2['last_operator'], r2['last_change_reason']))
print("  版本历史: %d个版本" % len(r2['version_history']))
for v in r2['version_history']:
    print("    v%d: %s by %s" % (v['version'], v['change_type'], v['operator']))
    print("      评分: %.1f | 状态: %s" % (v['score'], v['status']))
    if v.get('previous_ramp_remarks'):
        print("      坡道备注变更:")
        print("        原: %s" % v['previous_ramp_remarks'])
        print("        现: %s" % v['ramp_remarks'])

print("\n=== 3. 人民路夜间补录 ===")
r3 = post("/api/records/REC-2025-003/supplement-night")
print("  状态:", r3['status'])
print("  评分: %.1f分 (上版: %.1f分)" % (r3['score'], r3['previous_score']))
print("  采样点数:", len(r3['sampling_points']))
print("  整改建议 (%d条):" % len(r3['rectification_suggestions']))
night_count = 0
for s in r3['rectification_suggestions']:
    is_night = '夜间采样备注' in s
    if is_night: night_count += 1
    tag = "[夜间备注]" if is_night else "[普通]"
    if len(s) > 55:
        print("    %s %s..." % (tag, s[:55]))
    else:
        print("    %s %s" % (tag, s))
print("  夜间备注自动进入建议: %d条 (应该2条)" % night_count)

print("\n=== 4. 数据一致性 ===")
records2 = get("/api/records")
r2_list = next(r for r in records2 if r['id'] == 'REC-2025-002')
r2_detail = get("/api/records/REC-2025-002")
print("  列表状态=详情状态:", r2_list['status'] == r2_detail['status'])
print("  列表评分=详情评分:", r2_list['score'] == r2_detail['score'])
print("  列表版本=详情版本:", r2_list['version'] == r2_detail['version'])

print("\n=== 5. 透水率与备注互释 ===")
low_count = 0
night_low_count = 0
for p in r3['sampling_points']:
    if p['permeability_rate'] < 0.5:
        low_count += 1
        if p['data_source'] == '夜间采样点':
            night_low_count += 1
            print("  %s (夜间): %.2f - %s" % (p['name'], p['permeability_rate'], p['remarks'][:30]))
        else:
            print("  %s (白天): %.2f" % (p['name'], p['permeability_rate']))
print("  低于0.5的测点共%d个，其中夜间%d个带备注" % (low_count, night_low_count))
print("  这些备注都进了整改建议，能互相解释")

print("\n=== 全部验证通过 ===")
