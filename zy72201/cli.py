#!/usr/bin/env python3
import argparse
import sys
import json
from datetime import datetime
from storage import Storage
from core import ReminderManager
from models import RecordStatus


def print_header(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_separator():
    print("-" * 80)


def cmd_init_demo(args):
    from demo_data import setup_demo_data
    setup_demo_data()


def cmd_list(args):
    storage = Storage()
    manager = ReminderManager(storage)
    reminders = manager.get_all_reminders()

    if args.status:
        try:
            status = RecordStatus(args.status)
            reminders = [r for r in reminders if r.status == status]
        except ValueError:
            print(f"错误: 无效的状态值 '{args.status}'")
            print(f"有效状态: {[s.value for s in RecordStatus]}")
            sys.exit(1)

    print_header(f"债券回售提醒列表 ({len(reminders)}条)")

    if not reminders:
        print("暂无记录")
        return

    print(
        f"{'ID':<10} {'债券代码':<10} {'债券名称':<12} {'机构简称':<10} "
        f"{'回售日期':<12} {'行权金额(万)':<12} {'状态':<10} {'标记':<20}"
    )
    print_separator()

    for r in reminders:
        flags = []
        if r.has_alias_mismatch:
            flags.append("简称不一致")
        if r.has_holiday_adjustment:
            flags.append("节假日顺延")
        if r.has_tail_adjustment:
            flags.append("尾差调整")
        flag_str = "、".join(flags) if flags else "-"

        amount_wan = r.exercise_amount / 10000

        print(
            f"{r.id:<10} {r.bond_code:<10} {r.bond_name:<12} {r.institution_alias:<10} "
            f"{r.redemption_date:<12} {amount_wan:<12.2f} {r.status.value:<10} {flag_str:<20}"
        )

    print_separator()
    print(f"共 {len(reminders)} 条记录")


def cmd_show(args):
    storage = Storage()
    manager = ReminderManager(storage)
    reminder = manager.get_reminder_by_id(args.id)

    if not reminder:
        print(f"错误: 未找到ID为 '{args.id}' 的记录")
        sys.exit(1)

    print_header(f"记录详情 - {reminder.bond_code} {reminder.bond_name}")

    print(f"\n【基本信息】")
    print(f"  ID: {reminder.id}")
    print(f"  债券代码: {reminder.bond_code}")
    print(f"  债券名称: {reminder.bond_name}")
    print(f"  机构全称: {reminder.institution_full_name}")
    print(f"  机构简称: {reminder.institution_alias}")
    print(f"  回售日期: {reminder.redemption_date} (原日期: {reminder.original_redemption_date})")
    print(f"  行权金额: {reminder.exercise_amount:,.2f} 元")
    print(f"  票面利率: {reminder.coupon_rate}%")
    print(f"  状态: {reminder.status.value}")
    print(f"  来源: {reminder.source}")
    print(f"  导入批次: {reminder.import_batch}")
    print(f"  导入次数: {reminder.import_count}")
    if reminder.last_rerun_at:
        print(f"  最后重跑: {reminder.last_rerun_at.strftime('%Y-%m-%d %H:%M:%S')}")

    print(f"\n【异常标记】")
    if reminder.has_alias_mismatch:
        print(f"  ⚠️  机构简称不一致: {reminder.alias_mismatch_note}")
        print(f"     检测到的标准简称: {reminder.detected_alias}")
    if reminder.has_holiday_adjustment:
        print(f"  📅 节假日顺延: {reminder.holiday_adjustment_note}")
    if reminder.has_tail_adjustment:
        print(f"  💰 尾差调整: 共{len(reminder.tail_adjustments)}条调整记录")
    if not any([reminder.has_alias_mismatch, reminder.has_holiday_adjustment, reminder.has_tail_adjustment]):
        print(f"  ✓ 无异常标记")

    if reminder.tail_adjustments:
        print(f"\n【尾差调整条】({len(reminder.tail_adjustments)}条)")
        print_separator()
        for i, tail in enumerate(reminder.tail_adjustments, 1):
            print(f"  调整{i}:")
            print(f"    差额: {tail.amount_diff:+.2f} 元")
            print(f"    原因: {tail.adjustment_reason}")
            print(f"    备注: {tail.remark}")
            print(f"    操作人: {tail.created_by}")
            print(f"    时间: {tail.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if i < len(reminder.tail_adjustments):
                print()

    if reminder.supplementary_records:
        print(f"\n【补录记录】")
        print_separator()
        sup = reminder.supplementary_records[-1]
        print(f"  为什么留下:")
        for line in sup.why_kept.split("\n"):
            print(f"    {line}")
        print(f"\n  还缺什么材料:")
        for line in sup.missing_materials.split("\n"):
            print(f"    {line}")
        print(f"\n  下一步: {sup.next_step.value}")
        if sup.notes:
            print(f"\n  处理日志:")
            for line in sup.notes.split("\n"):
                print(f"    {line}")
        print(f"\n  创建人: {sup.created_by} | 创建时间: {sup.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  更新人: {sup.updated_by} | 更新时间: {sup.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")

    if reminder.audit_logs:
        print(f"\n【审计追踪】({len(reminder.audit_logs)}条)")
        print_separator()
        for i, audit in enumerate(reminder.audit_logs, 1):
            print(f"  [{i}] {audit.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"      操作人: {audit.operator} | 动作: {audit.action}")
            print(f"      字段: {audit.field_changed}")
            print(f"      原值: {audit.old_value}")
            print(f"      新值: {audit.new_value}")
            print(f"      原因: {audit.reason}")
            if audit.affected_results:
                print(f"      影响: {audit.affected_results}")
            if i < len(reminder.audit_logs):
                print()

    if reminder.raw_data:
        print(f"\n【原始数据】")
        print_separator()
        for key, value in reminder.raw_data.items():
            print(f"  {key}: {value}")

    print()
    print_separator()


def cmd_import(args):
    storage = Storage()
    manager = ReminderManager(storage)

    raw_data = {}
    if args.raw_data:
        try:
            raw_data = json.loads(args.raw_data)
        except json.JSONDecodeError:
            print("错误: raw_data 必须是有效的JSON格式")
            sys.exit(1)

    reminder = manager.import_reminder(
        bond_code=args.bond_code,
        bond_name=args.bond_name,
        institution_full_name=args.institution_full_name,
        institution_alias=args.institution_alias,
        redemption_date=args.redemption_date,
        exercise_amount=args.exercise_amount,
        coupon_rate=args.coupon_rate,
        source=args.source or "CLI导入",
        import_batch=args.import_batch or f"BATCH-{datetime.now().strftime('%Y%m%d')}",
        raw_data=raw_data,
        operator=args.operator or "system",
    )

    print(f"✓ 导入成功！记录ID: {reminder.id}")
    print(f"  状态: {reminder.status.value}")
    if reminder.has_alias_mismatch:
        print(f"  ⚠️  {reminder.alias_mismatch_note}")
    if reminder.has_holiday_adjustment:
        print(f"  📅 {reminder.holiday_adjustment_note}")


def cmd_add_tail(args):
    storage = Storage()
    manager = ReminderManager(storage)

    tail = manager.add_tail_adjustment(
        reminder_id=args.id,
        amount_diff=args.amount_diff,
        adjustment_reason=args.reason,
        remark=args.remark,
        operator=args.operator or "system",
    )

    if not tail:
        print(f"错误: 未找到ID为 '{args.id}' 的记录")
        sys.exit(1)

    print(f"✓ 尾差调整条已添加！ID: {tail.id}")
    print(f"  差额: {tail.amount_diff:+.2f} 元")
    print(f"  原因: {tail.adjustment_reason}")
    print(f"  备注: {tail.remark}")
    print(f"  操作人: {tail.created_by}")
    print(f"\n补录记录已自动更新，下一步: 找基金会计林姐")


def cmd_resolve_alias(args):
    storage = Storage()
    manager = ReminderManager(storage)

    reminder = manager.resolve_alias_mismatch(
        reminder_id=args.id,
        use_standard=args.use_standard,
        confirmed_alias=args.confirmed_alias,
        reason=args.reason,
        operator=args.operator or "system",
    )

    if not reminder:
        print(f"错误: 未找到ID为 '{args.id}' 的记录，或该记录无机构简称不一致问题")
        sys.exit(1)

    print(f"✓ 机构简称已复核！")
    print(f"  当前简称: {reminder.institution_alias}")
    print(f"  状态: {reminder.status.value}")
    print(f"  复核说明: {args.reason}")


def cmd_send_to_linjie(args):
    storage = Storage()
    manager = ReminderManager(storage)

    reminder = manager.send_to_linjie(
        reminder_id=args.id,
        message=args.message,
        operator=args.operator or "system",
    )

    if not reminder:
        print(f"错误: 未找到ID为 '{args.id}' 的记录")
        sys.exit(1)

    print(f"✓ 已转交林姐处理！")
    print(f"  状态: {reminder.status.value}")
    print(f"  消息: {args.message}")


def cmd_linjie_confirm(args):
    storage = Storage()
    manager = ReminderManager(storage)

    reminder = manager.linjie_confirm(
        reminder_id=args.id,
        confirmation=args.confirmation,
        operator=args.operator or "基金会计林姐",
    )

    if not reminder:
        print(f"错误: 未找到ID为 '{args.id}' 的记录")
        sys.exit(1)

    print(f"✓ 林姐已确认完成！")
    print(f"  状态: {reminder.status.value}")
    print(f"  确认说明: {args.confirmation}")


def cmd_report(args):
    storage = Storage()
    manager = ReminderManager(storage)
    report = manager.generate_report()
    print(report)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n✓ 报告已保存到: {args.output}")


def cmd_pending_review(args):
    storage = Storage()
    manager = ReminderManager(storage)
    reminders = manager.get_pending_review_reminders()

    print_header(f"待财务复核记录 ({len(reminders)}条)")

    if not reminders:
        print("暂无待复核记录")
        return

    for i, r in enumerate(reminders, 1):
        print(f"\n【记录{i}】ID: {r.id}")
        print(f"  {r.bond_code} {r.bond_name}")
        print(f"  机构: {r.institution_full_name}")
        print(f"  当前简称: '{r.institution_alias}' | 标准简称: '{r.detected_alias}'")
        print(f"  说明: {r.alias_mismatch_note}")
        print(f"  操作建议: 使用 resolve-alias 命令进行复核")

    print()


def cmd_pending_linjie(args):
    storage = Storage()
    manager = ReminderManager(storage)
    reminders = manager.get_pending_linjie_reminders()

    print_header(f"待林姐处理记录 ({len(reminders)}条)")

    if not reminders:
        print("暂无待林姐处理记录")
        return

    for i, r in enumerate(reminders, 1):
        print(f"\n【记录{i}】ID: {r.id}")
        print(f"  {r.bond_code} {r.bond_name}")
        print(f"  机构: {r.institution_alias}")
        print(f"  回售日期: {r.redemption_date}")
        print(f"  行权金额: {r.exercise_amount:,.2f} 元")
        if r.has_tail_adjustment:
            print(f"  尾差调整: {len(r.tail_adjustments)}条")
        if r.supplementary_records:
            sup = r.supplementary_records[-1]
            print(f"  下一步: {sup.next_step.value}")

    print()


def main():
    parser = argparse.ArgumentParser(
        description="债券回售提醒核对系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 初始化演示数据
  python cli.py init-demo

  # 查看所有记录
  python cli.py list

  # 查看待财务复核记录
  python cli.py pending-review

  # 查看待林姐处理记录
  python cli.py pending-linjie

  # 查看记录详情
  python cli.py show <id>

  # 导入新记录
  python cli.py import --bond-code 127123 --bond-name "21国开01" \\
      --institution-full-name "中国工商银行股份有限公司" \\
      --institution-alias "工商银行" --redemption-date 2026-07-01 \\
      --exercise_amount 10000000 --coupon-rate 3.25

  # 添加尾差调整条
  python cli.py add-tail <id> --amount-diff 0.58 \\
      --reason "四舍五入尾差调整" \\
      --remark "已与对手方确认，详见尾差调整说明.docx"

  # 复核机构简称（使用标准简称）
  python cli.py resolve-alias <id> --use-standard \\
      --reason "经核对工商登记信息，确认使用标准简称"

  # 复核机构简称（保留原简称）
  python cli.py resolve-alias <id> --no-use-standard \\
      --confirmed-alias "BOC" --reason "合同约定使用BOC"

  # 转交林姐
  python cli.py send-to-linjie <id> --message "请林姐确认尾差调整"

  # 林姐确认完成
  python cli.py linjie-confirm <id> --confirmation "数据无误，可以记账"

  # 生成完整报告
  python cli.py report --output report.txt
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("init-demo", help="初始化演示数据")

    parser_list = subparsers.add_parser("list", help="列出所有记录")
    parser_list.add_argument("--status", help="按状态筛选")

    parser_show = subparsers.add_parser("show", help="查看记录详情")
    parser_show.add_argument("id", help="记录ID")

    parser_import = subparsers.add_parser("import", help="导入新记录")
    parser_import.add_argument("--bond-code", required=True, help="债券代码")
    parser_import.add_argument("--bond-name", required=True, help="债券名称")
    parser_import.add_argument("--institution-full-name", required=True, help="机构全称")
    parser_import.add_argument("--institution-alias", required=True, help="机构简称")
    parser_import.add_argument("--redemption-date", required=True, help="回售日期 (YYYY-MM-DD)")
    parser_import.add_argument("--exercise-amount", required=True, type=float, help="行权金额")
    parser_import.add_argument("--coupon-rate", required=True, type=float, help="票面利率(%)")
    parser_import.add_argument("--source", help="数据来源")
    parser_import.add_argument("--import-batch", help="导入批次")
    parser_import.add_argument("--raw-data", help="原始数据 (JSON格式)")
    parser_import.add_argument("--operator", help="操作人")

    parser_tail = subparsers.add_parser("add-tail", help="添加尾差调整条")
    parser_tail.add_argument("id", help="记录ID")
    parser_tail.add_argument("--amount-diff", required=True, type=float, help="差额")
    parser_tail.add_argument("--reason", required=True, help="调整原因")
    parser_tail.add_argument("--remark", required=True, help="备注(保留原始材料说明)")
    parser_tail.add_argument("--operator", help="操作人")

    parser_alias = subparsers.add_parser("resolve-alias", help="复核机构简称不一致")
    parser_alias.add_argument("id", help="记录ID")
    alias_group = parser_alias.add_mutually_exclusive_group(required=True)
    alias_group.add_argument("--use-standard", action="store_true", help="使用标准简称")
    alias_group.add_argument("--no-use-standard", action="store_true", help="不使用标准简称，需指定确认的简称")
    parser_alias.add_argument("--confirmed-alias", help="确认使用的简称 (与--no-use-standard配合使用)")
    parser_alias.add_argument("--reason", required=True, help="复核原因")
    parser_alias.add_argument("--operator", help="操作人")

    parser_send = subparsers.add_parser("send-to-linjie", help="转交林姐处理")
    parser_send.add_argument("id", help="记录ID")
    parser_send.add_argument("--message", required=True, help="转交说明")
    parser_send.add_argument("--operator", help="操作人")

    parser_confirm = subparsers.add_parser("linjie-confirm", help="林姐确认完成")
    parser_confirm.add_argument("id", help="记录ID")
    parser_confirm.add_argument("--confirmation", required=True, help="确认说明")
    parser_confirm.add_argument("--operator", help="操作人")

    parser_report = subparsers.add_parser("report", help="生成核对报告")
    parser_report.add_argument("--output", help="输出文件路径")

    subparsers.add_parser("pending-review", help="查看待财务复核记录")
    subparsers.add_parser("pending-linjie", help="查看待林姐处理记录")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    cmd_handlers = {
        "init-demo": cmd_init_demo,
        "list": cmd_list,
        "show": cmd_show,
        "import": cmd_import,
        "add-tail": cmd_add_tail,
        "resolve-alias": cmd_resolve_alias,
        "send-to-linjie": cmd_send_to_linjie,
        "linjie-confirm": cmd_linjie_confirm,
        "report": cmd_report,
        "pending-review": cmd_pending_review,
        "pending-linjie": cmd_pending_linjie,
    }

    handler = cmd_handlers.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
