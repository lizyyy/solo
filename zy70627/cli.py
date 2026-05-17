#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from models import (
    Customer, TreatmentPackage, PackageItem, VerificationRecord,
    ExtensionRequest, PackageStatus, ExtensionStatus
)
from rules_engine import RulesEngine


def parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise argparse.ArgumentTypeError(f"无效日期格式: {date_str}，请使用 YYYY-MM-DD")


class CLIAuditReporter:
    def __init__(self, engine: RulesEngine):
        self.engine = engine

    def format_human_readable(self, audit_result: dict) -> str:
        if "error" in audit_result:
            return f"❌ 错误: {audit_result['error']}"

        lines = []
        lines.append("=" * 60)
        lines.append(f"疗程核销审计报告 - {audit_result['package_id']}")
        lines.append("=" * 60)
        lines.append(f"生成时间: {audit_result['audit_timestamp']}")
        lines.append("")

        lines.append("【顾客信息】")
        lines.append(f"  顾客ID: {audit_result['customer']['customer_id']}")
        lines.append(f"  姓名: {audit_result['customer']['name']}")
        lines.append(f"  电话: {audit_result['customer']['phone']}")
        lines.append("")

        lines.append("【套餐基本信息】")
        lines.append(f"  套餐名称: {audit_result['package_name']}")
        lines.append(f"  原始门店: {audit_result['original_store']}")
        lines.append(f"  当前门店: {audit_result['current_store']}")
        lines.append(f"  套餐状态: {audit_result['status']}")
        lines.append(f"  是否已转店: {'是' if audit_result['transferred'] else '否'}")
        if audit_result['transfer_history']:
            lines.append(f"  转店历史: {' → '.join(audit_result['transfer_history'])}")
        lines.append("")

        lines.append("【过期状态】")
        expiry_status = audit_result['expiry_status']
        status_icon = "✅" if expiry_status == "valid" else "⚠️" if expiry_status == "warning" else "❌"
        lines.append(f"  {status_icon} {audit_result['expiry_message']}")
        if 'effective_expiry' in audit_result['expiry_details']:
            lines.append(f"  有效到期日: {audit_result['expiry_details']['effective_expiry'].strftime('%Y-%m-%d')}")
        lines.append("")

        lines.append("【项目明细】")
        lines.append(f"  {'项目名称':<15} {'购买':>4} {'已用':>4} {'赠送':>4} {'剩余':>4}")
        lines.append(f"  {'-'*15} {'-'*4} {'-'*4} {'-'*4} {'-'*4}")
        for item in audit_result['items']:
            lines.append(
                f"  {item['name']:<15} "
                f"{item['total_count']:>4} "
                f"{item['used_count']:>4} "
                f"{item['gifted_count']:>4} "
                f"{item['remaining_count']:>4}"
            )
        lines.append("")

        lines.append("【核销对账】")
        rec = audit_result['reconciliation']
        lines.append(f"  总核销记录数: {rec['total_verifications']}")
        if rec['discrepancies']:
            lines.append("  ⚠️ 发现对账差异:")
            for disc in rec['discrepancies']:
                diff_type = "多记" if disc['difference'] > 0 else "少记"
                lines.append(
                    f"    - {disc['item_name']}: 系统记录{disc['recorded_used']}次, "
                    f"实际核销{disc['actual_verifications']}次, "
                    f"{diff_type}{abs(disc['difference'])}次"
                )
        else:
            lines.append("  ✅ 核销记录对账一致")
        lines.append("")

        return "\n".join(lines)

    def format_machine_readable(self, audit_result: dict) -> str:
        def datetime_encoder(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        return json.dumps(audit_result, ensure_ascii=False, indent=2, default=datetime_encoder)

    def export_report(self, audit_result: dict, output_file: str = None, format_type: str = "both"):
        json_result = json.loads(self.format_machine_readable(audit_result))
        human_text = self.format_human_readable(audit_result)

        if output_file:
            base_path = Path(output_file)
            if format_type in ["json", "both"]:
                json_file = base_path.with_suffix('.json')
                with open(json_file, 'w', encoding='utf-8') as f:
                    json.dump(json_result, f, ensure_ascii=False, indent=2)
                print(f"✅ JSON报告已导出: {json_file}")

            if format_type in ["text", "both"]:
                txt_file = base_path.with_suffix('.txt')
                with open(txt_file, 'w', encoding='utf-8') as f:
                    f.write(human_text)
                print(f"✅ 文本报告已导出: {txt_file}")
        else:
            if format_type in ["text", "both"]:
                print(human_text)
            if format_type in ["json", "both"]:
                print("\n" + "=" * 60)
                print("JSON输出:")
                print("=" * 60)
                print(self.format_machine_readable(audit_result))


def load_sample_data(engine: RulesEngine, sample_type: str = "normal"):
    base_date = datetime(2026, 5, 17)

    if sample_type == "normal":
        customers = [
            Customer("C001", "张美丽", "13800138001"),
            Customer("C002", "李漂亮", "13800138002"),
        ]

        packages = [
            TreatmentPackage(
                "P001", "C001", "STORE_A", "STORE_A",
                "美白嫩肤套餐",
                [
                    PackageItem("ITEM001", "美白护理", 10, 3, 2),
                    PackageItem("ITEM002", "补水护理", 10, 2, 1),
                ],
                datetime(2026, 1, 1),
                datetime(2026, 12, 31),
                PackageStatus.ACTIVE
            ),
            TreatmentPackage(
                "P002", "C002", "STORE_B", "STORE_B",
                "抗衰老套餐",
                [
                    PackageItem("ITEM003", "紧致护理", 5, 1, 0),
                ],
                datetime(2026, 3, 1),
                datetime(2026, 5, 20),
                PackageStatus.ACTIVE
            ),
        ]

        verifications = [
            VerificationRecord("", "P001", "ITEM001", "STORE_A", "C001", datetime(2026, 2, 1), False, ""),
            VerificationRecord("", "P001", "ITEM001", "STORE_A", "C001", datetime(2026, 2, 15), True, "赠送"),
            VerificationRecord("", "P001", "ITEM001", "STORE_A", "C001", datetime(2026, 3, 1), False, ""),
            VerificationRecord("", "P001", "ITEM002", "STORE_A", "C001", datetime(2026, 2, 10), False, ""),
            VerificationRecord("", "P001", "ITEM002", "STORE_A", "C001", datetime(2026, 3, 5), True, "赠送"),
            VerificationRecord("", "P002", "ITEM003", "STORE_B", "C002", datetime(2026, 4, 1), False, ""),
        ]

        extensions = [
            ExtensionRequest("", "P001", "C001", datetime(2026, 11, 1),
                             datetime(2026, 12, 31), datetime(2027, 2, 28),
                             "春节延期", ExtensionStatus.APPROVED, "经理A", datetime(2026, 11, 2)),
        ]

    elif sample_type == "dirty":
        customers = [
            Customer("C003", "王大方", "13800138003"),
        ]

        packages = [
            TreatmentPackage(
                "P003", "C003", "STORE_A", "STORE_C",
                "问题套餐",
                [
                    PackageItem("ITEM004", "按摩护理", 10, 15, 5),
                ],
                datetime(2025, 1, 1),
                datetime(2027, 12, 31),
                PackageStatus.ACTIVE,
                True,
                ["STORE_A", "STORE_B", "STORE_C", "STORE_D"]
            ),
        ]

        verifications = [
            VerificationRecord("", "P003", "ITEM004", "STORE_A", "C003", datetime(2025, 2, 1), False, ""),
            VerificationRecord("", "P003", "ITEM004", "STORE_B", "C003", datetime(2025, 3, 1), False, ""),
        ]

        extensions = [
            ExtensionRequest("", "P003", "C003", datetime(2025, 12, 1),
                             datetime(2025, 12, 31), datetime(2026, 3, 31),
                             "已审批延期", ExtensionStatus.APPROVED, "经理A", datetime(2025, 12, 2)),
        ]

    elif sample_type == "empty":
        customers = []
        packages = []
        verifications = []
        extensions = []

    else:
        raise ValueError(f"未知样例类型: {sample_type}")

    engine.load_data(customers, packages, verifications, extensions)
    print(f"✅ 已加载{sample_type}样例数据")


def main():
    parser = argparse.ArgumentParser(
        description="疗程核销转店延期状态排查CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python cli.py audit --sample normal P001
  python cli.py transfer P001 STORE_B
  python cli.py gift P001 ITEM001 2
  python cli.py extension P001 2027-06-30 "客户特殊申请"
  python cli.py expiry P001
  python cli.py reconcile P001
  python cli.py export --sample normal P001 -o report
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    audit_parser = subparsers.add_parser("audit", help="完整审计套餐状态")
    audit_parser.add_argument("package_id", help="套餐ID")
    audit_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    transfer_parser = subparsers.add_parser("transfer", help="验证转店申请")
    transfer_parser.add_argument("package_id", help="套餐ID")
    transfer_parser.add_argument("target_store", help="目标门店ID")
    transfer_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    gift_parser = subparsers.add_parser("gift", help="验证赠送扣减")
    gift_parser.add_argument("package_id", help="套餐ID")
    gift_parser.add_argument("item_id", help="项目ID")
    gift_parser.add_argument("count", type=int, help="赠送次数")
    gift_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    ext_parser = subparsers.add_parser("extension", help="验证延期申请")
    ext_parser.add_argument("package_id", help="套餐ID")
    ext_parser.add_argument("new_expiry", type=parse_date, help="新到期日 (YYYY-MM-DD)")
    ext_parser.add_argument("reason", help="延期原因")
    ext_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    expiry_parser = subparsers.add_parser("expiry", help="检查过期状态")
    expiry_parser.add_argument("package_id", help="套餐ID")
    expiry_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    reconcile_parser = subparsers.add_parser("reconcile", help="核销对账")
    reconcile_parser.add_argument("package_id", help="套餐ID")
    reconcile_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")

    export_parser = subparsers.add_parser("export", help="导出审计报告")
    export_parser.add_argument("package_id", help="套餐ID")
    export_parser.add_argument("--sample", choices=["normal", "dirty", "empty"], default="normal", help="样例数据类型")
    export_parser.add_argument("-o", "--output", help="输出文件路径（不含扩展名）")
    export_parser.add_argument("--format", choices=["json", "text", "both"], default="both", help="输出格式")

    sample_parser = subparsers.add_parser("demo", help="运行完整演示")
    sample_parser.add_argument("--type", choices=["normal", "abnormal"], default="normal", help="演示类型")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    engine = RulesEngine()
    reporter = CLIAuditReporter(engine)

    if args.command == "demo":
        run_demo(engine, reporter, args.type)
        return

    sample_type = getattr(args, "sample", "normal")
    load_sample_data(engine, sample_type)

    if args.command == "audit":
        result = engine.full_package_audit(args.package_id)
        print(reporter.format_human_readable(result))

    elif args.command == "transfer":
        result = engine.validate_package_transfer(args.package_id, args.target_store)
        print(f"状态: {result.status.value}")
        print(f"消息: {result.message}")
        if result.details:
            print(f"详情: {json.dumps(result.details, ensure_ascii=False, indent=2, default=str)}")

    elif args.command == "gift":
        result = engine.validate_gift_deduction(args.package_id, args.item_id, args.count)
        print(f"状态: {result.status.value}")
        print(f"消息: {result.message}")
        if result.details:
            print(f"详情: {json.dumps(result.details, ensure_ascii=False, indent=2, default=str)}")

    elif args.command == "extension":
        result = engine.validate_extension(args.package_id, args.new_expiry, args.reason)
        print(f"状态: {result.status.value}")
        print(f"消息: {result.message}")
        if result.details:
            print(f"详情: {json.dumps(result.details, ensure_ascii=False, indent=2, default=str)}")

    elif args.command == "expiry":
        result = engine.check_expiry_status(args.package_id)
        print(f"状态: {result.status.value}")
        print(f"消息: {result.message}")
        if result.details:
            print(f"详情: {json.dumps(result.details, ensure_ascii=False, indent=2, default=str)}")

    elif args.command == "reconcile":
        result = engine.reconcile_verifications(args.package_id)
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))

    elif args.command == "export":
        result = engine.full_package_audit(args.package_id)
        reporter.export_report(result, args.output, args.format)


def run_demo(engine: RulesEngine, reporter: CLIAuditReporter, demo_type: str):
    print("\n" + "=" * 70)
    print(f"{'='*10}  疗程核销转店延期状态排查CLI - {demo_type.upper()}演示  {'='*10}")
    print("=" * 70 + "\n")

    if demo_type == "normal":
        print("【正常样例演示】")
        print("-" * 50)

        load_sample_data(engine, "normal")

        print("\n1. 执行完整审计")
        result = engine.full_package_audit("P001")
        print(reporter.format_human_readable(result))

        print("\n2. 验证转店申请")
        transfer_result = engine.validate_package_transfer("P001", "STORE_B")
        print(f"   状态: {transfer_result.status.value}")
        print(f"   消息: {transfer_result.message}")

        print("\n3. 验证赠送扣减")
        gift_result = engine.validate_gift_deduction("P001", "ITEM001", 2)
        print(f"   状态: {gift_result.status.value}")
        print(f"   消息: {gift_result.message}")

        print("\n4. 检查过期状态")
        expiry_result = engine.check_expiry_status("P001")
        print(f"   状态: {expiry_result.status.value}")
        print(f"   消息: {expiry_result.message}")

        print("\n5. 导出报告")
        reporter.export_report(result, "normal_demo_report", "both")

    else:
        print("【异常样例演示】")
        print("-" * 50)

        load_sample_data(engine, "dirty")

        print("\n1. 执行完整审计（过期套餐）")
        result = engine.full_package_audit("P003")
        print(reporter.format_human_readable(result))

        print("\n2. 验证转店申请（转店次数超限）")
        transfer_result = engine.validate_package_transfer("P003", "STORE_D")
        print(f"   状态: {transfer_result.status.value}")
        print(f"   消息: {transfer_result.message}")

        print("\n3. 验证赠送扣减（赠送次数不足）")
        gift_result = engine.validate_gift_deduction("P003", "ITEM004", 20)
        print(f"   状态: {gift_result.status.value}")
        print(f"   消息: {gift_result.message}")

        print("\n4. 检查过期状态（已过期套餐）")
        expiry_result = engine.check_expiry_status("P003")
        print(f"   状态: {expiry_result.status.value}")
        print(f"   消息: {expiry_result.message}")

        print("\n5. 核销对账（核销记录不一致）")
        reconcile_result = engine.reconcile_verifications("P003")
        print(f"   总核销记录: {reconcile_result['total_verifications']}")
        if reconcile_result['discrepancies']:
            for disc in reconcile_result['discrepancies']:
                print(f"   ⚠️ {disc['item_name']}: 系统记录{disc['recorded_used']}次, "
                      f"实际核销{disc['actual_verifications']}次, 差异{disc['difference']}次")

        print("\n6. 导出报告")
        reporter.export_report(result, "abnormal_demo_report", "both")

    print("\n" + "=" * 70)
    print(f"演示完成！报告已导出，请查看报告文件。")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
