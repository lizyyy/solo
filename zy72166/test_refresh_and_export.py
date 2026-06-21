#!/usr/bin/env python3
"""
口袋公园日照复核 —— 第二轮修复完整验证脚本
覆盖：补备注 → 继续导入 → 刷新核对 → 导出
同时验证：/review /merge /import /export 直接入口/刷新都不再停留在"加载中..."

用法:
  1. 确保后端运行在 http://localhost:3001 （data/ 下有示范项目最好，没有脚本会自动 seed）
  2. python3 test_refresh_and_export.py
"""
import json
import sys
import urllib.request
import urllib.error
import urllib.parse

BASE = "http://localhost:3001"
OPERATOR = "验证脚本-小赵"

def http(method, path, body=None):
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"error": raw}
    except Exception as e:
        return 0, {"error": str(e)}

def expect(cond, msg):
    if not cond:
        print(f"❌ FAIL: {msg}")
        sys.exit(1)
    print(f"  ✅ {msg}")

print("=" * 60)
print("步骤 0: 健康检查，必要时创建示范项目")
print("=" * 60)
code, health = http("GET", "/api/health")
expect(code == 200 and health.get("success"), f"后端健康检查 (code={code})")

code, projects = http("GET", "/api/projects")
expect(code == 200 and projects.get("success"), "获取项目列表成功")
project_list = projects.get("data") or []
if not project_list:
    print("  项目为空，通过 seed 接口创建示范项目...")
    # 先创建项目
    code, cr = http("POST", "/api/projects", {"name": "口袋公园日照复核示范项目"})
    expect(code == 200 and cr.get("success"), "创建项目成功")
    pid = cr["data"]["id"]
    code, seed = http("POST", f"/api/projects/{pid}/seed")
    expect(code == 200 and seed.get("success"), "seed 示范数据成功")
    code, projects = http("GET", "/api/projects")
    project_list = projects.get("data") or []

pid = project_list[0]["id"]
print(f"  使用项目: {pid}  name={project_list[0].get('name')}")

print()
print("=" * 60)
print("步骤 1: 直接 GET /api/projects/:id/reviews, /merge-groups, /precheck, /export")
print("        (模拟浏览器直接打开 /review, /merge, /import, /export 时的 API 调用)")
print("=" * 60)

code, r_reviews = http("GET", f"/api/projects/{pid}/reviews")
expect(code == 200 and r_reviews.get("success"), "直接 GET /reviews 成功，不返回 404/500")
reviews = r_reviews.get("data") or []
expect(isinstance(reviews, list) and len(reviews) > 0, f"reviews 列表非空 ({len(reviews)} 条)")

code, r_merge = http("GET", f"/api/projects/{pid}/merge-groups")
expect(code == 200 and r_merge.get("success"), "直接 GET /merge-groups 成功")
groups = r_merge.get("data") or []
expect(isinstance(groups, list), f"merge-groups 返回数组 ({len(groups)} 组)")

code, r_precheck = http("GET", f"/api/projects/{pid}/precheck")
expect(code == 200 and r_precheck.get("success"), "直接 GET /precheck 成功")
warnings = r_precheck.get("data") or []
expect(isinstance(warnings, list), f"precheck 返回数组 ({len(warnings)} 条预警)")

code, r_export = http("GET", f"/api/projects/{pid}/export")
expect(code == 200 and r_export.get("success"), "直接 GET /export 成功 (空也正常)")

print()
print("=" * 60)
print("步骤 2: 选一条 pending 待核实样例 (建设路口口袋公园/解放大道建设路口)")
print("=" * 60)

pending = [r for r in reviews if r.get("status") in ("pending", "conflict")]
expect(len(pending) > 0, f"存在待核实/待裁决项 ({len(pending)} 条)")

# 优先选"解放大道建设路口"那条（之前修复过的目标样例）
target = None
for r in pending:
    if "解放" in (r.get("address") or "") or "建设路口" in (r.get("location_name") or ""):
        target = r
        break
if target is None:
    target = pending[0]
rid = target["id"]
print(f"  目标 review_id={rid}")
print(f"    location={target.get('location_name')}  address={target.get('address')}")
print(f"    status={target.get('status')}  verdict={target.get('verdict')}")

print()
print("=" * 60)
print("步骤 3: 补录两条复核备注，记录差异依据")
print("=" * 60)

note1 = "第一次补备注：待核实，数据口径存疑。台账写 3.0h，现场实际看起来有遮挡。"
code, r_note1 = http("POST", f"/api/projects/{pid}/reviews/{rid}/notes",
                     {"content": note1, "author": OPERATOR})
expect(200 <= code < 300 and r_note1.get("success"), f"新增备注1成功 (id={str(r_note1.get('data', {}).get('id'))[:8]}...)")

note2 = "第一次补备注：待核实，数据口径存疑。台账写 3.0h，现场实际看起来有遮挡。补充：已与现场照片对比一致，阴影只有上午遮挡。"
code, r_note2 = http("POST", f"/api/projects/{pid}/reviews/{rid}/notes",
                     {"content": note2, "author": OPERATOR})
expect(200 <= code < 300 and r_note2.get("success"), f"新增备注2成功 (id={str(r_note2.get('data', {}).get('id'))[:8]}...)")

diff = r_note2.get("data", {}).get("diff_from_previous") or ""
expect("+" in diff and "-" in diff, f"备注2 diff_from_previous 包含 +/- 差异 ({diff[:80]!r})")

# 再拉一次 diff API 确认
code, r_diff = http("GET", f"/api/projects/{pid}/reviews/{rid}/diff")
expect(code == 200 and r_diff.get("success"), "GET /diff 接口成功")
diff_obj = r_diff.get("data") or {}
diff_content = diff_obj.get("diff") if isinstance(diff_obj, dict) else diff_obj
expect(diff_content and ("+" in diff_content or "-" in diff_content), "diff 接口返回差异内容")

print()
print("=" * 60)
print("步骤 4: 记录两次处理历史 (pending → needs_field_visit → pending)")
print("=" * 60)

code, r_upd1 = http("PUT", f"/api/projects/{pid}/reviews/{rid}", {
    "status": "needs_field_visit",
    "verdict": "需现场复看",
    "reason": "数据口径有疑问，需去现场确认",
    "author": OPERATOR,
})
expect(200 <= code < 300 and r_upd1.get("success"), "pending → needs_field_visit 成功")

code, r_upd2 = http("PUT", f"/api/projects/{pid}/reviews/{rid}", {
    "status": "pending",
    "verdict": "补材料后继续待核实",
    "reason": "现场照片已收集，返回待核实",
    "author": OPERATOR,
})
expect(200 <= code < 300 and r_upd2.get("success"), "needs_field_visit → pending 成功")

code, r_hist = http("GET", f"/api/projects/{pid}/reviews/{rid}/history")
expect(code == 200 and r_hist.get("success"), "GET /history 成功")
hist = r_hist.get("data") or []
expect(len(hist) >= 2, f"至少 2 条历史记录 (实际 {len(hist)} 条)")
print(f"    历史: {[h['old_status']+'→'+h['new_status'] for h in hist]}")

print()
print("=" * 60)
print("步骤 5: 追加导入一小包新材料 (触发 runPrecheck)")
print("=" * 60)

new_records = [
    {"location_name": "樱花苑口袋公园", "address": "樱花路12号",
     "longitude": "114.3120", "latitude": "30.5920",
     "period": "2025年上半年", "sunlight_hours": "2.8",
     "complaint": "日照不足", "remark": "居民投诉A"},
    {"location_name": "海棠口袋公园", "address": "海棠街88号",
     "longitude": "114.3200", "latitude": "30.5950",
     "period": "2025年上半年", "sunlight_hours": "3.3",
     "complaint": "", "remark": "新增材料B"},
]
code, r_import = http("POST", f"/api/projects/{pid}/import",
                      {"source": "sunlight", "records": new_records})
expect(200 <= code < 300 and r_import.get("success"), "追加导入 2 条新材料成功")
print(f"    导入结果: {r_import.get('data')}")

print()
print("=" * 60)
print("步骤 6: 刷新 - 重新拉取 reviews/merge/diff/history，核对历史未丢失")
print("=" * 60)

code, r2 = http("GET", f"/api/projects/{pid}/reviews")
reviews2 = r2.get("data") or []
target2 = next((r for r in reviews2 if r["id"] == rid), None)
expect(target2 is not None, "刷新后目标 review_item 仍然存在 (未被 runPrecheck 删除)")
expect(target2.get("status") == "pending", f"刷新后 status 仍为 pending (实际 {target2.get('status')})")
expect(target2.get("verdict") == "补材料后继续待核实",
       f"刷新后 verdict 保留 (实际 {target2.get('verdict')!r})")
notes2 = target2.get("notes") or []
expect(len(notes2) >= 2, f"刷新后至少 2 条备注 (实际 {len(notes2)})")
print(f"    最新备注: {(notes2[0].get('content') if notes2 else '')[:60]}")

# diff
code, r_diff2 = http("GET", f"/api/projects/{pid}/reviews/{rid}/diff")
diff2_obj = r_diff2.get("data") or {}
diff2 = diff2_obj.get("diff") if isinstance(diff2_obj, dict) else diff2_obj
expect(diff2 and ("+" in diff2 or "-" in diff2), "刷新后 diff 接口仍返回差异内容")

# history
code, r_hist2 = http("GET", f"/api/projects/{pid}/reviews/{rid}/history")
hist2 = r_hist2.get("data") or []
expect(len(hist2) >= 2, f"刷新后至少 2 条历史 (实际 {len(hist2)})")

# merge-groups 刷新后仍存在
code, r_merge2 = http("GET", f"/api/projects/{pid}/merge-groups")
expect(code == 200 and r_merge2.get("success"), "刷新后 merge-groups 正常返回")

print()
print("=" * 60)
print("步骤 7: 生成公示清单并导出，核对三级分类和交接备注")
print("=" * 60)

code, r_gen = http("POST", f"/api/projects/{pid}/export/generate", {"operator": OPERATOR})
expect(200 <= code < 300 and r_gen.get("success"), "生成公示清单成功")
items = r_gen.get("data") or []
expect(len(items) > 0, f"导出条目非空 ({len(items)} 条)")

target_export = None
for it in items:
    if it.get("location_name") == target.get("location_name") and it.get("address") == target.get("address"):
        target_export = it
        break
expect(target_export is not None, "目标样例出现在导出清单中")
category = target_export.get("category")
expect(category in ("pending_verification",),
       f"目标样例分类为 pending_verification (实际 {category})")
expect("待核实" in (target_export.get("judgment_basis") or ""),
       f"判定依据含'待核实' (实际 {target_export.get('judgment_basis')!r})")

handover = target_export.get("handover_note") or ""
expect(len(handover) > 10, f"交接备注保留了补录内容 (长度={len(handover)}  前60字={handover[:60]!r})")

# 分类分布
cats = {}
for it in items:
    cats[it.get("category")] = cats.get(it.get("category"), 0) + 1
print(f"    分类分布: {cats}")
expect("pending_verification" in cats or "processed" in cats or "needs_field_visit" in cats,
       "导出清单至少包含一个三级分类")

print()
print("=" * 60)
print("步骤 8: 核对 /export/csv 可下载")
print("=" * 60)

req = urllib.request.Request(BASE + f"/api/projects/{pid}/export/csv")
with urllib.request.urlopen(req, timeout=15) as resp:
    csv_bytes = resp.read()
expect(len(csv_bytes) > 100, f"CSV 下载内容长度合理 ({len(csv_bytes)} bytes)")
expect(b"location_name" in csv_bytes or "\u70b9\u4f4d\u540d\u79f0".encode("utf-8") in csv_bytes,
       "CSV 含表头（点位名称 / location_name）")
expect(b"pending_verification" in csv_bytes or "\u5f85\u6838\u5b9e".encode("utf-8") in csv_bytes,
       "CSV 含待核实分类")

print()
print("=" * 60)
print("✅ 全部后端验证通过 —— 备注/差异/历史/归并/导出 完整保留")
print("=" * 60)
print()
print("接下来请在浏览器手动确认（或由自动化工具验证）：")
print("  1. 直接打开 http://localhost:5173/review  —— 刷新/直接打开都不再卡'加载中...'")
print("  2. 直接打开 http://localhost:5173/merge   —— 同上")
print("  3. 直接打开 http://localhost:5173/import  —— 同上")
print("  4. 直接打开 http://localhost:5173/export  —— 同上")
print("  5. 点进建设路口口袋公园(解放大道)那条 —— 能看到两条备注 + 差异对比 + 两条处理历史")
print("  6. 生成公示清单 —— 待核实分类里包含这条样例，交接备注有补录的文字")
