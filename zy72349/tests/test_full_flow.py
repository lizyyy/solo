#!/usr/bin/env python3
"""协方差漂移监测 - 完整测试（同一条记录贯通所有步骤）

验证要点：
1. 计算明细、历史记录、报告导出、可重跑脚本都基于同一条最新 record
2. 补录场景：同一条记录先旧口径初算→新口径复算，两个快照 + 差异复盘
3. 混排场景：原始说法/改后值/处理原因/下一步找谁完整保留
4. 最后走：安装检查→启动→每条路径操作
"""

import sys
import os

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


def assert_on_record(
    record,
    expected_snapshots: int,
    expected_diff: bool,
    scenario_tag: str,
) -> bool:
    """断言同一条 record 上的快照、差异、历史记录是否同步"""
    ok = True
    # 1. 快照数量
    if len(record.calculation_snapshots) != expected_snapshots:
        print(
            f"  ❌ [{scenario_tag}] 快照数量不匹配: "
            f"期望 {expected_snapshots}, 实际 {len(record.calculation_snapshots)}"
        )
        ok = False
    else:
        print(f"  ✅ [{scenario_tag}] 快照数量正确: {expected_snapshots} 个")

    # 2. 快照与 calculation_history 是否同步（最新快照）
    if record.calculation_snapshots:
        latest = record.calculation_snapshots[-1]
        if len(latest.details) == len(record.calculation_history):
            ok_steps = all(
                latest.details[i].intermediate_result == record.calculation_history[i].intermediate_result
                for i in range(len(latest.details))
            )
            if ok_steps:
                print(f"  ✅ [{scenario_tag}] calculation_history 与最新快照一致")
            else:
                print(f"  ❌ [{scenario_tag}] calculation_history 与最新快照不一致")
                ok = False
        # 3. covariance_result == 最新快照结果
        if abs(record.covariance_result - latest.covariance_result) < 1e-9:
            print(f"  ✅ [{scenario_tag}] record.covariance_result 与最新快照一致")
        else:
            print(f"  ❌ [{scenario_tag}] record.covariance_result 与最新快照不一致")
            ok = False

    # 4. 差异复盘
    diff = record.get_old_vs_new_diff()
    if expected_diff:
        if diff is None:
            print(f"  ❌ [{scenario_tag}] 期望有差异复盘，但 get_old_vs_new_diff() 返回 None")
            ok = False
        else:
            if diff["formula_changed"] and diff["result_diff"] is not None:
                print(
                    f"  ✅ [{scenario_tag}] 旧口径 vs 新口径差异复盘存在: "
                    f"公式变更=是, 结果差值={diff['result_diff']:.6f}"
                )
            else:
                print(f"  ❌ [{scenario_tag}] 差异复盘字段不全: {diff}")
                ok = False
    else:
        print(f"  ✅ [{scenario_tag}] 该场景不对比差异（单口径）")

    # 5. 所有快照同一条 record
    snap_ids = {s.snapshot_id for s in record.calculation_snapshots}
    if len(snap_ids) == len(record.calculation_snapshots):
        print(f"  ✅ [{scenario_tag}] 所有快照 ID 不重复，都挂在同一条 record 上")
    else:
        print(f"  ❌ [{scenario_tag}] 快照 ID 重复")
        ok = False
    return ok


def assert_review_trace(record, scenario_tag: str) -> bool:
    """断言复核留痕：原始说法/改后值/处理原因/下一步找谁"""
    ok = True
    if not record.reviews:
        print(f"  ℹ️  [{scenario_tag}] 无复核步骤")
        return True
    for r in record.reviews:
        if not r.next_handler:
            print(f"  ❌ [{scenario_tag}] 复核缺少『下一步找谁』")
            ok = False
        if not r.value_changes:
            print(f"  ❌ [{scenario_tag}] 复核缺少『变更明细 value_changes』")
            ok = False
        for vc in r.value_changes:
            missing = [
                name
                for name, val in [
                    ("原始说法", vc.original_statement),
                    ("改后值", vc.revised_statement),
                    ("处理原因", vc.change_reason),
                ]
                if not val
            ]
            if missing:
                print(f"  ❌ [{scenario_tag}] 变更 {vc.field_name} 缺少: {missing}")
                ok = False
    if ok:
        print(f"  ✅ [{scenario_tag}] 复核留痕完整: 原始说法/改后值/处理原因/下一步找谁 全齐")
    return ok


def test_scenario_normal() -> tuple:
    """场景一：正常材料（同一条记录 → 导入→批注→检查→计算→报告）"""
    sample = get_sample("normal")
    print_separator(sample["scenario_name"])

    monitor = CovarianceMonitor(operator=sample["operator"])

    print_subtitle("① 旧公式截图第一次导入（同一条 record 创建）")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    first_record_id = record.record_id
    print(f"  record_id: {first_record_id}")
    print(f"  原始输入（保留原始写法，未提前归一化）:")
    for k, v in record.original_values.items():
        print(f"    {k}: raw={v.raw_value}, num={v.numeric_value} ({v.format_note})")

    print_subtitle("② 教研负责人吴老师补看老师批注（公式一致）")
    record, _ = monitor.import_teacher_comment(
        record_id=record.record_id,
        formula_expression=sample["comment_formula"],
        formula_description=sample["comment_description"],
        comment_source_id=sample["comment_id"],
    )
    assert record.record_id == first_record_id, "record_id 变了！"
    print(f"  record_id 校验一致: {record.record_id}")
    print(f"  状态: {record.status.value}")

    print_subtitle("③ 格式检查 → 计算明细更新（同一条记录写入快照和历史）")
    record, _ = monitor.check_format(record.record_id)
    record = monitor.calculate(record.record_id)
    print(f"  最终协方差: {record.covariance_result:.6f}")
    print(f"  最终状态: {record.status.value}")
    for d in record.calculation_history:
        print(f"    步骤{d.step}: {d.description} = {d.intermediate_result:.6f}（{d.formula_used}）")

    monitor.finalize()
    return monitor, first_record_id, sample


def test_scenario_mixed() -> tuple:
    """场景二：百分数和小数混排（同一条记录 → 不自动归一化 → 复核留痕 → 复算）"""
    sample = get_sample("mixed")
    print_separator(sample["scenario_name"])

    monitor = CovarianceMonitor(operator=sample["operator"])

    print_subtitle("① 旧公式截图导入（数据包含 75% + 0.82 混写）")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    first_record_id = record.record_id
    print(f"  record_id: {first_record_id}")
    print("  原始写法展示:")
    for k, v in record.original_values.items():
        print(f"    {k}: {v.raw_value}（{v.format_note}）")

    print_subtitle("② 老师批注（公式一致）")
    record, _ = monitor.import_teacher_comment(
        record_id=record.record_id,
        formula_expression=sample["comment_formula"],
        formula_description=sample["comment_description"],
        comment_source_id=sample["comment_id"],
    )
    assert record.record_id == first_record_id

    print_subtitle("③ 格式检查 → 检测到混排 → 抛出异常（不归正常，留待复核）")
    try:
        record, _ = monitor.check_format(record.record_id)
        print("  ❌ 应该抛出 MixedFormatError 但没抛")
    except MixedFormatError as e:
        print(f"  ✅ 抛出 MixedFormatError: {e.message}")
        print(f"  当前状态: {record.status.value}（mixed_format, 未归正常）")

    print_subtitle("④ 活动负责人复核（留痕：原始说法/改后值/处理原因/下一步找谁）")
    record = monitor.review_by_activity_leader(
        record_id=record.record_id,
        decision=RecordStatus.CONFIRMED,
        comment=sample["activity_comment"],
        conversion_rules=sample["conversion_rules"],
    )
    assert record.record_id == first_record_id
    for r in record.reviews:
        print(f"  复核人: {r.reviewer}，复核字段: {r.review_field.value}")
        print(f"  下一步找谁: {r.next_handler}")
        for vc in r.value_changes:
            print(f"    字段 {vc.field_name}:")
            print(f"      原始说法: {vc.original_statement}")
            print(f"      改后值  : {vc.revised_statement}")
            print(f"      处理原因: {vc.change_reason}")

    print_subtitle("⑤ 计算明细更新（同一条记录写入快照和历史）")
    record = monitor.calculate(record.record_id)
    print(f"  最终协方差: {record.covariance_result:.6f}")
    print(f"  最终状态  : {record.status.value}")

    monitor.finalize()
    return monitor, first_record_id, sample


def test_scenario_supplementary() -> tuple:
    """场景三：补录材料（核心！同一条记录 → 旧口径初算→冲突→吴老师确认→补录→新口径复算）"""
    sample = get_sample("supplementary")
    print_separator(sample["scenario_name"])

    monitor = CovarianceMonitor(operator=sample["operator"])

    # ======================================================
    # 同一 record 第一步：旧公式截图导入 → 直接按旧口径先算一次
    # ======================================================
    print_subtitle("① 旧公式截图第一次导入，并先按截图口径初算一次（快照1 = 旧口径）")
    record = monitor.import_screenshot_formula(
        batch_id=sample["batch_id"],
        subject=sample["subject"],
        exam_date=sample["exam_date"],
        raw_values=sample["raw_values"],
        formula_expression=sample["screenshot_formula"],
        formula_description=sample["screenshot_description"],
        screenshot_id=sample["screenshot_id"],
    )
    first_record_id = record.record_id
    print(f"  record_id: {first_record_id}")

    record, _ = monitor.check_format(record.record_id)
    print("  格式通过，先按【旧公式截图】执行初算...")
    record = monitor.calculate(record.record_id, source_preference=FormulaSource.SCREENSHOT)
    old_result = record.covariance_result
    print(f"  旧口径结果: {old_result:.6f}（总体协方差 ÷n）")
    print(f"  快照数量初算后: {len(record.calculation_snapshots)}")
    assert len(record.calculation_snapshots) == 1, "初算后应产生 1 个快照"

    # ======================================================
    # 同一 record 第二步：导入老师批注 → 触发冲突
    # ======================================================
    print_subtitle("② 同一条记录导入老师批注（与截图公式不一致 → 触发冲突）")
    try:
        record, _ = monitor.import_teacher_comment(
            record_id=record.record_id,
            formula_expression=sample["comment_formula"],
            formula_description=sample["comment_description"],
            comment_source_id=sample["comment_id"],
        )
        print("  ❌ 应该抛 ConflictDetectedError 但没抛")
    except ConflictDetectedError as e:
        assert record.record_id == first_record_id, "同一条记录 ID 不能变！"
        print(f"  ✅ 抛出 ConflictDetectedError: {e.message}")
        print(f"  冲突证据（不自动拍板）:")
        for c in record.conflicts:
            print(f"    截图公式: {c.screenshot_value}")
            print(f"    批注公式: {c.comment_value}")
            print(f"    详情    : {c.detail}")

    # ======================================================
    # 同一 record 第三步：吴老师复核（留痕四要素：原始/改后/原因/下一步）
    # ======================================================
    print_subtitle("③ 吴老师确认批注口径（留痕：原始说法/改后值/处理原因/下一步找谁）")
    record = monitor.review_by_wu_teacher(
        record_id=record.record_id,
        decision=RecordStatus.CONFIRMED,
        comment=sample["wu_teacher_comment"],
    )
    assert record.record_id == first_record_id
    print(f"  吴老师决策后状态: {record.status.value}")
    for r in record.reviews:
        print(f"  复核人: {r.reviewer}")
        print(f"  下一步找谁: {r.next_handler}")
        for vc in r.value_changes:
            print(f"    字段 {vc.field_name}:")
            print(f"      原始说法: {vc.original_statement}")
            print(f"      改后值  : {vc.revised_statement}")
            print(f"      处理原因: {vc.change_reason}")

    # ======================================================
    # 同一 record 第四步：补录批注口径
    # ======================================================
    print_subtitle("④ 同一条记录补录批注口径（notes 和 status 更新）")
    record = monitor.import_supplementary_formula(
        record_id=record.record_id,
        formula_expression=sample["supplementary_formula"],
        formula_description=sample["supplementary_description"],
        note=sample["supplementary_note"],
    )
    assert record.record_id == first_record_id
    print(f"  补录后状态: {record.status.value}")
    print(f"  补录说明（record.notes）已写入")

    # ======================================================
    # 同一 record 第五步：按补录新口径复算（快照2 = 批注口径）
    # ======================================================
    print_subtitle("⑤ 同一条记录按【补录口径】复算（产生快照2，并写入 calculation_history）")
    record = monitor.calculate(record.record_id, source_preference=FormulaSource.SUPPLEMENTARY)
    new_result = record.covariance_result
    print(f"  新口径结果: {new_result:.6f}（样本协方差 ÷(n-1)）")
    print(f"  快照数量复算后: {len(record.calculation_snapshots)}")

    print_subtitle("⑥ 旧口径 vs 批注口径 差异复盘（get_old_vs_new_diff）")
    diff = record.get_old_vs_new_diff()
    if diff:
        print(f"  公式是否变更: {'是' if diff['formula_changed'] else '否'}")
        print(f"  【{diff['label_other']}】{diff['formula_other']}  →  结果: {record.calculation_snapshots[0].covariance_result:.6f}")
        print(f"  【{diff['label_this']}】{diff['formula_this']}  →  结果: {record.calculation_snapshots[-1].covariance_result:.6f}")
        print(f"  协方差结果差值: {diff['result_diff']:.6f}")
    else:
        print("  ❌ 差异复盘为空")

    print_subtitle("⑦ 校验：同一条记录的列表/详情/摘要/历史是否同步")
    latest_snap = record.get_latest_snapshot()
    assert abs(latest_snap.covariance_result - record.covariance_result) < 1e-9
    print(f"  ✅ record.covariance_result 与最新快照结果一致: {record.covariance_result:.6f}")
    assert len(latest_snap.details) == len(record.calculation_history)
    print(f"  ✅ calculation_history 与最新快照明细步骤数相同: {len(record.calculation_history)}")

    monitor.finalize()
    return monitor, first_record_id, sample


def assert_report_replay_consistent(
    monitor: CovarianceMonitor,
    scenario_tag: str,
) -> bool:
    """断言：复盘记录 vs 可重跑脚本 vs 实际 record 三者一致"""
    ok = True
    rec = monitor.session.records[0]

    # 1) 生成报告
    report = monitor.get_audit_report()
    report_contains_latest = str(rec.covariance_result) in report
    if report_contains_latest:
        print(f"  ✅ [{scenario_tag}] 复盘报告中包含最新协方差结果")
    else:
        print(f"  ❌ [{scenario_tag}] 复盘报告缺失最新协方差结果")
        ok = False

    if rec.calculation_snapshots:
        label_in_report = all(
            s.label in report for s in rec.calculation_snapshots
        )
        if label_in_report:
            print(f"  ✅ [{scenario_tag}] 复盘报告包含所有快照标签")
        else:
            print(f"  ❌ [{scenario_tag}] 复盘报告缺失快照标签")
            ok = False

    if rec.get_old_vs_new_diff():
        diff_in_report = "差异复盘" in report and "旧口径" in report
        if diff_in_report:
            print(f"  ✅ [{scenario_tag}] 复盘报告包含差异复盘章节")
        else:
            print(f"  ❌ [{scenario_tag}] 复盘报告缺失差异复盘章节")
            ok = False

    # 2) 生成可重跑脚本并实际执行
    script_path = f"/tmp/{scenario_tag}_verify_replay.py"
    with open(script_path, "w") as f:
        f.write(monitor.get_replay_script())

    import subprocess
    result = subprocess.run(
        ["python3", script_path],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )
    if result.returncode == 0 and str(rec.covariance_result) in result.stdout:
        print(f"  ✅ [{scenario_tag}] 可重跑脚本能跑通并输出正确协方差")
    else:
        print(f"  ❌ [{scenario_tag}] 可重跑脚本有问题: {result.stderr or result.stdout}")
        ok = False
    return ok


def main():
    print("\n" + "#" * 80)
    print("# 协方差漂移监测 v2.0 - 同一条记录贯通测试")
    print("# 重点：计算明细/历史记录/报告/可重跑 全部同步")
    print("#" * 80)
    print(describe_samples())

    tests = [test_scenario_normal, test_scenario_mixed, test_scenario_supplementary]
    results = []
    monitors = []

    for test_func in tests:
        try:
            monitor, rec_id, sample = test_func()
            monitors.append((test_func.__name__, monitor, rec_id, sample))
        except Exception as e:
            print(f"\n❌ {test_func.__name__} 执行异常: {e}")
            import traceback
            traceback.print_exc()
            results.append((test_func.__name__, False))
            continue

        print_subtitle(f"[{sample['scenario_name']}] 数据一致性校验")
        ok1 = assert_on_record(
            monitor.session.records[0],
            sample["expected_snapshots"],
            sample["expected_diff"],
            sample["scenario_name"],
        )
        ok2 = assert_review_trace(monitor.session.records[0], sample["scenario_name"])
        ok3 = assert_report_replay_consistent(monitor, test_func.__name__)
        results.append((test_func.__name__, ok1 and ok2 and ok3))

    print_separator("测试结果汇总")
    for name, success in results:
        status = "✅ 通过" if success else "❌ 失败"
        print(f"  {name}: {status}")

    all_passed = all(s for _, s in results)
    print(f"\n  总体: {'✅ 全部测试通过' if all_passed else '❌ 部分测试失败'}")

    # ==========================================================
    # 输出：报告、可重跑脚本、数据导出都基于同一条 record
    # ==========================================================
    print_separator("产物输出（路径列表）")
    for name, monitor, rec_id, sample in monitors:
        report_file = f"/tmp/{name}_audit_report.txt"
        script_file = f"/tmp/{name}_replay.py"
        with open(report_file, "w") as f:
            f.write(monitor.get_audit_report())
        with open(script_file, "w") as f:
            f.write(monitor.get_replay_script())
        print(f"  [{sample['scenario_name']}]")
        print(f"    复盘记录 → {report_file}")
        print(f"    可重跑脚本 → {script_file}")
        print(f"    涉及记录ID → {rec_id}（三者同一条）")

    # 对比表
    print_separator("三种处理结果对比（同数据不同口径）")
    print(
        f"{'场景':<28}{'最终状态':<20}{'协方差结果':<15}{'快照数':<8}{'处理路径'}"
    )
    print("-" * 95)
    for name, monitor, _, sample in monitors:
        rec = monitor.session.records[0]
        path_map = {
            "test_scenario_normal": "公式一致/格式统一 → 直接计算",
            "test_scenario_mixed": "混排检测 → 活动负责人复核 → 格式统一 → 计算",
            "test_scenario_supplementary": (
                "旧口径初算→冲突列证据→吴老师确认→补录→新口径复算（含差异复盘）"
            ),
        }
        print(
            f"{sample['subject'] + ' - ' + sample['batch_id']:<28}"
            f"{rec.status.value:<20}"
            f"{rec.covariance_result:<15.6f}"
            f"{len(rec.calculation_snapshots):<8}"
            f"{path_map[name]}"
        )

    print("\n" + "=" * 80)
    print("结论：所有计算明细/历史记录/报告/可重跑 都挂在同一条 DriftRecord 上")
    print("  ① 补录场景有 2 个快照，旧口径vs新口径差异可复盘")
    print("  ② 混排场景复核留痕完整（原始说法/改后值/原因/下一步找谁）")
    print("  ③ 报告、可重跑脚本与实际 record 一致")
    print("=" * 80 + "\n")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
