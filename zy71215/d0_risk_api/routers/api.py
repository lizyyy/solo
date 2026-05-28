from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException

from models.schemas import (
    AdvanceApplication,
    AdvanceCheckRequest,
    AdvanceCheckResponse,
    AdvanceStatus,
    FeeRule,
    FreezeRecord,
    RefundRecord,
    RefundRollbackRequest,
    RefundRollbackResponse,
    ReportExportResponse,
    RiskReport,
    RiskReportItem,
    TransactionFlow,
)
from services.risk_engine import engine, store

router = APIRouter()


@router.post("/flows", response_model=TransactionFlow, summary="录入商户流水")
def add_flow(flow: TransactionFlow):
    store.add_flow(flow)
    return flow


@router.get("/flows/{merchant_id}", summary="查询商户流水")
def get_flows(merchant_id: str, start: Optional[date] = None, end: Optional[date] = None):
    return store.get_flows(merchant_id, start, end)


@router.post("/refunds", response_model=RefundRecord, summary="录入退款记录")
def add_refund(rec: RefundRecord):
    store.add_refund(rec)
    return rec


@router.get("/refunds/{merchant_id}", summary="查询退款记录")
def get_refunds(merchant_id: str, start: Optional[date] = None, end: Optional[date] = None):
    return store.get_refunds(merchant_id, start, end)


@router.post("/freezes", response_model=FreezeRecord, summary="新增冻结记录")
def add_freeze(rec: FreezeRecord):
    store.add_freeze(rec)
    return rec


@router.get("/freezes/{merchant_id}", summary="查询冻结记录(含已解冻)")
def get_freezes(merchant_id: str, active_only: bool = False):
    if active_only:
        return store.get_active_freezes(merchant_id)
    return store.freezes.get(merchant_id, [])


@router.post("/freezes/{freeze_id}/lift", response_model=FreezeRecord, summary="解冻")
def lift_freeze(freeze_id: str):
    result = store.lift_freeze(freeze_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"冻结记录{freeze_id}不存在或已解冻")
    return result


@router.post("/fee-rules", response_model=FeeRule, summary="录入费率规则")
def add_fee_rule(rule: FeeRule):
    store.add_fee_rule(rule)
    return rule


@router.get("/fee-rules/{merchant_id}", summary="查询费率版本列表")
def get_fee_versions(merchant_id: str):
    return store.get_fee_versions(merchant_id)


@router.post("/advance/check", response_model=AdvanceCheckResponse, summary="垫资申请-额度试算+风控全链路检查")
def advance_check(req: AdvanceCheckRequest):
    return engine.run_full_check(req)


@router.get("/advances/{merchant_id}", summary="查询垫资申请记录")
def get_advances(merchant_id: str, status: Optional[AdvanceStatus] = None):
    apps = store.get_advances_by_merchant(merchant_id)
    if status:
        apps = [a for a in apps if a.status == status]
    return apps


@router.post("/refund/rollback", response_model=RefundRollbackResponse, summary="退款回滚")
def refund_rollback(req: RefundRollbackRequest):
    return engine.rollback_refund(req)


@router.get("/report/{merchant_id}", response_model=ReportExportResponse, summary="导出风控报告(人读摘要+结构化明细)")
def export_report(merchant_id: str, report_date: Optional[date] = None):
    reports = store.reports.get(merchant_id, [])
    if report_date:
        reports = [r for r in reports if r.report_date == report_date]

    if not reports:
        raise HTTPException(status_code=404, detail=f"商户{merchant_id}无风控报告")

    latest = reports[-1]

    level_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_items = sorted(latest.items, key=lambda i: level_order.get(i.level.value, 99))

    summary_lines = [
        f"【商户{merchant_id} D0垫资风控报告】",
        f"报告日期: {latest.report_date}",
        f"综合风险等级: {latest.overall_level.value}",
        f"检出规则数: {len(latest.items)}",
        "",
    ]
    for idx, item in enumerate(sorted_items, 1):
        summary_lines.append(f"  {idx}. [{item.level.value.upper()}] {item.rule_name}({item.rule_code})")
        summary_lines.append(f"     {item.detail}")
        if item.suggestion:
            summary_lines.append(f"     → {item.suggestion}")

    if not sorted_items:
        summary_lines.append("  未检出风险, 可正常垫资")

    advances = store.get_advances_by_merchant(merchant_id)
    active_freezes = store.get_active_freezes(merchant_id)
    summary_lines.append("")
    summary_lines.append(f"历史垫资申请: {len(advances)}笔")
    summary_lines.append(f"当前生效冻结: {len(active_freezes)}条")

    detail = {
        "report_id": latest.id,
        "merchant_id": merchant_id,
        "report_date": str(latest.report_date),
        "overall_level": latest.overall_level.value,
        "items": [item.model_dump() for item in sorted_items],
        "advance_count": len(advances),
        "active_freeze_count": len(active_freezes),
    }

    return ReportExportResponse(
        merchant_id=merchant_id,
        report_date=latest.report_date,
        summary="\n".join(summary_lines),
        detail=detail,
    )
