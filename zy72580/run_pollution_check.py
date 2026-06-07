#!/usr/bin/env python3
import argparse
import sys
from core import SamplePollutionChecker, ThresholdConfig
from demo_data import get_demo_snapshots, get_demo_training_logs


def run_full_workflow(checker: SamplePollutionChecker):
    print("\n" + "=" * 70)
    print("【样本污染排查工具 - 完整工作流演示】")
    print("=" * 70)

    snapshots = get_demo_snapshots()
    training_logs = get_demo_training_logs()

    print("\n>>> 第一步：特征快照编号第一次导入")
    for snap in snapshots:
        checker.import_snapshot(snap)

    print("\n" + checker.get_snapshot_summary())

    print("\n>>> 第二步：算法工程师小乔补看训练日志曲线")
    for log in training_logs:
        checker.review_training_log(log, reviewer="小乔")

    print("\n" + checker.get_snapshot_summary())

    print("\n>>> 执行一次人工修正（对SNAP-20260601-002）")
    checker.manual_correction(
        snapshot_id="SNAP-20260601-002",
        new_tier="green",
        comment="确认阈值已更新为v2，PS=0.88按新标准应为正常",
        reviewer="小乔"
    )

    print("\n>>> 执行一次重跑（对SNAP-20260601-001）")
    checker.rerun(
        snapshot_id="SNAP-20260601-001",
        trigger="验证分层指标稳定性"
    )

    print("\n>>> 第三步：分层指标更新")
    for snap in snapshots:
        checker.update_tier_metrics(snap.snapshot_id, reviewer="数据科学家")

    print("\n" + checker.get_snapshot_summary())

    print("\n>>> 生成复盘报告和可重跑命令")
    checker.generate_review_report()
    checker.export_rerun_commands()

    print("\n" + "=" * 70)
    print("【三种处理结果对比】")
    print("=" * 70)
    for sid, s in checker.snapshots.items():
        print(f"\n快照 {sid} ({s.feature_name}):")
        print(f"  最终分层: {s.tier}")
        print(f"  最终状态: {s.status}")
        print(f"  数据来源: {s.source}")
        print(f"  处理备注: {s.note}")

    print("\n" + "=" * 70)
    print("【工作流完成】")
    print("=" * 70)
    print("  复盘报告: demo_data/review_report.json")
    print("  可重跑命令: demo_data/rerun_commands.sh")
    print("  快照数据: demo_data/snapshots/")
    print("  训练日志: demo_data/logs/")
    print("  复核记录: demo_data/reviews/")
    print("  重跑记录: demo_data/reruns/")


def run_normal_case(checker: SamplePollutionChecker):
    print("\n" + "=" * 70)
    print("【运行正常材料 - SNAP-20260601-001】")
    print("=" * 70)
    snapshots = get_demo_snapshots()
    logs = get_demo_training_logs()

    snap = snapshots[0]
    log = logs[0]

    checker.import_snapshot(snap)
    checker.review_training_log(log)
    checker.update_tier_metrics(snap.snapshot_id)

    s = checker.snapshots[snap.snapshot_id]
    print(f"\n结果: 分层={s.tier}, 状态={s.status}, 备注={s.note}")


def run_wrong_caliber_case(checker: SamplePollutionChecker):
    print("\n" + "=" * 70)
    print("【运行错口径材料 - SNAP-20260601-002】")
    print("=" * 70)
    snapshots = get_demo_snapshots()
    logs = get_demo_training_logs()

    snap = snapshots[1]
    log = logs[1]

    checker.import_snapshot(snap)
    checker.review_training_log(log)
    checker.manual_correction(
        snapshot_id=snap.snapshot_id,
        new_tier="green",
        comment="阈值改过但报告仍写旧值，人工确认应修正",
        reviewer="小乔"
    )
    checker.update_tier_metrics(snap.snapshot_id)

    s = checker.snapshots[snap.snapshot_id]
    print(f"\n结果: 分层={s.tier}, 状态={s.status}, 备注={s.note}")


def run_supplement_case(checker: SamplePollutionChecker):
    print("\n" + "=" * 70)
    print("【运行补录材料 - SNAP-20260601-003】")
    print("=" * 70)
    snapshots = get_demo_snapshots()
    logs = get_demo_training_logs()

    snap = snapshots[2]
    log = logs[2]

    checker.import_snapshot(snap)
    checker.review_training_log(log)
    checker.update_tier_metrics(snap.snapshot_id)

    s = checker.snapshots[snap.snapshot_id]
    print(f"\n结果: 分层={s.tier}, 状态={s.status}, 备注={s.note}")


def main():
    parser = argparse.ArgumentParser(description="样本污染排查工具")
    parser.add_argument("--mode", type=str, default="full",
                        choices=["full", "normal", "wrong", "supplement"],
                        help="运行模式: full(完整演示), normal(正常材料), wrong(错口径材料), supplement(补录材料)")
    parser.add_argument("--snapshot", type=str, help="指定快照ID运行")
    parser.add_argument("--rerun", action="store_true", help="重跑模式")
    parser.add_argument("--threshold-version", type=str, default="v1", help="阈值版本")
    parser.add_argument("--update-thresholds", action="store_true", help="更新阈值到v2")

    args = parser.parse_args()

    checker = SamplePollutionChecker(data_dir="demo_data")

    if args.update_thresholds:
        new_thresh = ThresholdConfig(
            ps_high=0.98,
            ps_medium=0.90,
            drift_high=0.35,
            drift_medium=0.20,
            missing_rate_high=0.25,
            missing_rate_medium=0.15
        )
        checker.update_thresholds(new_thresh, version="v2")

    if args.mode == "full":
        run_full_workflow(checker)
    elif args.mode == "normal":
        run_normal_case(checker)
    elif args.mode == "wrong":
        run_wrong_caliber_case(checker)
    elif args.mode == "supplement":
        run_supplement_case(checker)

    if args.snapshot and args.rerun:
        checker.rerun(args.snapshot, trigger="命令行手动触发")

    checker.generate_review_report()
    checker.export_rerun_commands()


if __name__ == "__main__":
    main()
