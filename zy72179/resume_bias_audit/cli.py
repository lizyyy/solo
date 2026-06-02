#!/usr/bin/env python3
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from loader import DataLoader
from aligner import DataAligner
from auditor import BiasAuditor
from stratify import Stratifier
from tracker import ChangeTracker
from report import ReportExporter


def cmd_load(args):
    loader = DataLoader(id_field=args.id_field)
    sources = {
        "sample": args.samples,
        "model_output": args.model_output,
        "manual_correction": args.manual_correction,
        "online_feedback": args.online_feedback,
    }
    loaded_any = False
    for name, path in sources.items():
        if path is None:
            continue
        if not os.path.exists(path):
            print(f"[错误] 文件不存在: {path}")
            continue
        ext = os.path.splitext(path)[1].lower()
        if ext == ".csv":
            data = loader.load_csv(path, source_name=name)
        elif ext == ".json":
            data = loader.load_json(path, source_name=name)
        else:
            print(f"[错误] 不支持的文件格式: {ext} ({path})")
            continue
        loaded_any = True
        print(f"[加载] {name}: {len(data.records)} 条记录, 来自 {path}")
        if data.validation.warnings:
            for w in data.validation.warnings:
                print(f"  [警告] {w}")

    if not loaded_any:
        print("[错误] 未加载任何数据")
        return

    print()
    print(loader.get_validation_summary())

    if args.save_state:
        state = {}
        for name, data in loader.loaded.items():
            state[name] = data.records
        os.makedirs(os.path.dirname(args.save_state) or ".", exist_ok=True)
        with open(args.save_state, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        print(f"\n[保存] 数据状态已保存到 {args.save_state}")

    return loader


def cmd_audit(args):
    loader = _load_all(args)
    if loader is None:
        return

    aligner = DataAligner(id_field=args.id_field)
    alignment = aligner.align(loader.loaded)
    print(alignment.summary())

    auditor = BiasAuditor(
        score_diff_threshold=args.threshold,
        boundary_score=args.boundary,
    )
    audit_result = auditor.audit(alignment)
    print()
    print(audit_result.summary())

    tracker = ChangeTracker(history_dir=args.history_dir)
    tracker.load_history()
    remarks = _load_remarks(args.remarks_file)
    snapshot = tracker.save_snapshot(audit_result, remarks=remarks)
    print(f"\n[快照] 已保存运行快照: run_{snapshot.run_id}")

    if tracker.history and len(tracker.history) > 1:
        prev = tracker.history[-2]
        diff = tracker.diff(prev, snapshot)
        print(diff.summary())

    stratification_results = None
    if args.stratify:
        stratifier = Stratifier(score_diff_threshold=args.threshold)
        stratification_results = stratifier.stratify_multi(
            alignment, audit_result, args.stratify
        )
        for dim, sr in stratification_results.items():
            print()
            print(sr.summary())

    if args.export:
        exporter = ReportExporter(output_dir=args.output_dir)
        fmt = args.format or "json"
        if fmt == "json":
            path = exporter.export_json(
                audit_result, alignment, stratification_results,
                diff_result=diff if tracker.history and len(tracker.history) > 1 else None,
                remarks=remarks,
            )
        elif fmt == "csv":
            path = exporter.export_csv(audit_result, alignment)
        elif fmt == "txt":
            path = exporter.export_text_summary(
                audit_result, alignment, stratification_results,
                diff_result=diff if tracker.history and len(tracker.history) > 1 else None,
            )
        else:
            path = exporter.export_json(audit_result, alignment, stratification_results, remarks=remarks)
        print(f"\n[导出] 报告已保存到: {path}")


def cmd_stratify(args):
    loader = _load_all(args)
    if loader is None:
        return

    aligner = DataAligner(id_field=args.id_field)
    alignment = aligner.align(loader.loaded)

    auditor = BiasAuditor(score_diff_threshold=args.threshold)
    audit_result = auditor.audit(alignment)

    stratifier = Stratifier(score_diff_threshold=args.threshold)
    dimensions = args.dimensions.split(",") if args.dimensions else ["gender", "age_group", "education"]
    results = stratifier.stratify_multi(alignment, audit_result, dimensions)
    for dim, sr in results.items():
        print(sr.summary())

    if args.export:
        exporter = ReportExporter(output_dir=args.output_dir)
        path = exporter.export_json(audit_result, alignment, stratification_results=results)
        print(f"\n[导出] 报告已保存到: {path}")


def cmd_export(args):
    loader = _load_all(args)
    if loader is None:
        return

    aligner = DataAligner(id_field=args.id_field)
    alignment = aligner.align(loader.loaded)

    auditor = BiasAuditor(score_diff_threshold=args.threshold)
    audit_result = auditor.audit(alignment)

    stratification_results = None
    if args.stratify:
        stratifier = Stratifier(score_diff_threshold=args.threshold)
        dimensions = args.stratify.split(",")
        stratification_results = stratifier.stratify_multi(alignment, audit_result, dimensions)

    remarks = _load_remarks(args.remarks_file)

    exporter = ReportExporter(output_dir=args.output_dir)
    fmt = args.format or "json"
    if fmt == "json":
        path = exporter.export_json(audit_result, alignment, stratification_results, remarks=remarks)
    elif fmt == "csv":
        path = exporter.export_csv(audit_result, alignment)
    elif fmt == "txt":
        path = exporter.export_text_summary(audit_result, alignment, stratification_results)
    else:
        path = exporter.export_json(audit_result, alignment, stratification_results, remarks=remarks)
    print(f"[导出] 报告已保存到: {path}")


def cmd_diff(args):
    tracker = ChangeTracker(history_dir=args.history_dir)
    tracker.load_history()

    if len(tracker.history) < 2:
        print("[错误] 至少需要两次运行快照才能做差异分析")
        return

    if args.run_a and args.run_b:
        snap_a = next((s for s in tracker.history if s.run_id == args.run_a), None)
        snap_b = next((s for s in tracker.history if s.run_id == args.run_b), None)
        if not snap_a or not snap_b:
            print(f"[错误] 找不到指定的运行快照: {args.run_a} / {args.run_b}")
            return
    else:
        snap_a = tracker.history[-2]
        snap_b = tracker.history[-1]

    diff = tracker.diff(snap_a, snap_b)
    print(diff.summary())

    if args.export:
        exporter = ReportExporter(output_dir=args.output_dir)
        report = {
            "diff_analysis": {
                "run_a": snap_a.run_id,
                "run_b": snap_b.run_id,
                "metric_changes": diff.metric_changes,
                "sample_changes": diff.sample_changes,
                "new_remarks": diff.new_remarks,
                "explanation": diff.explanation,
            }
        }
        filepath = os.path.join(
            args.output_dir or "audit_reports",
            f"diff_{snap_a.run_id}_vs_{snap_b.run_id}.json",
        )
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n[导出] 差异报告已保存到: {filepath}")


def cmd_remark(args):
    tracker = ChangeTracker(history_dir=args.history_dir)
    tracker.load_history()

    if not tracker.history:
        print("[错误] 没有已保存的运行快照，请先运行 audit")
        return

    latest = tracker.history[-1]
    updated = tracker.add_remark(latest, args.record_id, args.text)
    print(f"[补录] 已为 ID={args.record_id} 添加备注: {args.text}")
    print(f"  快照: run_{updated.run_id}")


def cmd_history(args):
    tracker = ChangeTracker(history_dir=args.history_dir)
    tracker.load_history()

    if not tracker.history:
        print("[信息] 没有历史运行记录")
        return

    for snap in tracker.history:
        print(f"  Run: {snap.run_id}, 时间: {snap.timestamp}, 记录数: {snap.total_records}")
        if snap.remarks:
            for r in snap.remarks:
                print(f"    备注: ID={r['id']}, 内容={r['remark']}")


def _load_all(args):
    loader = DataLoader(id_field=args.id_field)

    if hasattr(args, "state_file") and args.state_file:
        if not os.path.exists(args.state_file):
            print(f"[错误] 状态文件不存在: {args.state_file}")
            return None
        with open(args.state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
        for name, records in state.items():
            from loader import LoadedData
            loaded = LoadedData(source_name=name, records=records, id_field=args.id_field)
            loaded.validation = loader._validate(loaded)
            loader.loaded[name] = loaded
            print(f"[加载] {name}: {len(loaded.records)} 条记录, 来自状态文件")
            if loaded.validation.warnings:
                for w in loaded.validation.warnings:
                    print(f"  [警告] {w}")
    else:
        sources = {
            "sample": getattr(args, "samples", None),
            "model_output": getattr(args, "model_output", None),
            "manual_correction": getattr(args, "manual_correction", None),
            "online_feedback": getattr(args, "online_feedback", None),
        }
        loaded_any = False
        for name, path in sources.items():
            if path is None:
                continue
            if not os.path.exists(path):
                print(f"[错误] 文件不存在: {path}")
                continue
            ext = os.path.splitext(path)[1].lower()
            if ext == ".csv":
                data = loader.load_csv(path, source_name=name)
            elif ext == ".json":
                data = loader.load_json(path, source_name=name)
            else:
                continue
            loaded_any = True
            print(f"[加载] {name}: {len(data.records)} 条记录, 来自 {path}")
            if data.validation.warnings:
                for w in data.validation.warnings:
                    print(f"  [警告] {w}")

        if not loaded_any:
            print("[错误] 未加载任何数据，请提供数据文件或状态文件")
            return None

    print()
    print(loader.get_validation_summary())
    return loader


def _load_remarks(remarks_file):
    if remarks_file is None:
        return None
    if not os.path.exists(remarks_file):
        print(f"[警告] 备注文件不存在: {remarks_file}")
        return None
    with open(remarks_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def main():
    parser = argparse.ArgumentParser(
        prog="resume_bias_audit",
        description="简历匹配偏差审计工具 - 风控算法运营专用",
    )
    parser.add_argument("--id-field", default="id", help="记录ID字段名 (默认: id)")
    parser.add_argument("--history-dir", default=".audit_history", help="历史快照目录")
    parser.add_argument("--output-dir", default="audit_reports", help="报告输出目录")

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    load_parser = subparsers.add_parser("load", help="加载并校验数据")
    load_parser.add_argument("--samples", help="样本数据文件 (CSV/JSON)")
    load_parser.add_argument("--model-output", help="模型输出数据文件")
    load_parser.add_argument("--manual-correction", help="人工修正数据文件")
    load_parser.add_argument("--online-feedback", help="线上反馈数据文件")
    load_parser.add_argument("--save-state", help="保存加载状态到文件")

    audit_parser = subparsers.add_parser("audit", help="执行偏差审计")
    audit_parser.add_argument("--samples", help="样本数据文件")
    audit_parser.add_argument("--model-output", help="模型输出数据文件")
    audit_parser.add_argument("--manual-correction", help="人工修正数据文件")
    audit_parser.add_argument("--online-feedback", help="线上反馈数据文件")
    audit_parser.add_argument("--state-file", help="从 load 保存的状态文件加载")
    audit_parser.add_argument("--threshold", type=float, default=0.3, help="偏差阈值 (默认: 0.3)")
    audit_parser.add_argument("--boundary", type=float, default=0.05, help="边界分数区间 (默认: 0.05)")
    audit_parser.add_argument("--stratify", nargs="+", help="分层维度 (gender,age_group,education,experience)")
    audit_parser.add_argument("--remarks-file", help="补录备注 JSON 文件")
    audit_parser.add_argument("--export", action="store_true", help="同时导出报告")
    audit_parser.add_argument("--format", choices=["json", "csv", "txt"], default="json", help="导出格式")

    stratify_parser = subparsers.add_parser("stratify", help="样本分层统计")
    stratify_parser.add_argument("--samples", help="样本数据文件")
    stratify_parser.add_argument("--model-output", help="模型输出数据文件")
    stratify_parser.add_argument("--manual-correction", help="人工修正数据文件")
    stratify_parser.add_argument("--online-feedback", help="线上反馈数据文件")
    stratify_parser.add_argument("--state-file", help="从状态文件加载")
    stratify_parser.add_argument("--dimensions", default="gender,age_group,education", help="分层维度(逗号分隔)")
    stratify_parser.add_argument("--threshold", type=float, default=0.3)
    stratify_parser.add_argument("--export", action="store_true")
    stratify_parser.add_argument("--output-dir", default="audit_reports")

    export_parser = subparsers.add_parser("export", help="导出审计报告")
    export_parser.add_argument("--samples", help="样本数据文件")
    export_parser.add_argument("--model-output", help="模型输出数据文件")
    export_parser.add_argument("--manual-correction", help="人工修正数据文件")
    export_parser.add_argument("--online-feedback", help="线上反馈数据文件")
    export_parser.add_argument("--state-file", help="从状态文件加载")
    export_parser.add_argument("--threshold", type=float, default=0.3)
    export_parser.add_argument("--stratify", help="分层维度(逗号分隔)")
    export_parser.add_argument("--remarks-file", help="补录备注 JSON 文件")
    export_parser.add_argument("--format", choices=["json", "csv", "txt"], default="json")
    export_parser.add_argument("--output-dir", default="audit_reports")

    diff_parser = subparsers.add_parser("diff", help="对比两次运行差异")
    diff_parser.add_argument("--run-a", help="前次运行ID")
    diff_parser.add_argument("--run-b", help="后次运行ID")
    diff_parser.add_argument("--export", action="store_true")
    diff_parser.add_argument("--output-dir", default="audit_reports")

    remark_parser = subparsers.add_parser("remark", help="补录备注")
    remark_parser.add_argument("record_id", help="记录ID")
    remark_parser.add_argument("text", help="备注内容")
    remark_parser.add_argument("--history-dir", default=".audit_history")

    history_parser = subparsers.add_parser("history", help="查看历史运行记录")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    commands = {
        "load": cmd_load,
        "audit": cmd_audit,
        "stratify": cmd_stratify,
        "export": cmd_export,
        "diff": cmd_diff,
        "remark": cmd_remark,
        "history": cmd_history,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
