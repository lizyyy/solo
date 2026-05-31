import csv
import os
from datetime import datetime
from typing import List, Dict, Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .models import ReviewDecision, BudgetOccupancy


console = Console()


def print_summary(
    decisions: List[ReviewDecision],
    occupancy: Dict[str, BudgetOccupancy],
    batch_id: str,
):
    confirmed = [d for d in decisions if d.status == ReviewDecision.STATUS_CONFIRMED]
    suspended = [d for d in decisions if d.status == ReviewDecision.STATUS_SUSPENDED]
    manual = [d for d in decisions if d.status == ReviewDecision.STATUS_MANUAL_REVIEW]
    confirmed_total = sum(d.confirmed_amount or 0 for d in confirmed)

    console.print()
    console.print(
        Panel(
            f"[bold]企业采购卡预算占用 · 复核摘要[/]\n批次: {batch_id}",
            style="blue",
        )
    )

    console.print()
    _print_stats(confirmed, suspended, manual, confirmed_total)

    if confirmed:
        _print_confirmed_table(confirmed)
    if manual:
        _print_manual_table(manual)
    if suspended:
        _print_suspended_table(suspended)

    if occupancy:
        _print_occupancy_table(occupancy)

    console.print()
    if suspended:
        console.print(
            f"💡 {len(suspended)} 条记录缺凭证已挂起，补材料后可以继续处理，不会混进已确认金额。"
        )
    if manual:
        console.print(
            f"⚠️  {len(manual)} 条记录需要你再看一眼，企业采购卡预算占用检测认为它们有问题。"
        )


def _print_stats(confirmed, suspended, manual, confirmed_total):
    table = Table(title="概览", show_header=False, border_style="dim")
    table.add_column("项目", style="bold")
    table.add_column("数值", justify="right")
    table.add_row("总记录数", str(len(confirmed) + len(suspended) + len(manual)))
    table.add_row("已确认", f"[green]{len(confirmed)}[/] 条")
    table.add_row("已确认金额", f"[green]CNY {confirmed_total:,.2f}[/]")
    table.add_row("挂起（缺凭证）", f"[yellow]{len(suspended)}[/] 条")
    table.add_row("人工确认", f"[red]{len(manual)}[/] 条")
    console.print(table)


def _print_confirmed_table(decisions: List[ReviewDecision]):
    table = Table(title="✅ 已确认 — 企业采购卡预算占用无冲突", border_style="green")
    table.add_column("记录编号", style="cyan")
    table.add_column("确认金额", justify="right", style="green")
    table.add_column("复核备注", style="dim")
    for d in decisions:
        amt = f"CNY {d.confirmed_amount:,.2f}" if d.confirmed_amount else "-"
        table.add_row(d.record_id, amt, d.review_notes)
    console.print(table)


def _print_manual_table(decisions: List[ReviewDecision]):
    table = Table(title="⚠️ 需人工确认 — 企业采购卡预算占用检测有问题", border_style="red")
    table.add_column("记录编号", style="cyan")
    table.add_column("原因", style="red")
    table.add_column("预算占用提示", style="yellow")
    table.add_column("复核备注", style="dim")
    for d in decisions:
        table.add_row(
            d.record_id,
            d.reason,
            d.budget_occupancy_note or "—",
            d.review_notes,
        )
    console.print(table)


def _print_suspended_table(decisions: List[ReviewDecision]):
    table = Table(title="⏸ 挂起 — 缺凭证，不影响已确认金额", border_style="yellow")
    table.add_column("记录编号", style="cyan")
    table.add_column("原因", style="yellow")
    table.add_column("缺什么", style="dim")
    for d in decisions:
        missing = ", ".join(d.missing_docs) if d.missing_docs else "—"
        table.add_row(d.record_id, d.reason, missing)
    console.print(table)


def _print_occupancy(occupancy: Dict[str, BudgetOccupancy]):
    table = Table(title="企业采购卡预算占用情况", border_style="blue")
    table.add_column("预算科目", style="cyan")
    table.add_column("累计占用", justify="right", style="green")
    table.add_column("占用记录", style="dim")
    for code, occ in occupancy.items():
        ids = ", ".join(occ.record_ids)
        table.add_row(code, f"CNY {occ.total_occupied:,.2f}", ids)
    console.print(table)


_print_occupancy_table = _print_occupancy


def print_record_detail(
    record: dict,
    decision: dict,
    attachments: List[dict],
    history: List[dict],
):
    console.print()
    console.print(
        Panel(
            f"[bold]记录详情: {record.get('record_id', '')}[/]",
            style="blue",
        )
    )

    info = Table(show_header=False, border_style="dim")
    info.add_column("字段", style="bold")
    info.add_column("值")
    info.add_row("记录编号", str(record.get("record_id", "")))
    info.add_row("日期", f"{record.get('raw_date', '')} → {record.get('date', '')}")
    info.add_row("金额", f"{record.get('raw_amount', '')} → {record.get('currency', '')} {record.get('amount', '')}")
    info.add_row("经办人", f"{record.get('raw_handler', '')} → {record.get('handler', '')}")
    info.add_row("部门", str(record.get("department", "")))
    info.add_row("供应商", str(record.get("vendor", "")))
    info.add_row("用途", str(record.get("purpose", "")))
    info.add_row("预算科目", str(record.get("budget_code", "")))
    info.add_row("审批单号", str(record.get("approval_ref", "")))
    info.add_row("备注", str(record.get("remark", "")))
    console.print(info)

    if decision:
        status_label = ReviewDecision.STATUS_LABELS.get(
            decision.get("status", ""), decision.get("status", "")
        )
        console.print(
            Panel(
                f"状态: [bold]{status_label}[/]\n"
                f"原因: {decision.get('reason', '')}\n"
                f"确认金额: {decision.get('confirmed_amount', '-')}\n"
                f"预算占用: {decision.get('budget_occupancy_note', '—')}\n"
                f"复核人: {decision.get('reviewer', '')}\n"
                f"复核时间: {decision.get('decision_time', '')}\n"
                f"复核备注: {decision.get('review_notes', '')}",
                title="复核结果",
                style="green" if decision.get("status") == "confirmed" else "yellow",
            )
        )

    if history:
        ht = Table(title="历史变动", border_style="dim")
        ht.add_column("时间", style="dim")
        ht.add_column("旧状态")
        ht.add_column("新状态")
        ht.add_column("变动原因", style="dim")
        ht.add_column("操作人", style="dim")
        for h in history:
            old_label = ReviewDecision.STATUS_LABELS.get(h.get("old_status", ""), h.get("old_status", ""))
            new_label = ReviewDecision.STATUS_LABELS.get(h.get("new_status", ""), h.get("new_status", ""))
            ht.add_row(
                h.get("changed_at", "")[:19],
                old_label,
                new_label,
                h.get("change_reason", ""),
                h.get("changed_by", ""),
            )
        console.print(ht)

    if attachments:
        at = Table(title="附件", border_style="dim")
        at.add_column("类型")
        at.add_column("文件名")
        at.add_column("收到日期")
        at.add_column("来源")
        for a in attachments:
            at.add_row(
                a.get("attachment_type", ""),
                a.get("file_name", ""),
                a.get("received_date", ""),
                a.get("source", ""),
            )
        console.print(at)
    else:
        console.print("[dim]暂无附件[/]")


def export_finance_detail(
    decisions: List[dict],
    records: List[dict],
    occupancy: Dict[str, BudgetOccupancy],
    output_path: str,
):
    rec_map = {r["record_id"]: r for r in records}
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "记录编号", "交易日期", "金额(原始)", "金额(标准化)",
            "币种", "经办人(原始)", "经办人(标准)", "部门", "供应商",
            "用途", "预算科目", "审批单号", "复核状态", "复核原因",
            "确认金额", "预算占用提示", "缺凭证", "复核备注",
            "复核人", "复核时间",
        ])
        for d in decisions:
            r = rec_map.get(d["record_id"], {})
            missing = ""
            if d.get("missing_docs"):
                try:
                    import json
                    missing = ", ".join(json.loads(d["missing_docs"]))
                except (json.JSONDecodeError, TypeError):
                    missing = str(d["missing_docs"])
            status_label = ReviewDecision.STATUS_LABELS.get(d["status"], d["status"])
            writer.writerow([
                d["record_id"],
                r.get("date", ""),
                r.get("raw_amount", ""),
                r.get("amount", ""),
                r.get("currency", ""),
                r.get("raw_handler", ""),
                r.get("handler", ""),
                r.get("department", ""),
                r.get("vendor", ""),
                r.get("purpose", ""),
                r.get("budget_code", ""),
                r.get("approval_ref", ""),
                status_label,
                d.get("reason", ""),
                d.get("confirmed_amount", ""),
                d.get("budget_occupancy_note", ""),
                missing,
                d.get("review_notes", ""),
                d.get("reviewer", ""),
                d.get("decision_time", "")[:19] if d.get("decision_time") else "",
            ])
        writer.writerow([])
        writer.writerow(["=== 企业采购卡预算占用汇总 ==="])
        writer.writerow(["预算科目", "累计占用金额", "占用记录"])
        for code, occ in occupancy.items():
            writer.writerow([
                code,
                f"{occ.total_occupied:,.2f}",
                ", ".join(occ.record_ids),
            ])
