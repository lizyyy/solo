#!/usr/bin/env python3
import click
import sys
from pathlib import Path

from cutoff_eval.workflow import EvaluationWorkflow
from cutoff_eval.report import ReportGenerator


@click.group()
@click.option(
    "--output-dir",
    default="./output",
    help="输出目录，默认 ./output",
    type=click.Path(file_okay=False),
)
@click.pass_context
def cli(ctx, output_dir):
    """候选集截断影响评估工具"""
    ctx.ensure_object(dict)
    ctx.obj["output_dir"] = output_dir


@cli.command()
@click.argument("negative_file", type=click.Path(exists=True))
@click.option(
    "--no-auto-detect",
    is_flag=True,
    help="禁用自动检测重复训练",
)
@click.pass_context
def step1(ctx, negative_file, no_auto_detect):
    """步骤1: 导入负样本列表"""
    output_dir = ctx.obj["output_dir"]
    workflow = EvaluationWorkflow(output_dir=output_dir)

    click.echo("📥 步骤1: 导入负样本列表...")
    result = workflow.step1_import_negative_samples(
        negative_file, auto_detect=not no_auto_detect
    )

    click.echo(f"   导入总数: {result['total_imported']}")
    click.echo(f"   重复训练组数: {result['duplicate_groups']}")
    click.echo(f"   重复训练条数: {result['duplicate_items']}")
    click.echo(f"   输出文件: {result['output_path']}")

    if result["duplicates"]:
        click.echo("")
        click.echo("⚠️  检测到重复训练数据，已标记为「待策略产品复核」")
        for dup in result["duplicates"]:
            click.echo(
                f"   - 批次{dup['batch_id']} 商品{dup['item_id']}: 出现{dup['count']}次"
            )

    click.echo("")
    click.echo("✅ 步骤1完成！接下来执行步骤2导入召回候选表")


@cli.command()
@click.argument("recall_file", type=click.Path(exists=True))
@click.option(
    "--no-auto-link",
    is_flag=True,
    help="禁用自动关联负样本",
)
@click.pass_context
def step2(ctx, recall_file, no_auto_link):
    """步骤2: 导入并复核召回候选表（阿越）"""
    output_dir = ctx.obj["output_dir"]
    workflow = EvaluationWorkflow(output_dir=output_dir)

    processed_neg = Path(output_dir) / "negative_samples_processed.csv"
    if processed_neg.exists():
        from cutoff_eval.workflow import DataLoader

        workflow.negative_samples = DataLoader.load_negative_samples(str(processed_neg))
        workflow.step_completed["step1_import_negative"] = True

    click.echo("🔍 步骤2: 导入并复核召回候选表...")
    try:
        result = workflow.step2_import_and_review_recall_candidates(
            recall_file, auto_link=not no_auto_link
        )
    except RuntimeError as e:
        click.echo(f"❌ 错误: {e}")
        sys.exit(1)

    click.echo(f"   导入总数: {result['total_imported']}")
    click.echo(f"   重复训练组数: {result['duplicate_groups']}")
    click.echo(f"   交叉重复组数: {result['cross_duplicates']}")
    click.echo(f"   输出文件: {result['output_path']}")

    if result["duplicates"] or result["cross_duplicate_details"]:
        click.echo("")
        click.echo("⚠️  检测到重复训练数据，已标记为「待策略产品复核」")
        if result["cross_duplicate_details"]:
            click.echo("   交叉重复详情:")
            for dup in result["cross_duplicate_details"]:
                click.echo(
                    f"   - 批次{dup['batch_id']} 商品{dup['item_id']}: "
                    f"负样本{dup['negative_sample_count']}次, "
                    f"召回候选{dup['recall_candidate_count']}次"
                )

    click.echo("")
    click.echo("✅ 步骤2完成！接下来执行步骤3更新特征版本表")


@cli.command()
@click.option(
    "--existing-file",
    type=click.Path(exists=True),
    help="已有的特征版本表文件",
)
@click.pass_context
def step3(ctx, existing_file):
    """步骤3: 更新特征版本表"""
    output_dir = ctx.obj["output_dir"]
    workflow = EvaluationWorkflow(output_dir=output_dir)

    processed_neg = Path(output_dir) / "negative_samples_processed.csv"
    processed_recall = Path(output_dir) / "recall_candidates_processed.csv"

    if processed_neg.exists():
        from cutoff_eval.workflow import DataLoader

        workflow.negative_samples = DataLoader.load_negative_samples(str(processed_neg))
        workflow.step_completed["step1_import_negative"] = True

    if processed_recall.exists():
        from cutoff_eval.workflow import DataLoader

        workflow.recall_candidates = DataLoader.load_recall_candidates(
            str(processed_recall)
        )
        workflow.step_completed["step2_review_recall"] = True

    click.echo("📋 步骤3: 更新特征版本表...")
    try:
        result = workflow.step3_update_feature_versions(existing_file=existing_file)
    except RuntimeError as e:
        click.echo(f"❌ 错误: {e}")
        sys.exit(1)

    click.echo(f"   特征版本总数: {result['total_versions']}")
    click.echo(f"   待策略产品复核: {result['pending_review']}")
    click.echo(f"   待阿越处理: {result['needs_ayue_review']}")
    click.echo(f"   输出文件: {result['output_path']}")

    click.echo("")
    click.echo("✅ 步骤3完成！执行 report 命令生成完整评估报告")


@cli.command()
@click.option(
    "--no-charts",
    is_flag=True,
    help="不生成图表",
)
@click.pass_context
def report(ctx, no_charts):
    """生成完整评估报告"""
    output_dir = ctx.obj["output_dir"]
    workflow = EvaluationWorkflow(output_dir=output_dir)

    processed_neg = Path(output_dir) / "negative_samples_processed.csv"
    processed_recall = Path(output_dir) / "recall_candidates_processed.csv"
    processed_feature = Path(output_dir) / "feature_versions_updated.csv"

    from cutoff_eval.workflow import DataLoader

    step_results = {}

    if processed_neg.exists():
        workflow.negative_samples = DataLoader.load_negative_samples(str(processed_neg))
        workflow.step_completed["step1_import_negative"] = True
        step_results["step1"] = {"total_imported": len(workflow.negative_samples)}

    if processed_recall.exists():
        workflow.recall_candidates = DataLoader.load_recall_candidates(
            str(processed_recall)
        )
        workflow.step_completed["step2_review_recall"] = True
        step_results["step2"] = {"total_imported": len(workflow.recall_candidates)}

    if processed_feature.exists():
        workflow.feature_versions = DataLoader.load_feature_versions(
            str(processed_feature)
        )
        workflow.step_completed["step3_update_feature"] = True
        step_results["step3"] = {"total_versions": len(workflow.feature_versions)}

    if workflow.negative_samples and workflow.recall_candidates:
        workflow.detector.detect_in_negative_samples(workflow.negative_samples)
        workflow.detector.detect_in_recall_candidates(workflow.recall_candidates)
        workflow.detector.detect_cross_duplicates(
            workflow.negative_samples, workflow.recall_candidates
        )
    elif workflow.negative_samples:
        workflow.detector.detect_in_negative_samples(workflow.negative_samples)
    elif workflow.recall_candidates:
        workflow.detector.detect_in_recall_candidates(workflow.recall_candidates)

    click.echo("📊 生成评估报告...")

    summary = workflow.get_workflow_summary()
    dataframes = workflow.get_dataframes()

    report_gen = ReportGenerator(output_dir=output_dir)
    outputs = report_gen.generate_summary_report(
        summary, step_results, dataframes, include_charts=not no_charts
    )

    click.echo("")
    click.echo("✅ 报告生成完成！")
    click.echo("")
    click.echo("📁 输出文件:")
    for name, path in outputs.items():
        if name == "charts" and isinstance(path, dict):
            click.echo(f"   📈 图表:")
            for chart_name, chart_path in path.items():
                click.echo(f"      - {chart_name}: {chart_path}")
        else:
            click.echo(f"   - {name}: {path}")

    click.echo("")
    click.echo(f"👉 打开 {outputs.get('index_html', 'index.html')} 查看交互式报告")


@cli.command()
@click.argument("negative_file", type=click.Path(exists=True))
@click.argument("recall_file", type=click.Path(exists=True))
@click.option(
    "--existing-features",
    type=click.Path(exists=True),
    help="已有的特征版本表文件",
)
@click.option(
    "--no-charts",
    is_flag=True,
    help="不生成图表",
)
@click.pass_context
def run_all(ctx, negative_file, recall_file, existing_features, no_charts):
    """一键执行完整评估流程"""
    output_dir = ctx.obj["output_dir"]
    workflow = EvaluationWorkflow(output_dir=output_dir)

    click.echo("=" * 50)
    click.echo("🚀 候选集截断影响评估 - 完整流程")
    click.echo("=" * 50)
    click.echo("")

    click.echo("📥 步骤1/3: 导入负样本列表...")
    step1_result = workflow.step1_import_negative_samples(negative_file)
    click.echo(f"   完成! 导入 {step1_result['total_imported']} 条")
    if step1_result["duplicate_groups"]:
        click.echo(f"   ⚠️  检测到 {step1_result['duplicate_groups']} 组重复训练")
    click.echo("")

    click.echo("🔍 步骤2/3: 导入并复核召回候选表...")
    step2_result = workflow.step2_import_and_review_recall_candidates(recall_file)
    click.echo(f"   完成! 导入 {step2_result['total_imported']} 条")
    if step2_result["duplicate_groups"]:
        click.echo(f"   ⚠️  检测到 {step2_result['duplicate_groups']} 组重复训练")
    if step2_result["cross_duplicates"]:
        click.echo(f"   ⚠️  检测到 {step2_result['cross_duplicates']} 组交叉重复")
    click.echo("")

    click.echo("📋 步骤3/3: 更新特征版本表...")
    step3_result = workflow.step3_update_feature_versions(
        existing_file=existing_features
    )
    click.echo(f"   完成! 共 {step3_result['total_versions']} 条特征版本")
    click.echo("")

    click.echo("📊 生成评估报告...")
    summary = workflow.get_workflow_summary()
    dataframes = workflow.get_dataframes()
    step_results = {"step1": step1_result, "step2": step2_result, "step3": step3_result}

    report_gen = ReportGenerator(output_dir=output_dir)
    outputs = report_gen.generate_summary_report(
        summary, step_results, dataframes, include_charts=not no_charts
    )

    click.echo("")
    click.echo("=" * 50)
    click.echo("✅ 评估完成！")
    click.echo("=" * 50)
    click.echo("")
    click.echo(f"👉 打开 {outputs.get('index_html', '')} 查看交互式报告")


if __name__ == "__main__":
    cli(obj={})
