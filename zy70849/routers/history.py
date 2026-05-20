from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import ClaimSubmission, AuditResult, ClaimMaterial
from schemas import HistoryTraceItem
from datetime import datetime

router = APIRouter()

@router.get("/batch/{batch_no}")
async def get_batch_history(batch_no: str, db: Session = Depends(get_db)):
    submission = db.query(ClaimSubmission).filter(ClaimSubmission.batch_no == batch_no).first()
    if not submission:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    audit_results = db.query(AuditResult).filter(
        AuditResult.submission_id == submission.id
    ).order_by(AuditResult.audit_time.desc()).all()
    
    return {
        "batch_no": batch_no,
        "policy_no": submission.policy_no,
        "claimant_name": submission.claimant_name,
        "total_amount": submission.total_amount,
        "submit_time": submission.submit_time,
        "status": submission.status,
        "audit_history": [
            HistoryTraceItem(
                audit_time=result.audit_time,
                result_status=result.result_status,
                suggestion=result.suggestion,
                source_rule=result.source_rule,
                reviewer=result.reviewer,
                review_comment=result.review_comment
            )
            for result in audit_results
        ]
    }

@router.get("/policy/{policy_no}")
async def get_policy_history(policy_no: str, db: Session = Depends(get_db)):
    submissions = db.query(ClaimSubmission).filter(
        ClaimSubmission.policy_no == policy_no
    ).order_by(ClaimSubmission.submit_time.desc()).all()
    
    result = []
    for submission in submissions:
        audit_results = db.query(AuditResult).filter(
            AuditResult.submission_id == submission.id
        ).all()
        
        result.append({
            "batch_no": submission.batch_no,
            "submit_time": submission.submit_time,
            "claimant_name": submission.claimant_name,
            "total_amount": submission.total_amount,
            "status": submission.status,
            "failed_count": sum(1 for r in audit_results if r.result_status == "failed"),
            "pending_count": sum(1 for r in audit_results if r.result_status == "pending"),
            "normal_count": sum(1 for r in audit_results if r.result_status == "normal")
        })
    
    return {"policy_no": policy_no, "submissions": result}

@router.get("/trace/{result_id}")
async def trace_audit_source(result_id: int, db: Session = Depends(get_db)):
    audit_result = db.query(AuditResult).filter(AuditResult.id == result_id).first()
    if not audit_result:
        raise HTTPException(status_code=404, detail="审核记录不存在")
    
    submission = db.query(ClaimSubmission).filter(
        ClaimSubmission.id == audit_result.submission_id
    ).first()
    
    return {
        "result_id": result_id,
        "batch_no": submission.batch_no if submission else None,
        "rule_code": audit_result.rule_code,
        "source_rule": audit_result.source_rule,
        "result_status": audit_result.result_status,
        "suggestion": audit_result.suggestion,
        "audit_time": audit_result.audit_time,
        "reviewer": audit_result.reviewer,
        "review_comment": audit_result.review_comment,
        "trace_path": [
            {
                "step": "规则触发",
                "detail": audit_result.source_rule,
                "time": audit_result.audit_time
            }
        ]
    }

@router.put("/review/{result_id}")
async def add_review_comment(
    result_id: int,
    reviewer: str,
    comment: str,
    db: Session = Depends(get_db)
):
    audit_result = db.query(AuditResult).filter(AuditResult.id == result_id).first()
    if not audit_result:
        raise HTTPException(status_code=404, detail="审核记录不存在")
    
    audit_result.reviewer = reviewer
    audit_result.review_comment = comment
    db.commit()
    db.refresh(audit_result)
    
    return {
        "message": "复核意见已添加",
        "result_id": result_id,
        "reviewer": reviewer,
        "comment": comment
    }
