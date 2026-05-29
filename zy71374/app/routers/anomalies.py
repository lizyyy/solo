from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import Anomaly

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


class AnomalyOut(BaseModel):
    id: int
    experiment_id: Optional[int]
    category: str
    severity: str
    message: str
    detail: Optional[dict]
    suggestion: Optional[str]
    resolved: bool
    source_ref: Optional[str]

    class Config:
        from_attributes = True


class AnomalyResolve(BaseModel):
    resolved: bool


@router.get("", response_model=list[AnomalyOut])
def list_anomalies(
    category: Optional[str] = None,
    severity: Optional[str] = None,
    experiment_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Anomaly)
    if category:
        q = q.filter(Anomaly.category == category)
    if severity:
        q = q.filter(Anomaly.severity == severity)
    if experiment_id:
        q = q.filter(Anomaly.experiment_id == experiment_id)
    return q.order_by(Anomaly.created_at.desc()).all()


@router.get("/{anomaly_id}", response_model=AnomalyOut)
def get_anomaly(anomaly_id: int, db: Session = Depends(get_db)):
    a = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not a:
        from app.exceptions import AnomalyError
        raise AnomalyError(404, "not_found", f"异常记录 id={anomaly_id} 不存在", suggestion="检查异常记录编号是否正确")
    return a


@router.patch("/{anomaly_id}", response_model=AnomalyOut)
def resolve_anomaly(anomaly_id: int, body: AnomalyResolve, db: Session = Depends(get_db)):
    a = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not a:
        from app.exceptions import AnomalyError
        raise AnomalyError(404, "not_found", f"异常记录 id={anomaly_id} 不存在", suggestion="检查异常记录编号是否正确")
    a.resolved = 1 if body.resolved else 0
    db.commit()
    db.refresh(a)
    return a
