import click
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from typing import List
from .processor import PurchaseDiffProcessor
from .models import ProcessingResult

console = Console()


def print_summary(result: ProcessingResult):
    console.print(
        Panel.fit(
            "[bold blue]采购到货记录到货差异汇总[/bold blue]",
            subtitle=f"处理时间: {result.processed_at}",
        )
    )

    console.print(f"\n[bold]输入文件数:[/bold] {len(result.input_files)}")
    for f in result.input_files:
        console.print(f"  - {f}")

    if result.error_files:
        console.print(f"\n[bold red]错误文件数:[/bold red] {len(result.error_files)}")
        for err in result.error_files:
            console.print(f"  - [red]{err}[/red]")

    console.print(f"\n[bold]跳过重复记录数:[/bold] {result.skipped_records}")
    console.print(f"[bold]新增有效记录数:[/bold] {len(result.all_records)}")

    if result.summary:
        table = Table(title="差异统计概览")
        table.add_column("差异类型", style="cyan")
        table.add_column("记录条数", justify="right", style="magenta")
        table.add_column("差异总数量", justify="right", style="green")

        for s in result.summary:
            table.add_row(
                s.diff_type.value,
                str(s.total_count),
                str(s.total_quantity),
            )

        console.print("\n")
        console.print(table)

    if result.all_records:
        console.print("\n[bold]前5条明细记录:[/bold]")
        details_table = Table()
        details_table.add_column("差异类型", style="cyan")
        details_table.add_column("供应商")
        details_table.add_column("采购单号")
        details_table.add_column("SKU")
        details_table.add_column("差异数量")
        details_table.add_column("来源文件")
        details_table.add_column("来源行号")

        for record in result.all_records[:5]:
            details_table.add_row(
                record.diff_type.value,
                record.supplier,
                record.purchase_order,
                record.sku,
                str(record.diff_quantity),
                record.filename,
                str(record.line_number),
            )

        console.print(details_table)


@click.group()
@click.version_option()
def cli():
    """采购到货记录到货差异汇总 CLI"""
    pass


@cli.command()
@click.argument(
    "input_files",
    nargs=-1,
    type=click.Path(exists=True, path_type=Path),
    required=True,
)
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path),
    help="输出 Excel 文件路径",
)
@click.option(
    "--append",
    "-a",
    is_flag=True,
    default=False,
    help="追加模式（默认覆盖）",
)
@click.option(
    "--quiet",
    "-q",
    is_flag=True,
    default=False,
    help="静默模式，只输出错误",
)
def process(input_files: List[Path], output: Path, append: bool, quiet: bool):
    """处理采购到货记录并汇总差异

    INPUT_FILES: 一个或多个输入文件（支持 .xlsx 和 .csv）
    """
    processor = PurchaseDiffProcessor()

    try:
        result = processor.process_files(
            input_files=list(input_files),
            output_path=output,
            append=append,
        )

        if not quiet:
            print_summary(result)

        if output:
            console.print(f"\n[bold green]✓ 结果已保存到: {output}[/bold green]")

        if result.error_files:
            raise click.ClickException(f"处理过程中有 {len(result.error_files)} 个文件出错")

    except Exception as e:
        console.print(f"[bold red]错误: {str(e)}[/bold red]")
        raise click.ClickException(str(e))


@cli.command()
def demo():
    """生成演示样例数据并运行完整流程"""
    from .demo import generate_demo_data

    demo_dir = Path("demo_data")
    demo_dir.mkdir(exist_ok=True)

    console.print("[bold blue]正在生成演示样例数据...[/bold blue]")
    files = generate_demo_data(demo_dir)

    console.print(f"\n[bold]已生成 {len(files)} 个演示文件:[/bold]")
    for f in files:
        console.print(f"  - {f.name}")

    output_file = demo_dir / "差异汇总结果.xlsx"

    console.print("\n[bold blue]第一次运行...[/bold blue]")
    processor = PurchaseDiffProcessor()
    result1 = processor.process_files(
        input_files=files,
        output_path=output_file,
        append=False,
    )
    print_summary(result1)

    console.print("\n[bold blue]第二次重复运行同一批文件...[/bold blue]")
    processor2 = PurchaseDiffProcessor()
    result2 = processor2.process_files(
        input_files=files,
        output_path=output_file,
        append=True,
    )
    print_summary(result2)

    console.print("\n[bold green]✓ 演示完成！[/bold green]")
    console.print(f"[bold]验证:[/bold] 第二次运行跳过了 {result2.skipped_records} 条重复记录")
    console.print(f"[bold]输出文件:[/bold] {output_file.absolute()}")


if __name__ == "__main__":
    cli()
