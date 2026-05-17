import click
from pathlib import Path
from datetime import datetime
from typing import Optional
import sys

from .data_loader import DataLoader
from .analyzer import WasteAnalyzer
from .report_exporter import ReportExporter


@click.group()
def cli():
    """原料损耗单位换算门店排行排查CLI"""
    pass


@cli.command()
@click.option("--materials", "-m", required=True, type=click.Path(exists=True), help="原料数据文件路径")
@click.option("--purchases", "-p", required=True, type=click.Path(exists=True), help="采购单数据文件路径")
@click.option("--usages", "-u", required=True, type=click.Path(exists=True), help="领用单数据文件路径")
@click.option("--damages", "-d", required=True, type=click.Path(exists=True), help="报损单数据文件路径")
@click.option("--stores", "-s", required=True, type=click.Path(exists=True), help="门店数据文件路径")
@click.option("--threshold", "-t", default=0.05, type=float, help="损耗率阈值，默认0.05(5%)")
@click.option("--start-date", help="开始日期，格式: YYYY-MM-DD")
@click.option("--end-date", help="结束日期，格式: YYYY-MM-DD")
@click.option("--output", "-o", default="./output", type=click.Path(), help="输出目录")
@click.option("--format", "-f", "output_format", default="all", type=click.Choice(["all", "json", "csv", "txt"]), help="输出格式")
def analyze(
    materials: str,
    purchases: str,
    usages: str,
    damages: str,
    stores: str,
    threshold: float,
    start_date: Optional[str],
    end_date: Optional[str],
    output: str,
    output_format: str,
):
    """分析原料损耗数据"""
    click.echo("=" * 60)
    click.echo("原料损耗分析工具")
    click.echo("=" * 60)

    try:
        start_date_parsed = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
        end_date_parsed = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None
    except ValueError as e:
        click.echo(f"日期格式错误: {e}", err=True)
        sys.exit(1)

    click.echo(f"\n参数:")
    click.echo(f"  损耗率阈值: {threshold:.2%}")
    if start_date_parsed:
        click.echo(f"  开始日期: {start_date_parsed}")
    if end_date_parsed:
        click.echo(f"  结束日期: {end_date_parsed}")

    click.echo("\n正在加载数据...")
    loader = DataLoader()
    try:
        data = loader.load_data(
            materials_path=Path(materials),
            purchases_path=Path(purchases),
            usages_path=Path(usages),
            damages_path=Path(damages),
            stores_path=Path(stores),
        )
    except Exception as e:
        click.echo(f"数据加载失败: {e}", err=True)
        sys.exit(1)

    validation_report = loader.get_report()
    if validation_report["has_warnings"]:
        click.echo(f"  警告: {len(validation_report['warnings'])} 条")
    if validation_report["has_errors"]:
        click.echo(f"  错误: {len(validation_report['errors'])} 条", err=True)
        for err in validation_report["errors"]:
            click.echo(f"    - {err}", err=True)
        sys.exit(1)

    click.echo(f"  原料: {len(data['materials'])} 条")
    click.echo(f"  采购单: {len(data['purchases'])} 条")
    click.echo(f"  领用单: {len(data['usages'])} 条")
    click.echo(f"  报损单: {len(data['damages'])} 条")
    click.echo(f"  门店: {len(data['stores'])} 条")

    click.echo("\n正在分析数据...")
    analyzer = WasteAnalyzer(
        materials=data["materials"],
        purchases=data["purchases"],
        usages=data["usages"],
        damages=data["damages"],
        stores=data["stores"],
        waste_rate_threshold=threshold,
        start_date=start_date_parsed,
        end_date=end_date_parsed,
    )

    waste_records = analyzer.calculate_waste_records()
    abnormal_records = analyzer.get_abnormal_records(waste_records)
    store_ranking = analyzer.get_store_ranking(waste_records)
    category_summary = analyzer.get_category_summary(waste_records)

    click.echo(f"  分析记录: {len(waste_records)} 条")
    click.echo(f"  异常记录: {len(abnormal_records)} 条")

    click.echo("\n正在导出报告...")
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)

    if output_format in ["all", "json"]:
        ReportExporter.export_json(
            waste_records, store_ranking, category_summary, validation_report,
            output_path / "waste_report.json"
        )
        click.echo(f"  JSON报告: {output_path / 'waste_report.json'}")

    if output_format in ["all", "csv"]:
        ReportExporter.export_csv(
            waste_records, store_ranking, category_summary,
            output_path / "csv"
        )
        click.echo(f"  CSV报告: {output_path / 'csv/'}")

    if output_format in ["all", "txt"]:
        ReportExporter.export_human_readable(
            waste_records, store_ranking, category_summary, validation_report,
            output_path / "waste_report.txt"
        )
        click.echo(f"  文本报告: {output_path / 'waste_report.txt'}")

    click.echo("\n" + "=" * 60)
    click.echo("分析完成！")
    click.echo("=" * 60)

    if abnormal_records:
        click.echo("\n异常门店TOP 3:")
        for i, store in enumerate(store_ranking[:3], 1):
            if store["waste_rate"] > threshold:
                click.echo(f"  {i}. {store['store_name']}: 损耗率 {store['waste_rate']:.2%}")


@cli.command()
@click.argument("sample_type", type=click.Choice(["normal", "dirty", "boundary", "empty"]))
@click.option("--output", "-o", default="./sample_data", type=click.Path(), help="样例数据输出目录")
def generate_samples(sample_type: str, output: str):
    """生成样例测试数据

    \b
    SAMPLE_TYPE: 样例类型
      - normal: 正常输入数据
      - dirty: 包含脏数据的输入
      - boundary: 边界冲突数据
      - empty: 空结果数据
    """
    output_path = Path(output) / sample_type
    output_path.mkdir(parents=True, exist_ok=True)

    from . import sample_data

    generators = {
        "normal": sample_data.generate_normal_sample,
        "dirty": sample_data.generate_dirty_sample,
        "boundary": sample_data.generate_boundary_sample,
        "empty": sample_data.generate_empty_sample,
    }

    click.echo(f"正在生成 {sample_type} 样例数据...")
    generators[sample_type](output_path)
    click.echo(f"样例数据已生成到: {output_path}")


if __name__ == "__main__":
    cli()
