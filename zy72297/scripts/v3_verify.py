#!/usr/bin/env python3
import json, urllib.request

def call(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request("http://localhost:8000/api" + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        try:
            return e.code, json.loads(body_err)
        except Exception:
            return e.code, body_err

print("=== 1. 创建剖面并导入（含双名冲突）===")
code, p = call("POST", "/profiles", {"project_name":"API一致性测试V3","coordinate_origin_description":"测试原点"})
print(f"  code={code} type={type(p).__name__}")
pid = p["profile_id"]
print(f"  profile_id={pid}")

lines = [
    "OBS001 | 路面凹陷A | 120 | 10.5 | 3.2 | 0.0",
    "OBS001 | 凹陷点A | 120 | 10.5 | 3.2 | 0.0",
    "OBS002 | 排水口B | 50 | 25.0 | 8.1 | 0.0",
]
code, p = call("POST", f"/profiles/{pid}/import-origin", {"lines": lines, "operator": "system"})
print(f"  import code={code} conflicts={len(p.get('conflicts', []))}")
cid = p["conflicts"][0]["conflict_id"]
print(f"  conflict_id={cid}")

print("\n=== 2. 不选名称 → 错误响应 ===")
code, resp = call("POST", f"/profiles/{pid}/resolve-conflict",
                  {"conflict_id": cid, "chosen_name": "", "operator": "许工", "rollback": False})
print(f"  HTTP {code}: {resp}")

print("\n=== 3. 选名称 + 原因 + 复核人 → 确认选用 ===")
code, resp = call("POST", f"/profiles/{pid}/resolve-conflict", {
    "conflict_id": cid,
    "chosen_name": "凹陷点A",
    "operator": "许工",
    "rollback": False,
    "reason": "巡检照片现场说法为凹陷点A",
    "next_reviewer": "培训学员李四",
})
print(f"  HTTP {code}")
for c in resp["conflicts"]:
    if c["conflict_id"] == cid:
        print(f"  status={c['status']} resolution={c['resolution']}")
        print(f"  reason={c.get('reason')}")
        print(f"  next_reviewer={c.get('next_reviewer')}")
        print(f"  original_names={c.get('original_names')}")

print("\n=== 4. 出口一致性：页面视图 vs 导出 ===")
_, page_view = call("GET", f"/profiles/{pid}")
_, export_view = call("GET", f"/profiles/{pid}/export")
pr = {r["obstacle_id"]: r for r in page_view["records"]}
er = {r["obstacle_id"]: r for r in export_view["records"]}
ok = True
for oid in pr:
    for f in ["obstacle_name", "status", "water_depth_mm", "position_x"]:
        if pr[oid].get(f) != er[oid].get(f):
            print(f"  ✗ {oid}.{f}: {pr[oid].get(f)} vs {er[oid].get(f)}")
            ok = False
pc = {c["conflict_id"]: c for c in page_view["conflicts"]}
ec = {c["conflict_id"]: c for c in export_view["conflicts"]}
for cid0 in pc:
    for f in ["status", "resolution", "reason", "next_reviewer", "original_names", "resolved_by"]:
        if pc[cid0].get(f) != ec[cid0].get(f):
            print(f"  ✗ conflict.{cid0}.{f}: {pc[cid0].get(f)} vs {ec[cid0].get(f)}")
            ok = False
if ok:
    print("  ✓ 所有出口（页面/导出/API）完全一致")

print("\n=== 5. 证据追溯：原始行号 + 人工改动 ===")
for r in export_view["records"]:
    if r["obstacle_id"] == "OBS001":
        orig_lines = [e.get("original_line_number") for e in r["evidence_trail"] if e.get("original_line_number")]
        print(f"  记录 {r['record_id']} name={r['obstacle_name']} status={r['status']}")
        print(f"    原始行号: {orig_lines}")
        print(f"    人工改动数: {len(r['manual_changes'])}")
        for m in r["manual_changes"]:
            print(f"      {m['original_content']} by {m['operator']}")

print("\n=== 验证完成 ===")
