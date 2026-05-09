from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import (
    ReviewReceiptCreate, ReviewReceiptResponse,
    SupervisionReportCreate, SupervisionReportResponse
)
from services import ReviewReceiptService, SupervisionReportService

router = APIRouter(prefix="/api/v1", tags=["复查回执与监管报告"])


@router.post("/review-receipts", response_model=ReviewReceiptResponse, summary="创建复查回执")
def create_review_receipt(data: ReviewReceiptCreate, db: Session = Depends(get_db)):
    return ReviewReceiptService.create(db, data)


@router.get("/review-receipts/{receipt_id}", response_model=ReviewReceiptResponse, summary="获取复查回执详情")
def get_review_receipt(receipt_id: int, db: Session = Depends(get_db)):
    from models import ReviewReceipt
    receipt = db.query(ReviewReceipt).filter(ReviewReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="复查回执不存在")
    return receipt


@router.get("/rectification/{task_id}/review-receipts", response_model=List[ReviewReceiptResponse], summary="查询整改任务的复查记录")
def list_review_receipts_by_task(task_id: int, db: Session = Depends(get_db)):
    return ReviewReceiptService.list_by_task(db, task_id)


@router.post("/supervision-reports", response_model=SupervisionReportResponse, summary="创建监管报告")
def create_supervision_report(data: SupervisionReportCreate, db: Session = Depends(get_db)):
    return SupervisionReportService.create(db, data)


@router.get("/supervision-reports/{report_id}", response_model=SupervisionReportResponse, summary="获取监管报告详情")
def get_supervision_report(report_id: int, db: Session = Depends(get_db)):
    from models import SupervisionReport
    report = db.query(SupervisionReport).filter(SupervisionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="监管报告不存在")
    return report


@router.get("/rectification/{task_id}/supervision-reports", response_model=List[SupervisionReportResponse], summary="查询整改任务的监管报告")
def list_supervision_reports_by_task(task_id: int, db: Session = Depends(get_db)):
    return SupervisionReportService.list_by_task(db, task_id)
