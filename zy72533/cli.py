import click
import json
import sys
from pathlib import Path
from models import SampleStatus, NextAction
from data_store import DataStore, DemoDataGenerator
from core import AnnotationWorkflow, ConfidenceAnalyzer, ModelVersionComparator
from report_generator import ReportGenerator


@click.group()
@click.option('--data-dir', default='data', help='数据存储目录')
@click.pass_context
def cli(ctx, data_dir):
    """政务热线摘要脱敏系统 - 命令行工具"""
    ctx.ensure_object(dict)
    ctx.obj['data_store'] = DataStore(data_dir)


@cli.command()
@click.pass_context
def init_demo(ctx):
    """初始化演示数据"""
    ds = ctx.obj['data_store']
    dataset = DemoDataGenerator.create_demo_dataset()

    samples_data = [s.model_dump(mode="json") for s in dataset.samples]
    result = ds.import_samples(samples_data)

    DemoDataGenerator.save_demo_dataset(dataset)

    click.echo(click.style("✅ 演示数据初始化完成！", fg="green"))
    click.echo(f"  - 总样本数: {result.total}")
    click.echo(f"  - 成功导入: {result.success}")
    click.echo(f"  - 低置信度样本: {result.low_confidence_count}")
    click.echo(f"  - 被平均指标掩盖: {result.hidden_by_avg_count}")
    click.echo(f"  - 样本ID: {', '.join(result.sample_ids)}")
    click.echo()
    click.echo("使用以下命令开始体验:")
    click.echo("  python cli.py list                 # 查看所有样本")
    click.echo("  python cli.py show DEMO-001        # 查看样本详情")
    click.echo("  python cli.py compare v1.0 v2.0    # 生成模型版本对比报告")


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.pass_context
def import_samples(ctx, input_file):
    """从JSON文件导入样本"""
    ds = ctx.obj['data_store']

    with open(input_file, 'r', encoding='utf-8') as f:
        samples_data = json.load(f)

    result = ds.import_samples(samples_data)

    click.echo(click.style(f"✅ 导入完成！", fg="green"))
    click.echo(f"  总计: {result.total} | 成功: {result.success} | 失败: {result.failed}")
    click.echo(f"  低置信度: {result.low_confidence_count} | 被平均掩盖: {result.hidden_by_avg_count}")

    if result.hidden_by_avg_count > 0:
        click.echo(click.style(f"  ⚠️  注意: 有 {result.hidden_by_avg_count} 条低置信度样本被平均指标掩盖，已标记需知识库编辑复核", fg="yellow"))


@cli.command()
@click.option('--status', type=click.Choice([s.value for s in SampleStatus]), help='按状态筛选')
@click.option('--show-hidden/--no-show-hidden', default=False, help='只显示被平均掩盖的样本')
@click.pass_context
def list(ctx, status, show_hidden):
    """列出所有样本"""
    ds = ctx.obj['data_store']
    samples = ds.load_all_samples()

    if status:
        samples = [s for s in samples if s.status.value == status]

    if show_hidden:
        samples = [s for s in samples if s.hidden_by_avg]

    if not samples:
        click.echo("没有找到符合条件的样本")
        return

    click.echo(f"共找到 {len(samples)} 条样本:")
    click.echo("-" * 100)
    click.echo(f"{'样本ID':<12} {'状态':<14} {'置信度':<10} {'被掩盖':<8} {'下一步':<18} {'摘要预览'}")
    click.echo("-" * 100)

    for s in samples:
        latest_summary = s.model_outputs[-1].summary if s.model_outputs else "无模型输出"
        summary_preview = latest_summary[:30] + "..." if len(latest_summary) > 30 else latest_summary

        hidden_mark = "🔴是" if s.hidden_by_avg else "  否"
        conf_level = s.confidence_level.value
        next_action = s.next_action.value if s.next_action else "待处理"

        click.echo(f"{s.sample_id:<12} {s.status.value:<14} {conf_level:<10} {hidden_mark:<8} {next_action:<18} {summary_preview}")


@cli.command()
@click.argument('sample_id')
@click.pass_context
def show(ctx, sample_id):
    """查看样本详情和处理流程"""
    ds = ctx.obj['data_store']
    sample = ds.load_sample(sample_id)

    if not sample:
        click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
        return

    report = ReportGenerator.generate_workflow_report(sample)
    click.echo(report)


@cli.command()
@click.argument('sample_id')
@click.option('--annotator', required=True, help='标注员姓名')
@click.option('--summary', required=True, help='修正后的摘要')
@click.option('--comment', required=True, help='标注留言')
@click.option('--error-type', help='错误类型')
@click.pass_context
def annotate(ctx, sample_id, annotator, summary, comment, error_type):
    """添加标注记录"""
    ds = ctx.obj['data_store']
    sample = ds.load_sample(sample_id)

    if not sample:
        click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
        return

    sample = AnnotationWorkflow.add_annotation(
        sample, annotator, summary, comment, error_type
    )
    ds.save_sample(sample)

    click.echo(click.style(f"✅ 标注已添加", fg="green"))
    click.echo(f"  标注员: {annotator}")
    click.echo(f"  错误类型: {error_type or '未指定'}")
    click.echo(f"  留言: {comment}")

    if sample.hidden_by_avg:
        click.echo(click.style("  ⚠️  该样本为低置信度被掩盖样本，标注后仍需知识库编辑复核", fg="yellow"))


@cli.command()
@click.argument('sample_id')
@click.option('--operator', required=True, help='操作人姓名')
@click.option('--snippet', required=True, help='模型输出原始片段')
@click.option('--reason', required=True, help='补录原因')
@click.option('--notes', help='补充说明')
@click.pass_context
def supplement(ctx, sample_id, operator, snippet, reason, notes):
    """补录模型输出片段"""
    ds = ctx.obj['data_store']
    sample = ds.load_sample(sample_id)

    if not sample:
        click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
        return

    sample = AnnotationWorkflow.add_supplement(
        sample, operator, snippet, reason, notes
    )
    ds.save_sample(sample)

    click.echo(click.style(f"✅ 补录已添加", fg="green"))
    click.echo(f"  操作人: {operator}")
    click.echo(f"  原因: {reason}")
    click.echo(f"  片段: {snippet[:50]}..." if len(snippet) > 50 else f"  片段: {snippet}")


@cli.command()
@click.argument('baseline_version')
@click.argument('current_version')
@click.option('--sample-id', help='只对比指定样本')
@click.option('--output', help='输出到文件')
@click.pass_context
def compare(ctx, baseline_version, current_version, sample_id, output):
    """生成模型版本对比报告"""
    ds = ctx.obj['data_store']

    if sample_id:
        sample = ds.load_sample(sample_id)
        if not sample:
            click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
            return
        samples = [sample]
    else:
        samples = ds.load_all_samples()

    report = ReportGenerator.generate_comparison_report(
        samples, baseline_version, current_version
    )

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report)
        click.echo(click.style(f"✅ 报告已保存到 {output}", fg="green"))
    else:
        click.echo(report)


@cli.command()
@click.argument('sample_id')
@click.option('--notes', required=True, help='复核意见')
@click.pass_context
def review(ctx, sample_id, notes):
    """知识库编辑复核样本"""
    ds = ctx.obj['data_store']
    sample = ds.load_sample(sample_id)

    if not sample:
        click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
        return

    sample = AnnotationWorkflow.escalate_for_review(sample, notes)
    sample.next_action = NextAction.TO_ALGO_OPER
    ds.save_sample(sample)

    click.echo(click.style(f"✅ 复核意见已记录", fg="green"))
    click.echo(f"  复核意见: {notes}")
    click.echo(f"  下一步: 转交算法运营跟进")


@cli.command()
@click.argument('sample_id')
@click.option('--notes', required=True, help='处理结果说明')
@click.pass_context
def resolve(ctx, sample_id, notes):
    """标记样本为已解决"""
    ds = ctx.obj['data_store']
    sample = ds.load_sample(sample_id)

    if not sample:
        click.echo(click.style(f"❌ 样本 {sample_id} 不存在", fg="red"))
        return

    sample = AnnotationWorkflow.resolve_sample(sample, notes)
    ds.save_sample(sample)

    click.echo(click.style(f"✅ 样本已标记为已解决", fg="green"))
    click.echo(f"  处理结果: {notes}")


@cli.command()
@click.pass_context
def stats(ctx):
    """查看统计数据"""
    ds = ctx.obj['data_store']
    stats = ds.get_stats()

    click.echo("📊 系统统计")
    click.echo("=" * 40)
    click.echo(f"总样本数: {stats['total_samples']}")
    click.echo()

    click.echo("按状态分布:")
    for status, count in stats['by_status'].items():
        click.echo(f"  {status}: {count}")
    click.echo()

    click.echo("按置信度分布:")
    for conf, count in stats['by_confidence'].items():
        click.echo(f"  {conf}: {count}")
    click.echo()

    click.echo(f"被平均指标掩盖的低置信度样本: {stats['hidden_by_avg_count']} 条")
    if stats['hidden_by_avg_count'] > 0:
        click.echo(click.style("  ⚠️  这些样本需要知识库编辑重点复核！", fg="yellow"))


@cli.command()
@click.pass_context
def demo_workflow(ctx):
    """演示完整的三步流程"""
    ds = ctx.obj['data_store']

    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style("政务热线摘要脱敏 - 完整流程演示", fg="cyan", bold=True))
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo()

    click.echo(click.style("【第一步：标注员留言导入】", fg="blue", bold=True))
    click.echo("场景：标注员小王完成样本标注，发现脱敏不完整问题")
    click.echo()

    sample = ds.load_sample("DEMO-001")
    if sample:
        click.echo(f"样本 {sample.sample_id}:")
        click.echo(f"  原始文本: {sample.original_text[:50]}...")
        if sample.annotations:
            ann = sample.annotations[-1]
            click.echo(f"  标注员: {ann.annotator}")
            click.echo(f"  留言: {ann.comment}")
            click.echo(f"  错误类型: {ann.error_type}")
    click.echo()

    click.echo(click.style("【第二步：算法运营老唐补看模型输出片段】", fg="blue", bold=True))
    click.echo("场景：老唐注意到低置信度样本被平均指标盖住，补录原始输出")
    click.echo()

    sample2 = ds.load_sample("DEMO-002")
    if sample2:
        click.echo(f"样本 {sample2.sample_id}:")
        if sample2.hidden_by_avg:
            click.echo(click.style("  🔴 警告：该样本被平均指标掩盖！", fg="red"))
        if sample2.supplements:
            sup = sample2.supplements[-1]
            click.echo(f"  补录人: {sup.operator}")
            click.echo(f"  原因: {sup.reason}")
            click.echo(f"  输出片段: {sup.model_output_snippet}")
    click.echo()

    click.echo(click.style("【第三步：模型版本对比更新】", fg="blue", bold=True))
    click.echo("场景：补录后自动更新版本对比报告，明确下一步行动")
    click.echo()

    samples = ds.load_all_samples()
    comp_report = ReportGenerator.generate_comparison_report(samples, "v1.0", "v2.0")

    click.echo("--- 版本对比报告摘要 ---")
    click.echo(comp_report.split("【全部样本详细对比】")[0])
    click.echo()

    click.echo(click.style("✅ 流程演示完成！", fg="green"))
    click.echo()
    click.echo("关键要点回顾:")
    click.echo("  1. 低置信度样本不会被自动归为正常")
    click.echo("  2. 被平均指标掩盖的样本会高亮标记")
    click.echo("  3. 知识库编辑复核前不跳过任何可疑样本")
    click.echo("  4. 模型版本对比说明：为什么留下、缺什么、找谁")


if __name__ == '__main__':
    cli(obj={})
