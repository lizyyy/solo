import click
from pathlib import Path
from .inspector import PortInspector
from .exporter import Exporter
from .models import RiskLevel


@click.group()
@click.option('--data-dir', type=click.Path(file_okay=False), help='数据目录')
@click.pass_context
def cli(ctx, data_dir):
    """端口占用巡检命令行工具"""
    ctx.ensure_object(dict)
    if data_dir:
        ctx.obj['data_dir'] = Path(data_dir)
    else:
        ctx.obj['data_dir'] = Path.home() / ".port_inspector" / "data"


@cli.command()
@click.argument('excel_file', type=click.Path(exists=True))
@click.option('--rule-version', help='指定规则版本，默认使用最新版本')
@click.pass_context
def inspect(ctx, excel_file, rule_version):
    """执行端口占用巡检"""
    inspector = PortInspector(ctx.obj['data_dir'])
    samples = inspector.load_samples_from_excel(Path(excel_file))

    click.echo(f"加载了 {len(samples)} 个样本")

    batch = inspector.process_batch(samples, rule_version)
    report = inspector.get_batch_report(batch.batch_id)

    click.echo(f"\n批次ID: {batch.batch_id}")
    click.echo(f"使用规则版本: {batch.rule_version_at_submit}")
    click.echo(f"总样本数: {report['total_samples']}")
    click.echo(f"异常样本数: {report['anomaly_count']}")
    click.echo(f"\n风险等级分布:")
    for risk, count in report['risk_distribution'].items():
        click.echo(f"  {risk}: {count}")

    if report['anomaly_count'] > 0:
        exporter = Exporter(ctx.obj['data_dir'])
        output = exporter.export_anomalies(batch.batch_id)
        click.echo(f"\n异常样本已导出到: {output}")


@cli.command()
@click.argument('batch_id')
@click.option('--output', type=click.Path(), help='输出文件路径')
@click.pass_context
def export(ctx, batch_id, output):
    """导出批次完整报告"""
    exporter = Exporter(ctx.obj['data_dir'])
    output_path = Path(output) if output else None
    result = exporter.export_full_report(batch_id, output_path)
    click.echo(f"报告已导出到: {result}")


@cli.command()
@click.argument('batch_id')
@click.option('--output', type=click.Path(), help='输出文件路径')
@click.option('--risk-level', type=click.Choice(['critical', 'high', 'medium', 'low', 'safe']), help='按风险等级过滤')
@click.pass_context
def export_anomalies(ctx, batch_id, output, risk_level):
    """导出异常样本供复核"""
    exporter = Exporter(ctx.obj['data_dir'])
    output_path = Path(output) if output else None
    result = exporter.export_anomalies(batch_id, output_path, risk_level)
    click.echo(f"异常样本已导出到: {result}")


@cli.command()
@click.argument('risk_level', type=click.Choice(['critical', 'high', 'medium', 'low', 'safe']))
@click.option('--output', type=click.Path(), help='输出文件路径')
@click.pass_context
def export_by_risk(ctx, risk_level, output):
    """按风险等级导出所有异常样本"""
    exporter = Exporter(ctx.obj['data_dir'])
    output_path = Path(output) if output else None
    result = exporter.export_by_risk_level(risk_level, output_path)
    click.echo(f"风险等级 {risk_level} 的异常样本已导出到: {result}")


@cli.command()
@click.argument('sample_id')
@click.argument('reviewer')
@click.option('--notes', default='', help='复核备注')
@click.pass_context
def review(ctx, sample_id, reviewer, notes):
    """标记样本为已复核"""
    exporter = Exporter(ctx.obj['data_dir'])
    result = exporter.mark_reviewed(sample_id, reviewer, notes)
    click.echo(f"样本 {sample_id} 已标记为已复核")


@cli.command()
@click.argument('batch_id')
@click.pass_context
def report(ctx, batch_id):
    """查看批次巡检报告"""
    inspector = PortInspector(ctx.obj['data_dir'])
    report = inspector.get_batch_report(batch_id)

    click.echo(f"批次ID: {batch_id}")
    click.echo(f"提交时间: {report['batch']['submit_time']}")
    click.echo(f"规则版本: {report['rule_version']}")
    click.echo(f"总样本数: {report['total_samples']}")
    click.echo(f"异常样本数: {report['anomaly_count']}")
    click.echo(f"\n风险等级分布:")
    for risk, count in report['risk_distribution'].items():
        click.echo(f"  {risk}: {count}")

    click.echo(f"\n异常样本详情:")
    for item in report['results']:
        if item['result']['is_anomaly']:
            sample = item['sample']
            result = item['result']
            click.echo(f"\n  样本ID: {sample['sample_id']}")
            click.echo(f"  IP: {sample['ip_address']}:{sample['port']}")
            click.echo(f"  供应商: {sample['supplier']} (原始: {sample['supplier_original']})")
            click.echo(f"  风险等级: {result['risk_level']}")
            click.echo(f"  结论: {result['conclusion']}")


@cli.command()
@click.pass_context
def list_batches(ctx):
    """列出所有巡检批次"""
    inspector = PortInspector(ctx.obj['data_dir'])
    batches = inspector.storage.list_batches()

    if not batches:
        click.echo("暂无巡检批次")
        return

    click.echo(f"共 {len(batches)} 个批次:")
    for batch in batches:
        click.echo(f"\n批次ID: {batch.batch_id}")
        click.echo(f"  提交时间: {batch.submit_time}")
        click.echo(f"  规则版本: {batch.rule_version_at_submit}")
        click.echo(f"  总样本数: {batch.total_samples}")
        click.echo(f"  异常数: {batch.anomaly_count}")
        click.echo(f"  状态: {batch.status}")


@cli.command()
@click.pass_context
def list_rules(ctx):
    """列出所有规则版本"""
    inspector = PortInspector(ctx.obj['data_dir'])
    versions = inspector.rule_manager.list_rule_versions()

    click.echo(f"共 {len(versions)} 个规则版本:")
    for v in versions:
        click.echo(f"\n版本: {v.version}")
        click.echo(f"  生效时间: {v.effective_date}")
        click.echo(f"  描述: {v.description}")

    latest = inspector.rule_manager.get_latest_rule()
    click.echo(f"\n当前生效版本: {latest.version}")


def main():
    cli()


if __name__ == '__main__':
    main()
