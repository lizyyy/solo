#!/usr/bin/env python3
"""
E2E verification script: full user journey around SKETCH_A2O_1F.jpg
Runs against a live API server at http://127.0.0.1:8000

Usage:
  1. Start the server: python3 -m uvicorn sewage_inspection.api:app --host 127.0.0.1 --port 8000
  2. Run this script: python3 verify_e2e.py

Covers: load-sample -> find SKETCH_A2O_1F.jpg -> resolve with coordinates ->
         verify stats/audit/report/floor-profile all point to the same record
"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def api(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        sys.exit(1)


def check(label, actual, expected):
    status = "PASS" if actual == expected else "FAIL"
    print(f"  [{status}] {label}: {actual!r} {'==' if status=='PASS' else '!='} {expected!r}")
    return status == "PASS"


all_pass = True

print("=" * 60)
print("Step 1: Load sample project via POST /api/load-sample")
print("=" * 60)
d = api("POST", "/api/load-sample", {"name": "E2E-Test", "plant_name": "TestPlant", "by": "web-tester"})
pid = d["id"]
print(f"  Project ID: {pid}")
all_pass &= check("project name", d["name"], "E2E-Test")
all_pass &= check("plant name", d["plant_name"], "TestPlant")
stats = d.get("stats", {})
print(f"  Stats: {stats}")
all_pass &= check("occlusion_points count", stats.get("occlusion_points"), 7)
all_pass &= check("pending_review count", stats.get("pending_review"), 4)
all_pass &= check("resolved count", stats.get("resolved"), 3)
all_pass &= check("current_phase_label exists", bool(d.get("current_phase_label")), True)

print()
print("=" * 60)
print("Step 2: Find SKETCH_A2O_1F.jpg occlusion point")
print("=" * 60)
target = None
for op in d["occlusion_points"]:
    if op["photo_ref"] == "SKETCH_A2O_1F.jpg":
        target = op
        break
if not target:
    print("  [FAIL] SKETCH_A2O_1F.jpg not found!")
    sys.exit(1)
oid = target["id"]
print(f"  Occlusion ID: {oid}")
all_pass &= check("status", target["status"], "pending_review")
all_pass &= check("status_label", target["status_label"], "\u23f3 待安全员复核")
all_pass &= check("reason contains coord", "坐标" in (target["reason"] or ""), True)
all_pass &= check("missing_material contains coord table", "坐标表" in (target["missing_material"] or ""), True)
all_pass &= check("next_action_label exists", bool(target.get("next_action_label")), True)
all_pass &= check("floor_profile_summary exists", bool(target.get("floor_profile_summary")), True)
all_pass &= check("original_missing_material contains coord table", "坐标表" in (target["original_missing_material"] or ""), True)
all_pass &= check("audit_trail has entries", len(target["audit_trail"]) > 0, True)

print()
print("=" * 60)
print("Step 3: Resolve occlusion via POST /api/projects/{pid}/occlusion/{oid}/resolve")
print("=" * 60)
resolve_body = {
    "point_label": "P-A2O-1F-NEW",
    "x": target["x"],
    "y": target["y"],
    "z": target["z"],
    "resolved_by": "web-tester-老梁",
    "note": "补录坐标：照片SKETCH_A2O_1F.jpg标记点位在(12.5,8.0,0.3)，原坐标表漏记此行",
}
d2 = api("POST", f"/api/projects/{pid}/occlusion/{oid}/resolve", resolve_body)
resolved_op = None
for op in d2["occlusion_points"]:
    if op["id"] == oid:
        resolved_op = op
        break
if not resolved_op:
    print("  [FAIL] Resolved occlusion point not found in response!")
    sys.exit(1)
print(f"  Status after resolve: {resolved_op['status']}")
all_pass &= check("status now resolved", resolved_op["status"], "resolved")
all_pass &= check("status_label now resolved", resolved_op["status_label"], "\u2714 已解决")
all_pass &= check("resolved_by", resolved_op["resolved_by"], "web-tester-老梁")
all_pass &= check("audit_trail grew", len(resolved_op["audit_trail"]) > len(target["audit_trail"]), True)

new_stats = d2.get("stats", {})
print(f"  New stats: {new_stats}")
all_pass &= check("pending_review decreased", new_stats.get("pending_review"), stats["pending_review"] - 1)
all_pass &= check("resolved increased", new_stats.get("resolved"), stats["resolved"] + 1)

print()
print("=" * 60)
print("Step 4: Re-fetch project to verify persistence")
print("=" * 60)
d3 = api("GET", f"/api/projects/{pid}")
persisted_op = None
for op in d3["occlusion_points"]:
    if op["id"] == oid:
        persisted_op = op
        break
all_pass &= check("persisted status resolved", persisted_op["status"], "resolved")
all_pass &= check("persisted resolved_by", persisted_op["resolved_by"], "web-tester-老梁")

coord_rows = d3.get("coordinate_rows", [])
found_new = any(cr.get("point_label") == "P-A2O-1F-NEW" for cr in coord_rows)
all_pass &= check("new coordinate row P-A2O-1F-NEW exists", found_new, True)
print(f"  Coordinate rows count: {len(coord_rows)} (was {stats['coordinate_rows']})")

print()
print("=" * 60)
print("Step 5: Verify audit trail on the resolved point")
print("=" * 60)
for i, entry in enumerate(persisted_op["audit_trail"]):
    print(f"  audit[{i}]: action={entry['action']} {entry.get('from_status','')}->{entry.get('to_status','')} by={entry.get('changed_by','')} cause={entry.get('change_cause','')[:40]}")

has_resolve_entry = any("resolv" in e["action"].lower() for e in persisted_op["audit_trail"])
all_pass &= check("audit trail has resolve entry", has_resolve_entry, True)

print()
print("=" * 60)
print("Step 6: Verify report includes this occlusion")
print("=" * 60)
report_text = api("GET", f"/api/projects/{pid}/report")
has_sketch = "SKETCH_A2O_1F" in str(report_text)
all_pass &= check("report mentions SKETCH_A2O_1F", has_sketch, True)
has_resolved = "已解决" in str(report_text) or "resolved" in str(report_text).lower()
all_pass &= check("report shows resolved status", has_resolved, True)

print()
print("=" * 60)
print("Step 7: Verify floor profile link")
print("=" * 60)
fp_id = persisted_op.get("floor_profile_id")
if fp_id:
    fps = d3.get("floor_profiles", [])
    matched_fp = [fp for fp in fps if fp["id"] == fp_id]
    all_pass &= check("floor profile exists in project data", len(matched_fp) > 0, True)
    if matched_fp:
        print(f"  Linked floor profile: {matched_fp[0].get('floor_name', '?')}")
else:
    print("  [INFO] No floor_profile_id on this occlusion point")

print()
print("=" * 60)
print("Step 8: Verify obstacle remark link")
print("=" * 60)
ob_id = persisted_op.get("obstacle_remark_id")
if ob_id:
    obs = d3.get("obstacle_remarks", [])
    matched_ob = [ob for ob in obs if ob["id"] == ob_id]
    all_pass &= check("obstacle remark exists in project data", len(matched_ob) > 0, True)
    if matched_ob:
        print(f"  Linked obstacle: {matched_ob[0].get('location', '?')} - {matched_ob[0].get('description', '?')[:40]}")
else:
    print("  [INFO] No obstacle_remark_id on this occlusion point")

print()
print("=" * 60)
print("FINAL RESULT")
print("=" * 60)
if all_pass:
    print("  ALL CHECKS PASSED!")
else:
    print("  SOME CHECKS FAILED - see above")
    sys.exit(1)
