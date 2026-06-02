from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from .engine import Engine
from .models import (
    Annotation,
    ConflictCase,
    EvalLog,
    Stratum,
    ThresholdNote,
)
from .report import (
    export_results_csv,
    export_rerun_diff_json,
    format_result_detail,
    format_rerun_diff,
    format_run_summary,
)
from .store import Store

_DEFAULT_DB = "mab_eval.db"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mab_eval",
        description="广告创意多臂老虎机评测工具 — 去重、分层、溯源、重跑对比",
    )
    parser.add_argument("--db", default=_DEFAULT_DB, help="SQLite 数据库路径 (默认: mab_eval.db)")

    sub = parser.add_subparsers(dest="command", required=True)

    # --- ingest ---
    ing = sub.add_parser("ingest", help="导入评测日志、标注表、阈值备注、冲突案例")
    ing.add_argument("--eval-log", help="评测日志 CSV 文件路径")
    ing.add_argument("--annotation", help="标注表 CSV 文件路径")
    ing.add_argument("--threshold", help="阈值备注 CSV 文件路径")
    ing.add_argument("--conflict", help="冲突案例 CSV 文件路径")

    # --- evaluate ---
    eva = sub.add_parser("evaluate", help="执行评测（去重+分层+判定+溯源）")
    eva.add_argument("--run-id", help="指定 run_id，默认自动生成")

    # --- report ---
    rep = sub.add_parser("report", help="查看报告 / 导出结果")
    rep.add_argument("--run-id", help="指定 run_id，默认最新")
    rep.add_argument("--detail", action="store_true", help="显示每条样本明细")
    rep.add_argument("--export-csv", help="导出 CSV 到指定文件路径")
    rep.add_argument("--exceptions-only", action="store_true", help="只显示例外项")

    # --- trace ---
    tra = sub.add_parser("trace", help="追溯单条样本来源证据")
    tra.add_argument("creative_id", help="创意 ID")
    tra.add_argument("arm_name", help="臂名称")
    tra.add_argument("--run-id", help="指定 run_id，默认最新")

    # --- rerun ---
    rerun = sub.add_parser("rerun", help="重跑对比：指标变化 vs 样本变化分离解释")
    rerun.add_argument("--current-run", help="当前 run_id，默认最新")
    rerun.add_argument("--previous-run", help="前次 run_id，默认次新")
    rerun.add_argument("--export-json", help="导出对比 JSON 到指定文件路径")

    # --- list-runs ---
    sub.add_parser("list-runs", help="列出所有评测批次")

    return parser


def _load_csv(path: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def _cmd_ingest(args: argparse.Namespace, store: Store) -> None:
    engine = Engine(store)
    count = {"eval_log": 0, "annotation": 0, "threshold": 0, "conflict": 0}

    if args.eval_log:
        rows = _load_csv(args.eval_log)
        for row in rows:
            log = EvalLog(
                log_id=row["log_id"],
                creative_id=row["creative_id"],
                arm_name=row["arm_name"],
                impressions=int(row["impressions"]) if row.get("impressions") else None,
                clicks=int(row["clicks"]) if row.get("clicks") else None,
                conversions=float(row["conversions"]) if row.get("conversions") else None,
                revenue=float(row["revenue"]) if row.get("revenue") else None,
                ctr=float(row["ctr"]) if row.get("ctr") else None,
                cvr=float(row["cvr"]) if row.get("cvr") else None,
                source_file=args.eval_log,
                log_timestamp=datetime.fromisoformat(row["log_timestamp"]) if row.get("log_timestamp") else None,
            )
            engine.ingest_eval_log(log)
            count["eval_log"] += 1

    if args.annotation:
        rows = _load_csv(args.annotation)
        for row in rows:
            ann = Annotation(
                annotation_id=row["annotation_id"],
                creative_id=row["creative_id"],
                arm_name=row["arm_name"],
                label=row["label"],
                annotator=row["annotator"],
                note=row.get("note", ""),
                source_file=args.annotation,
                annotated_at=datetime.fromisoformat(row["annotated_at"]) if row.get("annotated_at") else None,
            )
            engine.ingest_annotation(ann)
            count["annotation"] += 1

    if args.threshold:
        rows = _load_csv(args.threshold)
        for row in rows:
            note = ThresholdNote(
                note_id=row["note_id"],
                metric=row["metric"],
                operator=row["operator"],
                threshold=float(row["threshold"]),
                stratum=row["stratum"],
                description=row.get("description", ""),
                source_file=args.threshold,
                created_at=datetime.fromisoformat(row["created_at"]) if row.get("created_at") else None,
            )
            engine.ingest_threshold_note(note)
            count["threshold"] += 1

    if args.conflict:
        rows = _load_csv(args.conflict)
        for row in rows:
            cc = ConflictCase(
                conflict_id=row["conflict_id"],
                creative_id=row["creative_id"],
                arm_name=row["arm_name"],
                eval_judgement=row["eval_judgement"],
                annotation_label=row["annotation_label"],
                reason=row["reason"],
                resolution=row.get("resolution") or None,
                source_file=args.conflict,
                detected_at=datetime.fromisoformat(row["detected_at"]) if row.get("detected_at") else None,
            )
            engine.ingest_conflict_case(cc)
            count["conflict"] += 1

    parts = []
    for k, v in count.items():
        if v > 0:
            parts.append(f"{k}={v}")
    print(f"导入完成: {', '.join(parts)}")


def _cmd_evaluate(args: argparse.Namespace, store: Store) -> None:
    engine = Engine(store)
    summary = engine.evaluate(run_id=args.run_id)
    print(format_run_summary(summary))


def _cmd_report(args: argparse.Namespace, store: Store) -> None:
    run_id = args.run_id
    if run_id is None:
        run_id = store.get_latest_run_id()
    if run_id is None:
        print("尚无评测结果，请先执行 evaluate", file=sys.stderr)
        return

    summary = store.get_run_summary(run_id)
    if summary is None:
        print(f"未找到 run_id={run_id}", file=sys.stderr)
        return

    print(format_run_summary(summary))

    results = store.list_results_by_run(run_id)

    if args.exceptions_only:
        results = [r for r in results if r.is_exception]

    if args.detail or args.exceptions_only:
        print("\n" + "=" * 60)
        label = "例外明细" if args.exceptions_only else "样本明细"
        print(f"--- {label} ---")
        for r in results:
            print()
            print(format_result_detail(r))

    if args.export_csv:
        path = export_results_csv(results, args.export_csv)
        print(f"\nCSV 已导出: {path}")


def _cmd_trace(args: argparse.Namespace, store: Store) -> None:
    engine = Engine(store)
    trace_data = engine.trace(args.creative_id, args.arm_name, run_id=args.run_id)
    if trace_data is None:
        print("未找到该样本的评测结果", file=sys.stderr)
        return

    result = trace_data["result"]
    log = trace_data["source_log"]
    annotation = trace_data["annotation"]
    conflict = trace_data["conflict"]

    print(format_result_detail(result))
    print()

    if log is not None:
        print("--- 原始评测日志 ---")
        print(f"  log_id: {log.log_id}")
        print(f"  来源文件: {log.source_file}")
        print(f"  导入时间: {log.ingested_at.isoformat()}")
        print(f"  日志时间: {log.log_timestamp.isoformat() if log.log_timestamp else '<无>'}")
        print(f"  impressions={log.impressions} clicks={log.clicks} conversions={log.conversions}")
        print(f"  revenue={log.revenue} ctr={log.ctr} cvr={log.cvr}")

    if annotation is not None:
        print()
        print("--- 标注信息 ---")
        print(f"  annotation_id: {annotation.annotation_id}")
        print(f"  来源文件: {annotation.source_file}")
        print(f"  标注人: {annotation.annotator}")
        print(f"  标签: {annotation.label}")
        print(f"  备注: {annotation.note}")
        print(f"  标注时间: {annotation.annotated_at.isoformat() if annotation.annotated_at else '<无>'}")

    if conflict is not None:
        print()
        print("--- 冲突案例 ---")
        print(f"  conflict_id: {conflict.conflict_id}")
        print(f"  来源文件: {conflict.source_file}")
        print(f"  评测判定: {conflict.eval_judgement}")
        print(f"  标注标签: {conflict.annotation_label}")
        print(f"  原因: {conflict.reason}")
        print(f"  解决: {conflict.resolution or '<未解决>'}")


def _cmd_rerun(args: argparse.Namespace, store: Store) -> None:
    engine = Engine(store)
    try:
        diff = engine.rerun_diff(
            current_run_id=args.current_run, previous_run_id=args.previous_run
        )
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        return

    print(format_rerun_diff(diff))

    if args.export_json:
        path = export_rerun_diff_json(diff, args.export_json)
        print(f"\nJSON 已导出: {path}")


def _cmd_list_runs(args: argparse.Namespace, store: Store) -> None:
    run_ids = store.list_run_ids()
    if not run_ids:
        print("尚无评测批次")
        return
    print("评测批次 (最新在前):")
    for i, rid in enumerate(run_ids):
        summary = store.get_run_summary(rid)
        if summary:
            print(
                f"  {rid}  样本={summary.total_samples} "
                f"去重={summary.unique_samples} 例外={summary.exception_count} "
                f"时间={summary.evaluated_at.strftime('%Y-%m-%d %H:%M:%S')}"
            )
        else:
            print(f"  {rid}")


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    store = Store(args.db)
    store.initialize()

    try:
        if args.command == "ingest":
            _cmd_ingest(args, store)
        elif args.command == "evaluate":
            _cmd_evaluate(args, store)
        elif args.command == "report":
            _cmd_report(args, store)
        elif args.command == "trace":
            _cmd_trace(args, store)
        elif args.command == "rerun":
            _cmd_rerun(args, store)
        elif args.command == "list-runs":
            _cmd_list_runs(args, store)
    finally:
        store.close()
