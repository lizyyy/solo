#!/usr/bin/env python3
"""协方差漂移监测 - 快速运行脚本（同一条记录贯通完整流程）"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from covariance_monitor import (
    CovarianceMonitor,
    RecordStatus,
    FormulaSource,
    ConflictDetectedError,
    MixedFormatError,
    get_sample,
    describe_samples,
)


def run_single_scenario(scenario_type: str, operator: str = None):
    """单个场景：输入→补录/复核→状态变化→最终展示，全部串在同一条 record"""
    sample = get_sample(scenario_type)
    op = operator or sample.get("operator", "教研人员")
    monitor = CovarianceMonitor(operator=op)

    print(f"\n{'='*80}")
    print(f"{sample['scenario_name']}")
    print(f"操作人: {op}")
    print(f"{'='*80}")

    # ① 旧公式截图导入
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample.get("screenshot_id"),
    )
    rid = record.record_id
    print(f"\n[1/5] 旧公式截图导入完成，record_id={rid}")

    # 场景三特殊：先按旧口径算一次（产生快照1，用于后续差异复盘）
    if scenario_type == "supplementary":
        try:
            record, _ = monitor.check_format(rid)
            print(f"[额外] 先按旧公式截图口径初算一次，用于后续对比...")
            record = monitor.calculate(rid, source_preference=FormulaSource.SCREENSHOT)
            print(f"      旧口径初算完成: 协方差={record.covariance_result:.6f}")
            print(f"      当前快照数={len(record.calculation_snapshots)}")
        except Exception as e:
            print(f"      初算异常: {e}")

    # ② 老师批注
    try:
        record, _ = monitor.import_teacher_comment(
            record_id=rid,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample.get("comment_id"),
        )
        print(f"[2/5] 老师批注导入完成，无公式冲突")
    except ConflictDetectedError as e:
        print(f"[2/5] 检测到公式冲突（不自动拍板）: {e.message}")
        # 吴老师复核
        record = monitor.review_by_wu_teacher(
            record_id=rid,
            decision=RecordStatus.CONFIRMED,
            comment=sample.get("wu_teacher_comment", "按批注口径执行"),
        )
        print(f"      → 吴老师已确认，状态={record.status.value}")
        # 补录
        if "supplementary_formula" in sample:
            record = monitor.import_supplementary_formula(
                record_id=rid,
                formula_expression=sample["supplementary_formula"],
                formula_description=sample["supplementary_description"],
                note=sample["supplementary_note"],
            )
            print(f"[补录] 批注口径已补录入同一条 record")

    # ③ 格式检查
    try:
        record, _ = monitor.check_format(rid)
        print(f"[3/5] 格式检查通过")
    except MixedFormatError as e:
        print(f"[3/5] 检测到百分数/小数混排（未自动归正常，留待活动负责人复核）")
        if "conversion_rules" in sample:
            record = monitor.review_by_activity_leader(
                record_id=rid,
                decision=RecordStatus.CONFIRMED,
                comment=sample.get("activity_comment"),
                conversion_rules=sample["conversion_rules"],
            )
            print(f"      → 活动负责人已复核，状态={record.status.value}")

    # ④ 计算
    pre_src = FormulaSource.SUPPLEMENTARY if scenario_type == "supplementary" else None
    record = monitor.calculate(rid, source_preference=pre_src)
    print(f"[4/5] 计算完成，最终协方差={record.covariance_result:.6f}")
    print(f"      最终状态={record.status.value}")
    print(f"      快照总数={len(record.calculation_snapshots)}")
    diff = record.get_old_vs_new_diff()
    if diff:
        print(f"      旧口径 vs 新口径: 结果差值={diff['result_diff']:.6f}, 公式变更={'是' if diff['formula_changed'] else '否'}")

    monitor.finalize()

    # ⑤ 产物
    print(f"\n[5/5] 产物生成（全部基于同一条 record_id={rid}）")
    report_file = f"/tmp/run_{scenario_type}_report.txt"
    script_file = f"/tmp/run_{scenario_type}_replay.py"
    with open(report_file, "w") as f:
        f.write(monitor.get_audit_report())
    with open(script_file, "w") as f:
        f.write(monitor.get_replay_script())
    print(f"      复盘记录 → {report_file}")
    print(f"      可重跑脚本 → {script_file}")

    return monitor


def main():
    if len(sys.argv) < 2:
        print("用法: python run_monitor.py <场景类型> [操作人]")
        print("场景类型: normal | mixed | supplementary | all")
        print(describe_samples())
        sys.exit(1)

    scenario = sys.argv[1]
    operator = sys.argv[2] if len(sys.argv) > 2 else None

    if scenario == "all":
        for s in ["normal", "mixed", "supplementary"]:
            run_single_scenario(s, operator)
    else:
        run_single_scenario(scenario, operator)


if __name__ == "__main__":
    main()
