from datetime import datetime
from decimal import Decimal
from typing import List
from expense_audit.auditor import check_approval_number
from expense_audit.models import (
    ApprovalStatus,
    AuditReport,
    InvoiceAudit,
    Itinerary,
)


def generate_report(
    itinerary: Itinerary,
    invoice_audits: List[InvoiceAudit],
) -> AuditReport:
    total_requested = sum(a.invoice.amount for a in invoice_audits)
    total_approved = sum(
        a.final_amount for a in invoice_audits
        if a.status in [ApprovalStatus.APPROVED, ApprovalStatus.MANUAL_APPROVED]
    )
    total_rejected = sum(
        a.invoice.amount for a in invoice_audits
        if a.status == ApprovalStatus.REJECTED
    )

    approved_count = sum(
        1 for a in invoice_audits
        if a.status in [ApprovalStatus.APPROVED, ApprovalStatus.MANUAL_APPROVED]
    )
    rejected_count = sum(
        1 for a in invoice_audits
        if a.status == ApprovalStatus.REJECTED
    )

    summary_parts = [
        f"员工: {itinerary.employee_name}",
        f"行程: {itinerary.departure_city} -> {itinerary.arrival_city}",
        f"日期: {itinerary.start_date} 至 {itinerary.end_date}",
        f"通过: {approved_count} 笔, 暂缓: {rejected_count} 笔",
        f"申请金额: {total_requested}, 核准金额: {total_approved}",
    ]

    approval_check = check_approval_number(itinerary)
    if not approval_check.passed:
        summary_parts.append("[警告] 缺少审批编号")

    return AuditReport(
        itinerary=itinerary,
        invoices=invoice_audits,
        total_requested_amount=total_requested,
        total_approved_amount=total_approved,
        total_rejected_amount=total_rejected,
        generated_at=datetime.now(),
        summary=" | ".join(summary_parts),
    )


def format_text_report(report: AuditReport) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append("出差报销审核报告")
    lines.append("=" * 70)
    lines.append(f"报告生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("-" * 70)
    lines.append("一、行程信息")
    lines.append("-" * 70)
    lines.append(f"员工姓名: {report.itinerary.employee_name}")
    lines.append(f"员工编号: {report.itinerary.employee_id}")
    lines.append(f"部门: {report.itinerary.department}")
    lines.append(f"出差事由: {report.itinerary.trip_purpose}")
    lines.append(f"出差日期: {report.itinerary.start_date} 至 {report.itinerary.end_date}")
    lines.append(f"出发城市: {report.itinerary.departure_city}")
    lines.append(f"到达城市: {report.itinerary.arrival_city}")
    if report.itinerary.approval_number:
        lines.append(f"审批编号: {report.itinerary.approval_number}")
    else:
        lines.append("审批编号: [缺失]")
    lines.append("")
    lines.append("-" * 70)
    lines.append("二、审核汇总")
    lines.append("-" * 70)
    lines.append(f"申请总金额: {report.total_requested_amount}")
    lines.append(f"核准总金额: {report.total_approved_amount}")
    lines.append(f"暂缓总金额: {report.total_rejected_amount}")
    lines.append("")

    for idx, audit in enumerate(report.invoices, 1):
        inv = audit.invoice
        lines.append("-" * 70)
        lines.append(f"三、票据 #{idx}: {inv.invoice_number}")
        lines.append("-" * 70)
        lines.append(f"票据日期: {inv.invoice_date}")
        lines.append(f"费用类型: {inv.expense_type.value}")
        lines.append(f"商户: {inv.merchant}")
        lines.append(f"申请金额: {inv.amount}")
        lines.append(f"核准金额: {audit.final_amount}")

        status_text = {
            ApprovalStatus.APPROVED: "通过",
            ApprovalStatus.REJECTED: "暂缓",
            ApprovalStatus.MANUAL_APPROVED: "人工审批通过",
        }.get(audit.status, "待定")
        lines.append(f"审核状态: {status_text}")
        lines.append("")
        lines.append("审核检查项:")

        for check in audit.checks:
            marker = "✓" if check.passed else "✗"
            lines.append(f"  {marker} {check.check_name}: {check.message}")
            if check.details:
                lines.append(f"      {check.details}")

        if audit.manual_override:
            lines.append("")
            lines.append("人工审批记录:")
            lines.append(f"  审批人: {audit.manual_override.approved_by}")
            lines.append(f"  审批时间: {audit.manual_override.approved_date}")
            lines.append(f"  审批依据: {audit.manual_override.reason}")
            if audit.manual_override.override_amount:
                lines.append(f"  核定金额: {audit.manual_override.override_amount}")

        lines.append("")

    lines.append("=" * 70)
    lines.append(report.summary)
    lines.append("=" * 70)

    return "\n".join(lines)
