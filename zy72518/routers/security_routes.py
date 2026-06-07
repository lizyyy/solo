from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from services.security_review_service import (
    get_pending_security_reviews,
    review_security_item,
    get_security_review_statistics,
    get_overridden_items_for_review
)

router = APIRouter(prefix="/api/security", tags=["安全审核"])


@router.get("/statistics")
def get_statistics(db: Session = Depends(get_db)):
    return get_security_review_statistics(db)


@router.get("/pending")
def get_pending(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    todos = get_pending_security_reviews(db, batch_id)
    return {
        "code": 0,
        "message": "success",
        "data": {
            "count": len(todos),
            "items": [
                {
                    "id": t.id,
                    "meeting_id": t.meeting_id,
                    "meeting_title": t.meeting_title,
                    "todo_content_preview": t.todo_content[:100],
                    "desensitization_level": t.desensitization_level,
                    "is_overridden_by_batch": t.is_overridden_by_batch,
                    "overridden_by_batch_id": t.overridden_by_batch_id,
                    "security_review_status": t.security_review_status,
                    "created_at": t.created_at.isoformat()
                }
                for t in todos
            ]
        }
    }


@router.get("/overridden-items")
def get_overridden_items(db: Session = Depends(get_db)):
    items = get_overridden_items_for_review(db)
    return {
        "code": 0,
        "message": "success",
        "data": {
            "count": len(items),
            "items": items,
            "note": "人工改判被下一次批跑覆盖的记录，别急着归正常，留给安全审核同事复核"
        }
    }


@router.post("/review/{todo_id}")
def review_item(
    todo_id: int,
    reviewer: str,
    review_status: str,
    review_note: str = "",
    db: Session = Depends(get_db)
):
    try:
        if review_status not in ["approved", "rejected", "pending"]:
            raise HTTPException(status_code=400, detail="review_status must be 'approved', 'rejected', or 'pending'")
        
        todo = review_security_item(db, todo_id, reviewer, review_status, review_note)
        return {
            "code": 0,
            "message": f"安全审核完成：{review_status}",
            "data": {
                "todo_id": todo.id,
                "security_review_status": todo.security_review_status,
                "reviewed_by": todo.security_review_by,
                "reviewed_at": todo.security_review_at.isoformat() if todo.security_review_at else None,
                "note": review_status == "approved" and "审核通过，可归为正常" or "审核未通过"
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
