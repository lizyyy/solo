#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from amc_expense_accrual.services.expense_accrual_service import ExpenseAccrualService


def cmd_import_screenshot(args):
    svc = _load_service(args.data_dir)
    with open(args.file, encoding="utf-8") as f:
        rows = json.load(f)
    records = svc.import_screenshot_evidence(rows, operator=args.operator)
    print(f"导入 {len(records)} 条除权日截图记录")
    for r in records:
        print(f"  {r.record_id} | {r.business_no} | {r.status.value} | split={r.is_split_line}")


def cmd_review_tax_note(args):
    svc = _load_service(args.data_dir)
    with open(args.file, encoding="utf-8") as f:
        notes = json.load(f)
    records = svc.review_tax_note_evidence(notes, operator=args.operator)
    print(f"复核 {len(records)} 条税费率备注")
    for r in records:
        print(f"  {r.record_id} | {r.business_no} | {r.status.value}")


def cmd_update_diff(args):
    svc = _load_service(args.data_dir)
    version = svc.update_diff_list(operator=args.operator)
    print(f"差异清单已更新至 v{version.version}")
    for item in version.items:
        review_flag = " [需复核]" if item.needs_supervisor_review else ""
        print(f"  {item.business_no} | 差异={item.diff_amount:.2f} | {item.diff_type}{review_flag}")


def cmd_rollback(args):
    svc = _load_service(args.data_dir)
    result = svc.rollback_diff_list(args.target_version, operator=args.operator)
    if result is None:
        print(f"回滚失败：版本 {args.target_version} 不存在或无法回滚")
        sys.exit(1)
    print(f"差异清单已回滚至 v{args.target_version}（当前版本 v{result.version}）")


def cmd_withdraw_tax_note(args):
    svc = _load_service(args.data_dir)
    result = svc.withdraw_tax_note(
        args.business_no, reason=args.reason, operator=args.operator
    )
    if result is None:
        print(f"撤回失败：业务号 {args.business_no} 无匹配记录")
        sys.exit(1)
    print(f"已撤回业务号 {args.business_no} 的税费率备注，差异清单更新至 v{result.version}")


def cmd_export_details(args):
    svc = _load_service(args.data_dir)
    csv_content = svc.export_details_csv()
    out_path = Path(args.output)
    out_path.write_text(csv_content, encoding="utf-8")
    print(f"明细已导出至 {out_path}")


def cmd_export_accrual(args):
    svc = _load_service(args.data_dir)
    csv_content = svc.export_accrual_csv()
    out_path = Path(args.output)
    out_path.write_text(csv_content, encoding="utf-8")
    print(f"预提结果已导出至 {out_path}")


def cmd_show_records(args):
    svc = _load_service(args.data_dir)
    records = svc.get_all_records()
    print(f"共 {len(records)} 条证据记录")
    for r in records:
        se_info = ""
        if r.screenshot_evidence:
            se = r.screenshot_evidence
            se_info = f"行{se.original_line_number} | {se.line_type} | {se.amount}"
        tn_info = ""
        if r.tax_note_evidence:
            tn = r.tax_note_evidence
            tn_info = f"税率{tn.tax_rate} | {tn.stated_by}"
        print(f"  {r.record_id} | {r.business_no} | {r.status.value} | 截图:[{se_info}] | 备注:[{tn_info}] | split={r.is_split_line}({r.split_line_role})")


def _load_service(data_dir: str) -> ExpenseAccrualService:
    svc = ExpenseAccrualService(storage_dir=data_dir)
    svc.load_state()
    return svc


def main():
    parser = argparse.ArgumentParser(
        description="资管计划费用预提 - 命令行工具"
    )
    parser.add_argument("--data-dir", default="data", help="数据存储目录")
    sub = parser.add_subparsers(dest="command")

    p_import = sub.add_parser("import-screenshot", help="导入除权日截图")
    p_import.add_argument("file", help="截图行数据 JSON 文件")
    p_import.add_argument("--operator", default="system")

    p_review = sub.add_parser("review-tax-note", help="复核税费率备注")
    p_review.add_argument("file", help="税费率备注 JSON 文件")
    p_review.add_argument("--operator", default="system")

    p_diff = sub.add_parser("update-diff", help="更新差异清单")
    p_diff.add_argument("--operator", default="system")

    p_rollback = sub.add_parser("rollback", help="回滚差异清单到指定版本")
    p_rollback.add_argument("target_version", type=int, help="目标版本号")
    p_rollback.add_argument("--operator", default="system")

    p_withdraw = sub.add_parser("withdraw-tax-note", help="撤回某业务号的税费率备注")
    p_withdraw.add_argument("business_no", help="业务号")
    p_withdraw.add_argument("--reason", default="误操作撤回", help="撤回原因")
    p_withdraw.add_argument("--operator", default="system")

    p_export_d = sub.add_parser("export-details", help="导出明细 CSV")
    p_export_d.add_argument("--output", default="expense_accrual_details.csv")

    p_export_a = sub.add_parser("export-accrual", help="导出预提结果 CSV")
    p_export_a.add_argument("--output", default="expense_accrual.csv")

    p_show = sub.add_parser("show-records", help="显示所有证据记录")

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        sys.exit(0)

    commands = {
        "import-screenshot": cmd_import_screenshot,
        "review-tax-note": cmd_review_tax_note,
        "update-diff": cmd_update_diff,
        "rollback": cmd_rollback,
        "withdraw-tax-note": cmd_withdraw_tax_note,
        "export-details": cmd_export_details,
        "export-accrual": cmd_export_accrual,
        "show-records": cmd_show_records,
    }
    fn = commands.get(args.command)
    if fn:
        fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
