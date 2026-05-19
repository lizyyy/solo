import os
from datetime import datetime
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from ..parser import ParserFactory
from ..rules import RuleEngine
from ..reporter import ReportGenerator

console = Console()


@click.group()
def cli():
    """分支保护例外恢复审计排查工具"""
    pass


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-o",
    "--output",
    type=click.Path(),
    default="./audit_output",
    help="输出目录路径",
)
@click.option(
    "-f",
    "--format",
    "output_format",
    type=click.Choice(["json", "csv", "txt", "all"]),
    default="all",
    help="输出格式",
)
@click.option(
    "--audit-time",
    type=str,
    default=None,
    help="审计时间 (格式: YYYY-MM-DD HH:MM:SS)",
)
def audit(files, output, output_format, audit_time):
    """执行分支保护例外恢复审计排查"""
    if not files:
        console.print("[red]错误: 至少需要指定一个输入文件[/red]")
        return

    console.print(Panel("分支保护例外恢复审计排查工具", style="blue"))
    console.print(f"[green]输入文件数:[/green] {len(files)}")
    console.print(f"[green]输出目录:[/green] {output}")

    os.makedirs(output, exist_ok=True)

    parse_results = []
    for file_path in files:
        console.print(f"\n[cyan]解析文件:[/cyan] {file_path}")
        result = ParserFactory.parse_file(file_path)
        parse_results.append(result)

        if result.parse_errors:
            console.print(f"[yellow]警告: 发现 {len(result.parse_errors)} 个解析错误[/yellow]")

    merged_result = ParserFactory.merge_results(parse_results)

    console.print("\n[cyan]解析结果汇总:[/cyan]")
    console.print(f"  - 仓库: {len(merged_result.repositories)} 个")
    console.print(f"  - 例外申请: {len(merged_result.exceptions)} 个")
    console.print(f"  - 放开窗口: {len(merged_result.windows)} 个")
    console.print(f"  - 恢复动作: {len(merged_result.recoveries)} 个")

    audit_dt = None
    if audit_time:
        try:
            audit_dt = datetime.strptime(audit_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            console.print("[red]错误: 审计时间格式无效，请使用 YYYY-MM-DD HH:MM:SS[/red]")
            return

    console.print("\n[cyan]执行规则引擎...[/cyan]")
    rule_engine = RuleEngine()
    conclusion = rule_engine.run_all_rules(merged_result, audit_dt)

    console.print("\n[cyan]审计结果汇总:[/cyan]")
    console.print(f"  - 审计ID: {conclusion.audit_id}")
    console.print(f"  - 总记录数: {conclusion.total_records}")
    console.print(f"  - [green]通过: {conclusion.pass_count}[/green]")
    console.print(f"  - [yellow]警告: {conclusion.warn_count}[/yellow]")
    console.print(f"  - [red]失败: {conclusion.fail_count}[/red]")
    console.print(f"  - [blue]跳过: {conclusion.skip_count}[/blue]")

    console.print("\n[cyan]生成报告...[/cyan]")
    reporter = ReportGenerator(conclusion, merged_result)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if output_format in ["json", "all"]:
        json_path = os.path.join(output, f"audit_report_{timestamp}.json")
        reporter.generate_json_report(json_path)
        console.print(f"  [green]✓[/green] JSON报告: {json_path}")

    if output_format in ["csv", "all"]:
        csv_path = os.path.join(output, f"audit_report_{timestamp}.csv")
        reporter.generate_csv_report(csv_path)
        console.print(f"  [green]✓[/green] CSV报告: {csv_path}")

    if output_format in ["txt", "all"]:
        txt_path = os.path.join(output, f"audit_report_{timestamp}.txt")
        reporter.generate_text_report(txt_path)
        console.print(f"  [green]✓[/green] TEXT报告: {txt_path}")

    console.print("\n[green]✓ 审计完成！[/green]")


@cli.command()
@click.argument("file", type=click.Path(exists=True, dir_okay=False))
def inspect(file):
    """检查文件内容并显示解析预览"""
    console.print(Panel(f"文件检查: {file}", style="blue"))

    result = ParserFactory.parse_file(file)

    if result.parse_errors:
        console.print(f"\n[red]解析错误 ({len(result.parse_errors)} 个):[/red]")
        for error in result.parse_errors[:5]:
            console.print(f"  - {error.get('message', '未知错误')}")
            if error.get("location"):
                console.print(f"    位置: {error['location']}")
        if len(result.parse_errors) > 5:
            console.print(f"  ... 还有 {len(result.parse_errors) - 5} 个错误")

    console.print(f"\n[cyan]仓库 ({len(result.repositories)} 个):[/cyan]")
    for repo in result.repositories[:5]:
        console.print(f"  - {repo.name} (ID: {repo.id})")
    if len(result.repositories) > 5:
        console.print(f"  ... 还有 {len(result.repositories) - 5} 个")

    console.print(f"\n[cyan]例外申请 ({len(result.exceptions)} 个):[/cyan]")
    for exc in result.exceptions[:5]:
        console.print(
            f"  - 申请人: {exc.applicant}, 状态: {exc.status}, 时间: {exc.requested_at}"
        )
    if len(result.exceptions) > 5:
        console.print(f"  ... 还有 {len(result.exceptions) - 5} 个")

    console.print(f"\n[cyan]放开窗口 ({len(result.windows)} 个):[/cyan]")
    for window in result.windows[:5]:
        status = "活动" if window.is_active else "已关闭"
        console.print(
            f"  - {window.start_time} ~ {window.end_time} [{status}]"
        )
    if len(result.windows) > 5:
        console.print(f"  ... 还有 {len(result.windows) - 5} 个")

    console.print(f"\n[cyan]恢复动作 ({len(result.recoveries)} 个):[/cyan]")
    for recovery in result.recoveries[:5]:
        status = "成功" if recovery.is_successful else "失败"
        console.print(
            f"  - {recovery.recovered_by} at {recovery.recovered_at} [{status}]"
        )
    if len(result.recoveries) > 5:
        console.print(f"  ... 还有 {len(result.recoveries) - 5} 个")


@cli.command()
def rules():
    """显示所有审计规则"""
    console.print(Panel("审计规则列表", style="blue"))

    rule_engine = RuleEngine()
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("规则ID", style="dim")
    table.add_column("规则名称")
    table.add_column("描述")

    for rule in rule_engine.rules:
        table.add_row(rule.rule_id, rule.rule_name, rule.description)

    console.print(table)


@cli.command()
def version():
    """显示版本信息"""
    from .. import __version__

    console.print(f"分支保护例外恢复审计排查工具 v{__version__}")


if __name__ == "__main__":
    cli()
