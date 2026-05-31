#!/usr/bin/env python3
import argparse
import sys
import os
from typing import List

from .manager import DiffReportManager
from .exporter import RecordExporter
from .models import RecordStatus, DiffType


def print_table(headers: List[str], rows: List[List[str]]):
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))

    separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    header_row = "|" + "|".join(f" {h:<{w}} " for h, w in zip(headers, col_widths)) + "|"

    print(separator)
    print(header_row)
    print(separator)

    for row in rows:
        data_row = "|" + "|".join(f" {str(c):<{w}} " for c, w in zip(row, col_widths)) + "|"
        print(data_row)

    print(separator)


def cmd_register_order(args):
    manager = DiffReportManager(args.data_dir)
    manager.register_change_order(
        order_id=args.order_id,
        title=args.title,
        applicant=args.applicant,
        description=args.description or "",
        source=args.source or "",
    )
    print(f"变更单已注册: {args.order_id}")


def cmd_import_zip(args):
    manager = DiffReportManager(args.data_dir)
    records = manager.import_diff_from_zip(
        zip_path=args.zip_path,
        source=args.source,
        change_order_id=args.order_id,
        operator=args.operator,
        base_dir=args.base_dir,
    )
    print(f"成功导入 {len(records)} 条记录")
    for r in records:
        status_mark = "!" if r.status == RecordStatus.PENDING else " "
        print(f"  {status_mark} [{r.status.value}] {r.file_path}")
        if r.pending_reason:
            print(f"      待处理原因: {r.pending_reason}")


def cmd_add_manual(args):
    manager = DiffReportManager(args.data_dir)
    diff_type = DiffType(args.type)
    record = manager.add_manual_record(
        file_path=args.file_path,
        diff_type=diff_type,
        source=args.source,
        change_order_id=args.order_id,
        operator=args.operator,
        md5_before=args.md5_before,
        md5_after=args.md5_after,
        remark=args.remark or "",
        actual_file_path=args.verify_file,
    )
    print(f"记录已添加: {record.record_id}")
    print(f"  状态: {record.status.value}")
    if record.pending_reason:
        print(f"  待处理原因: {record.pending_reason}")


def cmd_withdraw(args):
    manager = DiffReportManager(args.data_dir)
    if manager.withdraw_record(args.record_id, args.operator, args.reason):
        print(f"记录已撤回: {args.record_id}")
    else:
        print(f"记录不存在: {args.record_id}", file=sys.stderr)
        sys.exit(1)


def cmd_confirm(args):
    manager = DiffReportManager(args.data_dir)
    if manager.confirm_record(args.record_id, args.confirmer, args.result, args.remark or ""):
        print(f"确认结果已记录: {args.result}")
    else:
        print(f"记录不存在: {args.record_id}", file=sys.stderr)
        sys.exit(1)


def cmd_rollback(args):
    manager = DiffReportManager(args.data_dir)
    if manager.rollback_record(args.record_id, args.operator, args.reason):
        print(f"记录已标记为回滚: {args.record_id}")
    else:
        print(f"记录不存在: {args.record_id}", file=sys.stderr)
        sys.exit(1)


def cmd_remark(args):
    manager = DiffReportManager(args.data_dir)
    if manager.update_record_remark(args.record_id, args.operator, args.remark):
        print(f"备注已更新")
    else:
        print(f"记录不存在: {args.record_id}", file=sys.stderr)
        sys.exit(1)


def cmd_list(args):
    manager = DiffReportManager(args.data_dir)

    status = RecordStatus(args.status) if args.status else None
    records = manager.query_records(
        status=status,
        source=args.source,
        change_order_id=args.order_id,
        operator=args.operator,
    )

    if not records:
        print("没有找到记录")
        return

    headers = ["记录ID", "状态", "文件路径", "来源", "操作人", "待处理原因"]
    rows = []
    for r in records[: args.limit]:
        rows.append(
            [
                r.record_id,
                r.status.value,
                r.file_path[:40] + "..." if len(r.file_path) > 40 else r.file_path,
                r.source,
                r.operator,
                r.pending_reason[:30] if r.pending_reason else "",
            ]
        )

    print_table(headers, rows)
    print(f"共 {len(records)} 条记录, 显示前 {min(args.limit, len(records))} 条")


def cmd_detail(args):
    manager = DiffReportManager(args.data_dir)
    detail = manager.get_record_detail(args.record_id)
    if not detail:
        print(f"记录不存在: {args.record_id}", file=sys.stderr)
        sys.exit(1)

    r = detail["record"]
    order = detail["change_order"]
    history = manager.get_record_history(args.record_id)

    print("=" * 60)
    print("记录详情")
    print("=" * 60)
    print(f"记录ID: {r.record_id}")
    print(f"文件路径: {r.file_path}")
    print(f"变更类型: {r.diff_type.value}")
    print(f"状态: {r.status.value}")
    print(f"来源: {r.source}")
    print(f"变更单: {r.change_order_id}")
    if order:
        print(f"  - 标题: {order.title}")
        print(f"  - 申请人: {order.applicant}")
    print(f"操作人: {r.operator}")
    print(f"MD5(前): {r.md5_before or '-'}")
    print(f"MD5(后): {r.md5_after or '-'}")
    print(f"备注: {r.remark or '-'}")
    if r.pending_reason:
        print(f"待处理原因: {r.pending_reason}")
    print(f"路径含空格: {'是' if r.has_path_space else '否'}")
    print(f"文件不匹配: {'是' if r.file_mismatch else '否'}")
    print(f"重复执行: {'是' if r.duplicate_exec else '否'}")
    print(f"创建时间: {r.create_time}")
    print(f"更新时间: {r.update_time}")

    if history:
        print()
        print("操作历史:")
        for h in history:
            print(f"  [{h['time']}] {h['type']} - {h['operator']} - {h['action']}")
            if h["detail"]:
                print(f"      {h['detail']}")

    print("=" * 60)


def cmd_export(args):
    manager = DiffReportManager(args.data_dir)

    status = RecordStatus(args.status) if args.status else None
    records = manager.query_records(
        status=status,
        source=args.source,
        change_order_id=args.order_id,
        operator=args.operator,
    )

    if not records:
        print("没有找到记录可导出")
        return

    if args.format == "csv":
        RecordExporter.to_csv(records, args.output)
    elif args.format == "json":
        RecordExporter.to_json(records, args.output)

    print(RecordExporter.generate_summary(records))
    print(f"已导出到: {args.output}")


def cmd_summary(args):
    manager = DiffReportManager(args.data_dir)
    records = manager.storage.load_all_records()
    print(RecordExporter.generate_summary(records))


def main():
    parser = argparse.ArgumentParser(
        prog="diff-report",
        description="压缩包差异报告管理工具 - 运维专用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
常用命令示例:
  diff-report order -o CHG001 -t "版本升级" -a 张三
  diff-report import -z pkg.zip -s v1.2.3 -o CHG001 -p 李四
  diff-report list --status 待确认
  diff-report confirm -i rec_xxx -c 王五 -r 正常
  diff-report export -o report.csv
        """,
    )

    parser.add_argument(
        "-d", "--data-dir", default="./data", help="数据存储目录 (默认: ./data)"
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    sp_order = subparsers.add_parser("order", help="注册变更单")
    sp_order.add_argument("-o", "--order-id", required=True, help="变更单号")
    sp_order.add_argument("-t", "--title", required=True, help="变更标题")
    sp_order.add_argument("-a", "--applicant", required=True, help="申请人")
    sp_order.add_argument("-m", "--description", help="变更描述")
    sp_order.add_argument("-s", "--source", help="来源标识")
    sp_order.set_defaults(func=cmd_register_order)

    sp_import = subparsers.add_parser("import", help="从压缩包导入差异")
    sp_import.add_argument("-z", "--zip-path", required=True, help="压缩包路径")
    sp_import.add_argument("-s", "--source", required=True, help="来源标识(如版本号)")
    sp_import.add_argument("-o", "--order-id", required=True, help="关联变更单号")
    sp_import.add_argument("-p", "--operator", required=True, help="操作人")
    sp_import.add_argument("-b", "--base-dir", help="压缩包内基础目录")
    sp_import.set_defaults(func=cmd_import_zip)

    sp_add = subparsers.add_parser("add", help="人工添加记录")
    sp_add.add_argument("-f", "--file-path", required=True, help="文件路径")
    sp_add.add_argument("-t", "--type", required=True, choices=[e.value for e in DiffType], help="变更类型")
    sp_add.add_argument("-s", "--source", required=True, help="来源标识")
    sp_add.add_argument("-o", "--order-id", required=True, help="关联变更单号")
    sp_add.add_argument("-p", "--operator", required=True, help="操作人")
    sp_add.add_argument("--md5-before", help="变更前MD5")
    sp_add.add_argument("--md5-after", help="变更后MD5")
    sp_add.add_argument("-m", "--remark", help="备注")
    sp_add.add_argument("--verify-file", help="用于MD5校验的实际文件路径")
    sp_add.set_defaults(func=cmd_add_manual)

    sp_withdraw = subparsers.add_parser("withdraw", help="撤回记录")
    sp_withdraw.add_argument("-i", "--record-id", required=True, help="记录ID")
    sp_withdraw.add_argument("-p", "--operator", required=True, help="操作人")
    sp_withdraw.add_argument("-r", "--reason", required=True, help="撤回原因")
    sp_withdraw.set_defaults(func=cmd_withdraw)

    sp_confirm = subparsers.add_parser("confirm", help="人工确认记录")
    sp_confirm.add_argument("-i", "--record-id", required=True, help="记录ID")
    sp_confirm.add_argument("-c", "--confirmer", required=True, help="确认人")
    sp_confirm.add_argument("-r", "--result", required=True, choices=["正常", "异常", "待定"], help="确认结果")
    sp_confirm.add_argument("-m", "--remark", help="确认备注")
    sp_confirm.set_defaults(func=cmd_confirm)

    sp_rollback = subparsers.add_parser("rollback", help="标记回滚")
    sp_rollback.add_argument("-i", "--record-id", required=True, help="记录ID")
    sp_rollback.add_argument("-p", "--operator", required=True, help="操作人")
    sp_rollback.add_argument("-r", "--reason", required=True, help="回滚原因")
    sp_rollback.set_defaults(func=cmd_rollback)

    sp_remark = subparsers.add_parser("remark", help="更新备注")
    sp_remark.add_argument("-i", "--record-id", required=True, help="记录ID")
    sp_remark.add_argument("-p", "--operator", required=True, help="操作人")
    sp_remark.add_argument("-m", "--remark", required=True, help="新备注")
    sp_remark.set_defaults(func=cmd_remark)

    sp_list = subparsers.add_parser("list", help="列出记录")
    sp_list.add_argument("--status", choices=[e.value for e in RecordStatus], help="按状态筛选")
    sp_list.add_argument("--source", help="按来源筛选")
    sp_list.add_argument("--order-id", help="按变更单筛选")
    sp_list.add_argument("--operator", help="按操作人筛选")
    sp_list.add_argument("-n", "--limit", type=int, default=50, help="显示数量限制 (默认: 50)")
    sp_list.set_defaults(func=cmd_list)

    sp_detail = subparsers.add_parser("detail", help="查看记录详情")
    sp_detail.add_argument("-i", "--record-id", required=True, help="记录ID")
    sp_detail.set_defaults(func=cmd_detail)

    sp_export = subparsers.add_parser("export", help="导出报告")
    sp_export.add_argument("-o", "--output", required=True, help="输出文件路径")
    sp_export.add_argument("-f", "--format", choices=["csv", "json"], default="csv", help="导出格式 (默认: csv)")
    sp_export.add_argument("--status", choices=[e.value for e in RecordStatus], help="按状态筛选")
    sp_export.add_argument("--source", help="按来源筛选")
    sp_export.add_argument("--order-id", help="按变更单筛选")
    sp_export.add_argument("--operator", help="按操作人筛选")
    sp_export.set_defaults(func=cmd_export)

    sp_summary = subparsers.add_parser("summary", help="查看汇总统计")
    sp_summary.set_defaults(func=cmd_summary)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
