import click
from datetime import datetime
from rich.console import Console
from rich.table import Table

from .parser import InputParser
from .rules import RuleEngine
from .archive import ArchiveManager
from .report import ReportGenerator
from .models import ProcessedData, ReviewStatus


@click.group()
def cli():
    """误报压制的到期复核样本证据排查CLI工具"""
    pass


@cli.command()
@click.argument("input_files", nargs=-1, type=click.Path(exists=True))
@click.option("--reviewer", "-r", default="system", help="复核人名称")
@click.option("--warning-days", "-w", default=7, type=int, help="警告天数")
@click.option("--critical-days", "-c", default=3, type=int, help="紧急天数")
@click.option("--no-archive", is_flag=True, help="不归档样本")
@click.option("--output-dir", "-o", default="./reports", help="报告输出目录")
@click.option("--archive-dir", "-a", default="./archive", help="归档目录")
def review(input_files, reviewer, warning_days, critical_days, no_archive, output_dir, archive_dir):
    """复核误报压制规则"""
    console = Console()

    if not input_files:
        console.print("[red]错误: 至少需要指定一个输入文件[/red]")
        return

    console.print(f"[blue]开始处理 {len(input_files)} 个文件...[/blue]")

    parser = InputParser()
    processed_data = ProcessedData()

    for input_file in input_files:
        console.print(f"  解析: {input_file}")
        try:
            data = parser.parse_file(input_file)
            processed_data.valid_rules.extend(data.valid_rules)
            processed_data.bad_rows.extend(data.bad_rows)
        except Exception as e:
            console.print(f"    [red]错误: {e}[/red]")

    console.print(f"[green]  解析完成: {len(processed_data.valid_rules)} 条有效规则, {len(processed_data.bad_rows)} 条坏行[/green]")

    console.print("\n[blue]运行规则引擎...[/blue]")
    engine = RuleEngine(warning_days=warning_days, critical_days=critical_days)
    processed_data = engine.process_rules(processed_data, reviewer=reviewer)
    console.print(f"[green]  完成: {len(processed_data.review_results)} 条状态变更[/green]")

    batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    if not no_archive:
        console.print("\n[blue]归档样本和来源追踪...[/blue]")
        archiver = ArchiveManager(archive_dir=archive_dir)
        archiver.archive_samples(processed_data, batch_id)
        archiver.save_source_trail(processed_data, batch_id)
        console.print(f"[green]  归档完成: {batch_id}[/green]")

    console.print("\n[blue]生成报告...[/blue]")
    reporter = ReportGenerator(output_dir=output_dir)
    reports = reporter.generate_all(processed_data, batch_id)
    
    for name, path in reports.items():
        console.print(f"[green]  {name}: {path}[/green]")

    _print_summary_table(console, processed_data)

    console.print(f"\n[bold green]✓ 处理完成! 批次ID: {batch_id}[/bold green]")


@cli.command()
@click.option("--archive-dir", "-a", default="./archive", help="归档目录")
def list_archives(archive_dir):
    """列出所有归档批次"""
    archiver = ArchiveManager(archive_dir=archive_dir)
    archives = archiver.list_archives()

    console = Console()
    if archives:
        console.print("[blue]归档批次列表:[/blue]")
        for batch in archives:
            console.print(f"  - {batch}")
    else:
        console.print("[yellow]暂无归档批次[/yellow]")


@cli.command()
@click.argument("sample_id")
@click.option("--archive-dir", "-a", default="./archive", help="归档目录")
def get_sample(sample_id, archive_dir):
    """获取归档的样本信息"""
    archiver = ArchiveManager(archive_dir=archive_dir)
    sample = archiver.get_archived_sample(sample_id)

    console = Console()
    if sample:
        import json
        console.print_json(json.dumps(sample, ensure_ascii=False, indent=2))
    else:
        console.print(f"[red]未找到样本: {sample_id}[/red]")


def _print_summary_table(console: Console, processed_data: ProcessedData):
    status_counts = {}
    for rule in processed_data.valid_rules:
        status = rule.review_status
        status_counts[status] = status_counts.get(status, 0) + 1

    table = Table(title="复核结果统计")
    table.add_column("状态", style="cyan")
    table.add_column("数量", justify="right", style="magenta")

    for status in sorted(ReviewStatus):
        count = status_counts.get(status, 0)
        style = "red" if status in [ReviewStatus.EXPIRED, ReviewStatus.NEEDS_REVIEW] else None
        table.add_row(str(status), str(count), style=style)

    console.print()
    console.print(table)


def main():
    cli()


if __name__ == "__main__":
    main()
