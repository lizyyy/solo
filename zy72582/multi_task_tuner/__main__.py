import argparse
import json
import sys
from datetime import datetime
from .processor import MultiTaskTuner
from .demo_data import run_demo_workflow


def cmd_demo(args):
    tuner = run_demo_workflow(data_dir=args.data_dir)
    print("执行 'python -m multi_task_tuner retrospective' 查看完整复盘记录。")


def cmd_import_snapshot(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    features = json.loads(args.features) if args.features else {}
    snapshot = tuner.import_feature_snapshot(
        snapshot_id=args.id,
        features=features,
        data_range_start=datetime.fromisoformat(args.start),
        data_range_end=datetime.fromisoformat(args.end),
        source=args.source
    )
    print(f"已导入特征快照: {snapshot.snapshot_id}")


def cmd_import_log(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    points = json.loads(args.points) if args.points else []
    log = tuner.import_training_log(
        log_id=args.id,
        experiment_name=args.experiment,
        points=points,
        data_source=args.source
    )
    print(f"已导入训练日志: {log.log_id} (包含 {len(log.points)} 个点)")


def cmd_create_anomaly(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    ref_time = datetime.fromisoformat(args.ref_time) if args.ref_time else None
    sample = tuner.create_anomaly_from_snapshot(args.snapshot, args.log, ref_time)
    print(f"已创建异常样本: {sample.sample_id}")
    print(f"  状态: {sample.status.value}")
    print(f"  说明: {sample.review_note}")


def cmd_supplement_log(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    ref_time = datetime.fromisoformat(args.ref_time) if args.ref_time else None
    sample = tuner.supplement_training_log(args.sample, args.log, ref_time)
    print(f"已补录训练日志到样本: {sample.sample_id}")
    print(f"  新状态: {sample.status.value}")
    print(f"  说明: {sample.review_note}")


def cmd_review(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    sample, review = tuner.review_anomaly(args.sample, args.reviewer, args.action, args.note)
    print(f"已复核样本: {sample.sample_id}")
    print(f"  新状态: {sample.status.value}")
    print(f"  复核人: {review.reviewer}")
    print(f"  操作: {review.action}")
    print(f"  意见: {review.note}")


def cmd_anomaly_page(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    page = tuner.get_anomaly_page()
    
    print()
    print("=" * 100)
    print(f"异常样本页 (共 {len(page)} 条记录)")
    print("=" * 100)
    print(f"{'样本ID':<14} {'快照ID':<14} {'日志ID':<14} {'状态':<18} {'AUC':<6} {'F1':<6} {'标记':<30}")
    print("-" * 100)
    
    for item in page:
        flags_str = ",".join(item["flags"]) if item["flags"] else "-"
        auc = f"{item['metrics'].get('auc', 0):.3f}"
        f1 = f"{item['metrics'].get('f1', 0):.3f}"
        log_id = item["log_id"] or "-"
        print(f"{item['sample_id']:<14} {item['snapshot_id']:<14} {log_id:<14} {item['status_label']:<18} {auc:<6} {f1:<6} {flags_str:<30}")
    
    print()
    print("详细说明:")
    for item in page:
        if item["review_note"]:
            print(f"  [{item['sample_id']}] {item['review_note']}")
    print()


def cmd_retrospective(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    retro = tuner.generate_retrospective()
    
    print()
    print("=" * 80)
    print("多任务损失权重调参 - 复盘记录")
    print("=" * 80)
    print(f"生成时间: {retro['generated_at']}")
    print()
    
    print("【数据概览】")
    s = retro["summary"]
    print(f"  特征快照数: {s['total_snapshots']}")
    print(f"  训练日志数: {s['total_logs']}")
    print(f"  异常样本数: {s['total_samples']}")
    print("  状态分布:")
    for status, count in s["status_distribution"].items():
        print(f"    {status}: {count} 条")
    print()
    
    print("【特征快照列表】")
    for snap in retro["feature_snapshots"]:
        print(f"  {snap['snapshot_id']} | 创建于 {snap['created_at']} | 数据范围 {snap['data_range']}")
    print()
    
    print("【训练日志列表】")
    for log in retro["training_logs"]:
        print(f"  {log['log_id']} | {log['experiment_name']} | {log['points_count']}个点 | 来源: {log['data_source']}")
    print()
    
    print("【异常样本详情】")
    for samp in retro["anomaly_samples"]:
        print(f"  {samp['sample_id']}")
        print(f"    快照: {samp['snapshot_id']} | 日志: {samp['log_id'] or '未关联'}")
        print(f"    状态: {samp['status_label']} ({samp['status']})")
        print(f"    指标: AUC={samp['metrics'].get('auc', 0):.3f}, F1={samp['metrics'].get('f1', 0):.3f}")
        if samp["flags"]:
            print(f"    标记: {', '.join(samp['flags'])}")
        if samp["review_note"]:
            print(f"    备注: {samp['review_note']}")
        if samp["corrected_by"]:
            print(f"    修正人: {samp['corrected_by']} @ {samp['corrected_at']}")
    print()
    
    print("【操作日志】")
    for action in retro["action_log"]:
        print(f"  {action['timestamp']} | {action['action']:<20} | {json.dumps(action['details'], ensure_ascii=False)}")
    print()
    
    print("【可重新跑的命令】")
    for cmd in retro["replay_commands"]:
        print(f"  {cmd}")
    print()
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(retro, f, ensure_ascii=False, indent=2)
        print(f"复盘记录已保存到: {args.output}")
        print()


def cmd_rerun(args):
    tuner = MultiTaskTuner(data_dir=args.data_dir)
    weights = json.loads(args.weights)
    snapshots = args.snapshots.split(",") if args.snapshots else []
    logs = args.logs.split(",") if args.logs else []
    run = tuner.rerun_experiment(args.type, weights, snapshots, logs, args.notes)
    print(f"已创建重跑实验: {run.run_id}")
    print(f"  类型: {run.run_type}")
    print(f"  任务权重: {run.task_weights}")
    print(f"  关联快照: {run.feature_snapshots}")
    print(f"  关联日志: {run.training_logs}")


def main():
    parser = argparse.ArgumentParser(
        prog="multi_task_tuner",
        description="多任务损失权重调参工具 - 整合特征快照与训练日志，检测时间窗穿越"
    )
    parser.add_argument("--data-dir", default="./data", help="数据存储目录")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")
    demo_parser.set_defaults(func=cmd_demo)
    
    snap_parser = subparsers.add_parser("import-snapshot", help="导入特征快照")
    snap_parser.add_argument("--id", required=True, help="快照编号")
    snap_parser.add_argument("--start", required=True, help="数据范围起始时间 (ISO格式)")
    snap_parser.add_argument("--end", required=True, help="数据范围结束时间 (ISO格式)")
    snap_parser.add_argument("--features", default="{}", help="特征JSON")
    snap_parser.add_argument("--source", default="main_flow", help="数据来源")
    snap_parser.set_defaults(func=cmd_import_snapshot)
    
    log_parser = subparsers.add_parser("import-log", help="导入训练日志曲线")
    log_parser.add_argument("--id", required=True, help="日志编号")
    log_parser.add_argument("--experiment", required=True, help="实验名称")
    log_parser.add_argument("--points", default="[]", help="日志点JSON数组")
    log_parser.add_argument("--source", default="on_site", help="数据来源")
    log_parser.set_defaults(func=cmd_import_log)
    
    anomaly_parser = subparsers.add_parser("create-anomaly", help="从快照创建异常样本")
    anomaly_parser.add_argument("--snapshot", required=True, help="快照编号")
    anomaly_parser.add_argument("--log", default=None, help="日志编号(可选)")
    anomaly_parser.add_argument("--ref-time", default=None, help="参考时间(ISO格式)")
    anomaly_parser.set_defaults(func=cmd_create_anomaly)
    
    supp_parser = subparsers.add_parser("supplement-log", help="补录训练日志到异常样本")
    supp_parser.add_argument("--sample", required=True, help="异常样本ID")
    supp_parser.add_argument("--log", required=True, help="日志编号")
    supp_parser.add_argument("--ref-time", default=None, help="参考时间(ISO格式)")
    supp_parser.set_defaults(func=cmd_supplement_log)
    
    review_parser = subparsers.add_parser("review", help="人工复核异常样本")
    review_parser.add_argument("--sample", required=True, help="异常样本ID")
    review_parser.add_argument("--reviewer", required=True, help="复核人")
    review_parser.add_argument("--action", required=True, choices=["confirm_normal", "mark_leak", "confirm_leak", "correct"], help="操作类型")
    review_parser.add_argument("--note", default="", help="复核意见")
    review_parser.set_defaults(func=cmd_review)
    
    page_parser = subparsers.add_parser("anomaly-page", help="查看异常样本页")
    page_parser.set_defaults(func=cmd_anomaly_page)
    
    retro_parser = subparsers.add_parser("retrospective", help="生成复盘记录")
    retro_parser.add_argument("--output", default=None, help="输出JSON文件路径")
    retro_parser.set_defaults(func=cmd_retrospective)
    
    rerun_parser = subparsers.add_parser("rerun", help="重跑实验")
    rerun_parser.add_argument("--type", default="manual", help="重跑类型")
    rerun_parser.add_argument("--weights", required=True, help="任务权重JSON")
    rerun_parser.add_argument("--snapshots", default="", help="快照编号,逗号分隔")
    rerun_parser.add_argument("--logs", default="", help="日志编号,逗号分隔")
    rerun_parser.add_argument("--notes", default="", help="备注")
    rerun_parser.set_defaults(func=cmd_rerun)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)


if __name__ == "__main__":
    main()
