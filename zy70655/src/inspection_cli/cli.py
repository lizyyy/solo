import click
import os
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .parser import InspectionParser
from .analyzer import InspectionAnalyzer
from .exporter import ReportExporter
from . import __version__

console = Console()


@click.group()
@click.version_option(version=__version__, prog_name="巡检缺项安全分级整改报告排查CLI")
def cli():
    """
    巡检缺项安全分级整改报告排查CLI

    用于解析工厂巡检表，识别缺项，进行安全分级，生成整改报告。
    """
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--output-dir", "-o", default="output", help="输出目录")
@click.option("--format", "-f", "output_format", default="all",
              type=click.Choice(["text", "json", "csv", "all"]),
              help="输出格式")
@click.option("--show-detail/--no-detail", default=True, help="是否显示详情")
def analyze(input_file, output_dir, output_format, show_detail):
    """
    分析巡检Excel文件，生成整改报告。
    """
    console.print(Panel.fit(
        f"[bold blue]巡检缺项安全分级整改报告排查CLI v{__version__}[/bold blue]",
        border_style="blue"
    ))

    input_filename = os.path.basename(input_file)
    base_name = os.path.splitext(input_filename)[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    os.makedirs(output_dir, exist_ok=True)

    console.print(f"\n[cyan]正在解析文件:[/cyan] {input_file}")

    parser = InspectionParser()
    records, errors = parser.parse_excel(input_file)

    if not records and not errors:
        console.print("[yellow]警告: 未找到有效记录[/yellow]")
        return

    if errors:
        console.print(f"\n[red]发现 {len(errors)} 个数据错误:[/red]")
        for error in errors[:5]:
            console.print(f"  ❌ {error}")
        if len(errors) > 5:
            console.print(f"  ... 还有 {len(errors) - 5} 个错误")

    console.print(f"\n[green]成功解析 {len(records)} 条记录[/green]")

    analyzer = InspectionAnalyzer()
    report = analyzer.analyze(records)
    report.errors = errors

    exporter = ReportExporter()

    if output_format in ["text", "all"]:
        text_path = os.path.join(output_dir, f"{base_name}_report_{timestamp}.txt")
        exporter.export_text(report, text_path)
        console.print(f"[green]文本报告已导出:[/green] {text_path}")

    if output_format in ["json", "all"]:
        json_path = os.path.join(output_dir, f"{base_name}_report_{timestamp}.json")
        exporter.export_json(report, json_path)
        console.print(f"[green]JSON数据已导出:[/green] {json_path}")

    if output_format in ["csv", "all"]:
        csv_path = os.path.join(output_dir, f"{base_name}_defects_{timestamp}.csv")
        exporter.export_csv(report, csv_path)
        console.print(f"[green]CSV缺项表已导出:[/green] {csv_path}")

    if show_detail:
        _show_summary_table(report)
        _show_defect_table(records, analyzer)

    console.print("\n[bold green]✓ 分析完成[/bold green]")


@cli.command("list-teams")
@click.argument("input_file", type=click.Path(exists=True))
def list_teams(input_file):
    """列出所有班组"""
    parser = InspectionParser()
    records, _ = parser.parse_excel(input_file)
    teams = sorted(set(r.team for r in records))

    table = Table(title="班组列表")
    table.add_column("序号", style="cyan")
    table.add_column("班组名称", style="magenta")

    for idx, team in enumerate(teams, 1):
        table.add_row(str(idx), team)

    console.print(table)


@cli.command("validate")
@click.argument("input_file", type=click.Path(exists=True))
def validate(input_file):
    """验证数据文件格式"""
    console.print(f"\n[cyan]正在验证:[/cyan] {input_file}")

    parser = InspectionParser()
    records, errors = parser.parse_excel(input_file)

    if errors:
        console.print(f"\n[red]❌ 验证失败，发现 {len(errors)} 个错误:[/red]")
        for error in errors:
            console.print(f"   {error}")
    else:
        console.print(f"\n[green]✓ 验证通过，共 {len(records)} 条有效记录[/green]")


def _show_summary_table(report):
    stats = ReportExporter()._get_statistics(report.records)

    table = Table(title="总体统计")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="magenta")
    table.add_column("备注", style="dim")

    table.add_row("总检查项", str(stats["total"]), "")
    table.add_row("已完成", str(stats["completed"]), "")
    table.add_row("未完成", str(stats["defects"]), "")
    table.add_row("完成率", f"{stats['completion_rate']}%", "")
    table.add_row("安全项缺项", f"[red]{stats['safety_defects']}[/red]", "需重点关注")
    table.add_row("保养项缺项", f"[yellow]{stats['maintenance_defects']}[/yellow]", "")
    table.add_row("高风险", f"[bold red]{stats['high_risk']}[/bold red]", "1天内整改")
    table.add_row("中风险", f"[bold yellow]{stats['medium_risk']}[/bold yellow]", "3天内整改")
    table.add_row("低风险", f"[bold green]{stats['low_risk']}[/bold green]", "7天内整改")

    console.print("\n")
    console.print(table)

    team_table = Table(title="班组汇总")
    team_table.add_column("班组", style="cyan")
    team_table.add_column("总项数", style="magenta")
    team_table.add_column("完成率", style="green")
    team_table.add_column("安全缺项", style="red")
    team_table.add_column("保养缺项", style="yellow")
    team_table.add_column("高风险", style="bold red")

    for summary in report.team_summaries:
        team_table.add_row(
            summary.team,
            str(summary.total_items),
            f"{summary.completion_rate}%",
            str(summary.safety_defects),
            str(summary.maintenance_defects),
            str(summary.high_risk),
        )

    console.print("\n")
    console.print(team_table)


def _show_defect_table(records, analyzer):
    defects = analyzer.get_defect_records(records)
    if not defects:
        return

    high_risk = [d for d in defects if d.risk_level.value == "高风险"]
    if high_risk:
        table = Table(title="⚠️ 高风险缺项 (需1天内整改)", style="bold red")
        table.add_column("日期", style="cyan")
        table.add_column("设备", style="magenta")
        table.add_column("检查项", style="yellow")
        table.add_column("班组", style="green")
        table.add_column("整改期限", style="red")

        for d in high_risk:
            table.add_row(d.date, d.device_id, d.check_item, d.team, d.rectification_deadline)
        console.print("\n")
        console.print(table)


if __name__ == "__main__":
    cli()
