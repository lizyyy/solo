"""CLI 入口模块"""
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .config import ConfigManager, EntryRule, DeviceTimeOffset
from .csv_parser import CSVParser, TicketRosterEntry, ScanLogEntry
from .models import AnomalyType
from .reconciler import Reconciler
from .quarantine import QuarantineManager
from .storage import StorageManager
from .report import ReportExporter

console = Console()


def get_workspace_dir(ctx: click.Context) -> Path:
    """从上下文获取工作目录"""
    return Path(ctx.obj.get("workspace", "."))


@click.group()
@click.option("--workspace", "-w", default=".", help="工作目录，默认为当前目录")
@click.pass_context
def main(ctx: click.Context, workspace: str):
    """离线闸口对账器 - 线下展会检票对账工具"""
    ctx.ensure_object(dict)
    ctx.obj["workspace"] = Path(workspace).resolve()


@main.command()
@click.option("--name", "-n", required=True, help="项目名称")
@click.option("--date", "-d", required=True, help="展会日期 (格式: YYYY-MM-DD)")
@click.option("--reentry-types", "-r", multiple=True, help="允许二次入场的票种（可多次指定）")
@click.pass_context
def init(
    ctx: click.Context,
    name: str,
    date: str,
    reentry_types: tuple,
):
    """初始化项目配置"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    # 检查项目是否已初始化
    if config_manager.exists():
        console.print(f"[yellow]项目已在 {workspace} 初始化[/yellow]")
        if not click.confirm("是否覆盖现有配置？"):
            console.print("已取消")
            return
    
    # 初始化项目
    config = config_manager.init_project(
        project_name=name,
        event_date=date,
        reentry_allowed_types=list(reentry_types) if reentry_types else None,
    )
    
    console.print(Panel.fit(
        f"[green]✓ 项目初始化成功[/green]\n"
        f"\n项目名称: {config.project_name}\n"
        f"展会日期: {config.event_date}\n"
        f"工作目录: {workspace}\n"
        f"\n创建的目录结构:\n"
        f"  data/rosters/   - 票务名单存储\n"
        f"  data/logs/      - 扫码日志存储\n"
        f"  output/reports/ - 报告输出\n"
        f"  output/ledgers/ - 台账输出\n"
        f"  history/        - 历史记录\n"
        f"  quarantine/     - 隔离区",
        title="初始化完成",
    ))


@main.command("import-roster")
@click.argument("csv_file", type=click.Path(exists=True, dir_okay=False))
@click.option("--name", "-n", help="名单名称（默认使用文件名）")
@click.pass_context
def import_roster(ctx: click.Context, csv_file: str, name: Optional[str]):
    """导入票务名单 CSV
    
    CSV 字段: 票号, 姓名, 手机号后四位, 票种, 允许入口, 是否黑名单
    """
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    # 检查项目是否初始化
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化，请先运行 init 命令[/red]")
        sys.exit(1)
    
    csv_path = Path(csv_file)
    
    # 解析 CSV
    parser = CSVParser()
    result = parser.parse_roster(csv_path)
    
    if result.success_count == 0:
        console.print(f"[red]错误: 未能解析任何有效行，共 {result.total_rows} 行[/red]")
        if result.failed_count > 0:
            console.print(f"失败示例: {result.failed_rows[0][1]}")
        sys.exit(1)
    
    # 保存文件
    storage = StorageManager(workspace)
    roster_name = name or csv_path.stem
    saved_path = storage.save_roster(csv_path, roster_name)
    
    # 显示统计
    table = Table(title="票务名单导入结果")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("总行数", str(result.total_rows))
    table.add_row("成功解析", str(result.success_count))
    table.add_row("解析失败", str(result.failed_count))
    
    console.print(table)
    
    if result.failed_count > 0:
        console.print(f"[yellow]⚠  有 {result.failed_count} 行解析失败，将放入隔离区[/yellow]")
        
        # 将失败行放入隔离区
        quarantine = QuarantineManager(workspace)
        for line_number, error, raw_data in result.failed_rows:
            quarantine.add_bad_row(
                error=error,
                raw_data=raw_data,
                source_file=saved_path.name,
                line_number=line_number,
            )
    
    console.print(f"[green]✓ 票务名单已保存到: {saved_path}[/green]")


@main.command("import-log")
@click.argument("csv_files", nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option("--name", "-n", help="日志名称前缀（默认使用文件名）")
@click.pass_context
def import_log(ctx: click.Context, csv_files: tuple, name: Optional[str]):
    """导入扫码日志 CSV（可一次导入多个文件）
    
    CSV 字段: 设备号, 入口, 时间戳, 票号, 动作, 操作员
    """
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化，请先运行 init 命令[/red]")
        sys.exit(1)
    
    if not csv_files:
        console.print("[yellow]请提供要导入的 CSV 文件路径[/yellow]")
        return
    
    parser = CSVParser()
    storage = StorageManager(workspace)
    quarantine = QuarantineManager(workspace)
    
    total_success = 0
    total_failed = 0
    total_rows = 0
    
    for idx, csv_file in enumerate(csv_files):
        csv_path = Path(csv_file)
        
        # 解析
        result = parser.parse_scan_log(csv_path)
        
        total_success += result.success_count
        total_failed += result.failed_count
        total_rows += result.total_rows
        
        # 保存
        log_name = f"{name}_{idx+1}" if name else csv_path.stem
        saved_path = storage.save_scan_log(csv_path, log_name)
        
        # 失败行放入隔离区
        for line_number, error, raw_data in result.failed_rows:
            quarantine.add_bad_row(
                error=error,
                raw_data=raw_data,
                source_file=saved_path.name,
                line_number=line_number,
            )
    
    # 显示统计
    table = Table(title="扫码日志导入结果")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("导入文件数", str(len(csv_files)))
    table.add_row("总行数", str(total_rows))
    table.add_row("成功解析", str(total_success))
    table.add_row("解析失败", str(total_failed))
    
    console.print(table)
    
    if total_failed > 0:
        console.print(f"[yellow]⚠  有 {total_failed} 行解析失败，已放入隔离区[/yellow]")
    
    console.print(f"[green]✓ 日志已保存到: {storage.data_dir / 'logs'}[/green]")


@main.command()
@click.pass_context
def reconcile(ctx: click.Context):
    """执行对账"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化，请先运行 init 命令[/red]")
        sys.exit(1)
    
    config = config_manager.load()
    storage = StorageManager(workspace)
    quarantine = QuarantineManager(workspace)
    
    # 获取已导入的名单和日志
    roster_files = storage.get_roster_files()
    log_files = storage.get_log_files()
    
    if not roster_files:
        console.print("[red]错误: 没有找到票务名单，请先运行 import-roster[/red]")
        sys.exit(1)
    
    if not log_files:
        console.print("[red]错误: 没有找到扫码日志，请先运行 import-log[/red]")
        sys.exit(1)
    
    # 解析所有名单
    parser = CSVParser()
    roster: dict = {}
    failed_rows: list = []
    
    for roster_file in roster_files:
        result = parser.parse_roster(roster_file)
        for entry in result.success_entries:
            if entry.ticket_number in roster:
                console.print(f"[yellow]警告: 票号 {entry.ticket_number} 重复，已覆盖[/yellow]")
            roster[entry.ticket_number] = entry
        failed_rows.extend(result.failed_rows)
    
    # 解析所有日志
    log_result = parser.parse_multiple_scan_logs(log_files)
    scan_logs = log_result.success_entries
    failed_rows.extend(log_result.failed_rows)
    
    console.print(f"[cyan]开始对账...[/cyan]")
    console.print(f"  票务名单: {len(roster)} 条")
    console.print(f"  扫码日志: {len(scan_logs)} 条")
    console.print(f"  解析失败: {len(failed_rows)} 行")
    
    # 执行对账
    reconciler = Reconciler(config)
    result = reconciler.reconcile(roster, scan_logs, failed_rows)
    
    # 保存结果
    ledger_path = storage.save_ledger(result)
    console.print(f"[green]✓ 台账已保存: {ledger_path}[/green]")
    
    # 导出报告
    report_exporter = ReportExporter(workspace)
    report_path = report_exporter.export_markdown_report(result)
    anomalies_path = report_exporter.export_anomalies_csv(result)
    console.print(f"[green]✓ 报告已保存: {report_path}[/green]")
    console.print(f"[green]✓ 异常清单已保存: {anomalies_path}[/green]")
    
    # 保存历史记录
    history_path = storage.save_history(
        result=result,
        ledger_path=ledger_path,
        report_path=report_path,
        anomalies_path=anomalies_path,
    )
    console.print(f"[green]✓ 历史记录已保存: {history_path}[/green]")
    
    # 显示结果摘要
    console.print("")
    table = Table(title="对账结果摘要")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("总票数", str(result.total_tickets))
    table.add_row("已扫描", str(result.tickets_scanned))
    table.add_row("当前在场", str(result.tickets_in_venue))
    table.add_row("已退场", str(result.tickets_exited))
    table.add_row("[red]异常总数[/red]", f"[red]{result.total_anomalies}[/red]")
    table.add_row("隔离区记录", str(result.quarantined_count))
    table.add_row("合并重复扫码", str(result.duplicate_merges))
    
    console.print(table)
    
    if result.total_anomalies > 0:
        console.print("")
        console.print("[yellow]⚠  发现异常，详细信息请查看报告[/yellow]")
        for anomaly_type, count in result.anomaly_counts.items():
            console.print(f"  - {anomaly_type.value}: {count}")


@main.command()
@click.option("--format", "-f", "output_format", type=click.Choice(["md", "csv", "all"]), default="all", help="输出格式")
@click.pass_context
def report(ctx: click.Context, output_format: str):
    """导出复盘报告和异常清单"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化[/red]")
        sys.exit(1)
    
    storage = StorageManager(workspace)
    report_exporter = ReportExporter(workspace)
    
    # 获取最新的台账
    ledger_data = storage.get_latest_ledger()
    
    if not ledger_data:
        console.print("[red]错误: 没有找到对账结果，请先运行 reconcile 命令[/red]")
        sys.exit(1)
    
    # 注意：这里简化处理，实际应该从台账重建 ReconciliationResult
    # 为了简单，我们提示用户先运行 reconcile
    console.print("[yellow]请先运行 'reconcile' 命令以生成最新报告[/yellow]")
    console.print(f"报告目录: {report_exporter.reports_dir}")


@main.command("export-ledger")
@click.option("--output", "-o", help="输出文件路径")
@click.pass_context
def export_ledger(ctx: click.Context, output: Optional[str]):
    """导出清洗后的 JSON 台账"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化[/red]")
        sys.exit(1)
    
    storage = StorageManager(workspace)
    ledger_data = storage.get_latest_ledger()
    
    if not ledger_data:
        console.print("[red]错误: 没有找到台账，请先运行 reconcile 命令[/red]")
        sys.exit(1)
    
    import json
    
    if output:
        output_path = Path(output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(ledger_data, f, indent=2, ensure_ascii=False)
        console.print(f"[green]✓ 台账已导出到: {output_path}[/green]")
    else:
        # 显示摘要
        summary = ledger_data.get("summary", {})
        table = Table(title="台账摘要")
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green")
        for key, value in summary.items():
            table.add_row(key, str(value))
        console.print(table)
        
        console.print(f"[cyan]使用 -o 参数指定输出路径以导出完整 JSON[/cyan]")


@main.command()
@click.option("--date", "-d", help="按日期筛选 (格式: YYYY-MM-DD)")
@click.option("--entry", "-e", help="按入口筛选")
@click.option("--anomaly-type", "-a", "anomaly_type_str", help="按异常类型筛选")
@click.pass_context
def history(
    ctx: click.Context,
    date: Optional[str],
    entry: Optional[str],
    anomaly_type_str: Optional[str],
):
    """查询历史对账结果"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化[/red]")
        sys.exit(1)
    
    storage = StorageManager(workspace)
    
    # 转换异常类型
    anomaly_type = None
    if anomaly_type_str:
        try:
            anomaly_type = AnomalyType(anomaly_type_str)
        except ValueError:
            console.print(f"[red]错误: 无效的异常类型 '{anomaly_type_str}'[/red]")
            console.print(f"可用类型: {', '.join([t.value for t in AnomalyType])}")
            sys.exit(1)
    
    # 查询历史
    records = storage.load_history(
        event_date=date,
        entry=entry,
        anomaly_type=anomaly_type,
    )
    
    if not records:
        console.print("[yellow]没有找到匹配的历史记录[/yellow]")
        return
    
    # 显示结果
    table = Table(title="历史对账记录")
    table.add_column("日期", style="cyan")
    table.add_column("对账时间", style="green")
    table.add_column("总票数", style="blue")
    table.add_column("已扫描", style="blue")
    table.add_column("异常数", style="red")
    table.add_column("隔离区", style="yellow")
    
    for record in records:
        summary = record.get("summary", {})
        recon_time = record.get("reconciliation_time")
        if isinstance(recon_time, datetime):
            time_str = recon_time.strftime("%H:%M:%S")
        else:
            time_str = str(recon_time)
        
        table.add_row(
            record.get("event_date", "-"),
            time_str,
            str(summary.get("total_tickets", "-")),
            str(summary.get("tickets_scanned", "-")),
            str(summary.get("total_anomalies", "-")),
            str(record.get("quarantined_count", "-")),
        )
    
    console.print(table)
    console.print(f"[cyan]共找到 {len(records)} 条记录[/cyan]")


@main.command()
@click.option("--list", "-l", "list_items", is_flag=True, help="列出隔离区条目")
@click.option("--resolve", "-r", help="标记指定 ID 的条目为已处理")
@click.option("--resolution", "-m", help="处理说明（配合 --resolve 使用）")
@click.pass_context
def quarantine(
    ctx: click.Context,
    list_items: bool,
    resolve: Optional[str],
    resolution: Optional[str],
):
    """管理隔离区"""
    workspace = get_workspace_dir(ctx)
    config_manager = ConfigManager(workspace)
    
    if not config_manager.exists():
        console.print("[red]错误: 项目未初始化[/red]")
        sys.exit(1)
    
    qm = QuarantineManager(workspace)
    
    if resolve:
        if not resolution:
            resolution = click.prompt("请输入处理说明")
        
        if qm.resolve(resolve, resolution):
            console.print(f"[green]✓ 已标记条目 {resolve} 为已处理[/green]")
        else:
            console.print(f"[red]错误: 未找到条目 {resolve}[/red]")
        return
    
    if list_items:
        items = qm.get_unresolved()
        
        if not items:
            console.print("[green]隔离区为空[/green]")
            return
        
        table = Table(title="隔离区条目（未处理）")
        table.add_column("ID", style="cyan")
        table.add_column("异常类型", style="yellow")
        table.add_column("票号", style="green")
        table.add_column("描述", style="white")
        
        for item in items[:20]:  # 最多显示20条
            table.add_row(
                item.id[:8],  # 显示ID前8位
                item.anomaly_type.value,
                item.ticket_number or "-",
                item.description[:40] + "..." if len(item.description) > 40 else item.description,
            )
        
        console.print(table)
        
        if len(items) > 20:
            console.print(f"[yellow]... 还有 {len(items) - 20} 条记录[/yellow]")
        
        console.print(f"[cyan]共 {len(items)} 条未处理记录[/cyan]")
        return
    
    # 默认显示统计
    count = qm.get_count()
    unresolved = len(qm.get_unresolved())
    counts_by_type = qm.get_count_by_type()
    
    console.print(f"隔离区统计:")
    console.print(f"  总记录数: {count}")
    console.print(f"  未处理: {unresolved}")
    
    if counts_by_type:
        console.print(f"  按类型分布:")
        for anomaly_type, type_count in counts_by_type.items():
            console.print(f"    - {anomaly_type.value}: {type_count}")


if __name__ == "__main__":
    main()
