import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List
import shutil

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.align import Align
from rich import print as rprint

from .database import DatabaseManager
from .services import RepairService, ImportService
from .sample_data import generate_sample_csvs, populate_sample_data
from .models import (
    RepairStatus, ResponsibilityType, FollowUpResult
)

app = typer.Typer(
    name="dorm-repair",
    help="校园宿舍维修管理 CLI 工具",
    add_completion=False,
    no_args_is_help=True
)

console = Console()
DEFAULT_DATA_DIR = Path(os.environ.get('DORM_REPAIR_DIR', './.dorm-repair-data'))


def get_db(data_dir: Optional[Path] = None) -> DatabaseManager:
    base = data_dir or DEFAULT_DATA_DIR
    return DatabaseManager(base)


def ensure_db_exists(data_dir: Optional[Path] = None):
    db = get_db(data_dir)
    if not db.exists():
        console.print(f"[red]错误: 数据库不存在。请先运行 `dorm-repair init` 初始化。[/red]")
        raise typer.Exit(code=1)
    return db


def _status_color(status: RepairStatus) -> str:
    colors = {
        RepairStatus.SUBMITTED: 'yellow',
        RepairStatus.ASSIGNED: 'blue',
        RepairStatus.IN_PROGRESS: 'cyan',
        RepairStatus.COMPLETED: 'magenta',
        RepairStatus.FOLLOWED_UP: 'green',
        RepairStatus.CLOSED: 'dim',
        RepairStatus.REPEAT: 'bold red',
    }
    return colors.get(status, 'white')


def _responsibility_color(resp: ResponsibilityType) -> str:
    colors = {
        ResponsibilityType.NATURAL_DAMAGE: 'green',
        ResponsibilityType.STUDENT_RESPONSIBLE: 'red',
        ResponsibilityType.UNDETERMINED: 'yellow',
    }
    return colors.get(resp, 'white')


@app.command()
def init(
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    with_sample: bool = typer.Option(False, '--with-sample', '-s', help='加载演示数据'),
    force: bool = typer.Option(False, '--force', '-f', help='覆盖已存在的数据库'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """初始化维修管理系统数据库"""
    base = data_dir or DEFAULT_DATA_DIR
    db = DatabaseManager(base)
    
    if db.exists() and not force:
        console.print("[yellow]数据库已存在。使用 --force 覆盖。[/yellow]")
        raise typer.Exit(code=1)
    
    if force and db.exists():
        db.close()
        db.db_path.unlink()
        db = DatabaseManager(base)
    
    db.initialize()
    console.print(f"[green]数据库初始化成功: {db.db_path}[/green]")
    
    generate_sample_csvs(base / 'sample-data')
    console.print(f"[green]样例 CSV 文件已生成: {base / 'sample-data'}[/green]")
    
    if with_sample:
        try:
            generate_sample_csvs(base / 'import-csvs')
            import_svc = ImportService(db)
            
            import_svc.import_csv('dormitories', base / 'import-csvs' / 'dormitories.csv', operator)
            import_svc.import_csv('repair_persons', base / 'import-csvs' / 'repair_persons.csv', operator)
            import_svc.import_csv('materials', base / 'import-csvs' / 'materials.csv', operator)
            
            populate_sample_data(db)
            console.print("[green]演示数据已加载[/green]")
        except Exception as e:
            console.print(f"[red]加载演示数据失败: {e}[/red]")
            import traceback
            traceback.print_exc()
    
    db.close()
    console.print("\n[bold]完成！[/bold] 运行 `dorm-repair check` 查看数据状态。")


@app.command()
def import_csv(
    file_type: str = typer.Argument(..., help='文件类型: dormitories|repair_persons|materials|repair_orders|material_usage'),
    csv_path: Path = typer.Argument(..., help='CSV 文件路径'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """从 CSV 导入数据"""
    valid_types = ['dormitories', 'repair_persons', 'materials', 'repair_orders', 'material_usage']
    if file_type not in valid_types:
        console.print(f"[red]无效的文件类型。有效值: {', '.join(valid_types)}[/red]")
        raise typer.Exit(code=1)
    
    db = ensure_db_exists(data_dir)
    
    try:
        import_svc = ImportService(db)
        record = import_svc.import_csv(file_type, csv_path, operator)
        
        table = Table(title=f"导入结果 - {file_type}", show_header=True)
        table.add_column("项目", style="cyan")
        table.add_column("数值", style="white")
        table.add_row("文件", str(csv_path))
        table.add_row("总数", str(record.total_count))
        table.add_row("成功", f"[green]{record.success_count}[/green]")
        table.add_row("失败", f"[red]{record.failed_count}[/red]")
        console.print(table)
        
        if record.errors:
            err_table = Table(title="失败详情", show_header=True)
            err_table.add_column("行号", style="red")
            err_table.add_column("错误", style="red")
            err_table.add_column("数据", style="dim", max_width=40)
            for err in record.errors[:5]:
                err_table.add_row(str(err['row']), err['error'], str(err.get('data', '')))
            console.print(err_table)
            if len(record.errors) > 5:
                console.print(f"...还有 {len(record.errors) - 5} 条错误")
    finally:
        db.close()


@app.command()
def list_orders(
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    status: Optional[str] = typer.Option(None, '--status', '-s', help='状态过滤'),
    building: Optional[str] = typer.Option(None, '--building', '-b', help='楼栋过滤'),
):
    """列出所有维修单"""
    db = ensure_db_exists(data_dir)
    
    try:
        status_enum = None
        if status:
            try:
                status_enum = RepairStatus(status)
            except ValueError:
                console.print(f"[red]无效状态。有效值: {[s.value for s in RepairStatus]}[/red]")
                raise typer.Exit(code=1)
        
        orders = db.list_repair_orders(status=status_enum, building=building)
        
        if not orders:
            console.print("[yellow]没有找到维修单[/yellow]")
            return
        
        table = Table(title="维修单列表", show_header=True)
        table.add_column("单号", style="cyan", no_wrap=True)
        table.add_column("宿舍", style="blue")
        table.add_column("类别", style="magenta")
        table.add_column("状态", style="bold")
        table.add_column("责任", style="bold")
        table.add_column("报修人", style="white")
        table.add_column("提交时间", style="white", max_width=20)
        table.add_column("重复", style="red")
        
        for o in orders:
            status_style = _status_color(o.status)
            resp_style = _responsibility_color(o.responsibility)
            
            table.add_row(
                o.order_id,
                o.dorm_id,
                o.category or 'other',
                f"[{status_style}]{o.status.value}[/{status_style}]",
                f"[{resp_style}]{o.responsibility.value}[/{resp_style}]",
                o.reporter,
                o.submit_time.strftime("%m-%d %H:%M"),
                "[red]是[/red]" if o.is_repeat else "[dim]否[/dim]"
            )
        
        console.print(table)
        console.print(f"共 {len(orders)} 条维修单")
    finally:
        db.close()


@app.command()
def check(
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
):
    """运行数据检查，发现问题"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        result = service.run_checks()
        
        summary = Panel(
            f"[cyan]总单数:[/cyan] {result['total_orders']}\n"
            f"[green]已关闭:[/green] {result['closed_orders']}\n"
            f"[yellow]进行中:[/yellow] {result['open_orders']}\n",
            title="总体状态"
        )
        console.print(summary)
        
        if result['warnings']:
            warn_table = Table(title="⚠️  警告", show_header=True)
            warn_table.add_column("类型", style="yellow")
            warn_table.add_column("单号", style="cyan")
            warn_table.add_column("宿舍", style="blue")
            warn_table.add_column("信息", style="white")
            for w in result['warnings']:
                warn_table.add_row(w['type'], w['order_id'], w['dorm_id'], w['message'])
            console.print(warn_table)
        
        if result['issues']:
            issue_table = Table(title="❌  问题", show_header=True)
            issue_table.add_column("类型", style="red")
            issue_table.add_column("单号", style="cyan")
            issue_table.add_column("宿舍", style="blue")
            issue_table.add_column("信息", style="white")
            for i in result['issues']:
                issue_table.add_row(i['type'], i['order_id'], i['dorm_id'], i['message'])
            console.print(issue_table)
        
        if result['low_stock_materials']:
            stock_table = Table(title="📦 库存预警", show_header=True)
            stock_table.add_column("材料ID", style="red")
            stock_table.add_column("名称", style="white")
            stock_table.add_column("当前", style="red")
            stock_table.add_column("最低", style="yellow")
            for m in result['low_stock_materials']:
                stock_table.add_row(m['material_id'], m['name'], f"{m['current']}{m['unit']}", f"{m['min']}{m['unit']}")
            console.print(stock_table)
        
        if result['needs_counselor_followup']:
            cf_table = Table(title="👨‍🏫 辅导员跟进", show_header=True)
            cf_table.add_column("单号", style="cyan")
            cf_table.add_column("楼栋-房间", style="blue")
            cf_table.add_column("辅导员", style="magenta")
            cf_table.add_column("费用", style="red")
            cf_table.add_column("报修人", style="white")
            for c in result['needs_counselor_followup']:
                cf_table.add_row(
                    c['order_id'],
                    f"{c['building']}-{c['room']}",
                    c['counselor'],
                    f"¥{c['fee']:.2f}",
                    c['reporter']
                )
            console.print(cf_table)
        
        if not result['warnings'] and not result['issues'] and not result['low_stock_materials']:
            console.print("[green]✓ 所有检查通过！[/green]")
    finally:
        db.close()


@app.command()
def detail(
    order_id: str = typer.Argument(..., help='维修单号'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    show_history: bool = typer.Option(True, '--history/--no-history', help='显示历史记录'),
    show_audit: bool = typer.Option(False, '--audit', help='显示审计日志'),
):
    """查看维修单详情"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        info = service.get_order_detail(order_id)
        
        if not info:
            console.print(f"[red]维修单 {order_id} 不存在[/red]")
            raise typer.Exit(code=1)
        
        order = info['order']
        dorm = info['dormitory']
        person = info['repair_person']
        
        status_style = _status_color(order.status)
        resp_style = _responsibility_color(order.responsibility)
        
        info_panel = Panel(
            f"[cyan]单号:[/cyan] {order.order_id}\n"
            f"[cyan]状态:[/cyan] [{status_style}]{order.status.value}[/{status_style}]\n"
            f"[cyan]责任:[/cyan] [{resp_style}]{order.responsibility.value}[/{resp_style}]\n"
            f"[cyan]类别:[/cyan] {order.category or 'other'}\n"
            f"[cyan]重复:[/cyan] {'是 -> ' + (order.original_order_id or '') if order.is_repeat else '否'}\n\n"
            f"[cyan]宿舍:[/cyan] {order.dorm_id}"
            + (f" ({dorm.building} {dorm.room_number})" if dorm else '') + "\n"
            f"[cyan]辅导员:[/cyan] {dorm.counselor if dorm else 'N/A'}\n"
            f"[cyan]报修人:[/cyan] {order.reporter} ({order.reporter_phone})\n"
            f"[cyan]描述:[/cyan] {order.description}\n\n"
            f"[cyan]提交:[/cyan] {order.submit_time.strftime('%Y-%m-%d %H:%M')}\n"
            f"[cyan]开始:[/cyan] {order.start_time.strftime('%Y-%m-%d %H:%M') if order.start_time else '-'}\n"
            f"[cyan]完成:[/cyan] {order.complete_time.strftime('%Y-%m-%d %H:%M') if order.complete_time else '-'}\n"
            f"[cyan]回访:[/cyan] {order.follow_up_time.strftime('%Y-%m-%d %H:%M') if order.follow_up_time else '-'}\n"
            f"[cyan]关闭:[/cyan] {order.close_time.strftime('%Y-%m-%d %H:%M') if order.close_time else '-'}\n\n"
            f"[cyan]维修人员:[/cyan] {person.name if person else '未分配'}"
            + (f" ({order.assigned_to})" if order.assigned_to else '') + "\n"
            f"[cyan]回访结果:[/cyan] {order.follow_up_result.value}\n"
            f"[cyan]回访备注:[/cyan] {order.follow_up_remarks or '-'}\n"
            f"[cyan]学生费用:[/cyan] [red]¥{order.student_fee:.2f}[/red]\n"
            f"[cyan]材料成本:[/cyan] ¥{info['total_material_cost']:.2f}\n",
            title=f"维修单详情 - {order.order_id}"
        )
        console.print(info_panel)
        
        if info['material_usages']:
            mat_table = Table(title="材料使用", show_header=True)
            mat_table.add_column("材料", style="cyan")
            mat_table.add_column("数量", style="white")
            mat_table.add_column("单价", style="white")
            mat_table.add_column("总价", style="red")
            mat_table.add_column("操作人", style="dim")
            mat_table.add_column("时间", style="dim")
            for m in info['material_usages']:
                mat_table.add_row(
                    m.material_name,
                    f"{m.quantity}",
                    f"¥{m.unit_price:.2f}",
                    f"¥{m.total_cost:.2f}",
                    m.operator,
                    m.timestamp.strftime("%m-%d %H:%M") if hasattr(m.timestamp, 'strftime') else str(m.timestamp)
                )
            console.print(mat_table)
        
        if order.repairs:
            repair_panel = Panel(
                "\n".join(f"  • {r}" for r in order.repairs),
                title="维修内容"
            )
            console.print(repair_panel)
        
        if show_history and order.history:
            hist_table = Table(title="历史记录", show_header=True)
            hist_table.add_column("时间", style="cyan")
            hist_table.add_column("动作", style="magenta")
            hist_table.add_column("状态", style="bold")
            hist_table.add_column("操作人", style="dim")
            hist_table.add_column("详情", style="white", max_width=50)
            for h in order.history:
                hist_table.add_row(
                    h['timestamp'][:16] if 'T' in str(h['timestamp']) else str(h['timestamp']),
                    h['action'],
                    h.get('status', '-'),
                    h['operator'],
                    h.get('details', '')
                )
            console.print(hist_table)
        
        if show_audit and info['audit_logs']:
            audit_table = Table(title="审计日志", show_header=True)
            audit_table.add_column("时间", style="cyan")
            audit_table.add_column("动作", style="magenta")
            audit_table.add_column("操作人", style="dim")
            audit_table.add_column("原因", style="yellow")
            audit_table.add_column("变更", style="white")
            for log in info['audit_logs']:
                changes = ""
                if log.before and log.after:
                    before = log.before.get('status', '-')
                    after = log.after.get('status', '-')
                    if before != after:
                        changes = f"{before} → {after}"
                audit_table.add_row(
                    log.timestamp.strftime("%m-%d %H:%M") if hasattr(log.timestamp, 'strftime') else str(log.timestamp),
                    log.action,
                    log.operator,
                    log.reason or '-',
                    changes or '-'
                )
            console.print(audit_table)
    finally:
        db.close()


@app.command()
def assign(
    order_id: str = typer.Argument(..., help='维修单号'),
    staff_id: str = typer.Argument(..., help='维修人员ID'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """分配维修人员"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.assign_order(order_id, staff_id, operator)
        console.print(f"[green]✓ 维修单 {order_id} 已分配给 {order.assigned_to}[/green]")
        console.print(f"  当前状态: {order.status.value}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def start(
    order_id: str = typer.Argument(..., help='维修单号'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """开始维修"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.start_repair(order_id, operator)
        console.print(f"[green]✓ 维修已开始，当前状态: {order.status.value}[/green]")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def add_material(
    order_id: str = typer.Argument(..., help='维修单号'),
    material_id: str = typer.Argument(..., help='材料ID'),
    quantity: float = typer.Argument(..., help='数量'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """添加维修材料"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order, usage = service.add_material(order_id, material_id, quantity, operator)
        console.print(
            f"[green]✓ 已添加材料: {usage.material_name} x {usage.quantity} = ¥{usage.total_cost:.2f}[/green]"
        )
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def complete(
    order_id: str = typer.Argument(..., help='维修单号'),
    repairs: List[str] = typer.Argument(..., help='维修内容描述（可多个）'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """完成维修"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.complete_repair(order_id, list(repairs), operator)
        console.print(f"[green]✓ 维修完成，当前状态: {order.status.value}[/green]")
        console.print(f"  学生费用: ¥{order.student_fee:.2f}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def followup(
    order_id: str = typer.Argument(..., help='维修单号'),
    result: str = typer.Argument(..., help='回访结果: satisfied|needs_rework|unconfirmed'),
    remarks: str = typer.Option("", '--remarks', '-r', help='回访备注'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """回访"""
    try:
        result_enum = FollowUpResult(result)
    except ValueError:
        console.print(f"[red]无效的回访结果。有效值: {[r.value for r in FollowUpResult][:-1]}[/red]")
        raise typer.Exit(code=1)
    
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.do_follow_up(order_id, result_enum, remarks, operator)
        console.print(f"[green]✓ 回访完成，当前状态: {order.status.value}[/green]")
        console.print(f"  回访结果: {order.follow_up_result.value}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def close(
    order_id: str = typer.Argument(..., help='维修单号'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """关闭维修单（需已完成回访）"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.close_order(order_id, operator)
        console.print(f"[green]✓ 维修单已关闭[/green]")
        console.print(f"  关闭时间: {order.close_time.strftime('%Y-%m-%d %H:%M')}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def update_responsibility(
    order_id: str = typer.Argument(..., help='维修单号'),
    responsibility: str = typer.Argument(..., help='责任类型: natural_damage|student_responsible|undetermined'),
    reason: str = typer.Argument(..., help='修改原因'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    operator: str = typer.Option("cli-user", '--operator', '-o', help='操作者标识'),
):
    """人工修改责任类型（留痕）"""
    try:
        resp_enum = ResponsibilityType(responsibility)
    except ValueError:
        console.print(f"[red]无效的责任类型。有效值: {[r.value for r in ResponsibilityType]}[/red]")
        raise typer.Exit(code=1)
    
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        order = service.manual_update_responsibility(order_id, resp_enum, reason, operator)
        console.print(f"[green]✓ 责任类型已更新为: {order.responsibility.value}[/green]")
        console.print(f"  学生费用: ¥{order.student_fee:.2f}")
        console.print(f"  修改原因: {reason}")
        console.print(f"  操作人: {operator}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")
        raise typer.Exit(code=1)
    finally:
        db.close()


@app.command()
def report(
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
    output_json: Optional[Path] = typer.Option(None, '--json', '-j', help='输出 JSON 到文件'),
    brief: bool = typer.Option(False, '--brief', '-b', help='只显示摘要'),
):
    """生成维修汇总报告"""
    db = ensure_db_exists(data_dir)
    
    try:
        service = RepairService(db)
        report_data = service.generate_report()
        
        if output_json:
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(report_data, f, ensure_ascii=False, indent=2, default=str)
            console.print(f"[green]✓ JSON 报告已写入 {output_json}[/green]")
        
        summary = report_data['summary']
        summary_panel = Panel(
            f"[cyan]总单数:[/cyan] {summary['total_orders']}\n"
            f"[green]已关闭:[/green] {summary['closed']}\n"
            f"[cyan]进行中:[/cyan] {summary['in_progress']}\n"
            f"[yellow]待分配/已分配:[/yellow] {summary['pending']}\n"
            f"[magenta]待回访:[/magenta] {summary['followup_needed']}\n"
            f"[red]重复报修:[/red] {summary['repeat_orders']}\n",
            title="📊 维修汇总"
        )
        console.print(summary_panel)
        
        if not brief and report_data['by_building']:
            bldg_table = Table(title="按楼栋统计", show_header=True)
            bldg_table.add_column("楼栋", style="cyan")
            bldg_table.add_column("总数", style="white")
            bldg_table.add_column("已关", style="green")
            bldg_table.add_column("自然", style="green")
            bldg_table.add_column("学生责", style="red")
            bldg_table.add_column("待定", style="yellow")
            bldg_table.add_column("材料成本", style="magenta")
            bldg_table.add_column("学生费用", style="red")
            bldg_table.add_column("房间数", style="white")
            for bldg, data in report_data['by_building'].items():
                bldg_table.add_row(
                    bldg,
                    str(data['total']),
                    str(data['closed']),
                    str(data['natural_damage']),
                    str(data['student_responsible']),
                    str(data['undetermined']),
                    f"¥{data['material_cost']:.2f}",
                    f"¥{data['student_fees']:.2f}",
                    str(data['unique_rooms'])
                )
            console.print(bldg_table)
        
        if not brief:
            resp = report_data['by_responsibility']
            resp_panel = Panel(
                f"[green]自然损坏:[/green] {resp['natural_damage']['count']} 单, 成本 ¥{resp['natural_damage']['cost']:.2f}, 已关 {resp['natural_damage']['closed']}\n"
                f"[red]学生责任:[/red] {resp['student_responsible']['count']} 单, 成本 ¥{resp['student_responsible']['cost']:.2f}, 收费 ¥{resp['student_responsible']['fees']:.2f}, 已关 {resp['student_responsible']['closed']}\n"
                f"[yellow]待定:[/yellow] {resp['undetermined']['count']} 单, 成本 ¥{resp['undetermined']['cost']:.2f}, 已关 {resp['undetermined']['closed']}\n",
                title="按责任类型统计"
            )
            console.print(resp_panel)
        
        if not brief:
            times = report_data['processing_times']
            if times['count'] > 0:
                time_panel = Panel(
                    f"[cyan]已统计:[/cyan] {times['count']} 单\n"
                    f"[cyan]平均时长:[/cyan] {times['avg_hours']} 小时\n"
                    f"[green]最短:[/green] {times['min_hours']} 小时\n"
                    f"[yellow]最长:[/yellow] {times['max_hours']} 小时\n",
                    title="⏱️  维修时长"
                )
                console.print(time_panel)
        
        if not brief:
            costs = report_data['material_costs']
            cost_panel = Panel(
                f"[cyan]总材料成本:[/cyan] ¥{costs['total_cost']:.2f}\n",
                title="💰 材料成本"
            )
            console.print(cost_panel)
        
        if report_data['unclosed_items']:
            unclosed_table = Table(title="⚠️  未闭环事项", show_header=True)
            unclosed_table.add_column("单号", style="cyan")
            unclosed_table.add_column("楼栋-房间", style="blue")
            unclosed_table.add_column("状态", style="bold")
            unclosed_table.add_column("责任", style="bold")
            unclosed_table.add_column("等待天数", style="red")
            unclosed_table.add_column("报修人", style="white")
            unclosed_table.add_column("描述", style="dim", max_width=30)
            for item in report_data['unclosed_items'][:10]:
                unclosed_table.add_row(
                    item['order_id'],
                    f"{item['building']}-{item['room']}",
                    item['status'],
                    item['responsibility'],
                    f"[red]{item['days_waiting']}[/red]",
                    item['reporter'],
                    item['description']
                )
            console.print(unclosed_table)
            if len(report_data['unclosed_items']) > 10:
                console.print(f"...还有 {len(report_data['unclosed_items']) - 10} 条")
        
        if report_data['counselor_actions']:
            action_table = Table(title="👨‍🏫 辅导员需跟进（学生责任）", show_header=True)
            action_table.add_column("单号", style="cyan")
            action_table.add_column("楼栋-房间", style="blue")
            action_table.add_column("辅导员", style="magenta")
            action_table.add_column("费用", style="red")
            action_table.add_column("报修人", style="white")
            action_table.add_column("描述", style="dim", max_width=30)
            for c in report_data['counselor_actions']:
                action_table.add_row(
                    c['order_id'],
                    f"{c['building']}-{c['room']}",
                    c['counselor'],
                    f"¥{c['fee']:.2f}",
                    c['reporter'],
                    c['description']
                )
            console.print(action_table)
        
        closed_rate = 0
        if summary['total_orders'] > 0:
            closed_rate = summary['closed'] / summary['total_orders'] * 100
        
        all_closed = (
            len(report_data['unclosed_items']) == 0 and
            summary['followup_needed'] == 0
        )
        
        rate_color = 'green' if closed_rate >= 90 else ('yellow' if closed_rate >= 70 else 'red')
        console.print(f"\n[bold]闭环率:[/bold] [{rate_color}]{closed_rate:.1f}%[/{rate_color}]")
        
        if all_closed and summary['total_orders'] > 0:
            console.print("[green][bold]✓ 业务已完全闭环！[/bold][/green]")
        else:
            console.print("[yellow][bold]⚠  存在未闭环事项，请关注上表。[/bold][/yellow]")
    finally:
        db.close()


@app.command()
def gen_csv(
    output_dir: Path = typer.Argument(..., help='输出目录'),
):
    """生成样例 CSV 模板文件"""
    generate_sample_csvs(output_dir)
    console.print(f"[green]✓ 样例 CSV 已生成到 {output_dir}[/green]")
    console.print("  - dormitories.csv - 宿舍名单")
    console.print("  - repair_persons.csv - 维修人员")
    console.print("  - materials.csv - 材料库存")


@app.command()
def list_materials(
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
):
    """列出材料库存"""
    db = ensure_db_exists(data_dir)
    
    try:
        materials = db.list_materials()
        if not materials:
            console.print("[yellow]没有材料数据[/yellow]")
            return
        
        table = Table(title="材料库存", show_header=True)
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="white")
        table.add_column("单价", style="magenta")
        table.add_column("库存", style="green")
        table.add_column("最低", style="yellow")
        table.add_column("类别", style="blue")
        for m in materials:
            stock_style = 'red' if m.current_stock <= m.min_stock else 'green'
            table.add_row(
                m.material_id,
                m.name,
                f"¥{m.unit_price:.2f}",
                f"[{stock_style}]{m.current_stock}{m.unit}[/{stock_style}]",
                f"{m.min_stock}{m.unit}",
                m.category or '-'
            )
        console.print(table)
    finally:
        db.close()


@app.command()
def list_dorms(
    building: Optional[str] = typer.Option(None, '--building', '-b', help='楼栋过滤'),
    data_dir: Optional[Path] = typer.Option(None, '--data-dir', '-d', help='数据目录'),
):
    """列出宿舍"""
    db = ensure_db_exists(data_dir)
    
    try:
        if building:
            dorms = db.get_dormitories_by_building(building)
        else:
            dorms = db.list_dormitories()
        
        if not dorms:
            console.print("[yellow]没有宿舍数据[/yellow]")
            return
        
        table = Table(title="宿舍列表", show_header=True)
        table.add_column("ID", style="cyan")
        table.add_column("楼栋", style="blue")
        table.add_column("房间", style="white")
        table.add_column("楼层", style="white")
        table.add_column("人数", style="white")
        table.add_column("辅导员", style="magenta")
        table.add_column("学生", style="dim", max_width=30)
        for d in dorms:
            table.add_row(
                d.dorm_id,
                d.building,
                d.room_number,
                str(d.floor),
                str(len(d.students)),
                d.counselor or '-',
                ', '.join(d.students)
            )
        console.print(table)
    finally:
        db.close()


def main():
    app()


if __name__ == '__main__':
    main()
