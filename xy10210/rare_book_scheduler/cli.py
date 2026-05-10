"""命令行接口"""
import json
import sys
from datetime import date, timedelta
from typing import List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .importer import import_books, import_exhibitions, import_restorers
from .models import ImportResult, ScheduleResult, ValidationIssue
from .scheduler import schedule_books
from .validator import parse_date


console = Console()


def print_import_summary(result: ImportResult, label: str):
    """打印导入结果摘要"""
    console.print(Panel.fit(
        f"[bold]{label} 导入结果[/bold]\n\n"
        f"[green]成功: {result.valid_rows} 行[/green]\n"
        f"[red]失败: {result.invalid_rows} 行[/red]\n"
        f"[yellow]总计: {result.total_rows} 行[/yellow]",
        title=f"[bold]{label} 导入[/bold]",
    ))
    
    errors = [i for i in result.issues if i.issue_type in ["missing_field", "invalid_value", "duplicate_id", "file_error"]]
    warnings = [i for i in result.issues if i.issue_type == "warning"]
    manual_review = [i for i in result.issues if i.requires_manual_review]
    
    if errors:
        error_table = Table(title="错误详情", show_lines=True)
        error_table.add_column("行号", style="cyan")
        error_table.add_column("字段", style="magenta")
        error_table.add_column("问题类型", style="red")
        error_table.add_column("原始值", style="yellow")
        error_table.add_column("描述", style="white")
        
        for issue in errors:
            error_table.add_row(
                str(issue.line_number) if issue.line_number > 0 else "N/A",
                issue.field_name or "N/A",
                issue.issue_type,
                issue.raw_value or "N/A",
                issue.message,
            )
        console.print(error_table)
    
    if warnings:
        warning_table = Table(title="警告详情（需人工确认）", show_lines=True)
        warning_table.add_column("行号", style="cyan")
        warning_table.add_column("字段", style="magenta")
        warning_table.add_column("原始值", style="yellow")
        warning_table.add_column("描述", style="white")
        
        for issue in warnings:
            warning_table.add_row(
                str(issue.line_number) if issue.line_number > 0 else "N/A",
                issue.field_name or "N/A",
                issue.raw_value or "N/A",
                issue.message,
            )
        console.print(warning_table)
    
    return len(errors) > 0


def print_schedule_result(result: ScheduleResult):
    """打印排程结果"""
    console.print(Panel.fit(
        f"[bold]排程结果汇总[/bold]\n\n"
        f"[green]成功排程: {result.scheduled_count} 项[/green]\n"
        f"[red]无法排程: {result.unscheduled_count} 项[/red]\n"
        f"[yellow]需人工确认: {result.manual_review_count} 项[/yellow]",
        title="[bold]排程结果[/bold]",
    ))
    
    if result.schedule:
        schedule_table = Table(title="已排程任务", show_lines=True)
        schedule_table.add_column("善本ID", style="cyan")
        schedule_table.add_column("书名", style="magenta")
        schedule_table.add_column("破损等级", style="yellow")
        schedule_table.add_column("修复师", style="green")
        schedule_table.add_column("开始日期", style="blue")
        schedule_table.add_column("结束日期", style="blue")
        
        for entry in sorted(result.schedule, key=lambda e: e.start_date):
            schedule_table.add_row(
                entry.book_id,
                entry.title,
                entry.damage_level.value,
                entry.restorer_name,
                str(entry.start_date),
                str(entry.end_date),
            )
        console.print(schedule_table)
    
    if result.conflicts:
        conflict_table = Table(title="冲突详情", show_lines=True)
        conflict_table.add_column("善本ID", style="cyan")
        conflict_table.add_column("冲突类型", style="red")
        conflict_table.add_column("冲突对象", style="magenta")
        conflict_table.add_column("描述", style="white")
        conflict_table.add_column("影响日期", style="yellow")
        
        for conflict in result.conflicts:
            date_range = ""
            if conflict.affected_date_range:
                date_range = f"{conflict.affected_date_range[0]} ~ {conflict.affected_date_range[1]}"
            conflict_table.add_row(
                conflict.book_id,
                conflict.conflict_type,
                conflict.conflicting_item_id,
                conflict.description,
                date_range,
            )
        console.print(conflict_table)
    
    if result.manual_review_items:
        review_table = Table(title="需人工确认的项目", show_lines=True)
        review_table.add_column("善本ID", style="cyan")
        review_table.add_column("书名", style="magenta")
        review_table.add_column("原因", style="yellow")
        
        for item in result.manual_review_items:
            review_table.add_row(
                item.get("book_id", "N/A"),
                item.get("title", "N/A"),
                item.get("reason", "N/A"),
            )
        console.print(review_table)


@click.group()
@click.version_option(version="1.0.0")
def main():
    """图书馆善本修复排程系统 CLI"""
    pass


@main.command()
@click.option("--books", "-b", required=True, type=click.Path(exists=True), help="善本数据文件 (CSV/JSON)")
@click.option("--restorers", "-r", required=True, type=click.Path(exists=True), help="修复师数据文件 (CSV/JSON)")
@click.option("--exhibitions", "-e", type=click.Path(exists=True), help="展览借调数据文件 (CSV/JSON)")
@click.option("--start-date", "-s", type=str, help="排程开始日期 (YYYY-MM-DD)，默认为今天")
@click.option("--output", "-o", type=click.Path(), help="输出排程结果到 JSON 文件")
@click.option("--json-output", is_flag=True, help="以 JSON 格式输出结果")
def schedule(books, restorers, exhibitions, start_date, output, json_output):
    """执行善本修复排程"""
    books_result = import_books(books)
    has_book_errors = print_import_summary(books_result, "善本数据")
    
    restorers_result = import_restorers(restorers)
    has_restorer_errors = print_import_summary(restorers_result, "修复师数据")
    
    exhibitions_result = None
    if exhibitions:
        exhibitions_result = import_exhibitions(exhibitions)
        print_import_summary(exhibitions_result, "展览借调数据")
    
    if has_book_errors or has_restorer_errors:
        console.print("\n[red]错误：关键数据导入失败，无法执行排程。请先修复上述错误。[/red]")
        sys.exit(1)
    
    if not books_result.records:
        console.print("\n[red]错误：没有有效的善本数据可供排程。[/red]")
        sys.exit(1)
    
    if not restorers_result.records:
        console.print("\n[red]错误：没有有效的修复师数据可供排程。[/red]")
        sys.exit(1)
    
    s_date = None
    if start_date:
        parsed = parse_date(start_date)
        if parsed:
            s_date = parsed
        else:
            console.print(f"\n[yellow]警告：无效的日期格式 '{start_date}'，将使用今天作为开始日期。[/yellow]")
    
    exhibition_list = exhibitions_result.records if exhibitions_result else []
    
    schedule_result = schedule_books(
        books=books_result.records,
        restorers=restorers_result.records,
        exhibitions=exhibition_list,
        start_date=s_date,
    )
    
    if json_output or output:
        output_data = {
            "import_summary": {
                "books": {
                    "total": books_result.total_rows,
                    "valid": books_result.valid_rows,
                    "invalid": books_result.invalid_rows,
                    "issues": [
                        {
                            "line_number": i.line_number,
                            "field": i.field_name,
                            "type": i.issue_type,
                            "raw_value": i.raw_value,
                            "message": i.message,
                            "requires_manual_review": i.requires_manual_review,
                        }
                        for i in books_result.issues
                    ],
                },
                "restorers": {
                    "total": restorers_result.total_rows,
                    "valid": restorers_result.valid_rows,
                    "invalid": restorers_result.invalid_rows,
                    "issues": [
                        {
                            "line_number": i.line_number,
                            "field": i.field_name,
                            "type": i.issue_type,
                            "raw_value": i.raw_value,
                            "message": i.message,
                            "requires_manual_review": i.requires_manual_review,
                        }
                        for i in restorers_result.issues
                    ],
                },
                "exhibitions": {
                    "total": exhibitions_result.total_rows if exhibitions_result else 0,
                    "valid": exhibitions_result.valid_rows if exhibitions_result else 0,
                    "invalid": exhibitions_result.invalid_rows if exhibitions_result else 0,
                    "issues": [
                        {
                            "line_number": i.line_number,
                            "field": i.field_name,
                            "type": i.issue_type,
                            "raw_value": i.raw_value,
                            "message": i.message,
                            "requires_manual_review": i.requires_manual_review,
                        }
                        for i in (exhibitions_result.issues if exhibitions_result else [])
                    ],
                } if exhibitions else None,
            },
            "schedule_result": {
                "scheduled_count": schedule_result.scheduled_count,
                "unscheduled_count": schedule_result.unscheduled_count,
                "manual_review_count": schedule_result.manual_review_count,
                "schedule": [
                    {
                        "book_id": e.book_id,
                        "title": e.title,
                        "restorer_id": e.restorer_id,
                        "restorer_name": e.restorer_name,
                        "start_date": str(e.start_date),
                        "end_date": str(e.end_date),
                        "damage_level": e.damage_level.value,
                        "notes": e.notes,
                    }
                    for e in schedule_result.schedule
                ],
                "conflicts": [
                    {
                        "book_id": c.book_id,
                        "conflict_type": c.conflict_type,
                        "conflicting_item_id": c.conflicting_item_id,
                        "description": c.description,
                        "affected_date_range": (
                            [str(d) for d in c.affected_date_range]
                            if c.affected_date_range else None
                        ),
                    }
                    for c in schedule_result.conflicts
                ],
                "manual_review_items": schedule_result.manual_review_items,
            },
        }
        
        if output:
            with open(output, "w", encoding="utf-8") as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            console.print(f"\n[green]结果已保存到: {output}[/green]")
        
        if json_output:
            console.print(json.dumps(output_data, ensure_ascii=False, indent=2))
    else:
        print_schedule_result(schedule_result)


@main.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--type", "-t", "data_type", required=True, type=click.Choice(["books", "restorers", "exhibitions"]), help="数据类型")
def validate(file_path, data_type):
    """验证数据文件格式和内容"""
    if data_type == "books":
        result = import_books(file_path)
        label = "善本数据"
    elif data_type == "restorers":
        result = import_restorers(file_path)
        label = "修复师数据"
    else:
        result = import_exhibitions(file_path)
        label = "展览借调数据"
    
    has_errors = print_import_summary(result, label)
    
    if has_errors:
        sys.exit(1)
    else:
        console.print(f"\n[green]{label} 验证通过！[/green]")


@main.command()
def show_rules():
    """显示排程规则说明"""
    console.print(Panel.fit(
        "[bold]图书馆善本修复排程规则[/bold]\n\n"
        "[cyan]1. 优先级规则[/cyan]\n"
        "   - 破损等级决定处理优先级：CRITICAL > HIGH > MEDIUM > LOW\n"
        "   - 高等级善本优先分配修复资源\n\n"
        "[cyan]2. 修复师能力约束[/cyan]\n"
        "   - 修复师必须具备善本所需的所有技能\n"
        "   - 修复师的最高可处理等级必须 >= 善本破损等级\n"
        "   - 修复师休假期间不可分配任务\n"
        "   - 同一修复师同一时间只能处理一项任务\n\n"
        "[cyan]3. 展览借调冲突[/cyan]\n"
        "   - 善本在展览借调期间不可进行修复\n"
        "   - 排程会自动避开展览时间段\n\n"
        "[cyan]4. 问题处理[/cyan]\n"
        "   - 严重错误（必填字段缺失、无效值）：记录并跳过\n"
        "   - 警告（默认值使用）：记录并标记需人工确认\n"
        "   - 无法排程的任务：进入需人工确认列表\n"
        "   - 所有问题保留来源文件和行号信息",
        title="[bold]排程规则[/bold]",
    ))


if __name__ == "__main__":
    main()
