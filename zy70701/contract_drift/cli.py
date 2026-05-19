import hashlib
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table

from .parser import SampleParser, ContractParser
from .detector import DriftDetector
from .store import DataStore
from .reporter import ReportGenerator
from .models import Consumer, ConfirmationStatus


console = Console()


@click.group()
@click.option("--storage", help="Storage directory path")
@click.pass_context
def main(ctx: click.Context, storage: Optional[str] = None):
    """契约样例消费方确认的漂移闭环排查工具"""
    ctx.ensure_object(dict)
    ctx.obj["store"] = DataStore(storage)


@main.group()
def contract():
    """契约管理命令"""
    pass


@contract.command(name="import")
@click.argument("openapi_file", type=click.Path(exists=True))
@click.pass_context
def import_contract(ctx: click.Context, openapi_file: str):
    """从 OpenAPI/Swagger 文件导入契约"""
    parser = ContractParser()
    contracts = parser.parse_openapi_file(openapi_file)
    store: DataStore = ctx.obj["store"]
    result = store.import_contracts(contracts)

    console.print(f"[green]成功导入 {result.imported_count} 个契约[/green]")
    if result.skipped_count > 0:
        console.print(f"[yellow]跳过 {result.skipped_count} 个已存在的契约[/yellow]")
    if result.errors:
        for err in result.errors:
            console.print(f"[red]错误: {err}[/red]")


@contract.command(name="list")
@click.pass_context
def list_contracts(ctx: click.Context):
    """列出所有已导入的契约"""
    store: DataStore = ctx.obj["store"]
    contracts = store.list_contracts()

    if not contracts:
        console.print("[yellow]暂无契约数据[/yellow]")
        return

    table = Table(title="契约列表")
    table.add_column("ID", style="cyan")
    table.add_column("方法")
    table.add_column("路径")
    table.add_column("名称")
    table.add_column("版本")
    table.add_column("字段数")

    for contract in contracts:
        table.add_row(
            contract.id[:12],
            contract.method,
            contract.api_path,
            contract.name,
            contract.version,
            str(len(contract.fields)),
        )

    console.print(table)


@main.group()
def sample():
    """样例管理命令"""
    pass


@sample.command(name="import")
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--contract-id", required=True, help="关联的契约ID")
@click.pass_context
def import_sample(ctx: click.Context, files: List[str], contract_id: str):
    """导入 JSON/YAML 响应样例"""
    parser = SampleParser()
    store: DataStore = ctx.obj["store"]

    samples = []
    for f in files:
        sample = parser.parse_file(f, contract_id)
        samples.append(sample)

    result = store.import_samples(samples)

    console.print(f"[green]成功导入 {result.imported_count} 个样例[/green]")
    if result.skipped_count > 0:
        console.print(f"[yellow]跳过 {result.skipped_count} 个已存在的样例[/yellow]")
    if result.errors:
        for err in result.errors:
            console.print(f"[red]错误: {err}[/red]")


@sample.command(name="list")
@click.option("--contract-id", help="按契约ID筛选")
@click.pass_context
def list_samples(ctx: click.Context, contract_id: Optional[str]):
    """列出所有已导入的样例"""
    store: DataStore = ctx.obj["store"]

    if contract_id:
        samples = store.get_samples_for_contract(contract_id)
    else:
        samples = store.list_samples()

    if not samples:
        console.print("[yellow]暂无样例数据[/yellow]")
        return

    table = Table(title="样例列表")
    table.add_column("ID", style="cyan")
    table.add_column("名称")
    table.add_column("契约ID")
    table.add_column("字段数")
    table.add_column("导入时间")

    for sample in samples:
        table.add_row(
            sample.id[:12],
            sample.name,
            sample.contract_id[:12],
            str(len(sample.fields)),
            sample.imported_at.strftime("%Y-%m-%d %H:%M"),
        )

    console.print(table)


@main.group()
def drift():
    """漂移检测命令"""
    pass


@drift.command(name="detect")
@click.option("--contract-id", required=True, help="要检测的契约ID")
@click.option("--export", type=click.Choice(["json", "html", "csv", "md"]), multiple=True)
@click.option("--output", default="./reports", help="报告输出目录")
@click.pass_context
def detect_drift(
    ctx: click.Context,
    contract_id: str,
    export: List[str],
    output: str,
):
    """检测契约与样例之间的字段漂移"""
    store: DataStore = ctx.obj["store"]
    detector = DriftDetector()
    reporter = ReportGenerator()

    contract = store.get_contract(contract_id)
    if not contract:
        console.print(f"[red]错误: 契约 {contract_id} 不存在[/red]")
        return

    samples = store.get_samples_for_contract(contract_id)
    if not samples:
        console.print("[yellow]该契约下暂无样例数据[/yellow]")
        return

    drifts = detector.detect_drifts(contract, samples)
    consumers = store.list_consumers()
    confirmations = [c for con in consumers for c in store.get_confirmations_for_consumer(con.id)]

    report = reporter.generate_report(contract, samples, drifts, consumers, confirmations)

    table = Table(title=f"漂移检测结果 - {contract.name}")
    table.add_column("字段路径", style="cyan")
    table.add_column("漂移类型")
    table.add_column("样例")
    table.add_column("描述")

    for drift in sorted(report.drifts, key=lambda d: (d.sample_id, d.field_path)):
        table.add_row(
            drift.field_path,
            drift.diff_type.value,
            drift.sample_id[:8],
            drift.message,
        )

    console.print(table)
    console.print(f"\n总计发现 [bold red]{report.total_drifts}[/bold red] 处漂移")

    if export:
        Path(output).mkdir(parents=True, exist_ok=True)
        for fmt in export:
            if fmt == "json":
                path = reporter.export_json(report, output)
            elif fmt == "html":
                path = reporter.export_html(report, output)
            elif fmt == "csv":
                path = reporter.export_csv(report, output)
            elif fmt == "md":
                path = reporter.export_markdown(report, output)
            console.print(f"[green]已导出 {fmt.upper()} 报告: {path}[/green]")


@main.group()
def consumer():
    """消费方管理命令"""
    pass


@consumer.command(name="register")
@click.argument("name")
@click.option("--version", default="1.0.0", help="消费方版本")
@click.option("--desc", help="消费方描述")
@click.option("--contact", help="联系方式")
@click.pass_context
def register_consumer(
    ctx: click.Context,
    name: str,
    version: str,
    desc: Optional[str],
    contact: Optional[str],
):
    """注册消费方"""
    consumer_id = hashlib.md5(f"{name}:{version}".encode()).hexdigest()[:12]
    consumer = Consumer(
        id=consumer_id,
        name=name,
        version=version,
        description=desc,
        contact_info=contact,
    )
    store: DataStore = ctx.obj["store"]
    store.register_consumer(consumer)
    console.print(f"[green]已注册消费方: {consumer_id}[/green]")


@consumer.command(name="list")
@click.pass_context
def list_consumers(ctx: click.Context):
    """列出所有消费方"""
    store: DataStore = ctx.obj["store"]
    consumers = store.list_consumers()

    if not consumers:
        console.print("[yellow]暂无消费方数据[/yellow]")
        return

    table = Table(title="消费方列表")
    table.add_column("ID", style="cyan")
    table.add_column("名称")
    table.add_column("版本")
    table.add_column("描述")
    table.add_column("联系方式")

    for consumer in consumers:
        table.add_row(
            consumer.id[:12],
            consumer.name,
            consumer.version,
            consumer.description or "-",
            consumer.contact_info or "-",
        )

    console.print(table)


@main.group()
def confirm():
    """漂移确认命令"""
    pass


@confirm.command(name="set")
@click.argument("consumer_id")
@click.argument("drift_id")
@click.argument("status", type=click.Choice(["pending", "confirmed", "rejected", "ignored"]))
@click.option("--comment", help="确认备注")
@click.option("--by", help="确认人")
@click.pass_context
def set_confirmation(
    ctx: click.Context,
    consumer_id: str,
    drift_id: str,
    status: str,
    comment: Optional[str],
    by: Optional[str],
):
    """设置漂移确认状态"""
    store: DataStore = ctx.obj["store"]

    consumer = store.get_consumer(consumer_id)
    if not consumer:
        console.print(f"[red]错误: 消费方 {consumer_id} 不存在[/red]")
        return

    store.add_confirmation(
        consumer_id=consumer_id,
        drift_id=drift_id,
        contract_id="",
        sample_id="",
        field_path="",
        status=ConfirmationStatus(status),
        comment=comment,
        confirmed_by=by,
    )
    console.print(f"[green]已设置确认状态: {status}[/green]")


@confirm.command(name="list")
@click.option("--consumer-id", help="按消费方筛选")
@click.pass_context
def list_confirmations(ctx: click.Context, consumer_id: Optional[str]):
    """列出确认记录"""
    store: DataStore = ctx.obj["store"]

    if consumer_id:
        confirmations = store.get_confirmations_for_consumer(consumer_id)
    else:
        confirmations = [c for con in store.list_consumers() for c in store.get_confirmations_for_consumer(con.id)]

    if not confirmations:
        console.print("[yellow]暂无确认记录[/yellow]")
        return

    table = Table(title="确认记录")
    table.add_column("字段路径", style="cyan")
    table.add_column("状态")
    table.add_column("消费方")
    table.add_column("确认人")
    table.add_column("备注")
    table.add_column("时间")

    for conf in sorted(confirmations, key=lambda c: c.created_at, reverse=True):
        status_color = {
            "pending": "yellow",
            "confirmed": "green",
            "rejected": "red",
            "ignored": "dim",
        }[conf.status.value]
        table.add_row(
            conf.field_path,
            f"[{status_color}]{conf.status.value}[/{status_color}]",
            conf.consumer_id[:8],
            conf.confirmed_by or "-",
            conf.comment or "-",
            conf.confirmed_at.strftime("%Y-%m-%d %H:%M") if conf.confirmed_at else "-",
        )

    console.print(table)


@main.command()
@click.pass_context
def dashboard(ctx: click.Context):
    """显示整体数据概览"""
    store: DataStore = ctx.obj["store"]
    contracts = store.list_contracts()
    samples = store.list_samples()
    consumers = store.list_consumers()

    drift_counts = {}
    detector = DriftDetector()
    for contract in contracts:
        contract_samples = store.get_samples_for_contract(contract.id)
        drifts = detector.detect_drifts(contract, contract_samples)
        drift_counts[contract.id] = len(drifts)

    total_drifts = sum(drift_counts.values())

    console.print("\n[bold]📊 契约漂移概览[/bold]\n")

    grid = Table.grid(expand=True)
    grid.add_column(style="cyan")
    grid.add_column()
    grid.add_row("契约数量", f"[bold]{len(contracts)}[/bold]")
    grid.add_row("样例数量", f"[bold]{len(samples)}[/bold]")
    grid.add_row("消费方数量", f"[bold]{len(consumers)}[/bold]")
    grid.add_row("漂移总数", f"[bold red]{total_drifts}[/bold red]")
    console.print(grid)

    if total_drifts > 0:
        console.print("\n[yellow]⚠️  存在漂移问题，请执行 drift detect 查看详情[/yellow]")
    else:
        console.print("\n[green]✅ 所有样例均符合契约规范[/green]")


if __name__ == "__main__":
    main()
