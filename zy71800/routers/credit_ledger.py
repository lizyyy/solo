from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import CreditLedger, CreditAlert
from schemas import CreditLedgerCreate, CreditLedgerOut, CreditAlertOut
from services.detection_service import detect_duplicate_credit, detect_frozen_not_released

router = APIRouter(prefix="/api/credit", tags=["授信台账"])


@router.post("/", response_model=CreditLedgerOut)
def create_credit(data: CreditLedgerCreate, db: Session = Depends(get_db)):
    credit = CreditLedger(**data.model_dump())
    db.add(credit)
    db.commit()
    db.refresh(credit)
    detect_duplicate_credit(db, credit.customer_id, credit.credit_type, exclude_id=credit.id)
    return credit


@router.post("/batch", response_model=List[CreditLedgerOut])
def batch_create_credits(data: List[CreditLedgerCreate], db: Session = Depends(get_db)):
    results = []
    for item in data:
        credit = CreditLedger(**item.model_dump())
        db.add(credit)
        db.commit()
        db.refresh(credit)
        detect_duplicate_credit(db, credit.customer_id, credit.credit_type, exclude_id=credit.id)
        results.append(credit)
    return results


@router.get("/", response_model=List[CreditLedgerOut])
def list_credits(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(CreditLedger)
    if customer_id:
        query = query.filter(CreditLedger.customer_id == customer_id)
    if status:
        query = query.filter(CreditLedger.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{credit_id}", response_model=CreditLedgerOut)
def get_credit(credit_id: int, db: Session = Depends(get_db)):
    credit = db.query(CreditLedger).filter(CreditLedger.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="授信记录不存在")
    return credit


@router.put("/{credit_id}", response_model=CreditLedgerOut)
def update_credit(credit_id: int, data: CreditLedgerCreate, db: Session = Depends(get_db)):
    credit = db.query(CreditLedger).filter(CreditLedger.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="授信记录不存在")
    for k, v in data.model_dump().items():
        setattr(credit, k, v)
    db.commit()
    db.refresh(credit)
    detect_duplicate_credit(db, credit.customer_id, credit.credit_type, exclude_id=credit.id)
    return credit


@router.get("/alerts/list", response_model=List[CreditAlertOut])
def list_alerts(
    alert_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(CreditAlert)
    if alert_type:
        query = query.filter(CreditAlert.alert_type == alert_type)
    if status:
        query = query.filter(CreditAlert.status == status)
    return query.order_by(CreditAlert.created_at.desc()).all()


@router.put("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, resolved_by: str, db: Session = Depends(get_db)):
    from datetime import datetime
    alert = db.query(CreditAlert).filter(CreditAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    alert.status = "resolved"
    alert.resolved_by = resolved_by
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "告警已解决", "alert_id": alert_id}


@router.post("/detect/frozen")
def detect_frozen(db: Session = Depends(get_db)):
    results = detect_frozen_not_released(db)
    return {"detected": len(results), "details": [
        {"credit_id": c.id, "customer_id": c.customer_id, "frozen_amount": c.frozen_amount, "expiry_date": c.expiry_date}
        for c in results
    ]}
