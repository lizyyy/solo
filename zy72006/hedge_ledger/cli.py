import argparse
import json
import os
import sys

from .ledger import HedgeLedger


def cmd_import(args, ledger: HedgeLedger):
    if not os.path.exists(args.file):
        print(f"错误: 文件不存在 — {args.file}")
        sys.exit(1)
    result = ledger.import_file(args.file, on_duplicate=args.on_duplicate)
    print("\n导入完成:")
    print(f"  新增: {result['added']}")
    print(f"  跳过: {result['skipped']}")
    print(f"  更新: {result['updated']}")
    print(f"  冲突: {result['conflicts']}")
    print(f"  错误: {result['errors']}")
    print()
    print(ledger.summary())


def cmd_summary(args, ledger: HedgeLedger):
    print(ledger.summary())


def cmd_export(args, ledger: HedgeLedger):
    json_path = ledger.export_detail(args.json_name)
    print(f"JSON 明细已导出: {json_path}")

    csv_paths = ledger.export_csv(prefix=args.csv_prefix)
    for p in csv_paths:
        print(f"CSV 分区已导出: {p}")

    print()
    print(ledger.summary())


def cmd_override(args, ledger: HedgeLedger):
    ok = ledger.override_status(args.record_id, args.status, args.reason)
    if ok:
        print(f"记录 {args.record_id} 已改判为 {args.status}，原因: {args.reason}")
        rec = ledger.get_record(args.record_id)
        if rec:
            print(f"  审计轨迹: {len(rec.audit_trail)} 条")
    else:
        print(f"未找到记录: {args.record_id}")
        sys.exit(1)


def cmd_list(args, ledger: HedgeLedger):
    records = ledger.list_records()
    for r in records:
        status = r["status"]
        rid = r["record_id"]
        td = r["trade_date"] or "日期缺失"
        route = r["route"] or "航线缺失"
        amt = f"{r['notional_amount']}{r['currency']}" if r["notional_amount"] is not None else "金额缺失"
        src = r.get("source", {}).get("file_name", "?")
        print(f"  [{rid}] {status:20s} {td} {route:10s} {amt:15s} ← {src}")


def cmd_audit(args, ledger: HedgeLedger):
    entries = ledger.audit_log.read_for_record(args.record_id)
    if not entries:
        print(f"记录 {args.record_id} 无审计日志")
        return
    for e in entries:
        ts = e.get("timestamp", "?")
        action = e.get("action", "?")
        detail = e.get("detail", "")
        before = e.get("before_value", "")
        after = e.get("after_value", "")
        parts = [f"  [{ts}] {action}: {detail}"]
        if before:
            parts.append(f"    变更前: {before}")
        if after:
            parts.append(f"    变更后: {after}")
        print("\n".join(parts))


def main():
    parser = argparse.ArgumentParser(
        prog="hedge-ledger",
        description="航运运费套保台账 — 命令行工具",
    )
    parser.add_argument("--work-dir", default=".", help="工作目录")

    sub = parser.add_subparsers(dest="command")

    p_import = sub.add_parser("import", help="导入 CSV/Excel 文件")
    p_import.add_argument("file", help="待导入文件路径")
    p_import.add_argument("--on-duplicate", choices=["skip", "update", "conflict"],
                          default="skip", help="重复记录处理策略 (默认: skip)")

    p_summary = sub.add_parser("summary", help="显示台账摘要")

    p_export = sub.add_parser("export", help="导出财务明细")
    p_export.add_argument("--json-name", default="finance_detail.json")
    p_export.add_argument("--csv-prefix", default="finance")

    p_override = sub.add_parser("override", help="人工改判记录状态")
    p_override.add_argument("record_id", help="记录 ID")
    p_override.add_argument("status", choices=["confirmed", "pending_material", "manual_override"],
                            help="目标状态")
    p_override.add_argument("--reason", required=True, help="改判原因")

    p_list = sub.add_parser("list", help="列出所有记录")

    p_audit = sub.add_parser("audit", help="查看记录审计日志")
    p_audit.add_argument("record_id", help="记录 ID")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    ledger = HedgeLedger(args.work_dir)

    dispatch = {
        "import": cmd_import,
        "summary": cmd_summary,
        "export": cmd_export,
        "override": cmd_override,
        "list": cmd_list,
        "audit": cmd_audit,
    }
    fn = dispatch.get(args.command)
    if fn:
        fn(args, ledger)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
