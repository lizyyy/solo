from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.report_service import ReportService, DepositHistoryService
from app.models import Order

router = APIRouter(prefix="/api/reports", tags=["报告管理"])


@router.post("/{order_id}/generate")
def generate_report(
    order_id: str,
    reviewer: str = Query("system", description="报告生成人"),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    service = ReportService(db)
    result = service.generate_report(order_id, reviewer)
    return result


@router.get("/{report_no}")
def get_report(report_no: str, db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.get_report(report_no)
    if not report:
        raise HTTPException(status_code=404, detail=f"报告 {report_no} 不存在")
    return report


@router.post("/{report_no}/export")
def export_report(
    report_no: str,
    format: str = Query("json", description="导出格式: json/text"),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    result = service.export_report(report_no, format)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "导出失败"))
    return result


@router.get("/list")
def list_reports(
    order_id: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    from app.models import ReconciliationReport
    query = db.query(ReconciliationReport)

    if order_id:
        query = query.filter(ReconciliationReport.order_id == order_id)
    if status:
        query = query.filter(ReconciliationReport.status == status)

    reports = query.order_by(ReconciliationReport.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "reports": [
            {
                "id": r.id,
                "report_no": r.report_no,
                "order_id": r.order_id,
                "summary": r.summary,
                "status": r.status,
                "generated_by": r.generated_by,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in reports
        ]
    }


@router.get("/deposit/{order_id}/history")
def get_deposit_history(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    service = DepositHistoryService(db)
    result = service.get_deposit_history(order_id)
    return result


@router.get("/deposit/{order_id}/trace")
def get_deposit_trace(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    service = DepositHistoryService(db)
    result = service.get_deposit_trace(order_id)
    return result