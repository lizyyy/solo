"""命令行入口 - 一线运维同事的友好界面"""
import os
import sys
import uuid
from datetime import datetime
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

from .models import CleaningContext, RecordStatus
from .engine import CSVCleaningEngine
from .errors import (
    translate_error, CSVCleanerError, DuplicateBatchError,
    PathSpaceWarning, EmptyFilterResult, LedgerConsistencyError
)

console = Console()


def create_context(operator: str = "运维同事") -> CleaningContext:
    """创建清洗上下文"""
    session_id = str(uuid.uuid4())[:8]
    return CleaningContext(
        session_id=session_id,
        operator=operator
    )


def print_header():
    """打印欢迎头部"""
    header = Panel.fit(
        Text("📊 CSV脏数据清洗工具", style="bold blue"),
        subtitle="值班群专用 · 操作全留痕 · 扯皮不存在",
        border_style="blue"
    )
    console.print(header)


def print_stats(engine: CSVCleaningEngine):
    """打印统计信息"""
    stats = engine.get_statistics()
    table = Table(title="📈 当前统计", show_header=True, header_style="bold magenta")
    table.add_column("项目", style="cyan")
    table.add_column("数值", justify="right")
    
    for key, value in stats.items():
        if key == "状态分布":
            for status, count in value.items():
                table.add_row(f"  {status}", str(count))
        elif key == "筛选条件":
            table.add_row(key, str(value) if value else "无")
        else:
            table.add_row(key, str(value))
    
    console.print(table)


def print_records(records: List, page: int, page_size: int, total: int):
    """打印记录表格"""
    if not records:
        console.print("[yellow]⚠️  当前没有可显示的记录[/yellow]")
        return

    table = Table(title=f"📋 记录列表 (第{page}页 / 共{total}条)", 
                  show_header=True, header_style="bold green")
    table.add_column("行号", style="dim", width=6)
    table.add_column("状态", width=10)
    table.add_column("工单号", width=16)
    table.add_column("操作人", width=8)
    table.add_column("文件路径", overflow="fold")
    table.add_column("处理结果", width=10)
    table.add_column("路径空格", width=8)
    table.add_column("备注", overflow="fold")

    for rec in records:
        data = rec.data
        status_style = {
            "正常": "green",
            "重复项": "yellow",
            "晚到附件": "blue",
            "人工更正": "magenta",
            "无效数据": "red",
            "待处理": "dim"
        }.get(rec.status.value, "white")

        table.add_row(
            str(rec.source_row_number),
            Text(rec.status.value, style=status_style),
            data.get("工单号", "-"),
            data.get("操作人", "-"),
            rec.normalized_path or data.get("file_path", "-"),
            data.get("处理结果", "-"),
            "是" if rec.has_path_space else "否",
            rec.notes or "-"
        )

    console.print(table)
    console.print(f"[dim]显示范围：第{(page-1)*page_size+1}-{min(page*page_size, total)}条，共{total}条[/dim]")


def print_warnings(warnings: List[str]):
    """打印警告信息"""
    if warnings:
        console.print("\n[yellow]⚠️  注意事项：[/yellow]")
        for w in warnings:
            console.print(f"  [yellow]• {w}[/yellow]")


def handle_error(e: Exception):
    """统一错误处理"""
    if isinstance(e, CSVCleanerError):
        user_err = e.to_user_friendly()
    else:
        user_err = translate_error(e)
    
    console.print(f"\n[red]{user_err}[/red]\n")
    
    if "--debug" in sys.argv:
        console.print(f"[dim]技术详情：{user_err.get_technical_details()}[/dim]")


@click.group(invoke_without_command=True)
@click.option("--operator", "-u", default="运维同事", help="操作人姓名")
@click.option("--debug/--no-debug", default=False, help="显示技术错误详情")
@click.pass_context
def cli(ctx, operator: str, debug: bool):
    """CSV脏数据清洗工具 - 一线运维专用"""
    ctx.ensure_object(dict)
    ctx.obj["context"] = create_context(operator)
    ctx.obj["engine"] = CSVCleaningEngine(ctx.obj["context"])
    
    if ctx.invoked_subcommand is None:
        print_header()
        click.echo(ctx.get_help())


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--force", "-f", is_flag=True, help="强制重新处理已处理过的批次")
@click.option("--auto-clean/--no-auto-clean", default=True, help="加载后自动执行清洗")
@click.pass_context
def load(ctx, files: List[str], force: bool, auto_clean: bool):
    """加载CSV文件并自动清洗"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    if not files:
        console.print("[red]❌ 请指定要加载的CSV文件[/red]")
        return

    try:
        with console.status(f"[cyan]正在加载 {len(files)} 个文件...[/cyan]"):
            loaded, warnings = engine.load_csv_files(list(files), force=force)
        
        console.print(f"[green]✅ 成功加载 {loaded} 条记录[/green]")
        print_warnings(warnings)
        
        if auto_clean and loaded > 0:
            console.print("\n[cyan]🔄 开始自动清洗...[/cyan]")
            results = engine.run_full_cleaning()
            
            console.print("\n[green]🎉 清洗完成！[/green]")
            for operation, (count, _) in results.items():
                icon = "✅" if count > 0 else "ℹ️"
                console.print(f"  {icon} {operation}：{count} 条")
        
        print_stats(engine)
        
        records = engine.refresh_screen()
        total = len(ctx.obj["context"]._apply_filter(list(ctx.obj["context"].records.values())))
        print_records(records, ctx.obj["context"].current_page, ctx.obj["context"].page_size, total)
        
    except DuplicateBatchError as e:
        console.print(f"[yellow]⚠️  {e.user_message}[/yellow]")
        console.print(f"[dim]💡 {e.suggestion}[/dim]")
    except Exception as e:
        handle_error(e)


@cli.command("list")
@click.option("--page", "-p", type=int, default=1, help="页码")
@click.option("--page-size", "-s", type=int, default=10, help="每页条数")
@click.option("--status", help="按状态筛选：正常/重复项/晚到附件/人工更正")
@click.option("--has-space", is_flag=True, help="只看有路径空格的记录")
@click.option("--operator", help="按操作人筛选")
@click.pass_context
def list_records(ctx, page: int, page_size: int, status: str, has_space: bool, operator: str):
    """查看记录列表，支持筛选和分页"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    context: CleaningContext = ctx.obj["context"]
    
    try:
        context.page_size = page_size
        
        filter_kwargs = {}
        if status:
            filter_kwargs["status"] = status
        if has_space:
            filter_kwargs["has_path_space"] = True
        if operator:
            filter_kwargs["操作人"] = operator
        
        if filter_kwargs:
            records = engine.change_filter(**filter_kwargs)
        else:
            context.set_page(page)
            records = engine.refresh_screen()
        
        total = len(context._apply_filter(list(context.records.values())))
        print_records(records, context.current_page, context.page_size, total)
        print_stats(engine)
        
    except EmptyFilterResult as e:
        console.print(f"[yellow]⚠️  {e.user_message}[/yellow]")
        console.print(f"[dim]💡 {e.suggestion}[/dim]")
    except Exception as e:
        handle_error(e)


@cli.command()
@click.pass_context
def dedup(ctx):
    """手动去重"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    try:
        with console.status("[cyan]正在去重...[/cyan]"):
            count, ids = engine.remove_duplicates()
        
        if count > 0:
            console.print(f"[green]✅ 已去除 {count} 条重复记录[/green]")
        else:
            console.print("[cyan]ℹ️  没有发现重复记录[/cyan]")
        
        print_stats(engine)
        
    except LedgerConsistencyError as e:
        console.print(f"[red]❌ {e.user_message}[/red]")
        console.print(f"[dim]💡 {e.suggestion}[/dim]")
    except Exception as e:
        handle_error(e)


@cli.command("fix-paths")
@click.pass_context
def fix_paths(ctx):
    """修复路径中的空格"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    try:
        with console.status("[cyan]正在修复路径空格...[/cyan]"):
            count, ids = engine.fix_path_spaces()
        
        if count > 0:
            console.print(f"[green]✅ 已修复 {count} 条路径空格问题[/green]")
        else:
            console.print("[cyan]ℹ️  没有发现路径空格问题[/cyan]")
        
        print_stats(engine)
        
    except Exception as e:
        handle_error(e)


@cli.command("merge-late")
@click.pass_context
def merge_late(ctx):
    """合并晚到附件"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    try:
        with console.status("[cyan]正在合并晚到附件...[/cyan]"):
            count, ids = engine.merge_late_arrivals()
        
        if count > 0:
            console.print(f"[green]✅ 已合并 {count} 条晚到附件[/green]")
        else:
            console.print("[cyan]ℹ️  没有可合并的晚到附件[/cyan]")
        
        print_stats(engine)
        
    except Exception as e:
        handle_error(e)


@cli.command("apply-corrections")
@click.pass_context
def apply_corrections(ctx):
    """应用人工更正"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    try:
        with console.status("[cyan]正在应用人工更正...[/cyan]"):
            count, ids = engine.apply_manual_corrections()
        
        if count > 0:
            console.print(f"[green]✅ 已应用 {count} 条人工更正[/green]")
        else:
            console.print("[cyan]ℹ️  没有可应用的人工更正[/cyan]")
        
        print_stats(engine)
        
    except Exception as e:
        handle_error(e)


@cli.command()
@click.pass_context
def clean(ctx):
    """执行完整清洗流程"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    
    try:
        with console.status("[cyan]正在执行完整清洗...[/cyan]"):
            results = engine.run_full_cleaning()
        
        console.print("\n[green]🎉 清洗完成！[/green]")
        for operation, (count, _) in results.items():
            icon = "✅" if count > 0 else "ℹ️"
            console.print(f"  {icon} {operation}：{count} 条")
        
        print_stats(engine)
        
    except Exception as e:
        handle_error(e)


@cli.command()
@click.argument("output_path", type=click.Path())
@click.pass_context
def export(ctx, output_path: str):
    """导出清洗后的数据和运行账本"""
    print_header()
    engine: CSVCleaningEngine = ctx.obj["engine"]
    context: CleaningContext = ctx.obj["context"]
    
    try:
        with console.status("[cyan]正在导出...[/cyan]"):
            data_file, ledger_file = engine.export_cleaned_data(output_path)
        
        console.print(f"[green]✅ 导出成功！[/green]")
        console.print(f"  📄 清洗后数据：{data_file}")
        console.print(f"  📒 运行账本：{ledger_file}")
        
        visible_count = len(context.get_visible_records())
        console.print(f"[dim]本次导出了 {visible_count} 条记录，{len(context.ledger)} 条账本记录[/dim]")
        
    except Exception as e:
        handle_error(e)


@cli.command("ledger")
@click.option("--limit", "-n", type=int, default=10, help="显示最近N条")
@click.pass_context
def show_ledger(ctx, limit: int):
    """查看运行账本"""
    print_header()
    context: CleaningContext = ctx.obj["context"]
    
    if not context.ledger:
        console.print("[yellow]⚠️  暂无操作记录[/yellow]")
        return
    
    entries = context.ledger[-limit:]
    
    table = Table(title=f"📒 运行账本 (最近{limit}条)", show_header=True, header_style="bold yellow")
    table.add_column("时间", style="dim", width=20)
    table.add_column("操作类型", width=12)
    table.add_column("操作人", width=10)
    table.add_column("影响数", justify="right")
    table.add_column("屏幕范围", width=16)
    table.add_column("筛选条件", overflow="fold")
    table.add_column("详情", overflow="fold")
    
    for entry in entries:
        entry_dict = entry.to_dict()
        table.add_row(
            entry_dict["操作时间"],
            entry_dict["操作类型"],
            entry_dict["操作人"],
            str(entry_dict["影响记录数"]),
            entry_dict["屏幕范围"],
            entry_dict["筛选条件"],
            entry_dict["操作详情"]
        )
    
    console.print(table)


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--output", "-o", required=True, help="输出文件路径")
@click.option("--force", "-f", is_flag=True, help="强制重新处理")
@click.option("--operator", "-u", default="运维同事", help="操作人姓名")
@click.pass_context
def batch(ctx, files: List[str], output: str, force: bool, operator: str):
    """一键批量处理：加载→清洗→导出，一条命令搞定"""
    print_header()
    
    context = create_context(operator)
    engine = CSVCleaningEngine(context)
    
    try:
        console.print(f"[cyan]📥 第一步：加载文件...[/cyan]")
        loaded, warnings = engine.load_csv_files(list(files), force=force)
        console.print(f"[green]✅ 加载 {loaded} 条记录[/green]")
        print_warnings(warnings)
        
        if loaded == 0:
            console.print("[yellow]⚠️  没有加载到任何记录，结束[/yellow]")
            return
        
        console.print(f"\n[cyan]🔄 第二步：执行清洗...[/cyan]")
        results = engine.run_full_cleaning()
        console.print("[green]✅ 清洗完成[/green]")
        for operation, (count, _) in results.items():
            if count > 0:
                console.print(f"  • {operation}：{count} 条")
        
        console.print(f"\n[cyan]📤 第三步：导出结果...[/cyan]")
        data_file, ledger_file = engine.export_cleaned_data(output)
        
        console.print("\n[green]🎉 批量处理完成！[/green]")
        console.print(f"  📄 清洗后数据：{data_file}")
        console.print(f"  📒 运行账本：{ledger_file}")
        
        print_stats(engine)
        
        console.print("\n[dim]💡 提示：运行账本里记录了每一步操作，对账不愁扯皮[/dim]")
        
    except DuplicateBatchError as e:
        console.print(f"[yellow]⚠️  {e.user_message}[/yellow]")
        console.print(f"[dim]💡 {e.suggestion}[/dim]")
    except Exception as e:
        handle_error(e)


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
