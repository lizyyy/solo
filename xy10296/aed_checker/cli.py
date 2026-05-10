import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from .storage import Storage
from .service import AEDService
from .exporter import Exporter
from .models import to_dict


class AEDCLI:
    def __init__(self, data_dir: str = "./data", export_dir: str = "./exports"):
        self.storage = Storage(data_dir)
        self.service = AEDService(self.storage)
        self.exporter = Exporter(export_dir)

    def print_result(self, success: bool, message: str, data: Optional[Any] = None):
        status = "[成功]" if success else "[错误]"
        print(f"{status} {message}")
        if data:
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        print(json.dumps(item, ensure_ascii=False, indent=2))
                    else:
                        print(item)
            else:
                if isinstance(data, dict):
                    print(json.dumps(data, ensure_ascii=False, indent=2))
                else:
                    print(data)

    def import_devices(self, file_path: str):
        if not os.path.exists(file_path):
            self.print_result(False, f"文件不存在: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            self.print_result(False, "数据格式错误，应为数组")
            return

        success_count = 0
        failed_count = 0
        for item in data:
            ok, msg, _ = self.service.register_device(item)
            if ok:
                success_count += 1
            else:
                failed_count += 1
                print(f"  - 跳过设备 {item.get('device_id', '未知')}: {msg}")

        self.print_result(True, f"设备导入完成 - 成功: {success_count}, 跳过: {failed_count}")

    def import_volunteers(self, file_path: str):
        if not os.path.exists(file_path):
            self.print_result(False, f"文件不存在: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            self.print_result(False, "数据格式错误，应为数组")
            return

        success_count = 0
        failed_count = 0
        for item in data:
            ok, msg, _ = self.service.register_volunteer(item)
            if ok:
                success_count += 1
            else:
                failed_count += 1
                print(f"  - 跳过志愿者 {item.get('volunteer_id', '未知')}: {msg}")

        self.print_result(True, f"志愿者导入完成 - 成功: {success_count}, 跳过: {failed_count}")

    def import_supplies(self, file_path: str):
        if not os.path.exists(file_path):
            self.print_result(False, f"文件不存在: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            self.print_result(False, "数据格式错误，应为数组")
            return

        success_count = 0
        failed_count = 0
        for item in data:
            ok, msg, _ = self.service.register_supplies(item)
            if ok:
                success_count += 1
            else:
                failed_count += 1
                print(f"  - 跳过耗材 {item.get('supplies_id', '未知')}: {msg}")

        self.print_result(True, f"耗材导入完成 - 成功: {success_count}, 跳过: {failed_count}")

    def import_plans(self, file_path: str):
        if not os.path.exists(file_path):
            self.print_result(False, f"文件不存在: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            self.print_result(False, "数据格式错误，应为数组")
            return

        success_count = 0
        failed_count = 0
        for item in data:
            ok, msg, _ = self.service.create_inspection_plan(item)
            if ok:
                success_count += 1
            else:
                failed_count += 1
                print(f"  - 跳过计划 {item.get('plan_id', '未知')}: {msg}")

        self.print_result(True, f"点检计划导入完成 - 成功: {success_count}, 跳过: {failed_count}")

    def volunteer_checkin(self, plan_id: str, method: str = "app"):
        ok, msg, checkin = self.service.volunteer_checkin(plan_id, method)
        self.print_result(ok, msg, to_dict(checkin) if checkin else None)

    def submit_report(self, file_path: str):
        if not os.path.exists(file_path):
            self.print_result(False, f"文件不存在: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for item in data:
                ok, msg, report = self.service.submit_inspection_report(item)
                self.print_result(ok, msg, to_dict(report) if report else None)
        else:
            ok, msg, report = self.service.submit_inspection_report(data)
            self.print_result(ok, msg, to_dict(report) if report else None)

    def run_check(self, warning_days: int = 30):
        print("\n" + "=" * 60)
        print("执行点检检查...")
        print("=" * 60)

        expiring = self.service.check_expiring_supplies(warning_days)
        missed = self.service.check_missed_inspections()
        pending = self.service.get_pending_reviews()

        print("\n1. 耗材效期检查:")
        if expiring:
            for item in expiring:
                tag = "[紧急]" if item['severity'] == 'critical' else "[预警]"
                print(f"  {tag} {item['supplies_type']} - {item['device_location']} "
                      f"(剩余 {item['days_left']} 天, 到期: {item['expiration_date']})")
        else:
            print("  [正常] 无即将到期的耗材")

        print("\n2. 漏检检查:")
        if missed:
            for item in missed:
                print(f"  [漏检] {item['device_location']} - 志愿者: {item['volunteer_name']}, "
                      f"电话: {item['volunteer_phone']}, 计划日期: {item['plan_date']}")
        else:
            print("  [正常] 无漏检记录")

        print("\n3. 待复核报告:")
        if pending:
            for item in pending:
                issues = []
                if not item['electrode_pads_ok']:
                    issues.append("电极片")
                if not item['battery_ok']:
                    issues.append("电池")
                if not item['location_visible']:
                    issues.append("位置标识")
                print(f"  [待复核] {item['device_location']} - 志愿者: {item['volunteer_name']}, "
                      f"问题: {', '.join(issues) if issues else '无'}")
        else:
            print("  [正常] 无待复核报告")

        print("\n" + "=" * 60)
        print(f"检查完成 - 耗材预警: {len(expiring)}, 漏检: {len(missed)}, 待复核: {len(pending)}")
        print("=" * 60 + "\n")

    def query_exceptions(self):
        exceptions = self.storage.get_unresolved_exceptions()

        if not exceptions:
            self.print_result(True, "无未解决的异常记录")
            return

        print("\n未解决的异常记录:")
        print("-" * 60)
        for e in exceptions:
            device = self.storage.get_device(e.device_id)
            location = device.location if device else "未知"
            print(f"\n异常ID: {e.exception_id}")
            print(f"  设备位置: {location} ({e.device_id})")
            print(f"  异常类型: {e.exception_type}")
            print(f"  严重程度: {e.severity}")
            print(f"  描述: {e.description}")
            print(f"  日期: {e.exception_date}")

    def query_pending_reviews(self):
        pending = self.service.get_pending_reviews()

        if not pending:
            self.print_result(True, "无待复核的报告")
            return

        print("\n待复核的点检报告:")
        print("-" * 80)
        for item in pending:
            print(f"\n报告ID: {item['report_id']}")
            print(f"  计划ID: {item['plan_id']}")
            print(f"  设备: {item['device_location']} ({item['device_id']})")
            print(f"  志愿者: {item['volunteer_name']}")
            print(f"  点检日期: {item['inspection_date'][:10]}")
            print(f"  电极片: {'OK' if item['electrode_pads_ok'] else '异常'}")
            print(f"  电池: {'OK' if item['battery_ok'] else '异常'}")
            print(f"  位置标识: {'清晰' if item['location_visible'] else '不清晰'}")
            print(f"  整体状态: {item['overall_status']}")
            if item['notes']:
                print(f"  备注: {item['notes']}")

    def review_report(self, report_id: str, approved: bool, reviewer: str, notes: str = ""):
        ok, msg = self.service.review_report(report_id, approved, reviewer, notes)
        self.print_result(ok, msg)

    def generate_report(self, output_format: str = "txt"):
        stats = self.service.get_dashboard_stats()
        expiring = self.service.check_expiring_supplies(30)
        missed = self.service.check_missed_inspections()
        pending = self.service.get_pending_reviews()

        if output_format == "txt":
            filepath = self.exporter.export_dashboard_report(stats, expiring, missed, pending)
        elif output_format == "json":
            data = {
                "generated_at": datetime.now().isoformat(),
                "stats": stats,
                "expiring_supplies": expiring,
                "missed_inspections": missed,
                "pending_reviews": pending
            }
            filepath = self.exporter.export_to_json(data, "dashboard_report")
        elif output_format == "csv":
            all_data = []
            all_data.extend([{**item, "category": "expiring_supplies"} for item in expiring])
            all_data.extend([{**item, "category": "missed_inspections"} for item in missed])
            all_data.extend([{**item, "category": "pending_reviews"} for item in pending])
            if all_data:
                filepath = self.exporter.export_to_csv(all_data, "dashboard_report")
            else:
                self.print_result(True, "无数据可导出")
                return
        else:
            self.print_result(False, f"不支持的导出格式: {output_format}")
            return

        self.print_result(True, f"报告已导出到: {filepath}")

    def show_dashboard(self):
        stats = self.service.get_dashboard_stats()

        print("\n" + "=" * 70)
        print("社区AED点检管理系统 - 仪表板")
        print("=" * 70)
        print(f"\n设备管理:")
        print(f"  设备总数: {stats['total_devices']}")
        print(f"  在用设备: {stats['active_devices']}")

        print(f"\n志愿者管理:")
        print(f"  志愿者总数: {stats['total_volunteers']}")
        print(f"  活跃志愿者: {stats['active_volunteers']}")

        print(f"\n点检执行:")
        print(f"  计划总数: {stats['total_plans']}")
        print(f"  已完成: {stats['completed_plans']}")
        print(f"  漏检: {stats['missed_plans']}")
        print(f"  完成率: {stats['completion_rate']}%")

        print(f"\n异常预警:")
        print(f"  耗材效期预警: {stats['expiring_supplies_count']} (紧急: {stats['critical_expiring']})")
        print(f"  待复核报告: {stats['pending_reviews']}")
        print(f"  未解决异常: {stats['unresolved_exceptions']}")
        print("\n" + "=" * 70 + "\n")

    def list_devices(self):
        devices = self.storage.get_all_devices()
        if not devices:
            self.print_result(True, "暂无设备档案")
            return

        print("\n设备档案列表:")
        print("-" * 80)
        for d in devices:
            volunteer = self.storage.get_volunteer(d.assigned_volunteer_id) if d.assigned_volunteer_id else None
            vol_name = volunteer.name if volunteer else "未分配"
            print(f"\n设备ID: {d.device_id}")
            print(f"  位置: {d.location} - {d.floor}层 {d.room}")
            print(f"  型号: {d.model} (SN: {d.serial_number})")
            print(f"  状态: {d.status}")
            print(f"  责任志愿者: {vol_name}")
            print(f"  上次点检: {d.last_inspection_date or '无'}")
            print(f"  下次点检: {d.next_inspection_date or '未安排'}")

    def list_volunteers(self):
        volunteers = self.storage.get_all_volunteers()
        if not volunteers:
            self.print_result(True, "暂无志愿者记录")
            return

        print("\n志愿者列表:")
        print("-" * 60)
        for v in volunteers:
            status = "活跃" if v.is_active else "停用"
            print(f"  {v.volunteer_id}: {v.name} ({v.phone}) - 负责区域: {v.area} [{status}]")

    def clear_data(self):
        confirm = input("确定要清空所有数据吗？此操作不可恢复。请输入 'YES' 确认: ")
        if confirm != "YES":
            self.print_result(False, "操作已取消")
            return

        import shutil
        if os.path.exists(self.storage.data_dir):
            shutil.rmtree(self.storage.data_dir)
        self.storage._init_storage()
        self.print_result(True, "数据已清空")


def main():
    parser = argparse.ArgumentParser(
        description="社区AED点检提醒器 - 管理AED设备档案、点检计划和耗材效期",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 导入数据
  python3 main.py import-devices samples/exception/devices.json
  python3 main.py import-volunteers samples/exception/volunteers.json
  python3 main.py import-supplies samples/exception/supplies.json
  python3 main.py import-plans samples/exception/plans.json

  # 志愿者签到
  python3 main.py checkin PLAN-001

  # 提交点检报告
  python3 main.py submit-report samples/exception/report_with_issues.json

  # 运行检查
  python3 main.py check

  # 查询异常
  python3 main.py query-exceptions
  python3 main.py query-pending

  # 复核报告
  python3 main.py review RPT-xxx --approved --reviewer "管理员"

  # 导出报告
  python3 main.py export --format txt
  python3 main.py export --format json

  # 查看仪表板
  python3 main.py dashboard
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import-devices", help="导入设备档案")
    import_parser.add_argument("file", help="JSON文件路径")

    import_vol = subparsers.add_parser("import-volunteers", help="导入志愿者")
    import_vol.add_argument("file", help="JSON文件路径")

    import_sup = subparsers.add_parser("import-supplies", help="导入耗材信息")
    import_sup.add_argument("file", help="JSON文件路径")

    import_plan = subparsers.add_parser("import-plans", help="导入点检计划")
    import_plan.add_argument("file", help="JSON文件路径")

    checkin_parser = subparsers.add_parser("checkin", help="志愿者签到")
    checkin_parser.add_argument("plan_id", help="点检计划ID")
    checkin_parser.add_argument("--method", default="app", help="签到方式 (app/qrcode/manual)")

    submit_parser = subparsers.add_parser("submit-report", help="提交点检报告")
    submit_parser.add_argument("file", help="报告JSON文件路径")

    check_parser = subparsers.add_parser("check", help="运行点检检查（效期、漏检、待复核）")
    check_parser.add_argument("--warning-days", type=int, default=30, help="耗材效期预警天数")

    subparsers.add_parser("query-exceptions", help="查询未解决的异常")
    subparsers.add_parser("query-pending", help="查询待复核的报告")

    review_parser = subparsers.add_parser("review", help="复核点检报告")
    review_parser.add_argument("report_id", help="报告ID")
    review_group = review_parser.add_mutually_exclusive_group(required=True)
    review_group.add_argument("--approved", action="store_true", help="通过复核")
    review_group.add_argument("--rejected", action="store_true", help="驳回复核")
    review_parser.add_argument("--reviewer", required=True, help="复核人姓名")
    review_parser.add_argument("--notes", default="", help="复核备注")

    export_parser = subparsers.add_parser("export", help="导出业务报告")
    export_parser.add_argument("--format", choices=["txt", "json", "csv"], default="txt", help="导出格式")

    subparsers.add_parser("dashboard", help="显示仪表板")
    subparsers.add_parser("list-devices", help="列出所有设备")
    subparsers.add_parser("list-volunteers", help="列出所有志愿者")
    subparsers.add_parser("clear-data", help="清空所有数据（谨慎操作）")

    args = parser.parse_args()

    cli = AEDCLI()

    if args.command == "import-devices":
        cli.import_devices(args.file)
    elif args.command == "import-volunteers":
        cli.import_volunteers(args.file)
    elif args.command == "import-supplies":
        cli.import_supplies(args.file)
    elif args.command == "import-plans":
        cli.import_plans(args.file)
    elif args.command == "checkin":
        cli.volunteer_checkin(args.plan_id, args.method)
    elif args.command == "submit-report":
        cli.submit_report(args.file)
    elif args.command == "check":
        cli.run_check(args.warning_days)
    elif args.command == "query-exceptions":
        cli.query_exceptions()
    elif args.command == "query-pending":
        cli.query_pending_reviews()
    elif args.command == "review":
        cli.review_report(args.report_id, args.approved, args.reviewer, args.notes)
    elif args.command == "export":
        cli.generate_report(args.format)
    elif args.command == "dashboard":
        cli.show_dashboard()
    elif args.command == "list-devices":
        cli.list_devices()
    elif args.command == "list-volunteers":
        cli.list_volunteers()
    elif args.command == "clear-data":
        cli.clear_data()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
