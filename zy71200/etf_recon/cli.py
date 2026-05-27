import click
import os
from pathlib import Path

from .reader import DataReader
from .reconciler import ETFReconciler
from .reporter import ResultReporter


@click.group()
@click.version_option(version="0.1.0", prog_name="etf-recon")
def main():
    """ETF申赎成分券差异校验工具"""
    pass


@main.command()
@click.option("--redemption", "-r", required=True, help="申赎清单文件路径 (CSV/Excel)")
@click.option("--receipt", "-b", required=True, help="券商回执文件路径 (CSV/Excel)")
@click.option("--suspended", "-s", help="停牌日历文件路径 (CSV/Excel)")
@click.option("--cash-sub", "-c", help="替代现金清单文件路径 (CSV/Excel)")
@click.option("--output-dir", "-o", default="./output", help="输出目录")
@click.option("--format", "-f", "output_format", multiple=True, 
              type=click.Choice(["json", "html", "csv"]),
              default=["json", "html"],
              help="输出格式 (可多选)")
@click.option("--no-terminal", is_flag=True, help="不显示终端输出")
def reconcile(redemption, receipt, suspended, cash_sub, output_dir, output_format, no_terminal):
    """执行ETF申赎成分券差异校验"""

    reader = DataReader()
    reconciler = ETFReconciler()
    reporter = ResultReporter()

    source_files = {
        "申赎清单": redemption,
        "券商回执": receipt,
    }
    if suspended:
        source_files["停牌日历"] = suspended
    if cash_sub:
        source_files["替代现金清单"] = cash_sub

    try:
        redemption_list = reader.read_redemption_list(redemption)
        broker_receipt = reader.read_broker_receipt(receipt)

        suspended_securities = reader.read_suspended_securities(suspended) if suspended else None
        cash_substitutions = reader.read_cash_substitution(cash_sub) if cash_sub else None

    except Exception as e:
        click.echo(f"❌ 读取文件失败: {e}", err=True)
        raise click.Abort()

    result = reconciler.reconcile(
        redemption_list=redemption_list,
        broker_receipt=broker_receipt,
        suspended_securities=suspended_securities,
        cash_substitutions=cash_substitutions,
        source_files=source_files,
    )

    if not no_terminal:
        reporter.print_terminal_summary(result)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    base_filename = f"{result.etf_code}_{result.trade_date}_{result.broker_name}"

    outputs = []
    if "json" in output_format:
        json_path = output_path / f"{base_filename}.json"
        outputs.append(reporter.export_json(result, str(json_path)))

    if "html" in output_format:
        html_path = output_path / f"{base_filename}.html"
        outputs.append(reporter.export_html_report(result, str(html_path)))

    if "csv" in output_format:
        csv_path = output_path / f"{base_filename}.csv"
        outputs.append(reporter.export_csv(result, str(csv_path)))

    click.echo(f"\n📁 输出文件:")
    for output in outputs:
        click.echo(f"   • {output}")

    return result


@main.command()
@click.option("--output-dir", "-o", default="./sample_data", help="样例数据输出目录")
def generate_samples(output_dir):
    """生成测试样例数据"""
    import csv
    from datetime import date, datetime

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    redemption_data = [
        ["ETF代码", "ETF名称", "交易日期", "最小申赎单位", "现金替代总金额", "预估现金"],
        ["510300", "沪深300ETF", "2024-01-15", "1000000", "156000.00", "5230.50"],
        [],
        ["证券代码", "证券名称", "数量", "证券类型", "替代标志", "替代金额"],
        ["600000", "浦发银行", "32000", "股票", "禁止", "0.00"],
        ["600036", "招商银行", "15000", "股票", "允许", "0.00"],
        ["601318", "中国平安", "8500", "股票", "禁止", "0.00"],
        ["000001", "平安银行", "18000", "股票", "必须", "234000.00"],
        ["000858", "五粮液", "3200", "股票", "禁止", "0.00"],
        ["600519", "贵州茅台", "200", "股票", "允许", "0.00"],
        ["601899", "紫金矿业", "56000", "股票", "禁止", "0.00"],
    ]

    receipt_data = [
        ["券商名称", "回执时间", "版本号", "回执状态", "实际现金替代总额", "实际现金", "备注"],
        ["中信证券", "2024-01-15 09:15:23", "1", "最终回执", "245000.00", "5230.50", ""],
        [],
        ["证券代码", "证券名称", "实际数量", "替代标志", "实际替代金额"],
        ["600000", "浦发银行", "32000", "禁止", "0.00"],
        ["600036", "招商银行", "14800", "禁止", "0.00"],
        ["601318", "中国平安", "8500", "禁止", "0.00"],
        ["000001", "平安银行", "18000", "必须", "234000.00"],
        ["000858", "五粮液", "3200", "禁止", "0.00"],
        ["600519", "贵州茅台", "200", "禁止", "0.00"],
        ["601899", "紫金矿业", "56000", "禁止", "0.00"],
        ["601398", "工商银行", "1000", "禁止", "11000.00"],
    ]

    suspended_data = [
        ["证券代码", "证券名称", "停牌日期", "停牌原因", "是否复牌"],
        ["000001", "平安银行", "2024-01-15", "重大事项公告", "否"],
        ["600036", "招商银行", "2024-01-14", "临时停牌", "是"],
    ]

    cash_sub_data = [
        ["证券代码", "证券名称", "替代类型", "替代金额", "单位价格", "数量"],
        ["000001", "平安银行", "必须替代", "234000.00", "13.00", "18000"],
        ["601398", "工商银行", "额外替代", "11000.00", "11.00", "1000"],
        ["601398", "工商银行", "重复记录", "11000.00", "11.00", "1000"],
    ]

    with open(output_path / "redemption_list.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(redemption_data)

    with open(output_path / "broker_receipt.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(receipt_data)

    with open(output_path / "suspended.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(suspended_data)

    with open(output_path / "cash_substitution.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(cash_sub_data)

    click.echo(f"✅ 测试样例数据已生成到: {output_path}")
    click.echo(f"   • redemption_list.csv - 申赎清单")
    click.echo(f"   • broker_receipt.csv - 券商回执")
    click.echo(f"   • suspended.csv - 停牌日历")
    click.echo(f"   • cash_substitution.csv - 替代现金清单")
    click.echo(f"\n💡 运行校验命令:")
    click.echo(f"   etf-recon reconcile -r {output_path}/redemption_list.csv -b {output_path}/broker_receipt.csv -s {output_path}/suspended.csv -c {output_path}/cash_substitution.csv")


if __name__ == "__main__":
    main()
