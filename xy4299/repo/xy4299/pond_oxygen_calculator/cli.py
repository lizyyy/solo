import click
import os
import sys
from pathlib import Path
from typing import Optional

from .data_parser import DataParser, DataValidationError
from .model_params import ModelParameters
from .calculation_engine import CalculationEngine
from .scheduling_optimizer import SchedulingOptimizer
from .report_exporter import ReportExporter
from .config import DEFAULT_CONFIG


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """鱼塘增氧调度计算器 - 水产实验室专用工具"""
    pass


@cli.command()
@click.argument("input_csv", type=click.Path(exists=True))
@click.option(
    "--output-dir", "-o",
    type=click.Path(),
    default=".",
    help="输出目录 (默认: 当前目录)"
)
@click.option(
    "--report-name", "-r",
    default="aeration_report.md",
    help="报告文件名 (默认: aeration_report.md)"
)
@click.option(
    "--aerator-count", "-a",
    type=int,
    default=4,
    help="每塘增氧机数量 (默认: 4)"
)
@click.option(
    "--pond-area", "-p",
    type=float,
    default=1.0,
    help="池塘面积 (ha, 默认: 1.0)"
)
@click.option(
    "--water-depth", "-d",
    type=float,
    default=1.5,
    help="水深 (m, 默认: 1.5)"
)
@click.option(
    "--fish-species", "-s",
    type=click.Choice(["tilapia", "carp", "catfish", "shrimp"]),
    default="tilapia",
    help="养殖品种 (默认: tilapia)"
)
@click.option(
    "--strategy", "-t",
    type=click.Choice(["balanced", "cost_saving", "safety_first"]),
    default="balanced",
    help="优化策略 (默认: balanced)"
)
@click.option(
    "--no-csv",
    is_flag=True,
    help="不导出CSV结果文件"
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="显示详细输出"
)
def calculate(
    input_csv: str,
    output_dir: str,
    report_name: str,
    aerator_count: int,
    pond_area: float,
    water_depth: float,
    fish_species: str,
    strategy: str,
    no_csv: bool,
    verbose: bool,
):
    """
    计算鱼塘缺氧风险并生成增氧调度方案

    INPUT_CSV: 输入数据CSV文件路径
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    click.echo("=" * 60)
    click.echo("鱼塘增氧调度计算器")
    click.echo("=" * 60)
    click.echo()

    click.echo("[1/5] 解析输入数据...")
    parser = DataParser()

    try:
        df = parser.parse_csv(input_csv)
    except DataValidationError as e:
        click.echo()
        click.secho("❌ 数据验证失败:", fg="red", bold=True)
        for error in e.errors:
            click.secho(f"   - {error}", fg="red")
        sys.exit(1)

    warnings = parser.get_warnings()
    if warnings:
        click.secho("   ⚠️ 警告:", fg="yellow")
        for warning in warnings:
            click.secho(f"      - {warning}", fg="yellow")

    if verbose:
        click.echo(f"   ✓ 成功加载 {len(df)} 条记录")
        click.echo(f"   ✓ 涉及 {df['pond_id'].nunique()} 个池塘")

    input_data_info = {
        "pond_count": df["pond_id"].nunique(),
        "record_count": len(df),
        "time_range": f"{df['timestamp'].min()} 至 {df['timestamp'].max()}",
    }

    click.echo()
    click.echo("[2/5] 初始化计算模型...")

    model_params = ModelParameters()
    calc_engine = CalculationEngine(model_params=model_params)

    if verbose:
        click.echo(f"   ✓ 临界溶氧: {model_params.critical_do_level} mg/L")
        click.echo(f"   ✓ 警告溶氧: {model_params.warning_do_level} mg/L")
        click.echo(f"   ✓ 养殖品种: {fish_species}")

    click.echo()
    click.echo("[3/5] 计算溶氧平衡与风险预测...")

    pond_results = calc_engine.calculate_ponds(
        df,
        aerator_count=aerator_count,
        pond_area=pond_area,
        water_depth=water_depth,
        fish_species=fish_species,
    )

    critical_count = sum(
        1 for r in pond_results.values()
        if r.summary["overall_risk"] == "critical"
    )
    warning_count = sum(
        1 for r in pond_results.values()
        if r.summary["overall_risk"] == "warning"
    )
    normal_count = len(pond_results) - critical_count - warning_count

    click.echo(f"   ✓ 风险统计: 🔴{critical_count} 🟡{warning_count} 🟢{normal_count}")

    click.echo()
    click.echo("[4/5] 优化增氧排班...")

    scheduler = SchedulingOptimizer(model_params=model_params)
    schedule_results = scheduler.optimize_schedules(
        pond_results,
        df,
        aerator_count=aerator_count,
        pond_area=pond_area,
        water_depth=water_depth,
        fish_species=fish_species,
        optimization_strategy=strategy,
    )

    total_hours = sum(r.total_hours for r in schedule_results.values())
    total_cost = sum(r.total_cost for r in schedule_results.values())

    strategy_names = {
        "balanced": "平衡策略",
        "cost_saving": "成本节约",
        "safety_first": "安全优先",
    }
    click.echo(f"   ✓ 优化策略: {strategy_names.get(strategy, strategy)}")
    click.echo(f"   ✓ 建议增氧: {total_hours:.1f} 小时")
    click.echo(f"   ✓ 预估电费: ¥{total_cost:.2f}")

    click.echo()
    click.echo("[5/5] 导出结果...")

    exporter = ReportExporter()

    report_path = output_dir / report_name
    exporter.export_markdown_report(
        pond_results,
        schedule_results,
        str(report_path),
        input_data_info=input_data_info,
        warnings=warnings,
    )
    click.echo(f"   ✓ 报告已导出: {report_path}")

    if not no_csv:
        csv_output_dir = output_dir / "csv_results"
        csv_files = exporter.export_csv_results(
            pond_results,
            schedule_results,
            str(csv_output_dir),
        )
        click.echo(f"   ✓ CSV结果已导出至: {csv_output_dir}")
        if verbose:
            for name, path in csv_files.items():
                click.echo(f"      - {name}: {Path(path).name}")

    click.echo()
    click.echo("=" * 60)
    click.secho("✅ 计算完成!", fg="green", bold=True)
    click.echo()

    _print_summary(pond_results, schedule_results)

    click.echo()
    click.echo(f"详细报告请查看: {report_path}")


@cli.command()
@click.argument("output_csv", type=click.Path())
@click.option(
    "--pond-count", "-p",
    type=int,
    default=3,
    help="池塘数量 (默认: 3)"
)
@click.option(
    "--hours", "-h",
    type=int,
    default=24,
    help="数据时长 (小时, 默认: 24)"
)
@click.option(
    "--add-errors", "-e",
    is_flag=True,
    help="添加一些错误数据用于测试验证"
)
def generate_sample(
    output_csv: str,
    pond_count: int,
    hours: int,
    add_errors: bool,
):
    """
    生成示例数据CSV文件

    OUTPUT_CSV: 输出CSV文件路径
    """
    click.echo("生成示例数据...")

    df = DataParser.generate_sample_data(pond_count=pond_count, hours=hours)

    if add_errors:
        df.loc[0, "temperature"] = 50
        df.loc[1, "dissolved_oxygen"] = -1
        df.loc[2, "weather"] = "invalid_type"
        df.loc[3, "fish_density"] = 30000
        click.echo("   ✓ 已添加测试错误数据")

    output_path = Path(output_csv)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df.to_csv(output_csv, index=False, encoding="utf-8-sig")

    click.echo(f"   ✓ 已生成 {len(df)} 条记录")
    click.echo(f"   ✓ 涉及 {df['pond_id'].nunique()} 个池塘")
    click.echo(f"   ✓ 文件已保存: {output_path}")
    click.echo()
    click.echo("使用示例:")
    click.echo(f"   python -m pond_oxygen_calculator calculate {output_csv}")


@cli.command()
@click.argument("input_csv", type=click.Path(exists=True))
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="显示详细信息"
)
def validate(input_csv: str, verbose: bool):
    """
    验证CSV数据格式和内容

    INPUT_CSV: 输入数据CSV文件路径
    """
    click.echo("验证数据...")
    click.echo()

    parser = DataParser()

    try:
        df = parser.parse_csv(input_csv)
    except DataValidationError as e:
        click.secho("❌ 验证失败:", fg="red", bold=True)
        for error in e.errors:
            click.secho(f"   - {error}", fg="red")
        sys.exit(1)

    warnings = parser.get_warnings()

    click.secho("✅ 数据验证通过!", fg="green", bold=True)
    click.echo()

    click.echo("数据概览:")
    click.echo(f"   - 总记录数: {len(df)}")
    click.echo(f"   - 池塘数量: {df['pond_id'].nunique()}")
    click.echo(f"   - 时间范围: {df['timestamp'].min()} 至 {df['timestamp'].max()}")
    click.echo()

    if verbose:
        click.echo("各池塘数据量:")
        for pond_id, count in df["pond_id"].value_counts().items():
            click.echo(f"   - {pond_id}: {count} 条记录")
        click.echo()

        click.echo("数据字段统计:")
        numeric_cols = ["temperature", "dissolved_oxygen", "fish_density", "feeding_rate"]
        for col in numeric_cols:
            if col in df.columns:
                click.echo(f"   - {col}:")
                click.echo(f"        范围: {df[col].min():.2f} ~ {df[col].max():.2f}")
                click.echo(f"        均值: {df[col].mean():.2f}")
        click.echo()

    if warnings:
        click.secho("⚠️ 警告:", fg="yellow")
        for warning in warnings:
            click.secho(f"   - {warning}", fg="yellow")


def _print_summary(pond_results, schedule_results):
    click.echo("┌" + "─" * 58 + "┐")
    click.echo("│" + "各池塘风险汇总".center(58) + "│")
    click.echo("├" + "─" * 58 + "┤")

    header = f"│ {'池塘':<8} {'风险':<8} {'最低DO':<10} {'建议增氧':<10} {'预估电费':<12} │"
    click.echo(header)
    click.echo("├" + "─" * 58 + "┤")

    for pond_id, result in pond_results.items():
        schedule = schedule_results.get(pond_id)
        risk = result.summary["overall_risk"]
        min_do = result.summary["min_night_do"]
        hours = schedule.total_hours if schedule else 0
        cost = schedule.total_cost if schedule else 0

        risk_emoji = "🔴" if risk == "critical" else (
            "🟡" if risk == "warning" else "🟢"
        )

        row = (
            f"│ {pond_id:<8} "
            f"{risk_emoji}{risk.upper():<6} "
            f"{min_do:.1f} mg/L{'':<3} "
            f"{hours:.1f}h{'':<5} "
            f"¥{cost:.2f}{'':<8} │"
        )
        click.echo(row)

    click.echo("└" + "─" * 58 + "┘")


if __name__ == "__main__":
    cli()
