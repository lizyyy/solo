import argparse
import sys
from datetime import datetime

from models import ReviewDecision
from tracker import WeightTracker
from sample_data import (
    create_normal_sample,
    create_threshold_old_report_sample,
    create_training_log_supplement_sample,
)


def cmd_import_snapshot(args):
    tracker = WeightTracker()
    from models import FeatureSnapshot
    snapshot = FeatureSnapshot(
        snapshot_id=args.snapshot_id,
        version=args.version,
        create_time=datetime.now(),
        weight_threshold=args.threshold,
        weight_threshold_version=args.threshold_version,
        features={},
        source=args.source,
    )
    record = tracker.step1_import_snapshot(snapshot, args.operator)
    print(f"✅ 导入成功，追踪ID: {record.track_id}")
    print(f"   快照ID: {record.snapshot_id}")
    print(f"   阈值版本: {record.feature_snapshot.weight_threshold_version}")


def cmd_check_log(args):
    tracker = WeightTracker()
    from models import TrainingLogCurve
    log = TrainingLogCurve(
        log_id=args.log_id,
        snapshot_id="",
        train_time=datetime.now(),
        metric_name="weight_curve",
        metric_values=[],
        epochs=[],
        final_weight=args.final_weight,
        weight_caliber=args.caliber,
        remarks=args.remarks or "",
    )
    record, review_pkg = tracker.step2_check_training_log(args.track_id, log, args.operator)
    print(f"✅ 训练日志已关联")
    print(f"   状态: {record.status.value}")
    if review_pkg:
        print(f"   ⚠️  检测到 {len(record.conflicts)} 处冲突，请人工确认：")
        for i, c in enumerate(record.conflicts, 1):
            print(f"      [{i}] {c.description}")
            print(f"          快照值: {c.snapshot_value}")
            print(f"          日志值: {c.log_value}")


def cmd_resolve(args):
    tracker = WeightTracker()
    decision = ReviewDecision(args.decision)
    record = tracker.resolve_conflict(args.track_id, decision, args.reviewer, args.comment)
    print(f"✅ 复核完成")
    print(f"   决策: {record.review_decision.value}")
    print(f"   当前状态: {record.status.value}")


def cmd_update_metrics(args):
    tracker = WeightTracker()
    from models import StratifiedMetric
    metrics = [
        StratifiedMetric(
            metric_name="sample_weight",
            segment="high_value_users",
            value=0.70,
            confidence=0.95,
            caliber=args.caliber,
            update_time=datetime.now(),
            source="feature_snapshot",
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="mid_value_users",
            value=0.60,
            confidence=0.92,
            caliber=args.caliber,
            update_time=datetime.now(),
            source="feature_snapshot",
        ),
        StratifiedMetric(
            metric_name="sample_weight",
            segment="low_value_users",
            value=0.50,
            confidence=0.88,
            caliber=args.caliber,
            update_time=datetime.now(),
            source="feature_snapshot",
        ),
    ]
    record = tracker.step3_update_stratified_metrics(args.track_id, metrics, args.operator)
    print(f"✅ 分层指标处理完成")
    print(f"   状态: {record.status.value}")
    if record.stratified_metrics:
        print(f"   已更新 {len(record.stratified_metrics)} 条分层指标")
    else:
        print(f"   ⚠️  暂缓更新，需先复核")


def cmd_show(args):
    tracker = WeightTracker()
    record = tracker.get_record(args.track_id)
    if not record:
        print(f"❌ 追踪记录不存在: {args.track_id}")
        sys.exit(1)
    print(tracker.export_review_record(args.track_id))


def cmd_replay(args):
    tracker = WeightTracker()
    commands = tracker.export_replay_commands(args.track_id)
    print("\n".join(commands))


def cmd_run_samples(args):
    print("=" * 60)
    print("样本权重异常追踪 - 三种场景演示")
    print("=" * 60)
    print()

    tracker = WeightTracker(storage_path="sample_records.json")
    import os
    if os.path.exists("sample_records.json"):
        os.remove("sample_records.json")

    scenarios = [
        ("【场景一】正常记录", create_normal_sample, "normal"),
        ("【场景二】阈值改过但报告仍写旧值", create_threshold_old_report_sample, "threshold_issue"),
        ("【场景三】从训练日志曲线补录", create_training_log_supplement_sample, "log_supplement"),
    ]

    track_ids = []

    for name, sample_fn, tag in scenarios:
        print(name)
        print("-" * 40)
        snapshot, training_log, metrics = sample_fn()

        print("Step 1: 导入特征快照")
        record = tracker.step1_import_snapshot(snapshot, "data_engineer")
        print(f"  追踪ID: {record.track_id}")
        track_ids.append(record.track_id)
        track_id = record.track_id

        print("Step 2: 推荐策略老唐补看训练日志曲线")
        record, review_pkg = tracker.step2_check_training_log(track_id, training_log, "推荐策略老唐")
        print(f"  状态: {record.status.value}")

        if review_pkg:
            print(f"  发现冲突，生成复核包...")
            print(f"  冲突证据:")
            for i, c in enumerate(record.conflicts, 1):
                print(f"    [{i}] {c.description}")
                print(f"        快照值: {c.snapshot_value}")
                print(f"        日志值: {c.log_value}")

            if tag == "threshold_issue":
                print()
                print("  👉 交给数据科学家复核...")
                print("  数据科学家：确认，这确实是阈值改过但报告仍写旧值的情况，留档")
                record = tracker.resolve_conflict(
                    track_id,
                    ReviewDecision.CONFIRM,
                    "数据科学家A",
                    "确认阈值版本不匹配为报告同步延迟导致"
                )
                print(f"  复核后状态: {record.status.value}")

            elif tag == "log_supplement":
                print()
                print("  👉 交给数据科学家复核...")
                print("  数据科学家：确认，这是从历史训练曲线补录的旧口径数据")
                record = tracker.resolve_conflict(
                    track_id,
                    ReviewDecision.CONFIRM,
                    "数据科学家B",
                    "确认从TensorBoard回溯补录，口径与当时一致"
                )
                print(f"  复核后状态: {record.status.value}")

        print("Step 3: 更新分层指标")
        record = tracker.step3_update_stratified_metrics(track_id, metrics, "system")
        print(f"  最终状态: {record.status.value}")
        if record.stratified_metrics:
            print(f"  分层指标数量: {len(record.stratified_metrics)}")
            for m in record.stratified_metrics:
                print(f"    - [{m.segment}] {m.value} (口径: {m.caliber})")
        else:
            print(f"  ⚠️  分层指标未更新")

        print()
        print("生成复盘记录和重跑命令...")
        review_text = tracker.export_review_record(track_id)
        with open(f"review_{tag}.txt", "w", encoding="utf-8") as f:
            f.write(review_text)
        print(f"  复盘记录: review_{tag}.txt")

        replay_cmds = tracker.export_replay_commands(track_id)
        with open(f"replay_{tag}.sh", "w", encoding="utf-8") as f:
            f.write("\n".join(replay_cmds))
        print(f"  重跑命令: replay_{tag}.sh")

        print()

    print("=" * 60)
    print("三种场景运行结果对比:")
    print("-" * 40)
    for i, (name, _, tag) in enumerate(scenarios):
        tid = track_ids[i]
        r = tracker.get_record(tid)
        print(f"{name}:")
        print(f"  状态: {r.status.value}")
        print(f"  冲突数: {len(r.conflicts)}")
        print(f"  分层指标数: {len(r.stratified_metrics)}")
        print(f"  操作历史: {len(r.history)} 步")
        print()
    print("=" * 60)
    print()
    print("查看详情命令:")
    for i, (name, _, tag) in enumerate(scenarios):
        tid = track_ids[i]
        print(f"  {name}: python cli.py show --track-id {tid}")
    print()
    print("导出重跑命令:")
    for i, (name, _, tag) in enumerate(scenarios):
        tid = track_ids[i]
        print(f"  {name}: python cli.py replay --track-id {tid}")


def main():
    parser = argparse.ArgumentParser(description="样本权重异常追踪系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    p_import = subparsers.add_parser("import-snapshot", help="导入特征快照")
    p_import.add_argument("--snapshot-id", required=True, help="快照ID")
    p_import.add_argument("--version", required=True, help="快照版本")
    p_import.add_argument("--threshold", type=float, required=True, help="权重阈值")
    p_import.add_argument("--threshold-version", required=True, help="阈值版本")
    p_import.add_argument("--source", default="feature_platform", help="来源")
    p_import.add_argument("--operator", required=True, help="操作人")

    p_check = subparsers.add_parser("check-log", help="补看训练日志曲线")
    p_check.add_argument("--track-id", required=True, help="追踪ID")
    p_check.add_argument("--log-id", required=True, help="日志ID")
    p_check.add_argument("--caliber", required=True, help="权重口径")
    p_check.add_argument("--final-weight", type=float, required=True, help="最终权重")
    p_check.add_argument("--remarks", default="", help="备注")
    p_check.add_argument("--operator", required=True, help="操作人")

    p_resolve = subparsers.add_parser("resolve", help="冲突复核")
    p_resolve.add_argument("--track-id", required=True, help="追踪ID")
    p_resolve.add_argument("--decision", required=True, choices=["confirm", "reject"], help="决策")
    p_resolve.add_argument("--reviewer", required=True, help="复核人")
    p_resolve.add_argument("--comment", default="", help="复核意见")

    p_metrics = subparsers.add_parser("update-metrics", help="更新分层指标")
    p_metrics.add_argument("--track-id", required=True, help="追踪ID")
    p_metrics.add_argument("--caliber", required=True, help="口径")
    p_metrics.add_argument("--operator", required=True, help="操作人")

    p_show = subparsers.add_parser("show", help="查看追踪记录")
    p_show.add_argument("--track-id", required=True, help="追踪ID")

    p_replay = subparsers.add_parser("replay", help="导出重跑命令")
    p_replay.add_argument("--track-id", required=True, help="追踪ID")

    subparsers.add_parser("run-samples", help="运行三种样例场景")

    args = parser.parse_args()

    if args.command == "import-snapshot":
        cmd_import_snapshot(args)
    elif args.command == "check-log":
        cmd_check_log(args)
    elif args.command == "resolve":
        cmd_resolve(args)
    elif args.command == "update-metrics":
        cmd_update_metrics(args)
    elif args.command == "show":
        cmd_show(args)
    elif args.command == "replay":
        cmd_replay(args)
    elif args.command == "run-samples":
        cmd_run_samples(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
