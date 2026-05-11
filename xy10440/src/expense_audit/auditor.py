from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from expense_audit.models import (
    ApprovalStatus,
    CheckResult,
    ExpenseRule,
    ExpenseType,
    Invoice,
    InvoiceAudit,
    Itinerary,
    ManualOverride,
)
from expense_audit.matcher import (
    calculate_allowable_amount,
    find_rule,
    match_expense_type,
)


def check_approval_number(itinerary: Itinerary) -> CheckResult:
    if itinerary.approval_number and itinerary.approval_number.strip():
        return CheckResult(
            check_name="审批编号检查",
            passed=True,
            message=f"审批编号有效: {itinerary.approval_number}",
        )
    return CheckResult(
        check_name="审批编号检查",
        passed=False,
        message="缺少审批编号",
        details="出差申请必须提供审批编号",
    )


def check_invoice_date(
    invoice: Invoice,
    itinerary: Itinerary,
) -> CheckResult:
    start = itinerary.start_date
    end = itinerary.end_date + timedelta(days=1)

    if start <= invoice.invoice_date <= end:
        return CheckResult(
            check_name="票据日期检查",
            passed=True,
            message=f"票据日期 {invoice.invoice_date} 在行程范围内 ({start} - {end})",
        )

    return CheckResult(
        check_name="票据日期检查",
        passed=False,
        message=f"票据日期 {invoice.invoice_date} 不在行程范围内",
        details=f"行程日期: {start} 至 {end}",
    )


def check_duplicate_invoices(
    invoices: List[Invoice],
) -> Dict[str, List[CheckResult]]:
    seen_numbers = {}
    results: Dict[str, List[CheckResult]] = {}

    for invoice in invoices:
        results[invoice.invoice_number] = []
        num = invoice.invoice_number.lower()

        if num in seen_numbers:
            seen_numbers[num].append(invoice.invoice_number)
            for dup_num in seen_numbers[num]:
                if dup_num not in results:
                    results[dup_num] = []
                results[dup_num].append(
                    CheckResult(
                        check_name="重复发票检查",
                        passed=False,
                        message=f"发现重复发票",
                        details=f"与发票号 {invoice.invoice_number} 重复",
                    )
                )
        else:
            seen_numbers[num] = [invoice.invoice_number]

    for num, check_list in results.items():
        if not check_list:
            check_list.append(
                CheckResult(
                    check_name="重复发票检查",
                    passed=True,
                    message="无重复发票",
                )
            )

    return results


def check_amount_exceeded(
    invoice: Invoice,
    rule: Optional[ExpenseRule],
) -> CheckResult:
    if not rule:
        return CheckResult(
            check_name="金额标准检查",
            passed=True,
            message="无对应规则，按实际金额报销",
        )

    allowable = calculate_allowable_amount(invoice, rule, invoice.days or 1)

    if invoice.amount <= allowable:
        return CheckResult(
            check_name="金额标准检查",
            passed=True,
            message=f"金额 {invoice.amount} 符合标准 (上限 {allowable})",
            details=f"规则: {rule.description}",
        )

    return CheckResult(
        check_name="金额标准检查",
        passed=False,
        message=f"金额超标: {invoice.amount} > {allowable}",
        details=f"规则: {rule.description}, 超标 {invoice.amount - allowable}",
    )


def check_duplicate_meal_subsidy(
    invoices: List[Invoice],
) -> Dict[str, List[CheckResult]]:
    meal_invoices = [inv for inv in invoices if inv.expense_type == ExpenseType.MEAL]
    date_grouped: Dict[date, List[Invoice]] = {}
    results: Dict[str, List[CheckResult]] = {}

    for inv in invoices:
        results[inv.invoice_number] = []

    for inv in meal_invoices:
        if inv.invoice_date not in date_grouped:
            date_grouped[inv.invoice_date] = []
        date_grouped[inv.invoice_date].append(inv)

    for meal_date, invoices_on_date in date_grouped.items():
        if len(invoices_on_date) > 1:
            for inv in invoices_on_date:
                results[inv.invoice_number].append(
                    CheckResult(
                        check_name="同一天餐补检查",
                        passed=False,
                        message=f"{meal_date} 存在多笔餐费申请",
                        details=f"当天共 {len(invoices_on_date)} 笔餐费，仅允许一笔餐补",
                    )
                )

    for num, check_list in results.items():
        if not check_list:
            check_list.append(
                CheckResult(
                    check_name="同一天餐补检查",
                    passed=True,
                    message="无同一天重复餐补",
                )
            )

    return results


def audit_invoice(
    invoice: Invoice,
    itinerary: Itinerary,
    rules: List[ExpenseRule],
    duplicate_checks: Dict[str, List[CheckResult]],
    meal_checks: Dict[str, List[CheckResult]],
    manual_overrides: Optional[Dict[str, ManualOverride]] = None,
) -> InvoiceAudit:
    all_checks: List[CheckResult] = []

    if invoice.expense_type in [ExpenseType.TRANSPORTATION, ExpenseType.ACCOMMODATION]:
        date_check = check_invoice_date(invoice, itinerary)
        all_checks.append(date_check)

    if invoice.invoice_number in duplicate_checks:
        all_checks.extend(duplicate_checks[invoice.invoice_number])

    if invoice.invoice_number in meal_checks:
        all_checks.extend(meal_checks[invoice.invoice_number])

    matched_type = match_expense_type(invoice, itinerary)
    invoice.expense_type = matched_type

    rule = find_rule(matched_type, itinerary.arrival_city, rules)
    amount_check = check_amount_exceeded(invoice, rule)
    all_checks.append(amount_check)

    all_passed = all(c.passed for c in all_checks)
    final_amount = invoice.amount if all_passed else Decimal("0")

    if manual_overrides and invoice.invoice_number in manual_overrides:
        override = manual_overrides[invoice.invoice_number]
        final_amount = override.override_amount if override.override_amount else invoice.amount
        return InvoiceAudit(
            invoice=invoice,
            status=ApprovalStatus.MANUAL_APPROVED,
            final_amount=final_amount,
            checks=all_checks,
            manual_override=override,
            notes=f"人工审批: {override.reason}",
        )

    if all_passed:
        return InvoiceAudit(
            invoice=invoice,
            status=ApprovalStatus.APPROVED,
            final_amount=final_amount,
            checks=all_checks,
        )

    return InvoiceAudit(
        invoice=invoice,
        status=ApprovalStatus.REJECTED,
        final_amount=Decimal("0"),
        checks=all_checks,
    )


def run_audit(
    itinerary: Itinerary,
    invoices: List[Invoice],
    rules: List[ExpenseRule],
    manual_overrides: Optional[List[ManualOverride]] = None,
) -> List[InvoiceAudit]:
    duplicate_checks = check_duplicate_invoices(invoices)
    meal_checks = check_duplicate_meal_subsidy(invoices)

    override_map = {
        o.invoice_number: o for o in (manual_overrides or [])
    } if manual_overrides else None

    return [
        audit_invoice(
            inv,
            itinerary,
            rules,
            duplicate_checks,
            meal_checks,
            override_map,
        )
        for inv in invoices
    ]
