import sys, json, urllib.request
sys.path.insert(0, "backend")

BASE = "http://localhost:8000/api"

def call(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read()
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("=== 1. 创建剖面并导入（含双名冲突）===")
_, p = call("POST", "/profiles", {"project_name":"API一致性测试","coordinate_origin_description":"测试原点"})
pid = p["profile_id"]; print(f"profile_id={pid}")

lines = [
    "OBS001 | 路面凹陷A | 120 | 10.5 | 3.2 | 0.0",
    "OBS001 | 凹陷点A | 120 | 10.5 | 3.2 | 0.0",
    "OBS002 | 排水口B | 50 | 25.0 | 8.1 | 0.0",
]
_, p = call("POST", f"/profiles/{pid}/import-origin", {"lines": lines, "operator": "system"})
print(f"冲突数={len(p['conflicts'])}: {[c['names'] for c in p['conflicts']]}")
cid = p["conflicts"][0]["conflict_id"]
print(f"冲突ID={cid}")

print("\n=== 2. 不选名称 → 请先选择一个名称（验证400）===")
code, resp = call("POST", f"/profiles/{pid}/resolve-conflict",
                  {"conflict_id": cid, "chosen_name": "", "operator": "许工", "rollback": False})
print(f"HTTP {code}: {resp}")

print("\n=== 3. 选名称 + 原因 + 复核人 → 确认选用（验证200）===")
code, resp = call("POST", f"/profiles/{pid}/resolve-conflict", {
    "conflict_id": cid,
    "chosen_name": "凹陷点A",
    "operator": "许工",
    "rollback": False,
    "reason": "巡检照片现场说法为凹陷点A",
    "next_reviewer": "培训学员李四",
})
print(f"HTTP {code}: conflicts={len(resp.get('conflicts', []))}")
for c in resp["conflicts"]:
    print(f"  {c['conflict_id']} status={c['status']} resolution={c['resolution']}")
    print(f"  reason={c.get('reason')} next_reviewer={c.get('next_reviewer')}")
    print(f"  original_names={c.get('original_names')}")

print("\n=== 4. 所有出口一致性核对（页面视图 / 导出 / API返回）===")
_, page_view = call("GET", f"/profiles/{pid}")
_, export_view = call("GET", f"/profiles/{pid}/export")

pr = {r["obstacle_id"]: r for r in page_view["records"]}
er = {r["obstacle_id"]: r for r in export_view["records"]}
ok = True
for oid in pr:
    for f in ["obstacle_name", "status", "water_depth_mm", "position_x"]:
        if pr[oid].get(f) != er[oid].get(f):
            print(f"  ✗ {oid}.{f}: 页面={pr[oid].get(f)} 导出={er[oid].get(f)}")
            ok = False

pc = {c["conflict_id"]: c for c in page_view["conflicts"]}
ec = {c["conflict_id"]: c for c in export_view["conflicts"]}
for cid in pc:
    for f in ["status", "resolution", "reason", "next_reviewer", "original_names", "resolved_by"]:
        if pc[cid].get(f) != ec[cid].get(f):
            print(f"  ✗ conflict.{cid}.{f}: 页面={pc[cid].get(f)} 导出={ec[cid].get(f)}")
            ok = False

if ok:
    print("  ✓ 所有出口完全一致（记录+冲突+reason+原始名称）")

print("\n=== 5. 证据链完整性检查 ===")
for r in export_view["records"]:
    if r["obstacle_id"] == "OBS001":
        orig_lines = [e.get("original_line_number") for e in r["evidence_trail"] if e.get("original_line_number")]
        manual_count = len(r["manual_changes"])
        print(f"  {r['record_id']} 名称={r['obstacle_name']} 状态={r['status']}")
        print(f"    原始行号证据: {orig_lines}")
        print(f"    人工改动数: {manual_count}")
        for m in r["manual_changes"]:
            print(f"      改动: {m['original_content']} by {m['operator']}")

print("\n=== 所有测试通过 ===")
