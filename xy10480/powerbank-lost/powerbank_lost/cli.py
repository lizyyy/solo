import os
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .service import PowerBankService
from .models import AppealReason


console = Console()


def get_service(ctx: click.Context) -> PowerBankService:
    return ctx.obj["service"]


@click.group()
@click.option(
    "--data-dir",
    default="./data",
    help="数据存储目录",
    type=click.Path(file_okay=False, dir_okay=True)
)
@click.pass_context
def cli(ctx: click.Context, data_dir: str):
    """共享充电宝丢失申诉处理 CLI"""
    os.makedirs(data_dir, exist_ok=True)
    ctx.ensure_object(dict)
    ctx.obj["service"] = PowerBankService(data_dir)
    ctx.obj["data_dir"] = data_dir


@cli.group()
def import_cmd():
    """导入数据命令"""
    pass


@import_cmd.command("borrow")
@click.argument("file", type=click.Path(exists=True, readable=True))
@click.option("--confirmed", is_flag=True, help="标记为已确认的记录")
@click.pass_context
def import_borrow(ctx: click.Context, file: str, confirmed: bool):
    """导入借出记录 CSV"""
    service = get_service(ctx)
    count = service.import_borrow_records(file, confirmed=confirmed)
    console.print(f"[green]✓[/green] 成功导入 {count} 条借出记录")


@import_cmd.command("return")
@click.argument("file", type=click.Path(exists=True, readable=True))
@click.option("--confirmed", is_flag=True, help="标记为已确认的记录")
@click.pass_context
def import_return(ctx: click.Context, file: str, confirmed: bool):
    """导入归还记录 CSV"""
    service = get_service(ctx)
    count = service.import_return_records(file, confirmed=confirmed)
    console.print(f"[green]✓[/green] 成功导入 {count} 条归还记录")


@import_cmd.command("cabinet")
@click.argument("file", type=click.Path(exists=True, readable=True))
@click.pass_context
def import_cabinet(ctx: click.Context, file: str):
    """导入柜机状态 CSV"""
    service = get_service(ctx)
    count = service.import_cabinet_status(file)
    console.print(f"[green]✓[/green] 成功导入 {count} 条柜机状态记录")


@import_cmd.command("fee-rules")
@click.argument("file", type=click.Path(exists=True, readable=True))
@click.pass_context
def import_fee_rules(ctx: click.Context, file: str):
    """导入扣费规则 CSV"""
    service = get_service(ctx)
    count = service.import_fee_rules(file)
    console.print(f"[green]✓[/green] 成功导入 {count} 条扣费规则")


@cli.command("process")
@click.pass_context
def process(ctx: click.Context):
    """处理订单，判断状态和计算费用"""
    service = get_service(ctx)
    result = service.process_orders()
    
    console.print(Panel(
        f"[bold]订单处理结果[/bold]\n\n"
        f"新增订单: {result['new']}\n"
        f"更新订单: {result['updated']}\n"
        f"跳过已确认: {result['skipped_confirmed']}",
        title="处理完成"
    ))
    
    if result['new_orders']:
        console.print(f"  新增订单ID: {', '.join(result['new_orders'][:5])}{'...' if len(result['new_orders']) > 5 else ''}")
    if result['updated_orders']:
        console.print(f"  更新订单ID: {', '.join(result['updated_orders'][:5])}{'...' if len(result['updated_orders']) > 5 else ''}")


@cli.command("list")
@click.option("--status", help="按状态筛选 (如: 疑似丢失, 正常归还 等)")
@click.pass_context
def list_orders(ctx: click.Context, status: Optional[str]):
    """列出所有订单"""
    service = get_service(ctx)
    orders = service.get_orders(status_filter=status)
    
    if not orders:
        console.print("[yellow]没有找到订单[/yellow]")
        return
    
    table = Table(title="订单列表", box=box.ROUNDED)
    table.add_column("订单ID", style="cyan")
    table.add_column("用户", style="blue")
    table.add_column("设备", style="magenta")
    table.add_column("状态", style="green")
    table.add_column("状态原因", style="yellow", overflow="fold")
    table.add_column("原始费用", style="red")
    table.add_column("最终费用", style="bold red")
    table.add_column("确认", style="green")
    
    for order in orders:
        status_style = "green"
        if order.status.value == "suspicious_lost":
            status_style = "yellow"
        elif order.status.value in ["confirmed_lost", "return_failed"]:
            status_style = "red"
        elif order.status.value == "appeal_pending":
            status_style = "blue"
        elif order.status.value == "appeal_approved":
            status_style = "green"
        
        table.add_row(
            order.order_id,
            order.user_id,
            order.device_id,
            f"[{status_style}]{order.status_display}[/{status_style}]",
            order.status_reason,
            f"¥{order.original_fee:.2f}",
            f"¥{order.final_fee:.2f}",
            "✓" if order.is_confirmed else "✗"
        )
    
    console.print(table)
    console.print(f"\n共 {len(orders)} 条订单")


@cli.command("show")
@click.argument("order_id")
@click.pass_context
def show_order(ctx: click.Context, order_id: str):
    """查看订单详情"""
    service = get_service(ctx)
    order = service.get_order(order_id)
    
    if not order:
        console.print(f"[red]订单不存在: {order_id}[/red]")
        return
    
    info = [
        f"[bold cyan]订单ID:[/bold cyan] {order.order_id}",
        f"[bold cyan]用户ID:[/bold cyan] {order.user_id}",
        f"[bold cyan]设备ID:[/bold cyan] {order.device_id}",
        f"[bold cyan]借出柜机:[/bold cyan] {order.borrow_cabinet_id}",
        f"[bold cyan]借出时间:[/bold cyan] {order.borrow_time}",
        f"[bold cyan]归还柜机:[/bold cyan] {order.return_cabinet_id or '-'}",
        f"[bold cyan]归还时间:[/bold cyan] {order.return_time or '-'}",
        f"[bold cyan]状态:[/bold cyan] {order.status_display}",
        f"[bold cyan]状态原因:[/bold cyan] {order.status_reason}",
        f"[bold cyan]是否确认:[/bold cyan] {'是' if order.is_confirmed else '否'}",
    ]
    
    if order.cabinet_offline_at:
        info.append(f"[bold red]柜机离线时间:[/bold red] {order.cabinet_offline_at}")
    
    if order.multiple_return_users:
        info.append(f"[bold red]其他归还用户:[/bold red] {', '.join(order.multiple_return_users)}")
    
    info.extend([
        "",
        f"[bold yellow]原始费用:[/bold yellow] ¥{order.original_fee:.2f}",
        f"[bold green]最终费用:[/bold green] ¥{order.final_fee:.2f}",
    ])
    
    if order.adjusted_fee is not None:
        info.append(f"[bold blue]调整后费用:[/bold blue] ¥{order.adjusted_fee:.2f}")
        info.append(f"[bold blue]费用差额:[/bold blue] ¥{order.original_fee - order.adjusted_fee:.2f}")
    
    if order.appeal:
        info.extend([
            "",
            f"[bold magenta]申诉ID:[/bold magenta] {order.appeal.appeal_id}",
            f"[bold magenta]申诉原因:[/bold magenta] {order.appeal.reason.value}",
            f"[bold magenta]申诉描述:[/bold magenta] {order.appeal.description}",
            f"[bold magenta]申诉状态:[/bold magenta] {order.appeal.status}",
        ])
        if order.appeal.reviewer_note:
            info.append(f"[bold magenta]复核意见:[/bold magenta] {order.appeal.reviewer_note}")
    
    if order.fee_adjustments:
        info.extend([
            "",
            "[bold]费用调整记录:[/bold]",
        ])
        for adj in order.fee_adjustments:
            info.extend([
                f"  - [cyan]{adj.adjustment_id}[/cyan]",
                f"    原因: {adj.reason}",
                f"    调整: ¥{adj.original_fee:.2f} → ¥{adj.adjusted_fee:.2f}",
                f"    操作员: {adj.operator}",
            ])
    
    console.print(Panel("\n".join(info), title=f"订单详情 - {order_id}"))


@cli.command("appeal")
@click.argument("order_id")
@click.argument("user_id")
@click.option("--reason", required=True, 
              type=click.Choice([r.value for r in AppealReason]),
              help="申诉原因")
@click.option("--description", required=True, help="申诉描述")
@click.pass_context
def register_appeal(
    ctx: click.Context,
    order_id: str,
    user_id: str,
    reason: str,
    description: str
):
    """登记用户申诉"""
    service = get_service(ctx)
    
    try:
        appeal = service.register_appeal(
            order_id=order_id,
            user_id=user_id,
            reason=AppealReason(reason),
            description=description
        )
        console.print(f"[green]✓[/green] 申诉登记成功: {appeal.appeal_id}")
        console.print(f"  订单状态已更新为: 申诉待处理")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")


@cli.command("review")
@click.argument("order_id")
@click.option("--approve/--reject", required=True, help="通过或驳回申诉")
@click.option("--note", required=True, help="复核意见")
@click.option("--adjusted-fee", type=float, help="调整后的费用（申诉通过时）")
@click.option("--adjustment-reason", help="费用调整原因")
@click.option("--operator", default="operator", help="操作员")
@click.pass_context
def review_appeal(
    ctx: click.Context,
    order_id: str,
    approve: bool,
    note: str,
    adjusted_fee: Optional[float],
    adjustment_reason: Optional[str],
    operator: str
):
    """复核申诉并调整扣费"""
    service = get_service(ctx)
    
    try:
        order, adjustment = service.review_appeal(
            order_id=order_id,
            approved=approve,
            reviewer_note=note,
            adjusted_fee=adjusted_fee,
            adjustment_reason=adjustment_reason or "",
            operator=operator
        )
        
        if approve:
            console.print(f"[green]✓[/green] 申诉通过: {order_id}")
        else:
            console.print(f"[yellow]![/yellow] 申诉驳回: {order_id}")
        
        console.print(f"  复核意见: {note}")
        console.print(f"  订单状态: {order.status_display}")
        console.print(f"  最终费用: ¥{order.final_fee:.2f}")
        
        if adjustment:
            console.print(f"  费用调整记录: {adjustment.adjustment_id}")
            console.print(f"    调整金额: ¥{adjustment.original_fee:.2f} → ¥{adjustment.adjusted_fee:.2f}")
            console.print(f"    调整原因: {adjustment.reason}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")


@cli.command("adjust")
@click.argument("order_id")
@click.argument("new_fee", type=float)
@click.option("--reason", required=True, help="调整原因")
@click.option("--operator", default="operator", help="操作员")
@click.pass_context
def adjust_fee(
    ctx: click.Context,
    order_id: str,
    new_fee: float,
    reason: str,
    operator: str
):
    """直接调整订单费用"""
    service = get_service(ctx)
    
    try:
        adjustment = service.adjust_fee(
            order_id=order_id,
            new_fee=new_fee,
            reason=reason,
            operator=operator
        )
        console.print(f"[green]✓[/green] 费用调整成功: {adjustment.adjustment_id}")
        console.print(f"  原费用: ¥{adjustment.original_fee:.2f}")
        console.print(f"  新费用: ¥{adjustment.adjusted_fee:.2f}")
        console.print(f"  调整原因: {adjustment.reason}")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")


@cli.command("explain")
@click.argument("order_id")
@click.pass_context
def explain_fee(ctx: click.Context, order_id: str):
    """获取订单费用解释（可直接讲给用户听）"""
    service = get_service(ctx)
    explanation = service.get_fee_explanation(order_id)
    console.print(Panel(explanation, title=f"费用说明 - {order_id}"))


@cli.command("export")
@click.argument("output_file")
@click.option("--status", help="按状态筛选")
@click.pass_context
def export_report(ctx: click.Context, output_file: str, status: Optional[str]):
    """导出资产报告 CSV"""
    service = get_service(ctx)
    count = service.export_asset_report(output_file, status_filter=status)
    console.print(f"[green]✓[/green] 成功导出 {count} 条订单到 {output_file}")


@cli.command("confirm")
@click.argument("order_id")
@click.pass_context
def confirm_order(ctx: click.Context, order_id: str):
    """确认订单（标记为已确认后不会被重复导入覆盖）"""
    service = get_service(ctx)
    try:
        service.confirm_order(order_id)
        console.print(f"[green]✓[/green] 订单已确认: {order_id}")
        console.print(f"  此订单将不会被后续导入覆盖")
    except ValueError as e:
        console.print(f"[red]错误: {e}[/red]")


@cli.command("samples")
@click.pass_context
def create_samples(ctx: click.Context):
    """创建样例数据（用于测试）"""
    service = get_service(ctx)
    data_dir = ctx.obj["data_dir"]
    samples_dir = os.path.join(data_dir, "samples")
    os.makedirs(samples_dir, exist_ok=True)
    
    import csv
    from datetime import datetime, timedelta
    
    now = datetime.now()
    
    fee_rules_file = os.path.join(samples_dir, "fee_rules.csv")
    with open(fee_rules_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["rule_id", "region", "base_fee", "per_hour_fee", "max_daily_fee", "lost_fee", "is_active"])
        writer.writerow(["R001", "default", "2.0", "3.0", "30.0", "99.0", "true"])
    
    borrow_file = os.path.join(samples_dir, "borrow_records.csv")
    with open(borrow_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["order_id", "user_id", "device_id", "cabinet_id", "borrow_time"])
        writer.writerow(["ORD001", "USER001", "DEV001", "CAB001", (now - timedelta(hours=3)).isoformat()])
        writer.writerow(["ORD002", "USER002", "DEV002", "CAB001", (now - timedelta(days=2)).isoformat()])
        writer.writerow(["ORD003", "USER003", "DEV003", "CAB002", (now - timedelta(hours=5)).isoformat()])
        writer.writerow(["ORD004", "USER004", "DEV004", "CAB002", (now - timedelta(hours=4)).isoformat()])
        writer.writerow(["ORD005", "USER005", "DEV005", "CAB003", (now - timedelta(days=1, hours=2)).isoformat()])
    
    return_file = os.path.join(samples_dir, "return_records.csv")
    with open(return_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["order_id", "user_id", "device_id", "cabinet_id", "return_time", "slot_id"])
        writer.writerow(["ORD001", "USER001", "DEV001", "CAB001", (now - timedelta(hours=1)).isoformat(), "S01"])
        writer.writerow(["ORD003", "USER003", "DEV003", "CAB002", (now - timedelta(hours=2)).isoformat(), "S03"])
        writer.writerow(["ORD004", "USER006", "DEV004", "CAB004", (now - timedelta(hours=1)).isoformat(), "S02"])
    
    cabinet_file = os.path.join(samples_dir, "cabinet_status.csv")
    with open(cabinet_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["cabinet_id", "report_time", "is_online", "slot_status"])
        writer.writerow(["CAB001", (now - timedelta(minutes=30)).isoformat(), "true", "S01:occupied;S02:empty;S03:empty"])
        writer.writerow(["CAB002", (now - timedelta(minutes=30)).isoformat(), "false", "S01:empty;S02:empty;S03:empty"])
        writer.writerow(["CAB003", (now - timedelta(minutes=30)).isoformat(), "true", "S01:empty;S02:empty;S03:empty"])
        writer.writerow(["CAB004", (now - timedelta(minutes=30)).isoformat(), "true", "S01:empty;S02:occupied;S03:empty"])
    
    console.print(Panel(
        f"[bold]样例数据已创建[/bold]\n\n"
        f"目录: {samples_dir}\n\n"
        f"包含文件:\n"
        f"  - fee_rules.csv (扣费规则)\n"
        f"  - borrow_records.csv (借出记录: 5条)\n"
        f"    - ORD001: 正常归还场景\n"
        f"    - ORD002: 丢失场景 (无归还记录)\n"
        f"    - ORD003: 柜机故障场景 (柜机离线)\n"
        f"    - ORD004: 多人归还场景 (USER004借, USER006还)\n"
        f"    - ORD005: 疑似丢失场景\n"
        f"  - return_records.csv (归还记录: 3条)\n"
        f"  - cabinet_status.csv (柜机状态: 4条)\n\n"
        f"[yellow]提示: 请依次执行以下命令测试:\n"
        f"  pb-lost import fee-rules {fee_rules_file}\n"
        f"  pb-lost import borrow {borrow_file}\n"
        f"  pb-lost import return {return_file}\n"
        f"  pb-lost import cabinet {cabinet_file}\n"
        f"  pb-lost process\n"
        f"  pb-lost list[/yellow]",
        title="样例数据"
    ))


if __name__ == "__main__":
    cli()
