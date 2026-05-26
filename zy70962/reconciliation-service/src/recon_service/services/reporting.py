"""汇总与报告：按门店/日期聚合；导出 xlsx/csv。"""
from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date
from typing import Any

from ..models import Batch, Discrepancy, DiscrepancyType


# ---------------- 汇总 ----------------

def summarize(batch: Batch) -> dict[str, Any]:
    """生成人类可读的汇总信息，供详情页与报表复用。"""
    total_deposit = sum(d.amount for d in batch.deposits)
    total_sales_pos = sum(s.pos_sales_amount for s in batch.sales)
    total_sales_cash = sum(s.cash_sales_amount for s in batch.sales)
    total_sales = total_sales_pos + total_sales_cash

    by_store_summary: dict[str, Any] = defaultdict(lambda: {
        "deposit": 0.0,
        "sales_cash": 0.0,
        "sales_pos": 0.0,
        "over": 0.0,
        "short": 0.0,
        "duplicate": 0,
        "missing_deposit": 0,
        "missing_sales": 0,
        "holiday_delay": 0,
        "petty_imbalance": 0,
        "unreviewed": 0,
        "approved": 0,
        "rejected": 0,
        "requested": 0,
    })

    for d in batch.deposits:
        by_store_summary[d.store_id]["deposit"] += d.amount
    for s in batch.sales:
        by_store_summary[s.store_id]["sales_cash"] += s.cash_sales_amount
        by_store_summary[s.store_id]["sales_pos"] += s.pos_sales_amount

    for disc in batch.discrepancies:
        entry = by_store_summary[disc.store_id]
        if disc.type == DiscrepancyType.OVER:
            entry["over"] += abs(disc.delta)
        elif disc.type == DiscrepancyType.SHORT:
            entry["short"] += abs(disc.delta)
        elif disc.type == DiscrepancyType.DUPLICATE:
            entry["duplicate"] += 1
        elif disc.type == DiscrepancyType.MISSING_DEPOSIT:
            entry["missing_deposit"] += 1
        elif disc.type == DiscrepancyType.MISSING_SALES:
            entry["missing_sales"] += 1
        elif disc.type == DiscrepancyType.HOLIDAY_DELAY:
            entry["holiday_delay"] += 1
        elif disc.type == DiscrepancyType.PETTY_IMBALANCE:
            entry["petty_imbalance"] += 1

        if disc.review_action is None:
            entry["unreviewed"] += 1
        elif disc.review_action.value == "approve":
            entry["approved"] += 1
        elif disc.review_action.value == "reject":
            entry["rejected"] += 1
        elif disc.review_action.value == "request_info":
            entry["requested"] += 1

    return {
        "batch_id": str(batch.id),
        "name": batch.name,
        "status": batch.status.value,
        "period": {
            "start": batch.period_start.isoformat() if batch.period_start else None,
            "end": batch.period_end.isoformat() if batch.period_end else None,
        },
        "totals": {
            "deposit": round(total_deposit, 2),
            "sales": round(total_sales, 2),
            "sales_pos": round(total_sales_pos, 2),
            "sales_cash": round(total_sales_cash, 2),
        },
        "discrepancies": {
            "total": len(batch.discrepancies),
            "over": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.OVER),
            "short": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.SHORT),
            "duplicate": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.DUPLICATE),
            "missing_deposit": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.MISSING_DEPOSIT),
            "missing_sales": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.MISSING_SALES),
            "holiday_delay": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.HOLIDAY_DELAY),
            "petty_imbalance": sum(1 for d in batch.discrepancies if d.type == DiscrepancyType.PETTY_IMBALANCE),
        },
        "by_store": {k: dict(v) for k, v in by_store_summary.items()},
        "created_at": batch.created_at.isoformat(),
    }


# ---------------- 报表导出 ----------------

def build_detail_rows(batch: Batch) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for d in batch.discrepancies:
        rows.append({
            "差异ID": str(d.id),
            "门店": d.store_id,
            "营业日": d.biz_date.isoformat(),
            "类型": _type_label(d.type),
            "缴存金额": round(d.deposit_amount, 2),
            "销售现金": round(d.sales_cash_amount, 2),
            "差额": round(d.delta, 2),
            "说明": d.explanation,
            "复核结论": _action_label(d.review_action),
            "复核人": d.reviewer,
            "复核时间": d.reviewed_at.isoformat() if d.reviewed_at else "",
            "复核备注": d.review_note,
        })
    return rows


def build_summary_rows(batch: Batch) -> list[dict[str, Any]]:
    s = summarize(batch)
    rows: list[dict[str, Any]] = []
    for store, data in s["by_store"].items():
        rows.append({
            "门店": store,
            "缴存合计": round(data["deposit"], 2),
            "POS销售": round(data["sales_pos"], 2),
            "现金销售": round(data["sales_cash"], 2),
            "长款": round(data["over"], 2),
            "短款": round(data["short"], 2),
            "重复缴存": data["duplicate"],
            "缺缴存": data["missing_deposit"],
            "缺销售": data["missing_sales"],
            "节假日延迟": data["holiday_delay"],
            "备用金异常": data["petty_imbalance"],
            "未复核": data["unreviewed"],
            "已放行": data["approved"],
            "已退回": data["rejected"],
            "要求补材料": data["requested"],
        })
    return rows


def export_csv(batch: Batch, kind: str = "detail") -> tuple[str, str]:
    """返回 (文件名, CSV 文本)。"""
    if kind == "summary":
        rows = build_summary_rows(batch)
        filename = f"batch_{batch.id}_summary.csv"
    else:
        rows = build_detail_rows(batch)
        filename = f"batch_{batch.id}_detail.csv"

    if not rows:
        return filename, ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return filename, buf.getvalue()


def export_xlsx(batch: Batch, kind: str = "detail") -> tuple[str, bytes]:
    """返回 (文件名, xlsx bytes)。需要 openpyxl。"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    if kind == "summary":
        rows = build_summary_rows(batch)
        sheet_name = "汇总"
        filename = f"batch_{batch.id}_summary.xlsx"
    else:
        rows = build_detail_rows(batch)
        sheet_name = "差异明细"
        filename = f"batch_{batch.id}_detail.xlsx"

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="FFE0E0E0")
            cell.alignment = Alignment(horizontal="center")
        for r in rows:
            ws.append([r[h] for h in headers])
        for col_idx, h in enumerate(headers, start=1):
            max_len = max(len(str(h)), max((len(str(r[h])) for r in rows), default=0))
            ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = max_len + 2

    buf = io.BytesIO()
    wb.save(buf)
    return filename, buf.getvalue()


# ---------------- 标签 ----------------

_TYPE_LABEL = {
    DiscrepancyType.OVER: "长款",
    DiscrepancyType.SHORT: "短款",
    DiscrepancyType.DUPLICATE: "重复缴存",
    DiscrepancyType.MISSING_DEPOSIT: "缺缴存",
    DiscrepancyType.MISSING_SALES: "缺销售",
    DiscrepancyType.HOLIDAY_DELAY: "节假日延迟缴存",
    DiscrepancyType.PETTY_IMBALANCE: "备用金异常",
}


def _type_label(t: DiscrepancyType) -> str:
    return _TYPE_LABEL.get(t, t.value)


def _action_label(a) -> str:
    if a is None:
        return "未复核"
    return {"approve": "放行", "reject": "退回", "request_info": "要求补材料"}.get(a.value, a.value)
