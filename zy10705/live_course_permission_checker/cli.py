import os
import sys
from datetime import datetime
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .data_reader import DataReader
from .rule_engine import RuleEngine
from .report_generator import ReportGenerator

console = Console()


@click.command(name="直播课程资料回放权限核查 CLI")
@click.option(
    "--input-path", "-i",
    required=True,
    type=click.Path(exists=True, file_okay=True, dir_okay=True, path_type=Path),
    help="输入数据文件路径（支持单个 CSV/Excel 文件或目录）"
)
@click.option(
    "--rules-file", "-r",
    required=True,
    type=click.Path(exists=True, file_okay=True, dir_okay=False, path_type=Path),
    help="业务规则配置文件路径"
)
@click.option(
    "--output-dir", "-o",
    required=True,
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    help="核查结果输出目录"
)
@click.option(
    "--dry-run", "-d",
    is_flag=True,
    default=False,
    help="试运行模式，只输出统计信息不生成文件"
)
@click.option(
    "--overwrite", "-f",
    is_flag=True,
    default=False,
    help="强制覆盖已存在的输出文件"
)
def main(input_path: Path, rules_file: Path, output_dir: Path, dry_run: bool, overwrite: bool):
    """
    直播课程资料回放权限核查 CLI - 核查用户观看权限，识别异常情况

    重点核查场景：
    - 退款后观看
    - 换班学员
    - 补录订单
    - 不该观看的用户
    - 漏授权用户
    """
    console.print(Panel.fit(
        "直播课程资料回放权限核查 CLI\n"
        "Live Course Playback Permission Checker",
        border_style="blue",
        style="bold blue"
    ))

    start_time = datetime.now()
    console.print(f"\n开始核查时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}", style="cyan")
    console.print(f"输入路径: {input_path}", style="cyan")
    console.print(f"规则文件: {rules_file}", style="cyan")
    console.print(f"输出目录: {output_dir}", style="cyan")
    console.print(f"试运行模式: {'是' if dry_run else '否'}", style="cyan")
    console.print(f"覆盖模式: {'是' if overwrite else '否'}", style="cyan")

    if not dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)
        if any(output_dir.iterdir()) and not overwrite:
            console.print("错误: 输出目录不为空，请使用 --overwrite 强制覆盖", style="bold red")
            sys.exit(1)

    try:
        data_reader = DataReader(console)
        rule_engine = RuleEngine(console)
        report_generator = ReportGenerator(console, output_dir, dry_run)

        console.print("\n步骤 1/4: 读取并校验数据...", style="bold yellow")
        datasets, data_issues = data_reader.read(input_path)

        console.print("\n步骤 2/4: 加载业务规则...", style="bold yellow")
        rules = rule_engine.load_rules(rules_file)

        console.print("\n步骤 3/4: 执行权限核查...", style="bold yellow")
        results = rule_engine.check_permissions(datasets, rules)

        console.print("\n步骤 4/4: 生成核查报告...", style="bold yellow")
        report_generator.generate(results, data_issues)

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        console.print()
        console.print(Panel.fit(
            "✓ 核查完成\n"
            f"总耗时: {duration:.2f} 秒\n"
            f"输出目录: {output_dir if not dry_run else '试运行模式，无文件输出'}",
            border_style="green",
            style="bold green"
        ))

    except Exception as e:
        console.print(f"\n核查失败: {str(e)}", style="bold red")
        console.print_exception()
        sys.exit(1)


if __name__ == "__main__":
    main()
