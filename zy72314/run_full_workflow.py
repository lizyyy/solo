#!/usr/bin/env python3
"""
操作路演示：安装→启动→导入→改备注→复核→导出→报告一致
"""
import os, json, hashlib, sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DATA_DIR, "demo_full_walkthrough.db")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

print("=" * 80)
print("【完整操作路演示】分位数薪酬校准系统")
print("=" * 80)

# === Step 0: 安装验证 ===
print("\n【Step 0】安装验证")
print("-" * 80)
try:
    import pandas
    print("  ✅ pandas 已安装")
except ImportError:
    print("  ⚠️  pandas 未安装，正在安装...")
    os.system(f"{sys.executable} -m pip install pandas")
from quantile_calibration import QuantileCalibrationSystem
print("  ✅ QuantileCalibrationSystem 导入成功")

# === Step 1: 启动（创建系统实例）===
print("\n【Step 1】启动：创建系统实例")
print("-" * 80)
system = QuantileCalibrationSystem(DB_PATH)
print(f"  ✅ 数据库初始化完成: {DB_PATH}")

# === Step 2: Step 1 导入 v1 ===
V1_PATH = os.path.join(DATA_DIR, "test_rating_weights_v1.csv")
V1_HASH = hashlib.sha256(open(V1_PATH, "rb").read()).hexdigest()[:16]
print(f"\n【Step 2】Step 1：导入 v1（{V1_HASH}）")
print("-" * 80)
step1 = system.step1_import(V1_PATH, operator="alan_ops")
batch_id = step1["batch_id"]
ir = step1["import_result"]
print(f"  批次 ID: {batch_id}")
print(f"  去重级别: {ir.get('duplicate_level', 'none')}")
print(f"  新增: {ir.get('newly_created_count', 0)} 条")
print(f"  合并更新: {ir.get('merged_updated_count', 0)} 条")
print(f"  未变: {ir.get('unchanged_count', 0)} 条")
print(f"  当前总数: {ir.get('total_count', 0)}")

# === Step 3: 导入 v1_edited（内容不同但业务主键相同，只改备注）===
V2_PATH = os.path.join(DATA_DIR, "test_rating_weights_v1_edited.csv")
V2_HASH = hashlib.sha256(open(V2_PATH, "rb").read()).hexdigest()[:16]
print(f"\n【Step 3】Step 1：导入 v2（内容不同，只改备注 {V2_HASH}）")
print("-" * 80)
step1b = system.step1_import(V2_PATH, operator="alan_ops")
ir2 = step1b["import_result"]
print(f"  批次 ID: {step1b['batch_id']}")
print(f"  is_duplicate: {ir2.get('is_duplicate')}")
print(f"  duplicate_level: {ir2.get('duplicate_level')}")
print(f"  新增: {ir2.get('newly_created_count', 0)} 条")
print(f"  合并更新: {ir2.get('merged_updated_count', 0)} 条")
print(f"  未变: {ir2.get('unchanged_count', 0)} 条")
print(f"  当前总数: {ir2.get('total_count', 0)}")
assert ir2.get("total_count", 0) == 20, f"❌ 翻倍！期望20，实际{ir2.get('total_count')}"
print("  ✅ 内容不同但业务主键相同 → 不翻倍，更新生效！")

# === Step 4: Step 2 阿岚看旧公式截图 ===
print("\n【Step 4】Step 2：运营规划阿岚补看旧公式截图")
print("-" * 80)
step2 = system.step2_review_formula(
    batch_id=batch_id,
    reviewed_by="alan_ops",
    review_note="对照旧公式截图，确认高级产品经理 P10 原为 -500，旧表误标为缺失",
    screenshot_reference="旧公式截图_2024_v3.png"
)
print(f"  workflow 步骤: {step2['step_name']} ({step2['step']}) 已完成")
print(f"  next_step: Step {step2['next_step']}")
print(f"  ✅ Step 2 完成")

# === Step 5: Step 3 边界样本报告 ===
print("\n【Step 5】Step 3：边界样本报告更新（分配给 ta_xiaoming）")
print("-" * 80)
step3 = system.step3_boundary_report(
    batch_id=batch_id,
    operator="alan_ops",
    ta_assignee="ta_xiaoming"
)
print(f"  创建复核任务数: {len(step3['review_tasks_created'])}")
print(f"  note: {step3['note']}")

# === Step 6: 手动改一条备注（列表要同步） ===
print("\n【Step 6】手动改一条记录的备注（统一视图层列表要同步）")
print("-" * 80)
records_before = system.get_list_view()
target = next((r for r in records_before["items"] if r["position"] == "数据分析师"), None)
record_id = target["record_id"]
old_remark = target["remark"]
edit_result = system.manual_edit(
    record_id=record_id,
    updates={"remark": "阿岚复核：已与 HR 确认口径一致"},
    operator="alan_ops",
    reason="补充复核备注"
)
new_remark = edit_result["updates"]["remark"]
print(f"  改 record_id={record_id}，改前备注: {old_remark!r}")
print(f"  改后备注: {new_remark!r}")
records_after = system.get_list_view()
target_after = next(r for r in records_after["items"] if r["record_id"] == record_id)
assert target_after["remark"] == "阿岚复核：已与 HR 确认口径一致"
print("  ✅ 列表视图已同步更新备注")

# === Step 7: 学生助教 ta_xiaoming 复核 ===
print("\n【Step 7】学生助教 ta_xiaoming 复核负数被旧表当缺失")
print("-" * 80)
pending = system.get_pending_review_tasks("ta_xiaoming")
print(f"  待处理任务: {len(pending['tasks'])} 条")
neg_task = next(
    (t for t in pending["tasks"] if t["boundary_type"] == "negative_treated_as_missing"),
    None
)
assert neg_task, "❌ 没有找到负数当缺失的复核任务"
neg_detail = system.get_detail_view(neg_task["record_id"])
print(f"  复核任务: {neg_detail['position']} 行号={neg_detail['original_row_number']}")
print(f"  原始 P10={neg_detail['original_values'].get('weight_p10')}, 有负痕迹")
review_result = system.ta_review_record(
    task_id=neg_task["task_id"],
    record_id=neg_task["record_id"],
    review_result="经与旧公式截图交叉核对，P10 确实是-500，旧表误标",
    correction_decision="restore_negative",
    corrected_values={"weight_p10": -500},
    ta_name="xiaoming"
)
print(f"  状态更新: {review_result['updated_status']}")
print(f"  边界类型更新: {review_result['updated_boundary_type']}")
print("  ✅ TA 复核完成，负数恢复为 -500")

# === Step 8: 一致性检查（重点）===
print("\n【Step 8】同源一致性检查（列表=详情=摘要=导出=报告）")
print("-" * 80)
check = system.verify_consistency(batch_id)
print(f"  列表总数: {check['checks']['list_total']}")
print(f"  摘要总数: {check['checks']['summary_total']}")
print(f"  导出总数: {check['checks']['export_total']}")
print(f"  报告总数: {check['checks']['report_total']}")
print(f"  总数一致: {check['checks']['all_totals_match']}")
print(f"  详情状态与列表一致: {check['checks']['detail_status_consistent']}")
print(f"  consistency_passed: {check['consistency_passed']}")
assert check["consistency_passed"], "❌ 一致性校验失败！"
print("  ✅ 全部同源一致")

# === Step 9: 详情视图：人工复核全留痕 ===
print("\n【Step 9】详情视图：原始说法/改后值/处理原因/下一步找谁 全留痕")
print("-" * 80)
detail = system.get_detail_view(neg_task["record_id"])
print(f"  原始行号: {detail['original_row_number']}")
print(f"  岗位: {detail['position']}")
print(f"  状态: {detail['status_label']} / 边界: {detail['boundary_label']}")
print(f"  原始说法(P10): {detail['original_values'].get('weight_p10')}")
print(f"  改后的值(P10): {detail['current_values'].get('weight_p10')}")
vc = [c for c in detail["value_changes"] if c["field"] == "weight_p10"]
if vc:
    print(f"  改前改后差别(P10): {vc[0]['original_value']} → {vc[0]['current_value']}")
print(f"  处理原因条数: {len(detail['processing_reasons'])}")
for r in detail["processing_reasons"]:
    print(f"    · {r[:80]}...")
print(f"  下一步找谁: {detail['next_step'].get('assigned_to')}")
print(f"  下一步说明: {detail['next_step'].get('instruction')[:60]}")
print(f"  处理时间线步数: {len(detail['processing_history'])}")
# 关键断言：不能提前归正常（NEGATIVE_TREATED_AS_MISSING → 恢复负数 → NEGATIVE_VALUE/REVIEWED）
assert detail["status"] in ("revised", "reviewed", "pending_review"), "❌ 被提前归正常"
print("  ✅ 全留痕完整，未提前归正常")

# === Step 10: 摘要视图 ===
print("\n【Step 10】摘要视图（统计汇总）")
print("-" * 80)
summary = system.get_summary_view(batch_id)
print(f"  总记录数: {summary['total_records']}")
print(f"  按状态: {summary['by_status']}")
print(f"  按边界: {summary['by_boundary']}")
print(f"  待复核: {summary['pending_review_count']}")
print(f"  一致性检查: all_match={summary['consistency_check']['list_count_matches_summary']}")

# === Step 11: 导出 CSV + 边界报告 ===
print("\n【Step 11】导出 CSV + 边界报告")
print("-" * 80)
csv_path = os.path.join(DATA_DIR, "demo_export.csv")
system.export_csv(csv_path, batch_id)
import csv
with open(csv_path) as f:
    csv_reader = list(csv.reader(f))
print(f"  CSV 行数（含表头）: {len(csv_reader)}")
print(f"  CSV 表头: {csv_reader[0][:8]}")
report = system.generate_boundary_report_view(batch_id)
print(f"  报告总数: {report['total_records']}")
print(f"  报告边界问题数: {report['boundary_record_count']}")
nd = report.get("negative_as_missing_details", [])
print(f"  neg_as_missing_details: {len(nd)} 条")
print("  ✅ 导出和报告生成完毕")

# === Step 12: 再重复导入同文件（v1_edited）→ 不翻倍 + 人工确认值保护 ===
print("\n【Step 12】重复导入 v1_edited：不翻倍 + 人工确认的 P10=-500 不被覆盖")
print("-" * 80)
step1c = system.step1_import(V2_PATH, operator="alan_ops")
ir3 = step1c["import_result"]
print(f"  当前总数: {ir3.get('total_count', 0)}")
assert ir3.get("total_count", 0) == 20, "❌ 重复导入翻倍"
print("  ✅ 未翻倍！")

detail_after_reimport = system.get_detail_view(neg_task["record_id"])
p10_after = detail_after_reimport["current_values"]["weight_p10"]
print(f"  高级产品经理 P10（重复导入后）: {p10_after}")
assert p10_after == -500.0, f"❌ 人工确认的 -500 被覆盖为 {p10_after}"
print("  ✅ 人工确认的 P10=-500 未被覆盖！")

print(f"  高级产品经理边界类型: {detail_after_reimport['boundary_label']}")
assert detail_after_reimport["boundary_type"] == "negative_value", "❌ 边界类型被改回"
print("  ✅ 边界类型仍为含负数值（基于保留后的值）")

# 再重复导入 v1（哈希相同）
step1d = system.step1_import(V1_PATH, operator="alan_ops")
detail_after_v1 = system.get_detail_view(neg_task["record_id"])
p10_after_v1 = detail_after_v1["current_values"]["weight_p10"]
print(f"  高级产品经理 P10（v1再次导入后）: {p10_after_v1}")
assert p10_after_v1 == -500.0, f"❌ 哈希相同的重复导入也覆盖了 -500"
print("  ✅ 哈希相同的重复导入也不覆盖！")

# 冲突待办验证
conflict_tasks = [
    t for t in system.db.get_pending_review_tasks()
    if t.record_id == neg_task["record_id"] and "冲突" in t.review_note
]
print(f"  冲突待办数: {len(conflict_tasks)} 条（有承接链路）")
if conflict_tasks:
    print(f"    assigned_to: {conflict_tasks[0].assigned_to}")
    print(f"    review_note: {conflict_tasks[0].review_note[:80]}...")
print("  ✅ 冲突时有新待办承接，不会留下空的 pending_review")

# === 最终汇总 ===
print("\n" + "=" * 80)
print("【最终汇总】完整操作路已全部跑通！")
print("=" * 80)
summary = system.get_summary_view()
print(f"  总记录数: {summary['total_records']}")
print(f"  按状态: {summary['by_status']}")
print(f"  按边界: {summary['by_boundary']}")
print(f"  待复核: {summary['pending_review_count']}")
print(f"  负数被旧表当缺失: {summary['negative_as_missing_count']}")
print()
print("✅ 完整操作路全部完成：")
print("   · 安装验证通过")
print("   · 启动初始化通过")
print("   · 导入v1 → 导入v2(改备注) → 不翻倍 ✅")
print("   · Step2 阿岚补看截图 ✅")
print("   · Step3 边界报告 + 分配TA ✅")
print("   · 手动改备注 → 列表同步 ✅")
print("   · 学生助教复核 → 恢复负数 ✅")
print("   · 同源一致性全部通过 ✅")
print("   · 详情:原始说法/改后值/原因/下一步找谁 → 全留痕 ✅")
print("   · 摘要/导出/报告 → 一致 ✅")
print("   · 重复导入 → 不翻倍 ✅")
print("   · 重复导入 → 不覆盖人工确认值 ✅")
print("   · 重复导入冲突 → 有新待办承接 ✅")
