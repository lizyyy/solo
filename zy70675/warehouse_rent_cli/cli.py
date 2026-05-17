import click
import os
from datetime import datetime
from uuid import uuid4
from .core import RentCalculator, DataValidator
from .utils import DataLoader, ReportExporter
from .models import RentRule, BillingReport


@click.group()
def cli():
    """仓租阶梯免租退仓截断排查CLI"""
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(),
    default="./output",
    help="报告输出目录",
)
@click.option(
    "--rule-file",
    "-r",
    type=click.Path(exists=True),
    help="计费规则配置文件(可选，使用默认规则)",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "csv", "excel", "all"]),
    default="all",
    help="输出格式",
)
@click.option(
    "--no-console",
    is_flag=True,
    help="不输出控制台报告",
)
def calculate(input_file, output_dir, rule_file, format, no_console):
    """执行仓租计费计算并生成排查报告"""
    os.makedirs(output_dir, exist_ok=True)

    click.echo(f"📂 加载数据文件: {input_file}")
    raw_data = DataLoader.auto_load(input_file)
    click.echo(f"✓ 共加载 {len(raw_data)} 条记录")

    if rule_file:
        click.echo(f"📋 加载自定义规则: {rule_file}")
        rule_data = DataLoader.auto_load(rule_file)[0]
    else:
        click.echo("📋 使用默认计费规则")
        rule_data = DataLoader.load_default_rules()

    rule = RentRule(**rule_data)

    click.echo("🔍 数据验证中...")
    validator = DataValidator()
    valid_records, parse_errors = validator.validate_batch(raw_data)
    validation_errors = validator.run_all_validations(valid_records)
    all_errors = parse_errors + validation_errors

    click.echo(f"✓ 有效记录: {len(valid_records)} 条")
    if all_errors:
        click.echo(f"⚠ 异常记录: {len(all_errors)} 条")

    click.echo("🧮 计费计算中...")
    calculator = RentCalculator(rule)
    results = calculator.calculate_batch(valid_records)

    total_base = sum(r.base_amount for r in results)
    total_discount = sum(r.discount_amount for r in results)
    total_final = sum(r.final_amount for r in results)

    report_id = f"REPORT_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid4())[:8]}"

    report = BillingReport(
        report_id=report_id,
        generated_at=datetime.now(),
        total_records=len(raw_data),
        valid_records=len(valid_records),
        invalid_records=len(all_errors),
        total_base_amount=total_base,
        total_discount_amount=total_discount,
        total_final_amount=total_final,
        results=results,
        errors=all_errors,
        summary_stats={
            "avg_volume": round(sum(r.volume for r in results) / len(results), 2) if results else 0,
            "avg_days": round(sum(r.effective_occupancy_days for r in results) / len(results), 2) if results else 0,
            "truncation_count": sum(1 for r in results if r.checkout_truncated_days > 0),
            "free_rent_count": sum(1 for r in results if r.free_rent_days_applied > 0),
        },
    )

    click.echo(f"📤 导出报告至: {output_dir}")

    if format in ["json", "all"]:
        json_path = os.path.join(output_dir, f"{report_id}.json")
        ReportExporter.to_json(report, json_path)
        click.echo(f"  ✓ JSON: {os.path.basename(json_path)}")

    if format in ["csv", "all"]:
        csv_path = os.path.join(output_dir, f"{report_id}.csv")
        ReportExporter.to_csv(report, csv_path)
        click.echo(f"  ✓ CSV: {os.path.basename(csv_path)}")

    if format in ["excel", "all"]:
        excel_path = os.path.join(output_dir, f"{report_id}.xlsx")
        ReportExporter.to_excel(report, excel_path)
        click.echo(f"  ✓ Excel: {os.path.basename(excel_path)}")

    if not no_console:
        click.echo("\n")
        ReportExporter.print_console_report(report)

    return report


@cli.command()
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(),
    default="./samples",
    help="样例文件输出目录",
)
@click.option(
    "--type",
    "-t",
    type=click.Choice(["normal", "abnormal", "all"]),
    default="all",
    help="生成样例类型",
)
def generate_samples(output_dir, type):
    """生成样例数据文件用于测试"""
    import json

    os.makedirs(output_dir, exist_ok=True)

    if type in ["normal", "all"]:
        click.echo("📝 生成正常样例数据...")
        normal_samples = [
            {
                "customer_id": "C001",
                "customer_name": "北京商贸有限公司",
                "warehouse_location": "A-01-01",
                "volume": 120,
                "occupancy_days": 45,
                "checkin_date": "2024-03-01T09:00:00",
                "checkout_date": "2024-04-15T10:30:00",
                "free_rent_days": 7,
                "is_checked_out": True,
                "notes": "常规客户",
            },
            {
                "customer_id": "C002",
                "customer_name": "上海物流科技公司",
                "warehouse_location": "B-02-05",
                "volume": 350,
                "occupancy_days": 90,
                "checkin_date": "2024-01-01T08:00:00",
                "checkout_date": "2024-04-01T15:00:00",
                "free_rent_days": 15,
                "is_checked_out": True,
                "notes": "VIP客户，享超长免租",
            },
            {
                "customer_id": "C003",
                "customer_name": "广州电子有限公司",
                "warehouse_location": "C-01-10",
                "volume": 45,
                "occupancy_days": 15,
                "checkin_date": "2024-04-01T10:00:00",
                "checkout_date": None,
                "free_rent_days": 3,
                "is_checked_out": False,
                "notes": "在仓客户",
            },
            {
                "customer_id": "C004",
                "customer_name": "深圳食品供应链",
                "warehouse_location": "A-03-02",
                "volume": 600,
                "occupancy_days": 120,
                "checkin_date": "2024-01-01T00:00:00",
                "checkout_date": "2024-05-01T08:00:00",
                "free_rent_days": 30,
                "is_checked_out": True,
                "notes": "大客户协议价",
            },
            {
                "customer_id": "C005",
                "customer_name": "杭州服装贸易",
                "warehouse_location": "B-01-08",
                "volume": 80,
                "occupancy_days": 5,
                "checkin_date": "2024-04-10T09:00:00",
                "checkout_date": "2024-04-15T06:00:00",
                "free_rent_days": 0,
                "is_checked_out": True,
                "notes": "短租客户，早于12点退仓",
            },
        ]
        normal_path = os.path.join(output_dir, "sample_normal.json")
        with open(normal_path, "w", encoding="utf-8") as f:
            json.dump(normal_samples, f, ensure_ascii=False, indent=2)
        click.echo(f"✓ 正常样例已保存: {normal_path}")

    if type in ["abnormal", "all"]:
        click.echo("📝 生成异常样例数据...")
        abnormal_samples = [
            {
                "customer_id": "C001",
                "customer_name": "重复ID客户",
                "warehouse_location": "A-01-01",
                "volume": 100,
                "occupancy_days": 30,
                "free_rent_days": 7,
                "is_checked_out": False,
            },
            {
                "customer_id": "C001",
                "customer_name": "重复ID客户2号",
                "warehouse_location": "B-02-02",
                "volume": 150,
                "occupancy_days": 45,
                "free_rent_days": 10,
                "is_checked_out": False,
            },
            {
                "customer_id": "C002",
                "customer_name": "免租超长客户",
                "warehouse_location": "C-03-03",
                "volume": 50,
                "occupancy_days": 30,
                "free_rent_days": 90,
                "is_checked_out": False,
            },
            {
                "customer_id": "C003",
                "customer_name": "超大体积客户",
                "warehouse_location": "D-04-04",
                "volume": 2000,
                "occupancy_days": 60,
                "free_rent_days": 15,
                "is_checked_out": False,
            },
            {
                "customer_id": "C004",
                "customer_name": "免租超过天数客户",
                "warehouse_location": "E-05-05",
                "volume": 80,
                "occupancy_days": 10,
                "free_rent_days": 20,
                "is_checked_out": False,
            },
            {
                "customer_id": "",
                "customer_name": "空ID客户",
                "warehouse_location": "F-06-06",
                "volume": -5,
                "occupancy_days": 0,
                "free_rent_days": 5,
                "is_checked_out": False,
            },
            {
                "customer_id": "C005",
                "customer_name": "日期冲突客户",
                "warehouse_location": "G-07-07",
                "volume": 100,
                "occupancy_days": -10,
                "checkin_date": "2024-04-15T00:00:00",
                "checkout_date": "2024-04-01T00:00:00",
                "free_rent_days": 5,
                "is_checked_out": True,
            },
        ]
        abnormal_path = os.path.join(output_dir, "sample_abnormal.json")
        with open(abnormal_path, "w", encoding="utf-8") as f:
            json.dump(abnormal_samples, f, ensure_ascii=False, indent=2)
        click.echo(f"✓ 异常样例已保存: {abnormal_path}")

    click.echo("\n🎉 样例文件生成完成！")
    click.echo(f"   使用方法: python -m warehouse_rent_cli calculate {os.path.join(output_dir, 'sample_normal.json')}")


if __name__ == "__main__":
    cli()
