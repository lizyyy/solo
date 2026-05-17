import click
import sys
from pathlib import Path

from loader import DataLoader
from rules import RuleEngine
from exporter import ReportExporter
from __init__ import __version__


@click.group()
@click.version_option(version=__version__, prog_name="志愿者排班CLI")
def cli():
    """志愿者替班签到校验时长认证排查CLI工具"""
    pass


@cli.command()
@click.option("--data-dir", "-d", type=click.Path(exists=True, file_okay=False), 
              default="./data", help="数据目录路径")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False),
              default="./reports", help="报告输出目录")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def validate(data_dir, output_dir, verbose):
    """运行完整验证流程"""
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo(click.style("志愿者替班签到校验时长认证排查CLI", fg="blue", bold=True))
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo("")
    
    click.echo(f"数据目录: {data_dir}")
    click.echo(f"输出目录: {output_dir}")
    click.echo("")
    
    click.echo("加载数据中...")
    loader = DataLoader()
    data = loader.load_all(data_dir)
    
    if data["parse_errors"]:
        click.echo(click.style(f"数据解析错误: {len(data['parse_errors'])} 个", fg="red"))
        if verbose:
            for err in data["parse_errors"]:
                click.echo(f"  - [{err['type']}] {err.get('error', '未知错误')}")
        click.echo("")
    
    click.echo("运行规则验证中...")
    engine = RuleEngine()
    engine.load_volunteers(data["volunteers"])
    engine.load_locations(data["locations"])
    engine.load_shifts(data["shifts"])
    engine.load_checkins(data["checkins"])
    engine.load_substitutes(data["substitutes"])
    engine.load_certifications(data["certifications"])
    
    results = engine.run_all_validations()
    service_records = engine.generate_service_records()
    
    parse_error_count = len(data["parse_errors"])
    results["parse_errors"] = data["parse_errors"]
    results["summary"]["total_errors"] += parse_error_count
    results["summary"]["has_issues"] = results["summary"]["total_errors"] > 0 or results["summary"]["total_warnings"] > 0
    
    summary = results["summary"]
    click.echo("")
    click.echo(click.style("验证结果摘要:", fg="cyan", bold=True))
    click.echo(f"  志愿者: {summary['total_volunteers']} 人")
    click.echo(f"  班次: {summary['total_shifts']} 个")
    click.echo(f"  签到: {summary['total_checkins']} 条")
    click.echo(f"  替班: {summary['total_substitutes']} 条")
    click.echo(f"  认证: {summary['total_certifications']} 条")
    click.echo("")
    
    if summary["total_errors"] > 0:
        click.echo(click.style(f"  错误: {summary['total_errors']} 个", fg="red", bold=True))
    else:
        click.echo(click.style(f"  错误: 0 个 ✓", fg="green"))
        
    if summary["total_warnings"] > 0:
        click.echo(click.style(f"  警告: {summary['total_warnings']} 个", fg="yellow"))
    else:
        click.echo(click.style(f"  警告: 0 个 ✓", fg="green"))
    click.echo("")
    
    click.echo("生成报告中...")
    exporter = ReportExporter(output_dir)
    files = exporter.export_all(results, service_records)
    
    click.echo("")
    click.echo(click.style("导出文件:", fg="cyan", bold=True))
    for name, path in files.items():
        click.echo(f"  ✓ {name}: {path}")
    
    click.echo("")
    if summary["has_issues"]:
        click.echo(click.style("⚠ 存在问题需要处理，请查看详细报告", fg="yellow"))
    else:
        click.echo(click.style("✓ 所有验证通过!", fg="green", bold=True))
    click.echo("")


@cli.command()
@click.option("--data-dir", "-d", type=click.Path(exists=True, file_okay=False),
              default="./data", help="数据目录路径")
def check_capacity(data_dir):
    """仅检查班次容量"""
    loader = DataLoader()
    data = loader.load_all(data_dir)
    
    engine = RuleEngine()
    engine.load_shifts(data["shifts"])
    engine.load_substitutes(data["substitutes"])
    
    violations = engine.validate_shift_capacity()
    
    if violations:
        click.echo(click.style(f"发现 {len(violations)} 个班次容量违规:", fg="red"))
        for v in violations:
            click.echo(f"  - {v['shift_id']} ({v['activity_name']}): "
                      f"容量{v['capacity']}, 实际{v['actual']}, 超出{v['excess']}")
    else:
        click.echo(click.style("所有班次容量均符合要求 ✓", fg="green"))


@cli.command()
@click.option("--data-dir", "-d", type=click.Path(exists=True, file_okay=False),
              default="./data", help="数据目录路径")
def check_location(data_dir):
    """仅检查签到位置"""
    loader = DataLoader()
    data = loader.load_all(data_dir)
    
    engine = RuleEngine()
    engine.load_locations(data["locations"])
    engine.load_shifts(data["shifts"])
    engine.load_checkins(data["checkins"])
    
    violations = engine.validate_location()
    
    if violations:
        click.echo(click.style(f"发现 {len(violations)} 个位置相关问题:", fg="yellow"))
        for v in violations:
            if v["type"] == "missing_location":
                click.echo(f"  ? 签到 {v['checkin_id']}: 缺少位置信息")
            else:
                click.echo(f"  ? 签到 {v['checkin_id']}: 距离 {v['distance_meters']}米, "
                          f"超出范围 {v['allowed_radius']}米")
    else:
        click.echo(click.style("所有签到位置均符合要求 ✓", fg="green"))


@cli.command()
@click.option("--data-dir", "-d", type=click.Path(exists=True, file_okay=False),
              default="./data", help="数据目录路径")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False),
              default="./reports", help="报告输出目录")
def export_records(data_dir, output_dir):
    """仅导出服务记录"""
    loader = DataLoader()
    data = loader.load_all(data_dir)
    
    engine = RuleEngine()
    engine.load_volunteers(data["volunteers"])
    engine.load_locations(data["locations"])
    engine.load_shifts(data["shifts"])
    engine.load_checkins(data["checkins"])
    engine.load_substitutes(data["substitutes"])
    engine.load_certifications(data["certifications"])
    
    engine.run_all_validations()
    service_records = engine.generate_service_records()
    
    exporter = ReportExporter(output_dir)
    csv_path = exporter.export_service_records_csv(
        service_records,
        "service_records.csv"
    )
    
    click.echo(f"已导出 {len(service_records)} 条服务记录到:")
    click.echo(f"  {csv_path}")


if __name__ == "__main__":
    cli()
