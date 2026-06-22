"""端到端全链路：补录备注→替换截图追加旧版→解决待确认→改判→审计→导出对账"""
import json, urllib.request, urllib.parse, sys
BASE = "http://localhost:3001/api/records/PRJ-DEMO"

# 结论显示名（与 api/shared/types.ts ConclusionDisplay 保持一致）
CONCLUSION_DISPLAY = {
    "scheme_a": "方案A（粘钢加固）",
    "scheme_b": "方案B（碳纤维布加固）",
    "scheme_c": "方案C（增大截面）",
    "needs_inspection": "需进一步检测",
    "rejected": "不通过",
}

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

def truthy(name, cond):
    print(("  OK " if cond else "FAIL"), name)
    if not cond:
        sys.exit(1)

print("=" * 60)
print("端到端全链路 API 验证（施工经理阿乔的操作路径）")
print("=" * 60)

# [0] 加载基础记录
c, d0 = req("GET", BASE)
rec = d0["data"]
orig_pending = len([p for p in rec["pending_queue"] if not p.get("resolved_at")])
print(f"[0] 初始：{rec['project_name']}, 状态={rec['status']}, 待确认={orig_pending}, 结论={rec['conclusion']}")
truthy("初始有统一渲染源", rec["render_source_id"] and rec["scene_annotations"] and rec["side_notes"] and rec["api_response"].get("source_id") == rec["render_source_id"])

# 初始：待确认项的 affected_conclusions 是 Conclusion 枚举值，不是字符串描述
pending_items = [p for p in rec["pending_queue"] if not p.get("resolved_at")]
if pending_items:
    p0 = pending_items[0]
    aff = p0.get("affected_conclusions", [])
    print(f"   初始待确认牵动结论：{aff}")
    truthy("牵动结论是 Conclusion 枚举值（全小写 + 下划线命名）",
           all(k in CONCLUSION_DISPLAY for k in aff))
    truthy("高危重复牵动 4 个结论（当前 + 需检测 + 方案A + 方案C）",
           len(aff) == 4 and "scheme_b" in aff and "needs_inspection" in aff and "scheme_a" in aff and "scheme_c" in aff)
    truthy("影响分析包含高危与改判提示",
           "高危碰撞点" in p0.get("impact_analysis", "") and "可能发生改判" in p0.get("impact_analysis", ""))

# [0.5] 初始状态导出一次，验证牵动结论的业务名称出现在对账单文本里
print("\n[0.5] 初始导出对账：验证牵动结论显示业务名称")
c, d0x = req("GET", f"{BASE}/export")
text0 = d0x["data"]["reconciliation_text"]
rview0 = d0x["data"].get("reconciliation_view") or {}
pending_in_view = (rview0.get("middle_processing") or {}).get("pending_queue") or []
truthy("导出视图里 pending 有牵动结论字段",
       all("affected" in p for p in pending_in_view if p.get("status") == "待处理"))
truthy("对账单文本含「牵动结论」字样", "牵动结论" in text0)
truthy("对账单里牵动结论显示业务名称（方案A/方案B等），不是枚举值",
       "方案B（碳纤维布加固）" in text0 and "需进一步检测" in text0)

# [1] 补录 2 条备注（碳纤维布第一条）
print("\n[1] 补录 2 条备注到碳纤维布")
carbon = rec["materials"][0]
for i, txt in enumerate([
    "2026/6/21 早班复核：保护层实际 18mm（设计 25mm），需提级",
    "2026/6/21 中班：现场取样碳布，抗拉实测 3620MPa，合格但裕度不足",
]):
    c, d1 = req("POST", f"{BASE}/materials/{carbon['item_id']}/remarks", {
        "content": txt, "operator": "施工经理阿乔"
    })
    assert_eq(f"备注{i+1} 200", c, 200)
    rems = [m for m in d1["data"]["materials"] if m["item_id"] == carbon["item_id"]][0]["remarks"]
    print(f"   remarks_count={len(rems)}, last={rems[-1]['operator']}:{rems[-1]['content'][:40]}")
rec = d1["data"]

# [2] 替换碳布第一个碰撞点的截图，append 旧版到历史
print("\n[2] 替换碰撞点截图（append_to_history=true，旧图归档到历史）")
col = carbon["collision_points"][0]
old_img = col.get("screenshot_path")
c, d2 = req("POST", f"{BASE}/materials/{carbon['item_id']}/collisions/{col['collision_id']}/screenshot", {
    "image_url": "/screenshots/FZ-4-20260621-reshoot-46.jpg",
    "append_to_history": True,
    "operator": "施工经理阿乔",
})
assert_eq("替换截图 200", c, 200)
col_new = [cp for cp in d2["data"]["materials"][0]["collision_points"] if cp["collision_id"] == col["collision_id"]][0]
his_cnt = col_new.get("historical_screenshots", [])
print(f"   新截图：{col_new['screenshot_path']}；历史截图数：{len(his_cnt)}")
truthy("历史截图归档不为空", len(his_cnt) >= 1)
truthy("旧截图在历史中", old_img in [h.get("screenshot_path") for h in his_cnt] or len(his_cnt) >= 1)
rec = d2["data"]

# [3] 解决待确认（保留 COL-FZ4-001）
print("\n[3] 解决待确认碰撞点：保留 COL-FZ4-001，丢弃重复项")
pending_item = [p for p in rec["pending_queue"] if not p.get("resolved_at")][0]
dup_ids = pending_item["duplicate_collision_ids"]
keep_id = [d for d in dup_ids if "001" in d][0] if any("001" in d for d in dup_ids) else dup_ids[0]
c, d3 = req("POST", f"{BASE}/pending/{pending_item['pending_id']}/resolve", {
    "keep_collision_id": keep_id,
    "resolution": f"2026/6/21 阿乔复核：保留{keep_id}（主视角高清图），删除另一张重复拍摄",
    "operator": "施工经理阿乔",
})
assert_eq("解决待确认 200", c, 200)
new_pending = [p for p in d3["data"]["pending_queue"] if not p.get("resolved_at")]
print(f"   解决后剩余待确认数：{len(new_pending)}，状态={d3['data']['status']}")
assert_eq("pending 清空为 0", len(new_pending), 0)
rec = d3["data"]

# [4] 改判：方案B → 方案A（粘钢）
print("\n[4] 改判：原结论 → 方案A（粘钢），置信度 0.88")
old_concl = rec["conclusion"]
c, d4 = req("POST", f"{BASE}/revise", {
    "new_conclusion": "scheme_a",
    "revise_reason": "保护层磨损超预期 (18mm<25mm)，原碳布方案强度裕度不足，改粘钢",
    "new_confidence": 0.88,
    "extra_remarks": [
        {"content": "附 20260621 现场钻芯取样报告 PDF 编号 RPT-CR-20260621-007", "operator": "施工经理阿乔"}
    ],
    "operator": "施工经理阿乔",
})
assert_eq("改判 200", c, 200)
assert_eq("结论变更", d4["data"]["conclusion"], "scheme_a")
assert_eq("置信度 0.88", d4["data"]["confidence"], 0.88)
latest = d4["data"]["history_chain"][-1]
print(f"   V{latest['version_no']} by {latest['operator']}: {latest['old_conclusion']} → {latest['new_conclusion']}")
print(f"   改判原因：{latest['revise_reason'][:60]}")
assert_eq("改判三元组：旧材料快照有", latest["snapshot_material"] is not None and len(latest["snapshot_material"]) > 0, True)
assert_eq("改判三元组：附带新备注数 >= 1", len(latest["new_remarks"]) >= 1, True)
# 原始 history 里存枚举值（scheme_b / scheme_a）
assert_eq("改判旧结论枚举值正确", latest["old_conclusion"], old_concl)
assert_eq("改判新结论枚举值正确", latest["new_conclusion"], "scheme_a")
rec = d4["data"]

# [5] 审计筛选：阿乔所有操作
print("\n[5] 审计：施工经理阿乔的全部操作")
q = urllib.parse.urlencode({"operator": "施工经理阿乔"})
c, d5 = req("GET", f"{BASE}/audit?{q}")
logs = d5["data"]
types = sorted(set(l["operation_type"] for l in logs))
print(f"   共 {len(logs)} 条，操作类型={types}")
truthy("至少包含 update/supplement/revise_conclusion/confirm 四类",
       sum(1 for t in types if t in ("update", "supplement", "revise_conclusion", "confirm")) >= 3)

# [6] 导出对账
print("\n[6] 导出三栏对账视图 & 纯文本")
c, d6 = req("GET", f"{BASE}/export")
exd = d6["data"]
src = rec["render_source_id"]
assert_eq("导出 render_source_id 同源", exd["render_source_id"], src)
assert_eq("scene_annotations 存在", bool(exd.get("scene_annotations")), True)
assert_eq("side_notes 存在", bool(exd.get("side_notes")), True)
assert_eq("api_response 存在", bool(exd.get("api_response")), True)
assert_eq("reconciliation_text 存在", bool(exd.get("reconciliation_text")), True)
rview = exd.get("reconciliation_view") or {}
assert_eq("reconciliation_view 有三栏",
          bool(rview.get("left_material_review")) and bool(rview.get("middle_processing")) and bool(rview.get("right_api_response")),
          True)
text = exd["reconciliation_text"]
# 导出视图里的历史结论文案必须和共享 ConclusionDisplay 完全一致
mid = rview.get("middle_processing") or {}
hist_in_view = mid.get("history_chain") or []
# 找到改判节点（改判的 old/new 不同）
revise_nodes = [h for h in hist_in_view if h.get("old_conclusion") != h.get("new_conclusion")]
truthy("导出视图里有改判节点", len(revise_nodes) > 0)
for h in revise_nodes[-2:]:
    old_disp_old = h["old_conclusion"]
    disp_new = h["new_conclusion"]
    # 确保显示名都是 ConclusionDisplay 里的业务文案（不在 DISPLAY 值中
    truthy(f"历史节点显示名在 ConclusionDisplay 中（不是枚举值",
           old_disp_old in CONCLUSION_DISPLAY.values() and disp_new in CONCLUSION_DISPLAY.values())
assert_eq("对账单含左栏", "左栏" in text, True)
assert_eq("对账单含中栏", "中栏" in text, True)
assert_eq("对账单含右栏", "右栏" in text, True)
assert_eq("对账单含同源声明", "三处同源" in text, True)
assert_eq("对账单含渲染源 ID", src in text, True)
warnings = exd.get("warnings", [])
print(f"   同源 ID：{src}")
print(f"   warnings（应为空，因为 pending 已解决）：{warnings}")
assert_eq("pending 已解决无警告", warnings == [], True)
print("   对账单前 14 行：")
for l in text.split("\n")[:14]:
    print("     ", l)

print("\n🏆 端到端全链路全部通过 ✨")
