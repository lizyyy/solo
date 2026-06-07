import json
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import BookingStatus, AuthReminderLevel
from .storage import load_state, save_state, reset_state
from .processor import (
    import_group_booking,
    detect_mixed_batches,
    process_normal_bookings,
    add_contract_screenshot,
    update_auth_reminders,
    review_mixed_booking,
    rerun_processing,
    start_session,
    end_session,
)

console = Console()


def status_style(status: BookingStatus) -> str:
    styles = {
        BookingStatus.PENDING: "yellow",
        BookingStatus.NORMAL: "green",
        BookingStatus.MIXED_BATCH: "red",
        BookingStatus.NEEDS_CONTRACT: "yellow",
        BookingStatus.CONFLICT: "red",
        BookingStatus.RESOLVED: "green",
        BookingStatus.ARCHIVED: "dim",
    }
    return styles.get(status, "white")


def auth_style(level: AuthReminderLevel) -> str:
    styles = {
        AuthReminderLevel.NONE: "dim",
        AuthReminderLevel.INFO: "blue",
        AuthReminderLevel.WARNING: "yellow",
        AuthReminderLevel.CRITICAL: "red bold",
    }
    return styles.get(level, "white")


@click.group()
def cli():
    """鼓房预约冲突处理系统"""
    pass


@cli.command()
def init():
    """初始化项目状态"""
    reset_state()
    state = load_state()
    save_state(state)
    console.print("[green]✓ 项目已初始化[/green]")


@cli.command()
@click.argument("json_file", type=click.Path(exists=True))
@click.option("--operator", default="录音师小段", help="操作人")
def import_bookings(json_file, operator):
    """导入排练群接龙数据"""
    state = load_state()
    start_session(state, f"import {json_file}")

    with open(json_file, "r", encoding="utf-8") as f:
        bookings_data = json.load(f)

    new_bookings = import_group_booking(state, bookings_data, operator)
    console.print(f"[green]✓ 成功导入 {len(new_bookings)} 条预约记录[/green]")

    mixed = detect_mixed_batches(state)
    normal = process_normal_bookings(state)
    auth_updated = update_auth_reminders(state)

    console.print(f"  - 检测到 [red]{len(mixed)}[/red] 条混批记录")
    console.print(f"  - [green]{len(normal)}[/green] 条记录正常")
    console.print(f"  - 更新了 {len(auth_updated)} 条授权提醒")

    end_session(state)
    save_state(state)
    console.print("[dim]会话已保存[/dim]")


@cli.command(name="list")
def list_bookings():
    """列出所有预约记录"""
    state = load_state()

    table = Table(title="鼓房预约记录", show_lines=True)
    table.add_column("ID", style="dim", width=12)
    table.add_column("日期", width=12)
    table.add_column("时段", width=14)
    table.add_column("鼓房", width=10)
    table.add_column("乐队")
    table.add_column("票种")
    table.add_column("批次")
    table.add_column("状态")
    table.add_column("授权提醒")
    table.add_column("合同页")

    for b in state.bookings:
        status_text = Text(b.status.value, style=status_style(b.status))
        auth_text = Text(b.auth_reminder.value, style=auth_style(b.auth_reminder))
        contract = "✓" if b.contract_screenshot else "—"
        table.add_row(
            b.id,
            b.date,
            b.time_slot,
            b.room_name,
            b.band_name,
            b.ticket_type.value,
            b.batch_id or "—",
            status_text,
            auth_text,
            contract,
        )

    console.print(table)


@cli.command()
@click.argument("booking_id")
@click.argument("screenshot_path", type=click.Path(exists=True))
@click.argument("contract_ticket_type", type=click.Choice(["售票", "赠票"]))
@click.option("--operator", default="录音师小段", help="操作人")
def add_contract(booking_id, screenshot_path, contract_ticket_type, operator):
    """补录合同页截图"""
    state = load_state()
    start_session(state, f"add-contract {booking_id} {screenshot_path}")

    booking = add_contract_screenshot(state, booking_id, screenshot_path, contract_ticket_type, operator)
    if not booking:
        console.print(f"[red]✗ 未找到预约记录: {booking_id}[/red]")
        return

    update_auth_reminders(state)
    console.print(f"[green]✓ 已补录合同页: {booking.band_name}[/green]")
    console.print(f"  合同票种: {contract_ticket_type}")
    if booking.ticket_type != booking.contract_ticket_type:
        console.print(f"  [yellow]⚠ 接龙票种与合同不一致，已更新以合同为准[/yellow]")

    end_session(state)
    save_state(state)


@cli.command()
@click.argument("booking_id")
@click.argument("new_status", type=click.Choice(["正常", "冲突", "已解决"]))
@click.option("--notes", default="", help="复核备注")
@click.option("--operator", default="录音师小段", help="操作人")
def review(booking_id, new_status, notes, operator):
    """人工复核混批记录"""
    state = load_state()
    start_session(state, f"review {booking_id} {new_status}")

    status_map = {
        "正常": BookingStatus.NORMAL,
        "冲突": BookingStatus.CONFLICT,
        "已解决": BookingStatus.RESOLVED,
    }

    booking = review_mixed_booking(state, booking_id, status_map[new_status], notes, operator)
    if not booking:
        console.print(f"[red]✗ 未找到预约记录: {booking_id}[/red]")
        return

    update_auth_reminders(state)
    console.print(f"[green]✓ 复核完成: {booking.band_name} → {new_status}[/green]")
    if notes:
        console.print(f"  备注: {notes}")

    end_session(state)
    save_state(state)


@cli.command()
@click.option("--operator", default="录音师小段", help="操作人")
def rerun(operator):
    """重新运行全流程处理"""
    state = load_state()
    start_session(state, "rerun")

    result = rerun_processing(state, operator)
    console.print("[green]✓ 重跑完成[/green]")
    console.print(f"  - 检测到混批: {result['mixed_detected']} 条")
    console.print(f"  - 正常处理: {result['normal_processed']} 条")
    console.print(f"  - 授权提醒更新: {result['auth_updated']} 条")

    end_session(state)
    save_state(state)


@cli.command()
def batches():
    """查看批次情况"""
    state = load_state()

    table = Table(title="批次汇总")
    table.add_column("批次号", style="cyan")
    table.add_column("日期")
    table.add_column("票种")
    table.add_column("预约数")
    table.add_column("状态")

    for batch in state.batches:
        ticket_types = ", ".join(t.value for t in batch.ticket_types)
        status = Text("混批⚠", style="red bold") if batch.is_mixed else Text("正常", style="green")
        table.add_row(
            batch.batch_id,
            batch.date,
            ticket_types,
            str(len(batch.bookings)),
            status,
        )

    console.print(table)


@cli.command()
@click.option("--session-id", help="指定会话ID查看")
def log(session_id):
    """查看处理记录（复盘）"""
    state = load_state()

    sessions = state.sessions
    if session_id:
        sessions = [s for s in sessions if s.session_id == session_id]

    for session in reversed(sessions):
        panel_content = []
        panel_content.append(f"[cyan]会话: {session.session_id}[/cyan]")
        panel_content.append(f"命令: {session.command}")
        panel_content.append(f"开始: {session.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if session.ended_at:
            panel_content.append(f"结束: {session.ended_at.strftime('%Y-%m-%d %H:%M:%S')}")
        panel_content.append("")
        panel_content.append("[bold]处理记录:[/bold]")

        for record in session.records:
            time_str = record.timestamp.strftime("%H:%M:%S")
            step_style = {
                "导入接龙": "blue",
                "检测混批": "yellow",
                "人工复核": "magenta",
                "补录合同页": "cyan",
                "更新授权提醒": "green",
                "重跑处理": "dim",
            }.get(record.step.value, "white")

            line = f"[{time_str}] [{step_style}]{record.step.value}[/{step_style}] "
            if record.booking_id:
                line += f"({record.booking_id}) "
            line += f"- {record.details}"
            if record.operator != "系统":
                line += f" [dim]<{record.operator}>[/dim]"
            panel_content.append(line)

        console.print(Panel("\n".join(panel_content), border_style="dim"))


@cli.command()
def replay():
    """输出可重新跑的命令序列"""
    state = load_state()

    console.print(Panel("[bold]可重新执行的命令序列[/bold]", border_style="blue"))
    console.print()

    commands = [
        "# 1. 初始化",
        "python -m drum_room_conflict init",
        "",
        "# 2. 导入排练群接龙",
        "python -m drum_room_conflict import-bookings data/demo_bookings.json",
        "",
        "# 3. 查看列表（检测混批）",
        "python -m drum_room_conflict list",
        "",
        "# 4. 查看批次",
        "python -m drum_room_conflict batches",
    ]

    for session in state.sessions:
        if session.command.startswith("add-contract"):
            parts = session.command.split()
            if len(parts) >= 3:
                booking_id = parts[1]
                screenshot = parts[2]
                ticket_type = parts[3] if len(parts) > 3 else "赠票"
                commands.append("")
                commands.append(f"# 补录合同页")
                commands.append(f"python -m drum_room_conflict add-contract {booking_id} {screenshot} {ticket_type}")
        elif session.command.startswith("review"):
            parts = session.command.split()
            if len(parts) >= 3:
                booking_id = parts[1]
                status = parts[2]
                commands.append("")
                commands.append(f"# 人工复核")
                commands.append(f"python -m drum_room_conflict review {booking_id} {status}")

    commands.extend([
        "",
        "# 重跑全流程",
        "python -m drum_room_conflict rerun",
        "",
        "# 查看处理记录（复盘）",
        "python -m drum_room_conflict log",
    ])

    for cmd in commands:
        if cmd.startswith("#"):
            console.print(f"[dim]{cmd}[/dim]")
        else:
            console.print(f"[green]$ {cmd}[/green]")


@cli.command()
def demo():
    """运行完整演示流程"""
    console.print(Panel("[bold]鼓房预约冲突处理 - 完整演示[/bold]", border_style="blue"))
    console.print()

    console.print("[yellow]步骤 1: 初始化项目[/yellow]")
    reset_state()
    state = load_state()
    save_state(state)
    console.print("[green]✓ 初始化完成[/green]")
    console.print()

    console.print("[yellow]步骤 2: 导入排练群接龙[/yellow]")
    demo_file = Path("data/demo_bookings.json")
    start_session(state, "import data/demo_bookings.json")

    with open(demo_file, "r", encoding="utf-8") as f:
        bookings_data = json.load(f)

    new_bookings = import_group_booking(state, bookings_data, "录音师小段")
    console.print(f"[green]✓ 导入 {len(new_bookings)} 条预约记录[/green]")

    mixed = detect_mixed_batches(state)
    normal = process_normal_bookings(state)
    update_auth_reminders(state)
    end_session(state)
    save_state(state)

    for b in new_bookings:
        tag = ""
        if b.status == BookingStatus.MIXED_BATCH:
            tag = " [red]【混批待复核】[/red]"
        elif b.status == BookingStatus.NORMAL:
            tag = " [green]【正常】[/green]"
        console.print(f"  {b.date} {b.time_slot} {b.band_name} ({b.ticket_type.value}){tag}")

    console.print()
    console.print(f"  检测到 [red]{len(mixed)}[/red] 条混批（BATCH-002 迷雾乐队）")
    console.print(f"  [green]{len(normal)}[/green] 条正常（BATCH-001 电波乐队）")
    console.print(f"  BATCH-003 旧时光乐队: 接龙标售票，待补合同页")
    console.print()

    console.print("[yellow]步骤 3: 补录旧时光乐队的合同页截图[/yellow]")
    old_time_booking = next(b for b in state.bookings if b.band_name == "旧时光乐队")
    contract_path = "data/contract_旧时光乐队_BATCH-003.txt"

    start_session(state, f"add-contract {old_time_booking.id} {contract_path} 赠票")
    add_contract_screenshot(state, old_time_booking.id, contract_path, "赠票", "录音师小段")
    update_auth_reminders(state)
    end_session(state)
    save_state(state)

    console.print(f"[green]✓ 已补录合同页[/green]")
    console.print(f"  合同票种: 赠票（内部合作场次）")
    console.print(f"  [yellow]⚠ 接龙票种(售票)与合同票种(赠票)不一致，已更新以合同为准[/yellow]")
    console.print()

    console.print("[yellow]步骤 4: 人工复核混批的迷雾乐队[/yellow]")
    mixed_bookings = [b for b in state.bookings if b.status == BookingStatus.MIXED_BATCH]
    for b in mixed_bookings:
        start_session(state, f"review {b.id} 已解决")
        review_mixed_booking(
            state,
            b.id,
            BookingStatus.RESOLVED,
            "已核实，赠票为乐队内部福利，售票为对外场次，分开处理",
            "录音师小段",
        )
        update_auth_reminders(state)
        end_session(state)
        save_state(state)

    console.print(f"[green]✓ 已完成人工复核[/green]")
    console.print(f"  备注: 已核实，赠票为乐队内部福利，售票为对外场次，分开处理")
    console.print()

    console.print("[yellow]步骤 5: 重跑一次全流程验证[/yellow]")
    start_session(state, "rerun")
    result = rerun_processing(state, "录音师小段")
    end_session(state)
    save_state(state)

    console.print(f"[green]✓ 重跑完成[/green]")
    console.print(f"  混批: {result['mixed_detected']} 条")
    console.print(f"  正常: {result['normal_processed']} 条")
    console.print()

    console.print("[yellow]最终状态:[/yellow]")
    table = Table(show_lines=True)
    table.add_column("乐队")
    table.add_column("批次")
    table.add_column("接龙票种")
    table.add_column("合同票种")
    table.add_column("最终状态")
    table.add_column("授权提醒")

    for b in state.bookings:
        contract_ticket = b.contract_ticket_type.value if b.contract_ticket_type else "—"
        status_text = Text(b.status.value, style=status_style(b.status))
        auth_text = Text(b.auth_reminder.value, style=auth_style(b.auth_reminder))
        table.add_row(
            b.band_name,
            b.batch_id,
            b.ticket_type.value,
            contract_ticket,
            status_text,
            auth_text,
        )

    console.print(table)
    console.print()

    console.print("[cyan]三种处理结果对比:[/cyan]")
    console.print("  1. [green]电波乐队 (BATCH-001)[/green]: 顺利记录，全售票，直接正常")
    console.print("  2. [yellow]迷雾乐队 (BATCH-002)[/yellow]: 赠票售票混批 → 人工复核后标记正常")
    console.print("  3. [magenta]旧时光乐队 (BATCH-003)[/magenta]: 接龙标售票 → 补录合同发现是赠票(旧口径) → 更新授权提醒")
    console.print()

    console.print("[dim]查看完整复盘记录: python -m drum_room_conflict log[/dim]")
    console.print("[dim]查看可重跑命令: python -m drum_room_conflict replay[/dim]")


def main():
    cli()


if __name__ == "__main__":
    main()
