from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Conflict, ConflictType, ConflictSeverity, ConflictStatus
from app.schemas import ConflictRead, ConflictResolve, ErrorResponse

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


@router.get("/", response_model=List[ConflictRead])
def list_conflicts(
    conflict_type: Optional[ConflictType] = Query(None),
    severity: Optional[ConflictSeverity] = Query(None),
    status: Optional[ConflictStatus] = Query(None),
    schedule_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Conflict)
    if conflict_type:
        q = q.filter(Conflict.conflict_type == conflict_type)
    if severity:
        q = q.filter(Conflict.severity == severity)
    if status:
        q = q.filter(Conflict.status == status)
    if schedule_id:
        q = q.filter(Conflict.schedule_id == schedule_id)
    return [ConflictRead.model_validate(c) for c in q.order_by(Conflict.detected_at.desc()).all()]


@router.get("/{conflict_id}", response_model=ConflictRead, responses={404: {"model": ErrorResponse}})
def get_conflict(conflict_id: int, db: Session = Depends(get_db)):
    conflict = db.query(Conflict).get(conflict_id)
    if not conflict:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "冲突记录不存在", "detail": f"conflict_id={conflict_id}"})
    return ConflictRead.model_validate(conflict)


@router.patch("/{conflict_id}", response_model=ConflictRead, responses={404: {"model": ErrorResponse}})
def resolve_conflict(conflict_id: int, data: ConflictResolve, db: Session = Depends(get_db)):
    from datetime import datetime

    conflict = db.query(Conflict).get(conflict_id)
    if not conflict:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "冲突记录不存在", "detail": f"conflict_id={conflict_id}"})

    conflict.status = data.status
    conflict.resolved_by = data.resolved_by
    conflict.resolution_note = data.resolution_note
    conflict.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(conflict)
    return ConflictRead.model_validate(conflict)
