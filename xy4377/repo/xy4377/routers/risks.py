from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from database import get_db
from models import RiskResult, ReviewComment, RiskStatus
from schemas import (
    RiskResultResponse, RiskSummary,
    ManualOverrideRequest, ReviewCommentCreate, ReviewCommentResponse
)
from risk_calculator import RiskCalculator

router = APIRouter(prefix="/api/risks", tags=["risks"])


@router.get("/", response_model=List[RiskResultResponse])
def get_risks(
    skip: int = 0,
    limit: int = 100,
    severity: str = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(RiskResult)
    
    if severity:
        query = query.filter(RiskResult.severity == severity.upper())
    if status:
        query = query.filter(RiskResult.status == status.upper())
    
    risks = query.offset(skip).limit(limit).all()
    return risks


@router.get("/{risk_id}", response_model=RiskResultResponse)
def get_risk(risk_id: int, db: Session = Depends(get_db)):
    risk = db.query(RiskResult).filter(RiskResult.id == risk_id).first()
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    return risk


@router.post("/recalculate")
def recalculate_risks(db: Session = Depends(get_db)):
    calculator = RiskCalculator(db)
    result = calculator.recalculate_risks()
    return result


@router.post("/override", response_model=RiskResultResponse)
def manual_override(request: ManualOverrideRequest, db: Session = Depends(get_db)):
    risk = db.query(RiskResult).filter(RiskResult.id == request.risk_id).first()
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    risk.manual_override = True
    risk.override_reason = request.override_reason
    risk.overridden_by = request.overridden_by
    risk.status = request.new_status
    risk.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(risk)
    return risk


@router.put("/{risk_id}/status", response_model=RiskResultResponse)
def update_risk_status(risk_id: int, status: str, db: Session = Depends(get_db)):
    risk = db.query(RiskResult).filter(RiskResult.id == risk_id).first()
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    try:
        risk_status = RiskStatus(status.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    risk.status = risk_status
    risk.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(risk)
    return risk


@router.get("/summary", response_model=RiskSummary)
def get_risk_summary(db: Session = Depends(get_db)):
    total_risks = db.query(RiskResult).count()
    
    by_severity = {}
    severity_rows = db.query(
        RiskResult.severity,
        RiskResult.id
    ).group_by(RiskResult.severity).all()
    for row in severity_rows:
        severity_name = row[0].value if hasattr(row[0], 'value') else str(row[0])
        count = db.query(RiskResult).filter(RiskResult.severity == row[0]).count()
        by_severity[severity_name] = count
    
    by_type = {}
    type_rows = db.query(
        RiskResult.risk_type,
        RiskResult.id
    ).group_by(RiskResult.risk_type).all()
    for row in type_rows:
        type_name = row[0].value if hasattr(row[0], 'value') else str(row[0])
        count = db.query(RiskResult).filter(RiskResult.risk_type == row[0]).count()
        by_type[type_name] = count
    
    open_risks = db.query(RiskResult).filter(
        RiskResult.status == RiskStatus.OPEN
    ).count()
    
    resolved_risks = db.query(RiskResult).filter(
        RiskResult.status == RiskStatus.RESOLVED
    ).count()
    
    return RiskSummary(
        total_risks=total_risks,
        by_severity=by_severity,
        by_type=by_type,
        open_risks=open_risks,
        resolved_risks=resolved_risks
    )


@router.post("/{risk_id}/comments", response_model=ReviewCommentResponse)
def add_review_comment(
    risk_id: int,
    comment: ReviewCommentCreate,
    db: Session = Depends(get_db)
):
    risk = db.query(RiskResult).filter(RiskResult.id == risk_id).first()
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    db_comment = ReviewComment(
        risk_id=risk_id,
        reviewer=comment.reviewer,
        comment=comment.comment
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    return db_comment


@router.get("/{risk_id}/comments", response_model=List[ReviewCommentResponse])
def get_risk_comments(risk_id: int, db: Session = Depends(get_db)):
    risk = db.query(RiskResult).filter(RiskResult.id == risk_id).first()
    if risk is None:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    comments = db.query(ReviewComment).filter(
        ReviewComment.risk_id == risk_id
    ).order_by(ReviewComment.created_at.asc()).all()
    
    return comments
