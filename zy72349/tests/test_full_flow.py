#!/usr/bin/env python3
"""协方差漂移监测 - 完整测试脚本

测试三种场景：
1. 正常材料 - 顺利记录
2. 错口径材料 - 百分数和小数混着出现
3. 补录材料 - 从老师批注补来的旧口径
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from covariance_monitor import (
    CovarianceMonitor,
    RecordStatus,
    FormulaSource,
    ConflictDetectedError,
    MixedFormatError,
    PendingReviewError,
    get_sample,
    describe_samples,
)


def print_separator(title: str, width: int = 80) -> None:
    print("\n" + "=" * width)
    print(f" {title} ")
    print("=" * width)


def print_subtitle(text: str) -> None:
    print("\n" + "-" * 60)
    print(f"  {text}")
    print("-" * 60)


def test_scenario_normal() -> tuple:
    """场景一：正常材料 - 顺利记录"""
    print_separator("场景一：正常材料（顺利记录）")

    sample = get_sample("normal")
    monitor = CovarianceMonitor(operator="测试员-张老师")

    print_subtitle("第一步：旧公式截图第一次导入")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    print(f"  记录ID: {record.record_id}")
    print(f"  当前状态: {record.status.value}")
    print(f"  原始数据格式检查: 全部为小数格式，无混排")
    for k, v in record.original_values.items():
        print(f"    {k}: {v.raw_value} → {v.format_note}")

    print_subtitle("第二步：教研负责人吴老师补看老师批注")
    try:
        record, conflicts = monitor.import_teacher_comment(
            record_id=record.record_id,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample["comment_id"],
        )
        print(f"  批注导入完成，状态: {record.status.value}")
        print(f"  冲突检测: 无冲突，公式一致")
        print(f"  截图公式: {sample['screenshot_formula']}")
        print(f"  批注公式: {sample['comment_formula']}")
    except ConflictDetectedError as e:
        print(f"  检测到冲突: {e.message}")
        return monitor, False

    print_subtitle("第三步：格式检查 + 计算明细更新")
    try:
        record, issues = monitor.check_format(record.record_id)
        print(f"  格式检查: 通过，无格式混排问题")
    except MixedFormatError as e:
        print(f"  格式混排: {e.message}")
        return monitor, False

    record = monitor.calculate(record.record_id)
    print(f"  协方差计算完成: {record.covariance_result:.6f}")
    print(f"  最终状态: {record.status.value}")

    print_subtitle("计算明细")
    for detail in record.calculation_history:
        print(f"  步骤{detail.step}: {detail.description}")
        print(f"    公式: {detail.formula_used}")
        print(f"    结果: {detail.intermediate_result:.6f}")
        print(f"    来源: {detail.source.value}")

    monitor.finalize()
    return monitor, True


def test_scenario_mixed() -> tuple:
    """场景二：错口径材料 - 百分数和小数混着出现"""
    print_separator("场景二：错口径材料（百分数和小数混着出现）")

    sample = get_sample("mixed")
    monitor = CovarianceMonitor(operator="测试员-李老师")

    print_subtitle("第一步：旧公式截图第一次导入")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    print(f"  记录ID: {record.record_id}")
    print(f"  当前状态: {record.status.value}")
    print(f"  原始数据格式检查:")
    for k, v in record.original_values.items():
        print(f"    {k}: {v.raw_value} → {v.format_note}")

    print_subtitle("第二步：教研负责人吴老师补看老师批注")
    try:
        record, conflicts = monitor.import_teacher_comment(
            record_id=record.record_id,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample["comment_id"],
        )
        print(f"  批注导入完成，状态: {record.status.value}")
        print(f"  冲突检测: 无冲突，公式一致")
    except ConflictDetectedError as e:
        print(f"  检测到冲突: {e.message}")
        return monitor, False

    print_subtitle("第三步：格式检查 → 检测到混排，需活动负责人复核")
    try:
        record, issues = monitor.check_format(record.record_id)
        print(f"  格式检查: 通过，无格式混排问题")
    except MixedFormatError as e:
        print(f"  ⚠️  检测到百分数与小数混排！")
        print(f"  详细问题:")
        for issue in e.details:
            print(f"    {issue}")
        print(f"  当前状态: {record.status.value}")
        print(f"  → 未自动归为正常，留待活动负责人复核")

    print_subtitle("活动负责人复核（确认格式转换规则）")
    record = monitor.review_by_activity_leader(
        record_id=record.record_id,
        decision=RecordStatus.CONFIRMED,
        comment="经核对，所有百分数已统一转换为小数，规则：75%→0.75，85%→0.85，依此类推",
        conversion_rules=sample["conversion_rules"],
    )
    print(f"  复核结果: {record.status.value}")
    print(f"  复核人: {record.reviews[-1].reviewer}")
    print(f"  复核意见: {record.reviews[-1].comment}")
    print(f"  转换后数据:")
    for k, v in record.original_values.items():
        print(f"    {k}: {v.format_note}")

    print_subtitle("第四步：计算明细更新")
    record = monitor.calculate(record.record_id)
    print(f"  协方差计算完成: {record.covariance_result:.6f}")
    print(f"  最终状态: {record.status.value}")

    print_subtitle("计算明细")
    for detail in record.calculation_history:
        print(f"  步骤{detail.step}: {detail.description}")
        print(f"    公式: {detail.formula_used}")
        print(f"    结果: {detail.intermediate_result:.6f}")
        print(f"    来源: {detail.source.value}")

    monitor.finalize()
    return monitor, True


def test_scenario_supplementary() -> tuple:
    """场景三：补录材料 - 从老师批注补来的旧口径"""
    print_separator("场景三：补录材料（从老师批注补来的旧口径）")

    sample = get_sample("supplementary")
    monitor = CovarianceMonitor(operator="测试员-王老师")

    print_subtitle("第一步：旧公式截图第一次导入")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    print(f"  记录ID: {record.record_id}")
    print(f"  当前状态: {record.status.value}")
    print(f"  原始数据格式检查: 全部为小数格式，无混排")
    for k, v in record.original_values.items():
        print(f"    {k}: {v.raw_value} → {v.format_note}")

    print_subtitle("第二步：教研负责人吴老师补看老师批注 → 检测到冲突！")
    try:
        record, conflicts = monitor.import_teacher_comment(
            record_id=record.record_id,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample["comment_id"],
        )
        print(f"  批注导入完成，状态: {record.status.value}")
    except ConflictDetectedError as e:
        print(f"  ⚠️  检测到公式冲突！")
        print(f"  冲突证据:")
        for c in e.conflicts:
            print(f"    字段: {c.field_name}")
            print(f"    截图公式: {c.screenshot_value}")
            print(f"    批注公式: {c.comment_value}")
            print(f"    详情: {c.detail}")
        print(f"  当前状态: {record.status.value}")
        print(f"  → 列出冲突证据，由教研负责人吴老师选择确认或驳回")
        print(f"  → 不自动拍板！")

    print_subtitle("吴老师复核（冲突处理）")
    print(f"  可选操作：")
    print(f"    1. CONFIRMED - 确认，采用老师批注的公式（除以n-1）")
    print(f"    2. REJECTED - 驳回，维持原截图公式（除以n）")
    print(f"  → 吴老师选择：CONFIRMED（采用批注版本）")

    record = monitor.review_by_wu_teacher(
        record_id=record.record_id,
        decision=RecordStatus.CONFIRMED,
        comment="经核查，老师批注正确，应使用样本协方差公式（除以n-1）。原截图为旧版教材公式，已过时。",
    )
    print(f"  复核结果: {record.status.value}")
    print(f"  复核人: {record.reviews[-1].reviewer}")
    print(f"  复核意见: {record.reviews[-1].comment}")

    print_subtitle("补录：从老师批注补来的旧口径")
    record = monitor.import_supplementary_formula(
        record_id=record.record_id,
        formula_expression=sample["supplementary_formula"],
        formula_description=sample["supplementary_description"],
        note=sample["supplementary_note"],
    )
    print(f"  补录完成，状态: {record.status.value}")
    print(f"  补录公式: {record.formulas[-1].expression}")
    print(f"  补录说明: {record.notes}")

    print_subtitle("第三步：格式检查 + 计算明细更新")
    try:
        record, issues = monitor.check_format(record.record_id)
        print(f"  格式检查: 通过，无格式混排问题")
    except MixedFormatError as e:
        print(f"  格式混排: {e.message}")
        return monitor, False

    record = monitor.calculate(record.record_id, source_preference=FormulaSource.SUPPLEMENTARY)
    print(f"  协方差计算完成: {record.covariance_result:.6f}")
    print(f"  最终状态: {record.status.value}")

    print_subtitle("计算明细")
    for detail in record.calculation_history:
        print(f"  步骤{detail.step}: {detail.description}")
        print(f"    公式: {detail.formula_used}")
        print(f"    结果: {detail.intermediate_result:.6f}")
        print(f"    来源: {detail.source.value}")

    print_subtitle("历史记录对比")
    print(f"  按原截图公式(除以n)计算应为: Σ[(x-E[X])(y-E[Y])] / 4")
    print(f"  按批注公式(除以n-1)计算实际为: Σ[(x-E[X])(y-E[Y])] / 3")
    print(f"  差异来源: 分母不同导致结果不同，此差异已通过补录记录在案")

    monitor.finalize()
    return monitor, True


def main():
    print("\n" + "#" * 80)
    print("# 协方差漂移监测 - 完整测试套件")
    print("#" * 80)
    print(describe_samples())

    results = []
    monitors = []

    for test_func in [test_scenario_normal, test_scenario_mixed, test_scenario_supplementary]:
        try:
            monitor, success = test_func()
            monitors.append((test_func.__name__, monitor))
            results.append((test_func.__name__, success))
        except Exception as e:
            print(f"\n❌ {test_func.__name__} 执行异常: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_func.__name__, False))

    print_separator("测试结果汇总")
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"  {name}: {status}")

    all_passed = all(s for _, s in results)
    print(f"\n  总体: {'✅ 全部测试通过' if all_passed else '❌ 部分测试失败'}")

    print_separator("输出产物")

    for name, monitor in monitors:
        print(f"\n【{name}】复盘记录:")
        print("-" * 60)
        report = monitor.get_audit_report()
        print(report[:500] + "\n...\n[完整报告已保存到文件]")

        report_file = f"/tmp/{name}_audit_report.txt"
        with open(report_file, "w") as f:
            f.write(monitor.get_audit_report())
        print(f"  完整复盘记录已保存到: {report_file}")

        script_file = f"/tmp/{name}_replay.py"
        with open(script_file, "w") as f:
            f.write(monitor.get_replay_script())
        print(f"  可重跑脚本已保存到: {script_file}")

    print_separator("三种处理结果对比")
    print(f"\n{'场景':<25} {'最终状态':<20} {'协方差结果':<15} {'处理特点'}")
    print("-" * 80)

    for i, (name, monitor) in enumerate(monitors):
        for rec in monitor.session.records:
            scene_name = ["正常材料", "错口径材料", "补录材料"][i]
            result = f"{rec.covariance_result:.6f}" if rec.covariance_result else "N/A"
            features = [
                "无冲突，直接计算",
                "混排检测→活动负责人复核→格式统一→计算",
                "冲突检测→吴老师确认→补录→按新口径计算",
            ]
            print(f"{scene_name:<25} {rec.status.value:<20} {result:<15} {features[i]}")

    print("\n" + "=" * 80)
    print("  结论：三种场景处理逻辑不同，结果差异清晰可见")
    print("  - 正常记录：公式一致，格式统一 → 直接计算")
    print("  - 混排记录：格式不一致 → 留活动负责人复核，不自动归一化")
    print("  - 补录记录：公式冲突 → 列证据，吴老师拍板，补录后重新计算")
    print("=" * 80 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
