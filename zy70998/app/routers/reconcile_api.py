from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import matcher
from app.services.review import get_reconciliation_list, get_reconciliation_detail, get_reconciliation_stats
from typing import Optional

router = APIRouter(prefix="/api/reconcile", tags=["对账"])


@router.post("/run", summary="执行自动比对")
async def run_reconcile(
    requisition_batch_no: Optional[str] = Query(None, description="指定领用批次号，不填则处理所有未对账记录"),
    db: Session = Depends(get_db),
):
    result = matcher.run_reconciliation(db, requisition_batch_no)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "比对失败"))
    return result


@router.get("/records", summary="查询对账明细列表")
async def list_records(
    batch_no: Optional[str] = None,
    review_status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    page: int = 1,
    page_size: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    return get_reconciliation_list(db, batch_no, review_status, anomaly_type, page, page_size)


@router.get("/records/{rec_id}", summary="查询单条对账详情（含差异解释）")
async def get_record_detail(rec_id: int, db: Session = Depends(get_db)):
    detail = get_reconciliation_detail(db, rec_id)
    if not detail:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return detail


@router.get("/stats", summary="对账统计概览")
async def reconciliation_stats(
    batch_no: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return get_reconciliation_stats(db, batch_no)
