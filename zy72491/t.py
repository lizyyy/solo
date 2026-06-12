import urllib.request
import json

BASE = "http://localhost:5005"

def get(path):
    req = urllib.request.Request(BASE + path)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def post(path, data=None):
    body = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(
        BASE + path, method="POST",
        data=body,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# 先重置
print("=== 重置数据 ===")
post("/api/reset")

# 1. 列表检查
print("\n=== 初始列表 ===")
records = get("/api/records")
for r in records:
    print("  %s | %s | %.1f分 | v%d" % (r['road_name'], r['status'], r['score'], r['version']))

# 2. 建设路坡道补录
print("\n=== 建设路 - 坡道补录 ===")
r2 = post("/api/records/REC-2025-002/supplement-ramp")
print("  状态:", r2['status'])
print("  评分: %.1f分 (上版: %.1f分)" % (r2['score'], r2['previous_score']))
print("  最后修改人:", r2['last_operator'])
print("  修改原因:", r2['last_change_reason'])
print("  版本历史数:", len(r2['version_history']))
for v in r2['version_history']:
    print("    v%d: %s | %s" % (v['version'], v['change_type'], v['operator']))
    print("      原因:", v['change_reason'])
    if v.get('previous_ramp_remarks'):
        print("      坡道备注: 【%s】 -> 【%s】" % (v['previous_ramp_remarks'], v['ramp_remarks']))

# 3. 数据一致性验证
print("\n=== 数据一致性 ===")
records2 = get("/api/records")
list_r2 = next(r for r in records2 if r['id'] == 'REC-2025-002')
detail_r2 = get("/api/records/REC-2025-002")
print("  列表状态:", list_r2['status'])
print("  详情状态:", detail_r2['status'])
print("  一致:", list_r2['status'] == detail_r2['status'])

# 4. 人民路夜间补录
print("\n=== 人民路 - 夜间补录前 ===")
r3_before = get("/api/records/REC-2025-003")
print("  状态:", r3_before['status'])
print("  整改建议数:", len(r3_before['rectification_suggestions']))
print("  建议列表:")
for s in r3_before['rectification_suggestions']:
    print("    -", s[:50])

print("\n=== 人民路 - 夜间补录后 ===")
r3 = post("/api/records/REC-2025-003/supplement-night")
print("  状态:", r3['status'])
print("  评分: %.1f分 (上版: %.1f分)" % (r3['score'], r3['previous_score']))
print("  采样点数:", len(r3['sampling_points']))
print("  整改建议数:", len(r3['rectification_suggestions']))
print("  建议列表:")
night_count = 0
for s in r3['rectification_suggestions']:
    is_night = "夜间采样备注" in s
    if is_night:
        night_count += 1
    tag = "【夜间】" if is_night else "【普通】"
    print("    %s %s" % (tag, s[:60]))
print("  夜间备注条数:", night_count, "(应该是2条)")

# 5. 透水率与备注互释
print("\n=== 透水率与夜间备注互释 ===")
low_points = [p for p in r3['sampling_points'] if p['permeability_rate'] < 0.5]
print("  低于0.5的测点:", len(low_points), "个")
for p in low_points:
    remark = p.get('remarks', '') or "无备注"
    print("    %s (%s): %.2f | 备注: %s" % (p['name'], p['data_source'], p['permeability_rate'], remark[:30]))

print("\n=== 验证完成 ===")
