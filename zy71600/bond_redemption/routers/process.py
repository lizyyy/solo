from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from services.cashflow import build_cashflow_schedule
from services.announcement import manage_notice_versions
from services.coupon_check import check_duplicate_coupons
from services.receipt_match import match_receipts
from services.gap_warning import detect_gaps
from schemas import ProcessResult

router = APIRouter()


@router.post("/run-all", response_model=ProcessResult)
def run_full_process(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    processing_order = []

    processing_order.append("1. 票息去重校验")
    coupon_result = check_duplicate_coupons(db)

    processing_order.append("2. 公告版本管理")
    from models import RedemptionNotice
    bond_ids = db.query(RedemptionNotice.bond_id).distinct().all()
    announcement_results = []
    for (bid,) in bond_ids:
        result = manage_notice_versions(db, bid)
        announcement_results.append(result)

    processing_order.append("3. 回执匹配")
    receipt_result = match_receipts(db)

    processing_order.append("4. 现金流排程")
    cashflow_result = build_cashflow_schedule(db, start_date, end_date)

    processing_order.append("5. 缺口预警")
    gap_result = detect_gaps(db, start_date, end_date)

    new_warnings = []
    for w in coupon_result.get("warning_summaries", []):
        new_warnings.append({"source": "票息去重", **w})
    for r in announcement_results:
        if r.get("latest", {}).get("is_late"):
            new_warnings.append({"source": "公告偏晚", "bond_id": r["bond_id"], "latest_version": r["latest"]})
    for mr in receipt_result.missing_receipt:
        new_warnings.append({"source": "回执缺失", **mr})
    for ur in receipt_result.unmatched_receipt:
        new_warnings.append({"source": "回执无匹配", **ur})
    for g in gap_result.get("warnings", []):
        new_warnings.append({"source": "资金缺口", **g})

    return ProcessResult(
        cashflow_schedule=cashflow_result,
        receipt_match=receipt_result,
        new_warnings=new_warnings,
        processing_order=processing_order,
    )


@router.post("/cashflow")
def run_cashflow(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return build_cashflow_schedule(db, start_date, end_date)


@router.post("/announcement-versions/{bond_id}")
def run_announcement_versions(bond_id: int, db: Session = Depends(get_db)):
    return manage_notice_versions(db, bond_id)


@router.post("/coupon-check")
def run_coupon_check(db: Session = Depends(get_db)):
    return check_duplicate_coupons(db)


@router.post("/receipt-match")
def run_receipt_match(db: Session = Depends(get_db)):
    return match_receipts(db)


@router.post("/gap-warning")
def run_gap_warning(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    return detect_gaps(db, start_date, end_date)
