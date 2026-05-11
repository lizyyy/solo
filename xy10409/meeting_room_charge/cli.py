import click
from datetime import datetime, timedelta
from rich.console import Console
from rich.table import Table
from rich import box

from .core import ChargeEngine
from .storage import DataStorage


console = Console()


@click.group()
@click.option("--data-dir", default="./data", help="数据目录路径")
@click.pass_context
def main(ctx, data_dir):
    """会议室爽约扣费 CLI 工具"""
    storage = DataStorage(data_dir)
    engine = ChargeEngine(storage)
    ctx.ensure_object(dict)
    ctx.obj["storage"] = storage
    ctx.obj["engine"] = engine


@main.command()
@click.argument("filepath", type=click.Path(exists=True))
@click.pass_context
def import_members(ctx, filepath):
    """导入会员规则数据"""
    engine = ctx.obj["engine"]
    count = engine.import_members(filepath)
    console.print(f"[green]成功导入 {count} 条会员规则[/green]")


@main.command()
@click.argument("filepath", type=click.Path(exists=True))
@click.pass_context
def import_bookings(ctx, filepath):
    """导入预约记录"""
    engine = ctx.obj["engine"]
    count = engine.import_bookings(filepath)
    console.print(f"[green]成功导入 {count} 条预约记录[/green]")


@main.command()
@click.argument("filepath", type=click.Path(exists=True))
@click.pass_context
def import_checkins(ctx, filepath):
    """导入签到记录"""
    engine = ctx.obj["engine"]
    count = engine.import_checkins(filepath)
    console.print(f"[green]成功导入 {count} 条签到记录[/green]")


@main.command()
@click.pass_context
def process(ctx):
    """处理扣费逻辑"""
    engine = ctx.obj["engine"]
    engine.process_charges()
    console.print("[green]扣费处理完成[/green]")


@main.command()
@click.argument("member_id")
@click.pass_context
def bill(ctx, member_id):
    """查看单个会员账单"""
    engine = ctx.obj["engine"]
    charges = engine.get_member_bill(member_id)
    storage = ctx.obj["storage"]
    member = storage.members.get(member_id)

    if not member:
        console.print(f"[red]会员 {member_id} 不存在[/red]")
        return

    console.print(f"\n[bold blue]会员账单: {member.name} ({member.member_id})[/bold blue]")
    console.print(f"会员等级: {member.membership_level}")
    console.print(f"联系电话: {member.phone}")
    console.print(f"每周免费额度: ¥{member.weekly_free_amount:.2f}")
    console.print(f"已使用免费额度: ¥{member.used_free_amount:.2f}\n")

    if not charges:
        console.print("[yellow]暂无扣费记录[/yellow]")
        return

    table = Table(box=box.ROUNDED)
    table.add_column("扣费编号", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("原始金额", justify="right")
    table.add_column("实扣金额", justify="right")
    table.add_column("扣费日期")
    table.add_column("申诉状态", style="yellow")

    total = 0.0
    for charge in charges:
        final_amount = charge.final_amount or 0
        total += final_amount
        appeal_status = charge.appeal_status.value if charge.appeal_status else "无"
        table.add_row(
            charge.charge_id,
            charge.charge_type.value,
            f"¥{charge.amount:.2f}",
            f"¥{final_amount:.2f}",
            charge.charge_date.strftime("%Y-%m-%d %H:%M"),
            appeal_status,
        )

    console.print(table)
    console.print(f"\n[bold green]合计实扣金额: ¥{total:.2f}[/bold green]")


@main.command()
@click.argument("charge_id")
@click.argument("reason")
@click.pass_context
def appeal(ctx, charge_id, reason):
    """登记申诉"""
    engine = ctx.obj["engine"]
    charge = engine.register_appeal(charge_id, reason)

    if charge:
        console.print(f"[green]申诉已登记: {charge_id}[/green]")
        console.print(f"申诉原因: {reason}")
    else:
        console.print(f"[red]扣费记录 {charge_id} 不存在[/red]")


@main.command()
@click.argument("charge_id")
@click.option("--approve", is_flag=True, help="通过申诉")
@click.option("--reject", is_flag=True, help="驳回申诉")
@click.pass_context
def process_appeal(ctx, charge_id, approve, reject):
    """处理申诉"""
    engine = ctx.obj["engine"]

    if not approve and not reject:
        console.print("[red]请指定 --approve 或 --reject[/red]")
        return

    charge = engine.process_appeal(charge_id, approve)

    if charge:
        if approve:
            console.print(f"[green]申诉已通过: {charge_id}，金额已归零[/green]")
        else:
            console.print(f"[yellow]申诉已驳回: {charge_id}[/yellow]")
    else:
        console.print(f"[red]扣费记录 {charge_id} 不存在[/red]")


@main.command()
@click.pass_context
def recalculate(ctx):
    """重新计算费用"""
    engine = ctx.obj["engine"]
    engine.recalculate_charges()
    console.print("[green]费用已重新计算[/green]")


@main.command()
@click.option("--start", help="开始日期 (YYYY-MM-DD)")
@click.option("--end", help="结束日期 (YYYY-MM-DD)")
@click.option("--output", help="输出文件路径")
@click.pass_context
def export_weekly(ctx, start, end, output):
    """导出周报"""
    engine = ctx.obj["engine"]

    if start:
        start_date = datetime.strptime(start, "%Y-%m-%d")
    else:
        today = datetime.now()
        start_date = today - timedelta(days=today.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0)

    if end:
        end_date = datetime.strptime(end, "%Y-%m-%d")
        end_date = end_date.replace(hour=23, minute=59, second=59)
    else:
        end_date = start_date + timedelta(days=6)
        end_date = end_date.replace(hour=23, minute=59, second=59)

    if output:
        count = engine.export_weekly_report(output, start_date, end_date)
        if count > 0:
            console.print(f"[green]周报已导出到 {output}，共 {count} 条记录[/green]")
        else:
            console.print("[yellow]该时间段内无扣费记录[/yellow]")
    else:
        report = engine.get_weekly_report(start_date, end_date)
        if not report:
            console.print("[yellow]该时间段内无扣费记录[/yellow]")
            return

        console.print(f"\n[bold blue]周报: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}[/bold blue]\n")

        table = Table(box=box.ROUNDED)
        table.add_column("扣费编号", style="cyan")
        table.add_column("会员ID")
        table.add_column("会员姓名")
        table.add_column("联系电话")
        table.add_column("会议室")
        table.add_column("扣费类型", style="magenta")
        table.add_column("原始金额", justify="right")
        table.add_column("实扣金额", justify="right")
        table.add_column("扣费日期")
        table.add_column("申诉状态", style="yellow")

        total = 0.0
        for row in report:
            final_amount = row["final_amount"] or 0
            total += final_amount
            table.add_row(
                row["charge_id"],
                row["member_id"],
                row["member_name"],
                row["member_phone"],
                row["room_name"],
                row["charge_type"],
                f"¥{row['original_amount']:.2f}",
                f"¥{final_amount:.2f}",
                row["charge_date"],
                row["appeal_status"] or "无",
            )

        console.print(table)
        console.print(f"\n[bold green]合计实扣金额: ¥{total:.2f}[/bold green]")


@main.command()
@click.pass_context
def exceptions(ctx):
    """查看异常清单"""
    engine = ctx.obj["engine"]
    exceptions_list = engine.get_pending_exceptions()

    if not exceptions_list:
        console.print("[green]暂无待处理异常[/green]")
        return

    console.print("\n[bold red]待处理异常清单[/bold red]\n")

    table = Table(box=box.ROUNDED)
    table.add_column("异常编号", style="cyan")
    table.add_column("记录类型", style="magenta")
    table.add_column("记录ID")
    table.add_column("原因", style="yellow")
    table.add_column("创建时间")

    for exc in exceptions_list:
        table.add_row(
            exc.exception_id,
            exc.record_type,
            exc.record_id,
            exc.reason,
            exc.created_at.strftime("%Y-%m-%d %H:%M"),
        )

    console.print(table)


@main.command()
@click.argument("exception_id")
@click.pass_context
def resolve(ctx, exception_id):
    """标记异常为已处理"""
    engine = ctx.obj["engine"]
    exception = engine.resolve_exception(exception_id)

    if exception:
        console.print(f"[green]异常 {exception_id} 已标记为已处理[/green]")
    else:
        console.print(f"[red]异常记录 {exception_id} 不存在[/red]")


if __name__ == "__main__":
    main()
