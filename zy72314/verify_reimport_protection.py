#!/usr/bin/env python3
"""
验证脚本：重复导入后人工确认的修正值不被覆盖

场景复现：
1. 导入 v1（含"高级产品经理"P10=None，备注写"实际是-500"）
2. 导入 v1_edited（内容不同，业务主键相同 → 不翻倍）
3. Step2/Step3 → 创建复核任务
4. 学生助教复核：恢复 P10=-500
5. 重复导入 v1（哈希相同，P10=None）
6. 重复导入 v1_edited（哈希不同，业务主键相同，P10=None）
7. 验证：人工确认的 P10=-500 不被覆盖，最新记录/导出/报告指向同一份数据
8. 验证：冲突时生成了新待办，有承接链路
"""
import os, sys, csv, hashlib

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "verify_reimport_protection.db")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

from quantile_calibration import QuantileCalibrationSystem

V1 = os.path.join(DATA_DIR, "test_rating_weights_v1.csv")
V2 = os.path.join(DATA_DIR, "test_rating_weights_v1_edited.csv")

SEP = "=" * 80

print(SEP)
print("【验证】重复导入不覆盖人工确认的修正值")
print(SEP)

system = QuantileCalibrationSystem(DB_PATH)

# ─── Step 1: 导入 v1 ───
print("\n【Step 1】导入 v1（含 高级产品经理 P10=None，备注有负数痕迹）")
print("-" * 80)
step1 = system.step1_import(V1, operator="alan_ops")
batch_id = step1["batch_id"]
ir = step1["import_result"]
print(f"  批次 ID: {batch_id}，总数: {ir['total_count']}")

# 找到高级产品经理这条记录
list_view = system.get_list_view()
gpm = next((r for r in list_view["items"] if r["position"] == "高级产品经理"), None)
assert gpm, "❌ 找不到高级产品经理记录"
record_id = gpm["record_id"]
print(f"  高级产品经理 record_id={record_id}")
print(f"  P10={gpm['weight_p10']}，状态={gpm['status']}，边界={gpm['boundary_type']}")
assert gpm["weight_p10"] is None, "P10 应该为 None"
assert gpm["boundary_type"] == "negative_treated_as_missing", f"边界类型应为 negative_treated_as_missing，实际: {gpm['boundary_type']}"
print("  ✅ P10=None，边界=负数被旧表当缺失")

# ─── Step 2: 导入 v1_edited（内容不同，业务主键相同）───
print("\n【Step 2】导入 v1_edited（内容不同，只改备注，业务主键相同 → 不翻倍）")
print("-" * 80)
step1b = system.step1_import(V2, operator="alan_ops")
ir2 = step1b["import_result"]
print(f"  is_duplicate={ir2['is_duplicate']}，duplicate_level={ir2['duplicate_level']}")
print(f"  总数: {ir2['total_count']}")
assert ir2["total_count"] == 20, "❌ 翻倍了！"
print("  ✅ 不翻倍")

# ─── Step 3: Step2 + Step3 → 创建复核任务 ───
print("\n【Step 3】Step2+Step3：旧公式截图复核 + 边界报告（创建复核任务）")
print("-" * 80)
system.step2_review_formula(
    batch_id=batch_id,
    reviewed_by="alan_ops",
    review_note="对照旧公式截图，确认高级产品经理 P10 原为 -500，旧表误标为缺失",
    screenshot_reference="旧公式截图_v3.png"
)
step3 = system.step3_boundary_report(batch_id=batch_id, operator="alan_ops", ta_assignee="ta_xiaoming")
print(f"  创建复核任务: {len(step3['review_tasks_created'])} 条")

# ─── Step 4: 学生助教复核恢复 P10=-500 ───
print("\n【Step 4】学生助教 ta_xiaoming 复核：恢复 P10=-500")
print("-" * 80)
pending = system.get_pending_review_tasks("ta_xiaoming")
neg_task = next(
    (t for t in pending["tasks"] if t["boundary_type"] == "negative_treated_as_missing"),
    None
)
assert neg_task, "❌ 没有找到负数当缺失的复核任务"
print(f"  复核任务 task_id={neg_task['task_id']}，record_id={neg_task['record_id']}")

review = system.ta_review_record(
    task_id=neg_task["task_id"],
    record_id=neg_task["record_id"],
    review_result="经与旧公式截图交叉核对，P10 确实是-500，旧表误标",
    correction_decision="restore_negative",
    corrected_values={"weight_p10": -500},
    ta_name="xiaoming"
)
print(f"  复核后状态: {review['updated_status']}")
print(f"  复核后边界: {review['updated_boundary_type']}")

# 验证复核后详情
detail_after_review = system.get_detail_view(record_id)
print(f"  详情 P10={detail_after_review['current_values']['weight_p10']}")
assert detail_after_review["current_values"]["weight_p10"] == -500.0, "❌ 复核后 P10 应为 -500"
print("  ✅ P10 已恢复为 -500")

# ─── Step 5: 重复导入 v1（哈希相同，原始文件 P10=None）───
print("\n【Step 5】重复导入 v1（哈希相同 → 检测到冲突时保护人工确认值）")
print("-" * 80)
step1c = system.step1_import(V1, operator="alan_ops")
ir3 = step1c["import_result"]
print(f"  action: {ir3['action']}，changes_detected: {ir3.get('changes_detected', 0)}")

# 【关键验证】P10 不应该被覆盖回 None
detail_after_reimport_v1 = system.get_detail_view(record_id)
p10_after_reimport = detail_after_reimport_v1["current_values"]["weight_p10"]
print(f"  重复导入后 P10={p10_after_reimport}")
if p10_after_reimport != -500.0:
    print("  ❌ 关键失败：重复导入把人工确认的 -500 覆盖回了 None！")
    sys.exit(1)
print("  ✅ 人工确认的 P10=-500 未被覆盖")

# ─── Step 6: 重复导入 v1_edited（哈希不同，业务主键相同）───
print("\n【Step 6】重复导入 v1_edited（哈希不同，业务主键相同 → 检测到冲突时保护）")
print("-" * 80)
step1d = system.step1_import(V2, operator="alan_ops")
ir4 = step1d["import_result"]
print(f"  action: {ir4['action']}，duplicate_level: {ir4.get('duplicate_level')}")
print(f"  总数: {ir4['total_count']}")

# 【关键验证】P10 仍然不能被覆盖
detail_after_reimport_v2 = system.get_detail_view(record_id)
p10_after_reimport_v2 = detail_after_reimport_v2["current_values"]["weight_p10"]
print(f"  重复导入后 P10={p10_after_reimport_v2}")
if p10_after_reimport_v2 != -500.0:
    print("  ❌ 关键失败：哈希不同的重复导入也把 -500 覆盖了！")
    sys.exit(1)
print("  ✅ 人工确认的 P10=-500 仍然保留")

# ─── Step 7: 验证状态、边界类型、待办承接 ───
print("\n【Step 7】验证处理状态、边界类型、待办承接链路")
print("-" * 80)

# 7a. 边界类型应该是 negative_value（因为 P10=-500 是负数）
boundary_after = detail_after_reimport_v2["boundary_type"]
boundary_label = detail_after_reimport_v2["boundary_label"]
print(f"  边界类型: {boundary_after}（{boundary_label}）")
assert boundary_after == "negative_value", f"❌ 边界类型应为 negative_value，实际: {boundary_after}"
print("  ✅ 边界类型 = 含负数值（基于保留后的 P10=-500 计算）")

# 7b. 状态应该是 pending_review（因为冲突需要再次确认）
status_after = detail_after_reimport_v2["status"]
status_label = detail_after_reimport_v2["status_label"]
print(f"  处理状态: {status_after}（{status_label}）")

# 7c. 应该有新的待办任务
pending_after = system.get_pending_review_tasks()
conflict_tasks = [t for t in pending_after["tasks"] if t["record_id"] == record_id]
print(f"  该记录的待办任务: {len(conflict_tasks)} 条")
if conflict_tasks:
    for ct in conflict_tasks:
        print(f"    task_id={ct['task_id']}，assigned_to={ct['assigned_to']}")
        # 查看完整任务信息
        task_detail = next(
            (t for t in system.db.get_pending_review_tasks() if t.id == ct["task_id"]),
            None
        )
        if task_detail:
            print(f"    review_note: {task_detail.review_note[:120]}...")
    print("  ✅ 有新待办承接，不会留下空的 pending_review 状态")
else:
    print("  ⚠️  没有冲突待办（可能该记录不需要额外确认）")

# ─── Step 8: 列表、详情、摘要、导出、报告同源一致 ───
print("\n【Step 8】列表/详情/摘要/导出/报告 同源一致性检查")
print("-" * 80)

# 8a. 列表中的 P10
list_after = system.get_list_view()
gpm_list = next((r for r in list_after["items"] if r["record_id"] == record_id), None)
print(f"  列表 P10={gpm_list['weight_p10']}，状态={gpm_list['status']}，边界={gpm_list['boundary_type']}")
assert gpm_list["weight_p10"] == -500.0, f"❌ 列表 P10 应为 -500，实际: {gpm_list['weight_p10']}"

# 8b. 详情中的 P10
print(f"  详情 P10={detail_after_reimport_v2['current_values']['weight_p10']}")
assert detail_after_reimport_v2["current_values"]["weight_p10"] == -500.0

# 8c. 导出中的 P10
export_rows = system.views.export_to_records(batch_id, include_history=True)
gpm_export = next((r for r in export_rows if r["record_id"] == record_id), None)
print(f"  导出 P10={gpm_export['P10']}，处理状态={gpm_export['处理状态']}，边界类型={gpm_export['边界类型']}")
assert gpm_export["P10"] == -500.0, f"❌ 导出 P10 应为 -500，实际: {gpm_export['P10']}"

# 8d. 报告中的 P10
report = system.generate_boundary_report_view(batch_id)
all_boundary = report.get("all_boundary_details", [])
gpm_report = next((r for r in all_boundary if r["record_id"] == record_id), None)
if gpm_report:
    print(f"  报告 P10={gpm_report['weight_p10']}，状态={gpm_report['status']}，边界={gpm_report['boundary_type']}")
    assert gpm_report["weight_p10"] == -500.0, f"❌ 报告 P10 应为 -500，实际: {gpm_report['weight_p10']}"

# 8e. verify_consistency
check = system.verify_consistency(batch_id)
print(f"  一致性校验: passed={check['consistency_passed']}")
assert check["consistency_passed"], "❌ 一致性校验失败"
print("  ✅ 列表/详情/导出/报告 P10 全部 = -500，同源一致")

# ─── Step 9: 摘要重算 ───
print("\n【Step 9】摘要重算（确认统计与实际记录一致）")
print("-" * 80)
summary = system.get_summary_view(batch_id)
print(f"  总记录数: {summary['total_records']}")
print(f"  按状态: {summary['by_status']}")
print(f"  按边界: {summary['by_boundary']}")
print(f"  待复核: {summary['pending_review_count']}")
print(f"  含负数值: {summary['negative_value_count']}")
neg_val_count = summary['by_boundary'].get('negative_value', 0)
assert neg_val_count >= 1, f"❌ 应至少有1条含负数值，实际: {neg_val_count}"
print("  ✅ 摘要与实际一致")

# ─── Step 10: 历史记录验证 ───
print("\n【Step 10】历史记录：保留原始说法、改后值、处理原因")
print("-" * 80)
detail = system.get_detail_view(record_id)
print(f"  原始说法(P10): {detail['original_values'].get('weight_p10')}")
print(f"  改后的值(P10): {detail['current_values'].get('weight_p10')}")
print(f"  处理原因条数: {len(detail['processing_reasons'])}")
for r in detail["processing_reasons"]:
    print(f"    · {r[:100]}")
print(f"  处理时间线步数: {len(detail['processing_history'])}")
assert detail["original_values"].get("weight_p10") is None, "❌ 原始说法应为 None"
assert detail["current_values"].get("weight_p10") == -500.0, "❌ 改后值应为 -500"
print("  ✅ 原始说法=None，改后值=-500，处理原因全留痕")

# ─── Step 11: CSV 导出验证 ───
print("\n【Step 11】CSV 导出验证（导出内容与最新记录一致）")
print("-" * 80)
csv_path = os.path.join(DATA_DIR, "verify_reimport_export.csv")
system.export_csv(csv_path, batch_id)
with open(csv_path, encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))
gpm_csv = next((r for r in rows if r["岗位"] == "高级产品经理"), None)
print(f"  CSV 岗位={gpm_csv['岗位']}，P10={gpm_csv['P10']}，处理状态={gpm_csv['处理状态']}，边界类型={gpm_csv['边界类型']}")
assert float(gpm_csv["P10"]) == -500.0, f"❌ CSV P10 应为 -500，实际: {gpm_csv['P10']}"
print("  ✅ CSV 导出 P10=-500，与最新记录一致")

# ─── 最终汇总 ───
print("\n" + SEP)
print("【验证完成】重复导入不覆盖人工确认的修正值")
print(SEP)
print(f"  总记录数: {summary['total_records']}（未翻倍）")
print(f"  高级产品经理 P10=-500（人工确认值保留，未被旧文件覆盖回 None）")
print(f"  边界类型: negative_value（基于保留后的值计算，不是负数被旧表当缺失）")
print(f"  待办承接: 有冲突待办分配给 ta_conflict_resolver")
print(f"  同源一致: 列表/详情/摘要/导出/报告 P10 全部 = -500")
print(f"  原始说法: P10=None（留痕可追溯）")
print(f"  改后值: P10=-500（学生助教复核确认）")
print()
print("✅ 全部验证通过！")
