import sys
import traceback
from pathlib import Path
from typing import List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .processor import ClaimProcessor
from . import __version__


console = Console()


def print_banner():
    banner = Text()
    banner.append("❄️  冷链小仓冷链赔付材料处理工具  ❄️\n", style="bold cyan")
    banner.append(f"版本: {__version__}", style="dim")
    console.print(Panel(banner, border_style="blue"))


def print_summary(result):
    table = Table(title="处理结果汇总", show_header=True, header_style="bold magenta")
    table.add_column("项目", style="cyan", width=20)
    table.add_column("数值", style="green", justify="right")

    table.add_row("总解析记录", str(result.total_records))
    table.add_row("新增记录", str(result.new_records))
    table.add_row("跳过重复记录", str(result.skipped_records))
    table.add_row("失败文件/记录", str(len(result.failed_files)))

    console.print(table)


def print_errors(failed_files: List[dict]):
    if not failed_files:
        return

    console.print("\n")
    error_table = Table(title="失败详情", show_header=True, header_style="bold red")
    error_table.add_column("文件名", style="yellow", width=25)
    error_table.add_column("错误信息", style="red")
    error_table.add_column("行号", style="dim", justify="center")

    for fail in failed_files:
        line_num = str(fail.get("line", "-")) if fail.get("line") else "-"
        error_table.add_row(fail["filename"], fail["error"], line_num)

    console.print(error_table)


def print_success_message(output_dir: str):
    console.print("\n")
    success_msg = Text()
    success_msg.append("✓ 处理完成！\n", style="bold green")
    success_msg.append(f"输出目录: {output_dir}\n", style="dim")
    success_msg.append("结果文件: cold_chain_claim_records.xlsx", style="dim")
    console.print(Panel(success_msg, border_style="green"))


@click.group(invoke_without_command=True)
@click.pass_context
@click.version_option(__version__, prog_name="cold-chain-claim")
def main(ctx):
    if ctx.invoked_subcommand is None:
        print_banner()
        click.echo(ctx.get_help())


@main.command()
@click.argument("inputs", nargs=-1, type=click.Path(exists=False))
@click.option("--output", "-o", default="output", help="输出目录", type=click.Path())
@click.option("--reset", is_flag=True, help="重置已处理记录缓存")
def process(inputs, output, reset):
    """处理冷链赔付材料文件

    INPUTS: 要处理的文件或目录路径，可以指定多个
    """
    print_banner()

    if not inputs:
        console.print("[red]错误: 请指定要处理的文件或目录路径[/red]")
        console.print("\n使用示例:")
        console.print("  cold-chain-claim process data/")
        console.print("  cold-chain-claim process file1.xlsx file2.csv")
        sys.exit(1)

    try:
        processor = ClaimProcessor(output_dir=output)

        if reset:
            processor.reset()
            console.print("[yellow]已重置处理记录缓存[/yellow]")

        console.print(f"\n[cyan]正在处理输入文件...[/cyan]")
        for inp in inputs:
            console.print(f"  → {inp}")

        result = processor.process_inputs(list(inputs))

        print_summary(result)
        print_errors(result.failed_files)

        if result.new_records > 0:
            print_success_message(output)

        if result.failed_files and result.new_records == 0:
            console.print("\n[yellow]警告: 部分文件处理失败，但工具已完成所有可处理的内容[/yellow]")

        if not result.success and result.total_records == 0:
            console.print("\n[red]错误: 没有成功处理任何记录[/red]")
            sys.exit(1)

    except Exception as e:
        console.print(f"\n[bold red]程序运行出错:[/bold red] {str(e)}")
        console.print("\n[dim]如果问题持续，请检查输入文件格式或联系技术支持[/dim]")
        debug_file = Path(output) / "debug_error.log"
        try:
            with open(debug_file, "w", encoding="utf-8") as f:
                f.write(traceback.format_exc())
            console.print(f"[dim]详细错误日志已保存到: {debug_file}[/dim]")
        except Exception:
            pass
        sys.exit(1)


@main.command()
@click.option("--output", "-o", default="output", help="输出目录", type=click.Path())
def status(output):
    """查看当前处理状态"""
    print_banner()

    processor = ClaimProcessor(output_dir=output)
    summary = processor.get_summary()

    table = Table(title="当前状态", show_header=True, header_style="bold blue")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="green")

    table.add_row("已处理记录数", str(summary["total_processed"]))
    table.add_row("输出目录", summary["output_dir"])

    console.print(table)


@main.command()
@click.option("--output", "-o", default="output", help="输出目录", type=click.Path())
def clear(output):
    """清除所有已处理记录缓存"""
    print_banner()

    processor = ClaimProcessor(output_dir=output)
    old_count = len(processor.existing_keys)
    processor.reset()

    console.print(f"[green]✓ 已清除 {old_count} 条处理记录缓存[/green]")


@main.command()
def sample():
    """生成冷链赔付材料样例文件"""
    print_banner()

    sample_dir = Path("sample_data")
    sample_dir.mkdir(exist_ok=True)

    sample_file = sample_dir / "冷链赔付材料样例.xlsx"
    import pandas as pd

    data = {
        "赔付单号": ["CC20240501001", "CC20240501002", "CC20240501003", "CC20240501004", "CC20240501005"],
        "仓库编码": ["CC001", "CC002", "CC001", "CC003", "CC002"],
        "赔付日期": ["2024-05-01", "2024-05-02", "2024-05-03", "2024-05-04", "2024-05-05"],
        "承运商": ["顺丰冷链", "京东冷链", "顺丰冷链", "中通冷链", "京东冷链"],
        "商品名称": ["进口牛排", "冷冻虾仁", "三文鱼排", "冰淇淋", "速冻水饺"],
        "批次号": ["B20240428001", "B20240429002", "B20240430003", "B20240501004", "B20240502005"],
        "温度异常类型": ["超温", "冻结", "超温", "温度波动", "超温"],
        "最低温度": ["-25.5", "-30.2", "-22.0", "-18.5", "-24.0"],
        "最高温度": ["-10.0", "-15.0", "-8.5", "-5.0", "-12.0"],
        "异常持续时长(小时)": ["4.5", "6.0", "3.0", "8.5", "5.0"],
        "损失金额": ["1500.00", "2300.50", "800.00", "3200.00", "1200.00"],
        "赔付状态": ["待审核", "已赔付", "待审核", "已驳回", "处理中"],
        "处理人": ["张三", "李四", "张三", "王五", "李四"],
        "备注": ["缺测点数据需补录", "承运商交接单已附", "", "可复跑输出待确认", ""],
    }

    df = pd.DataFrame(data)
    df.to_excel(sample_file, index=False)

    console.print(f"[green]✓ 样例文件已生成: {sample_file}[/green]")
    console.print("\n[cyan]样例数据说明:[/cyan]")
    console.print("  - 包含5条冷链赔付记录")
    console.print("  - 覆盖不同仓库、承运商、异常类型")
    console.print("  - 包含缺测点、承运商交接、可复跑输出等业务场景")
    console.print("  - 可使用此文件测试工具功能")
