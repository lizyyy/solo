#!/usr/bin/env python3
import click
import os
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .data_reader import DataReader
from .label_generator import LabelGenerator
from .duplicate_detector import DuplicateDetector
from .report_exporter import ReportExporter

console = Console()


@click.group()
@click.version_option(version="1.0.0", prog_name="label-cli")
def cli():
    """
    标签重打旧新映射打印状态排查CLI

    仓库换系统后旧标签不能扫，管理员需要按SKU和库位批量生成新标签并保留映射。
    """
    pass


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True))
@click.option('--output-dir', '-o', default='output', help='输出目录')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def process(csv_file, output_dir, verbose):
    """处理CSV文件，生成新标签和映射报告"""

    console.print(Panel.fit("[bold blue]开始处理标签数据[/bold blue]"))

    reader = DataReader()
    generator = LabelGenerator()
    detector = DuplicateDetector()
    exporter = ReportExporter(output_dir)

    with console.status("[bold green]读取CSV文件..."):
        records, errors = reader.read_csv(csv_file)

    if errors:
        console.print(f"[red]文件读取错误:[/red]")
        for err in errors:
            console.print(f"  - {err}")
        return

    console.print(f"[green]✓[/green] 成功读取 {len(records)} 条记录")

    with console.status("[bold green]生成新标签..."):
        records = generator.generate_labels_batch(records)

    console.print(f"[green]✓[/green] 新标签生成完成")

    with console.status("[bold green]检测重复和冲突..."):
        records, conflicts = detector.detect_duplicates(records)

    if conflicts:
        console.print(f"[yellow]⚠[/yellow] 发现 {len(conflicts)} 个冲突")
    else:
        console.print(f"[green]✓[/green] 未发现冲突")

    with console.status("[bold green]导出报告..."):
        files = exporter.export_all(records, conflicts)

    console.print("\n[bold green]报告生成完成:[/bold green]")
    for name, filepath in files.items():
        console.print(f"  - {name}: [blue]{filepath}[/blue]")

    if verbose:
        _display_summary(records, conflicts)

    console.print(f"\n[bold green]处理完成！[/bold green]")


@cli.command()
@click.argument('csv_file', type=click.Path(exists=True))
def validate(csv_file):
    """仅验证CSV文件格式和数据"""

    console.print(Panel.fit("[bold blue]验证CSV数据[/bold blue]"))

    reader = DataReader()
    records, errors = reader.read_csv(csv_file)

    if errors:
        console.print(f"[red]文件读取错误:[/red]")
        for err in errors:
            console.print(f"  - {err}")
        return

    _display_validation(records)


def _display_validation(records):
    table = Table(title="记录验证结果")
    table.add_column("序号")
    table.add_column("旧标签")
    table.add_column("SKU")
    table.add_column("库位")
    table.add_column("状态")
    table.add_column("错误信息")

    for idx, record in enumerate(records, 1):
        status = "[green]✓[/green]" if record.is_valid else "[red]✗[/red]"
        errors = "; ".join(record.error_messages) if record.error_messages else "-"
        table.add_row(
            str(idx),
            record.old_label,
            record.sku,
            record.location,
            status,
            errors
        )

    console.print(table)


def _display_summary(records, conflicts):
    """显示统计摘要"""

    total = len(records)
    valid = sum(1 for r in records if r.is_valid)
    invalid = total - valid
    printed = sum(1 for r in records if r.print_status == "printed")
    pending = sum(1 for r in records if r.print_status == "pending")

    table = Table(title="处理摘要")
    table.add_column("指标")
    table.add_column("数量")
    table.add_column("说明")

    table.add_row("总记录数", str(total), "")
    table.add_row("有效记录", f"[green]{valid}[/green]", "")
    table.add_row("无效记录", f"[red]{invalid}[/red]", "")
    table.add_row("已打印", f"[blue]{printed}[/blue]", "")
    table.add_row("待打印", f"[yellow]{pending}[/yellow]", "")
    table.add_row("冲突数量", f"[red]{len(conflicts)}[/red]", "")

    console.print("\n")
    console.print(table)


@cli.command(name="list")
@click.option('--output-dir', '-o', default='output', help='输出目录')
def list_output(output_dir):
    """列出输出目录中的所有报告文件"""

    if not os.path.exists(output_dir):
        console.print(f"[yellow]目录不存在: {output_dir}[/yellow]")
        return

    files = os.listdir(output_dir)

    if not files:
        console.print("[yellow]输出目录为空[/yellow]")
        return

    table = Table(title="输出文件列表")
    table.add_column("文件名")
    table.add_column("大小")

    for filename in sorted(files):
        filepath = os.path.join(output_dir, filename)
        size = os.path.getsize(filepath)
        size_str = f"{size} B" if size < 1024 else f"{size // 1024} KB"
        table.add_row(filename, size_str)

    console.print(table)


if __name__ == "__main__":
    cli()
