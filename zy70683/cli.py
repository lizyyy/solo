#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime, timedelta
import json
import os

from models import VerificationStatus, MeetingStatus, MealVoucherStatus
from service import MealVoucherService


def parse_date(date_str: str) -> datetime:
    for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S']:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise argparse.ArgumentTypeError(f"无法解析日期: {date_str}")


def print_json(data):
    print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def print_human_report(report_data):
    print("\n" + "=" * 80)
    print(f"  访客餐券会议取消核销状态报告 - {report_data['report_id']}")
    print(f"  生成时间: {report_data['generated_at']}")
    print("=" * 80)
    print(f"\n  【概览统计】")
    print(f"  餐券总数: {report_data['total_vouchers']}")
    print(f"  需处理: {report_data['to_verified']}")
    print(f"    - 待核销: {report_data['pending_count']}")
    print(f"    - 冲突记录: {report_data['conflict_count']}")
    print(f"  无需处理: {report_data['no_action_count']}")
    print("\n" + "-" * 80)
    print(f"  【详细记录】")
    print("-" * 80)
    for i, detail in enumerate(report_data['details'], 1):
        print(f"\n  [{i}] 餐券码: {detail['voucher_code']}")
        print(f"      访客: {detail['visitor_name']} ({detail['visitor_company']})")
        print(f"      会议: {detail['meeting_title']} [{detail['meeting_status']}]")
        print(f"      餐券状态: {detail['voucher_status']}")
        print(f"      核销状态: {detail['verification_status']}")
        if detail['notes']:
            print(f"      备注: {detail['notes']}")
        if detail['cancel_reason']:
            print(f"      取消原因: {detail['cancel_reason']}")
    print("\n" + "=" * 80 + "\n")


def cmd_add_visitor(args):
    service = MealVoucherService()
    visitor = service.add_visitor(args.name, args.phone, args.company, args.visit_date)
    result = {"action": "add_visitor", "success": True, "data": visitor.__dict__}
    print_json(result)


def cmd_add_meeting(args):
    service = MealVoucherService()
    meeting = service.add_meeting(args.title, args.host, args.scheduled_time, args.end_time)
    result = {"action": "add_meeting", "success": True, "data": meeting.__dict__}
    print_json(result)


def cmd_cancel_meeting(args):
    service = MealVoucherService()
    meeting = service.cancel_meeting(args.meeting_id, args.reason)
    if meeting:
        result = {"action": "cancel_meeting", "success": True, "data": meeting.__dict__}
    else:
        result = {"action": "cancel_meeting", "success": False, "error": "会议不存在"}
    print_json(result)


def cmd_issue_voucher(args):
    service = MealVoucherService()
    valid_from = args.valid_from if args.valid_from else datetime.now()
    valid_to = args.valid_to if args.valid_to else (datetime.now() + timedelta(days=1))
    voucher = service.issue_voucher(args.visitor_id, args.meeting_id, valid_from, valid_to)
    if voucher:
        result = {"action": "issue_voucher", "success": True, "data": voucher.__dict__}
    else:
        result = {"action": "issue_voucher", "success": False, "error": "发放失败（访客/会议不存在或会议已取消）"}
    print_json(result)


def cmd_use_voucher(args):
    service = MealVoucherService()
    voucher = service.use_voucher(args.voucher_code, args.location)
    if voucher:
        result = {"action": "use_voucher", "success": True, "data": voucher.__dict__}
    else:
        result = {"action": "use_voucher", "success": False, "error": "使用失败（餐券不存在、状态无效或已过期）"}
    print_json(result)


def cmd_verify(args):
    service = MealVoucherService()
    record, message = service.verify_voucher(args.voucher_code, args.operator)
    if record:
        result = {
            "action": "verify",
            "success": True,
            "message": message,
            "data": record.__dict__
        }
    else:
        result = {"action": "verify", "success": False, "error": message}
    print_json(result)


def cmd_check(args):
    service = MealVoucherService()
    status = service.check_voucher_status(args.voucher_code)
    if status:
        result = {"action": "check", "success": True, "data": status}
    else:
        result = {"action": "check", "success": False, "error": "餐券不存在"}
    print_json(result)


def cmd_history(args):
    service = MealVoucherService()
    records = service.get_verification_history(args.voucher_code)
    result = {
        "action": "history",
        "success": True,
        "count": len(records),
        "data": [r.__dict__ for r in records]
    }
    print_json(result)


def cmd_report(args):
    service = MealVoucherService()
    report = service.generate_verification_report()
    report_dict = report.__dict__
    if args.format == 'json':
        print_json(report_dict)
    else:
        print_human_report(report_dict)
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, default=str)
        print(f"\n报告已保存到: {args.output}", file=sys.stderr)


def cmd_list(args):
    service = MealVoucherService()
    data_type = args.type
    if data_type == 'visitors':
        data = {k: v.__dict__ for k, v in service.visitors.items()}
    elif data_type == 'meetings':
        data = {k: v.__dict__ for k, v in service.meetings.items()}
    elif data_type == 'vouchers':
        data = {k: v.__dict__ for k, v in service.vouchers.items()}
    else:
        data = {}
    result = {"action": f"list_{data_type}", "success": True, "count": len(data), "data": data}
    print_json(result)


def main():
    parser = argparse.ArgumentParser(
        description='访客餐券会议取消核销状态排查CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 添加访客
  python cli.py add-visitor --name "张三" --phone "13800138000" --company "ABC公司" --visit-date "2026-05-20"
  
  # 添加会议
  python cli.py add-meeting --title "技术评审会" --host "李经理" --scheduled-time "2026-05-20 09:00" --end-time "2026-05-20 12:00"
  
  # 发放餐券
  python cli.py issue-voucher --visitor-id V202605200001 --meeting-id M202605200001
  
  # 取消会议
  python cli.py cancel-meeting --meeting-id M202605200001 --reason "会议时间调整"
  
  # 核销检查
  python cli.py verify --voucher-code VC20260520000001 --operator "行政小王"
  
  # 查看状态
  python cli.py check --voucher-code VC20260520000001
  
  # 查看核销历史
  python cli.py history --voucher-code VC20260520000001
  
  # 生成报告
  python cli.py report --format human
  python cli.py report --format json --output report.json
        """
    )
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    add_visitor_parser = subparsers.add_parser('add-visitor', help='添加访客')
    add_visitor_parser.add_argument('--name', required=True, help='访客姓名')
    add_visitor_parser.add_argument('--phone', required=True, help='联系电话')
    add_visitor_parser.add_argument('--company', required=True, help='公司名称')
    add_visitor_parser.add_argument('--visit-date', required=True, type=parse_date, help='来访日期')
    add_visitor_parser.set_defaults(func=cmd_add_visitor)

    add_meeting_parser = subparsers.add_parser('add-meeting', help='添加会议')
    add_meeting_parser.add_argument('--title', required=True, help='会议标题')
    add_meeting_parser.add_argument('--host', required=True, help='会议主持人')
    add_meeting_parser.add_argument('--scheduled-time', required=True, type=parse_date, help='会议开始时间')
    add_meeting_parser.add_argument('--end-time', required=True, type=parse_date, help='会议结束时间')
    add_meeting_parser.set_defaults(func=cmd_add_meeting)

    cancel_meeting_parser = subparsers.add_parser('cancel-meeting', help='取消会议')
    cancel_meeting_parser.add_argument('--meeting-id', required=True, help='会议ID')
    cancel_meeting_parser.add_argument('--reason', required=True, help='取消原因')
    cancel_meeting_parser.set_defaults(func=cmd_cancel_meeting)

    issue_voucher_parser = subparsers.add_parser('issue-voucher', help='发放餐券')
    issue_voucher_parser.add_argument('--visitor-id', required=True, help='访客ID')
    issue_voucher_parser.add_argument('--meeting-id', required=True, help='会议ID')
    issue_voucher_parser.add_argument('--valid-from', type=parse_date, help='有效期开始时间')
    issue_voucher_parser.add_argument('--valid-to', type=parse_date, help='有效期结束时间')
    issue_voucher_parser.set_defaults(func=cmd_issue_voucher)

    use_voucher_parser = subparsers.add_parser('use-voucher', help='使用餐券')
    use_voucher_parser.add_argument('--voucher-code', required=True, help='餐券码')
    use_voucher_parser.add_argument('--location', required=True, help='使用地点')
    use_voucher_parser.set_defaults(func=cmd_use_voucher)

    verify_parser = subparsers.add_parser('verify', help='核销检查')
    verify_parser.add_argument('--voucher-code', required=True, help='餐券码')
    verify_parser.add_argument('--operator', required=True, help='操作员')
    verify_parser.set_defaults(func=cmd_verify)

    check_parser = subparsers.add_parser('check', help='查看餐券状态')
    check_parser.add_argument('--voucher-code', required=True, help='餐券码')
    check_parser.set_defaults(func=cmd_check)

    history_parser = subparsers.add_parser('history', help='查看核销历史')
    history_parser.add_argument('--voucher-code', help='指定餐券码（可选，不填则显示全部）')
    history_parser.set_defaults(func=cmd_history)

    report_parser = subparsers.add_parser('report', help='生成核销报告')
    report_parser.add_argument('--format', choices=['human', 'json'], default='human', help='输出格式')
    report_parser.add_argument('--output', help='输出文件路径')
    report_parser.set_defaults(func=cmd_report)

    list_parser = subparsers.add_parser('list', help='列出数据')
    list_parser.add_argument('--type', choices=['visitors', 'meetings', 'vouchers'], required=True, help='数据类型')
    list_parser.set_defaults(func=cmd_list)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == '__main__':
    main()
