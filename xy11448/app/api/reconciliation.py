from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user, allow_reviewer, allow_all_authenticated
from app.models import User, Reconciliation
from app.schemas import ReconciliationCreate, Reconciliation as ReconciliationSchema
from app.services import ReconciliationService

router = APIRouter()


@router.post("/create/{alert_id}", dependencies=[Depends(allow_reviewer)])
def create_reconciliation(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        recon = ReconciliationService.create_reconciliation_record(
            db, alert_id, current_user.id
        )
        return {"success": True, "message": "对账记录创建成功", "data": recon}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch", dependencies=[Depends(allow_reviewer)])
def batch_reconciliation(
    alert_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    success_count = 0
    failed_count = 0
    results = []
    
    for alert_id in alert_ids:
        try:
            recon = ReconciliationService.create_reconciliation_record(
                db, alert_id, current_user.id
            )
            success_count += 1
            results.append({"alert_id": alert_id, "success": True, "recon_id": recon.id})
        except Exception as e:
            failed_count += 1
            results.append({"alert_id": alert_id, "success": False, "error": str(e)})
    
    return {
        "success": True,
        "message": f"对账完成：成功{success_count}条，失败{failed_count}条",
        "success_count": success_count,
        "failed_count": failed_count,
        "details": results
    }


@router.get("/link/{alert_id}")
def get_reconciliation_link(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    link = ReconciliationService.link_alert_to_workorder(db, alert_id)
    if not link:
        raise HTTPException(status_code=404, detail="告警不存在")
    return {"success": True, "data": link}


@router.get("/work-order-status/{alert_id}")
def check_work_order_status(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = ReconciliationService.check_work_order_status(db, alert_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"success": True, "data": result}


@router.get("/", response_model=list[ReconciliationSchema])
def list_reconciliations(
    skip: int = 0,
    limit: int = 100,
    pile_id: Optional[int] = None,
    recon_status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Reconciliation)
    if pile_id:
        query = query.filter(Reconciliation.pile_id == pile_id)
    if recon_status:
        query = query.filter(Reconciliation.recon_status == recon_status)
    if start_date:
        query = query.filter(Reconciliation.recon_date >= start_date)
    if end_date:
        query = query.filter(Reconciliation.recon_date <= end_date)
    
    recons = query.order_by(Reconciliation.recon_date.desc()).offset(skip).limit(limit).all()
    return recons


@router.get("/{recon_id}", response_model=ReconciliationSchema)
def get_reconciliation(
    recon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    recon = db.query(Reconciliation).filter(Reconciliation.id == recon_id).first()
    if not recon:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return recon


@router.get("/monthly-duration/{pile_id}")
def get_monthly_fault_duration(
    pile_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime
    date = datetime(year, month, 1)
    duration = ReconciliationService.calculate_monthly_fault_duration(db, pile_id, date)
    return {
        "success": True,
        "data": {
            "pile_id": pile_id,
            "year": year,
            "month": month,
            "total_duration_minutes": duration
        }
    }
