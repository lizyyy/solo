"""
命令行接口
"""
import argparse
import json
import sys
from pathlib import Path

from .snapshot_manager import SnapshotManager
from .history_tracker import HistoryTracker
from .boundary_rules import BoundaryRuleEngine
from .workflow import WorkflowEngine
from .audit import AuditReporter
from .models import WorkflowStep, ProcessingStatus


def main():
    parser = argparse.ArgumentParser(
        description="排名学习点击偏差可追溯记录系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入特征快照
  python -m ranking_click_bias.cli import --file snapshots.json --by 林姐

  # 查看系统概览
  python -m ranking_click_bias.cli summary

  # 查看单个快照详情
  python -m ranking_click_bias.cli show --snapshot-id SNAP001

  # 查看快照历史
  python -m ranking_click_bias.cli history --snapshot-id SNAP001

  # 执行工作流步骤
  python -m ranking_click_bias.cli workflow step2 --snapshot-id SNAP001 --by 林姐 --log-analysis "训练曲线正常"

  # 生成复盘报告
  python -m ranking_click_bias.cli audit --snapshot-id SNAP001

  # 生成重放命令
  python -m ranking_click_bias.cli replay --snapshot-id SNAP001

  # 查看需复核列表
  python -m ranking_click_bias.cli review-list

  # 复核通过
  python -m ranking_click_bias.cli approve --snapshot-id SNAP001 --by 推荐负责人 --notes "已确认"
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入特征快照")
    import_parser.add_argument("--file", required=True, help="快照数据 JSON 文件路径")
    import_parser.add_argument("--by", default="system", help="导入人")
    import_parser.add_argument("--source", default="manual", help="导入来源")

    summary_parser = subparsers.add_parser("summary", help="查看系统概览")

    show_parser = subparsers.add_parser("show", help="查看单个快照详情")
    show_parser.add_argument("--snapshot-id", required=True, help="快照 ID")

    history_parser = subparsers.add_parser("history", help="查看快照历史")
    history_parser.add_argument("--snapshot-id", required=True, help="快照 ID")

    workflow_parser = subparsers.add_parser("workflow", help="工作流操作")
    workflow_subparsers = workflow_parser.add_subparsers(dest="workflow_cmd")

    step1_parser = workflow_subparsers.add_parser("step1", help="第一步：确认导入")
    step1_parser.add_argument("--snapshot-id", required=True)
    step1_parser.add_argument("--by", required=True, help="操作人")
    step1_parser.add_argument("--notes", default="", help="备注")

    step2_parser = workflow_subparsers.add_parser("step2", help="第二步：审阅训练日志")
    step2_parser.add_argument("--snapshot-id", required=True)
    step2_parser.add_argument("--by", required=True, help="操作人")
    step2_parser.add_argument("--log-analysis", required=True, help="训练日志分析")
    step2_parser.add_argument("--curve-findings", default="", help="曲线发现")

    step3_parser = workflow_subparsers.add_parser("step3", help="第三步：更新可解释摘要")
    step3_parser.add_argument("--snapshot-id", required=True)
    step3_parser.add_argument("--by", required=True, help="操作人")
    step3_parser.add_argument("--summary", required=True, help="可解释摘要")
    step3_parser.add_argument("--score", type=float, help="点击偏差分数")
    step3_parser.add_argument("--missing-features", nargs="*", default=[], help="缺失的特征列表")
    step3_parser.add_argument("--default-score", action="store_true", help="是否使用了默认分")

    audit_parser = subparsers.add_parser("audit", help="生成复盘报告")
    audit_parser.add_argument("--snapshot-id", help="快照 ID（单个）")
    audit_parser.add_argument("--batch-id", help="批次 ID（批量）")
    audit_parser.add_argument("--save", action="store_true", help="保存到文件")

    replay_parser = subparsers.add_parser("replay", help="生成重放命令")
    replay_parser.add_argument("--snapshot-id", required=True, help="快照 ID")
    replay_parser.add_argument("--save", action="store_true", help="保存到文件")

    review_list_parser = subparsers.add_parser("review-list", help="查看需负责人复核的列表")

    approve_parser = subparsers.add_parser("approve", help="复核通过")
    approve_parser.add_argument("--snapshot-id", required=True)
    approve_parser.add_argument("--by", required=True, help="复核人")
    approve_parser.add_argument("--notes", default="", help="复核意见")
    approve_parser.add_argument("--mark-normal", action="store_true", default=True, help="标记为正常")

    reject_parser = subparsers.add_parser("reject", help="复核驳回")
    reject_parser.add_argument("--snapshot-id", required=True)
    reject_parser.add_argument("--by", required=True, help="复核人")
    reject_parser.add_argument("--notes", required=True, help="驳回原因")
    reject_parser.add_argument(
        "--send-back-to",
        choices=["step1", "step2", "step3"],
        help="打回步骤",
    )

    args = parser.parse_args()

    snapshot_mgr = SnapshotManager()
    history_tracker = HistoryTracker()
    rule_engine = BoundaryRuleEngine()
    workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)
    reporter = AuditReporter(snapshot_mgr, history_tracker, workflow)

    if args.command == "import":
        with open(args.file, "r", encoding="utf-8") as f:
            snapshots_data = json.load(f)
        imported, skipped = snapshot_mgr.import_snapshots(
            snapshots_data, source=args.source, imported_by=args.by
        )
        print(f"成功导入: {len(imported)} 条")
        print(f"跳过重复: {len(skipped)} 条")
        for rec in imported:
            print(f"  - {rec.snapshot_id} (原始行号: {rec.original_line_number})")

    elif args.command == "summary":
        print(reporter.print_summary())

    elif args.command == "show":
        audit = reporter.generate_snapshot_audit(args.snapshot_id, include_raw_data=True)
        print(json.dumps(audit, ensure_ascii=False, indent=2))

    elif args.command == "history":
        history = history_tracker.get_full_history(args.snapshot_id)
        print(json.dumps(history, ensure_ascii=False, indent=2))

    elif args.command == "workflow":
        if args.workflow_cmd == "step1":
            result = workflow.step_1_import(args.snapshot_id, args.by, args.notes)
            print(f"第一步完成: {result.snapshot_id} -> {result.status.value}")
        elif args.workflow_cmd == "step2":
            result = workflow.step_2_review_logs(
                args.snapshot_id, args.by, args.log_analysis, args.curve_findings
            )
            print(f"第二步完成: {result.snapshot_id} -> {result.status.value}")
        elif args.workflow_cmd == "step3":
            result = workflow.step_3_update_summary(
                args.snapshot_id,
                args.by,
                args.summary,
                click_bias_score=args.score,
                missing_features=args.missing_features,
                default_score_applied=args.default_score,
            )
            print(f"第三步完成: {result.snapshot_id} -> {result.status.value}")
            if result.status == ProcessingStatus.NEEDS_REVIEW:
                print("  ⚠️  已自动标记为需要推荐负责人复核")

    elif args.command == "audit":
        if args.snapshot_id:
            audit_data = reporter.generate_snapshot_audit(args.snapshot_id, include_raw_data=True)
            print(json.dumps(audit_data, ensure_ascii=False, indent=2))
            if args.save:
                msg = reporter.save_audit_report(args.snapshot_id)
                print(msg)
        elif args.batch_id:
            report = reporter.generate_batch_report(args.batch_id)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            if args.save:
                msg = reporter.save_batch_report(args.batch_id)
                print(msg)
        else:
            print("请指定 --snapshot-id 或 --batch-id")

    elif args.command == "replay":
        commands = reporter.generate_replay_commands(args.snapshot_id)
        print("\n".join(commands))
        if args.save:
            output_dir = Path("data/reports")
            output_dir.mkdir(parents=True, exist_ok=True)
            path = output_dir / f"replay_{args.snapshot_id}.py"
            with open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(commands))
            print(f"\n重放脚本已保存到: {path}")

    elif args.command == "review-list":
        report = reporter.generate_leader_review_report()
        print(json.dumps(report, ensure_ascii=False, indent=2))

    elif args.command == "approve":
        result = workflow.approve_review(
            args.snapshot_id, args.by, args.notes, args.mark_normal
        )
        print(f"复核通过: {result.snapshot_id} -> {result.status.value}")

    elif args.command == "reject":
        send_back = None
        if args.send_back_to == "step1":
            send_back = WorkflowStep.STEP_1_IMPORT
        elif args.send_back_to == "step2":
            send_back = WorkflowStep.STEP_2_REVIEW_LOGS
        elif args.send_back_to == "step3":
            send_back = WorkflowStep.STEP_3_UPDATE_SUMMARY

        result = workflow.reject_review(
            args.snapshot_id, args.by, args.notes, send_back
        )
        print(f"复核驳回: {result.snapshot_id} -> {result.status.value}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
