#!/usr/bin/env python3
import argparse
import sys
import json
from models import DataStore
from service import StorageService
from report import ReportGenerator


class StorageCLI:
    def __init__(self):
        self.data_store = DataStore()
        self.data_store.load_all()
        self.service = StorageService(self.data_store)
        self.reporter = ReportGenerator(self.service)

    def cmd_add_customer(self, args):
        customer, errors = self.service.add_customer(args.name, args.phone)
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "customer": customer.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_add_storage(self, args):
        storage, errors = self.service.add_storage(
            args.customer_id, args.product, args.category,
            args.batch, args.expiry, args.quantity, args.unit
        )
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "storage": storage.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_use_storage(self, args):
        record, errors = self.service.use_storage(
            args.storage_id, args.quantity, args.notes or ""
        )
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "usage_record": record.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_transfer_request(self, args):
        request, errors = self.service.create_transfer_request(
            args.from_customer, args.to_customer,
            args.storage_id, args.quantity, args.notes or ""
        )
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "transfer_request": request.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_approve_transfer(self, args):
        request, errors = self.service.approve_transfer(args.transfer_id, args.approver)
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "transfer_request": request.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_reject_transfer(self, args):
        request, errors = self.service.reject_transfer(args.transfer_id, args.approver)
        if errors:
            print(json.dumps({"success": False, "errors": errors}, ensure_ascii=False))
            return 1
        result = {
            "success": True,
            "transfer_request": request.to_dict()
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    def cmd_report_storage(self, args):
        content = self.reporter.generate_storage_report(format=args.format)
        if args.output:
            self.reporter.save_report(content, args.output)
            print(f"报告已保存到: {args.output}")
        else:
            print(content)
        return 0

    def cmd_report_expiry(self, args):
        content = self.reporter.generate_expiry_report(days=args.days, format=args.format)
        if args.output:
            self.reporter.save_report(content, args.output)
            print(f"报告已保存到: {args.output}")
        else:
            print(content)
        return 0

    def cmd_report_transfer(self, args):
        content = self.reporter.generate_transfer_report(format=args.format)
        if args.output:
            self.reporter.save_report(content, args.output)
            print(f"报告已保存到: {args.output}")
        else:
            print(content)
        return 0

    def cmd_list_customers(self, args):
        customers = [c.to_dict() for c in self.data_store.customers.values()]
        print(json.dumps({"count": len(customers), "customers": customers}, ensure_ascii=False, indent=2))
        return 0

    def cmd_list_storage(self, args):
        if args.customer_id:
            items = self.service.get_customer_storage(args.customer_id)
        else:
            items = list(self.data_store.storage_items.values())
        items_dict = [item.to_dict() for item in items]
        print(json.dumps({"count": len(items_dict), "storage_items": items_dict}, ensure_ascii=False, indent=2))
        return 0

    def cmd_pending_transfers(self, args):
        transfers = self.service.get_pending_transfers()
        transfers_dict = [t.to_dict() for t in transfers]
        print(json.dumps({"count": len(transfers_dict), "pending_transfers": transfers_dict}, ensure_ascii=False, indent=2))
        return 0

    def run(self):
        parser = argparse.ArgumentParser(
            description="母婴店寄存商品效期转赠审批排查系统",
            formatter_class=argparse.RawDescriptionHelpFormatter
        )
        subparsers = parser.add_subparsers(dest="command", help="可用命令")

        parser_add_customer = subparsers.add_parser("add-customer", help="添加客户")
        parser_add_customer.add_argument("--name", required=True, help="客户姓名")
        parser_add_customer.add_argument("--phone", required=True, help="手机号")

        parser_add_storage = subparsers.add_parser("add-storage", help="添加寄存")
        parser_add_storage.add_argument("--customer-id", required=True, help="客户ID")
        parser_add_storage.add_argument("--product", required=True, help="商品名称")
        parser_add_storage.add_argument("--category", default="其他", help="分类 (奶粉/尿裤/其他)")
        parser_add_storage.add_argument("--batch", required=True, help="批次号")
        parser_add_storage.add_argument("--expiry", required=True, help="效期日期 (YYYY-MM-DD)")
        parser_add_storage.add_argument("--quantity", type=int, required=True, help="数量")
        parser_add_storage.add_argument("--unit", default="罐", help="单位 (罐/包等)")

        parser_use = subparsers.add_parser("use", help="领用商品")
        parser_use.add_argument("--storage-id", required=True, help="寄存ID")
        parser_use.add_argument("--quantity", type=int, required=True, help="领用数量")
        parser_use.add_argument("--notes", help="备注")

        parser_transfer = subparsers.add_parser("transfer-request", help="创建转赠申请")
        parser_transfer.add_argument("--from-customer", required=True, help="转出客户ID")
        parser_transfer.add_argument("--to-customer", required=True, help="转入客户ID")
        parser_transfer.add_argument("--storage-id", required=True, help="寄存ID")
        parser_transfer.add_argument("--quantity", type=int, required=True, help="转赠数量")
        parser_transfer.add_argument("--notes", help="备注")

        parser_approve = subparsers.add_parser("approve-transfer", help="审批通过转赠")
        parser_approve.add_argument("--transfer-id", required=True, help="转赠申请ID")
        parser_approve.add_argument("--approver", default="system", help="审批人")

        parser_reject = subparsers.add_parser("reject-transfer", help="审批拒绝转赠")
        parser_reject.add_argument("--transfer-id", required=True, help="转赠申请ID")
        parser_reject.add_argument("--approver", default="system", help="审批人")

        parser_report_storage = subparsers.add_parser("report-storage", help="生成寄存报告")
        parser_report_storage.add_argument("--format", choices=["json", "csv", "human"], default="json", help="输出格式")
        parser_report_storage.add_argument("--output", help="输出文件路径")

        parser_report_expiry = subparsers.add_parser("report-expiry", help="生成效期提醒报告")
        parser_report_expiry.add_argument("--days", type=int, default=30, help="检查未来N天内过期的商品")
        parser_report_expiry.add_argument("--format", choices=["json", "csv", "human"], default="json", help="输出格式")
        parser_report_expiry.add_argument("--output", help="输出文件路径")

        parser_report_transfer = subparsers.add_parser("report-transfer", help="生成转赠报告")
        parser_report_transfer.add_argument("--format", choices=["json", "csv", "human"], default="json", help="输出格式")
        parser_report_transfer.add_argument("--output", help="输出文件路径")

        subparsers.add_parser("list-customers", help="列出所有客户")

        parser_list_storage = subparsers.add_parser("list-storage", help="列出寄存商品")
        parser_list_storage.add_argument("--customer-id", help="指定客户ID")

        subparsers.add_parser("pending-transfers", help="列出待审批的转赠申请")

        args = parser.parse_args()

        if not args.command:
            parser.print_help()
            return 0

        cmd_map = {
            "add-customer": self.cmd_add_customer,
            "add-storage": self.cmd_add_storage,
            "use": self.cmd_use_storage,
            "transfer-request": self.cmd_transfer_request,
            "approve-transfer": self.cmd_approve_transfer,
            "reject-transfer": self.cmd_reject_transfer,
            "report-storage": self.cmd_report_storage,
            "report-expiry": self.cmd_report_expiry,
            "report-transfer": self.cmd_report_transfer,
            "list-customers": self.cmd_list_customers,
            "list-storage": self.cmd_list_storage,
            "pending-transfers": self.cmd_pending_transfers,
        }

        if args.command in cmd_map:
            return cmd_map[args.command](args)

        print(f"未知命令: {args.command}")
        return 1


def main():
    cli = StorageCLI()
    sys.exit(cli.run())


if __name__ == "__main__":
    main()
