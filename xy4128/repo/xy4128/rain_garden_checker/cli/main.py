import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from rain_garden_checker.models.data_models import (
    InfiltrationModel,
    WarningLevel,
    TimeUnit,
    LengthUnit,
    AreaUnit,
)
from rain_garden_checker.storage.project import ProjectManager
from rain_garden_checker.parsers.csv_parser import CSVParser
from rain_garden_checker.engine.infiltration import HydrologicEngine
from rain_garden_checker.validators.rules import RuleValidator
from rain_garden_checker.reports.exporter import ReportExporter


console = Console()


def get_project_dir() -> Path:
    return Path(os.getcwd())


def require_project() -> ProjectManager:
    pm = ProjectManager(get_project_dir())
    if not pm.is_project_initialized():
        console.print("[red]错误: 当前目录不是已初始化的项目[/red]")
        console.print("请先运行 'rain-garden init' 初始化项目")
        sys.exit(1)
    pm.load_config()
    return pm


def load_all_data(pm: ProjectManager) -> Dict[str, Any]:
    parser = CSVParser()
    engine = HydrologicEngine()

    result = {
        "rainfall_series": [],
        "soil": None,
        "catchments": [],
        "pond": None,
        "parse_warnings": [],
    }

    rainfall_files = pm.list_rainfall_files()
    for rf in rainfall_files:
        name = rf.stem
        return_period = 5.0
        for rp in [100, 50, 20, 10, 5, 3, 2, 1]:
            if f"_{rp}y" in name or f"{rp}年" in name:
                return_period = float(rp)
                break

        series = parser.parse_rainfall_csv(
            rf,
            name=name,
            return_period=return_period,
        )
        if series:
            result["rainfall_series"].append(series)
        if parser.warnings:
            result["parse_warnings"].extend(parser.warnings.copy())

    soil_files = pm.list_soil_files()
    if soil_files:
        soil = parser.parse_soil_test_csv(soil_files[0], test_id=soil_files[0].stem)
        if soil:
            result["soil"] = soil
        if parser.warnings:
            result["parse_warnings"].extend(parser.warnings.copy())

    catchment_files = pm.list_catchment_files()
    if catchment_files:
        catchments = parser.parse_catchment_csv(catchment_files[0])
        if catchments:
            result["catchments"] = catchments
        if parser.warnings:
            result["parse_warnings"].extend(parser.warnings.copy())

    pond_files = pm.list_pond_files()
    if pond_files:
        pond = parser.parse_pond_csv(pond_files[0])
        if pond:
            result["pond"] = pond
        if parser.warnings:
            result["parse_warnings"].extend(parser.warnings.copy())

    return result


@click.group()
@click.version_option(version="0.1.0", prog_name="rain-garden")
def main():
    """
    雨水花园渗透复核器 - 海绵城市设计科学计算工具

    用于小区改造前雨水花园的渗透能力复核，包括：
    - 多源数据导入与校验
    - 可配置入渗模型计算
    - 多场设计雨型对比
    - 规则校验（容量、排空时间、土壤参数等）
    - 复核报告导出
    """
    pass


@main.command()
@click.argument("name", default="雨水花园项目")
@click.option("--description", "-d", default="", help="项目描述")
@click.option("--no-examples", is_flag=True, help="不创建示例数据")
def init(name: str, description: str, no_examples: bool):
    """
    初始化一个新的雨水花园复核项目

    在当前目录创建项目结构和配置文件。
    """
    pm = ProjectManager(get_project_dir())

    if pm.is_project_initialized():
        console.print("[yellow]警告: 当前目录已有项目配置[/yellow]")
        if not click.confirm("是否覆盖现有项目？"):
            return

    create_examples = not no_examples
    config = pm.init_project(
        project_name=name,
        description=description if description else None,
        create_examples=create_examples,
    )

    console.print(Panel.fit(
        f"[green]✓ 项目初始化成功[/green]\n\n"
        f"项目名称: {config.project_name}\n"
        f"项目ID: {config.project_id}\n"
        f"创建示例数据: {'是' if create_examples else '否'}",
        title="雨水花园渗透复核器",
    ))

    if create_examples:
        examples_dir = pm.get_examples_dir()
        console.print(f"\n[blue]示例数据已创建在: {examples_dir}[/blue]")
        console.print("使用 'rain-garden import --from-examples' 导入示例数据进行测试")


@main.command("import")
@click.option("--rainfall", "-r", type=click.Path(exists=True), help="降雨过程 CSV 文件")
@click.option("--rainfall-name", default="design_rain", help="降雨名称")
@click.option("--return-period", "-rp", type=float, default=5.0, help="暴雨重现期（年）")
@click.option("--soil", "-s", type=click.Path(exists=True), help="土壤入渗试验 CSV")
@click.option("--soil-id", default="soil_01", help="土壤试验 ID")
@click.option("--catchment", "-c", type=click.Path(exists=True), help="汇水面积 CSV")
@click.option("--pond", "-p", type=click.Path(exists=True), help="池体几何参数 CSV")
@click.option("--from-examples", is_flag=True, help="从示例目录导入所有数据")
@click.option("--time-unit", default="min", type=click.Choice(["s", "min", "h", "day"]), help="时间单位")
@click.option("--intensity-unit", default="mm", type=click.Choice(["mm", "cm", "m"]), help="降雨强度单位")
def import_data(
    rainfall: Optional[str],
    rainfall_name: str,
    return_period: float,
    soil: Optional[str],
    soil_id: str,
    catchment: Optional[str],
    pond: Optional[str],
    from_examples: bool,
    time_unit: str,
    intensity_unit: str,
):
    """
    导入多源数据到项目

    支持导入：降雨过程、土壤入渗试验、汇水面积、池体几何参数
    """
    pm = require_project()
    parser = CSVParser()

    imported_count = 0

    if from_examples:
        examples_dir = pm.get_examples_dir()

        for rf in examples_dir.glob("rainfall_*.csv"):
            name = rf.stem
            rp = 5.0
            for years in [100, 50, 20, 10, 5, 3, 2, 1]:
                if f"_{years}y" in name:
                    rp = float(years)
                    break

            series = parser.parse_rainfall_csv(rf, name=name, return_period=rp)
            if series:
                pm.import_rainfall(rf, name, rp)
                console.print(f"[green]✓ 已导入降雨: {name} ({rp}年一遇)[/green]")
                imported_count += 1
            if parser.warnings:
                for w in parser.warnings:
                    level_color = "red" if w.level == WarningLevel.CRITICAL else "yellow"
                    console.print(f"[{level_color}]  [{w.level.value}] {w.message}[/{level_color}]")

        soil_file = examples_dir / "soil_test.csv"
        if soil_file.exists():
            soil_data = parser.parse_soil_test_csv(soil_file, test_id="soil_test")
            if soil_data:
                pm.import_soil(soil_file, "soil_test")
                console.print("[green]✓ 已导入土壤试验数据[/green]")
                imported_count += 1
            if parser.warnings:
                for w in parser.warnings:
                    level_color = "red" if w.level == WarningLevel.CRITICAL else "yellow"
                    console.print(f"[{level_color}]  [{w.level.value}] {w.message}[/{level_color}]")

        catchment_file = examples_dir / "catchment.csv"
        if catchment_file.exists():
            pm.import_catchment(catchment_file)
            console.print("[green]✓ 已导入汇水面积数据[/green]")
            imported_count += 1

        pond_file = examples_dir / "pond.csv"
        if pond_file.exists():
            pm.import_pond(pond_file)
            console.print("[green]✓ 已导入池体几何数据[/green]")
            imported_count += 1

    else:
        if rainfall:
            rf_path = Path(rainfall)
            series = parser.parse_rainfall_csv(
                rf_path,
                name=rainfall_name,
                return_period=return_period,
                time_unit=TimeUnit(time_unit),
                intensity_unit=LengthUnit(intensity_unit),
            )
            if series:
                pm.import_rainfall(rf_path, rainfall_name, return_period)
                console.print(f"[green]✓ 已导入降雨: {rainfall_name} ({return_period}年一遇)[/green]")
                imported_count += 1
            if parser.warnings:
                for w in parser.warnings:
                    level_color = "red" if w.level == WarningLevel.CRITICAL else "yellow"
                    console.print(f"[{level_color}]  [{w.level.value}] {w.message}[/{level_color}]")

        if soil:
            soil_path = Path(soil)
            soil_data = parser.parse_soil_test_csv(soil_path, test_id=soil_id)
            if soil_data:
                pm.import_soil(soil_path, soil_id)
                console.print(f"[green]✓ 已导入土壤试验: {soil_id}[/green]")
                imported_count += 1
            if parser.warnings:
                for w in parser.warnings:
                    level_color = "red" if w.level == WarningLevel.CRITICAL else "yellow"
                    console.print(f"[{level_color}]  [{w.level.value}] {w.message}[/{level_color}]")

        if catchment:
            catchment_path = Path(catchment)
            pm.import_catchment(catchment_path)
            console.print("[green]✓ 已导入汇水面积数据[/green]")
            imported_count += 1

        if pond:
            pond_path = Path(pond)
            pm.import_pond(pond_path)
            console.print("[green]✓ 已导入池体几何数据[/green]")
            imported_count += 1

    if imported_count == 0:
        console.print("[yellow]未导入任何数据[/yellow]")
        console.print("使用 'rain-garden import --help' 查看导入选项")
    else:
        console.print(f"\n[green]共导入 {imported_count} 组数据[/green]")


@main.command()
@click.option("--model", "-m", default="horton",
              type=click.Choice(["horton", "green-ampt", "philip", "scs"]),
              help="入渗模型: horton (霍顿), green-ampt (格林-安普特), philip (菲利普), scs")
@click.option("--time-step", "-t", type=float, default=5.0, help="模拟时间步长")
@click.option("--time-unit", default="min", type=click.Choice(["s", "min", "h", "day"]), help="时间单位")
@click.option("--max-drain", type=float, default=72.0, help="最大排空时间（小时）")
@click.option("--no-underdrain", is_flag=True, help="禁用地下排水")
def simulate(
    model: str,
    time_step: float,
    time_unit: str,
    max_drain: float,
    no_underdrain: bool,
):
    """
    运行水文模拟

    使用可配置的入渗模型计算蓄水、下渗、溢流和排空时间。
    """
    pm = require_project()

    config = pm.get_sim_config()
    config.infiltration_model = InfiltrationModel(model)
    config.time_step = time_step
    config.time_unit = TimeUnit(time_unit)
    config.max_drain_hours = max_drain
    config.enable_underdrain = not no_underdrain

    pm.update_sim_config(
        infiltration_model=InfiltrationModel(model),
        time_step=time_step,
        time_unit=TimeUnit(time_unit),
        max_drain_hours=max_drain,
        enable_underdrain=not no_underdrain,
    )

    data = load_all_data(pm)

    if not data["rainfall_series"]:
        console.print("[red]错误: 没有降雨数据[/red]")
        console.print("请先使用 'rain-garden import' 导入降雨数据")
        sys.exit(1)

    if not data["soil"]:
        console.print("[red]错误: 没有土壤数据[/red]")
        console.print("请先使用 'rain-garden import --soil' 导入土壤数据")
        sys.exit(1)

    if not data["catchments"]:
        console.print("[red]错误: 没有汇水面积数据[/red]")
        console.print("请先使用 'rain-garden import --catchment' 导入汇水数据")
        sys.exit(1)

    if not data["pond"]:
        console.print("[red]错误: 没有池体几何数据[/red]")
        console.print("请先使用 'rain-garden import --pond' 导入池体数据")
        sys.exit(1)

    engine = HydrologicEngine()

    console.print(Panel.fit(
        f"入渗模型: {model}\n"
        f"时间步长: {time_step} {time_unit}\n"
        f"最大排空时间: {max_drain} 小时\n"
        f"地下排水: {'启用' if not no_underdrain else '禁用'}",
        title="模拟配置",
    ))

    results = []
    for series in data["rainfall_series"]:
        console.print(f"\n[blue]正在模拟: {series.name} ({series.return_period}年一遇)[/blue]")

        result = engine.simulate(
            rainfall=series,
            soil=data["soil"],
            catchments=data["catchments"],
            pond=data["pond"],
            config=config,
        )

        if result:
            pm.save_result(result)
            results.append(result)

            table = Table(title=f"模拟结果 - {series.name}")
            table.add_column("指标", style="cyan")
            table.add_column("数值", style="green")
            table.add_row("总径流量", f"{result.total_runoff_volume:.2f} m³")
            table.add_row("总入渗量", f"{result.total_infiltration_volume:.2f} m³")
            table.add_row("总溢流量", f"{result.total_overflow_volume:.2f} m³")
            table.add_row("峰值蓄水量", f"{result.peak_storage:.2f} m³")
            table.add_row("峰值水位", f"{result.peak_pond_level * 100:.1f} cm")
            table.add_row("排空时间", f"{result.drain_time_hours:.1f} 小时")
            table.add_row("是否溢流", "[red]是[/red]" if result.has_overflow else "[green]否[/green]")
            console.print(table)
        else:
            console.print(f"[red]模拟失败: {series.name}[/red]")

    if results:
        console.print(f"\n[green]✓ 完成 {len(results)} 场降雨模拟[/green]")
        console.print(f"结果已保存到: {pm.get_results_dir()}")


@main.command()
@click.option("--rainfall-a", "-a", required=True, help="第一场降雨名称")
@click.option("--rainfall-b", "-b", required=True, help="第二场降雨名称")
def compare(rainfall_a: str, rainfall_b: str):
    """
    对比两场降雨的模拟结果

    用于对比不同重现期雨型下的性能差异。
    """
    pm = require_project()
    engine = HydrologicEngine()

    results_dir = pm.get_results_dir()
    result_files = list(results_dir.glob("*.json"))

    if not result_files:
        console.print("[red]错误: 没有找到模拟结果[/red]")
        console.print("请先运行 'rain-garden simulate'")
        sys.exit(1)

    result_a = None
    result_b = None

    data = load_all_data(pm)
    config = pm.get_sim_config()

    if data["rainfall_series"] and data["soil"] and data["catchments"] and data["pond"]:
        for series in data["rainfall_series"]:
            if rainfall_a.lower() in series.name.lower():
                console.print(f"[blue]正在运行模拟: {series.name}[/blue]")
                result_a = engine.simulate(series, data["soil"], data["catchments"], data["pond"], config)
            if rainfall_b.lower() in series.name.lower():
                console.print(f"[blue]正在运行模拟: {series.name}[/blue]")
                result_b = engine.simulate(series, data["soil"], data["catchments"], data["pond"], config)

    if not result_a or not result_b:
        console.print("[red]错误: 无法找到或运行指定的降雨模拟[/red]")
        sys.exit(1)

    comparison = engine.compare_simulations(result_a, result_b)

    table = Table(title="对比结果")
    table.add_column("指标", style="cyan")
    table.add_column(f"{result_a.rainfall_name}", style="blue")
    table.add_column(f"{result_b.rainfall_name}", style="magenta")
    table.add_column("差异", style="yellow")

    table.add_row(
        "重现期",
        f"{result_a.return_period} 年",
        f"{result_b.return_period} 年",
        f"{result_b.return_period - result_a.return_period:+.0f} 年"
    )
    table.add_row(
        "总径流量",
        f"{result_a.total_runoff_volume:.2f} m³",
        f"{result_b.total_runoff_volume:.2f} m³",
        f"{comparison['b_total_runoff'] - comparison['a_total_runoff']:+.2f} m³"
    )
    table.add_row(
        "总入渗量",
        f"{result_a.total_infiltration_volume:.2f} m³",
        f"{result_b.total_infiltration_volume:.2f} m³",
        f"{comparison['b_total_infiltration'] - comparison['a_total_infiltration']:+.2f} m³"
    )
    table.add_row(
        "总溢流量",
        f"{result_a.total_overflow_volume:.2f} m³",
        f"{result_b.total_overflow_volume:.2f} m³",
        f"{comparison['volume_difference']:+.2f} m³"
    )
    table.add_row(
        "峰值水位",
        f"{result_a.peak_pond_level * 100:.1f} cm",
        f"{result_b.peak_pond_level * 100:.1f} cm",
        f"{comparison['peak_difference'] * 100:+.1f} cm"
    )
    table.add_row(
        "排空时间",
        f"{result_a.drain_time_hours:.1f} h",
        f"{result_b.drain_time_hours:.1f} h",
        f"{comparison['drain_time_b'] - comparison['drain_time_a']:+.1f} h"
    )
    table.add_row(
        "溢流",
        "[red]是[/red]" if result_a.has_overflow else "[green]否[/green]",
        "[red]是[/red]" if result_b.has_overflow else "[green]否[/green]",
        "-"
    )

    console.print(table)


@main.command()
@click.option("--max-drain", type=float, default=72.0, help="最大排空时间限值（小时）")
def check(max_drain: float):
    """
    规则校验

    检查：容量不足、排空超时、土壤参数不可信、径流系数冲突
    """
    pm = require_project()
    validator = RuleValidator()

    data = load_all_data(pm)
    config = pm.get_sim_config()
    config.max_drain_hours = max_drain

    results = []
    engine = HydrologicEngine()

    if data["rainfall_series"] and data["soil"] and data["catchments"] and data["pond"]:
        for series in data["rainfall_series"]:
            result = engine.simulate(series, data["soil"], data["catchments"], data["pond"], config)
            if result:
                results.append(result)

    if not results:
        console.print("[yellow]警告: 没有可校验的模拟结果[/yellow]")
        if data["rainfall_series"]:
            console.print("正在运行模拟...")
            if not data["soil"] or not data["catchments"] or not data["pond"]:
                console.print("[red]错误: 缺少必要的输入数据[/red]")
                sys.exit(1)

    check_report = validator.validate_all(
        results=results,
        pond=data["pond"],
        soil=data["soil"],
        catchments=data["catchments"],
        config=config,
    )

    pm.save_check_report(check_report)

    summary = validator.get_summary()

    console.print(Panel.fit(
        f"严重问题: [red]{summary['by_level']['critical']}[/red]\n"
        f"警告: [yellow]{summary['by_level']['warning']}[/yellow]\n"
        f"信息: [blue]{summary['by_level']['info']}[/blue]",
        title=f"校验结果 - {'不通过' if check_report.has_critical else '通过'}",
        border_style="red" if check_report.has_critical else "green",
    ))

    if check_report.warnings:
        console.print("\n[bold]详细问题列表:[/bold]")

        for w in check_report.warnings:
            if w.level == WarningLevel.CRITICAL:
                icon = "🔴"
                color = "red"
            elif w.level == WarningLevel.WARNING:
                icon = "🟡"
                color = "yellow"
            else:
                icon = "ℹ️"
                color = "blue"

            console.print(f"\n[{color}]{icon} [{w.warning_type.value}][/{color}]")
            console.print(f"   {w.message}")
            if w.field:
                console.print(f"   字段: {w.field}")
            if w.value is not None:
                console.print(f"   值: {w.value}")
            if w.suggestion:
                console.print(f"   [green]建议: {w.suggestion}[/green]")

    if check_report.has_critical:
        console.print("\n[red]⚠️ 复核不通过，存在严重问题需要整改[/red]")
        sys.exit(2)
    elif check_report.has_warnings:
        console.print("\n[yellow]⚠️ 复核有条件通过，存在警告项建议优化[/yellow]")
    else:
        console.print("\n[green]✓ 复核通过[/green]")


@main.command()
@click.option("--output", "-o", default="./reports", help="输出目录")
@click.option("--format", "-f", "fmt", default="all",
              type=click.Choice(["all", "markdown", "csv", "json"]),
              help="输出格式")
@click.option("--prefix", "-p", default="", help="输出文件名前缀")
def report(output: str, fmt: str, prefix: str):
    """
    导出复核报告

    支持 Markdown、CSV 和 JSON 格式的复核包导出。
    """
    pm = require_project()
    engine = HydrologicEngine()
    validator = RuleValidator()

    data = load_all_data(pm)
    config = pm.get_sim_config()

    results = []
    if data["rainfall_series"] and data["soil"] and data["catchments"] and data["pond"]:
        for series in data["rainfall_series"]:
            result = engine.simulate(series, data["soil"], data["catchments"], data["pond"], config)
            if result:
                results.append(result)

    check_report = validator.validate_all(
        results=results,
        pond=data["pond"],
        soil=data["soil"],
        catchments=data["catchments"],
        config=config,
    )

    output_dir = Path(output)
    exporter = ReportExporter(output_dir)

    exported = []

    if fmt in ["all", "markdown"]:
        md_path = exporter.export_markdown(
            project=pm.config,
            results=results,
            check_report=check_report,
            pond=data["pond"],
            soil=data["soil"],
            catchments=data["catchments"],
            filename=f"{prefix}report.md" if prefix else "report.md",
        )
        exported.append(("Markdown", md_path))

    if fmt in ["all", "csv"]:
        if results:
            csv_path = exporter.export_results_csv(
                results,
                filename=f"{prefix}summary.csv" if prefix else "summary.csv",
            )
            exported.append(("CSV汇总", csv_path))

            for r in results:
                ts_path = exporter.export_timeseries_csv(r)
                exported.append((f"时序数据-{r.rainfall_name}", ts_path))

        if check_report.warnings:
            warn_path = exporter.export_warnings_csv(
                check_report,
                filename=f"{prefix}warnings.csv" if prefix else "warnings.csv",
            )
            exported.append(("警告列表", warn_path))

    if fmt in ["all", "json"]:
        json_path = exporter.export_json(
            project=pm.config,
            results=results,
            check_report=check_report,
            pond=data["pond"],
            soil=data["soil"],
            catchments=data["catchments"],
            filename=f"{prefix}report.json" if prefix else "report.json",
        )
        exported.append(("JSON", json_path))

    console.print(Panel.fit(
        f"共导出 {len(exported)} 个文件",
        title="报告导出完成",
        style="green",
    ))

    for name, path in exported:
        console.print(f"  [green]✓[/green] {name}: {path}")

    console.print(f"\n[blue]报告输出目录: {output_dir.resolve()}[/blue]")


@main.command()
@click.option("--all", "-a", "show_all", is_flag=True, help="显示所有信息，包括示例数据")
def status(show_all: bool):
    """
    显示当前项目状态
    """
    pm = require_project()
    data = load_all_data(pm)

    table = Table(title="项目状态")
    table.add_column("类别", style="cyan")
    table.add_column("数量", style="green")
    table.add_column("详情", style="blue")

    table.add_row(
        "降雨数据",
        str(len(data["rainfall_series"])),
        ", ".join([f"{s.name}({s.return_period}y)" for s in data["rainfall_series"]]) or "-"
    )
    table.add_row(
        "土壤数据",
        "1" if data["soil"] else "0",
        data["soil"].soil_type if data["soil"] else "-"
    )
    table.add_row(
        "汇水区",
        str(len(data["catchments"])),
        ", ".join([c.name for c in data["catchments"]]) or "-"
    )
    table.add_row(
        "池体",
        "1" if data["pond"] else "0",
        f"{data['pond'].name} ({data['pond'].storage_volume:.1f}m³)" if data["pond"] else "-"
    )

    console.print(table)

    if data["parse_warnings"]:
        console.print(f"\n[yellow]解析警告 ({len(data['parse_warnings'])}):[/yellow]")
        for w in data["parse_warnings"]:
            level_color = "red" if w.level == WarningLevel.CRITICAL else "yellow"
            console.print(f"  [{level_color}]- {w.level.value}: {w.message}[/{level_color}]")


if __name__ == "__main__":
    main()
