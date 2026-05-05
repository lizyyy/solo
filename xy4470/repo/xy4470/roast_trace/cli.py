"""CLI命令界面"""
import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree

from roast_trace import __version__
from roast_trace.checker import CheckEngine
from roast_trace.exporter import Exporter
from roast_trace.importer import (
    IMPORT_DISPATCH,
    ImportResult,
    import_cupping_records,
    import_green_batches,
    import_packaging_labels,
    import_roast_logs,
    import_shipment_records,
)
from roast_trace.models import BatchStatus
from roast_trace.query import QueryEngine
from roast_trace.state import StateManager

console = Console()


def get_engines() -> tuple[CheckEngine, StateManager, QueryEngine, Exporter]:
    check_engine = CheckEngine()
    state_manager = StateManager()
    query_engine = QueryEngine(check_engine, state_manager)
    exporter = Exporter(check_engine, query_engine, state_manager)
    return check_engine, state_manager, query_engine, exporter


def load_all_data(
    check_engine: CheckEngine,
    state_manager: StateManager,
    green_batches_path: Optional[Path] = None,
    roast_logs_path: Optional[Path] = None,
    cupping_records_path: Optional[Path] = None,
    labels_path: Optional[Path] = None,
    shipments_path: Optional[Path] = None,
) -> int:
    total_loaded = 0

    if green_batches_path:
        result = import_green_batches(green_batches_path)
        if result.has_errors:
            for row_num, error, raw_data in result.errors:
                console.print(f"[red]错误 (行 {row_num}): {error}[/red]")
        check_engine.load_green_batches(result.success)
        state_manager.log_import(
            "green_batch",
            str(green_batches_path),
            len(result.success),
            len(result.errors),
        )
        total_loaded += len(result.success)
        console.print(f"[green]导入生豆批次: {len(result.success)} 条[/green]")

    if roast_logs_path:
        result = import_roast_logs(roast_logs_path)
        if result.has_errors:
            for row_num, error, raw_data in result.errors:
                console.print(f"[red]错误 (行 {row_num}): {error}[/red]")
        check_engine.load_roast_logs(result.success)
        state_manager.log_import(
            "roast_log",
            str(roast_logs_path),
            len(result.success),
            len(result.errors),
        )
        total_loaded += len(result.success)
        console.print(f"[green]导入烘焙日志: {len(result.success)} 条[/green]")

    if cupping_records_path:
        result = import_cupping_records(cupping_records_path)
        if result.has_errors:
            for row_num, error, raw_data in result.errors:
                console.print(f"[red]错误 (行 {row_num}): {error}[/red]")
        check_engine.load_cupping_records(result.success)
        state_manager.log_import(
            "cupping",
            str(cupping_records_path),
            len(result.success),
            len(result.errors),
        )
        total_loaded += len(result.success)
        console.print(f"[green]导入杯测记录: {len(result.success)} 条[/green]")

    if labels_path:
        result = import_packaging_labels(labels_path)
        if result.has_errors:
            for row_num, error, raw_data in result.errors:
                console.print(f"[red]错误 (行 {row_num}): {error}[/red]")
        check_engine.load_labels(result.success)
        state_manager.log_import(
            "label",
            str(labels_path),
            len(result.success),
            len(result.errors),
        )
        total_loaded += len(result.success)
        console.print(f"[green]导入包装贴标: {len(result.success)} 条[/green]")

    if shipments_path:
        result = import_shipment_records(shipments_path)
        if result.has_errors:
            for row_num, error, raw_data in result.errors:
                console.print(f"[red]错误 (行 {row_num}): {error}[/red]")
        check_engine.load_shipments(result.success)
        state_manager.log_import(
            "shipment",
            str(shipments_path),
            len(result.success),
            len(result.errors),
        )
        total_loaded += len(result.success)
        console.print(f"[green]导出发货记录: {len(result.success)} 条[/green]")

    return total_loaded


@click.group()
@click.version_option(version=__version__)
def main():
    """咖啡烘焙工坊本地追溯与质检CLI工具"""
    pass


@main.command()
@click.option("--green-batches", "-g", type=click.Path(exists=True, path_type=Path), help="生豆批次文件 (CSV/JSON)")
@click.option("--roast-logs", "-r", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件 (CSV/JSON)")
@click.option("--cupping-records", "-c", type=click.Path(exists=True, path_type=Path), help="杯测记录文件 (CSV/JSON)")
@click.option("--labels", "-l", type=click.Path(exists=True, path_type=Path), help="包装贴标文件 (CSV/JSON)")
@click.option("--shipments", "-s", type=click.Path(exists=True, path_type=Path), help="发货记录文件 (CSV/JSON)")
def import_data(green_batches, roast_logs, cupping_records, labels, shipments):
    """导入各类数据文件"""
    _, state_manager, _, _ = get_engines()
    check_engine = CheckEngine()

    if not any([green_batches, roast_logs, cupping_records, labels, shipments]):
        console.print("[yellow]请至少指定一个文件进行导入[/yellow]")
        console.print("\n使用示例:")
        console.print("  roast-trace import --green-batches green.csv --roast-logs roast.csv")
        return

    total = load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    console.print(f"\n[bold green]总计导入 {total} 条记录[/bold green]")


@main.command()
@click.option("--green-batches", "-g", type=click.Path(exists=True, path_type=Path), help="生豆批次文件")
@click.option("--roast-logs", "-r", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件")
@click.option("--cupping-records", "-c", type=click.Path(exists=True, path_type=Path), help="杯测记录文件")
@click.option("--labels", "-l", type=click.Path(exists=True, path_type=Path), help="包装贴标文件")
@click.option("--shipments", "-s", type=click.Path(exists=True, path_type=Path), help="发货记录文件")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="输出报告路径 (Markdown)")
def check(green_batches, roast_logs, cupping_records, labels, shipments, output):
    """运行质检检查，识别风险批次"""
    check_engine, state_manager, query_engine, exporter = get_engines()

    load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    console.print("\n[bold]运行质检检查...[/bold]")

    all_results = check_engine.run_all_checks()

    critical_count = 0
    warning_count = 0
    critical_batches: set[str] = set()

    for check_type, results in all_results.items():
        for result in results:
            if result.severity == "critical":
                critical_count += 1
                critical_batches.add(result.roast_batch_id)
            else:
                warning_count += 1

    flagged = check_engine.get_all_flagged_batches()
    hold_count = sum(1 for s in flagged.values() if s == BatchStatus.HOLD)
    recall_count = sum(1 for s in flagged.values() if s == BatchStatus.RECALL)

    summary = {
        "critical_count": critical_count,
        "warning_count": warning_count,
        "hold_count": hold_count,
        "recall_count": recall_count,
        "total_flagged": len(flagged),
    }
    state_manager.update_last_check(summary)

    console.print("\n[bold]检查结果摘要:[/bold]")
    table = Table(title="检查统计")
    table.add_column("项目", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_row("严重告警 (Critical)", str(critical_count))
    table.add_row("警告 (Warning)", str(warning_count))
    table.add_row("需暂停出货 (HOLD)", f"[yellow]{hold_count}[/yellow]")
    table.add_row("需召回 (RECALL)", f"[red]{recall_count}[/red]")
    table.add_row("风险批次总计", str(len(flagged)))
    console.print(table)

    if flagged:
        console.print("\n[bold]风险批次列表:[/bold]")
        batch_table = Table(title="风险批次")
        batch_table.add_column("批次号", style="cyan")
        batch_table.add_column("状态", style="magenta")
        batch_table.add_column("告警数量", style="yellow")

        for batch_id, status in flagged.items():
            batch_checks = [
                r for checks in all_results.values()
                for r in checks
                if r.roast_batch_id == batch_id
            ]
            status_str = f"[red]{status.value.upper()}[/red]" if status == BatchStatus.RECALL else f"[yellow]{status.value.upper()}[/yellow]"
            batch_table.add_row(batch_id, status_str, str(len(batch_checks)))

        console.print(batch_table)

    if output:
        exporter.generate_flagged_summary_md(output)
        console.print(f"\n[green]报告已保存到: {output}[/green]")

    if critical_count > 0 or warning_count > 0:
        console.print("\n[bold]详细告警信息:[/bold]")
        for check_type, results in all_results.items():
            if results:
                console.print(f"\n[cyan]--- {check_type.upper()} ---[/cyan]")
                for result in results:
                    if result.severity == "critical":
                        console.print(f"[red]🔴 [{result.roast_batch_id}] {result.message}[/red]")
                    else:
                        console.print(f"[yellow]🟡 [{result.roast_batch_id}] {result.message}[/yellow]")
    else:
        console.print("\n[green]✅ 所有检查通过，未发现异常[/green]")


@main.command("query")
@click.argument("query_type", type=click.Choice(["batch", "green", "shipments", "flagged", "cupping"]))
@click.option("--batch-id", "-b", help="批次号")
@click.option("--green-batch-id", "-g", help="生豆批次号")
@click.option("--store", "-s", help="门店名称")
@click.option("--start-date", type=click.DateTime(formats=["%Y-%m-%d"]), help="开始日期")
@click.option("--end-date", type=click.DateTime(formats=["%Y-%m-%d"]), help="结束日期")
@click.option("--min-score", type=float, help="最低杯测分数")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
@click.option("--green-batches", type=click.Path(exists=True, path_type=Path), help="生豆批次文件")
@click.option("--roast-logs", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件")
@click.option("--cupping-records", type=click.Path(exists=True, path_type=Path), help="杯测记录文件")
@click.option("--labels", type=click.Path(exists=True, path_type=Path), help="包装贴标文件")
@click.option("--shipments", type=click.Path(exists=True, path_type=Path), help="发货记录文件")
def query_data(
    query_type, batch_id, green_batch_id, store, start_date, end_date,
    min_score, output_json, green_batches, roast_logs, cupping_records,
    labels, shipments
):
    """查询数据"""
    check_engine, state_manager, query_engine, _ = get_engines()

    load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    result = None

    if query_type == "batch":
        if not batch_id:
            console.print("[red]错误: 查询批次详情需要指定 --batch-id[/red]")
            return
        result = query_engine.query_roast_batch(batch_id)

    elif query_type == "green":
        if not green_batch_id:
            console.print("[red]错误: 查询生豆批次需要指定 --green-batch-id[/red]")
            return
        result = query_engine.query_green_batch(green_batch_id)

    elif query_type == "shipments":
        s_date = start_date.date() if start_date else None
        e_date = end_date.date() if end_date else None
        result = query_engine.query_shipments(
            store_name=store,
            start_date=s_date,
            end_date=e_date,
            roast_batch_id=batch_id,
        )

    elif query_type == "flagged":
        result = query_engine.query_flagged_batches()

    elif query_type == "cupping":
        result = query_engine.query_cupping_history(
            roast_batch_id=batch_id,
            min_score=min_score,
        )

    if result:
        if output_json:
            console.print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        else:
            if query_type == "batch":
                if "error" in result:
                    console.print(f"[red]{result['error']}[/red]")
                else:
                    console.print(Panel.fit(f"[bold cyan]批次详情: {batch_id}[/bold cyan]"))
                    console.print(f"\n[bold]状态:[/bold] {result['status']['combined'].upper()}")

                    roast_log = result["roast_log"]
                    console.print("\n[bold]烘焙记录:[/bold]")
                    table = Table(show_header=False)
                    table.add_column("项目", style="cyan")
                    table.add_column("值", style="magenta")
                    table.add_row("烘焙日期", str(roast_log["roast_date"]))
                    table.add_row("烘焙师", roast_log["roaster"])
                    table.add_row("烘焙度", roast_log["roast_level"])
                    table.add_row("生豆重量", f"{roast_log['green_weight_kg']} kg")
                    table.add_row("熟豆重量", f"{roast_log['roasted_weight_kg']} kg")
                    table.add_row("烘焙时间", f"{roast_log['drop_time']} 秒")
                    table.add_row("出锅温度", f"{roast_log['drop_temp']} °C")
                    console.print(table)

                    if result["check_results"]:
                        console.print("\n[bold]质检告警:[/bold]")
                        for check in result["check_results"]:
                            emoji = "🔴" if check["severity"] == "critical" else "🟡"
                            console.print(f"  {emoji} [{check['check_type']}] {check['message']}")

            elif query_type == "flagged":
                summary = result["summary"]
                console.print(f"\n[bold]风险批次摘要:[/bold]")
                console.print(f"  总计: {summary['total_flagged']} 个批次")
                console.print(f"  [yellow]需暂停出货: {summary['hold_count']}[/yellow]")
                console.print(f"  [red]需召回: {summary['recall_count']}[/red]")

                if result["recall"]:
                    console.print("\n[bold red]🔴 需召回批次:[/bold red]")
                    for batch in result["recall"]:
                        console.print(f"  - {batch['roast_batch_id']}")

                if result["hold"]:
                    console.print("\n[bold yellow]🟡 需暂停出货批次:[/bold yellow]")
                    for batch in result["hold"]:
                        console.print(f"  - {batch['roast_batch_id']}")

            elif query_type == "shipments":
                if result:
                    console.print(f"\n[bold]找到 {len(result)} 条发货记录:[/bold]")
                    table = Table(title="发货记录")
                    table.add_column("发货单号", style="cyan")
                    table.add_column("日期", style="magenta")
                    table.add_column("门店", style="yellow")
                    table.add_column("数量", style="green")
                    table.add_column("状态", style="blue")
                    for s in result:
                        table.add_row(
                            s["shipment_id"],
                            s["shipment_date"],
                            s["store_name"],
                            str(s["total_quantity"]),
                            s["status"],
                        )
                    console.print(table)
                else:
                    console.print("[yellow]未找到匹配的发货记录[/yellow]")

            elif query_type == "cupping":
                if result:
                    console.print(f"\n[bold]找到 {len(result)} 条杯测记录:[/bold]")
                    table = Table(title="杯测记录")
                    table.add_column("批次", style="cyan")
                    table.add_column("日期", style="magenta")
                    table.add_column("杯测师", style="yellow")
                    table.add_column("综合得分", style="green")
                    table.add_column("缺陷点数", style="red")
                    for r in result:
                        table.add_row(
                            r["roast_batch_id"],
                            r["cupping_date"],
                            r["cupper"],
                            str(r["overall"]),
                            str(r["total_defect_points"]),
                        )
                    console.print(table)
                else:
                    console.print("[yellow]未找到匹配的杯测记录[/yellow]")

            elif query_type == "green":
                if "error" in result:
                    console.print(f"[red]{result['error']}[/red]")
                else:
                    gb = result["green_batch"]
                    console.print(f"\n[bold]生豆批次: {gb['batch_id']}[/bold]")
                    table = Table(show_header=False)
                    table.add_column("项目", style="cyan")
                    table.add_column("值", style="magenta")
                    table.add_row("产地", gb["origin"])
                    table.add_row("品种", gb["variety"])
                    table.add_row("处理法", gb["process"])
                    table.add_row("到货日期", str(gb["arrival_date"]))
                    table.add_row("数量", f"{gb['quantity_kg']} kg")
                    table.add_row("供应商", gb["supplier"])
                    console.print(table)

                    if result["used_in_roasts"]:
                        console.print(f"\n[bold]已用于 {len(result['used_in_roasts'])} 个烘焙批次:[/bold]")
                        for roast in result["used_in_roasts"]:
                            console.print(f"  - {roast['roast_batch_id']} ({roast['roast_date']})")
    else:
        console.print("[yellow]未找到数据[/yellow]")


@main.command()
@click.argument("batch_id")
@click.option("--reviewer", "-r", required=True, help="复核人姓名")
@click.option("--status", "-s", required=True, type=click.Choice(["hold", "recall", "cleared", "normal"]), help="设置的状态")
@click.option("--notes", "-n", required=True, help="复核备注")
@click.option("--action", "-a", multiple=True, help="行动项（可多次使用）")
@click.option("--green-batches", type=click.Path(exists=True, path_type=Path), help="生豆批次文件")
@click.option("--roast-logs", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件")
@click.option("--cupping-records", type=click.Path(exists=True, path_type=Path), help="杯测记录文件")
@click.option("--labels", type=click.Path(exists=True, path_type=Path), help="包装贴标文件")
@click.option("--shipments", type=click.Path(exists=True, path_type=Path), help="发货记录文件")
def review(
    batch_id, reviewer, status, notes, action,
    green_batches, roast_logs, cupping_records, labels, shipments
):
    """添加人工复核备注"""
    check_engine, state_manager, _, _ = get_engines()

    load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    if batch_id not in check_engine.roast_logs:
        console.print(f"[yellow]警告: 批次 {batch_id} 未在已导入的烘焙记录中找到[/yellow]")
        console.print("[yellow]仍将记录复核信息...[/yellow]")

    batch_status = BatchStatus(status)
    action_items = list(action) if action else []

    review = state_manager.add_review(
        roast_batch_id=batch_id,
        reviewer=reviewer,
        status=batch_status,
        notes=notes,
        action_items=action_items,
    )

    console.print(f"\n[green]✅ 复核记录已保存[/green]")
    console.print(f"  批次: {batch_id}")
    console.print(f"  复核人: {review.reviewer}")
    console.print(f"  状态设置: {review.status.value.upper()}")
    console.print(f"  备注: {review.notes}")
    if review.action_items:
        console.print(f"  行动项:")
        for item in review.action_items:
            console.print(f"    - [ ] {item}")


@main.command("export")
@click.argument("export_type", type=click.Choice(["trace", "audit", "summary"]))
@click.option("--batch-id", "-b", help="批次号（trace模式必需）")
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True, help="输出文件路径")
@click.option("--flagged-only", is_flag=True, help="仅导出风险批次（audit模式）")
@click.option("--green-batches", type=click.Path(exists=True, path_type=Path), help="生豆批次文件")
@click.option("--roast-logs", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件")
@click.option("--cupping-records", type=click.Path(exists=True, path_type=Path), help="杯测记录文件")
@click.option("--labels", type=click.Path(exists=True, path_type=Path), help="包装贴标文件")
@click.option("--shipments", type=click.Path(exists=True, path_type=Path), help="发货记录文件")
def export_(
    export_type, batch_id, output, flagged_only,
    green_batches, roast_logs, cupping_records, labels, shipments
):
    """导出报告: trace(追溯单), audit(审计包), summary(汇总)"""
    check_engine, state_manager, query_engine, exporter = get_engines()

    load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    if export_type == "trace":
        if not batch_id:
            console.print("[red]错误: 导出追溯单需要指定 --batch-id[/red]")
            return
        exporter.generate_trace_report_md(batch_id, output)
        console.print(f"[green]✅ 批次追溯单已导出到: {output}[/green]")

    elif export_type == "audit":
        exporter.generate_audit_package(
            output_path=output,
            include_all=True,
            flagged_only=flagged_only,
        )
        console.print(f"[green]✅ 审计包已导出到: {output}[/green]")

    elif export_type == "summary":
        exporter.generate_flagged_summary_md(output)
        console.print(f"[green]✅ 风险汇总报告已导出到: {output}[/green]")


@main.command()
@click.option("--green-batches", type=click.Path(exists=True, path_type=Path), help="生豆批次文件")
@click.option("--roast-logs", type=click.Path(exists=True, path_type=Path), help="烘焙日志文件")
@click.option("--cupping-records", type=click.Path(exists=True, path_type=Path), help="杯测记录文件")
@click.option("--labels", type=click.Path(exists=True, path_type=Path), help="包装贴标文件")
@click.option("--shipments", type=click.Path(exists=True, path_type=Path), help="发货记录文件")
def status(green_batches, roast_logs, cupping_records, labels, shipments):
    """显示当前系统状态和统计信息"""
    check_engine, state_manager, _, _ = get_engines()

    load_all_data(
        check_engine,
        state_manager,
        green_batches,
        roast_logs,
        cupping_records,
        labels,
        shipments,
    )

    console.print(Panel.fit("[bold cyan]咖啡烘焙追溯系统状态[/bold cyan]"))

    console.print("\n[bold]数据统计:[/bold]")
    table = Table(title="已加载数据")
    table.add_column("数据类型", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_row("生豆批次", str(len(check_engine.green_batches)))
    table.add_row("烘焙日志", str(len(check_engine.roast_logs)))

    cupping_count = sum(len(r) for r in check_engine.cupping_records.values())
    table.add_row("杯测记录", str(cupping_count))

    labels_count = sum(len(l) for l in check_engine.labels.values())
    table.add_row("包装贴标", str(labels_count))
    table.add_row("发货记录", str(len(check_engine.shipments)))
    console.print(table)

    all_checks = check_engine.run_all_checks()
    flagged = check_engine.get_all_flagged_batches()

    console.print("\n[bold]风险状态:[/bold]")
    status_table = Table(title="风险统计")
    status_table.add_column("状态", style="cyan")
    status_table.add_column("批次数量", style="magenta")
    status_table.add_row("正常", str(len(check_engine.roast_logs) - len(flagged)))
    status_table.add_row("[yellow]需暂停出货 (HOLD)[/yellow]", str(sum(1 for s in flagged.values() if s == BatchStatus.HOLD)))
    status_table.add_row("[red]需召回 (RECALL)[/red]", str(sum(1 for s in flagged.values() if s == BatchStatus.RECALL)))
    console.print(status_table)

    last_check = state_manager.get_last_check()
    if last_check:
        console.print(f"\n[bold]最后检查时间:[/bold] {last_check['timestamp']}")

    import_history = state_manager.get_import_history(limit=5)
    if import_history:
        console.print("\n[bold]最近导入记录:[/bold]")
        for record in import_history[-5:]:
            console.print(f"  - {record['timestamp']}: {record['file_type']} ({record['record_count']}条)")


if __name__ == "__main__":
    main()
