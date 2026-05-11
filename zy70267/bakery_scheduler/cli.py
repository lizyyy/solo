"""命令行界面"""
import click
from datetime import datetime
from tabulate import tabulate
from rich.console import Console
from rich.table import Table as RichTable
from rich.panel import Panel
from rich.text import Text
import csv
import json
from pathlib import Path

from .database import Database
from .order_importer import OrderImporter
from .scheduler import ProductionScheduler
from .models import OrderStatus, ScheduleStatus

console = Console()


def get_db():
    db = Database("bakery.db")
    db.init_default_data()
    return db


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """烘焙工坊订单排炉系统 CLI"""
    pass


@cli.command()
def init():
    """初始化数据库和默认数据"""
    db = get_db()
    console.print(Panel(
        "[green]✓[/green] 数据库初始化完成\n"
        "[green]✓[/green] 默认产品数据已加载\n"
        "[green]✓[/green] 默认烤箱配置已加载\n"
        "[green]✓[/green] 默认配送窗口已加载",
        title="系统初始化",
        border_style="green"
    ))


@cli.group()
def import_orders():
    """订单导入相关命令"""
    pass


@import_orders.command("csv")
@click.argument('file_path', type=click.Path(exists=False))
def import_csv(file_path):
    """从CSV文件导入订单"""
    db = get_db()
    importer = OrderImporter(db)
    
    console.print(f"[blue]正在导入 CSV 文件: {file_path}[/blue]")
    result = importer.import_from_csv(file_path)
    
    _print_import_result(result)


@import_orders.command("json")
@click.argument('file_path', type=click.Path(exists=False))
def import_json(file_path):
    """从JSON文件导入订单"""
    db = get_db()
    importer = OrderImporter(db)
    
    console.print(f"[blue]正在导入 JSON 文件: {file_path}[/blue]")
    result = importer.import_from_json(file_path)
    
    _print_import_result(result)


def _print_import_result(result):
    table = RichTable(title="导入结果", show_header=True, header_style="bold")
    table.add_column("指标", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("成功导入", str(result.success_count))
    table.add_row("重复跳过", str(result.duplicate_count))
    table.add_row("导入失败", str(result.error_count))
    console.print(table)
    
    if result.errors:
        console.print("\n[red]错误详情:[/red]")
        for err in result.errors:
            console.print(f"  • [{err.get('type', 'unknown')}] {err.get('message', '')}")
    
    if result.imported_orders:
        console.print(f"\n[green]已导入订单ID: {', '.join(result.imported_orders)}[/green]")


@cli.command()
@click.option('--reschedule', is_flag=True, help='重新排产所有订单')
def run(reschedule):
    """运行排炉调度"""
    db = get_db()
    scheduler = ProductionScheduler(db)
    
    if reschedule:
        console.print("[yellow]正在清除现有排产计划并重新排产...[/yellow]")
        result = scheduler.reschedule_all()
    else:
        console.print("[blue]正在对待处理订单进行排产...[/blue]")
        result = scheduler.run_scheduling()
    
    _print_scheduling_result(result, scheduler)


def _print_scheduling_result(result, scheduler):
    console.print(Panel(
        f"[green]✓[/green] 成功排产: {result.scheduled_count} 个订单\n"
        f"[red]✗[/red] 排产失败: {result.failed_count} 个订单",
        title="排产结果",
        border_style="blue"
    ))
    
    if result.scheduled_deliveries:
        table = RichTable(title="今日生产排程", show_header=True, header_style="bold magenta")
        table.add_column("订单ID", style="cyan", no_wrap=True)
        table.add_column("产品", style="green")
        table.add_column("数量")
        table.add_column("客户")
        table.add_column("醒发开始", style="yellow")
        table.add_column("烤箱", style="blue")
        table.add_column("烘焙开始", style="red")
        table.add_column("配送窗口")
        
        for d in result.scheduled_deliveries:
            table.add_row(
                d.order_id,
                d.product_name,
                str(d.quantity),
                d.customer_name,
                d.proofing_start.strftime("%H:%M"),
                d.oven_id,
                d.baking_start.strftime("%H:%M"),
                d.delivery_window
            )
        console.print(table)
    
    if result.warnings:
        console.print("\n[yellow]排产警告:[/yellow]")
        for w in result.warnings:
            console.print(f"  • {w}")
    
    utilization = scheduler.get_oven_utilization()
    util_table = RichTable(title="烤箱利用率", show_header=True, header_style="bold")
    util_table.add_column("烤箱ID", style="cyan")
    util_table.add_column("名称")
    util_table.add_column("容量(单位)")
    util_table.add_column("已安排")
    util_table.add_column("烘焙时间(分钟)")
    util_table.add_column("利用率", style="green")
    
    for oven_id, data in utilization.items():
        util_table.add_row(
            oven_id,
            data['name'],
            str(data['max_capacity']),
            str(data['scheduled_count']),
            str(data['total_baking_minutes']),
            f"{data['utilization_percent']}%"
        )
    console.print(util_table)


@cli.command()
@click.option('--order-id', help='查询指定订单的异常')
@click.option('--unresolved', is_flag=True, help='只显示未解决的异常')
def anomalies(order_id, unresolved):
    """查询异常记录"""
    db = get_db()
    anomalies = db.get_anomalies(order_id=order_id, unresolved_only=unresolved)
    
    if not anomalies:
        console.print("[green]✓[/green] 没有发现异常记录")
        return
    
    table = RichTable(title="异常记录", show_header=True, header_style="bold")
    table.add_column("异常ID", style="cyan", no_wrap=True)
    table.add_column("订单ID", style="yellow")
    table.add_column("类型", style="red")
    table.add_column("描述")
    table.add_column("时间")
    table.add_column("状态")
    
    for a in anomalies:
        status = "[red]未解决[/red]" if not a.resolved else "[green]已解决[/green]"
        table.add_row(
            a.anomaly_id,
            a.order_id,
            a.anomaly_type,
            a.description[:80] + ("..." if len(a.description) > 80 else ""),
            a.detected_at.strftime("%Y-%m-%d %H:%M"),
            status
        )
    console.print(table)


@cli.command()
@click.argument('anomaly_id')
def resolve(anomaly_id):
    """标记异常为已解决"""
    db = get_db()
    db.resolve_anomaly(anomaly_id)
    console.print(f"[green]✓[/green] 异常 {anomaly_id} 已标记为已解决")


@cli.group()
def orders():
    """订单查询相关命令"""
    pass


@orders.command("list")
@click.option('--status', help='按状态筛选: pending, proofing, baking, ready, delivered, conflict, error')
def list_orders(status):
    """列出所有订单"""
    db = get_db()
    
    if status:
        try:
            status_enum = OrderStatus(status.lower())
            orders_list = db.get_orders_by_status(status_enum)
        except ValueError:
            console.print(f"[red]错误:[/red] 无效的状态值 '{status}'")
            return
    else:
        orders_list = db.get_all_orders()
    
    if not orders_list:
        console.print("[yellow]没有找到订单[/yellow]")
        return
    
    table = RichTable(title="订单列表", show_header=True, header_style="bold")
    table.add_column("订单ID", style="cyan", no_wrap=True)
    table.add_column("来源系统")
    table.add_column("来源记录ID")
    table.add_column("产品")
    table.add_column("数量")
    table.add_column("客户")
    table.add_column("状态", style="yellow")
    table.add_column("配送窗口")
    
    products = {p.product_id: p.name for p in db.get_all_products()}
    windows = {w.window_id: w.description for w in db.get_all_delivery_windows()}
    
    for o in orders_list:
        status_color = {
            OrderStatus.PENDING: "white",
            OrderStatus.PROOFING: "yellow",
            OrderStatus.BAKING: "orange",
            OrderStatus.READY: "green",
            OrderStatus.DELIVERED: "blue",
            OrderStatus.CONFLICT: "red",
            OrderStatus.ERROR: "red"
        }
        status_text = f"[{status_color.get(o.status, 'white')}]{o.status.value}[/{status_color.get(o.status, 'white')}]"
        
        table.add_row(
            o.order_id,
            o.source_system,
            o.source_record_id,
            products.get(o.product_id, o.product_id),
            str(o.quantity),
            o.customer_name,
            status_text,
            windows.get(o.delivery_window_id, o.delivery_window_id)
        )
    console.print(table)


@orders.command("show")
@click.argument('order_id')
def show_order(order_id):
    """显示订单详情"""
    db = get_db()
    order = db.get_order(order_id)
    
    if not order:
        console.print(f"[red]错误:[/red] 订单 {order_id} 不存在")
        return
    
    product = db.get_product(order.product_id)
    window = db.get_delivery_window(order.delivery_window_id)
    proofing = db.get_proofing_schedules(order_id)
    baking = db.get_baking_schedules(order_id)
    
    console.print(Panel(
        f"[cyan]订单ID:[/cyan] {order.order_id}\n"
        f"[cyan]来源系统:[/cyan] {order.source_system}\n"
        f"[cyan]来源记录ID:[/cyan] {order.source_record_id}\n"
        f"[cyan]产品:[/cyan] {product.name if product else order.product_id}\n"
        f"[cyan]数量:[/cyan] {order.quantity}\n"
        f"[cyan]客户:[/cyan] {order.customer_name}\n"
        f"[cyan]状态:[/cyan] {order.status.value}\n"
        f"[cyan]配送窗口:[/cyan] {window.description if window else order.delivery_window_id}\n"
        f"[cyan]创建时间:[/cyan] {order.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
        title=f"订单详情 - {order.order_id}",
        border_style="blue"
    ))
    
    if proofing:
        p = proofing[0]
        console.print(Panel(
            f"[yellow]开始时间:[/yellow] {p.proofing_start.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[yellow]结束时间:[/yellow] {p.proofing_end.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[yellow]状态:[/yellow] {p.status.value}",
            title="醒发计划",
            border_style="yellow"
        ))
    
    if baking:
        b = baking[0]
        oven = db.get_oven(b.oven_id)
        console.print(Panel(
            f"[red]烤箱:[/red] {oven.name if oven else b.oven_id}\n"
            f"[red]开始时间:[/red] {b.baking_start.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[red]结束时间:[/red] {b.baking_end.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[red]占用单位:[/red] {b.units_used}\n"
            f"[red]状态:[/red] {b.status.value}",
            title="烘焙计划",
            border_style="red"
        ))


@cli.group()
def report():
    """生成报表相关命令"""
    pass


@report.command("daily")
@click.argument('output_file', type=click.Path(exists=False))
@click.option('--format', 'fmt', default='csv', type=click.Choice(['csv', 'json']), help='输出格式')
def daily_report(output_file, fmt):
    """生成每日生产报表"""
    db = get_db()
    scheduler = ProductionScheduler(db)
    
    all_orders = db.get_all_orders()
    proofing_schedules = db.get_proofing_schedules()
    baking_schedules = db.get_baking_schedules()
    utilization = scheduler.get_oven_utilization()
    anomalies = db.get_anomalies(unresolved_only=True)
    
    products = {p.product_id: p.name for p in db.get_all_products()}
    windows = {w.window_id: w.description for w in db.get_all_delivery_windows()}
    ovens = {o.oven_id: o.name for o in db.get_all_ovens()}
    
    proofing_map = {p.order_id: p for p in proofing_schedules}
    baking_map = {b.order_id: b for b in baking_schedules}
    
    schedule_data = []
    for order in all_orders:
        p = proofing_map.get(order.order_id)
        b = baking_map.get(order.order_id)
        
        row = {
            'order_id': order.order_id,
            'source_system': order.source_system,
            'source_record_id': order.source_record_id,
            'product': products.get(order.product_id, order.product_id),
            'quantity': order.quantity,
            'customer': order.customer_name,
            'status': order.status.value,
            'delivery_window': windows.get(order.delivery_window_id, order.delivery_window_id),
            'proofing_start': p.proofing_start.strftime("%Y-%m-%d %H:%M:%S") if p else '',
            'proofing_end': p.proofing_end.strftime("%Y-%m-%d %H:%M:%S") if p else '',
            'oven': ovens.get(b.oven_id, b.oven_id) if b else '',
            'baking_start': b.baking_start.strftime("%Y-%m-%d %H:%M:%S") if b else '',
            'baking_end': b.baking_end.strftime("%Y-%m-%d %H:%M:%S") if b else '',
        }
        schedule_data.append(row)
    
    summary = {
        'report_date': datetime.now().strftime("%Y-%m-%d"),
        'total_orders': len(all_orders),
        'orders_by_status': {
            status.value: len([o for o in all_orders if o.status == status])
            for status in OrderStatus
        },
        'oven_utilization': utilization,
        'unresolved_anomalies': len(anomalies)
    }
    
    if fmt == 'json':
        report_data = {
            'summary': summary,
            'production_schedule': schedule_data
        }
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
    else:
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            if schedule_data:
                writer = csv.DictWriter(f, fieldnames=schedule_data[0].keys())
                writer.writeheader()
                writer.writerows(schedule_data)
        
        summary_file = Path(output_file).stem + "_summary.json"
        summary_path = Path(output_file).parent / summary_file
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        console.print(f"[blue]摘要文件: {summary_path}[/blue]")
    
    console.print(f"[green]✓[/green] 每日生产报表已生成: {output_file}")
    console.print(f"  • 订单总数: {summary['total_orders']}")
    console.print(f"  • 未解决异常: {summary['unresolved_anomalies']}")


@report.command("dashboard")
def dashboard():
    """显示控制台看板"""
    db = get_db()
    scheduler = ProductionScheduler(db)
    
    all_orders = db.get_all_orders()
    pending = len([o for o in all_orders if o.status == OrderStatus.PENDING])
    proofing = len([o for o in all_orders if o.status == OrderStatus.PROOFING])
    baking = len([o for o in all_orders if o.status == OrderStatus.BAKING])
    ready = len([o for o in all_orders if o.status == OrderStatus.READY])
    errors = len([o for o in all_orders if o.status in [OrderStatus.ERROR, OrderStatus.CONFLICT]])
    
    utilization = scheduler.get_oven_utilization()
    anomalies = db.get_anomalies(unresolved_only=True)
    
    console.print(Panel(
        Text.assemble(
            ("\n  烘焙工坊生产看板", "bold magenta"),
            f"\n\n  总订单数: {len(all_orders)}",
            f"\n  [yellow]待排产: {pending}[/yellow]",
            f"  [blue]醒发中: {proofing}[/blue]",
            f"  [orange]烘焙中: {baking}[/orange]",
            f"  [green]已完成: {ready}[/green]",
            f"  [red]异常: {errors}[/red]",
            f"\n\n  未解决异常: {len(anomalies)}",
            justify="center"
        ),
        border_style="magenta"
    ))
    
    util_table = RichTable(title="烤箱状态", show_header=True, header_style="bold")
    util_table.add_column("烤箱")
    util_table.add_column("容量")
    util_table.add_column("已安排")
    util_table.add_column("利用率")
    
    for oven_id, data in utilization.items():
        util_pct = data['utilization_percent']
        color = "green" if util_pct < 70 else "yellow" if util_pct < 90 else "red"
        util_table.add_row(
            data['name'],
            str(data['max_capacity']),
            str(data['scheduled_count']),
            f"[{color}]{util_pct}%[/{color}]"
        )
    console.print(util_table)


@cli.command()
def reset():
    """重置数据库（清空所有数据）"""
    console.print("[red]警告: 这将删除所有数据![/red]")
    if click.confirm('确定要重置数据库吗?'):
        db = Database("bakery.db")
        db.reset_database()
        db.init_default_data()
        console.print("[green]✓[/green] 数据库已重置")


@cli.group()
def config():
    """查看配置信息"""
    pass


@config.command("products")
def list_products():
    """列出所有产品配置"""
    db = get_db()
    products = db.get_all_products()
    
    table = RichTable(title="产品配置", show_header=True, header_style="bold")
    table.add_column("产品ID", style="cyan")
    table.add_column("名称", style="green")
    table.add_column("醒发时间(分钟)", style="yellow")
    table.add_column("烘焙时间(分钟)", style="red")
    table.add_column("每单位占用")
    
    for p in products:
        table.add_row(
            p.product_id,
            p.name,
            str(p.proofing_time_minutes),
            str(p.baking_time_minutes),
            str(p.oven_capacity_units)
        )
    console.print(table)


@config.command("ovens")
def list_ovens():
    """列出所有烤箱配置"""
    db = get_db()
    ovens = db.get_all_ovens()
    
    table = RichTable(title="烤箱配置", show_header=True, header_style="bold")
    table.add_column("烤箱ID", style="cyan")
    table.add_column("名称", style="green")
    table.add_column("最大容量", style="red")
    table.add_column("可用时间")
    
    for o in ovens:
        table.add_row(
            o.oven_id,
            o.name,
            str(o.max_capacity_units),
            f"{o.available_from.strftime('%H:%M')} - {o.available_to.strftime('%H:%M')}"
        )
    console.print(table)


@config.command("windows")
def list_windows():
    """列出所有配送窗口"""
    db = get_db()
    windows = db.get_all_delivery_windows()
    
    table = RichTable(title="配送窗口配置", show_header=True, header_style="bold")
    table.add_column("窗口ID", style="cyan")
    table.add_column("开始时间", style="green")
    table.add_column("结束时间", style="red")
    table.add_column("描述")
    
    for w in windows:
        table.add_row(
            w.window_id,
            w.start_time.strftime("%H:%M"),
            w.end_time.strftime("%H:%M"),
            w.description
        )
    console.print(table)


if __name__ == "__main__":
    cli()
