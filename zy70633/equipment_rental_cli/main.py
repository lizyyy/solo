import click
from pathlib import Path
from .parsers import CSVParser
from .engine import VerificationEngine
from .reports import ReportGenerator
from .utils import BadRecordReporter


@click.group()
def cli():
    """器材配件归还复核押金扣款排查CLI"""
    pass


@cli.command()
@click.option("--equipment", "-e", required=True, help="器材CSV文件路径")
@click.option("--orders", "-o", required=True, help="借用单CSV文件路径")
@click.option("--inspections", "-i", required=True, help="归还检查CSV文件路径")
@click.option("--deductions", "-d", required=True, help="押金扣款CSV文件路径")
@click.option("--output", "-out", default="./reports", help="报告输出目录")
@click.option("--format", "-f", default="all", type=click.Choice(["text", "csv", "all"]), help="输出格式")
def verify(equipment, orders, inspections, deductions, output, format):
    """执行完整的归还复核流程"""
    click.echo("开始解析数据文件...")

    parser = CSVParser()

    try:
        parser.parse_equipment_file(equipment)
        click.echo(f"  ✓ 器材数据解析完成: {len(parser.data.equipments)} 条记录")
    except Exception as e:
        click.echo(f"  ✗ 器材数据解析失败: {e}", err=True)
        return

    try:
        parser.parse_rental_order_file(orders)
        click.echo(f"  ✓ 借用单数据解析完成: {len(parser.data.rental_orders)} 条记录")
    except Exception as e:
        click.echo(f"  ✗ 借用单数据解析失败: {e}", err=True)
        return

    try:
        parser.parse_return_inspection_file(inspections)
        click.echo(f"  ✓ 归还检查数据解析完成: {len(parser.data.return_inspections)} 条记录")
    except Exception as e:
        click.echo(f"  ✗ 归还检查数据解析失败: {e}", err=True)
        return

    try:
        parser.parse_deposit_deduction_file(deductions)
        click.echo(f"  ✓ 押金扣款数据解析完成: {len(parser.data.deposit_deductions)} 条记录")
    except Exception as e:
        click.echo(f"  ✗ 押金扣款数据解析失败: {e}", err=True)
        return

    parsed_data = parser.get_parsed_data()

    if parsed_data.bad_records:
        click.echo(f"  ⚠ 发现 {len(parsed_data.bad_records)} 条数据错误")
        click.echo(BadRecordReporter.format_bad_records(parsed_data.bad_records))

    click.echo("\n开始执行复核...")
    engine = VerificationEngine(parsed_data)
    results = engine.run_verification()
    summary = engine.get_summary()

    click.echo(f"  ✓ 复核完成: {summary['total_orders']} 条订单")
    click.echo(f"    - 已完成: {summary['complete_orders']}")
    click.echo(f"    - 待处理: {summary['pending_orders']}")
    click.echo(f"    - 有问题: {summary['orders_with_issues']}")

    click.echo(f"\n  押金总额: ¥{summary['total_deposit']:.2f}")
    click.echo(f"  扣款总额: ¥{summary['total_deductions']:.2f}")
    click.echo(f"  应退押金: ¥{summary['total_refund']:.2f}")

    click.echo(f"\n开始生成报告到: {output}")
    report_gen = ReportGenerator(results, summary, parsed_data)

    try:
        if format == "text":
            report_gen.generate_text_report(str(Path(output) / "full_report.txt"))
            click.echo("  ✓ 文本报告已生成")
        elif format == "csv":
            report_gen.generate_csv_reports(output)
            click.echo("  ✓ CSV报告已生成")
        else:
            report_gen.generate_all_reports(output)
            click.echo("  ✓ 所有报告已生成")

        click.echo(f"\n✓ 复核完成！报告已保存到: {output}")
    except Exception as e:
        click.echo(f"  ✗ 报告生成失败: {e}", err=True)
        return


@cli.command()
@click.option("--equipment", "-e", required=True, help="器材CSV文件路径")
@click.option("--orders", "-o", required=True, help="借用单CSV文件路径")
@click.option("--inspections", "-i", required=True, help="归还检查CSV文件路径")
@click.option("--deductions", "-d", required=True, help="押金扣款CSV文件路径")
def check_data(equipment, orders, inspections, deductions):
    """仅检查数据文件，不执行完整复核"""
    click.echo("开始检查数据文件...")

    parser = CSVParser()

    files = [
        ("器材", equipment, parser.parse_equipment_file),
        ("借用单", orders, parser.parse_rental_order_file),
        ("归还检查", inspections, parser.parse_return_inspection_file),
        ("押金扣款", deductions, parser.parse_deposit_deduction_file),
    ]

    for name, path, parse_func in files:
        try:
            parse_func(path)
            click.echo(f"  ✓ {name}数据正常")
        except Exception as e:
            click.echo(f"  ✗ {name}数据异常: {e}", err=True)

    parsed_data = parser.get_parsed_data()

    if parsed_data.bad_records:
        click.echo(f"\n⚠ 发现 {len(parsed_data.bad_records)} 条数据错误:")
        click.echo(BadRecordReporter.format_bad_records(parsed_data.bad_records))
    else:
        click.echo("\n✓ 所有数据检查通过！")


@cli.command()
def show_example():
    """显示示例数据文件格式说明"""
    click.echo("=" * 60)
    click.echo("  数据文件格式说明")
    click.echo("=" * 60)

    click.echo("\n1. 器材数据 (equipment.csv):")
    click.echo("   列: 器材ID,器材名称,分类,型号,序列号,购买日期,日租金,押金金额")

    click.echo("\n2. 借用单数据 (orders.csv):")
    click.echo("   列: 借用单ID,器材ID,借用人,部门,借用日期,预计归还日期,实际归还日期,配件清单,已付押金")
    click.echo("   配件清单格式: 配件ID1:名称1:数量1:单价1;配件ID2:名称2:数量2:单价2")

    click.echo("\n3. 归还检查数据 (inspections.csv):")
    click.echo("   列: 检查单ID,借用单ID,检查人,检查日期,器材状态,备注,归还配件")
    click.echo("   器材状态: 无损坏/轻微划痕/中度损坏/严重损坏")

    click.echo("\n4. 押金扣款数据 (deductions.csv):")
    click.echo("   列: 扣款单ID,借用单ID,扣款类型,扣款金额,扣款原因,申请人,审批状态,审批人,审批日期")
    click.echo("   审批状态: 待审批/已批准/已拒绝")

    click.echo("\n" + "=" * 60)


if __name__ == "__main__":
    cli()
