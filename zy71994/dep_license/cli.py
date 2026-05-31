from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Optional

from .scanner import DependencyScanner
from .snapshot import SnapshotManager
from .history import HistoryManager
from .rollback import RollbackTracker
from .config_audit import ConfigAuditManager
from .reporter import Reporter


def _build_store_dir(store_dir: Optional[str]) -> str:
    if store_dir:
        return store_dir
    return os.path.join(os.getcwd(), ".dep_license_store")


def _build_components(store_dir: str):
    snapshot = SnapshotManager(store_dir)
    history = HistoryManager(store_dir)
    rollback = RollbackTracker(store_dir)
    config_audit = ConfigAuditManager(store_dir)
    reporter = Reporter(history, rollback, snapshot, config_audit)
    return snapshot, history, rollback, config_audit, reporter


def cmd_scan(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    snapshot, history, rollback, config_audit, reporter = _build_components(store_dir)

    base_path = os.path.abspath(args.path)

    snap = snapshot.take_snapshot(base_path, label=args.label or "scan_snapshot")

    detected_changes = []
    for fs in snap.files:
        change = config_audit.detect_changes(fs.path, fs.content)
        if change:
            detected_changes.append(change)

    scanner = DependencyScanner(base_path)
    entries = scanner.scan(snapshot_id=snap.snapshot_id)

    for entry in entries:
        rollback.enrich_entry_with_rollback_evidence(
            entry.package_name, entry.evidence_refs
        )

    config_change_ids = [c.change_id for c in detected_changes]

    run = history.record_run(
        entries=entries,
        snapshot_id=snap.snapshot_id,
        rollback_ids=[],
        config_change_ids=config_change_ids,
        operator=args.operator or "",
    )

    result = {
        "run_id": run.run_id,
        "status": run.status.value,
        "snapshot_id": snap.snapshot_id,
        "total_entries": len(entries),
        "config_changes_detected": len(detected_changes),
        "issues_count": len(run.issues),
        "summary": run.summary,
    }

    if run.issues:
        result["issues"] = [i.to_dict() for i in run.issues]

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if args.output:
        report = reporter.generate_full_report(run.run_id)
        reporter.export_report(report, args.output)
        print(f"\n报告已导出: {args.output}", file=sys.stderr)


def cmd_rollback(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    _, _, rollback, _, _ = _build_components(store_dir)

    record = rollback.record_rollback(
        target_package=args.package,
        target_version=args.version,
        previous_version=args.previous_version or "",
        reason=args.reason or "",
        operator=args.operator or "",
        snapshot_id=args.snapshot_id or "",
    )

    print(json.dumps(record.to_dict(), ensure_ascii=False, indent=2))


def cmd_history(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    _, history, _, _, _ = _build_components(store_dir)

    if args.run_id:
        run = history.get_run(args.run_id)
        if not run:
            print(f"未找到运行记录: {args.run_id}", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(run.to_dict(), ensure_ascii=False, indent=2))
    else:
        runs = history.list_runs()
        for run in runs:
            print(
                f"[{run.status.value}] {run.run_id} @ {run.timestamp} "
                f"({len(run.entries)} entries, {len(run.issues)} issues)"
            )


def cmd_trace(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    _, history, _, _, reporter = _build_components(store_dir)

    if args.type == "evidence":
        report = reporter.generate_evidence_chain_report(args.run_id)
    elif args.type == "duplicate":
        report = reporter.generate_duplicate_issue_report(args.run_id)
    elif args.type == "config":
        report = reporter.generate_config_reconciliation_report(args.run_id)
    elif args.type == "full":
        report = reporter.generate_full_report(args.run_id)
    else:
        report = reporter.generate_inventory_report(args.run_id)

    print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.output:
        reporter.export_report(report, args.output)
        print(f"\n报告已导出: {args.output}", file=sys.stderr)


def cmd_config_change(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    _, _, _, config_audit, _ = _build_components(store_dir)

    if args.detect:
        with open(args.file_path, "r", encoding="utf-8") as f:
            content = f.read()
        change = config_audit.detect_changes(args.file_path, content)
        if change:
            print(json.dumps(change.to_dict(), ensure_ascii=False, indent=2))
        else:
            print("无变更检测到")
    elif args.before and args.after:
        with open(args.before, "r", encoding="utf-8") as f:
            before_content = f.read()
        with open(args.after, "r", encoding="utf-8") as f:
            after_content = f.read()
        record = config_audit.record_change(
            file_path=args.file_path,
            before_content=before_content,
            after_content=after_content,
            operator=args.operator or "manual",
            note=args.note or "",
        )
        print(json.dumps(record.to_dict(), ensure_ascii=False, indent=2))
    elif args.history:
        changes = config_audit.get_change_history(args.file_path)
        for change in changes:
            print(
                f"[{change.change_id}] {change.file_path} "
                f"{change.before_hash} → {change.after_hash} "
                f"@ {change.timestamp} by {change.operator}"
            )
    else:
        print("请指定 --detect, --before/--after 或 --history", file=sys.stderr)
        sys.exit(1)


def cmd_snapshot(args: argparse.Namespace) -> None:
    store_dir = _build_store_dir(args.store_dir)
    snapshot, _, _, _, _ = _build_components(store_dir)

    if args.list:
        snapshots = snapshot.list_snapshots()
        for s in snapshots:
            print(f"[{s.snapshot_id}] {s.base_path} ({len(s.files)} files) @ {s.timestamp}")
    elif args.compare:
        parts = args.compare.split(",")
        if len(parts) != 2:
            print("--compare 需要两个快照ID，用逗号分隔", file=sys.stderr)
            sys.exit(1)
        diff = snapshot.compare_snapshots(parts[0], parts[1])
        print(json.dumps(diff, ensure_ascii=False, indent=2))
    else:
        snap = snapshot.take_snapshot(
            args.path, label=args.label or ""
        )
        print(json.dumps({"snapshot_id": snap.snapshot_id, "file_count": len(snap.files)}, ensure_ascii=False, indent=2))


def main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(
        prog="dep-license",
        description="依赖许可证清单管理工具 - 可追溯、幂等、配置审计",
    )
    parser.add_argument("--store-dir", default=None, help="数据存储目录")

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    scan_parser = subparsers.add_parser("scan", help="扫描依赖并生成许可证清单")
    scan_parser.add_argument("path", help="项目根目录")
    scan_parser.add_argument("--label", default="", help="快照标签")
    scan_parser.add_argument("--operator", default="", help="操作人")
    scan_parser.add_argument("--output", default="", help="报告输出路径")

    rb_parser = subparsers.add_parser("rollback", help="记录回滚操作")
    rb_parser.add_argument("--package", required=True, help="目标包名")
    rb_parser.add_argument("--version", required=True, help="回滚后版本")
    rb_parser.add_argument("--previous-version", default="", help="回滚前版本")
    rb_parser.add_argument("--reason", default="", help="回滚原因")
    rb_parser.add_argument("--operator", default="", help="操作人")
    rb_parser.add_argument("--snapshot-id", default="", help="关联快照ID")

    hist_parser = subparsers.add_parser("history", help="查看运行历史")
    hist_parser.add_argument("--run-id", default="", help="指定运行ID")

    trace_parser = subparsers.add_parser("trace", help="追溯证据链/生成报告")
    trace_parser.add_argument("run_id", help="运行ID")
    trace_parser.add_argument(
        "--type",
        default="inventory",
        choices=["inventory", "evidence", "duplicate", "config", "full"],
        help="报告类型",
    )
    trace_parser.add_argument("--output", default="", help="报告输出路径")

    cc_parser = subparsers.add_parser("config-change", help="配置变更审计")
    cc_parser.add_argument("file_path", help="配置文件路径")
    cc_parser.add_argument("--detect", action="store_true", help="自动检测变更")
    cc_parser.add_argument("--before", default="", help="变更前文件路径")
    cc_parser.add_argument("--after", default="", help="变更后文件路径")
    cc_parser.add_argument("--operator", default="manual", help="操作人")
    cc_parser.add_argument("--note", default="", help="备注")
    cc_parser.add_argument("--history", action="store_true", help="查看变更历史")

    snap_parser = subparsers.add_parser("snapshot", help="目录快照管理")
    snap_parser.add_argument("path", nargs="?", default=".", help="目标目录")
    snap_parser.add_argument("--label", default="", help="快照标签")
    snap_parser.add_argument("--list", action="store_true", help="列出所有快照")
    snap_parser.add_argument("--compare", default="", help="比较两个快照(ID1,ID2)")

    args = parser.parse_args(argv)

    if args.command == "scan":
        cmd_scan(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "trace":
        cmd_trace(args)
    elif args.command == "config-change":
        cmd_config_change(args)
    elif args.command == "snapshot":
        cmd_snapshot(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
