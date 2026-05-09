import click
from pathlib import Path
import sys

from . import __version__
from .audit_engine import AuditEngine
from .sampling import SamplingEngine
from .models import SamplingRule


@click.group()
@click.version_option(__version__)
@click.option("--work-dir", "-w", type=click.Path(), default=None,
              help="工作目录 (默认当前目录)")
@click.option("--history-dir", "-h", type=click.Path(), default=None,
              help="历史记录目录 (默认 .qc-history)")
@click.pass_context
def cli(ctx, work_dir, history_dir):
    """质检抽样复核 CLI - 处理工厂抽检样本补录后的批次复核"""
    work_path = Path(work_dir) if work_dir else None
    hist_path = Path(history_dir) if history_dir else None
    ctx.obj = AuditEngine(work_path, hist_path)


@cli.command()
@click.argument("rules_path", type=click.Path(exists=True))
@click.argument("batches_path", type=click.Path(exists=True))
@click.option("--samples", "-s", type=click.Path(exists=True), default=None,
              help="样本数据文件路径 (可选)")
@click.option("--rechecks", "-r", type=click.Path(exists=True), default=None,
              help="复检记录文件路径 (可选)")
@click.option("--declared", "-d", type=click.Path(exists=True), default=None,
              help="申报数据文件路径 (用于对比差异)")
@click.option("--output", "-o", type=click.Path(), default=None,
              help="输出目录")
@click.option("--format", "-f", multiple=True, type=click.Choice(["json", "text", "csv"]),
              default=["json", "text", "csv"],
              help="导出格式 (可多选)")
@click.option("--no-history", is_flag=True, help="不保存历史记录")
@click.pass_obj
def audit(engine: AuditEngine, rules_path, batches_path, samples, rechecks,
          declared, output, format, no_history):
    """执行审计复核，验证批次合格率与复检结论"""
    result = engine.run_full_audit(
        rules_path=Path(rules_path),
        batches_path=Path(batches_path),
        samples_path=Path(samples) if samples else None,
        rechecks_path=Path(rechecks) if rechecks else None,
        declared_path=Path(declared) if declared else None,
        output_dir=Path(output) if output else None,
        formats=list(format) if format else None,
        save_history=not no_history,
    )

    report = result["report"]
    summary = result["summary"]

    click.echo(f"")
    click.echo(f"=" * 60)
    click.echo(f"审计报告 #{result['run_id']}")
    click.echo(f"=" * 60)
    click.echo(f"")
    click.echo(f"[概览]")
    click.echo(f"  批次总数: {summary['total_batches']}")
    click.echo(f"  样本总数: {summary['total_samples']}")
    click.echo(f"  不合格样本: {summary['total_defective']}")
    click.echo(f"  整体通过率: {summary['overall_pass_rate']:.2%}")
    click.echo(f"")

    if report.discrepancies:
        click.echo(f"[发现差异] ({len(report.discrepancies)} 项)")
        for d in report.discrepancies:
            click.echo(f"  - {d.get('type')}: 批次 {d.get('batch_id')}")
            if d.get('type') == 'pass_rate_mismatch':
                click.echo(f"    申报: {d.get('declared', 0):.2%} vs 计算: {d.get('calculated', 0):.2%}")
        click.echo(f"")

    if report.dirty_data_warnings:
        click.echo(f"[脏数据警告] ({len(report.dirty_data_warnings)} 项)")
        for w in report.dirty_data_warnings:
            click.echo(f"  [{w.get('level')}] {w.get('code')}: {w.get('message')}")
        click.echo(f"")

    click.echo(f"[导出文件]")
    for f in result["exported_files"]:
        click.echo(f"  - {f}")
    click.echo(f"")

    if summary["total_discrepancies"] > 0:
        sys.exit(2)
    elif summary["total_warnings"] > 0:
        sys.exit(1)


@cli.command()
@click.argument("rules_path", type=click.Path(exists=True))
@click.argument("batches_path", type=click.Path(exists=True))
@click.argument("merge_config", type=click.Path(exists=True))
@click.option("--samples", "-s", type=click.Path(exists=True), default=None,
              help="样本数据文件路径 (可选)")
@click.option("--output", "-o", type=click.Path(), default=None,
              help="输出目录")
@click.option("--format", "-f", multiple=True, type=click.Choice(["json", "text", "csv"]),
              default=["json", "text", "csv"],
              help="导出格式")
@click.option("--no-history", is_flag=True, help="不保存历史记录")
@click.pass_obj
def merge(engine: AuditEngine, rules_path, batches_path, merge_config,
          samples, output, format, no_history):
    """合并多个批次后执行审计"""
    import json
    import yaml
    
    mc_path = Path(merge_config)
    if mc_path.suffix.lower() in [".yaml", ".yml"]:
        with open(mc_path, "r", encoding="utf-8") as f:
            merge_specs = yaml.safe_load(f)
    else:
        with open(mc_path, "r", encoding="utf-8") as f:
            merge_specs = json.load(f)
    
    if isinstance(merge_specs, dict) and "merges" in merge_specs:
        merge_specs = merge_specs["merges"]

    result = engine.merge_and_audit(
        rules_path=Path(rules_path),
        batches_path=Path(batches_path),
        merge_specs=merge_specs,
        samples_path=Path(samples) if samples else None,
        output_dir=Path(output) if output else None,
        formats=list(format) if format else None,
        save_history=not no_history,
    )

    click.echo(f"合并审计完成: #{result['run_id']}")
    for f in result["exported_files"]:
        click.echo(f"  - {f}")


@cli.command()
@click.argument("run_id")
@click.option("--output", "-o", type=click.Path(), default=None,
              help="输出目录")
@click.option("--format", "-f", multiple=True, type=click.Choice(["json", "text", "csv"]),
              default=["json", "text", "csv"],
              help="导出格式")
@click.pass_obj
def recalc(engine: AuditEngine, run_id, output, format):
    """重新计算历史审计（确保可复算性）"""
    result = engine.recalculate_run(
        run_id=run_id,
        output_dir=Path(output) if output else None,
        formats=list(format) if format else None,
    )

    if not result:
        click.echo(f"错误: 找不到运行记录 {run_id}", err=True)
        sys.exit(1)

    click.echo(f"重新计算完成")
    click.echo(f"  原始运行: {result['original_run_id']}")
    click.echo(f"  新运行 ID: {result['new_run_id']}")
    for f in result["exported_files"]:
        click.echo(f"  - {f}")


@cli.command("list-runs")
@click.option("--limit", "-n", type=int, default=20, help="显示最近 N 条记录")
@click.pass_obj
def list_runs(engine: AuditEngine, limit):
    """列出历史运行记录"""
    runs = engine.history.list_runs(limit)

    if not runs:
        click.echo("暂无历史记录")
        return

    click.echo(f"最近 {len(runs)} 条运行记录:")
    click.echo("-" * 80)
    for run in runs:
        summary = run.get("summary", {})
        click.echo(f"{run['run_id']}")
        click.echo(f"  时间: {run['timestamp']} | 命令: {run['command']}")
        click.echo(f"  批次: {summary.get('total_batches', 0)} | "
                   f"差异: {summary.get('total_discrepancies', 0)} | "
                   f"警告: {summary.get('total_warnings', 0)}")
        click.echo("")


@cli.command()
@click.argument("quantity", type=int)
@click.argument("rules_path", type=click.Path(exists=True))
@click.option("--product", "-p", default=None, help="产品名称")
@click.pass_obj
def plan(engine: AuditEngine, quantity, rules_path, product):
    """根据批量生成抽样计划"""
    rules = engine.load_rules(Path(rules_path))
    sampling = SamplingEngine(rules)
    plan_result = sampling.generate_sampling_plan(quantity, product)

    if not plan_result["rule"]:
        click.echo(f"错误: 未找到匹配的抽样规则", err=True)
        sys.exit(1)

    click.echo(f"抽样计划 (批量: {quantity})")
    click.echo(f"=" * 40)
    click.echo(f"规则: {plan_result['rule_name']} ({plan_result['rule']})")
    click.echo(f"描述: {plan_result['rule_description']}")
    click.echo(f"需要抽检: {plan_result['sample_size']} 样本")
    click.echo(f"合格阈值: {plan_result['pass_threshold']:.2%}")


@cli.command("init-examples")
@click.option("--output", "-o", type=click.Path(), default="examples",
              help="示例文件输出目录")
def init_examples(output):
    """生成示例数据文件"""
    from . import examples
    output_path = Path(output)
    count = examples.generate_examples(output_path)
    click.echo(f"已生成 {count} 个示例文件到: {output_path.resolve()}")


def main():
    cli()


if __name__ == "__main__":
    main()
