#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from .storage import ResultStore
from .workflow import WorkflowEngine
from .diff_engine import DiffEngine
from .models import ProcessingStatus


def cmd_import(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    raw_data = {}
    if args.raw_data:
        raw_data = json.loads(args.raw_data)

    record = engine.step1_import_snapshot(
        snapshot_id=args.snapshot_id,
        original_line_number=args.line_number,
        main_flow=args.main_flow,
        raw_data=raw_data,
        online_score=args.online_score,
        offline_score=args.offline_score,
        source_file=args.source_file,
        sheet_name=args.sheet_name,
        imported_by=args.imported_by,
    )
    print(f"导入成功: record_id={record.record_id}, status={record.current_status.value}")
    print(f"记录步骤2和3需要使用: --record-id {record.record_id}")
    print(f"可重新执行命令: python3 -m online_offline_diff import --snapshot-id {args.snapshot_id} --line-number {args.line_number} --main-flow '{args.main_flow}' --online-score {args.online_score} --offline-score {args.offline_score}")


def cmd_review_logs(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    curve_data = {}
    if args.curve_data:
        curve_data = json.loads(args.curve_data)

    record = engine.step2_review_training_logs(
        record_id=args.record_id,
        on_site_statement=args.on_site_statement,
        curve_data=curve_data,
        reviewed_by=args.reviewed_by,
        reviewer_notes=args.notes,
    )
    print(f"日志审核完成: status={record.current_status.value}")
    if record.has_threshold_mismatch():
        print("⚠️  检测到阈值-报告不匹配，已标记为待数据科学家复核")


def cmd_update_metrics(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    tier_metrics = json.loads(args.tier_metrics)
    record = engine.step3_update_tier_metrics(
        record_id=args.record_id,
        tier_metrics=tier_metrics,
        updated_by=args.updated_by,
    )
    print(f"分层指标更新完成: status={record.current_status.value}")
    if record.has_threshold_mismatch():
        print("⚠️  检测到阈值-报告不匹配，已标记为待数据科学家复核")


def cmd_add_threshold_change(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    record = engine.add_threshold_change(
        record_id=args.record_id,
        field_name=args.field_name,
        old_value=args.old_value,
        new_value=args.new_value,
        changed_by=args.changed_by,
        change_reason=args.reason,
        report_still_shows_old=args.report_still_old,
    )
    print(f"阈值变更已记录: status={record.current_status.value}")
    if args.report_still_old:
        print("⚠️  报告仍显示旧阈值，记录标记为待复核")


def cmd_confirm(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    if args.status == "normal":
        record = engine.confirm_normal(
            record_id=args.record_id,
            confirmed_by=args.confirmed_by,
            notes=args.notes,
        )
    else:
        record = engine.confirm_abnormal(
            record_id=args.record_id,
            confirmed_by=args.confirmed_by,
            notes=args.notes,
        )
    print(f"确认完成: status={record.current_status.value}")


def cmd_list(args):
    store = ResultStore(data_dir=args.data_dir)
    status = ProcessingStatus(args.status) if args.status else None
    records = store.list_records(status=status)

    print(f"共 {len(records)} 条记录:")
    for r in records:
        mismatch = " ⚠️阈值不匹配" if r.has_threshold_mismatch() else ""
        print(
            f"  {r.record_id[:8]} | snapshot={r.snapshot_id} | "
            f"line={r.feature_snapshot.original_line_number if r.feature_snapshot else 'N/A'} | "
            f"diff={r.difference:.4f} ({r.percent_diff:.2f}%) | "
            f"status={r.current_status.value}{mismatch}"
        )


def cmd_show(args):
    store = ResultStore(data_dir=args.data_dir)
    record = store.get_record(args.record_id)
    if not record:
        print(f"记录 {args.record_id} 不存在")
        sys.exit(1)

    print(json.dumps(record.to_dict(), ensure_ascii=False, indent=2))

    print("\n--- 审计日志 ---")
    audits = store.get_audit_logs(args.record_id)
    for a in audits:
        old_s = a.old_status.value if a.old_status else "N/A"
        new_s = a.new_status.value if a.new_status else "N/A"
        print(
            f"  [{a.timestamp.isoformat()}] {a.actor}: {a.action} "
            f"({old_s} → {new_s})"
        )


def cmd_export(args):
    store = ResultStore(data_dir=args.data_dir)
    status = ProcessingStatus(args.status) if args.status else None
    output_path = store.export_records(
        output_path=args.output,
        status=status,
        include_threshold_changes=not args.no_threshold_changes,
        include_manual_changes=not args.no_manual_changes,
    )
    print(f"已导出到: {output_path}")


def cmd_summary(args):
    store = ResultStore(data_dir=args.data_dir)
    summary = store.get_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def cmd_rollback(args):
    store = ResultStore(data_dir=args.data_dir)
    engine = WorkflowEngine(store)

    target = ProcessingStatus(args.target_status)
    record = engine.rollback_status(
        record_id=args.record_id,
        target_status=target,
        rolled_back_by=args.rolled_back_by,
        reason=args.reason,
    )
    print(f"已回滚到: {record.current_status.value}")


def cmd_boundary_rules(args):
    rules = DiffEngine.get_boundary_rules()
    print("=== 线上离线打分差异 - 边界规则 ===")
    for key, rule in rules.items():
        print(f"\n{key}:")
        print(f"  {rule}")


def main():
    parser = argparse.ArgumentParser(
        prog="online-offline-diff",
        description="线上离线打分差异分析工具 - 支持复盘记录和可重跑命令",
    )
    parser.add_argument(
        "--data-dir", default="./data", help="数据存储目录 (默认: ./data)"
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_p = subparsers.add_parser("import", help="步骤1: 导入特征快照")
    import_p.add_argument("--snapshot-id", required=True, help="特征快照编号")
    import_p.add_argument("--line-number", type=int, required=True, help="原始行号")
    import_p.add_argument("--main-flow", required=True, help="主流程描述")
    import_p.add_argument("--online-score", type=float, required=True, help="线上分数")
    import_p.add_argument("--offline-score", type=float, required=True, help="离线分数")
    import_p.add_argument("--raw-data", help="原始数据 (JSON字符串)")
    import_p.add_argument("--source-file", help="源文件路径")
    import_p.add_argument("--sheet-name", help="Sheet名称")
    import_p.add_argument("--imported-by", default="system", help="导入人")
    import_p.set_defaults(func=cmd_import)

    review_p = subparsers.add_parser("review-logs", help="步骤2: 审核训练日志曲线")
    review_p.add_argument("--record-id", required=True, help="记录ID")
    review_p.add_argument("--on-site-statement", required=True, help="现场说法")
    review_p.add_argument("--curve-data", help="曲线数据 (JSON字符串)")
    review_p.add_argument("--reviewed-by", default="林姐", help="审核人")
    review_p.add_argument("--notes", help="审核备注")
    review_p.set_defaults(func=cmd_review_logs)

    metrics_p = subparsers.add_parser("update-metrics", help="步骤3: 更新分层指标")
    metrics_p.add_argument("--record-id", required=True, help="记录ID")
    metrics_p.add_argument("--tier-metrics", required=True, help="分层指标 (JSON字符串)")
    metrics_p.add_argument("--updated-by", default="林姐", help="更新人")
    metrics_p.set_defaults(func=cmd_update_metrics)

    thresh_p = subparsers.add_parser("add-threshold-change", help="记录阈值变更")
    thresh_p.add_argument("--record-id", required=True, help="记录ID")
    thresh_p.add_argument("--field-name", required=True, help="阈值字段名")
    thresh_p.add_argument("--old-value", type=float, required=True, help="旧值")
    thresh_p.add_argument("--new-value", type=float, required=True, help="新值")
    thresh_p.add_argument("--changed-by", required=True, help="变更人")
    thresh_p.add_argument("--reason", help="变更原因")
    thresh_p.add_argument(
        "--report-still-old",
        action="store_true",
        help="报告是否仍显示旧值 (设置则标记为待复核)",
    )
    thresh_p.set_defaults(func=cmd_add_threshold_change)

    confirm_p = subparsers.add_parser("confirm", help="数据科学家确认终态")
    confirm_p.add_argument("--record-id", required=True, help="记录ID")
    confirm_p.add_argument(
        "--status", required=True, choices=["normal", "abnormal"], help="确认结果"
    )
    confirm_p.add_argument("--confirmed-by", default="林姐", help="确认人")
    confirm_p.add_argument("--notes", help="确认备注")
    confirm_p.set_defaults(func=cmd_confirm)

    list_p = subparsers.add_parser("list", help="列出记录")
    list_p.add_argument("--status", help="按状态过滤")
    list_p.set_defaults(func=cmd_list)

    show_p = subparsers.add_parser("show", help="显示记录详情和审计日志")
    show_p.add_argument("--record-id", required=True, help="记录ID")
    show_p.set_defaults(func=cmd_show)

    export_p = subparsers.add_parser("export", help="导出记录明细")
    export_p.add_argument("--output", default="./export/records.json", help="输出路径")
    export_p.add_argument("--status", help="按状态过滤")
    export_p.add_argument(
        "--no-threshold-changes", action="store_true", help="不包含阈值变更"
    )
    export_p.add_argument(
        "--no-manual-changes", action="store_true", help="不包含人工改动"
    )
    export_p.set_defaults(func=cmd_export)

    summary_p = subparsers.add_parser("summary", help="查看汇总统计")
    summary_p.set_defaults(func=cmd_summary)

    rollback_p = subparsers.add_parser("rollback", help="回滚状态")
    rollback_p.add_argument("--record-id", required=True, help="记录ID")
    rollback_p.add_argument("--target-status", required=True, help="目标状态")
    rollback_p.add_argument("--rolled-back-by", required=True, help="操作人")
    rollback_p.add_argument("--reason", required=True, help="回滚原因")
    rollback_p.set_defaults(func=cmd_rollback)

    rules_p = subparsers.add_parser("boundary-rules", help="查看边界规则")
    rules_p.set_defaults(func=cmd_boundary_rules)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
