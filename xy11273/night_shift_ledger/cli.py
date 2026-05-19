import click
import csv
import json
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .database import db
from .importers import import_vehicles_csv, import_charging_stations_json, import_tasks_json


console = Console()


@click.group()
def cli():
    pass


@cli.command()
def dashboard():
    stats = db.get_dashboard_stats()
    
    grid = Table.grid(expand=True)
    grid.add_column()
    grid.add_column()
    
    grid.add_row(
        Panel(f"[bold cyan]{stats['total_sessions']}[/]", title="导入会话", border_style="blue"),
        Panel(f"[bold green]{stats['total_vehicles']}[/]", title="车辆记录", border_style="green")
    )
    grid.add_row(
        Panel(f"[bold yellow]{stats['total_stations']}[/]", title="充电桩", border_style="yellow"),
        Panel(f"[bold magenta]{stats['total_tasks']}[/]", title="任务单", border_style="magenta")
    )
    grid.add_row(
        Panel(f"[bold red]{stats['pending_errors']}[/]", title="待处理错误", border_style="red"),
        Panel("night-shift-ledger", title="版本", border_style="white")
    )
    
    console.print(Panel(grid, title="[bold]仓库夜班台账管理系统[/]", border_style="cyan"))


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
def import_vehicles(file_path):
    result = import_vehicles_csv(file_path)
    console.print(f"\n[green]导入完成![/] 会话ID: [cyan]{result['session_id']}[/]")
    console.print(f"  总计: {result['total']} 条")
    console.print(f"  成功: [green]{result['success']}[/] 条")
    console.print(f"  错误: [red]{result['errors']}[/] 条\n")


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
def import_stations(file_path):
    result = import_charging_stations_json(file_path)
    console.print(f"\n[green]导入完成![/] 会话ID: [cyan]{result['session_id']}[/]")
    console.print(f"  总计: {result['total']} 条")
    console.print(f"  成功: [green]{result['success']}[/] 条")
    console.print(f"  错误: [red]{result['errors']}[/] 条\n")


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
def import_tasks(file_path):
    result = import_tasks_json(file_path)
    console.print(f"\n[green]导入完成![/] 会话ID: [cyan]{result['session_id']}[/]")
    console.print(f"  总计: {result['total']} 条")
    console.print(f"  成功: [green]{result['success']}[/] 条")
    console.print(f"  错误: [red]{result['errors']}[/] 条\n")


@cli.command("list-vehicles")
@click.option("--session-id", type=int, help="指定会话ID")
def list_vehicles(session_id):
    vehicles = db.get_vehicles(session_id)
    
    table = Table(title="车辆记录", border_style="blue")
    table.add_column("ID", style="cyan")
    table.add_column("车牌号", style="green")
    table.add_column("电量(%)", style="yellow")
    table.add_column("司机", style="magenta")
    table.add_column("签到时间", style="white")
    
    for v in vehicles:
        table.add_row(
            str(v["id"]),
            v["plate_number"],
            f"{v['battery_level']:.1f}",
            v["driver_name"] or "-",
            v["checkin_time"] or "-"
        )
    
    console.print(table)


@cli.command("list-stations")
@click.option("--session-id", type=int, help="指定会话ID")
def list_stations(session_id):
    stations = db.get_charging_stations(session_id)
    
    table = Table(title="充电桩状态", border_style="yellow")
    table.add_column("ID", style="cyan")
    table.add_column("充电桩号", style="green")
    table.add_column("占用", style="yellow")
    table.add_column("车辆", style="magenta")
    table.add_column("功率(kW)", style="blue")
    
    for s in stations:
        status = "[red]是[/]" if s["is_occupied"] else "[green]否[/]"
        table.add_row(
            str(s["id"]),
            s["station_id"],
            status,
            s["vehicle_plate"] or "-",
            f"{s['power_kw']:.1f}" if s["power_kw"] else "-"
        )
    
    console.print(table)


@cli.command("list-tasks")
@click.option("--session-id", type=int, help="指定会话ID")
def list_tasks(session_id):
    tasks = db.get_tasks(session_id)
    
    table = Table(title="任务单", border_style="magenta")
    table.add_column("ID", style="cyan")
    table.add_column("任务号", style="green")
    table.add_column("类型", style="yellow")
    table.add_column("优先级", style="red")
    table.add_column("负责人", style="magenta")
    table.add_column("描述", style="white")
    
    for t in tasks:
        priority_color = {
            "low": "green",
            "normal": "yellow",
            "high": "orange",
            "urgent": "red"
        }.get(t["priority"], "white")
        
        table.add_row(
            str(t["id"]),
            t["task_id"],
            t["task_type"],
            f"[{priority_color}]{t['priority']}[/{priority_color}]",
            t["assignee"] or "-",
            (t["description"] or "-")[:30]
        )
    
    console.print(table)


@cli.command()
@click.option("--session-id", type=int, help="指定会话ID")
@click.option("--include-resolved", is_flag=True, help="包含已解决的错误")
def errors(session_id, include_resolved):
    error_list = db.get_errors(session_id, include_resolved)
    
    if not error_list:
        console.print("[green]没有待处理的错误记录[/]")
        return
    
    table = Table(title="错误记录", border_style="red")
    table.add_column("ID", style="cyan")
    table.add_column("行号", style="yellow")
    table.add_column("类型", style="green")
    table.add_column("错误信息", style="red", max_width=40)
    table.add_column("建议", style="blue", max_width=30)
    table.add_column("状态", style="magenta")
    
    for e in error_list:
        status = "[green]已解决[/]" if e["is_resolved"] else "[red]待处理[/]"
        table.add_row(
            str(e["id"]),
            str(e["row_number"]),
            e["source_type"],
            e["error_message"],
            e["suggestion"] or "-",
            status
        )
    
    console.print(table)


@cli.command("show-error")
@click.argument("error_id", type=int)
def show_error(error_id):
    error_list = db.get_errors(include_resolved=True)
    target = next((e for e in error_list if e["id"] == error_id), None)
    
    if not target:
        console.print(f"[red]未找到错误记录 ID: {error_id}[/]")
        return
    
    console.print(Panel(f"[bold red]错误详情 ID: {error_id}[/]", border_style="red"))
    console.print(f"\n  数据源类型: [cyan]{target['source_type']}[/]")
    console.print(f"  原始行号: [yellow]{target['row_number']}[/]")
    console.print(f"\n  原始数据:")
    raw_data = json.loads(target["raw_data"])
    console.print_json(json.dumps(raw_data, ensure_ascii=False, indent=2))
    console.print(f"\n  错误信息: [red]{target['error_message']}[/]")
    console.print(f"  修改建议: [blue]{target['suggestion'] or '无'}[/]")
    console.print(f"  状态: {'[green]已解决[/]' if target['is_resolved'] else '[red]待处理[/]'}\n")


@cli.command("resolve-error")
@click.argument("error_id", type=int)
def resolve_error(error_id):
    db.resolve_error(error_id)
    console.print(f"[green]错误记录 ID: {error_id} 已标记为已解决[/]")


@cli.command()
def history():
    sessions = db.get_sessions()
    
    table = Table(title="导入历史", border_style="cyan")
    table.add_column("ID", style="cyan")
    table.add_column("类型", style="green")
    table.add_column("文件", style="blue", max_width=40)
    table.add_column("时间", style="yellow")
    table.add_column("总计", style="white")
    table.add_column("成功", style="green")
    table.add_column("错误", style="red")
    
    for s in sessions:
        table.add_row(
            str(s["id"]),
            s["source_type"],
            Path(s["source_file"]).name,
            s["imported_at"],
            str(s["total_records"]),
            str(s["success_count"]),
            str(s["error_count"])
        )
    
    console.print(table)


@cli.command()
@click.argument("output_dir", type=click.Path(), default=".")
def export(output_dir):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    vehicles = db.get_vehicles()
    stations = db.get_charging_stations()
    tasks = db.get_tasks()
    errors = db.get_errors()
    
    with open(out_path / "vehicles_export.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "plate_number", "battery_level", "driver_name", "checkin_time", "created_at"])
        for v in vehicles:
            writer.writerow([v["id"], v["plate_number"], v["battery_level"], v["driver_name"], v["checkin_time"], v["created_at"]])
    
    with open(out_path / "stations_export.json", "w", encoding="utf-8") as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    
    with open(out_path / "tasks_export.json", "w", encoding="utf-8") as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)
    
    with open(out_path / "errors_export.json", "w", encoding="utf-8") as f:
        json.dump(errors, f, ensure_ascii=False, indent=2)
    
    console.print(f"[green]导出完成! 文件已保存到: {out_path.absolute()}[/]")
    console.print(f"  - vehicles_export.csv ({len(vehicles)} 条)")
    console.print(f"  - stations_export.json ({len(stations)} 条)")
    console.print(f"  - tasks_export.json ({len(tasks)} 条)")
    console.print(f"  - errors_export.json ({len(errors)} 条)\n")


@cli.command()
@click.option("--yes", is_flag=True, help="确认清除")
def reset(yes):
    global db
    from .database import Database
    
    if not yes:
        click.confirm("确定要清除所有数据吗？此操作不可恢复!", abort=True)
    
    db_path = db.db_path
    if db_path.exists():
        db_path.unlink()
    
    db = Database()
    
    console.print("[green]数据库已重置[/]")


if __name__ == "__main__":
    cli()
