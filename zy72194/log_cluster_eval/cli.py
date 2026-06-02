#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

from .conflict import ConflictDetector
from .correction import CorrectionManager, FeedbackManager
from .dedup import DedupManager, Stratifier
from .evaluate import EvaluationEngine
from .models import (
    ConflictResolution,
    Correction,
    EvalStatus,
    OnlineFeedback,
    Sample,
)
from .report import ReportGenerator
from .store import Store


def _json_print(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def cmd_import(args):
    store = Store(args.db)
    dedup = DedupManager(store)
    samples = DedupManager.load_samples_from_file(args.file)
    results = dedup.import_samples(samples, skip_duplicates=not args.force)
    _json_print([r.to_dict() for r in results])
    inserted = sum(1 for r in results if r.action == "inserted")
    updated = sum(1 for r in results if r.action == "updated")
    skipped = sum(1 for r in results if r.action == "skipped")
    print(f"导入完成: 新增 {inserted}, 更新 {updated}, 跳过重复 {skipped}", file=sys.stderr)
    store.close()


def cmd_evaluate(args):
    store = Store(args.db)
    engine = EvaluationEngine(store, model_version=args.model_version)

    if args.sample_id:
        sample = store.get_sample(args.sample_id)
        if sample is None:
            print(f"错误: 样本 {args.sample_id} 不存在", file=sys.stderr)
            sys.exit(1)
        ev = engine.evaluate_sample(sample)
        _json_print(ev.to_dict())
    elif args.model_output:
        outputs = EvaluationEngine.load_model_outputs(args.model_output)
        results = []
        for out in outputs:
            sid = out["sample_id"]
            ev = engine.apply_model_output(
                sample_id=sid,
                cluster_label=out.get("cluster_label", "unknown"),
                root_cause=out.get("root_cause", ""),
                confidence=out.get("confidence", 0.0),
                evidence=out.get("evidence"),
            )
            results.append(ev.to_dict())
        _json_print(results)
        print(f"评测完成: {len(results)} 条", file=sys.stderr)
    elif args.all:
        samples = store.list_samples()
        results = engine.evaluate_batch(samples)
        _json_print([r.to_dict() for r in results])
        print(f"全量评测完成: {len(results)} 条", file=sys.stderr)
    else:
        print("请指定 --sample-id, --model-output 或 --all", file=sys.stderr)
        sys.exit(1)
    store.close()


def cmd_detect_conflicts(args):
    store = Store(args.db)
    detector = ConflictDetector(store)
    if args.sample_id:
        conflicts = detector.detect_conflicts(args.sample_id)
    else:
        conflicts = detector.detect_all()
    _json_print([c.to_dict() for c in conflicts])
    print(f"检测完成: 发现 {len(conflicts)} 个冲突", file=sys.stderr)
    store.close()


def cmd_resolve_conflict(args):
    store = Store(args.db)
    detector = ConflictDetector(store)
    cf = detector.resolve_conflict(
        conflict_id=args.conflict_id,
        resolution=ConflictResolution(args.resolution),
        detail=args.detail,
        apply_to_eval=not args.no_apply,
    )
    _json_print(cf.to_dict())
    store.close()


def cmd_correct(args):
    store = Store(args.db)
    mgr = CorrectionManager(store)
    if args.file:
        corrections = CorrectionManager.load_corrections_from_file(args.file)
        results = []
        for c in corrections:
            eval_id = c.get("eval_id", "")
            if eval_id in ("", "FIND_LATEST") or c.get("eval_id_for_sample"):
                sample_id = c.get("eval_id_for_sample", c.get("sample_id", ""))
                latest = store.get_latest_evaluation(sample_id)
                if latest is None:
                    print(f"  ⚠ 找不到样本 {sample_id} 的评测记录，跳过", file=sys.stderr)
                    continue
                eval_id = latest.eval_id
            cor = mgr.apply_correction(
                eval_id=eval_id,
                field_corrected=c["field_corrected"],
                old_value=c["old_value"],
                new_value=c["new_value"],
                corrector=c["corrector"],
                reason=c["reason"],
            )
            results.append(cor.to_dict())
        _json_print(results)
    else:
        cor = mgr.apply_correction(
            eval_id=args.eval_id,
            field_corrected=args.field,
            old_value=args.old,
            new_value=args.new,
            corrector=args.corrector,
            reason=args.reason,
        )
        _json_print(cor.to_dict())
    store.close()


def cmd_review(args):
    store = Store(args.db)
    mgr = CorrectionManager(store)
    cor = mgr.mark_for_review(
        eval_id=args.eval_id,
        reviewer=args.reviewer,
        reason=args.reason,
    )
    _json_print(cor.to_dict())
    store.close()


def cmd_feedback(args):
    store = Store(args.db)
    mgr = FeedbackManager(store)
    if args.file:
        items = FeedbackManager.load_feedback_from_file(args.file)
        results = []
        for item in items:
            fb = mgr.add_feedback(
                sample_id=item["sample_id"],
                feedback_type=item["feedback_type"],
                feedback_content=item["feedback_content"],
                reporter=item["reporter"],
            )
            results.append(fb.to_dict())
        _json_print(results)
    else:
        fb = mgr.add_feedback(
            sample_id=args.sample_id,
            feedback_type=args.feedback_type,
            feedback_content=args.content,
            reporter=args.reporter,
        )
        _json_print(fb.to_dict())
    store.close()


def cmd_report(args):
    store = Store(args.db)
    gen = ReportGenerator(store)
    if args.format == "json":
        path = gen.export_json(args.output)
    else:
        path = gen.export_markdown(args.output)
    print(f"报告已导出: {path}", file=sys.stderr)
    if args.print_report:
        report = gen.generate()
        _json_print(report) if args.format == "json" else print(Path(path).read_text(encoding="utf-8"))
    store.close()


def cmd_stratify(args):
    store = Store(args.db)
    strat = Stratifier(store)
    layers = strat.stratify()
    _json_print(layers)
    store.close()


def cmd_list(args):
    store = Store(args.db)
    if args.what == "samples":
        items = store.list_samples(source=args.filter)
        _json_print([
            {"sample_id": s.sample_id, "source": s.source,
             "fingerprint": s.fingerprint, "imported_at": s.imported_at,
             "raw_log_preview": s.raw_log[:80]}
            for s in items
        ])
    elif args.what == "evaluations":
        items = store.list_evaluations(status=args.filter)
        _json_print([e.to_dict() for e in items])
    elif args.what == "conflicts":
        items = store.list_conflicts(resolution=args.filter)
        _json_print([c.to_dict() for c in items])
    elif args.what == "feedback":
        items = store.list_feedback()
        _json_print([fb.to_dict() for fb in items])
    store.close()


def cmd_pipeline(args):
    store = Store(args.db)
    dedup = DedupManager(store)
    engine = EvaluationEngine(store, model_version=args.model_version)
    detector = ConflictDetector(store)
    corr_mgr = CorrectionManager(store)
    fb_mgr = FeedbackManager(store)
    reporter = ReportGenerator(store)

    print("=== 第1步: 导入样本 ===", file=sys.stderr)
    samples = DedupManager.load_samples_from_file(args.samples)
    dedup_results = dedup.import_samples(samples, skip_duplicates=True)
    for r in dedup_results:
        tag = "✓" if r.action != "skipped" else "⊘"
        print(f"  {tag} {r.sample_id}: {r.action}", file=sys.stderr)

    print("\n=== 第2步: 模型评测 ===", file=sys.stderr)
    if args.model_output:
        outputs = EvaluationEngine.load_model_outputs(args.model_output)
        for out in outputs:
            ev = engine.apply_model_output(
                sample_id=out["sample_id"],
                cluster_label=out.get("cluster_label", "unknown"),
                root_cause=out.get("root_cause", ""),
                confidence=out.get("confidence", 0.0),
                evidence=out.get("evidence"),
            )
            print(f"  ✓ {ev.eval_id} → [{ev.cluster_label}] {ev.root_cause} (conf={ev.confidence})", file=sys.stderr)
    else:
        all_samples = store.list_samples()
        evals = engine.evaluate_batch(all_samples)
        for ev in evals:
            print(f"  ✓ {ev.eval_id} → [{ev.cluster_label}] {ev.root_cause} (conf={ev.confidence})", file=sys.stderr)

    print("\n=== 第3步: 冲突检测 ===", file=sys.stderr)
    conflicts = detector.detect_all()
    if conflicts:
        for cf in conflicts:
            print(f"  ⚠ {cf.conflict_id}: 模型={cf.model_claim} vs 导入={cf.imported_claim}", file=sys.stderr)
            print(f"    建议: {cf.suggested_action}", file=sys.stderr)
    else:
        print("  无冲突", file=sys.stderr)

    if args.corrections:
        print("\n=== 第4步: 人工修正 ===", file=sys.stderr)
        corr_items = CorrectionManager.load_corrections_from_file(args.corrections)
        for c in corr_items:
            eval_id = c.get("eval_id", "")
            if eval_id in ("", "FIND_LATEST") or c.get("eval_id_for_sample"):
                sample_id = c.get("eval_id_for_sample", c.get("sample_id", ""))
                latest = store.get_latest_evaluation(sample_id)
                if latest is None:
                    print(f"  ⚠ 找不到样本 {sample_id} 的评测记录，跳过", file=sys.stderr)
                    continue
                eval_id = latest.eval_id
            cor = corr_mgr.apply_correction(
                eval_id=eval_id,
                field_corrected=c["field_corrected"],
                old_value=c["old_value"],
                new_value=c["new_value"],
                corrector=c["corrector"],
                reason=c["reason"],
            )
            print(f"  ✓ {cor.correction_id}: {cor.field_corrected} {cor.old_value} → {cor.new_value} (by {cor.corrector})", file=sys.stderr)

    if args.feedback:
        print("\n=== 第5步: 线上反馈 ===", file=sys.stderr)
        fb_items = FeedbackManager.load_feedback_from_file(args.feedback)
        for item in fb_items:
            fb = fb_mgr.add_feedback(
                sample_id=item["sample_id"],
                feedback_type=item["feedback_type"],
                feedback_content=item["feedback_content"],
                reporter=item["reporter"],
            )
            print(f"  ✓ {fb.feedback_id}: [{fb.feedback_type}] {fb.feedback_content}", file=sys.stderr)

        conflicts_after_fb = detector.detect_all()
        new_conflicts = [c for c in conflicts_after_fb if c.resolution.value == "pending"]
        if new_conflicts:
            print("\n  反馈触发的冲突:", file=sys.stderr)
            for cf in new_conflicts:
                if cf not in conflicts:
                    print(f"    ⚠ {cf.conflict_id}: {cf.suggested_action}", file=sys.stderr)

    print("\n=== 第6步: 生成报告 ===", file=sys.stderr)
    if args.report_json:
        p = reporter.export_json(args.report_json)
        print(f"  JSON 报告: {p}", file=sys.stderr)
    if args.report_md:
        p = reporter.export_markdown(args.report_md)
        print(f"  Markdown 报告: {p}", file=sys.stderr)

    print("\n=== 完成 ===", file=sys.stderr)
    store.close()


def main():
    parser = argparse.ArgumentParser(
        prog="log-cluster-eval",
        description="日志异常根因聚类评测工具",
    )
    parser.add_argument("--db", default="log_cluster_eval.db", help="SQLite 数据库路径")

    sub = parser.add_subparsers(dest="command")

    p_import = sub.add_parser("import", help="导入样本")
    p_import.add_argument("file", help="样本 JSON 文件路径")
    p_import.add_argument("--force", action="store_true", help="允许重复样本覆盖导入")

    p_eval = sub.add_parser("evaluate", help="运行评测")
    p_eval.add_argument("--sample-id", help="评测指定样本")
    p_eval.add_argument("--model-output", help="从模型输出 JSON 文件导入评测结果")
    p_eval.add_argument("--all", action="store_true", help="全量评测所有未评测样本")
    p_eval.add_argument("--model-version", default="v1", help="模型版本标识")

    p_detect = sub.add_parser("detect-conflicts", help="检测冲突")
    p_detect.add_argument("--sample-id", help="仅检测指定样本")

    p_resolve = sub.add_parser("resolve-conflict", help="解决冲突")
    p_resolve.add_argument("conflict_id", help="冲突 ID")
    p_resolve.add_argument("--resolution", required=True, choices=["resolved", "deferred"], help="解决方式")
    p_resolve.add_argument("--detail", default="", help="解决说明")
    p_resolve.add_argument("--no-apply", action="store_true", help="不自动更新关联评测状态")

    p_correct = sub.add_parser("correct", help="人工修正")
    p_correct.add_argument("--file", help="从 JSON 文件批量导入修正")
    p_correct.add_argument("--eval-id", help="评测记录 ID")
    p_correct.add_argument("--field", help="修正字段 (cluster_label/root_cause/confidence/status)")
    p_correct.add_argument("--old", help="原值")
    p_correct.add_argument("--new", help="新值")
    p_correct.add_argument("--corrector", help="修正人")
    p_correct.add_argument("--reason", help="修正原因")

    p_review = sub.add_parser("review", help="标记需复核")
    p_review.add_argument("--eval-id", required=True, help="评测记录 ID")
    p_review.add_argument("--reviewer", required=True, help="标记人")
    p_review.add_argument("--reason", required=True, help="原因")

    p_fb = sub.add_parser("feedback", help="添加线上反馈")
    p_fb.add_argument("--file", help="从 JSON 文件批量导入反馈")
    p_fb.add_argument("--sample-id", help="样本 ID")
    p_fb.add_argument("--feedback-type", help="反馈类型 (disagree/wrong_cluster/wrong_cause)")
    p_fb.add_argument("--content", help="反馈内容")
    p_fb.add_argument("--reporter", help="反馈人")

    p_report = sub.add_parser("report", help="导出报告")
    p_report.add_argument("--output", required=True, help="输出文件路径")
    p_report.add_argument("--format", choices=["json", "markdown"], default="markdown", help="输出格式")
    p_report.add_argument("--print", dest="print_report", action="store_true", help="同时打印报告内容")

    p_strat = sub.add_parser("stratify", help="查看样本分层")

    p_list = sub.add_parser("list", help="列出记录")
    p_list.add_argument("what", choices=["samples", "evaluations", "conflicts", "feedback"])
    p_list.add_argument("--filter", help="按来源/状态/解决状态过滤")

    p_pipe = sub.add_parser("pipeline", help="一键跑完全流程")
    p_pipe.add_argument("--samples", required=True, help="样本文件")
    p_pipe.add_argument("--model-output", help="模型输出文件")
    p_pipe.add_argument("--corrections", help="人工修正文件")
    p_pipe.add_argument("--feedback", help="线上反馈文件")
    p_pipe.add_argument("--report-json", help="JSON 报告输出路径")
    p_pipe.add_argument("--report-md", help="Markdown 报告输出路径")
    p_pipe.add_argument("--model-version", default="v1", help="模型版本")

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        sys.exit(1)

    commands = {
        "import": cmd_import,
        "evaluate": cmd_evaluate,
        "detect-conflicts": cmd_detect_conflicts,
        "resolve-conflict": cmd_resolve_conflict,
        "correct": cmd_correct,
        "review": cmd_review,
        "feedback": cmd_feedback,
        "report": cmd_report,
        "stratify": cmd_stratify,
        "list": cmd_list,
        "pipeline": cmd_pipeline,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
