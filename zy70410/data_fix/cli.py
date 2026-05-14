import click
from pathlib import Path

from .engine import DataFixEngine
from .report import ReportGenerator
from .sample_data import generate_cross_day_repair_orders, detect_issues
from .models import RiskType


@click.group()
@click.pass_context
def main(ctx):
    """数据修复预演命令行工具"""
    ctx.ensure_object(dict)
    ctx.obj['engine'] = DataFixEngine()
    ctx.obj['reporter'] = ReportGenerator()
    ctx.obj['output_dir'] = Path('./output')
    ctx.obj['output_dir'].mkdir(exist_ok=True)


@main.command()
@click.pass_context
@click.option('--operator', default='system', help='操作者名称')
@click.option('--dry-run', is_flag=True, help='仅预览不执行')
@click.option('--confirm', is_flag=True, help='跳过预览确认直接执行')
def run(ctx, operator, dry_run, confirm):
    """执行数据修复预演"""
    engine = ctx.obj['engine']
    reporter = ctx.obj['reporter']
    output_dir = ctx.obj['output_dir']

    click.echo("正在生成跨天物业报修单样例数据...")
    orders = generate_cross_day_repair_orders()
    suggestions = detect_issues(orders)

    if not confirm:
        preview_data = engine.preview_fixes(orders, suggestions)
        reporter.print_preview(preview_data)

        if not click.confirm('\n确认执行以上修复操作?'):
            click.echo("操作已取消")
            return

    click.echo("\n正在执行数据修复...")
    report = engine.execute_fixes(orders, suggestions, operator, dry_run=dry_run)

    click.echo("\n执行完成，正在生成报告...\n")
    reporter.print_console_report(report, suggestions)

    json_path = output_dir / f'{report.batch_id}_report.json'
    reporter.export_json_report(report, str(json_path), suggestions)
    click.echo(f"\n报告已导出至: {json_path}")

    if report.failed_count > 0:
        failed_path = output_dir / f'{report.batch_id}_failed_records.json'
        engine.export_failed_records(report, str(failed_path))
        click.echo(f"失败记录已导出至: {failed_path}")

    samples_path = output_dir / f'{report.batch_id}_exception_samples.json'
    engine.export_exception_samples(report, str(samples_path))
    click.echo(f"异常样本已导出至: {samples_path}")

    history_path = output_dir / f'{report.batch_id}_full_history.json'
    import json
    with open(history_path, 'w', encoding='utf-8') as f:
        json.dump([r.model_dump() for r in engine.execution_history], f, ensure_ascii=False, indent=2, default=str)
    click.echo(f"完整历史记录已导出至: {history_path}")


@main.command()
@click.pass_context
def preview(ctx):
    """仅预览，不执行修复"""
    engine = ctx.obj['engine']
    reporter = ctx.obj['reporter']

    click.echo("正在生成预览...\n")
    orders = generate_cross_day_repair_orders()
    suggestions = detect_issues(orders)
    preview_data = engine.preview_fixes(orders, suggestions)
    reporter.print_preview(preview_data)


@main.command()
@click.pass_context
@click.option('--batch-id', help='按批次ID查询')
@click.option('--operator', help='按操作者查询')
@click.option('--risk-type', type=click.Choice([rt.value for rt in RiskType]), help='按风险类型查询')
def query(ctx, batch_id, operator, risk_type):
    """查询历史执行记录"""
    engine = ctx.obj['engine']
    reporter = ctx.obj['reporter']
    output_dir = ctx.obj['output_dir']

    file_history = engine.load_history_from_directory(str(output_dir))
    if not engine.execution_history and not file_history:
        click.echo("暂无历史执行记录，请先运行 datafix run")
        return

    all_history = engine.execution_history + file_history
    engine.execution_history = all_history

    risk_type_enum = RiskType(risk_type) if risk_type else None
    results = engine.query_history(batch_id, operator, risk_type_enum)

    if not results:
        click.echo("未找到匹配的记录")
        return

    click.echo(f"找到 {len(results)} 条记录:\n")
    for result in results:
        reporter.print_console_report(result)
        click.echo("-" * 80)


@main.command()
@click.pass_context
def list_samples(ctx):
    """列出样例数据"""
    click.echo("跨天物业报修单样例数据:\n")
    orders = generate_cross_day_repair_orders()

    for order in orders:
        status_icon = "⚠️ " if order.is_cross_day else "   "
        permission_warn = " 🔴 权限异常" if order.permission_level.value == "admin" else ""
        click.echo(f"{status_icon}[{order.order_id}] {order.community_name} - {order.repair_type}")
        click.echo(f"   报修人: {order.reporter_name}, 处理人: {order.handler_name}")
        click.echo(f"   权限级别: {order.permission_level.value}{permission_warn}")
        click.echo(f"   跨天工单: {'是' if order.is_cross_day else '否'}")
        click.echo()


if __name__ == '__main__':
    main()
