"""ABS现金流瀑布复核工具 - 命令行接口"""

import sys
import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console

from .models import DealStructure, WaterfallResult, Discrepancy
from .data_loader import DataLoader
from .trigger_detector import TriggerDetector
from .waterfall_engine import WaterfallEngine
from .discrepancy_detector import DiscrepancyDetector
from .report_generator import ReportGenerator

console = Console()


def _parse_date(date_str: str) -> date:
    """解析日期字符串"""
    formats = ["%Y-%m-%d", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise click.BadParameter(f"无法解析日期: {date_str}，请使用 YYYY-MM-DD 格式")


def _run_pipeline(
    deal: DealStructure,
    period_start: date,
    period_end: date,
    test_date: Optional[date] = None,
) -> tuple:
    """执行完整的复核流程"""

    if test_date is None:
        test_date = period_end

    trigger_detector = TriggerDetector(deal, test_date)
    trigger_results = trigger_detector.run_tests()

    engine = WaterfallEngine(deal, period_start, period_end)
    waterfall_result = engine.run_waterfall(trigger_results)

    discrepancy_detector = DiscrepancyDetector(deal, waterfall_result)
    discrepancies = discrepancy_detector.run_all_checks()

    waterfall_result.discrepancies = discrepancies

    return deal, waterfall_result, discrepancies


@click.group()
@click.version_option(version="0.1.0", prog_name="abs-waterfall")
def main():
    """ABS现金流瀑布复核工具

    用于投行助理复核资产证券化现金流分配，包括：
    - 现金流瀑布计算
    - 触发事件检测
    - 分层分配复核
    - 差错检测与解释
    - 报告生成与导出
    """
    pass


@main.command()
@click.option('--input', '-i', 'input_file', required=True, type=click.Path(exists=True), help='交易数据JSON文件路径')
@click.option('--period-start', '-s', required=True, help='计息区间开始日期 (YYYY-MM-DD)')
@click.option('--period-end', '-e', required=True, help='计息区间结束日期 (YYYY-MM-DD)')
@click.option('--test-date', '-t', help='触发事件测试日期 (YYYY-MM-DD)，默认为区间结束日')
@click.option('--output-json', '-j', type=click.Path(), help='机器可读JSON报告输出路径')
@click.option('--output-report', '-r', type=click.Path(), help='人可读文本报告输出路径')
@click.option('--no-terminal', is_flag=True, help='不显示终端摘要')
@click.option('--exit-code', is_flag=True, help='根据差错级别设置退出码(0=无问题,1=中低风险,2=高风险)')
def run(
    input_file: str,
    period_start: str,
    period_end: str,
    test_date: Optional[str],
    output_json: Optional[str],
    output_report: Optional[str],
    no_terminal: bool,
    exit_code: bool,
):
    """运行完整的现金流瀑布复核流程"""

    try:
        ps = _parse_date(period_start)
        pe = _parse_date(period_end)
        td = _parse_date(test_date) if test_date else None

        if ps >= pe:
            raise click.BadParameter("计息区间开始日期必须早于结束日期")

        with console.status("[bold cyan]正在加载交易数据...", spinner="dots"):
            deal = DataLoader.load_from_json(input_file)
            console.print(f"✓ 已加载交易: [bold]{deal.deal_name}[/] ({deal.deal_id})")

        with console.status("[bold cyan]正在执行现金流瀑布计算...", spinner="dots"):
            deal, result, discrepancies = _run_pipeline(deal, ps, pe, td)
            console.print(f"✓ 现金流计算完成，共分配 [bold green]¥{result.total_cash_outflow:,.2f}[/]")
            console.print(f"✓ 检测到 [bold red]{len(discrepancies)}[/] 项差错")

        reporter = ReportGenerator(deal, result, discrepancies)

        if not no_terminal:
            reporter.generate_terminal_summary()

        if output_json:
            with console.status(f"[bold cyan]正在生成机器可读报告: {output_json}...", spinner="dots"):
                reporter.generate_machine_readable(output_json)
                console.print(f"✓ 机器可读报告已保存: [bold]{output_json}[/]")

        if output_report:
            with console.status(f"[bold cyan]正在生成人可读报告: {output_report}...", spinner="dots"):
                reporter.generate_human_readable(output_report)
                console.print(f"✓ 人可读报告已保存: [bold]{output_report}[/]")

        if exit_code:
            has_critical = any(d.severity == "CRITICAL" for d in discrepancies)
            has_high = any(d.severity == "HIGH" for d in discrepancies)
            has_medium = any(d.severity == "MEDIUM" for d in discrepancies)

            if has_critical or has_high:
                sys.exit(2)
            elif has_medium:
                sys.exit(1)
            else:
                sys.exit(0)

    except Exception as e:
        console.print(f"[bold red]✗ 执行失败: {str(e)}[/]")
        import traceback
        console.print(traceback.format_exc(), style="dim")
        sys.exit(1)


@main.command()
@click.option('--input', '-i', 'input_file', required=True, type=click.Path(exists=True), help='交易数据JSON文件路径')
@click.option('--output', '-o', 'output_file', required=True, type=click.Path(), help='输出文件路径')
@click.option('--period-start', '-s', required=True, help='计息区间开始日期 (YYYY-MM-DD)')
@click.option('--period-end', '-e', required=True, help='计息区间结束日期 (YYYY-MM-DD)')
@click.option('--test-date', '-t', help='触发事件测试日期 (YYYY-MM-DD)')
def export_json(
    input_file: str,
    output_file: str,
    period_start: str,
    period_end: str,
    test_date: Optional[str],
):
    """导出机器可读JSON格式的复核结果"""

    try:
        ps = _parse_date(period_start)
        pe = _parse_date(period_end)
        td = _parse_date(test_date) if test_date else None

        deal = DataLoader.load_from_json(input_file)
        deal, result, discrepancies = _run_pipeline(deal, ps, pe, td)

        reporter = ReportGenerator(deal, result, discrepancies)
        reporter.generate_machine_readable(output_file)

        console.print(f"✓ 机器可读报告已导出: [bold]{output_file}[/]")
        console.print(f"  - 总差错数: [bold red]{len(discrepancies)}[/]")

    except Exception as e:
        console.print(f"[bold red]✗ 导出失败: {str(e)}[/]")
        sys.exit(1)


@main.command()
@click.option('--input', '-i', 'input_file', required=True, type=click.Path(exists=True), help='交易数据JSON文件路径')
@click.option('--output', '-o', 'output_file', required=True, type=click.Path(), help='输出文件路径')
@click.option('--period-start', '-s', required=True, help='计息区间开始日期 (YYYY-MM-DD)')
@click.option('--period-end', '-e', required=True, help='计息区间结束日期 (YYYY-MM-DD)')
@click.option('--test-date', '-t', help='触发事件测试日期 (YYYY-MM-DD)')
def export_report(
    input_file: str,
    output_file: str,
    period_start: str,
    period_end: str,
    test_date: Optional[str],
):
    """导出人可读的文本格式复核报告"""

    try:
        ps = _parse_date(period_start)
        pe = _parse_date(period_end)
        td = _parse_date(test_date) if test_date else None

        deal = DataLoader.load_from_json(input_file)
        deal, result, discrepancies = _run_pipeline(deal, ps, pe, td)

        reporter = ReportGenerator(deal, result, discrepancies)
        reporter.generate_human_readable(output_file)

        console.print(f"✓ 人可读报告已导出: [bold]{output_file}[/]")
        console.print(f"  - 总差错数: [bold red]{len(discrepancies)}[/]")

    except Exception as e:
        console.print(f"[bold red]✗ 导出失败: {str(e)}[/]")
        sys.exit(1)


@main.command()
@click.option('--input', '-i', 'input_file', required=True, type=click.Path(exists=True), help='交易数据JSON文件路径')
def validate(input_file: str):
    """验证交易数据格式是否正确"""

    try:
        with console.status("[bold cyan]正在验证数据格式...", spinner="dots"):
            deal = DataLoader.load_from_json(input_file)

        console.print("[bold green]✓ 数据格式验证通过[/]")
        console.print()
        console.print("交易概要:")
        console.print(f"  交易名称: {deal.deal_name}")
        console.print(f"  交易代码: {deal.deal_id}")
        console.print(f"  基础资产数: {len(deal.assets)}")
        console.print(f"  分层数: {len(deal.tranches)}")
        console.print(f"  服务费项数: {len(deal.servicing_fees)}")
        console.print(f"  触发事件数: {len(deal.trigger_events)}")
        console.print(f"  违约记录数: {len(deal.default_records)}")
        console.print(f"  现金流记录数: {len(deal.cashflows)}")
        console.print(f"  分配抽样数: {len(deal.allocation_samples)}")
        console.print()
        console.print(f"  归集账户余额: ¥{deal.collection_account_balance:,.2f}")
        console.print(f"  储备金余额: ¥{deal.reserve_account_balance:,.2f}")

    except Exception as e:
        console.print(f"[bold red]✗ 数据格式验证失败: {str(e)}[/]")
        import traceback
        console.print(traceback.format_exc(), style="dim")
        sys.exit(1)


@main.command()
@click.option('--output', '-o', 'output_dir', default='sample_data', type=click.Path(), help='输出目录')
def generate_sample(output_dir: str):
    """生成示例数据文件"""

    try:
        import shutil
        src = Path(__file__).parent.parent.parent / "sample_data" / "deal_with_issues.json"
        dst = Path(output_dir) / "deal_with_issues.json"

        if src.exists():
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
            console.print(f"✓ 示例数据已生成: [bold]{dst}[/]")
            console.print()
            console.print("使用示例:")
            console.print(f"  abs-waterfall run -i {dst} -s 2025-01-01 -e 2025-01-31 --exit-code")
        else:
            console.print(f"[bold yellow]! 源文件不存在，正在创建默认示例...[/]")
            deal_path = Path(output_dir) / "deal_template.json"
            DataLoader.deal_to_json(
                DataLoader.load_from_json(str(src)) if src.exists() else DealStructure(
                    deal_id="DEMO-001",
                    deal_name="演示交易",
                    closing_date=date(2024, 1, 1),
                    next_payment_date=date(2025, 2, 25),
                ),
                str(deal_path)
            )
            console.print(f"✓ 模板数据已生成: [bold]{deal_path}[/]")

    except Exception as e:
        console.print(f"[bold red]✗ 生成失败: {str(e)}[/]")
        sys.exit(1)


@main.command()
@click.option('--input', '-i', 'input_file', required=True, type=click.Path(exists=True), help='交易数据JSON文件路径')
@click.option('--period-start', '-s', required=True, help='计息区间开始日期 (YYYY-MM-DD)')
@click.option('--period-end', '-e', required=True, help='计息区间结束日期 (YYYY-MM-DD)')
@click.option('--severity', type=click.Choice(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']), help='只显示指定严重级别的差错')
def list_discrepancies(
    input_file: str,
    period_start: str,
    period_end: str,
    severity: Optional[str],
):
    """列出所有检测到的差错"""

    try:
        ps = _parse_date(period_start)
        pe = _parse_date(period_end)

        deal = DataLoader.load_from_json(input_file)
        deal, result, discrepancies = _run_pipeline(deal, ps, pe)

        if severity:
            discrepancies = [d for d in discrepancies if d.severity == severity]

        if not discrepancies:
            console.print("[bold green]✓ 未检测到任何差错[/]")
            return

        from rich.table import Table
        from rich import box

        table = Table(title=f"差错列表 (共{len(discrepancies)}项)", box=box.ROUNDED)
        table.add_column("编号", style="bold")
        table.add_column("严重程度", justify="center")
        table.add_column("差错类型")
        table.add_column("描述")

        severity_styles = {
            "CRITICAL": "bold red on yellow",
            "HIGH": "bold red",
            "MEDIUM": "bold yellow",
            "LOW": "bold blue",
        }

        for d in discrepancies:
            style = severity_styles.get(d.severity, "white")
            table.add_row(
                d.discrepancy_id,
                f"[{style}]{d.severity}[/{style}]",
                d.discrepancy_type.value,
                d.description,
            )

        console.print(table)

    except Exception as e:
        console.print(f"[bold red]✗ 执行失败: {str(e)}[/]")
        sys.exit(1)


if __name__ == "__main__":
    main()
