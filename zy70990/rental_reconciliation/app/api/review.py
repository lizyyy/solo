from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.review_service import ReviewService
from app.schemas import ReviewAction
from app.models import Order

router = APIRouter(prefix="/api/review", tags=["复核管理"])


@router.post("/action")
def execute_review_action(action: ReviewAction, db: Session = Depends(get_db)):
    service = ReviewService(db)
    result = service.execute_review_action(action)
    return result


@router.get("/{order_id}/history")
def get_review_history(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    from app.models import ReviewRecord
    reviews = db.query(ReviewRecord).filter(
        ReviewRecord.order_id == order_id
    ).order_by(ReviewRecord.created_at.desc()).all()

    return {
        "order_id": order_id,
        "order_no": order.order_no,
        "reviews": [
            {
                "id": r.id,
                "review_type": r.review_type,
                "action": r.action,
                "before_value": r.before_value,
                "after_value": r.after_value,
                "reason": r.reason,
                "reviewer": r.reviewer,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in reviews
        ]
    }


@router.get("/pending")
def list_pending_reviews(
    order_id: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    from app.models import Deduction, MeterReading
    from sqlalchemy import or_

    query = db.query(Deduction).filter(
        Deduction.is_verified == False
    )

    if order_id:
        query = query.filter(Deduction.order_id == order_id)

    pending_deductions = query.offset(skip).limit(limit).all()

    return {
        "pending_deductions": [
            {
                "id": d.id,
                "order_id": d.order_id,
                "deduction_type": d.deduction_type,
                "amount": d.amount,
                "description": d.description,
                "evidence_url": d.evidence_url,
                "created_at": d.created_at.isoformat() if d.created_at else None
            }
            for d in pending_deductions
        ]
    }