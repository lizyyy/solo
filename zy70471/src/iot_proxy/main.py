import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from .processor import ReceiptProcessor
from .formatter import OutputFormatter

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """IoT设备回执处理命令行工具"""
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True, dir_okay=False))
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.option("--format", "-f", "format_type", type=click.Choice(["json", "markdown", "console"]), default="console", help="输出格式")
@click.option("--force", "-F", is_flag=True, help="强制重新处理，忽略缓存")
def process(input_file, output, format_type, force):
    """处理IoT设备回执数据"""
    processor = ReceiptProcessor()
    
    with open(input_file, "r", encoding="utf-8") as f:
        try:
            receipts_data = json.load(f)
            if not isinstance(receipts_data, list):
                receipts_data = [receipts_data]
        except json.JSONDecodeError as e:
            console.print(f"[red]JSON解析失败: {e}[/red]")
            sys.exit(1)
    
    if force:
        batch_id = processor._generate_batch_id(receipts_data)
        cache_path = processor._get_cache_path(batch_id)
        if cache_path.exists():
            cache_path.unlink()
    
    result = processor.process_receipts(receipts_data)
    
    exit_code = 0
    if result.failed_count > 0:
        exit_code = 2
    elif result.abnormal_count > 0:
        exit_code = 1
    
    if result.is_cached:
        console.print("[yellow]使用缓存的处理结果[/yellow]")
    
    if format_type == "console":
        _print_console_result(result)
    elif format_type == "json":
        content = OutputFormatter.to_json(result)
        if output:
            OutputFormatter.save_to_file(result, output, "json")
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            print(content)
    elif format_type == "markdown":
        content = OutputFormatter.to_markdown(result)
        if output:
            OutputFormatter.save_to_file(result, output, "markdown")
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            print(content)
    
    sys.exit(exit_code)


def _print_console_result(result):
    console.print(f"\n[bold blue]=== IoT设备回执处理报告 ===[/bold blue]")
    console.print(f"批次ID: [cyan]{result.batch_id}[/cyan]")
    console.print(f"处理时间: {result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}")
    console.print(f"缓存状态: {'[yellow]使用缓存[/yellow]' if result.is_cached else '[green]新处理[/green]'}")
    
    table = Table(title="统计概览")
    table.add_column("指标", style="cyan")
    table.add_column("数量", justify="right")
    table.add_row("总记录数", str(result.total_count))
    table.add_row("正常记录", f"[green]{result.normal_count}[/green]")
    table.add_row("异常记录", f"[yellow]{result.abnormal_count}[/yellow]")
    table.add_row("失败记录", f"[red]{result.failed_count}[/red]")
    console.print(table)
    
    if result.abnormal_count > 0:
        console.print("\n[bold yellow]=== 时区异常记录 ===[/bold yellow]")
        for r in result.receipts:
            if r.status == "abnormal":
                console.print(f"  设备 {r.device_id}: [yellow]{r.error_message}[/yellow]")
    
    if result.failed_count > 0:
        console.print("\n[bold red]=== 失败记录 ===[/bold red]")
        for r in result.receipts:
            if r.status == "failed":
                console.print(f"  设备 {r.device_id}: [red]{r.error_message}[/red]")
    
    console.print("\n[dim]失败详情已保存到 failures/ 目录[/dim]")
    if result.abnormal_count > 0 or result.failed_count > 0:
        console.print(f"[dim]提示: 使用 'iot-proxy show-failures {result.batch_id}' 查看详细失败信息[/dim]")


@cli.command(name="show-failures")
@click.argument("batch_id")
def show_failures(batch_id):
    """查看指定批次的失败记录详情"""
    processor = ReceiptProcessor()
    failure_path = processor.failures_dir / f"{batch_id}_failures.json"
    
    if not failure_path.exists():
        console.print(f"[red]未找到批次 {batch_id} 的失败记录[/red]")
        sys.exit(1)
    
    with open(failure_path, "r", encoding="utf-8") as f:
        failures = json.load(f)
    
    console.print(f"\n[bold red]=== 批次 {batch_id} 失败/异常记录详情 ===[/bold red]")
    console.print(f"共 {len(failures)} 条记录\n")
    
    for i, failure in enumerate(failures, 1):
        console.print(f"[bold]{i}. 设备 {failure['device_id']}[/bold]")
        console.print(f"   回执ID: {failure['receipt_id']}")
        console.print(f"   状态: {failure['status']}")
        console.print(f"   错误: [red]{failure['error_message']}[/red]")
        console.print(f"   原始时间戳: {failure['timestamp']}")
        console.print()


@cli.command(name="add-change")
@click.option("--scope", "-s", required=True, help="资源范围")
@click.option("--reason", "-r", required=True, help="变更理由")
@click.option("--by", "-b", "changed_by", default="system", help="变更人")
@click.option("--extra", "-e", multiple=True, help="额外信息 (key=value)")
def add_change(scope, reason, changed_by, extra):
    """添加变更日志记录"""
    processor = ReceiptProcessor()
    
    extra_dict = {}
    for item in extra:
        if "=" in item:
            key, value = item.split("=", 1)
            extra_dict[key] = value
    
    change_log = processor.add_change_log(
        resource_scope=scope,
        change_reason=reason,
        changed_by=changed_by,
        extra=extra_dict
    )
    
    console.print(f"[green]变更记录已添加[/green]")
    console.print(f"  变更ID: {change_log.change_id}")
    console.print(f"  资源范围: {change_log.resource_scope}")
    console.print(f"  变更理由: {change_log.change_reason}")
    console.print(f"  变更人: {change_log.changed_by}")


@cli.command(name="show-changes")
@click.option("--scope", "-s", help="按资源范围过滤")
def show_changes(scope):
    """查看变更历史记录"""
    processor = ReceiptProcessor()
    logs = processor.get_change_logs(resource_scope=scope)
    
    if not logs:
        console.print("[yellow]未找到变更记录[/yellow]")
        return
    
    console.print(f"\n[bold blue]=== 变更历史记录 ===[/bold blue]")
    if scope:
        console.print(f"资源范围: {scope}\n")
    
    for log in reversed(logs):
        console.print(f"[bold]{log.changed_at.strftime('%Y-%m-%d %H:%M:%S')}[/bold]")
        console.print(f"  ID: {log.change_id}")
        console.print(f"  范围: [cyan]{log.resource_scope}[/cyan]")
        console.print(f"  理由: {log.change_reason}")
        console.print(f"  变更人: {log.changed_by}")
        if log.extra:
            console.print(f"  额外信息: {json.dumps(log.extra, ensure_ascii=False)}")
        console.print()


@cli.command()
def sample():
    """生成样例数据文件"""
    sample_data = [
        {
            "device_id": "DEV001",
            "receipt_id": "RCP001",
            "receipt_type": "temperature",
            "timestamp": "2026-05-16T10:30:00+08:00",
            "data": {"temperature": 25.5, "unit": "celsius"}
        },
        {
            "device_id": "DEV001",
            "receipt_id": "RCP002",
            "receipt_type": "humidity",
            "timestamp": "2026-05-16T10:30:00+08:00",
            "data": {"humidity": 65, "unit": "percent"}
        },
        {
            "device_id": "DEV002",
            "receipt_id": "RCP003",
            "receipt_type": "door",
            "timestamp": "2026-05-16T02:30:00+00:00",
            "data": {"status": "open"}
        },
        {
            "device_id": "DEV002",
            "receipt_id": "RCP004",
            "receipt_type": "power",
            "timestamp": "2026-05-16T10:30:00-05:00",
            "data": {"voltage": 220, "current": 5.5}
        },
        {
            "device_id": "DEV003",
            "receipt_id": "RCP005",
            "receipt_type": "temperature",
            "timestamp": "2026-05-16T10:30:00",
            "data": {"temperature": 28.0}
        }
    ]
    
    output_path = Path("data/sample_receipts.json")
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    console.print(f"[green]样例数据已生成: {output_path}[/green]")
    console.print("\n样例说明:")
    console.print("  DEV001 - 两条正常记录（东八区）")
    console.print("  DEV002 - 一条正常（UTC），一条异常（西五区时区偏移过大）")
    console.print("  DEV003 - 失败记录（缺少时区信息）")
    console.print(f"\n处理命令: iot-proxy process {output_path}")


if __name__ == "__main__":
    cli()
