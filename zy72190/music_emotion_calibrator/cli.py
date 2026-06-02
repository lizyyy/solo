from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import Calibrator
from .annotator import Annotator
from .reporter import Reporter


def _load_json(path: str) -> list[dict]:
    p = Path(path)
    if not p.exists():
        print(f"[WARN] 文件不存在: {path}", file=sys.stderr)
        return []
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def cmd_calibrate(args: argparse.Namespace) -> None:
    calibrator = Calibrator()

    samples = _load_json(args.samples)
    calibrator.load_samples(samples, source_file=args.samples)

    model_outputs = _load_json(args.model_outputs)
    calibrator.load_model_outputs(model_outputs, source_file=args.model_outputs)

    if args.manual_corrections:
        corrections = _load_json(args.manual_corrections)
        calibrator.load_manual_corrections(corrections, source_file=args.manual_corrections)

    if args.online_feedback:
        feedback = _load_json(args.online_feedback)
        calibrator.load_online_feedback(feedback, source_file=args.online_feedback)

    run = calibrator.calibrate()

    reporter = Reporter(run)

    if args.format == "text":
        report = reporter.generate_text_report()
    elif args.format == "json":
        report = reporter.generate_json_report()
    elif args.format == "csv":
        report = reporter.generate_csv_report()
    else:
        print(f"[ERROR] 不支持的格式: {args.format}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"[OK] 报告已写入: {args.output}")
        run_json_path = str(Path(args.output).with_suffix(".run.json"))
        with open(run_json_path, "w", encoding="utf-8") as f:
            f.write(run.to_json())
        print(f"[OK] 完整校准数据已写入: {run_json_path}")
    else:
        print(report)


def cmd_annotate(args: argparse.Namespace) -> None:
    run_path = Path(args.run_file)
    if not run_path.exists():
        print(f"[ERROR] 校准结果文件不存在: {run_path}", file=sys.stderr)
        sys.exit(1)

    with open(run_path, "r", encoding="utf-8") as f:
        run_data = json.load(f)

    from .models import CalibratorRun, CalibrationRecord, EvidenceChain, JudgmentSource, Annotation

    records = []
    for rd in run_data.get("records", []):
        chain_data = rd["evidence_chain"]
        chain = EvidenceChain(
            sample_id=chain_data["sample_id"],
            decision=chain_data["decision"],
            decision_source=JudgmentSource(chain_data["decision_source"]),
            evidence_items=chain_data["evidence_items"],
            reasoning=chain_data["reasoning"],
        )
        rec = CalibrationRecord(
            sample_id=rd["sample_id"],
            sample_fingerprint=rd["sample_fingerprint"],
            final_emotion=rd["final_emotion"],
            final_source=JudgmentSource(rd["final_source"]),
            evidence_chain=chain,
            model_prediction=rd["model_prediction"],
            model_confidence=rd["model_confidence"],
            model_version=rd["model_version"],
            manual_correction=rd.get("manual_correction"),
            online_feedback=rd.get("online_feedback"),
            agreement_status=rd["agreement_status"],
            processing_timestamp=rd["processing_timestamp"],
            original_source_file=rd.get("original_source_file", ""),
        )
        records.append(rec)

    annotations = []
    for ad in run_data.get("annotations", []):
        annotations.append(Annotation(**ad))

    run = CalibratorRun(
        run_id=run_data["run_id"],
        run_timestamp=run_data["run_timestamp"],
        input_files=run_data.get("input_files", {}),
        records=records,
        annotations=annotations,
        summary=run_data.get("summary", {}),
    )

    annotator = Annotator(run)
    annotation = annotator.add_annotation(
        sample_id=args.sample_id,
        text=args.text,
        annotator_id=args.annotator,
        new_emotion=args.new_emotion,
    )

    print(f"[OK] 备注已补录: sample_id={annotation.sample_id}")
    print(f"     差异说明: {annotation.diff_description}")

    diff = annotator.diff_summary()
    print(f"     补录统计: 总计{diff['total_annotations']}条, "
          f"情绪变更{diff['emotions_changed']}条, "
          f"情绪未变{diff['emotions_unchanged']}条")

    with open(run_path, "w", encoding="utf-8") as f:
        f.write(run.to_json())
    print(f"[OK] 校准数据已更新: {run_path}")


def cmd_report(args: argparse.Namespace) -> None:
    run_path = Path(args.run_file)
    if not run_path.exists():
        print(f"[ERROR] 校准结果文件不存在: {run_path}", file=sys.stderr)
        sys.exit(1)

    with open(run_path, "r", encoding="utf-8") as f:
        run_data = json.load(f)

    from .models import CalibratorRun, CalibrationRecord, EvidenceChain, JudgmentSource, Annotation

    records = []
    for rd in run_data.get("records", []):
        chain_data = rd["evidence_chain"]
        chain = EvidenceChain(
            sample_id=chain_data["sample_id"],
            decision=chain_data["decision"],
            decision_source=JudgmentSource(chain_data["decision_source"]),
            evidence_items=chain_data["evidence_items"],
            reasoning=chain_data["reasoning"],
        )
        rec = CalibrationRecord(
            sample_id=rd["sample_id"],
            sample_fingerprint=rd["sample_fingerprint"],
            final_emotion=rd["final_emotion"],
            final_source=JudgmentSource(rd["final_source"]),
            evidence_chain=chain,
            model_prediction=rd["model_prediction"],
            model_confidence=rd["model_confidence"],
            model_version=rd["model_version"],
            manual_correction=rd.get("manual_correction"),
            online_feedback=rd.get("online_feedback"),
            agreement_status=rd["agreement_status"],
            processing_timestamp=rd["processing_timestamp"],
            original_source_file=rd.get("original_source_file", ""),
        )
        records.append(rec)

    annotations = []
    for ad in run_data.get("annotations", []):
        annotations.append(Annotation(**ad))

    run = CalibratorRun(
        run_id=run_data["run_id"],
        run_timestamp=run_data["run_timestamp"],
        input_files=run_data.get("input_files", {}),
        records=records,
        annotations=annotations,
        summary=run_data.get("summary", {}),
    )

    reporter = Reporter(run)

    if args.format == "text":
        report = reporter.generate_text_report()
    elif args.format == "json":
        report = reporter.generate_json_report()
    elif args.format == "csv":
        report = reporter.generate_csv_report()
    else:
        print(f"[ERROR] 不支持的格式: {args.format}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"[OK] 报告已写入: {args.output}")
    else:
        print(report)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="music-emotion-calibrator",
        description="音乐情绪分类校准工具 — 重复评测、样本分层、证据链追溯、备注补录、报告导出",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    cal = sub.add_parser("calibrate", help="执行校准")
    cal.add_argument("--samples", required=True, help="样本数据 JSON 文件路径")
    cal.add_argument("--model-outputs", required=True, help="模型输出 JSON 文件路径")
    cal.add_argument("--manual-corrections", default="", help="人工修正 JSON 文件路径")
    cal.add_argument("--online-feedback", default="", help="线上反馈 JSON 文件路径")
    cal.add_argument("--format", choices=["text", "json", "csv"], default="text", help="报告格式")
    cal.add_argument("--output", default="", help="报告输出文件路径")

    ann = sub.add_parser("annotate", help="补录备注")
    ann.add_argument("--run-file", required=True, help="校准结果 .run.json 文件路径")
    ann.add_argument("--sample-id", required=True, help="目标样本 ID")
    ann.add_argument("--text", required=True, help="备注内容")
    ann.add_argument("--annotator", required=True, help="补录人标识")
    ann.add_argument("--new-emotion", default="", help="如需修正情绪则填入新情绪，否则留空")

    rep = sub.add_parser("report", help="从校准数据生成报告")
    rep.add_argument("--run-file", required=True, help="校准结果 .run.json 文件路径")
    rep.add_argument("--format", choices=["text", "json", "csv"], default="text", help="报告格式")
    rep.add_argument("--output", default="", help="报告输出文件路径")

    args = parser.parse_args(argv)

    if args.command == "calibrate":
        cmd_calibrate(args)
    elif args.command == "annotate":
        cmd_annotate(args)
    elif args.command == "report":
        cmd_report(args)


if __name__ == "__main__":
    main()
