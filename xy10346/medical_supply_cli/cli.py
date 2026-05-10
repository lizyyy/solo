import argparse
import json
import os
import sys
from datetime import date
from typing import Any, Dict, List

from .services import (
    submit_request, approve_request, issue_request,
    list_requests, check_expiring_warning, export_monthly_report,
    import_dept_limits, import_inventory, import_requests, import_emergency_borrows,
    get_pending_approval_requests, get_approved_not_issued,
    replenish_emergency_borrow, get_dept_limit, get_total_available,
    check_pending_emergency_borrows
)
from .storage import load_dept_limits, load_inventory, load_requests, load_emergency_borrows, STORAGE_DIR


def _print_dict(data: Any, indent: int = 2) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=indent))


def _format_request(req: Dict[str, Any]) -> str:
    lines = [
        f"【{req['request_id']}】{req['department_name']} 申领 {req['supply_name']} {req['quantity']}{req['unit']}",
        f"  状态: {req['status']} | 创建: {req['created_at']}",
    ]
    if req.get("approval_reasons"):
        lines.append(f"  待处理原因: {'; '.join(req['approval_reasons'])}")
    if req.get("issued_batches"):
        batches = ", ".join([f"{b['batch_id']}(效期{b['expiry_date']})x{b['quantity_issued']}" for b in req["issued_batches"]])
        lines.append(f"  发放批号: {batches}")
        lines.append(f"  实发: {req.get('actual_issued', req['quantity'])} | 发放入: {req.get('issued_by', '')} | 时间: {req.get('issued_at', '')}")
    return "\n".join(lines)


def cmd_import(args: argparse.Namespace) -> None:
    types = ["limits", "inventory", "requests", "emergency"]
    if args.type not in types:
        print(f"错误: 类型必须是 {'/'.join(types)}")
        sys.exit(1)
    
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if args.type == "limits":
        result = import_dept_limits(data)
    elif args.type == "inventory":
        result = import_inventory(data)
    elif args.type == "requests":
        result = import_requests(data)
    else:
        result = import_emergency_borrows(data)
    
    print(f"导入成功: {result['imported']} 条记录")
    if args.verbose:
        _print_dict(data)


def cmd_submit(args: argparse.Namespace) -> None:
    result = submit_request(
        dept_id=args.dept_id,
        dept_name=args.dept_name,
        supply_id=args.supply_id,
        supply_name=args.supply_name,
        qty=args.quantity,
        unit=args.unit
    )
    
    if not result["success"]:
        print(f"错误: {result['error']}")
        sys.exit(1)
    
    req = result["request"]
    print(_format_request(req))
    print(f"结果: {result['message']}")
    
    if result["requires_approval"]:
        print("\n需要人工处理: 等待审批")
    else:
        print("\n下一步: 执行 `med-supply issue` 发放")


def cmd_approve(args: argparse.Namespace) -> None:
    result = approve_request(
        request_id=args.request_id,
        approver=args.approver,
        approved=not args.reject
    )
    
    if not result["success"]:
        print(f"错误: {result['error']}")
        sys.exit(1)
    
    print(_format_request(result["request"]))
    print(f"操作: {result['message']}")
    if not args.reject:
        print("\n下一步: 执行 `med-supply issue` 发放")


def cmd_issue(args: argparse.Namespace) -> None:
    result = issue_request(
        request_id=args.request_id,
        issuer=args.issuer
    )
    
    if not result["success"]:
        print(f"错误: {result['error']}")
        sys.exit(1)
    
    req = result["request"]
    print(_format_request(req))
    print(f"发放批号: {json.dumps(result['issued_batches'], ensure_ascii=False)}")
    print(f"剩余库存: {result['remaining_stock']}")
    
    if result.get("quantity_remaining", 0) > 0:
        print(f"\n部分发放，欠发 {result['quantity_remaining']} - 需要人工处理: 等待补货或调整")


def cmd_list(args: argparse.Namespace) -> None:
    requests = list_requests(status=args.status, dept_id=args.dept_id)
    
    if not requests:
        print("无申领单")
        return
    
    for req in requests:
        print(_format_request(req))
        print("-" * 60)
    print(f"共 {len(requests)} 条记录")


def cmd_warning(args: argparse.Namespace) -> None:
    warnings = check_expiring_warning(days=args.days)
    
    if not warnings:
        print(f"未来 {args.days} 天内无即将过期库存")
        return
    
    expired = [w for w in warnings if w["warning_level"] == "expired"]
    expiring = [w for w in warnings if w["warning_level"] == "expiring_soon"]
    
    if expired:
        print(f"\n【已过期 - 需要人工处理: 销毁/退库】")
        for w in expired:
            print(f"  {w['batch_id']} | {w['supply_name']} | 数量{w['quantity']} | 效期{w['expiry_date']}")
    
    if expiring:
        print(f"\n【即将过期 - 需要人工处理: 优先使用/调换批号】")
        for w in expiring:
            print(f"  {w['batch_id']} | {w['supply_name']} | 数量{w['quantity']} | 效期{w['expiry_date']} (剩余{w['days_left']}天)")


def cmd_report(args: argparse.Namespace) -> None:
    report = export_monthly_report(year=args.year, month=args.month)
    
    output_file = args.output or f"report_{args.year}{args.month:02d}.json"
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"报表已导出: {output_file}")
    print(f"\n=== {report['period']} 月度报表摘要 ===")
    print(f"发放申领单: {len(report['issued_requests'])} 条")
    print(f"涉及科室: {len(report['department_summary'])} 个")
    
    for dept in report["department_summary"]:
        print(f"\n  {dept['department_name']} 总发放: {dept['total_issued']}")
        for s in dept["supplies"]:
            print(f"    {s['supply_name']}: {s['quantity']} (限额{int(s['monthly_limit'])}, 已用{int(s['used_amount'])})")
    
    if report["pending_emergency_borrows"]:
        print(f"\n需要人工处理: {len(report['pending_emergency_borrows'])} 条急诊借用未补单")
    
    if report["expiring_warnings"]:
        print(f"\n需要人工处理: {len(report['expiring_warnings'])} 条效期预警")


def cmd_status(args: argparse.Namespace) -> None:
    pending = get_pending_approval_requests()
    to_issue = get_approved_not_issued()
    
    print("=== 待办事项 ===")
    
    if pending:
        print(f"\n【需要人工审批】{len(pending)} 条")
        for req in pending:
            print(f"  {req['request_id']} | {req['department_name']} | {req['supply_name']} {req['quantity']}")
            if req.get("approval_reasons"):
                print(f"    原因: {'; '.join(req['approval_reasons'])}")
    
    if to_issue:
        print(f"\n【需要发放】{len(to_issue)} 条")
        for req in to_issue:
            print(f"  {req['request_id']} | {req['department_name']} | {req['supply_name']} {req['quantity']}")
    
    warnings = check_expiring_warning(30)
    if warnings:
        print(f"\n【效期预警】{len(warnings)} 条")
    
    pending_borrows = []
    borrows = load_emergency_borrows()
    for b in borrows:
        if b["status"] == "borrowed" and not b.get("is_replenished", False):
            pending_borrows.append(b)
    if pending_borrows:
        print(f"\n【急诊借用未补单】{len(pending_borrows)} 条 - 需要人工处理: 补单")
    
    if not any([pending, to_issue, warnings, pending_borrows]):
        print("无待办事项")


def cmd_dept_limit(args: argparse.Namespace) -> None:
    limits = get_dept_limit(args.dept_id, args.supply_id)
    available = get_total_available(args.supply_id)
    pending_borrows = check_pending_emergency_borrows(args.dept_id, args.supply_id)
    
    print(f"科室 {args.dept_id} | 耗材 {args.supply_id}")
    print(f"  月度限额: {limits['monthly_limit']}")
    print(f"  已领用: {limits['used_amount']}")
    print(f"  剩余额度: {limits['monthly_limit'] - limits['used_amount']}")
    print(f"  可用库存: {available}")
    if pending_borrows:
        print(f"  急诊借用未补单: {len(pending_borrows)} 条 - 需要人工处理")


def cmd_replenish(args: argparse.Namespace) -> None:
    result = replenish_emergency_borrow(args.borrow_id)
    if not result["success"]:
        print(f"错误: {result['error']}")
        sys.exit(1)
    print(f"补单成功: {args.borrow_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="医疗耗材科室申领 CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    parser_import = subparsers.add_parser("import", help="导入数据")
    parser_import.add_argument("--type", required=True, choices=["limits", "inventory", "requests", "emergency"], help="数据类型")
    parser_import.add_argument("--file", required=True, help="JSON 文件路径")
    parser_import.add_argument("-v", "--verbose", action="store_true")
    parser_import.set_defaults(func=cmd_import)
    
    parser_submit = subparsers.add_parser("submit", help="提交申领")
    parser_submit.add_argument("--dept-id", required=True)
    parser_submit.add_argument("--dept-name", required=True)
    parser_submit.add_argument("--supply-id", required=True)
    parser_submit.add_argument("--supply-name", required=True)
    parser_submit.add_argument("--quantity", type=int, required=True)
    parser_submit.add_argument("--unit", default="个")
    parser_submit.set_defaults(func=cmd_submit)
    
    parser_approve = subparsers.add_parser("approve", help="审批申领")
    parser_approve.add_argument("--request-id", required=True)
    parser_approve.add_argument("--approver", default="admin")
    parser_approve.add_argument("--reject", action="store_true")
    parser_approve.set_defaults(func=cmd_approve)
    
    parser_issue = subparsers.add_parser("issue", help="发放申领")
    parser_issue.add_argument("--request-id", required=True)
    parser_issue.add_argument("--issuer", default="admin")
    parser_issue.set_defaults(func=cmd_issue)
    
    parser_list = subparsers.add_parser("list", help="列出申领单")
    parser_list.add_argument("--status", default=None)
    parser_list.add_argument("--dept-id", default=None)
    parser_list.set_defaults(func=cmd_list)
    
    parser_warning = subparsers.add_parser("warning", help="查看效期预警")
    parser_warning.add_argument("--days", type=int, default=30)
    parser_warning.set_defaults(func=cmd_warning)
    
    parser_report = subparsers.add_parser("report", help="导出月度报表")
    parser_report.add_argument("--year", type=int, default=date.today().year)
    parser_report.add_argument("--month", type=int, default=date.today().month)
    parser_report.add_argument("--output", default=None, help="输出文件路径")
    parser_report.set_defaults(func=cmd_report)
    
    parser_status = subparsers.add_parser("status", help="查看待办状态")
    parser_status.set_defaults(func=cmd_status)
    
    parser_dept = subparsers.add_parser("dept-check", help="检查科室限额")
    parser_dept.add_argument("--dept-id", required=True)
    parser_dept.add_argument("--supply-id", required=True)
    parser_dept.set_defaults(func=cmd_dept_limit)
    
    parser_replenish = subparsers.add_parser("replenish", help="急诊借用补单")
    parser_replenish.add_argument("--borrow-id", required=True)
    parser_replenish.set_defaults(func=cmd_replenish)
    
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
