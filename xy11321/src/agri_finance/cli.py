import click
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .importer import import_job_sheet, import_fuel_log, import_rate_table
from .billing import process_billing, billing_summary
from .database import (
    get_billing_records, get_import_history, get_bad_records,
    review_billing_record, RecordStatus
)
from .security import mask_record, export_billing_to_csv, export_billing_to_json


console = Console()


@click.group()
def cli():
    """农机合作社财务管理系统"""
    pass


@cli.group(name="import")
def import_cmd():
    """导入数据"""
    pass


@import_cmd.command("job")
@click.argument("file_path", type=click.Path(exists=True, path_type=Path))
@click.option("--operator", "-o", help="操作人姓名")
def import_job(file_path: Path, operator: Optional[str]):
    """导入作业单 CSV"""
    try:
        batch, bad_records = import_job_sheet(file_path, operator)
        console.print(Panel.fit(
            f"[green]导入成功[/green]\n"
            f"批次ID: {batch.batch_id}\n"
            f"总记录: {batch.total_records}\n"
            f"有效记录: [green]{batch.valid_records}[/green]\n"
            f"错误记录: [red]{batch.invalid_records}[/red]",
            title="作业单导入结果"
        ))
        
        if bad_records:
            table = Table(title="错误记录详情")
            table.add_column("行号", style="cyan")
            table.add_column("错误信息", style="red")
            table.add_column("建议", style="yellow")
            for rec in bad_records[:10]:
                table.add_row(
                    str(rec.row_number),
                    rec.error_message[:50] + "..." if len(rec.error_message) > 50 else rec.error_message,
                    (rec.suggestion or "")[:50] + "..." if rec.suggestion and len(rec.suggestion) > 50 else (rec.suggestion or "")
                )
            console.print(table)
            if len(bad_records) > 10:
                console.print(f"... 还有 {len(bad_records) - 10} 条错误记录")
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")


@import_cmd.command("fuel")
@click.argument("file_path", type=click.Path(exists=True, path_type=Path))
@click.option("--operator", "-o", help="操作人姓名")
def import_fuel(file_path: Path, operator: Optional[str]):
    """导入油耗表 JSON"""
    try:
        batch, bad_records = import_fuel_log(file_path, operator)
        console.print(Panel.fit(
            f"[green]导入成功[/green]\n"
            f"批次ID: {batch.batch_id}\n"
            f"总记录: {batch.total_records}\n"
            f"有效记录: [green]{batch.valid_records}[/green]\n"
            f"错误记录: [red]{batch.invalid_records}[/red]",
            title="油耗表导入结果"
        ))
        
        if bad_records:
            table = Table(title="错误记录详情")
            table.add_column("行号", style="cyan")
            table.add_column("错误信息", style="red")
            table.add_column("建议", style="yellow")
            for rec in bad_records[:10]:
                table.add_row(
                    str(rec.row_number),
                    rec.error_message[:50] + "..." if len(rec.error_message) > 50 else rec.error_message,
                    (rec.suggestion or "")[:50] + "..." if rec.suggestion and len(rec.suggestion) > 50 else (rec.suggestion or "")
                )
            console.print(table)
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")


@import_cmd.command("rate")
@click.argument("file_path", type=click.Path(exists=True, path_type=Path))
@click.option("--operator", "-o", help="操作人姓名")
def import_rate(file_path: Path, operator: Optional[str]):
    """导入费率表 CSV"""
    try:
        batch, bad_records = import_rate_table(file_path, operator)
        console.print(Panel.fit(
            f"[green]导入成功[/green]\n"
            f"批次ID: {batch.batch_id}\n"
            f"总记录: {batch.total_records}\n"
            f"有效记录: [green]{batch.valid_records}[/green]\n"
            f"错误记录: [red]{batch.invalid_records}[/red]",
            title="费率表导入结果"
        ))
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")


@cli.command()
@click.option("--batch-size", "-n", default=100, help="批量处理数量")
def bill(batch_size: int):
    """执行计费处理"""
    with console.status("[bold green]正在计费..."):
        result = process_billing(batch_size)
    
    console.print(Panel.fit(
        f"处理完成: [green]{result['processed']}[/green] 条\n"
        f"跳过 (0元): [yellow]{result['skipped']}[/yellow] 条\n"
        f"无费率: [red]{result['errors']}[/red] 条\n"
        f"剩余待处理: {result['total_pending'] - result['processed']} 条",
        title="计费结果"
    ))


@cli.command()
@click.argument("billing_id", type=int)
@click.argument("reviewer")
def review(billing_id: int, reviewer: str):
    """复核账单"""
    try:
        review_billing_record(billing_id, reviewer)
        console.print(f"[green]账单 {billing_id} 已由 {reviewer} 复核完成[/green]")
    except Exception as e:
        console.print(f"[red]复核失败: {e}[/red]")


@cli.group(name="list")
def list_cmd():
    """查询列表"""
    pass


@list_cmd.command("billing")
@click.option("--status", "-s", type=click.Choice(['pending', 'billed', 'reviewed']), help="状态筛选")
@click.option("--limit", "-n", default=20, help="显示数量")
def list_billing(status: Optional[str], limit: int):
    """列出账单"""
    status_enum = RecordStatus(status) if status else None
    records = get_billing_records(status_enum)
    
    if not records:
        console.print("[yellow]没有找到账单记录[/yellow]")
        return
    
    table = Table(title=f"账单列表 (共 {len(records)} 条)")
    table.add_column("ID", style="cyan")
    table.add_column("拖拉机", style="blue")
    table.add_column("机手", style="green")
    table.add_column("日期", style="magenta")
    table.add_column("小时费", justify="right")
    table.add_column("亩费", justify="right")
    table.add_column("油费", justify="right")
    table.add_column("总计", justify="right", style="bold")
    table.add_column("状态")
    
    for rec in records[:limit]:
        masked = mask_record(rec.model_dump(), context="display")
        status_color = {
            "pending": "yellow",
            "billed": "blue",
            "reviewed": "green"
        }.get(rec.status.value, "white")
        
        table.add_row(
            str(rec.id),
            rec.tractor_id,
            masked.get('operator_name') or rec.operator_id,
            str(rec.job_date)[:10],
            f"{rec.hourly_charge:.2f}",
            f"{rec.mu_charge:.2f}",
            f"{rec.fuel_charge:.2f}",
            f"{rec.total_charge:.2f}",
            f"[{status_color}]{rec.status.value}[/{status_color}]"
        )
    
    console.print(table)
    
    if len(records) > limit:
        console.print(f"... 还有 {len(records) - limit} 条记录")
    
    summary = billing_summary(records)
    if summary:
        console.print(Panel.fit(
            f"总金额: [bold green]¥{summary['total_amount']:.2f}[/bold green]\n"
            f"  - 小时费: ¥{summary['total_hourly']:.2f}\n"
            f"  - 亩费: ¥{summary['total_mu']:.2f}\n"
            f"  - 油费: ¥{summary['total_fuel']:.2f}",
            title="汇总统计"
        ))


@list_cmd.command("history")
@click.option("--limit", "-n", default=10, help="显示数量")
def list_history(limit: int):
    """列出导入历史"""
    records = get_import_history(limit)
    
    if not records:
        console.print("[yellow]没有找到导入历史[/yellow]")
        return
    
    table = Table(title="导入历史")
    table.add_column("批次ID", style="cyan")
    table.add_column("类型", style="blue")
    table.add_column("文件名", style="green")
    table.add_column("总记录", justify="right")
    table.add_column("有效", justify="right", style="green")
    table.add_column("无效", justify="right", style="red")
    table.add_column("时间", style="magenta")
    
    for rec in records:
        table.add_row(
            rec.batch_id,
            rec.source_type.value,
            rec.file_name,
            str(rec.total_records),
            str(rec.valid_records),
            str(rec.invalid_records),
            str(rec.created_at)[:16]
        )
    
    console.print(table)


@list_cmd.command("bad")
@click.option("--batch-id", "-b", help="批次ID筛选")
def list_bad(batch_id: Optional[str]):
    """列出错误记录"""
    records = get_bad_records(batch_id)
    
    if not records:
        console.print("[yellow]没有找到错误记录[/yellow]")
        return
    
    table = Table(title=f"错误记录 (共 {len(records)} 条)")
    table.add_column("批次ID", style="cyan")
    table.add_column("类型", style="blue")
    table.add_column("行号", justify="right")
    table.add_column("错误信息", style="red")
    table.add_column("建议", style="yellow")
    
    for rec in records[:20]:
        table.add_row(
            rec.batch_id,
            rec.source_type.value,
            str(rec.row_number),
            rec.error_message[:40] + "..." if len(rec.error_message) > 40 else rec.error_message,
            (rec.suggestion or "")[:40] + "..." if rec.suggestion and len(rec.suggestion) > 40 else (rec.suggestion or "")
        )
    
    console.print(table)


@cli.command()
@click.option("--status", "-s", type=click.Choice(['pending', 'billed', 'reviewed']), help="状态筛选")
@click.option("--format", "-f", "fmt", type=click.Choice(['csv', 'json']), default='csv', help="导出格式")
@click.argument("output_path", type=click.Path(path_type=Path))
def export(status: Optional[str], fmt: str, output_path: Path):
    """导出账单"""
    status_enum = RecordStatus(status) if status else None
    records = get_billing_records(status_enum)
    
    if not records:
        console.print("[yellow]没有找到账单记录[/yellow]")
        return
    
    with console.status(f"[bold green]正在导出 {len(records)} 条记录..."):
        if fmt == 'csv':
            export_billing_to_csv(records, str(output_path))
        else:
            export_billing_to_json(records, str(output_path))
    
    console.print(f"[green]已导出 {len(records)} 条记录到 {output_path}[/green]")


if __name__ == "__main__":
    cli()
