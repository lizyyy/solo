#!/usr/bin/env python3
"""猫砂盆异常记录复核 - 全场景集成测试"""
import json, urllib.request, urllib.parse

BASE = "http://127.0.0.1:5001"

def http(path, method="GET", body=None):
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def assert_eq(name, a, b):
    ok = a == b
    sym = "✅" if ok else "❌"
    print(f"  {sym} {name}: {a} == {b}" if ok else f"  ❌ {name}: 期望 {b}, 实际 {a}")
    if not ok:
        raise AssertionError(name)

print("\n" + "="*60)
print("场景 1: 装载演示数据，验证混入材料的来源分类")
print("="*60)
res = http("/api/seed", "POST", {})
print(f"  导入结果: {json.dumps(res, ensure_ascii=False)}")
records = http("/api/records")
print(f"  总记录数: {len(records)}")
assert_eq("总记录数应为 3（奶糖/橘座/橘子去重后）", len(records), 3)

# 检查材料类型分布
type_count = {}
affects_count = 0
for r in records:
    for m in r["materials"]:
        type_count[m["material_type"]] = type_count.get(m["material_type"], 0) + 1
        if m["affects_conclusion"]:
            affects_count += 1
print(f"  材料类型分布: {type_count}")
assert_eq("应包含寄养登记表旧版材料", "OLD_FOSTER_FORM" in type_count, True)
assert_eq("应包含名称写法不一致材料", "NAME_INCONSISTENT" in type_count, True)
assert_eq("应包含口头备注材料", "ORAL_NOTE" in type_count, True)
assert_eq("应包含正常材料", "NORMAL" in type_count, True)
print(f"  标记为「影响结论」的材料数: {affects_count}")

# 检查口头备注被写入 manual_notes
oral_note_count = sum(len(r["notes"]) for r in records)
assert_eq("口头备注应被记录为 manual_notes（2条）", oral_note_count >= 2, True)

print("\n" + "="*60)
print("场景 2: 重复导入 → 正常记录不翻倍，人工备注不被覆盖")
print("="*60)
before_records = http("/api/records")
before_notes_total = sum(len(r["notes"]) for r in before_records)
print(f"  重复导入前: 记录数={len(before_records)}, 备注数={before_notes_total}")

# 再次用相同材料导入
dup_items = [
    {"cat_name": "奶糖", "foster_no": "F2026-001",
     "litter_box_issue": "连续2天未使用猫砂盆，疑似便秘",
     "vaccine_date": "2026-03-15", "source_name": "寄养登记表-20260601.xlsx"},
    {"cat_name": "奶糖", "foster_no": "F2026-001",
     "litter_box_issue": "连续2天未使用猫砂盆，疑似便秘",
     "vaccine_date": "2026-03-15",
     "source_name": "口头沟通-阿宁", "is_oral": True,
     "oral_note": "阿宁口述：早上看到奶糖去过砂盆，可能只是不爱动",
     "author": "阿宁"},
]
res2 = http("/api/import", "POST", {"items": dup_items, "operator": "测试", "remark": "重复导入验证"})
print(f"  重复导入结果: {json.dumps(res2, ensure_ascii=False)}")
after_records = http("/api/records")
after_notes_total = sum(len(r["notes"]) for r in after_records)
print(f"  重复导入后: 记录数={len(after_records)}, 备注数={after_notes_total}")
assert_eq("记录数不应翻倍", len(after_records), len(before_records))
assert_eq("人工备注数不应增加（被覆盖保护）", after_notes_total, before_notes_total)
assert_eq("skipped_duplicate 应 >= 1", res2["skipped_duplicate"] >= 1, True)

print("\n" + "="*60)
print("场景 3: 接口查状态 vs 导出截图说明一致性")
print("="*60)
records_api = http("/api/records")
exported = http("/api/export")
print(f"  接口记录数={len(records_api)}, 导出记录数={len(exported)}")

mismatch = 0
for r in records_api:
    rid = r["id"]
    api_status = r["status"]
    api_note = r.get("screenshot_note", "")
    exp = next((e for e in exported if e["record_id"] == rid and e["record_version"] == r["version"]), None)
    if not exp:
        print(f"  ⚠️  记录 #{rid} 无对应导出快照")
        mismatch += 1
        continue
    exp_status = exp["status"]
    exp_note = exp["screenshot_note"]
    if api_status != exp_status or api_note != exp_note:
        print(f"  ❌ 记录 #{rid}: API=({api_status},{api_note}) vs 导出=({exp_status},{exp_note})")
        mismatch += 1
    else:
        print(f"  ✅ 记录 #{rid} ({r['cat_name']}): 状态={api_status}, 截图说明一致")
assert_eq("所有记录接口状态与导出截图说明一致", mismatch, 0)

print("\n" + "="*60)
print("场景 4: 疫苗日期缺失单独拎出")
print("="*60)
vac_records = http("/api/records?vaccine_missing_only=1")
print(f"  疫苗缺失专区记录数: {len(vac_records)}")
assert_eq("应只有 1 条疫苗缺失记录（橘子）", len(vac_records), 1)
vac = vac_records[0]
print(f"  缺失记录: 猫名={vac['cat_name']}, 疫苗日期={vac['vaccine_date']!r}, 状态={vac['status']}")
assert_eq("状态应为 VACCINE_MISSING", vac["status"], "VACCINE_MISSING")
assert_eq("is_vaccine_missing 应为 1", vac["is_vaccine_missing"], 1)

# 确保疫苗记录不在正常状态的列表里（被拎出）
normal_list = http("/api/records?status=CONFIRMED_NORMAL")
pending_list = http("/api/records?status=PENDING")
abn_list = http("/api/records?status=CONFIRMED_ABNORMAL")
assert_eq("正常/待复核/异常状态中不应含有疫苗缺失记录（它们在 VACCINE_MISSING 状态里）",
          any(r["is_vaccine_missing"] for r in normal_list + pending_list + abn_list), False)

print("\n" + "="*60)
print("场景 5: 重跑 — 保留备注、状态、截图说明关联不断线")
print("="*60)
batches = http("/api/batches")
first_batch = batches[-1]
print(f"  选择重跑批次 #{first_batch['id']} ({first_batch['batch_no']})")

# 先给记录加一条人工备注
test_record = records_api[0]
note_res = http(f"/api/records/{test_record['id']}/notes", "POST",
                {"content": "项目经理测试备注：应在重跑后保留", "author": "项目经理"})
print(f"  添加人工备注: {note_res}")

# 状态变更一下
st_res = http(f"/api/records/{test_record['id']}/status", "PUT",
              {"status": "CONFIRMED_ABNORMAL", "operator": "项目经理"})
print(f"  变更状态: {st_res}")

# 重跑前快照
before_detail = http(f"/api/records/{test_record['id']}")
before_snapshot_count = len(before_detail["snapshots"])
before_note_count = len(before_detail["notes"])
print(f"  重跑前: 版本 v{before_detail['version']}, 快照 {before_snapshot_count} 条, 备注 {before_note_count} 条")

rerun_res = http(f"/api/batches/{first_batch['id']}/rerun", "POST", {"operator": "测试重跑"})
print(f"  重跑结果: {json.dumps(rerun_res, ensure_ascii=False)}")

after_detail = http(f"/api/records/{test_record['id']}")
after_snapshot_count = len(after_detail["snapshots"])
after_note_count = len(after_detail["notes"])
print(f"  重跑后: 版本 v{after_detail['version']}, 快照 {after_snapshot_count} 条, 备注 {after_note_count} 条")

assert_eq("版本号应 +1", after_detail["version"], before_detail["version"] + 1)
assert_eq("备注条数不应减少（人工备注被保留）", after_note_count >= before_note_count, True)
assert_eq("快照条数应 >= 重跑前（新状态生成新快照，旧快照保留）",
          after_snapshot_count >= before_snapshot_count, True)

# 验证最新快照关联了材料和备注
latest_snap = after_detail["snapshots"][-1]
print(f"  最新快照: 状态={latest_snap['status']}, 截图说明={latest_snap['screenshot_note']}")
print(f"    关联材料ID: {latest_snap['affected_material_ids']}")
print(f"    关联备注ID: {latest_snap['linked_note_ids']}")
assert_eq("最新快照应关联影响结论的材料", len(json.loads(latest_snap["affected_material_ids"] or "[]")) >= 1, True)

print("\n" + "="*60)
print("场景 6: 来源追溯 — 分清哪份材料影响了结论")
print("="*60)
detail = http(f"/api/records/{test_record['id']}")
for m in detail["materials"]:
    mark = "⚡ 影响结论" if m["affects_conclusion"] else "  参考材料"
    print(f"  {mark} | 类型={m['material_type']:<18} | 来源={m['source_name']}")
affected = [m for m in detail["materials"] if m["affects_conclusion"]]
assert_eq("该记录应有 >=1 份被标记为「影响结论」的材料（旧版/名称不一致等）", len(affected) >= 1, True)

print("\n" + "="*60)
print("额外验证: 项目经理 Dashboard 统计")
print("="*60)
dash = http("/api/dashboard")
print(f"  {json.dumps(dash, ensure_ascii=False, indent=2)}")
assert_eq("Dashboard 应有 total_batches >= 1", dash["total_batches"] >= 1, True)
assert_eq("Dashboard vaccine_missing 应为 1", dash["vaccine_missing"], 1)

print("\n🎉 全部 6 个场景验证通过！")
print("="*60)
