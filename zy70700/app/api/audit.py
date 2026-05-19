from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import (
    AuditSummary,
    AuditSummaryCreate,
)
from app.services import AuditService

router = APIRouter(prefix="/audit", tags=["audit"])


@router.post("/summaries", response_model=AuditSummary)
def generate_summary(
    summary_create: AuditSummaryCreate, db: Session = Depends(get_db)
):
    return AuditService.generate_summary(db, summary_create)


@router.get("/summaries", response_model=List[AuditSummary])
def get_summaries(db: Session = Depends(get_db)):
    return AuditService.get_all_summaries(db)


@router.get("/summaries/{summary_id}", response_model=AuditSummary)
def get_summary(summary_id: str, db: Session = Depends(get_db)):
    summary = AuditService.get_summary(db, summary_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    return summary


@router.post("/summaries/{summary_id}/export")
def export_summary(summary_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    result = AuditService.export_summary(db, summary_id)
    if not result:
        raise HTTPException(status_code=404, detail="Summary not found")
    return result
