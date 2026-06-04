#!/usr/bin/env python3
"""协方差漂移监测 - 快速运行脚本"""

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


def run_single_scenario(scenario_type: str, operator: str = "教研人员"):
    """运行单个场景并输出完整的复盘记录和可重跑命令"""
    sample = get_sample(scenario_type)
    monitor = CovarianceMonitor(operator=operator)

    print(f"\n{'='*80}")
    print(f"协方差漂移监测 - 场景: {scenario_type}")
    print(f"{'='*80}")

    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample.get("screenshot_id"),
    )
    print(f"\n[步骤1] 旧公式截图导入完成，记录ID: {record.record_id}")

    try:
        record, _ = monitor.import_teacher_comment(
            record_id=record.record_id,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample.get("comment_id"),
        )
        print(f"[步骤2] 老师批注导入完成，无冲突")
    except ConflictDetectedError as e:
        print(f"[步骤2] 检测到公式冲突！请吴老师确认")
        for c in e.conflicts:
            print(f"  - {c.detail}")

        record = monitor.review_by_wu_teacher(
            record_id=record.record_id,
            decision=RecordStatus.CONFIRMED,
            comment="经核查，老师批注正确，采用批注版本",
        )
        print(f"[步骤2a] 吴老师已确认，状态更新为: {record.status.value}")

        if "supplementary_formula" in sample:
            record = monitor.import_supplementary_formula(
                record_id=record.record_id,
                formula_expression=sample["supplementary_formula"],
                formula_description=sample["supplementary_description"],
                note=sample["supplementary_note"],
            )
            print(f"[步骤2b] 已补录老师批注的旧口径")

    try:
        monitor.check_format(record.record_id)
        print(f"[步骤3] 格式检查通过")
    except MixedFormatError as e:
        print(f"[步骤3] 检测到格式混排！请活动负责人复核")
        for issue in e.details:
            print(f"  - {issue}")

        if "conversion_rules" in sample:
            record = monitor.review_by_activity_leader(
                record_id=record.record_id,
                decision=RecordStatus.CONFIRMED,
                comment="已核对，统一转换为小数格式",
                conversion_rules=sample["conversion_rules"],
            )
            print(f"[步骤3a] 活动负责人已复核，格式已统一")

    record = monitor.calculate(record.record_id)
    print(f"[步骤4] 计算完成，协方差: {record.covariance_result:.6f}")

    monitor.finalize()

    print(f"\n{'='*80}")
    print("【复盘记录】")
    print(f"{'='*80}")
    print(monitor.get_audit_report())

    print(f"\n{'='*80}")
    print("【可重跑脚本】")
    print(f"{'='*80}")
    print(monitor.get_replay_script())

    return monitor


def main():
    if len(sys.argv) < 2:
        print("用法: python run_monitor.py <场景类型> [操作人]")
        print("场景类型: normal | mixed | supplementary | all")
        print(describe_samples())
        sys.exit(1)

    scenario = sys.argv[1]
    operator = sys.argv[2] if len(sys.argv) > 2 else "教研人员"

    if scenario == "all":
        for s in ["normal", "mixed", "supplementary"]:
            run_single_scenario(s, operator)
    else:
        run_single_scenario(scenario, operator)


if __name__ == "__main__":
    main()
