import click
import pandas as pd
import logging
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .reader import DataReader
from .conflict_checker import ConflictChecker

console = Console()


def setup_logging(verbose: bool):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(message)s'
    )


def display_summary_logs(logs):
    summary_logs = [msg for lvl, msg in logs if not msg.startswith("  ")]
    for msg in summary_logs:
        console.print(msg)


def display_detailed_logs(logs):
    for lvl, msg in logs:
        if lvl == "WARNING":
            console.print(f"[yellow]{msg}[/yellow]")
        else:
            console.print(msg)


def display_conflicts_table(conflicts):
    if not conflicts:
        console.print("[green]✅ 未发现任何锁房冲突[/green]")
        return

    table = Table(title="锁房冲突清单")
    table.add_column("冲突编号", style="cyan")
    table.add_column("冲突类型", style="magenta")
    table.add_column("房号", style="blue")
    table.add_column("房型", style="blue")
    table.add_column("入住日期", style="green")
    table.add_column("退房日期", style="green")
    table.add_column("严重程度", style="red")
    table.add_column("冲突描述", style="yellow")

    for conflict in conflicts:
        table.add_row(
            conflict.conflict_id,
            conflict.conflict_type.value,
            conflict.room_number,
            conflict.room_type,
            conflict.checkin_date.strftime("%Y-%m-%d"),
            conflict.checkout_date.strftime("%Y-%m-%d"),
            conflict.severity,
            conflict.description[:60] + "..." if len(conflict.description) > 60 else conflict.description
        )

    console.print(table)


def export_conflicts(conflicts, output_file):
    if not conflicts:
        return

    data = [c.to_dict() for c in conflicts]
    df = pd.DataFrame(data)
    output_path = Path(output_file)

    if output_path.suffix.lower() in [".xlsx", ".xls"]:
        df.to_excel(output_file, index=False, sheet_name="锁房冲突")
    else:
        df.to_csv(output_file, index=False, encoding="utf-8-sig")

    console.print(f"[green]✅ 冲突清单已导出到: {output_file}[/green]")


@click.group()
def cli():
    """酒店房态导出锁房冲突核对工具"""
    pass


@cli.command()
@click.option('--room-state', '-r', required=True, help='房态表文件路径 (CSV/Excel)')
@click.option('--channel-order', '-c', required=True, help='渠道订单文件路径 (CSV/Excel)')
@click.option('--manual-lock', '-l', required=True, help='手工锁房文件路径 (CSV/Excel)')
@click.option('--output', '-o', default='锁房冲突清单.csv', help='冲突清单输出文件路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细处理日志')
def check(room_state, channel_order, manual_lock, output, verbose):
    """执行锁房冲突检测"""
    setup_logging(verbose)

    console.print(Panel.fit(
        "[bold blue]🏨 酒店房态导出锁房冲突核对工具[/bold blue]\n"
        "[dim]检测已售又锁房、渠道延迟、换房、续住等冲突[/dim]",
        border_style="blue"
    ))

    try:
        reader = DataReader()
        room_states = reader.read_room_state(room_state)
        channel_orders = reader.read_channel_orders(channel_order)
        manual_locks = reader.read_manual_locks(manual_lock)

        checker = ConflictChecker(verbose=verbose)
        conflicts = checker.check_all_conflicts(room_states, channel_orders, manual_locks)

        logs = checker.get_processing_logs()

        console.print("\n[bold]📊 检测过程摘要:[/bold]")
        console.print("-" * 50)
        if verbose:
            display_detailed_logs(logs)
        else:
            display_summary_logs(logs)

        console.print("\n[bold]📋 冲突检测结果:[/bold]")
        console.print("-" * 50)
        display_conflicts_table(conflicts)

        if conflicts:
            export_conflicts(conflicts, output)

        if conflicts:
            console.print(f"\n[red]⚠️  共发现 {len(conflicts)} 个锁房冲突，请及时处理[/red]")
            raise SystemExit(1)
        else:
            console.print("\n[green]🎉 所有房间状态正常，无锁房冲突[/green]")

    except Exception as e:
        console.print(f"[red]❌ 执行出错: {str(e)}[/red]")
        if verbose:
            import traceback
            console.print(traceback.format_exc())
        raise SystemExit(1)


@cli.command()
def sample():
    """使用样例数据运行演示"""
    base_path = Path(__file__).parent.parent.parent / "sample_data"
    room_state = str(base_path / "房态表.csv")
    channel_order = str(base_path / "渠道订单.csv")
    manual_lock = str(base_path / "手工锁房.csv")

    if not Path(room_state).exists():
        console.print("[red]❌ 样例数据文件不存在，请先创建 sample_data 目录下的测试文件[/red]")
        raise SystemExit(1)

    console.print("[blue]ℹ️  使用样例数据运行冲突检测...[/blue]")
    console.print(f"   房态表: {room_state}")
    console.print(f"   渠道订单: {channel_order}")
    console.print(f"   手工锁房: {manual_lock}\n")

    from click.testing import CliRunner
    runner = CliRunner()
    result = runner.invoke(check, [
        '-r', room_state,
        '-c', channel_order,
        '-l', manual_lock,
        '-o', '锁房冲突清单_样例.csv'
    ])
    console.print(result.output)


@cli.command()
def template():
    """生成输入文件模板"""
    templates = {
        "房态表模板.csv": ["房号", "房型", "入住日期", "退房日期", "房态", "订单号", "客人姓名", "渠道", "更新时间"],
        "渠道订单模板.csv": ["订单号", "渠道订单号", "渠道", "客人姓名", "客人电话", "房型", "房号", "入住日期", "退房日期", "金额", "订单状态", "创建时间", "确认时间"],
        "手工锁房模板.csv": ["锁房编号", "房号", "房型", "锁房原因", "入住日期", "退房日期", "操作人", "创建时间", "备注"]
    }

    for filename, columns in templates.items():
        df = pd.DataFrame(columns=columns)
        df.to_csv(filename, index=False, encoding="utf-8-sig")
        console.print(f"[green]✅ 已生成模板: {filename}[/green]")


def main():
    cli()


if __name__ == "__main__":
    main()
