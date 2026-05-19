import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from . import __version__
from .reporter import Reporter
from .rule_engine import RuleEngine

console = Console()


@click.group()
@click.version_option(version=__version__)
def cli():
    """
    推送 Token 生命周期排查 CLI

    用于分析推送失败原因，包括 Token 过期、无效、设备换绑、用户退订等。
    """
    pass


@cli.command()
@click.option("--tokens", "-t", help="Token 列表文件 (CSV/JSON/Excel)")
@click.option("--bindings", "-b", help="绑定关系文件 (CSV/JSON/Excel)")
@click.option("--unsubscribes", "-u", help="退订记录文件 (CSV/JSON/Excel)")
@click.option("--failures", "-f", help="推送失败记录文件 (CSV/JSON/Excel)")
@click.option("--output", "-o", default="./reports", help="报告输出目录")
@click.option("--format", "fmt", default="all", type=click.Choice(["text", "json", "csv", "excel", "html", "all"]), help="报告格式")
@click.option("--show-console/--no-show-console", default=True, help="是否在控制台显示摘要")
def analyze(tokens, bindings, unsubscribes, failures, output, fmt, show_console):
    """
    分析 Token 生命周期并生成排查报告
    """
    if not any([tokens, bindings, unsubscribes, failures]):
        console.print("[red]错误: 至少需要提供一个输入文件[/red]")
        console.print("使用 --help 查看帮助")
        sys.exit(1)

    for file_path in [tokens, bindings, unsubscribes, failures]:
        if file_path and not Path(file_path).exists():
            console.print(f"[red]错误: 文件不存在: {file_path}[/red]")
            sys.exit(1)

    engine = RuleEngine()

    with console.status("[bold green]正在处理数据...[/bold green]"):
        if tokens:
            console.print(f"加载 Token 数据: {tokens}")
            engine.load_tokens(tokens)

        if bindings:
            console.print(f"加载绑定数据: {bindings}")
            engine.load_bindings(bindings)

        if unsubscribes:
            console.print(f"加载退订数据: {unsubscribes}")
            engine.load_unsubscribes(unsubscribes)

        if failures:
            console.print(f"加载失败数据: {failures}")
            engine.load_failures(failures)

        console.print("正在分析...")
        result = engine.analyze()

    if show_console:
        _show_summary(result)

    reporter = Reporter(result)

    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = ""

    with console.status("[bold green]正在生成报告...[/bold green]"):
        if fmt in ["text", "all"]:
            path = output_dir / f"token_report{timestamp}.txt"
            reporter.generate_text_report(str(path))
            console.print(f"[green]✓[/green] 文本报告: {path}")

        if fmt in ["json", "all"]:
            path = output_dir / f"token_report{timestamp}.json"
            reporter.generate_json_report(str(path))
            console.print(f"[green]✓[/green] JSON 报告: {path}")

        if fmt in ["csv", "all"]:
            path = output_dir / f"token_report{timestamp}.csv"
            reporter.generate_csv_report(str(path))
            console.print(f"[green]✓[/green] CSV 报告: {path}")

        if fmt in ["excel", "all"]:
            path = output_dir / f"token_report{timestamp}.xlsx"
            reporter.generate_excel_report(str(path))
            console.print(f"[green]✓[/green] Excel 报告: {path}")

        if fmt in ["html", "all"]:
            path = output_dir / f"token_report{timestamp}.html"
            reporter.generate_html_report(str(path))
            console.print(f"[green]✓[/green] HTML 报告: {path}")

    console.print("\n[bold green]分析完成！[/bold green]")


def _show_summary(result):
    console.print("\n[bold]===== 分析结果摘要 =====[/bold]\n")

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("指标", style="dim")
    table.add_column("数值", justify="right")

    table.add_row("Token 总数", str(result.total_tokens))
    table.add_row("已绑定", str(result.bound_tokens))
    table.add_row("已解绑", str(result.unbound_tokens))
    table.add_row("已退订", f"[red]{result.unsubscribed_tokens}[/red]")
    table.add_row("推送失败", f"[red]{result.failed_tokens}[/red]")
    table.add_row("换绑设备", f"[yellow]{result.rebound_devices}[/yellow]")
    table.add_row("├─ 失败原因: 设备换绑", f"[yellow]{result.device_rebound}[/yellow]")
    table.add_row("├─ 失败原因: 用户退订", f"[red]{result.user_unsubscribed}[/red]")
    table.add_row("├─ 失败原因: Token 解绑", f"[cyan]{result.token_unbound}[/cyan]")
    table.add_row("├─ 失败原因: Token 过期", f"[red]{result.token_expired}[/red]")
    table.add_row("└─ 失败原因: Token 无效", f"[red]{result.token_invalid}[/red]")

    console.print(table)

    if result.parse_errors:
        console.print(f"\n[yellow]⚠ 解析错误: {len(result.parse_errors)} 个[/yellow]")
        for err in result.parse_errors[:3]:
            if err.sheet_name:
                console.print(f"  - {err.source_file}[{err.sheet_name}] 第{err.row_number}行: {err.error_message}")
            else:
                console.print(f"  - {err.source_file} 第{err.row_number}行: {err.error_message}")
        if len(result.parse_errors) > 3:
            console.print(f"  ...还有 {len(result.parse_errors) - 3} 个错误")


@cli.command()
@click.option("--output", "-o", default="./sample_data", help="示例数据输出目录")
def sample(output):
    """
    生成示例数据文件，展示支持的数据格式
    """
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)

    sample_data = {
        "tokens.csv": """token,device_id,user_id,create_time,update_time
APA91bF8xQZ1abcdefghijklmnopqrst,device_001,user_001,2024-01-01 10:00:00,2024-01-15 08:30:00
APA91bF8xQZ2abcdefghijklmnopqrst,device_002,user_002,2024-01-02 14:20:00,2024-01-20 16:45:00
APA91bF8xQZ3abcdefghijklmnopqrst,device_003,user_003,2024-01-03 09:10:00,2024-02-01 11:20:00
APA91bF8xQZ4abcdefghijklmnopqrst,device_001,user_004,2024-02-10 15:00:00,2024-02-10 15:00:00
APA91bF8xQZ5abcdefghijklmnopqrst,device_005,user_005,2024-01-25 08:00:00,2024-02-05 09:30:00
""",
        "bindings.csv": """user_id,device_id,token,bind_time,unbind_time
user_001,device_001,APA91bF8xQZ1abcdefghijklmnopqrst,2024-01-01 10:05:00,
user_002,device_002,APA91bF8xQZ2abcdefghijklmnopqrst,2024-01-02 14:25:00,2024-02-01 00:00:00
user_003,device_003,APA91bF8xQZ3abcdefghijklmnopqrst,2024-01-03 09:15:00,
user_004,device_001,APA91bF8xQZ4abcdefghijklmnopqrst,2024-02-10 15:05:00,
user_005,device_005,APA91bF8xQZ5abcdefghijklmnopqrst,2024-01-25 08:05:00,
""",
        "unsubscribes.csv": """token,user_id,device_id,unsubscribe_time,reason
APA91bF8xQZ3abcdefghijklmnopqrst,user_003,device_003,2024-02-10 12:00:00,用户主动退订
""",
        "failures.csv": """token,user_id,device_id,fail_time,error_code,error_message
APA91bF8xQZ1abcdefghijklmnopqrst,user_001,device_001,2024-02-12 09:00:00,INVALID_REGISTRATION,Invalid registration token
APA91bF8xQZ2abcdefghijklmnopqrst,user_002,device_002,2024-02-12 10:30:00,NOT_REGISTERED,Token not registered
APA91bF8xQZ3abcdefghijklmnopqrst,user_003,device_003,2024-02-12 11:15:00,UNSUBSCRIBED,User has unsubscribed
APA91bF8xQZ5abcdefghijklmnopqrst,user_005,device_005,2024-02-13 14:20:00,EXPIRED,Token expired
""",
    }

    for filename, content in sample_data.items():
        path = output_dir / filename
        with open(path, "w", encoding="utf-8-sig") as f:
            f.write(content)
        console.print(f"[green]✓[/green] 生成: {path}")

    console.print("\n[bold]示例数据已生成！[/bold]")
    console.print(f"\n运行分析命令示例:")
    console.print(f"  push-token-check analyze --tokens {output}/tokens.csv")
    console.print(f"    --bindings {output}/bindings.csv")
    console.print(f"    --unsubscribes {output}/unsubscribes.csv")
    console.print(f"    --failures {output}/failures.csv")


if __name__ == "__main__":
    cli()
