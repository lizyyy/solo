#!/usr/bin/env python3
import argparse
import json
import csv
import sys
from datetime import datetime
from typing import List

from .models import ModelOutput, ManualJudgment, ManualChangeType
from .reflow_engine import ReflowEngine
from .workflow import WorkflowManager
from .version_control import VersionController


def load_model_outputs(file_path: str) -> List[ModelOutput]:
    outputs = []
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        for idx, item in enumerate(data):
            outputs.append(
                ModelOutput(
                    sample_id=item["sample_id"],
                    original_line_number=item.get("original_line_number", idx + 1),
                    batch_id=item["batch_id"],
                    model_version=item.get("model_version", "unknown"),
                    content=item["content"],
                    predicted_label=item["predicted_label"],
                    confidence=item.get("confidence", 0.0),
                    risk_tags=item.get("risk_tags", []),
                    evidence_snippets=item.get("evidence_snippets", []),
                )
            )
    return outputs


def load_manual_judgments(file_path: str) -> List[ManualJudgment]:
    judgments = []
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        for item in data:
            judgments.append(
                ManualJudgment(
                    sample_id=item["sample_id"],
                    judgment_id=item["judgment_id"],
                    judge_person=item["judge_person"],
                    judgment_time=datetime.fromisoformat(item["judgment_time"])
                    if isinstance(item["judgment_time"], str)
                    else item["judgment_time"],
                    final_label=item["final_label"],
                    on_site_statement=item["on_site_statement"],
                    change_type=ManualChangeType(item.get("change_type", "label_change")),
                    changed_fields=item.get("changed_fields", []),
                    original_values=item.get("original_values", {}),
                    new_values=item.get("new_values", {}),
                    remarks=item.get("remarks"),
                )
            )
    return judgments


def cmd_import(args):
    engine = ReflowEngine()
    outputs = load_model_outputs(args.input)
    for output in outputs:
        engine.import_model_output(output, args.operator)

    details = engine.export_details()
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(details, f, ensure_ascii=False, indent=2, default=str)
    else:
        print(json.dumps(details, ensure_ascii=False, indent=2, default=str))
    print(f"已导入 {len(outputs)} 条模型输出", file=sys.stderr)


def cmd_supplement(args):
    engine = ReflowEngine()
    judgments = load_manual_judgments(args.input)
    for j in judgments:
        engine.add_manual_judgment(j, args.operator)

    details = engine.export_details()
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(details, f, ensure_ascii=False, indent=2, default=str)
    else:
        print(json.dumps(details, ensure_ascii=False, indent=2, default=str))
    print(f"已补充 {len(judgments)} 条人工改判", file=sys.stderr)


def cmd_workflow(args):
    engine = ReflowEngine()
    wf = WorkflowManager(engine, data_dir=args.data_dir)

    outputs = load_model_outputs(args.model_outputs) if args.model_outputs else []
    judgments = load_manual_judgments(args.manual_judgments) if args.manual_judgments else []

    result = wf.run_full_workflow(
        outputs=outputs,
        judgments=judgments,
        report_id=args.report_id,
        operator=args.operator,
        version=args.version,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


def cmd_report(args):
    engine = ReflowEngine()
    report = engine.generate_evaluation_report(
        report_id=args.report_id,
        operator=args.operator,
        version=args.version,
    )

    print(json.dumps(report.model_dump(), ensure_ascii=False, indent=2, default=str))


def cmd_export(args):
    engine = ReflowEngine()
    details = engine.export_details()

    if args.format == "json":
        print(json.dumps(details, ensure_ascii=False, indent=2, default=str))
    elif args.format == "csv":
        writer = csv.writer(sys.stdout)
        headers = [
            "sample_id",
            "status",
            "current_label",
            "is_covered",
            "covered_by_batch_id",
            "evidence_count",
            "manual_judgments_count",
            "active_judgment_id",
            "last_updated",
        ]
        writer.writerow(headers)
        for d in details:
            writer.writerow([d.get(h, "") for h in headers])


def cmd_rollback(args):
    engine = ReflowEngine()
    vc = VersionController(engine, data_dir=args.data_dir)

    if args.snapshot_id:
        result = vc.rollback_to_snapshot(args.snapshot_id, args.operator)
    else:
        result = vc.rollback_last_report(args.operator)

    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_snapshot(args):
    engine = ReflowEngine()
    vc = VersionController(engine, data_dir=args.data_dir)
    snap = vc.create_snapshot(args.operator, args.description)
    print(f"已创建快照: {snap.version_id}", file=sys.stderr)
    print(
        json.dumps(
            {
                "version_id": snap.version_id,
                "timestamp": snap.timestamp.isoformat(),
                "operator": snap.operator,
                "description": snap.description,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def cmd_list_snapshots(args):
    engine = ReflowEngine()
    vc = VersionController(engine, data_dir=args.data_dir)
    snaps = vc.get_snapshot_list()
    print(json.dumps(snaps, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        prog="content-safety-reflow",
        description="内容安全样本回流 - 合并模型输出与人工改判证据，支持可复盘记录与回滚",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="导入模型输出片段")
    p_import.add_argument("input", help="模型输出JSON文件路径")
    p_import.add_argument("--operator", required=True, help="操作人")
    p_import.add_argument("--output", "-o", help="输出结果文件路径")
    p_import.set_defaults(func=cmd_import)

    p_supp = subparsers.add_parser("supplement", help="补充人工改判表")
    p_supp.add_argument("input", help="人工改判JSON文件路径")
    p_supp.add_argument("--operator", required=True, help="操作人")
    p_supp.add_argument("--output", "-o", help="输出结果文件路径")
    p_supp.set_defaults(func=cmd_supplement)

    p_wf = subparsers.add_parser("workflow", help="执行完整三步工作流")
    p_wf.add_argument("--model-outputs", help="模型输出JSON文件路径")
    p_wf.add_argument("--manual-judgments", help="人工改判JSON文件路径")
    p_wf.add_argument("--report-id", required=True, help="评测报告ID")
    p_wf.add_argument("--operator", required=True, help="操作人")
    p_wf.add_argument("--version", type=int, default=1, help="报告版本号")
    p_wf.add_argument("--data-dir", default="./data", help="数据目录")
    p_wf.set_defaults(func=cmd_workflow)

    p_report = subparsers.add_parser("report", help="生成评测报告")
    p_report.add_argument("--report-id", required=True, help="报告ID")
    p_report.add_argument("--operator", required=True, help="操作人")
    p_report.add_argument("--version", type=int, default=1, help="版本号")
    p_report.set_defaults(func=cmd_report)

    p_export = subparsers.add_parser("export", help="导出回流明细")
    p_export.add_argument("--format", choices=["json", "csv"], default="json")
    p_export.set_defaults(func=cmd_export)

    p_snap = subparsers.add_parser("snapshot", help="创建版本快照")
    p_snap.add_argument("--operator", required=True, help="操作人")
    p_snap.add_argument("--description", required=True, help="快照描述")
    p_snap.add_argument("--data-dir", default="./data", help="数据目录")
    p_snap.set_defaults(func=cmd_snapshot)

    p_ls_snap = subparsers.add_parser("list-snapshots", help="列出所有快照")
    p_ls_snap.add_argument("--data-dir", default="./data", help="数据目录")
    p_ls_snap.set_defaults(func=cmd_list_snapshots)

    p_rollback = subparsers.add_parser("rollback", help="回滚操作")
    p_rollback.add_argument("--snapshot-id", help="目标快照ID")
    p_rollback.add_argument("--operator", required=True, help="操作人")
    p_rollback.add_argument("--data-dir", default="./data", help="数据目录")
    p_rollback.set_defaults(func=cmd_rollback)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
