#!/usr/bin/env python3
import argparse
import sys
from typing import Optional
from models import TransformationStatus
from rules import ApiDecommissionManager
from storage import Storage
from reporter import Reporter


class CliApp:
    def __init__(self):
        self.storage = Storage()
        self.reporter = Reporter()
        self.manager: Optional[ApiDecommissionManager] = self.storage.load() or ApiDecommissionManager()

    def save(self):
        self.storage.save(self.manager)

    def cmd_register_api(self, args):
        print(f"\n注册接口: {args.api_name}")
        print("-" * 50)
        success, errors = self.manager.register_api(args.api_name, args.decommission_date)
        if success:
            print("✓ 接口注册成功")
            self.save()
        else:
            print("✗ 接口注册失败，错误信息:")
            for error in errors:
                print(f"  - [{error.severity}] {error.field}: {error.message}")
        return 0 if success else 1

    def cmd_register_caller(self, args):
        print(f"\n登记调用方: {args.caller_name} -> {args.api_name}")
        print("-" * 50)
        success, errors = self.manager.register_caller(
            args.api_name,
            args.caller_name,
            args.transformation_plan,
            args.planned_complete_date,
            args.remarks
        )
        if success:
            print("✓ 调用方登记成功")
            if errors:
                print("\n⚠ 警告信息:")
                for error in errors:
                    print(f"  - {error.field}: {error.message}")
            self.save()
        else:
            print("✗ 调用方登记失败，错误信息:")
            for error in errors:
                print(f"  - [{error.severity}] {error.field}: {error.message}")
        return 0 if success else 1

    def cmd_request_extension(self, args):
        print(f"\n提交延期申请: {args.caller_name} -> {args.api_name}")
        print("-" * 50)
        success, errors = self.manager.request_extension(
            args.api_name,
            args.caller_name,
            args.original_decommission_date,
            args.requested_decommission_date,
            args.reason
        )
        if success:
            print("✓ 延期申请提交成功")
            self.save()
        else:
            print("✗ 延期申请提交失败，错误信息:")
            for error in errors:
                print(f"  - [{error.severity}] {error.field}: {error.message}")
        return 0 if success else 1

    def cmd_approve_extension(self, args):
        print(f"\n审批延期申请: {args.caller_name} -> {args.api_name}")
        print("-" * 50)
        approved = args.approved.lower() == "true"
        success, errors = self.manager.approve_extension(
            args.api_name,
            args.caller_name,
            approved,
            args.approved_by
        )
        if success:
            status = "已批准" if approved else "已拒绝"
            print(f"✓ 延期申请{status}")
            self.save()
        else:
            print("✗ 审批失败，错误信息:")
            for error in errors:
                print(f"  - [{error.severity}] {error.field}: {error.message}")
        return 0 if success else 1

    def cmd_update_status(self, args):
        print(f"\n更新调用方状态: {args.caller_name} -> {args.api_name}")
        print("-" * 50)
        try:
            status = TransformationStatus(args.status)
        except ValueError:
            print(f"✗ 无效的状态值: {args.status}")
            print(f"  可用值: {', '.join(s.value for s in TransformationStatus)}")
            return 1

        success, errors = self.manager.update_caller_status(args.api_name, args.caller_name, status)
        if success:
            print(f"✓ 状态更新为: {status.value}")
            self.save()
        else:
            print("✗ 状态更新失败，错误信息:")
            for error in errors:
                print(f"  - [{error.severity}] {error.field}: {error.message}")
        return 0 if success else 1

    def cmd_report(self, args):
        print(f"\n生成报告...")
        print("-" * 50)
        json_path, txt_path = self.reporter.save_both_reports(self.manager, api_name=args.api_name)
        print(f"✓ JSON报告已保存: {json_path}")
        print(f"✓ 文本报告已保存: {txt_path}")

        if args.show:
            print("\n" + self.reporter.generate_human_readable_report(self.manager, args.api_name))
        return 0

    def cmd_list(self, args):
        print(f"\n已注册接口列表:")
        print("-" * 50)
        apis = self.manager.list_apis()
        if not apis:
            print("  (暂无数据)")
            return 0

        for api in apis:
            print(f"\n  接口: {api.api_name}")
            print(f"  退役日期: {api.decommission_date}")
            print(f"  调用方数量: {len(api.callers)}")
            print(f"  延期申请: {len(api.extension_requests)}")
        return 0

    def cmd_clear(self, args):
        print("\n清除所有数据...")
        if args.force:
            self.storage.clear()
            self.manager = ApiDecommissionManager()
            print("✓ 数据已清除")
            return 0
        else:
            print("⚠ 此操作将删除所有数据，请使用 --force 参数确认")
            return 1

    def run(self):
        parser = argparse.ArgumentParser(
            description="API退役申请调用方改造排查CLI工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  # 注册接口
  python cli.py register-api --api-name user/v1/login --decommission-date 2024-12-31

  # 登记调用方
  python cli.py register-caller --api-name user/v1/login --caller-name 订单系统 --transformation-plan "切换到v2接口" --planned-complete-date 2024-11-30

  # 提交延期申请
  python cli.py request-extension --api-name user/v1/login --caller-name 订单系统 --original-date 2024-12-31 --requested-date 2025-03-31 --reason "需要更多时间测试

  # 审批延期申请
  python cli.py approve-extension --api-name user/v1/login --caller-name 订单系统 --approved true --approved-by 张经理

  # 生成报告
  python cli.py report --show
            """
        )
        subparsers = parser.add_subparsers(dest="command", help="可用命令")

        # register-api
        p_register_api = subparsers.add_parser("register-api", help="注册API接口")
        p_register_api.add_argument("--api-name", required=True, help="接口名称")
        p_register_api.add_argument("--decommission-date", required=True, help="退役日期 (YYYY-MM-DD)")

        # register-caller
        p_register_caller = subparsers.add_parser("register-caller", help="登记调用方")
        p_register_caller.add_argument("--api-name", required=True, help="接口名称")
        p_register_caller.add_argument("--caller-name", required=True, help="调用方名称")
        p_register_caller.add_argument("--transformation-plan", required=True, help="改造计划")
        p_register_caller.add_argument("--planned-complete-date", help="计划完成日期 (YYYY-MM-DD)")
        p_register_caller.add_argument("--remarks", help="备注")

        # request-extension
        p_extension = subparsers.add_parser("request-extension", help="提交延期申请")
        p_extension.add_argument("--api-name", required=True, help="接口名称")
        p_extension.add_argument("--caller-name", required=True, help="调用方名称")
        p_extension.add_argument("--original-date", dest="original_decommission_date", required=True, help="原退役日期")
        p_extension.add_argument("--requested-date", dest="requested_decommission_date", required=True, help="申请延期至")
        p_extension.add_argument("--reason", required=True, help="延期理由")

        # approve-extension
        p_approve = subparsers.add_parser("approve-extension", help="审批延期申请")
        p_approve.add_argument("--api-name", required=True, help="接口名称")
        p_approve.add_argument("--caller-name", required=True, help="调用方名称")
        p_approve.add_argument("--approved", required=True, help="是否批准 (true/false)")
        p_approve.add_argument("--approved-by", required=True, help="审批人")

        # update-status
        p_status = subparsers.add_parser("update-status", help="更新改造状态")
        p_status.add_argument("--api-name", required=True, help="接口名称")
        p_status.add_argument("--caller-name", required=True, help="调用方名称")
        p_status.add_argument("--status", required=True, help=f"状态值: {', '.join(s.value for s in TransformationStatus)}")

        # report
        p_report = subparsers.add_parser("report", help="生成报告")
        p_report.add_argument("--api-name", help="指定接口名称（可选，不传则导出全部)")
        p_report.add_argument("--show", action="store_true", help="同时在终端显示报告")

        # list
        subparsers.add_parser("list", help="列出所有接口")

        # clear
        p_clear = subparsers.add_parser("clear", help="清除所有数据")
        p_clear.add_argument("--force", action="store_true", help="强制清除（不加此参数会提示警告)")

        args = parser.parse_args()

        if not args.command:
            parser.print_help()
            return 0

        cmd_map = {
            "register-api": self.cmd_register_api,
            "register-caller": self.cmd_register_caller,
            "request-extension": self.cmd_request_extension,
            "approve-extension": self.cmd_approve_extension,
            "update-status": self.cmd_update_status,
            "report": self.cmd_report,
            "list": self.cmd_list,
            "clear": self.cmd_clear,
        }

        return cmd_map[args.command](args)


if __name__ == "__main__":
    app = CliApp()
    sys.exit(app.run())
