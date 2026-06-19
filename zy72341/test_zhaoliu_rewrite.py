#!/usr/bin/env python3
"""
赵六(ANS450ba421)不被重跑覆盖验证脚本
验证链路：导入边界值样例 → 补录权重 → 人工修正 → 重跑 → 导出
每一步核对：完整备注、当前状态、误差说明、修改历史
"""
import sys
import os
sys.path.insert(0, '.')

from storage import DataStore
from core import BoundaryChecker, DuplicateDetector, WeightUpdater
from config import Config
from datetime import datetime
import json

PASS = "✅ PASS"
FAIL = "❌ FAIL"

results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, condition, detail))
    print(f"{status}  {name}")
    if detail and not condition:
        print(f"        详情: {detail}")

def print_sep(title=""):
    print()
    print("=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)

store = DataStore()

print_sep("【0/6】 初始化 - 清空旧数据，导入演示答案（触发边界值）")
store._answers = []
store._weights = []
store._error_logs = []
store._save_all()

batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
store.import_answers_from_excel("data/demo_answers.xlsx", batch_id)
all_ans = store.get_all_answers()
zhaoliu = None
for a in all_ans:
    if a.student_name == "赵六" and a.question_id == "Q3":
        zhaoliu = a
        break

check("找到赵六记录", zhaoliu is not None)
if zhaoliu:
    check("初始状态为 BOUNDARY_ALERT", zhaoliu.status == "BOUNDARY_ALERT", f"实际: {zhaoliu.status}")
    check("边界值说明数 = 2", len(zhaoliu.boundary_notes) == 2, f"实际: {len(zhaoliu.boundary_notes)}")
    check("修改历史数 = 0（纯导入还没处理）", len(zhaoliu.revision_history) == 0,
          f"实际: {len(zhaoliu.revision_history)}")
    check("初始备注包含边界值说明", "边界值" in (zhaoliu.notes or ""),
          f"实际: {zhaoliu.notes[:60]}...")

print_sep("【1/6】 补录权重表（第一次权重应用）")
store.import_weights_from_excel("data/demo_weights.xlsx")
weights = store.get_all_weights()
answers = [a for a in store.get_all_answers() if a.status in ("NORMAL", "BOUNDARY_ALERT")]
errors = WeightUpdater.apply_old_standard_update(answers, weights, rerun=False, operator="运营规划阿岚")
store.add_error_logs(errors)
store._save_all()
zhaoliu = store.get_answer_by_id(zhaoliu.id)

check("状态变为 OLD_STANDARD", zhaoliu.status == "OLD_STANDARD", f"实际: {zhaoliu.status}")
check("调整后得分 = 85.0", abs(zhaoliu.adjusted_score - 85.0) < 0.01,
      f"实际: {zhaoliu.adjusted_score}")
check("备注包含 运营规划阿岚备注", "运营规划阿岚" in (zhaoliu.notes or ""),
      f"实际备注: {zhaoliu.notes[:80]}...")
check("修改历史数 = 1（权重补录）", len(zhaoliu.revision_history) == 1,
      f"实际: {len(zhaoliu.revision_history)}")
check("误差说明数 = 1", len(store.get_error_logs_by_answer(zhaoliu.id)) == 1,
      f"实际: {len(store.get_error_logs_by_answer(zhaoliu.id))}")
notes_after_first_apply = zhaoliu.notes

print_sep("【2/6】 人工修正备注（运营规划阿岚解除满分溢出嫌疑）")
store.manual_correct_answer(
    answer_id=zhaoliu.id,
    operator="运营规划阿岚",
    field_name="notes",
    old_value=str(zhaoliu.notes or ""),
    new_value=f"{zhaoliu.notes} 【运营规划阿岚人工修正】满分答案确认为真实高分，内容虽短但要点全部覆盖，给分合理，解除给分溢出嫌疑。",
    reason="人工复核确认满分合理，补充备注说明解除边界值疑虑",
    next_step="归档记录，如学生申诉可提供此备注作为依据",
    next_contact="运营规划阿岚",
)
zhaoliu = store.get_answer_by_id(zhaoliu.id)

check("状态变为 MANUAL_CORRECTED", zhaoliu.status == "MANUAL_CORRECTED",
      f"实际: {zhaoliu.status}")
check("修改历史数 = 2", len(zhaoliu.revision_history) == 2,
      f"实际: {len(zhaoliu.revision_history)}")
check("备注含 '人工修正' 关键词", "人工修正" in (zhaoliu.notes or ""),
      f"实际备注预览: {zhaoliu.notes[-60:]}")
check("备注保留权重补录说明", "评分权重表" in (zhaoliu.notes or ""),
      f"实际备注预览: {zhaoliu.notes[:60]}")
notes_after_correction = zhaoliu.notes
check("人工修正后备注比之前长", len(notes_after_correction) > len(notes_after_first_apply),
      f"前: {len(notes_after_first_apply)} 后: {len(notes_after_correction)}")

print_sep("【3/6】 重跑权重应用（关键验证：人工修不能被覆盖！）")
store.rerun_weight_application(operator="运营规划阿岚", comment="补录权重表后统一重跑")
zhaoliu = store.get_answer_by_id(zhaoliu.id)

check("状态变为 RERUN_DONE（不是回退到 OLD_STANDARD）", zhaoliu.status == "RERUN_DONE",
      f"实际: {zhaoliu.status}")
check("备注仍含 '人工修正'（核心验证！重跑不覆盖）", "人工修正" in (zhaoliu.notes or ""),
      f"实际备注: {zhaoliu.notes}")
check("备注仍含 '评分权重表补录'（历史不丢）", "补录" in (zhaoliu.notes or ""),
      f"实际备注预览: {zhaoliu.notes[:60]}")
check("备注含 '重跑' 关键词（新内容追加）", "重跑" in (zhaoliu.notes or ""),
      f"实际备注预览: {zhaoliu.notes[-80:]}")
check("修改历史数 = 3（补录+修正+重跑）", len(zhaoliu.revision_history) == 3,
      f"实际: {len(zhaoliu.revision_history)}")
check("第1条历史 old_value 为 NORMAL/边界相关",
      "NORMAL" in zhaoliu.revision_history[0]["old_value"] or "边界" in zhaoliu.revision_history[0]["old_value"],
      f"实际: {zhaoliu.revision_history[0]['old_value']}")
check("最新一条历史 old_value 含 MANUAL_CORRECTED 或 人工已修正",
      "人工已修正" in zhaoliu.revision_history[-1]["old_value"] or "MANUAL_CORRECTED" in zhaoliu.revision_history[-1]["old_value"],
      f"实际: {zhaoliu.revision_history[-1]['old_value']}")
check("最新一条历史 new_value 含 RERUN_DONE 或 重跑已完成",
      "重跑已完成" in zhaoliu.revision_history[-1]["new_value"] or "RERUN_DONE" in zhaoliu.revision_history[-1]["new_value"],
      f"实际: {zhaoliu.revision_history[-1]['new_value']}")
check("重跑次数 = 2", zhaoliu.rerun_count == 2, f"实际: {zhaoliu.rerun_count}")
check("误差说明数 = 2（补录1 + 重跑1）", len(store.get_error_logs_by_answer(zhaoliu.id)) == 2,
      f"实际: {len(store.get_error_logs_by_answer(zhaoliu.id))}")

notes_after_rerun = zhaoliu.notes
check("重跑后备注比人工修正后更长", len(notes_after_rerun) > len(notes_after_correction),
      f"修正后: {len(notes_after_correction)} 重跑后: {len(notes_after_rerun)}")

print_sep("【4/6】 第二次重跑（再验证累积性）")
store.rerun_weight_application(operator="运营规划阿岚", comment="第二次重跑验证")
zhaoliu = store.get_answer_by_id(zhaoliu.id)

check("状态仍为 RERUN_DONE", zhaoliu.status == "RERUN_DONE", f"实际: {zhaoliu.status}")
check("备注仍含 '人工修正'（再验证不覆盖）", "人工修正" in (zhaoliu.notes or ""))
check("修改历史数 = 4", len(zhaoliu.revision_history) == 4,
      f"实际: {len(zhaoliu.revision_history)}")
check("重跑次数 = 3", zhaoliu.rerun_count == 3, f"实际: {zhaoliu.rerun_count}")
check("误差说明数 = 3", len(store.get_error_logs_by_answer(zhaoliu.id)) == 3,
      f"实际: {len(store.get_error_logs_by_answer(zhaoliu.id))}")

print_sep("【5/6】 导出 Excel 报告，核对答案明细中赵六记录")
report_path = store.export_report()

import pandas as pd
xls = pd.ExcelFile(report_path)
df_answers = pd.read_excel(report_path, sheet_name="答案明细")
df_revisions = pd.read_excel(report_path, sheet_name="修改历史明细")
df_errors = pd.read_excel(report_path, sheet_name="误差说明明细")

zhaoliu_row = df_answers[df_answers["记录ID"] == zhaoliu.id].iloc[0]
check("导出答案明细中找到赵六", len(zhaoliu_row) > 0)
check("导出备注含 '人工修正'（导出也不丢）", "人工修正" in str(zhaoliu_row["备注"]),
      f"实际: {str(zhaoliu_row['备注'])[:100]}...")
check("导出状态为 RERUN_DONE 或 重跑已完成",
      "重跑" in str(zhaoliu_row["状态说明"]) or "RERUN" in str(zhaoliu_row["状态"]),
      f"实际: {zhaoliu_row['状态']} / {zhaoliu_row['状态说明']}")

zhaoliu_revisions = df_revisions[df_revisions["记录ID"] == zhaoliu.id]
check("导出修改历史数 = 4", len(zhaoliu_revisions) == 4,
      f"实际: {len(zhaoliu_revisions)}")

zhaoliu_errors = df_errors[df_errors["关联答案"] == zhaoliu.id]
check("导出误差说明数 = 3", len(zhaoliu_errors) == 3,
      f"实际: {len(zhaoliu_errors)}")

print_sep("【6/6】 最终汇总")
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
failed = total - passed
print(f"总计: {total} 项，通过: {passed} 项，失败: {failed} 项")
print()

if failed > 0:
    print("失败项明细:")
    for name, ok, detail in results:
        if not ok:
            print(f"  ❌ {name}")
            if detail:
                print(f"     {detail}")
    sys.exit(1)
else:
    print("🎉 全部通过！人工修正备注在重跑后保留完整，状态流转正确，历史累积不丢。")
    sys.exit(0)
