import argparse
import sys
from subsidy_reconciler.db import Database
from subsidy_reconciler.importer import import_file, import_directory
from subsidy_reconciler.reconciler import reconcile
from subsidy_reconciler.exporter import print_summary, export_detail
from subsidy_reconciler.models import (
    SOURCE_TYPES,
    SOURCE_TYPE_LABELS,
    STATUS_LABELS,
    STATUS_CONFIRMED,
    STATUS_PENDING_MANUAL,
    STATUS_PENDING_MATERIAL,
    STATUS_OLD_STANDARD,
    STATUS_OVERRIDDEN,
)


def cmd_import(args):
    db = Database()
    try:
        if args.dir:
            results = import_directory(args.dir, index_file=args.index, db=db)
            for r in results:
                print(f"  [{r['source_type_label']}] {r['file_name']}: "
                      f"共{r['total_rows']}条 → "
                      f"导入{r['imported']} 跳过{r['skipped']} "
                      f"更新{r['updated']} 冲突{r['conflicted']}")
        elif args.file:
            result = import_file(args.file, source_type=args.type, db=db)
            print(f"  [{result['source_type_label']}] {result['file_name']}: "
                  f"共{result['total_rows']}条 → "
                  f"导入{result['imported']} 跳过{result['skipped']} "
                  f"更新{result['updated']} 冲突{result['conflicted']}")
        else:
            print("错误: 请指定 --file 或 --dir", file=sys.stderr)
            sys.exit(1)
    finally:
        db.close()


def cmd_supplement(args):
    db = Database()
    try:
        record = db.supplement_record(
            record_hash=args.hash,
            remark=args.remark,
            status=args.status,
        )
        if not record:
            print(f"错误: 找不到记录 {args.hash}", file=sys.stderr)
            sys.exit(1)

        print(f"  已补录: {record['record_hash']}")
        print(f"  日期: {record['subsidy_date']}  影片: {record['movie_name']}")
        print(f"  金额: ¥{record['subsidy_amount']:.2f}")
        print(f"  状态: {STATUS_LABELS.get(record['status'], record['status'])}")
        print(f"  判断: {record['judgment_reason']}")
        if record.get("remark"):
            print(f"  备注: {record['remark'].strip()}")
    finally:
        db.close()


def cmd_reconcile(args):
    db = Database()
    try:
        result = reconcile(db=db)

        print("=" * 60)
        print("  电影票补贴结算 - 对账结果")
        print("=" * 60)
        print(f"  匹配记录: {result['matched']}")
        print(f"  未匹配:   {result['unmatched']}")
        print(f"  差异组数: {len(result['discrepancies'])}")

        if result["discrepancies"]:
            print()
            print("  差异明细:")
            for d in result["discrepancies"]:
                print(f"    {d['date']} | {d['movie']} | "
                      f"收款¥{d['payment_total']:.2f} vs 审批¥{d['approval_total']:.2f} | "
                      f"差额¥{d['diff']:.2f}")

        if result["groups"]:
            print()
            print("  对账分组:")
            for g in result["groups"]:
                print(f"    组{g['group_id']}: {g['date']} {g['movie']} → {g.get('result', 'N/A')} | {g.get('detail', '')}")

        print("=" * 60)
    finally:
        db.close()


def cmd_export(args):
    db = Database()
    try:
        result = export_detail(output_dir=args.output, db=db)
    finally:
        db.close()


def cmd_status(args):
    db = Database()
    try:
        print_summary(db=db)
    finally:
        db.close()


def cmd_audit(args):
    db = Database()
    try:
        records = db.get_audit_trail(record_hash=args.hash)
        print("=" * 60)
        print("  电影票补贴结算 - 审计追踪")
        print("=" * 60)
        for a in records:
            action_label = STATUS_LABELS.get(a["action"], a["action"])
            print(f"  [{a['timestamp']}] {a['record_hash']} | {action_label}")
            if a.get("detail"):
                print(f"    {a['detail'][:80]}")
        if not records:
            print("  (无记录)")
        print("=" * 60)
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        prog="subsidy-reconciler",
        description="电影票补贴结算对账工具"
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    p_import = subparsers.add_parser("import", help="导入CSV文件")
    p_import.add_argument("--file", "-f", help="单个CSV文件路径")
    p_import.add_argument("--dir", "-d", help="批量导入目录")
    p_import.add_argument("--index", "-i", help="附件索引文件(目录模式下)")
    p_import.add_argument("--type", "-t", choices=SOURCE_TYPES,
                          help="来源类型 (自动检测或手动指定)")
    p_import.set_defaults(func=cmd_import)

    p_supp = subparsers.add_parser("supplement", help="补录备注/改判")
    p_supp.add_argument("--hash", required=True, help="记录哈希")
    p_supp.add_argument("--remark", "-r", help="备注内容")
    p_supp.add_argument("--status", "-s",
                        choices=[STATUS_CONFIRMED, STATUS_PENDING_MANUAL,
                                 STATUS_PENDING_MATERIAL, STATUS_OLD_STANDARD,
                                 STATUS_OVERRIDDEN],
                        help="改判状态")
    p_supp.set_defaults(func=cmd_supplement)

    p_recon = subparsers.add_parser("reconcile", help="执行对账")
    p_recon.set_defaults(func=cmd_reconcile)

    p_export = subparsers.add_parser("export", help="导出明细和报告")
    p_export.add_argument("--output", "-o", default="output", help="输出目录")
    p_export.set_defaults(func=cmd_export)

    p_status = subparsers.add_parser("status", help="查看状态摘要")
    p_status.set_defaults(func=cmd_status)

    p_audit = subparsers.add_parser("audit", help="查看审计追踪")
    p_audit.add_argument("--hash", help="按记录哈希筛选")
    p_audit.set_defaults(func=cmd_audit)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
