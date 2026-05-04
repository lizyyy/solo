from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.patch("/issues/{issue_id}", response_model=schemas.Issue)
def update_issue(
    issue_id: int,
    update_data: schemas.IssueUpdate,
    db: Session = Depends(get_db)
):
    issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(issue, key, value)
    
    db.commit()
    db.refresh(issue)
    
    return schemas.Issue.model_validate(issue)

@router.post("/issues/{issue_id}/reviews", response_model=schemas.Review)
def add_review(
    issue_id: int,
    review_data: schemas.ReviewCreate,
    db: Session = Depends(get_db)
):
    issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    review = models.Review(
        issue_id=issue_id,
        reviewer=review_data.reviewer,
        comment=review_data.comment,
        decision=review_data.decision
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return schemas.Review.model_validate(review)

@router.post("/issues/batch-update", response_model=dict)
def batch_update_issues(
    batch_data: schemas.BatchUpdateRequest,
    db: Session = Depends(get_db)
):
    issues = db.query(models.Issue).filter(
        models.Issue.id.in_(batch_data.issue_ids)
    ).all()
    
    updated_count = 0
    for issue in issues:
        if batch_data.status:
            issue.status = batch_data.status
        updated_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "updated_count": updated_count,
        "total_issues": len(batch_data.issue_ids)
    }

@router.get("/issues/{issue_id}/reviews", response_model=List[schemas.Review])
def get_issue_reviews(
    issue_id: int,
    db: Session = Depends(get_db)
):
    issue = db.query(models.Issue).filter(models.Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="问题不存在")
    
    reviews = db.query(models.Review).filter(
        models.Review.issue_id == issue_id
    ).order_by(models.Review.created_at.desc()).all()
    
    return [schemas.Review.model_validate(r) for r in reviews]

@router.delete("/reviews/{review_id}", response_model=dict)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db)
):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="复核记录不存在")
    
    db.delete(review)
    db.commit()
    
    return {"success": True, "message": "复核记录已删除"}
