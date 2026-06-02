import argparse
import sys
import json
from datetime import datetime

from storage import Storage
from explanation_generator import ExplanationGenerator
from workflow import VersionManager, HumanReviewWorkflow
from report_export import ReportExporter
from sample_data import create_samples, create_model_versions, create_legacy_annotation
from models import ExplanationStatus


def init_sample_data(storage: Storage):
    print("正在初始化样例数据...")

    samples = create_samples()
    for sample in samples:
        storage.save_sample(sample)
        print(f"  已保存样本: {sample.sample_id}")

    model_versions = create_model_versions()
    for mv in model_versions:
        try:
            storage.save_model_version(mv)
            print(f"  已注册模型版本: {mv.version}")
        except ValueError as e:
            print(f"  跳过 (已存在): {mv.version}")

    annotation_id, annotation_data = create_legacy_annotation()
    storage.save_legacy_annotation(annotation_id, annotation_data)
    print(f"  已保存历史标注: {annotation_id}")

    print("样例数据初始化完成。\n")


def cmd_init(storage, args):
    init_sample_data(storage)


def cmd_generate(storage, args):
    generator = ExplanationGenerator(storage)
    version_manager = VersionManager(storage)

    model_version = version_manager.storage.load_model_version(args.model_version)
    if not model_version:
        print(f"错误: 模型版本 {args.model_version} 不存在")
        sys.exit(1)

    sample_ids = args.samples if args.samples else storage.list_samples()
    if not sample_ids:
        print("错误: 没有可用的样本")
        sys.exit(1)

    samples = []
    for sid in sample_ids:
        sample = storage.load_sample(sid)
        if sample:
            samples.append(sample)
        else:
            print(f"警告: 样本 {sid} 不存在，跳过")

    if not samples:
        print("错误: 没有有效的样本")
        sys.exit(1)

    print(f"使用模型版本: {model_version.version}")
    print(f"处理样本数: {len(samples)}")
    print()

    run_id, reports = generator.batch_generate(samples, model_version)

    print(f"批次运行完成，批次ID: {run_id}")
    print()
    print("结果汇总:")
    for r in reports:
        status_cn = {
            "auto_success": "自动通过",
            "need_human_review": "待人工审核",
            "human_confirmed": "人工确认",
            "human_revised": "人工改判",
            "legacy_from_annotation": "历史标注",
        }.get(r.status.value, r.status.value)

        print(f"  {r.report_id} | 样本 {r.sample_id} | {status_cn} | {r.recommended_path} | {r.confidence_score:.2%}")

    print()
    print(f"如需查看详情，请运行: python cli.py show-report {reports[0].report_id}")
    print(f"如需导出报告，请运行: python cli.py export-batch {run_id}")


def cmd_import_legacy(storage, args):
    workflow = HumanReviewWorkflow(storage)

    annotation_ids = args.annotations if args.annotations else storage.list_legacy_annotations()

    for aid in annotation_ids:
        ann_data = storage.load_legacy_annotation(aid)
        if not ann_data:
            print(f"警告: 标注 {aid} 不存在，跳过")
            continue

        sample_id = ann_data.get("original_sample_id")
        if not sample_id:
            print(f"警告: 标注 {aid} 没有关联样本，跳过")
            continue

        try:
            report = workflow.import_legacy_annotation(
                sample_id=sample_id,
                annotation_id=aid,
                annotation_data=ann_data,
                model_version=args.model_version,
            )
            print(f"  导入成功: {report.report_id} | 样本 {sample_id} | 来源标注 {aid}")
        except Exception as e:
            print(f"  导入失败 {aid}: {e}")


def cmd_list_pending(storage, args):
    workflow = HumanReviewWorkflow(storage)
    pending = workflow.list_pending_reviews(args.model_version)

    if not pending:
        print("没有待审核的报告")
        return

    print(f"待审核报告 (共 {len(pending)} 份):")
    for r in pending:
        print(
            f"  {r.report_id} | 样本 {r.sample_id} | 置信度 {r.confidence_score:.2%} | {r.recommended_path}"
        )
        print(f"    原因: {r.generation_note[:80]}...")

    print()
    print("审核命令:")
    print("  确认: python cli.py confirm <report_id> --reviewer <name>")
    print("  改判: python cli.py revise <report_id> --reviewer <name> --path <new_path> --note <reason>")


def cmd_confirm(storage, args):
    workflow = HumanReviewWorkflow(storage)

    try:
        report = workflow.confirm_recommendation(
            report_id=args.report_id,
            reviewer=args.reviewer,
            note=args.note or "",
        )
        print(f"确认成功: {report.report_id}")
        print(f"状态: {report.status.value}")
        print(f"审核人: {report.human_review.reviewer}")
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)


def cmd_revise(storage, args):
    workflow = HumanReviewWorkflow(storage)

    revised_evidence = None
    if args.evidence:
        try:
            revised_evidence = json.loads(args.evidence)
            if not isinstance(revised_evidence, list):
                revised_evidence = [revised_evidence]
        except json.JSONDecodeError:
            print("错误: evidence 必须是合法的JSON数组")
            sys.exit(1)

    try:
        report = workflow.revise_recommendation(
            report_id=args.report_id,
            reviewer=args.reviewer,
            revised_path=args.path,
            revision_note=args.note,
            revised_evidence=revised_evidence,
        )
        print(f"改判成功: {report.report_id}")
        print(f"新路径: {report.recommended_path}")
        print(f"审核人: {report.human_review.reviewer}")
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)


def cmd_show_report(storage, args):
    exporter = ReportExporter(storage)
    exporter.print_report_to_console(args.report_id)


def cmd_export_report(storage, args):
    exporter = ReportExporter(storage)

    try:
        if args.batch_id:
            summary_path, detail_dir = exporter.export_batch_run_report(args.batch_id)
            print(f"汇总报告: {summary_path}")
            print(f"明细目录: {detail_dir}")
        elif args.report_id:
            path = exporter.export_single_report(args.report_id)
            print(f"报告已导出: {path}")
        elif args.old_run and args.new_run:
            path = exporter.compare_runs_and_export(args.old_run, args.new_run)
            print(f"对比报告已导出: {path}")
        else:
            print("错误: 请指定 --batch-id, --report-id, 或 --old-run/--new-run")
            sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)


def cmd_list_versions(storage, args):
    version_manager = VersionManager(storage)
    versions = version_manager.list_versions_with_changelog()

    print("模型版本历史:")
    for v in versions:
        print(f"  {v['version']}")
        print(f"    发布时间: {v['deployed_at']}")
        print(f"    描述: {v['description']}")
        print(f"    报告数: {v['report_count']}")
        print(f"    阈值: {json.dumps(v['threshold_config'], ensure_ascii=False)}")
        print()


def cmd_compare_versions(storage, args):
    version_manager = VersionManager(storage)
    diff = version_manager.get_version_diff(args.old_version, args.new_version)

    if "error" in diff:
        print(f"错误: {diff['error']}")
        sys.exit(1)

    print(f"版本对比: {args.old_version} → {args.new_version}")
    print()

    if diff["threshold_diffs"]:
        print("阈值变化:")
        for k, v in diff["threshold_diffs"].items():
            print(f"  {k}: {v['old']} → {v['new']}")
    else:
        print("阈值无变化")

    print()
    print(f"报告数: {diff['report_counts']['old']} → {diff['report_counts']['new']}")


def cmd_list_runs(storage, args):
    run_ids = storage.list_batch_runs()

    if not run_ids:
        print("没有批次运行记录")
        return

    print(f"批次运行历史:")
    for rid in run_ids:
        run = storage.load_batch_run(rid)
        if run:
            print(f"  {run.run_id}")
            print(f"    时间: {run.run_timestamp}")
            print(f"    模型: {run.model_version}")
            print(f"    样本数: {run.sample_count}")
            for k, v in sorted(run.metrics.items()):
                if isinstance(v, float) and 0 <= v <= 1 and "rate" in k:
                    print(f"    {k}: {v:.2%}")
                else:
                    print(f"    {k}: {v}")
            print()


def cmd_show_trace(storage, args):
    sample_id = args.sample_id

    reports = storage.list_reports_for_sample(sample_id)

    if not reports:
        print(f"样本 {sample_id} 没有解释报告")
        return

    print(f"样本 {sample_id} 的完整追溯链 (共 {len(reports)} 个版本):")
    print()

    for i, r in enumerate(reports, 1):
        print(f"[{i}] {r.report_id}")
        print(f"    模型版本: {r.model_version}")
        print(f"    生成时间: {r.generated_at}")
        print(f"    状态: {r.status.value}")
        print(f"    推荐路径: {r.recommended_path}")
        print(f"    置信度: {r.confidence_score:.2%}")
        if r.human_review:
            print(f"    审核人: {r.human_review.reviewer} @ {r.human_review.reviewed_at}")
        if r.legacy_source:
            print(f"    历史来源: {r.legacy_source}")
        print()

    print("追溯完成。所有历史版本均已保留，无静默覆盖。")


def main():
    parser = argparse.ArgumentParser(description="学习路径推荐解释系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_init = subparsers.add_parser("init", help="初始化样例数据")
    p_init.set_defaults(func=cmd_init)

    p_gen = subparsers.add_parser("generate", help="批量生成解释")
    p_gen.add_argument("--model-version", required=True, help="模型版本")
    p_gen.add_argument("--samples", nargs="*", help="样本ID列表，默认处理所有样本")
    p_gen.set_defaults(func=cmd_generate)

    p_import = subparsers.add_parser("import-legacy", help="导入历史标注")
    p_import.add_argument("--model-version", required=True, help="模型版本")
    p_import.add_argument("--annotations", nargs="*", help="标注ID列表")
    p_import.set_defaults(func=cmd_import_legacy)

    p_pending = subparsers.add_parser("pending", help="列出待审核报告")
    p_pending.add_argument("--model-version", help="指定模型版本")
    p_pending.set_defaults(func=cmd_list_pending)

    p_confirm = subparsers.add_parser("confirm", help="人工确认推荐")
    p_confirm.add_argument("report_id", help="报告ID")
    p_confirm.add_argument("--reviewer", required=True, help="审核人")
    p_confirm.add_argument("--note", help="审核说明")
    p_confirm.set_defaults(func=cmd_confirm)

    p_revise = subparsers.add_parser("revise", help="人工改判推荐")
    p_revise.add_argument("report_id", help="报告ID")
    p_revise.add_argument("--reviewer", required=True, help="审核人")
    p_revise.add_argument("--path", required=True, help="修正后的路径")
    p_revise.add_argument("--note", required=True, help="改判原因")
    p_revise.add_argument("--evidence", help="补充证据 (JSON数组)")
    p_revise.set_defaults(func=cmd_revise)

    p_show = subparsers.add_parser("show-report", help="显示报告详情")
    p_show.add_argument("report_id", help="报告ID")
    p_show.set_defaults(func=cmd_show_report)

    p_export = subparsers.add_parser("export", help="导出报告")
    p_export.add_argument("--report-id", help="单个报告ID")
    p_export.add_argument("--batch-id", help="批次ID")
    p_export.add_argument("--old-run", help="旧批次ID (用于对比)")
    p_export.add_argument("--new-run", help="新批次ID (用于对比)")
    p_export.set_defaults(func=cmd_export_report)

    p_versions = subparsers.add_parser("versions", help="列出模型版本")
    p_versions.set_defaults(func=cmd_list_versions)

    p_cv = subparsers.add_parser("compare-versions", help="对比模型版本")
    p_cv.add_argument("old_version", help="旧版本")
    p_cv.add_argument("new_version", help="新版本")
    p_cv.set_defaults(func=cmd_compare_versions)

    p_runs = subparsers.add_parser("runs", help="列出批次运行历史")
    p_runs.set_defaults(func=cmd_list_runs)

    p_trace = subparsers.add_parser("trace", help="追溯样本的完整历史")
    p_trace.add_argument("sample_id", help="样本ID")
    p_trace.set_defaults(func=cmd_show_trace)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    storage = Storage()

    if args.command != "init":
        samples = storage.list_samples()
        if not samples:
            print("检测到首次运行，正在初始化样例数据...\n")
            init_sample_data(storage)

    args.func(storage, args)


if __name__ == "__main__":
    main()
