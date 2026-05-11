import json
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console

from .analyzer import ImpactAnalyzer
from .comparator import ContractComparator
from .models import ConfirmationStatus
from .reporter import Reporter
from .storage import StorageManager


console = Console()
reporter = Reporter()


class State:
    def __init__(self):
        self.storage: Optional[StorageManager] = None


pass_state = click.make_pass_decorator(State, ensure=True)


@click.group()
@click.option(
    "--work-dir",
    "-w",
    default=".api-impact",
    help="工作目录（默认: .api-impact）",
)
@pass_state
def cli(state: State, work_dir: str):
    """接口变更影响面分析 CLI 工具"""
    state.storage = StorageManager(work_dir)


@cli.command()
@click.argument("old_contract", type=click.Path(exists=True))
@click.argument("new_contract", type=click.Path(exists=True))
@click.argument("callers", type=click.Path(exists=True))
@click.option("--alerts", "-a", type=click.Path(exists=True), help="告警数据文件")
@click.option("--notes", "-n", type=click.Path(exists=True), help="手工备注文件")
@click.option("--service", "-s", help="按服务筛选显示")
@click.option("--detail", "-d", is_flag=True, help="显示详细信息")
@pass_state
def analyze(
    state: State,
    old_contract: str,
    new_contract: str,
    callers: str,
    alerts: Optional[str],
    notes: Optional[str],
    service: Optional[str],
    detail: bool,
):
    """分析接口变更影响面"""
    storage = state.storage
    comparator = ContractComparator()
    analyzer = ImpactAnalyzer()

    try:
        with console.status("[bold green]正在解析契约文件..."):
            old = storage.load_contract(old_contract)
            new = storage.load_contract(new_contract)
            caller_list = storage.load_callers(callers)

        with console.status("[bold green]正在分析契约差异..."):
            diff = comparator.compare(old, new)

        alert_list = []
        if alerts:
            with open(alerts, "r", encoding="utf-8") as f:
                data = json.load(f)
            from .models import AlertInfo
            alert_list = [AlertInfo(**a) for a in data] if isinstance(data, list) else [AlertInfo(**data)]

        note_list = []
        if notes:
            with open(notes, "r", encoding="utf-8") as f:
                data = json.load(f)
            from .models import ManualNote
            note_list = [ManualNote(**n) for n in data] if isinstance(data, list) else [ManualNote(**data)]

        with console.status("[bold green]正在计算影响面..."):
            existing_confirmations = storage.get_all_confirmations()
            analysis = analyzer.analyze(
                diff,
                caller_list,
                alerts=alert_list,
                notes=note_list,
                existing_confirmations=existing_confirmations,
            )

        with console.status("[bold green]正在保存分析结果..."):
            saved_path = storage.save_analysis(analysis)

        missing_owners = storage.get_callers_without_owner(caller_list)

        reporter.print_summary(analysis)
        reporter.print_by_service(analysis, service)

        if missing_owners:
            reporter.print_warnings(missing_owners)

        if detail:
            reporter.print_details(analysis, service)

        console.print()
        console.print(f"[green]✓ 分析完成，结果已保存到:[/green] {saved_path}")
        console.print(f"[cyan]分析ID:[/cyan] {analysis.diff_id}")

    except ValueError as e:
        console.print(f"[bold red]错误:[/bold red] {e}")
        sys.exit(1)
    except FileNotFoundError as e:
        console.print(f"[bold red]文件不存在:[/bold red] {e}")
        sys.exit(1)


@cli.command("list")
@pass_state
def list_analyses(state: State):
    """列出所有历史分析记录"""
    storage = state.storage
    analyses = storage.list_analyses()

    if not analyses:
        console.print("[yellow]没有找到历史分析记录[/yellow]")
        return

    from rich.table import Table
    from rich import box

    table = Table(title="历史分析记录", box=box.ROUNDED)
    table.add_column("分析ID", style="cyan")
    table.add_column("API", style="magenta")
    table.add_column("版本变化", style="blue")
    table.add_column("受影响调用方", style="green")
    table.add_column("生成时间", style="yellow")

    for a in analyses:
        table.add_row(
            a["diff_id"],
            a["api_name"],
            f"{a['old_version']} → {a['new_version']}",
            str(a["affected_callers"]),
            a["generated_at"],
        )

    console.print(table)


@cli.command()
@click.argument("diff_id")
@click.option("--service", "-s", help="按服务筛选")
@click.option("--detail", "-d", is_flag=True, help="显示详细信息")
@pass_state
def show(state: State, diff_id: str, service: Optional[str], detail: bool):
    """显示指定分析的结果"""
    storage = state.storage
    analysis = storage.load_analysis(diff_id)

    if not analysis:
        console.print(f"[bold red]未找到分析ID:[/bold red] {diff_id}")
        sys.exit(1)

    reporter.print_summary(analysis)
    reporter.print_by_service(analysis, service)

    if detail:
        reporter.print_details(analysis, service)


@cli.command("confirm")
@click.argument("diff_id")
@click.argument("service_name")
@click.option(
    "--status",
    "-s",
    type=click.Choice(["confirmed", "unconfirmed", "not_applicable"]),
    default="confirmed",
    help="确认状态（默认: confirmed）",
)
@pass_state
def confirm(state: State, diff_id: str, service_name: str, status: str):
    """标记调用方确认状态"""
    storage = state.storage
    status_enum = ConfirmationStatus(status)

    if storage.update_confirmation(diff_id, service_name, status_enum):
        console.print(
            f"[green]✓ 已将 {service_name} 的确认状态更新为:[/green] "
            f"[bold]{status}[/bold]"
        )
    else:
        console.print(
            f"[bold red]未找到对应的分析或服务:[/bold red] "
            f"diff_id={diff_id}, service={service_name}"
        )
        sys.exit(1)


@cli.command("rerisk")
@click.argument("diff_id")
@click.option("--service", "-s", help="按服务筛选")
@click.option("--detail", "-d", is_flag=True, help="显示详细信息")
@pass_state
def rerisk(state: State, diff_id: str, service: Optional[str], detail: bool):
    """重新计算风险等级"""
    storage = state.storage
    analyzer = ImpactAnalyzer()

    analysis = storage.load_analysis(diff_id)
    if not analysis:
        console.print(f"[bold red]未找到分析ID:[/bold red] {diff_id}")
        sys.exit(1)

    with console.status("[bold green]正在重新计算风险等级..."):
        updated = analyzer.recalculate_risk(analysis)
        storage.save_analysis(updated)

    reporter.print_summary(updated)
    reporter.print_by_service(updated, service)

    if detail:
        reporter.print_details(updated, service)

    console.print(f"[green]✓ 风险等级已重新计算[/green]")


@cli.command("export")
@click.argument("diff_id")
@click.option(
    "--format",
    "-f",
    type=click.Choice(["md", "markdown", "json"]),
    default="md",
    help="导出格式（默认: md）",
)
@click.option("--output", "-o", help="输出文件路径")
@pass_state
def export(state: State, diff_id: str, format: str, output: Optional[str]):
    """导出变更报告"""
    storage = state.storage

    analysis = storage.load_analysis(diff_id)
    if not analysis:
        console.print(f"[bold red]未找到分析ID:[/bold red] {diff_id}")
        sys.exit(1)

    if not output:
        if format in ["md", "markdown"]:
            output = f"reports/{diff_id}.md"
        else:
            output = f"reports/{diff_id}.json"

    if format in ["md", "markdown"]:
        path = reporter.export_markdown(analysis, output)
    else:
        path = reporter.export_json(analysis, output)

    console.print(f"[green]✓ 报告已导出到:[/green] {path}")


@cli.command("examples")
@click.option(
    "--output-dir",
    "-o",
    default="examples",
    help="样例数据输出目录",
)
@pass_state
def generate_examples(state: State, output_dir: str):
    """生成样例数据（订单、库存、会员接口）"""
    from .examples import generate_all_examples

    path = generate_all_examples(output_dir)
    console.print(f"[green]✓ 样例数据已生成到:[/green] {path}")
    console.print()
    console.print("[cyan]使用样例数据运行分析:[/cyan]")
    console.print(
        "  api-impact analyze "
        "examples/contracts/order-api-v1.json "
        "examples/contracts/order-api-v2.json "
        "examples/callers.json"
    )


if __name__ == "__main__":
    cli()
