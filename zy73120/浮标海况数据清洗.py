#!/usr/bin/env python3
import argparse
import os
import sys
from datetime import datetime

from buoy_data_cleaner import (
    DataStore, BuoyCleaner, Exporter, load_input_csv,
)

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workspace")


def print_banner():
    print("=" * 56)
    print("  浮标海况数据清洗  Buoy Sea State Data Cleaner")
    print("=" * 56)
    print(f"工作目录: {DEFAULT_DATA_DIR}")
    print()


def cmd_import(args):
    store = DataStore(args.data_dir)
    cleaner = BuoyCleaner(store)
    records = load_input_csv(args.input)
    batch_id = args.batch or datetime.now().strftime("BATCH_%Y%m%d_%H%M%S")
    result = cleaner.import_records(records, batch_id=batch_id, operator=args.operator)
    print(f"导入批次: {batch_id}")
    print(f"新增: {result['added']} 条")
    print(f"跳过(重复): {result['skipped']} 条")
    if result["note_preserved"]:
        print(f"已保护人工备注: {result['note_preserved']} 条")

    issues = cleaner.get_duplicate_details()
    if issues:
        print()
        print(f"检测到 {len(issues)} 组采样瓶号重复，已单独列出待确认:")
        for issue in issues:
            print(f"  - 采样瓶号 {issue['sample_bottle_id']}:")
            print(f"    待确认理由: {issue['reason']}")
            print(f"    受影响记录 {len(issue['records'])} 条: "
                  + ", ".join(r["record_id"] for r in issue["records"]))


def cmd_list(args):
    store = DataStore(args.data_dir)
    records = store.load_records()
    if not records:
        print("暂无记录。请先用 import 导入。")
        return
    print(f"共 {len(records)} 条记录:")
    header = f"{'记录ID':<14}{'浮标':<8}{'采样瓶号':<16}{'状态':<18}{'纬度(标准)':<14}{'经度(标准)':<14}{'备注':<10}"
    print(header)
    print("-" * len(header))
    for r in records:
        lat = f"{r.latitude_std:.6f}" if r.latitude_std is not None else "-"
        lon = f"{r.longitude_std:.6f}" if r.longitude_std is not None else "-"
        print(f"{r.record_id:<14}{r.buoy_id:<8}{r.sample_bottle_id:<16}{r.status:<18}{lat:<14}{lon:<14}{(r.manual_note or '')[:8]:<10}")


def cmd_duplicates(args):
    store = DataStore(args.data_dir)
    cleaner = BuoyCleaner(store)
    issues = cleaner.get_duplicate_details()
    if not issues:
        print("未检测到采样瓶号重复。")
        return
    print(f"共 {len(issues)} 组采样瓶号重复待确认:")
    for issue in issues:
        print()
        print(f"【采样瓶号】 {issue['sample_bottle_id']}")
        print(f"  待确认理由: {issue['reason']}")
        for r in issue["records"]:
            print(f"  - 记录 {r['record_id']}  浮标={r['buoy_id']}  时间={r['timestamp']}  "
                  f"状态={r['status']}  晚到={'是' if r['is_late_arrival']=='是' else '否'}")


def cmd_confirm(args):
    store = DataStore(args.data_dir)
    cleaner = BuoyCleaner(store)
    ok = cleaner.confirm_record(
        record_id=args.record_id,
        new_status=args.status,
        reason=args.reason,
        operator=args.operator,
        manual_note=args.note,
    )
    if ok:
        print(f"记录 {args.record_id} 已确认: {args.status}")
        print(f"原因: {args.reason}")
    else:
        print(f"未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)


def cmd_audit(args):
    store = DataStore(args.data_dir)
    logs = store.load_audit_logs()
    if not logs:
        print("暂无人工确认变更日志。")
        return
    print(f"共 {len(logs)} 条变更记录:")
    for log in logs:
        print(f"  [{log.changed_at}] {log.operator} 对记录 {log.record_id} 的"
              f" {log.field_name}: 「{log.old_value}」 → 「{log.new_value}」")
        print(f"    原因: {log.reason}")


def cmd_export(args):
    exporter = Exporter(args.data_dir)
    status_filter = args.status.split(",") if args.status else None
    out_dir = exporter.export(
        output_dir=args.output,
        status_filter=status_filter,
        batch_filter=args.batch,
        operator=args.operator,
    )
    print(f"已导出到: {out_dir}")
    print("包含文件:")
    for f in sorted(os.listdir(out_dir)):
        print(f"  - {f}")


def cmd_demo(args):
    print_banner()
    print("【第1步/5】导入样例遥感截图数据（含写法混乱经纬度、晚到附件、采样瓶重复）…")
    sample_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data", "遥感截图导出_20260615.csv")
    sys.argv = ["prog", "import", "-i", sample_csv, "--data-dir", args.data_dir, "--operator", args.operator]
    main()

    print()
    print("【第2步/5】查看清洗结果列表（经纬度已统一为十进制）…")
    sys.argv = ["prog", "list", "--data-dir", args.data_dir]
    main()

    print()
    print("【第3步/5】查看采样瓶重复待确认清单…")
    sys.argv = ["prog", "duplicates", "--data-dir", args.data_dir]
    main()

    print()
    print("【第4步/5】尝试重复导入同样的CSV（验证不翻倍、人工备注不被覆盖）…")
    sys.argv = ["prog", "import", "-i", sample_csv, "--data-dir", args.data_dir, "--operator", args.operator]
    main()

    print()
    print("【第5步/5】导出数据包（含筛选口径说明）…")
    sys.argv = ["prog", "export", "-o", args.output, "--data-dir", args.data_dir, "--operator", args.operator]
    main()

    print()
    print("演示完成。可继续使用 confirm 命令对重复记录进行人工确认。")


def main():
    parser = argparse.ArgumentParser(
        prog="浮标海况数据清洗",
        description="海洋站浮标海况数据清洗工具：经纬度标准化、采样瓶去重、人工确认审计、导出",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
常用流程:
  1) 导入:   浮标海况数据清洗 import -i 遥感截图.csv
  2) 查看:   浮标海况数据清洗 list
  3) 查重复: 浮标海况数据清洗 duplicates
  4) 确认:   浮标海况数据清洗 confirm --record-id <ID> --status 已确认正常 --reason "补采样品" --operator 小宋
  5) 导出:   浮标海况数据清洗 export -o ./导出
  一键演示:  浮标海况数据清洗 demo
        """,
    )
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="数据存储目录（默认: ./workspace）")

    sub = parser.add_subparsers(dest="command", required=True)

    p_import = sub.add_parser("import", help="导入遥感截图CSV并清洗")
    p_import.add_argument("-i", "--input", required=True, help="输入CSV路径")
    p_import.add_argument("--batch", help="批次号（默认自动生成）")
    p_import.add_argument("--operator", default="operator", help="操作人")
    p_import.set_defaults(func=cmd_import)

    p_list = sub.add_parser("list", help="列出清洗后记录")
    p_list.set_defaults(func=cmd_list)

    p_dup = sub.add_parser("duplicates", help="列出采样瓶重复待确认清单")
    p_dup.set_defaults(func=cmd_duplicates)

    p_confirm = sub.add_parser("confirm", help="人工确认某条记录的状态")
    p_confirm.add_argument("--record-id", required=True, help="记录ID")
    p_confirm.add_argument("--status", required=True, choices=["已确认正常", "已确认异常", "已清洗", "采样瓶重复待确认", "坐标异常待确认"], help="新状态")
    p_confirm.add_argument("--reason", required=True, help="确认原因（写入审计日志）")
    p_confirm.add_argument("--note", help="人工备注（可选，不覆盖原有非空备注）")
    p_confirm.add_argument("--operator", default="operator", help="操作人")
    p_confirm.set_defaults(func=cmd_confirm)

    p_audit = sub.add_parser("audit", help="查看人工确认变更审计日志")
    p_audit.set_defaults(func=cmd_audit)

    p_export = sub.add_parser("export", help="导出数据包（含筛选口径说明）")
    p_export.add_argument("-o", "--output", default=".", help="导出目录（默认: 当前目录）")
    p_export.add_argument("--status", help="按状态筛选，逗号分隔（如: 已清洗,已确认正常）")
    p_export.add_argument("--batch", help="按导入批次筛选")
    p_export.add_argument("--operator", default="operator", help="操作人")
    p_export.set_defaults(func=cmd_export)

    p_demo = sub.add_parser("demo", help="一键跑演示流程（导入+去重+二次导入幂等+导出）")
    p_demo.add_argument("--operator", default="demo_operator", help="操作人")
    p_demo.add_argument("--output", default=".", help="导出目录")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
