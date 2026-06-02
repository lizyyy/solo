import click
import json
from pathlib import Path

from .data_loader import DataLoader
from .evaluator import PrivacyEvaluator
from .reporter import ResultReporter


@click.group()
@click.option("--samples-dir", default="samples", help="样本数据目录")
@click.option("--reports-dir", default="reports", help="报告输出目录")
@click.pass_context
def cli(ctx, samples_dir, reports_dir):
    """隐私脱敏效果评估工具"""
    ctx.ensure_object(dict)
    ctx.obj['loader'] = DataLoader(samples_dir)
    ctx.obj['reporter'] = ResultReporter(reports_dir)


@cli.command()
@click.option("--model-version", "-v", required=True, help="模型版本，如 v1.0")
@click.option("--dedup/--no-dedup", default=True, help="是否去重重复记录")
@click.option("--with-notes/--no-notes", default=True, help="是否加载备注")
@click.pass_context
def evaluate(ctx, model_version, dedup, with_notes):
    """执行隐私脱敏效果评估"""
    loader = ctx.obj['loader']
    reporter = ctx.obj['reporter']

    click.echo(f"📥 加载模型版本 {model_version} 的输出...")
    outputs, dup_count = loader.load_model_outputs(model_version, dedup=dedup)
    click.echo(f"  ✓ 加载 {len(outputs)} 条记录")

    if dup_count:
        click.echo(f"  ⚠️  发现重复记录: {dict(dup_count)}")

    click.echo("📥 加载标注数据...")
    annotations = loader.load_annotations()
    click.echo(f"  ✓ 加载 {len(annotations)} 条标注")

    click.echo("📥 加载阈值配置...")
    thresholds = loader.load_thresholds()
    click.echo(f"  ✓ 加载 {len(thresholds)} 类阈值")

    click.echo("📥 加载冲突案例...")
    conflicts = loader.load_conflicts()
    click.echo(f"  ✓ 加载 {len(conflicts)} 条冲突案例")

    notes = None
    if with_notes:
        click.echo("📥 加载备注...")
        notes = loader.load_notes()
        if notes:
            click.echo(f"  ✓ 加载 {sum(len(v) for v in notes.values())} 条备注")

    click.echo("\n🔍 开始评估...")
    evaluator = PrivacyEvaluator(thresholds)
    summary = evaluator.evaluate(outputs, annotations, conflicts, notes)

    reporter.print_summary(summary)

    ctx.obj['last_summary'] = summary


@cli.command()
@click.option("--model-version", "-v", required=True, help="模型版本")
@click.option("--format", "-f", "fmt", type=click.Choice(['json', 'html']), default="html", help="导出格式")
@click.option("--output", "-o", help="输出文件名")
@click.pass_context
def export(ctx, model_version, fmt, output):
    """导出评估报告"""
    loader = ctx.obj['loader']
    reporter = ctx.obj['reporter']

    outputs, _ = loader.load_model_outputs(model_version)
    annotations = loader.load_annotations()
    thresholds = loader.load_thresholds()
    conflicts = loader.load_conflicts()
    notes = loader.load_notes()

    evaluator = PrivacyEvaluator(thresholds)
    summary = evaluator.evaluate(outputs, annotations, conflicts, notes)

    if fmt == 'json':
        filepath = reporter.export_json(summary, output)
    else:
        filepath = reporter.export_html(summary, output)

    click.echo(f"✅ 报告已导出: {filepath}")


@cli.command()
@click.option("--version1", "-v1", required=True, help="基线版本")
@click.option("--version2", "-v2", required=True, help="对比版本")
@click.option("--export", "-e", is_flag=True, help="同时导出两个版本的报告")
@click.pass_context
def diff(ctx, version1, version2, export):
    """对比两个模型版本的评估结果"""
    loader = ctx.obj['loader']
    reporter = ctx.obj['reporter']

    annotations = loader.load_annotations()
    thresholds = loader.load_thresholds()
    conflicts = loader.load_conflicts()
    notes = loader.load_notes()

    evaluator = PrivacyEvaluator(thresholds)

    click.echo(f"🔍 评估版本 {version1}...")
    outputs1, _ = loader.load_model_outputs(version1)
    summary1 = evaluator.evaluate(outputs1, annotations, conflicts, notes)

    click.echo(f"🔍 评估版本 {version2}...")
    outputs2, _ = loader.load_model_outputs(version2)
    summary2 = evaluator.evaluate(outputs2, annotations, conflicts, notes)

    reporter.print_diff(summary1, summary2)

    if export:
        f1 = reporter.export_html(summary1)
        f2 = reporter.export_html(summary2)
        click.echo(f"📄 报告已导出: {f1}")
        click.echo(f"📄 报告已导出: {f2}")


@cli.command("list-conflicts")
@click.option("--all", "-a", is_flag=True, help="显示所有冲突（包括已解决的）")
@click.pass_context
def list_conflicts(ctx, all):
    """列出所有冲突案例"""
    loader = ctx.obj['loader']
    reporter = ctx.obj['reporter']

    conflicts = loader.load_conflicts()

    if not all:
        conflicts = [c for c in conflicts if not c.resolved]

    reporter.print_conflicts(conflicts)


@cli.command()
@click.option("--record-id", "-r", required=True, help="记录ID")
@click.option("--note", "-n", required=True, help="备注内容")
@click.option("--author", "-a", default="anonymous", help="添加人")
@click.pass_context
def add_note(ctx, record_id, note, author):
    """为指定记录添加备注"""
    loader = ctx.obj['loader']
    loader.save_note(record_id, note, author)
    click.echo(f"✅ 已为记录 {record_id} 添加备注: {note}")


@cli.command()
@click.option("--record-id", "-r", required=True, help="记录ID")
@click.option("--conflict-type", "-t",
              type=click.Choice(['false_negative', 'false_positive', 'wrong_level', 'mismatch_type', 'conflict']),
              default="conflict", help="冲突类型")
@click.option("--description", "-d", required=True, help="冲突描述")
@click.pass_context
def add_conflict(ctx, record_id, conflict_type, description):
    """添加新的冲突案例"""
    loader = ctx.obj['loader']
    conflicts = loader.load_conflicts()

    from .models import ConflictCase, ErrorType
    conflict = ConflictCase(
        record_id=record_id,
        conflict_type=ErrorType(conflict_type),
        description=description,
        evidences=[],
        resolved=False
    )
    conflicts.append(conflict)
    loader.save_conflicts(conflicts)
    click.echo(f"✅ 已添加冲突案例: {record_id} - {description}")


@cli.command()
@click.option("--record-id", "-r", required=True, help="记录ID")
@click.option("--resolution", "-d", required=True, help="解决说明")
@click.pass_context
def resolve_conflict(ctx, record_id, resolution):
    """标记冲突案例为已解决"""
    loader = ctx.obj['loader']
    conflicts = loader.load_conflicts()

    found = False
    for cf in conflicts:
        if cf.record_id == record_id and not cf.resolved:
            cf.resolved = True
            cf.resolution_note = resolution
            found = True
            break

    if found:
        loader.save_conflicts(conflicts)
        click.echo(f"✅ 已解决冲突: {record_id}")
    else:
        click.echo(f"❌ 未找到未解决的冲突案例: {record_id}")


@cli.command()
def list_versions():
    """列出可用的模型版本"""
    samples_path = Path("samples/model_logs")
    if not samples_path.exists():
        click.echo("❌ 模型日志目录不存在")
        return

    versions = sorted([d.name for d in samples_path.iterdir() if d.is_dir()])
    if versions:
        click.echo("📦 可用模型版本:")
        for v in versions:
            count = len(list((samples_path / v).glob("*.jsonl")))
            click.echo(f"  - {v} ({count} 个日志文件)")
    else:
        click.echo("⚠️  暂无模型版本")


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
