#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output"
DEFAULT_AUDIT_STORE = DEFAULT_OUTPUT_DIR / "audit_notes.json"


def cmd_review(args: argparse.Namespace) -> None:
    from core.detector import ConflictDetector
    from core.stratifier import Stratifier

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"[错误] 数据目录不存在: {data_dir}", file=sys.stderr)
        sys.exit(1)

    detector = ConflictDetector(data_dir)
    detector.load_data()
    model_version = args.model_version or None
    conflicts = detector.detect_all(model_version=model_version, audit_store_path=DEFAULT_AUDIT_STORE)

    print(f"\n{'='*60}")
    print(f"  医学影像标注冲突复核 — 冲突检测报告")
    print(f"{'='*60}")
    print(f"  数据目录: {data_dir}")
    if model_version:
        print(f"  模型版本筛选: {model_version}")
    print(f"  检出冲突总数: {len(conflicts)}")
    print(f"{'='*60}\n")

    stratifier = Stratifier(conflicts, detector.samples)
    summary = stratifier.summary()

    print("【分层统计】")
    print(f"  按严重程度: {json.dumps(summary['by_severity'], ensure_ascii=False)}")
    print(f"  按冲突类型: {json.dumps(summary['by_conflict_type'], ensure_ascii=False)}")
    print(f"  按影像模态: {json.dumps(summary['by_modality'], ensure_ascii=False)}")
    print(f"  按模型版本: {json.dumps(summary['by_model_version'], ensure_ascii=False)}")
    print()

    if not conflicts:
        print("  未检出冲突。")
        return

    print(f"{'─'*60}")
    print("【冲突明细】")
    for i, c in enumerate(conflicts, 1):
        sample = detector.samples.get(c.sample_id)
        print(f"\n  #{i} 冲突ID: {c.conflict_id}")
        print(f"     样本: {c.sample_id} | 患者: {sample.patient_id if sample else '?'} "
              f"| 模态: {sample.modality if sample else '?'} | 部位: {sample.body_part if sample else '?'}")
        print(f"     类型: {c.conflict_type.value} | 严重程度: {c.severity.value} | 模型版本: {c.model_version or 'N/A'}")
        print(f"     自动判定: {c.auto_judgment}")
        print(f"     证据链:")
        for ev in c.evidence_chain:
            print(f"       - 来源[{ev.source}] 标签={ev.label} 详情={ev.detail} 时间={ev.timestamp}")
        print(f"     涉及来源: {', '.join(c.sources_involved)}")
        print(f"     已解决: {'是' if c.resolved else '否'} | 检出时间: {c.detected_at}")

    if args.save_json:
        from core.exporter import Exporter

        output_path = DEFAULT_OUTPUT_DIR / args.save_json
        exporter = Exporter(conflicts, detector.samples)
        path = exporter.to_stratified_json(output_path, stratifier)
        print(f"\n  [导出] 分层JSON报告已保存: {path}")

    if args.save_csv:
        from core.exporter import Exporter

        output_path = DEFAULT_OUTPUT_DIR / args.save_csv
        exporter = Exporter(conflicts, detector.samples)
        path = exporter.to_csv(output_path)
        print(f"  [导出] CSV报告已保存: {path}")


def cmd_notes(args: argparse.Namespace) -> None:
    from core.auditor import Auditor

    auditor = Auditor(DEFAULT_AUDIT_STORE)

    if args.action == "add":
        note = auditor.add_note(
            target_id=args.target_id,
            operator=args.operator,
            note_content=args.content,
            prev_value=args.prev_value or "",
            new_value=args.new_value or "",
            target_type=args.target_type,
            source=args.source,
        )
        print(f"\n  [备注已添加]")
        print(f"    备注ID: {note.note_id}")
        print(f"    目标: {note.target_id} ({note.target_type})")
        print(f"    操作人: {note.operator}")
        print(f"    内容: {note.note_content}")
        if note.diff_description:
            print(f"    差异说明: {note.diff_description}")
        print(f"    原始来源: {note.source}")
        print(f"    时间: {note.created_at}")

    elif args.action == "resolve":
        from core.detector import ConflictDetector
        from core.models import ConflictRecord

        detector = ConflictDetector(Path(args.data_dir))
        detector.load_data()
        conflicts = detector.detect_all(model_version=args.model_version or None, audit_store_path=DEFAULT_AUDIT_STORE)

        target_conflict = None
        for c in conflicts:
            if c.conflict_id == args.conflict_id:
                target_conflict = c
                break
        if not target_conflict:
            print(f"[错误] 未找到冲突ID: {args.conflict_id}", file=sys.stderr)
            sys.exit(1)

        note = auditor.resolve_conflict(
            conflict=target_conflict,
            resolution=args.resolution,
            operator=args.operator,
        )
        print(f"\n  [冲突已解决]")
        print(f"    冲突ID: {args.conflict_id}")
        print(f"    处理结论: {args.resolution}")
        print(f"    操作人: {args.operator}")
        print(f"    差异说明: {note.diff_description}")
        print(f"    时间: {note.created_at}")

    elif args.action == "list":
        target_id = args.target_id
        if target_id:
            notes = auditor.get_notes_for(target_id)
        else:
            notes = auditor.get_all_notes()
        if not notes:
            print("  无备注记录。")
            return
        print(f"\n  {'='*50}")
        print(f"  备注列表 (共{len(notes)}条)")
        print(f"  {'='*50}")
        for n in notes:
            print(f"\n  备注ID: {n.note_id}")
            print(f"    目标: {n.target_id} ({n.target_type})")
            print(f"    操作人: {n.operator}")
            print(f"    内容: {n.note_content}")
            if n.diff_description:
                print(f"    差异说明: {n.diff_description}")
            if n.prev_value or n.new_value:
                print(f"    原值: {n.prev_value} → 新值: {n.new_value}")
            print(f"    原始来源: {n.source}")
            print(f"    时间: {n.created_at}")

    else:
        print("[错误] 未知备注操作，请使用 add / resolve / list", file=sys.stderr)
        sys.exit(1)


def cmd_export(args: argparse.Namespace) -> None:
    from core.auditor import Auditor
    from core.detector import ConflictDetector
    from core.exporter import Exporter
    from core.stratifier import Stratifier

    data_dir = Path(args.data_dir)
    detector = ConflictDetector(data_dir)
    detector.load_data()
    model_version = args.model_version or None
    conflicts = detector.detect_all(model_version=model_version, audit_store_path=DEFAULT_AUDIT_STORE)

    auditor = Auditor(DEFAULT_AUDIT_STORE)
    stratifier = Stratifier(conflicts, detector.samples)
    exporter = Exporter(conflicts, detector.samples, auditor)

    fmt = args.format
    if fmt == "csv":
        filename = args.output or "conflict_report.csv"
        path = exporter.to_csv(DEFAULT_OUTPUT_DIR / filename)
    elif fmt == "json":
        filename = args.output or "conflict_report.json"
        path = exporter.to_json(DEFAULT_OUTPUT_DIR / filename)
    elif fmt == "stratified":
        filename = args.output or "conflict_report_stratified.json"
        path = exporter.to_stratified_json(DEFAULT_OUTPUT_DIR / filename, stratifier)
    else:
        print(f"[错误] 不支持的格式: {fmt}", file=sys.stderr)
        sys.exit(1)

    print(f"\n  [导出完成]")
    print(f"    格式: {fmt}")
    print(f"    冲突数: {len(conflicts)}")
    print(f"    文件: {path}")


def cmd_init(args: argparse.Namespace) -> None:
    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    needed = ["samples.csv", "model_outputs.csv", "manual_corrections.csv", "online_feedback.csv"]
    print(f"\n  医学影像标注冲突复核 — 初始化")
    print(f"  {'='*50}")
    print(f"  数据目录: {data_dir}")
    print(f"  输出目录: {output_dir}")
    print()
    for name in needed:
        fp = data_dir / name
        status = "✓ 已存在" if fp.exists() else "✗ 缺失(请准备)"
        print(f"    {name}: {status}")
    print()
    print("  CSV格式要求:")
    print("    samples.csv:          sample_id,patient_id,image_path,modality,body_part,study_date")
    print("    model_outputs.csv:    sample_id,model_version,predicted_label,confidence,predicted_at")
    print("    manual_corrections.csv: sample_id,annotator_id,corrected_label,correction_reason,corrected_at")
    print("    online_feedback.csv:  sample_id,feedback_source,feedback_label,feedback_note,feedback_at")
    print()
    if data_dir == DEFAULT_DATA_DIR:
        print("  (样例数据已就绪，可直接运行 review 命令)")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="med_review",
        description="医学影像标注冲突复核工具",
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    p_init = sub.add_parser("init", help="初始化/检查数据目录")
    p_init.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    p_init.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))

    p_review = sub.add_parser("review", help="检测冲突并输出报告")
    p_review.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    p_review.add_argument("--model-version", default="", help="仅检测指定模型版本")
    p_review.add_argument("--save-json", default="", help="同时导出分层JSON(文件名)")
    p_review.add_argument("--save-csv", default="", help="同时导出CSV(文件名)")

    p_notes = sub.add_parser("notes", help="备注补录与管理")
    notes_sub = p_notes.add_subparsers(dest="action", help="备注操作")

    p_add = notes_sub.add_parser("add", help="添加备注")
    p_add.add_argument("--target-id", required=True, help="目标ID(冲突ID或样本ID)")
    p_add.add_argument("--operator", required=True, help="操作人")
    p_add.add_argument("--content", required=True, help="备注内容")
    p_add.add_argument("--prev-value", default="", help="变更前值")
    p_add.add_argument("--new-value", default="", help="变更后值")
    p_add.add_argument("--target-type", default="conflict", help="目标类型")
    p_add.add_argument("--source", default="manual_note", help="来源标识")

    p_resolve = notes_sub.add_parser("resolve", help="解决冲突")
    p_resolve.add_argument("--conflict-id", required=True, help="冲突ID")
    p_resolve.add_argument("--resolution", required=True, help="处理结论")
    p_resolve.add_argument("--operator", required=True, help="操作人")
    p_resolve.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    p_resolve.add_argument("--model-version", default="")

    p_list = notes_sub.add_parser("list", help="查看备注")
    p_list.add_argument("--target-id", default="", help="筛选目标ID(留空看全部)")

    p_export = sub.add_parser("export", help="导出报告")
    p_export.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    p_export.add_argument("--model-version", default="", help="仅导出指定模型版本")
    p_export.add_argument("--format", choices=["csv", "json", "stratified"], default="stratified")
    p_export.add_argument("--output", default="", help="输出文件名")

    args = parser.parse_args()
    if args.command == "init":
        cmd_init(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "notes":
        cmd_notes(args)
    elif args.command == "export":
        cmd_export(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
