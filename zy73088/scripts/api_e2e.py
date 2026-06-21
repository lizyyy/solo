"""后端 API 端到端测试：补录备注 → 改判 → 审计 → 导出对账"""
import json, urllib.request, urllib.parse, sys
BASE = "http://localhost:3001/api/records/PRJ-DEMO"

def req(method, url, data=None):
    body = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

def assert_eq(name, actual, expected):
    ok = (actual == expected)
    print(("  OK " if ok else "FAIL"), f"{name}: {actual} {'==' if ok else '!='} {expected}")
    if not ok:
        sys.exit(1)

# --- (0) health / get ---
print("[0] GET detail")
c, d0 = req("GET", "http://localhost:3001/api/records/PRJ-DEMO")
assert_eq("status code", c, 200)
assert_eq("success", d0["success"], True)
det = d0["data"]
print("  record_id:", det["record_id"])
print("  render_source_id:", det["render_source_id"])
assert_eq("有 scene_annotations", bool(det["scene_annotations"]), True)
assert_eq("有 side_notes", bool(det["side_notes"]), True)
assert_eq("api_response 含同一 source_id",
          det["api_response"].get("source_id"), det["render_source_id"])

# --- (1) 补录备注 ---
print("[1] 补录备注（施工经理阿乔）")
mat0_id = det["materials"][0]["item_id"]
c, d1 = req("POST", f"{BASE}/materials/{mat0_id}/remarks", {
    "content": "6/21 现场复核：保护层已从 25mm 磨损至 18mm",
    "operator": "施工经理阿乔",
})
assert_eq("补录 200", c, 200)
d1d = d1["data"]
remarks_after = [m for m in d1d["materials"] if m["item_id"] == mat0_id][0]["remarks"]
print(f"  备注数：{len(remarks_after)}；最新：{remarks_after[-1]['operator']} — {remarks_after[-1]['content'][:40]}")

# --- (2) 改判 ---
print("[2] 改判结论：方案B → 方案A")
c, d2 = req("POST", f"{BASE}/revise", {
    "new_conclusion": "scheme_a",
    "revise_reason": "保护层磨损超预期，碳纤维强度不足以覆盖，改用粘钢加固",
    "new_confidence": 0.86,
    "extra_remarks": [{"content": "附现场实测照片 20260621 已归档", "operator": "施工经理阿乔"}],
    "operator": "施工经理阿乔",
})
assert_eq("改判 200", c, 200)
d2d = d2["data"]
assert_eq("结论变为 scheme_a", d2d["conclusion"], "scheme_a")
assert_eq("置信度 0.86", d2d["confidence"], 0.86)
latest = d2d["history_chain"][-1]
print(f"  V{latest['version_no']} {latest['operator']}: {latest['old_conclusion']} → {latest['new_conclusion']}")
print(f"  改判原因：{latest['revise_reason'][:50]}")
assert_eq("改判三元组含旧材料快照", latest["snapshot_material"] is not None, True)
assert_eq("改判三元组含新备注数", len(latest["new_remarks"]) >= 1, True)

# --- (3) 按操作人追审计日志 ---
print("[3] 审计筛选：施工经理阿乔")
q = urllib.parse.urlencode({"operator": "施工经理阿乔"})
c, d3 = req("GET", f"{BASE}/audit?{q}")
logs = d3["data"]
print(f"  找到 {len(logs)} 条日志")
revise_logs = [l for l in logs if l["operation_type"] == "revise_conclusion"]
assert_eq("至少 1 条改判日志", len(revise_logs) >= 1, True)
print(f"  改判日志 detail：{revise_logs[-1]['operation_detail'][:60]}")

# --- (4) 导出对账 ---
print("[4] 导出对账")
c, d4 = req("GET", f"{BASE}/export")
exd = d4["data"]
assert_eq("导出 render_source_id 一致", exd["render_source_id"], det["render_source_id"])
assert_eq("导出 scene_annotations 不为空", bool(exd["scene_annotations"]), True)
assert_eq("导出 side_notes 不为空", bool(exd["side_notes"]), True)
assert_eq("导出 reconciliation_text 存在", bool(exd["reconciliation_text"]), True)
print(f"  同源 source_id：{exd['render_source_id']}")
print(f"  warnings：{exd.get('warnings', [])}")
lines = exd["reconciliation_text"].split("\n")
assert_eq("对账单含左栏标题", any("左栏" in l for l in lines), True)
assert_eq("对账单含中栏标题", any("中栏" in l for l in lines), True)
assert_eq("对账单含右栏标题", any("右栏" in l for l in lines), True)
assert_eq("对账单页脚含同源声明", any("三处同源" in l for l in lines), True)
print("  对账单前 12 行：")
for l in lines[:12]:
    print("   ", l)

print("\n🏆 全部后端测试通过 ✨")
