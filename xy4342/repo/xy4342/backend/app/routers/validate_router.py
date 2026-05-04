from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from ..database import get_db
from .. import models, schemas
from ..services.validator import run_validation

router = APIRouter()

@router.post("/run", response_model=schemas.ValidationResult)
def run_full_validation(db: Session = Depends(get_db)):
    db.query(models.Issue).delete()
    db.commit()
    
    count, issues_data = run_validation(db)
    
    issues = db.query(models.Issue).order_by(
        models.Issue.severity,
        models.Issue.created_at
    ).all()
    
    by_category = {}
    by_severity = {}
    
    cat_result = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    
    for cat, cnt in cat_result:
        by_category[cat.value] = cnt
    
    sev_result = db.query(
        models.Issue.severity,
        func.count(models.Issue.id)
    ).group_by(models.Issue.severity).all()
    
    for sev, cnt in sev_result:
        by_severity[sev.value] = cnt
    
    return schemas.ValidationResult(
        total_issues=count,
        by_category=by_category,
        by_severity=by_severity,
        issues=[schemas.Issue.model_validate(issue) for issue in issues]
    )

@router.get("/issues", response_model=List[schemas.Issue])
def get_issues(
    status: Optional[schemas.IssueStatus] = Query(None),
    category: Optional[schemas.IssueCategory] = Query(None),
    severity: Optional[schemas.IssueSeverity] = Query(None),
    chapter: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(models.Issue)
    
    if status:
        query = query.filter(models.Issue.status == status)
    if category:
        query = query.filter(models.Issue.category == category)
    if severity:
        query = query.filter(models.Issue.severity == severity)
    if chapter:
        chapter_str = str(chapter)
        query = query.filter(
            models.Issue.affected_chapters.contains(chapter_str)
        )
    
    issues = query.order_by(
        models.Issue.severity.desc(),
        models.Issue.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return [schemas.Issue.model_validate(issue) for issue in issues]

@router.get("/issues/{issue_id}", response_model=schemas.Issue)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="问题不存在")
    return schemas.Issue.model_validate(issue)

@router.get("/stats", response_model=dict)
def get_validation_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    total = db.query(models.Issue).count()
    
    by_status = db.query(
        models.Issue.status,
        func.count(models.Issue.id)
    ).group_by(models.Issue.status).all()
    
    by_category = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    
    by_severity = db.query(
        models.Issue.severity,
        func.count(models.Issue.id)
    ).group_by(models.Issue.severity).all()
    
    return {
        "total": total,
        "by_status": {s.value: c for s, c in by_status},
        "by_category": {c.value: c for c, c in by_category},
        "by_severity": {s.value: c for s, c in by_severity}
    }
