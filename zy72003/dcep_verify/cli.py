import argparse
import glob
import sys
import os

from dcep_verify import db
from dcep_verify.importer import import_file, import_batch
from dcep_verify.conflict import list_conflicts, resolve_conflict_interactive, show_evidence
from dcep_verify.reporter import print_summary, export_finance_detail


def cmd_import(args):
    db.init_db()
    conn = db.get_connection()
    try:
        paths = []
        for pattern in args.files:
            expanded = glob.glob(pattern)
            if expanded:
                paths.extend(sorted(expanded))
            else:
                paths.append(pattern)

        if not paths:
            print("  没有找到可导入的文件")
            return

        results = import_batch(paths, source_type=args.source_type, conn=conn)

        print("\n  导入结果:")
        print("  " + "-" * 60)
        for r in results:
            if "error" in r:
                print(f"  ✗ {r['file']}: {r['error']}")
            else:
                parts = [f"导入{r['inserted']}条"]
                if r["skipped"]:
                    parts.append(f"跳过{r['skipped']}条(数据一致)")
                if r["conflicts"]:
                    parts.append(f"冲突{r['conflicts']}条")
                print(f"  ✓ {r['file']} ({r['source_type']})  {', '.join(parts)}")
        print()

        print_summary(conn)
    finally:
        conn.close()


def cmd_query(args):
    db.init_db()
    conn = db.get_connection()
    try:
        for biz_id in args.biz_ids:
            show_evidence(conn, biz_id)
    finally:
        conn.close()


def cmd_summary(args):
    db.init_db()
    conn = db.get_connection()
    try:
        print_summary(conn)
    finally:
        conn.close()


def cmd_export(args):
    db.init_db()
    conn = db.get_connection()
    try:
        export_finance_detail(conn, output_path=args.output)
    finally:
        conn.close()


def cmd_conflicts(args):
    db.init_db()
    conn = db.get_connection()
    try:
        list_conflicts(conn, biz_id=args.biz_id, show_resolved=args.all)
    finally:
        conn.close()


def cmd_resolve(args):
    db.init_db()
    conn = db.get_connection()
    try:
        resolve_conflict_interactive(conn, args.conflict_id, args.action)
        if args.action in ("keep", "update"):
            remaining = db.get_conflicts(conn, unresolved_only=True)
            if remaining:
                print(f"\n  还有 {len(remaining)} 条未解决冲突，继续处理请执行 resolve 命令")
            else:
                print("\n  所有冲突已解决")
    finally:
        conn.close()


def cmd_verify(args):
    db.init_db()
    conn = db.get_connection()
    try:
        print("\n  持久化验证:")
        print("  " + "-" * 60)
        stats = db.get_stats(conn)
        import_logs = db.get_import_logs(conn)

        print(f"  记录总数: {stats['total_records']}")
        print(f"  总金额: {stats['total_amount']:,.2f} 元")
        print(f"  未解决冲突: {stats['unresolved_conflicts']}")
        print(f"  导入历史: {len(import_logs)} 次")

        all_ok = True
        for r in db.get_all_records(conn):
            notes = db.get_notes(conn, r["biz_id"])
            traces = db.get_source_traces(conn, r["biz_id"])
            if not traces:
                print(f"  ⚠ {r['biz_id']} 没有来源追踪记录")
                all_ok = False

        if all_ok:
            print(f"\n  ✓ 所有记录均可追溯到来源，数据完整")
        print()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        prog="dcep-verify",
        description="数字人民币补贴核销工具 — 让合同扫描件材料对得上",
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    p_import = sub.add_parser("import", help="导入 CSV/Excel 文件")
    p_import.add_argument("files", nargs="+", help="文件路径(支持通配符)")
    p_import.add_argument("--source-type", "-t", help="强制指定来源类型(收款流水/退款申请/审批邮件/手写备注/附件索引/合同扫描补录)")
    p_import.set_defaults(func=cmd_import)

    p_query = sub.add_parser("query", help="查询业务编号详情(含来源追踪)")
    p_query.add_argument("biz_ids", nargs="+", help="业务编号")
    p_query.set_defaults(func=cmd_query)

    p_summary = sub.add_parser("summary", help="终端摘要")
    p_summary.set_defaults(func=cmd_summary)

    p_export = sub.add_parser("export", help="导出财务明细CSV")
    p_export.add_argument("--output", "-o", help="输出文件路径")
    p_export.set_defaults(func=cmd_export)

    p_conflicts = sub.add_parser("conflicts", help="列出冲突记录")
    p_conflicts.add_argument("--biz-id", help="按业务编号筛选")
    p_conflicts.add_argument("--all", action="store_true", help="显示已解决的冲突")
    p_conflicts.set_defaults(func=cmd_conflicts)

    p_resolve = sub.add_parser("resolve", help="解决冲突(keep=保留现有/update=采用新值)")
    p_resolve.add_argument("conflict_id", type=int, help="冲突编号")
    p_resolve.add_argument("action", choices=["keep", "update"], help="keep=保留现有值, update=采用新值")
    p_resolve.set_defaults(func=cmd_resolve)

    p_verify = sub.add_parser("verify", help="验证数据持久化完整性")
    p_verify.set_defaults(func=cmd_verify)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
