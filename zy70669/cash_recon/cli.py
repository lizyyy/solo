import click
from rich.console import Console
from rich.table import Table
from pathlib import Path
from .config import Config
from .parser import TableParser
from .rule_engine import RuleEngine
from .tracker import SourceTracker
from .reporter import ReportGenerator


console = Console()


@click.group()
@click.version_option(version="0.1.0")
def main():
    """现金长短款备用金备注归因排查CLI工具"""
    pass


@main.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--config', '-c', type=click.Path(), help='规则配置文件路径')
@click.option('--output', '-o', default='reports', help='报告输出目录')
@click.option('--tracking-file', default='.cash_recon_tracking.json', help='追踪数据文件路径')
@click.option('--no-tracking', is_flag=True, help='禁用记录追踪')
@click.option('--prefix', default='cash_recon', help='报告文件名前缀')
def process(files, config, output, tracking_file, no_tracking, prefix):
    """处理现金盘点表文件"""
    if not files:
        console.print("[red]错误: 请指定至少一个文件[/red]")
        return

    cfg = Config(config)
    parser = TableParser(cfg.rules.required_columns)
    engine = RuleEngine(cfg.rules)
    tracker = None if no_tracking else SourceTracker(tracking_file)
    reporter = ReportGenerator(output)

    all_valid_records = []
    all_bad_rows = []

    with console.status("[bold green]正在处理文件..."):
        for file_path in files:
            file_name = Path(file_path).name
            console.print(f"[blue]正在解析: {file_name}[/blue]")

            try:
                parsed = parser.parse_file(file_path)
                all_bad_rows.extend(parsed.bad_rows)

                if not parsed.valid_data.empty:
                    processed = engine.process_dataframe(parsed.valid_data)
                    all_valid_records.extend(processed)
                    console.print(f"  有效记录: [green]{len(processed)}[/green] 条")
                    console.print(f"  坏行记录: [yellow]{len(parsed.bad_rows)}[/yellow] 条")
                else:
                    console.print(f"  [yellow]警告: 没有有效数据行[/yellow]")

            except Exception as e:
                console.print(f"  [red]错误: {str(e)}[/red]")

    if tracker:
        all_valid_records = tracker.get_stable_records(all_valid_records)
        records_with_tracking = tracker.track_records(all_valid_records)
    else:
        from dataclasses import dataclass
        @dataclass
        class DummyTracking:
            is_new: bool = False
            is_changed: bool = False
            previous_hash: str = None
            current_hash: str = ""
            signature: str = None
        
        records_with_tracking = [(r, DummyTracking()) for r in all_valid_records]

    console.print("\n[bold magenta]===== 处理结果汇总 =====[/bold magenta]")
    console.print(f"总处理记录数: [bold]{len(all_valid_records) + len(all_bad_rows)}[/bold]")
    console.print(f"有效记录数: [green]{len(all_valid_records)}[/green]")
    console.print(f"坏行记录数: [yellow]{len(all_bad_rows)}[/yellow]\n")

    _show_type_stats(records_with_tracking)
    _show_level_stats(records_with_tracking)
    _show_amount_stats(records_with_tracking)

    with console.status("[bold green]正在生成报告..."):
        results = reporter.generate_full_report(records_with_tracking, all_bad_rows, prefix)
        
    console.print("\n[bold green]===== 报告已生成 =====[/bold green]")
    for fmt, path in results['files'].items():
        console.print(f"{fmt.upper()}: {path}")


@main.command()
@click.option('--output', '-o', default='cash_recon_config.json', help='输出配置文件路径')
def init_config(output):
    """生成默认配置文件"""
    cfg = Config()
    cfg.save(output)
    console.print(f"[green]配置文件已生成: {output}[/green]")


@main.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
def validate(files):
    """仅验证文件格式，不生成报告"""
    if not files:
        console.print("[red]错误: 请指定至少一个文件[/red]")
        return

    cfg = Config()
    parser = TableParser(cfg.rules.required_columns)

    for file_path in files:
        file_name = Path(file_path).name
        console.print(f"[blue]正在验证: {file_name}[/blue]")

        try:
            parsed = parser.parse_file(file_path)
            console.print(f"  有效记录: [green]{len(parsed.valid_data)}[/green] 条")
            console.print(f"  坏行记录: [yellow]{len(parsed.bad_rows)}[/yellow] 条")

            for bad in parsed.bad_rows:
                console.print(f"    行{bad.row_number}: {bad.error}")

        except Exception as e:
            console.print(f"  [red]错误: {str(e)}[/red]")


def _show_type_stats(records_with_tracking):
    from collections import Counter
    from .rule_engine import DiffType

    counter = Counter(r.差异类型 for r, _ in records_with_tracking)

    table = Table(title="差异类型统计")
    table.add_column("类型", style="cyan")
    table.add_column("数量", justify="right", style="magenta")

    for dtype in DiffType:
        table.add_row(dtype.value, str(counter.get(dtype, 0)))

    console.print(table)


def _show_level_stats(records_with_tracking):
    from collections import Counter
    from .rule_engine import DiffLevel

    counter = Counter(r.差异级别 for r, _ in records_with_tracking)

    table = Table(title="差异级别统计")
    table.add_column("级别", style="cyan")
    table.add_column("数量", justify="right", style="magenta")

    for dlevel in DiffLevel:
        table.add_row(dlevel.value, str(counter.get(dlevel, 0)))

    console.print(table)


def _show_amount_stats(records_with_tracking):
    records = [r for r, _ in records_with_tracking]

    long_total = sum(r.调整后差异 for r in records if r.调整后差异 > 1e-6)
    short_total = sum(-r.调整后差异 for r in records if r.调整后差异 < -1e-6)
    net_diff = sum(r.调整后差异 for r in records)
    imprest_total = sum(abs(r.备用金调整额) for r in records)

    table = Table(title="金额统计")
    table.add_column("项目", style="cyan")
    table.add_column("金额", justify="right", style="green")

    table.add_row("长款总金额", f"{long_total:.2f}")
    table.add_row("短款总金额", f"{short_total:.2f}")
    table.add_row("净差异金额", f"{net_diff:.2f}")
    table.add_row("备用金调整总额", f"{imprest_total:.2f}")

    console.print(table)


if __name__ == "__main__":
    main()
