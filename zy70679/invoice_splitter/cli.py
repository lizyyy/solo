import argparse
import json
import sys
import os
from datetime import datetime
from decimal import Decimal
from typing import List

from .models import InvoiceItem, Traveler
from .splitter import InvoiceSplitter
from .validator import InvoiceValidator
from .reporter import ReportGenerator


def load_json_file(filepath: str):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_invoices(data) -> List[InvoiceItem]:
    invoices = []
    for inv_data in data.get("invoices", []):
        invoice = InvoiceItem(
            invoice_no=inv_data["invoice_no"],
            invoice_date=inv_data.get("invoice_date", ""),
            total_amount=Decimal(str(inv_data["total_amount"])),
            total_tax=Decimal(str(inv_data["total_tax"])),
            invoice_type=inv_data.get("invoice_type", "hotel"),
            vendor_name=inv_data.get("vendor_name", ""),
            tax_rate=Decimal(str(inv_data.get("tax_rate", "0.06"))),
        )
        invoices.append(invoice)
    return invoices


def parse_travelers(data) -> List[Traveler]:
    travelers = []
    for trav_data in data.get("travelers", []):
        traveler = Traveler(
            name=trav_data["name"],
            employee_id=trav_data["employee_id"],
            project_code=trav_data["project_code"],
            weight=Decimal(str(trav_data.get("weight", "1"))),
        )
        travelers.append(traveler)
    return travelers


def run_split(args):
    splitter = InvoiceSplitter()
    validator = InvoiceValidator()
    reporter = ReportGenerator()

    all_split_results = []

    if args.input:
        data = load_json_file(args.input)
        invoices = parse_invoices(data)
        travelers = parse_travelers(data)
    else:
        print("请提供输入文件")
        sys.exit(1)

    for invoice in invoices:
        is_duplicate, dup_msg = validator.check_duplicate(invoice.invoice_no)
        if not is_duplicate:
            continue

        is_valid, inv_errors = validator.validate_invoice(invoice)
        if not is_valid:
            continue

        is_travelers_valid, trav_errors = validator.validate_travelers(
            travelers
        )
        if not is_travelers_valid:
            continue

        try:
            split_results = splitter.split_invoice(invoice, travelers)
            all_split_results.extend(split_results)
        except Exception as e:
            validator.errors.append(f"发票{invoice.invoice_no}拆分失败: {str(e)}")

    report = reporter.generate_report(
        all_split_results,
        validator.warnings,
        validator.errors,
    )

    output_dir = args.output or "."
    os.makedirs(output_dir, exist_ok=True)

    base_filename = f"invoice_split_report_{report.report_id}"

    human_file = os.path.join(output_dir, f"{base_filename}.txt")
    json_file = os.path.join(output_dir, f"{base_filename}.json")
    csv_file = os.path.join(output_dir, f"{base_filename}.csv")

    with open(human_file, "w", encoding="utf-8") as f:
        f.write(reporter.export_human_readable(report))

    with open(json_file, "w", encoding="utf-8") as f:
        f.write(reporter.export_json(report))

    with open(csv_file, "w", encoding="utf-8") as f:
        f.write(reporter.export_csv(report))

    print(reporter.export_human_readable(report))
    print(f"\n报告已导出到:")
    print(f"  人类可读: {human_file}")
    print(f"  JSON: {json_file}")
    print(f"  CSV: {csv_file}")


def run_validate(args):
    data = load_json_file(args.input)
    validator = InvoiceValidator()

    invoices = parse_invoices(data)

    for invoice in invoices:
        validator.check_duplicate(invoice.invoice_no)
        validator.validate_invoice(invoice)

    summary = validator.get_validation_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def create_sample(args):
    sample_type = args.type or "normal"
    output_dir = args.output or "."
    os.makedirs(output_dir, exist_ok=True)

    if sample_type == "normal":
        sample_data = {
            "description": "正常输入样例 - 3人酒店发票按项目拆分",
            "invoices": [
                {
                    "invoice_no": "HTL20240501001",
                    "invoice_date": "2024-05-01",
                    "total_amount": 3180.00,
                    "total_tax": 180.00,
                    "invoice_type": "hotel",
                    "vendor_name": "XX大酒店",
                    "tax_rate": 0.06,
                }
            ],
            "travelers": [
                {
                    "name": "张三",
                    "employee_id": "E001",
                    "project_code": "PRJ-A-2024",
                    "weight": 1,
                },
                {
                    "name": "李四",
                    "employee_id": "E002",
                    "project_code": "PRJ-B-2024",
                    "weight": 1,
                },
                {
                    "name": "王五",
                    "employee_id": "E003",
                    "project_code": "PRJ-A-2024",
                    "weight": 1,
                },
            ],
        }
        filename = "sample_normal.json"
    elif sample_type == "dirty":
        sample_data = {
            "description": "脏数据样例 - 包含格式错误",
            "invoices": [
                {
                    "invoice_no": "INV-DIRTY-001",
                    "invoice_date": "2024/05/01",
                    "total_amount": -100.00,
                    "total_tax": -6.00,
                    "invoice_type": "hotel",
                    "vendor_name": "测试酒店",
                    "tax_rate": 0.06,
                }
            ],
            "travelers": [
                {"name": "", "employee_id": "", "project_code": "", "weight": 0}
            ],
        }
        filename = "sample_dirty.json"
    elif sample_type == "boundary":
        sample_data = {
            "description": "边界冲突样例 - 税额尾差问题",
            "invoices": [
                {
                    "invoice_no": "INV-BOUNDARY-001",
                    "invoice_date": "2024-05-01",
                    "total_amount": 100.00,
                    "total_tax": 5.66,
                    "invoice_type": "hotel",
                    "vendor_name": "边界测试酒店",
                    "tax_rate": 0.06,
                }
            ],
            "travelers": [
                {
                    "name": "测试人A",
                    "employee_id": "TEST-A",
                    "project_code": "TEST-PRJ",
                    "weight": 1,
                },
                {
                    "name": "测试人B",
                    "employee_id": "TEST-B",
                    "project_code": "TEST-PRJ",
                    "weight": 1,
                },
                {
                    "name": "测试人C",
                    "employee_id": "TEST-C",
                    "project_code": "TEST-PRJ",
                    "weight": 1,
                },
            ],
        }
        filename = "sample_boundary.json"
    elif sample_type == "duplicate":
        sample_data = {
            "description": "重复发票样例",
            "invoices": [
                {
                    "invoice_no": "INV-DUP-001",
                    "invoice_date": "2024-05-01",
                    "total_amount": 1060.00,
                    "total_tax": 60.00,
                    "invoice_type": "hotel",
                    "vendor_name": "重复测试酒店",
                    "tax_rate": 0.06,
                },
                {
                    "invoice_no": "INV-DUP-001",
                    "invoice_date": "2024-05-01",
                    "total_amount": 1060.00,
                    "total_tax": 60.00,
                    "invoice_type": "hotel",
                    "vendor_name": "重复测试酒店",
                    "tax_rate": 0.06,
                },
            ],
            "travelers": [
                {
                    "name": "测试人",
                    "employee_id": "TEST-001",
                    "project_code": "TEST-PRJ",
                    "weight": 1,
                }
            ],
        }
        filename = "sample_duplicate.json"
    else:
        sample_data = {
            "description": "空结果样例",
            "invoices": [],
            "travelers": [],
        }
        filename = "sample_empty.json"

    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)

    print(f"样例文件已创建: {filepath}")
    print(f"描述: {sample_data['description']}")


def main():
    parser = argparse.ArgumentParser(
        prog="invoice-splitter",
        description="酒旅发票项目拆分税额校正排查CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  invoice-splitter split -i input.json -o ./reports    # 执行拆分并生成报告
  invoice-splitter validate -i input.json              # 验证输入数据
  invoice-splitter sample -t normal                    # 生成正常输入样例
  invoice-splitter sample -t dirty                     # 生成脏数据样例
  invoice-splitter sample -t boundary                  # 生成边界冲突样例
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    split_parser = subparsers.add_parser("split", help="执行发票拆分")
    split_parser.add_argument(
        "-i", "--input", required=True, help="输入JSON文件路径"
    )
    split_parser.add_argument("-o", "--output", help="输出目录路径")

    validate_parser = subparsers.add_parser("validate", help="验证输入数据")
    validate_parser.add_argument(
        "-i", "--input", required=True, help="输入JSON文件路径"
    )

    sample_parser = subparsers.add_parser("sample", help="生成样例输入文件")
    sample_parser.add_argument(
        "-t",
        "--type",
        choices=["normal", "dirty", "boundary", "duplicate", "empty"],
        default="normal",
        help="样例类型",
    )
    sample_parser.add_argument("-o", "--output", help="输出目录路径")

    args = parser.parse_args()

    if args.command == "split":
        run_split(args)
    elif args.command == "validate":
        run_validate(args)
    elif args.command == "sample":
        create_sample(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
