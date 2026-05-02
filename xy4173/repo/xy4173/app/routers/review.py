from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from app.core.database import get_db
from app.models import (
    Violation, Bill, Review, AuditLog, Reservation,
    SwipeLog, User, Instrument, ResearchGroup
)
from app.engine.state_machine import (
    BillStateMachine, ViolationStateMachine, BillState, ViolationState
)
from app.schemas.base import BaseResponse, SuccessResponse
from app.utils.code_generator import generate_review_code, generate_audit_log_code


router = APIRouter(prefix="/review", tags=["复核处理"])


def log_audit(db: Session, action: str, entity_type: str, entity_id: int,
              operator_id: Optional[str] = None, operator_name: Optional[str] = None,
              details: Optional[Dict[str, Any]] = None, ip_address: Optional[str] = None):
    """记录审计日志"""
    audit_log = AuditLog(
        log_code=generate_audit_log_code(),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        operator_id=operator_id,
        operator_name=operator_name,
        details=details or {},
        ip_address=ip_address
    )
    db.add(audit_log)
    db.commit()


@router.post("/violations/{violation_id}/approve", response_model=SuccessResponse)
async def approve_violation(
    violation_id: int = Path(..., ge=1),
    comment: Optional[str] = Body(None, embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """批准违规记录（确认违规事实）"""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    
    if not violation:
        raise HTTPException(status_code=404, detail="违规记录不存在")
    
    state_machine = ViolationStateMachine()
    
    try:
        new_state = state_machine.transition(
            violation.status,
            "approve"
        )
        
        violation.status = new_state
        violation.reviewed_at = datetime.now()
        violation.reviewer_id = operator_id
        
        review = Review(
            review_code=generate_review_code(),
            violation_id=violation_id,
            reviewer_id=operator_id,
            review_type="violation",
            action="approve",
            comment=comment or "确认违规事实",
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="APPROVE_VIOLATION",
            entity_type="violation",
            entity_id=violation_id,
            operator_id=operator_id,
            details={
                "violation_code": violation.violation_code,
                "violation_type": violation.violation_type,
                "comment": comment
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="违规记录已批准",
            data={
                "violation_id": violation_id,
                "violation_code": violation.violation_code,
                "new_status": new_state,
                "review_id": review.id
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/violations/{violation_id}/dismiss", response_model=SuccessResponse)
async def dismiss_violation(
    violation_id: int = Path(..., ge=1),
    comment: Optional[str] = Body(..., embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """驳回违规记录（判定为误报）"""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    
    if not violation:
        raise HTTPException(status_code=404, detail="违规记录不存在")
    
    if not comment:
        raise HTTPException(status_code=400, detail="驳回必须提供原因说明")
    
    state_machine = ViolationStateMachine()
    
    try:
        new_state = state_machine.transition(
            violation.status,
            "dismiss"
        )
        
        violation.status = new_state
        violation.reviewed_at = datetime.now()
        violation.reviewer_id = operator_id
        violation.is_dismissed = True
        violation.dismiss_reason = comment
        
        review = Review(
            review_code=generate_review_code(),
            violation_id=violation_id,
            reviewer_id=operator_id,
            review_type="violation",
            action="dismiss",
            comment=comment,
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="DISMISS_VIOLATION",
            entity_type="violation",
            entity_id=violation_id,
            operator_id=operator_id,
            details={
                "violation_code": violation.violation_code,
                "violation_type": violation.violation_type,
                "dismiss_reason": comment
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="违规记录已驳回",
            data={
                "violation_id": violation_id,
                "violation_code": violation.violation_code,
                "new_status": new_state,
                "dismiss_reason": comment,
                "review_id": review.id
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/violations/{violation_id}/appeal", response_model=SuccessResponse)
async def appeal_violation(
    violation_id: int = Path(..., ge=1),
    appeal_reason: str = Body(..., embed=True),
    appellant_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """申诉违规记录"""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    
    if not violation:
        raise HTTPException(status_code=404, detail="违规记录不存在")
    
    if not appeal_reason:
        raise HTTPException(status_code=400, detail="申诉必须提供申诉理由")
    
    state_machine = ViolationStateMachine()
    
    try:
        new_state = state_machine.transition(
            violation.status,
            "appeal"
        )
        
        violation.status = new_state
        violation.has_appeal = True
        violation.appeal_reason = appeal_reason
        
        review = Review(
            review_code=generate_review_code(),
            violation_id=violation_id,
            reviewer_id=appellant_id,
            review_type="violation",
            action="appeal",
            comment=appeal_reason,
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="APPEAL_VIOLATION",
            entity_type="violation",
            entity_id=violation_id,
            operator_id=appellant_id,
            details={
                "violation_code": violation.violation_code,
                "appeal_reason": appeal_reason
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="已提交申诉",
            data={
                "violation_id": violation_id,
                "violation_code": violation.violation_code,
                "new_status": new_state,
                "appeal_reason": appeal_reason
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bills/{bill_id}/submit-review", response_model=SuccessResponse)
async def submit_bill_for_review(
    bill_id: int = Path(..., ge=1),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """提交账单进入复核"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    
    state_machine = BillStateMachine()
    
    try:
        new_state = state_machine.transition(
            bill.status,
            "submit"
        )
        
        bill.status = new_state
        bill.submitted_at = datetime.now()
        
        log_audit(
            db,
            action="SUBMIT_BILL_REVIEW",
            entity_type="bill",
            entity_id=bill_id,
            operator_id=operator_id,
            details={
                "bill_code": bill.bill_code,
                "total_amount": float(bill.total_amount) if bill.total_amount else 0
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="账单已提交复核",
            data={
                "bill_id": bill_id,
                "bill_code": bill.bill_code,
                "new_status": new_state
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bills/{bill_id}/approve", response_model=SuccessResponse)
async def approve_bill(
    bill_id: int = Path(..., ge=1),
    comment: Optional[str] = Body(None, embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """批准账单"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    
    state_machine = BillStateMachine()
    
    try:
        new_state = state_machine.transition(
            bill.status,
            "approve"
        )
        
        bill.status = new_state
        bill.approved_at = datetime.now()
        bill.approver_id = operator_id
        
        review = Review(
            review_code=generate_review_code(),
            bill_id=bill_id,
            reviewer_id=operator_id,
            review_type="bill",
            action="approve",
            comment=comment or "账单复核通过",
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="APPROVE_BILL",
            entity_type="bill",
            entity_id=bill_id,
            operator_id=operator_id,
            details={
                "bill_code": bill.bill_code,
                "total_amount": float(bill.total_amount) if bill.total_amount else 0,
                "comment": comment
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="账单已批准",
            data={
                "bill_id": bill_id,
                "bill_code": bill.bill_code,
                "new_status": new_state,
                "review_id": review.id
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bills/{bill_id}/reject", response_model=SuccessResponse)
async def reject_bill(
    bill_id: int = Path(..., ge=1),
    comment: str = Body(..., embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """驳回账单"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    
    if not comment:
        raise HTTPException(status_code=400, detail="驳回必须提供原因说明")
    
    state_machine = BillStateMachine()
    
    try:
        new_state = state_machine.transition(
            bill.status,
            "reject"
        )
        
        bill.status = new_state
        bill.review_comment = comment
        
        review = Review(
            review_code=generate_review_code(),
            bill_id=bill_id,
            reviewer_id=operator_id,
            review_type="bill",
            action="reject",
            comment=comment,
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="REJECT_BILL",
            entity_type="bill",
            entity_id=bill_id,
            operator_id=operator_id,
            details={
                "bill_code": bill.bill_code,
                "reject_reason": comment
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="账单已驳回",
            data={
                "bill_id": bill_id,
                "bill_code": bill.bill_code,
                "new_status": new_state,
                "reject_reason": comment,
                "review_id": review.id
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bills/{bill_id}/waive", response_model=SuccessResponse)
async def waive_bill(
    bill_id: int = Path(..., ge=1),
    waive_amount: float = Body(..., embed=True),
    waive_reason: str = Body(..., embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """减免账单费用"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    
    if waive_amount <= 0:
        raise HTTPException(status_code=400, detail="减免金额必须大于0")
    
    current_waived = bill.waived_amount or 0
    total_amount = bill.total_amount or 0
    
    if waive_amount > (total_amount - current_waived):
        raise HTTPException(status_code=400, detail="减免金额不能超过剩余应付金额")
    
    state_machine = BillStateMachine()
    
    try:
        if bill.status == BillState.APPROVED.value:
            new_state = state_machine.transition(bill.status, "waive")
            bill.status = new_state
        
        bill.waived_amount = (bill.waived_amount or 0) + waive_amount
        bill.waive_reason = waive_reason
        bill.waived_at = datetime.now()
        bill.waived_by_id = operator_id
        
        review = Review(
            review_code=generate_review_code(),
            bill_id=bill_id,
            reviewer_id=operator_id,
            review_type="bill",
            action="waive",
            comment=f"减免金额: {waive_amount}, 原因: {waive_reason}",
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="WAIVE_BILL",
            entity_type="bill",
            entity_id=bill_id,
            operator_id=operator_id,
            details={
                "bill_code": bill.bill_code,
                "waive_amount": waive_amount,
                "waive_reason": waive_reason,
                "total_waived": float(bill.waived_amount) if bill.waived_amount else 0
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="已执行费用减免",
            data={
                "bill_id": bill_id,
                "bill_code": bill.bill_code,
                "waive_amount": waive_amount,
                "waive_reason": waive_reason,
                "total_waived": float(bill.waived_amount) if bill.waived_amount else 0,
                "remaining_amount": float(total_amount - bill.waived_amount)
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bills/{bill_id}/pay", response_model=SuccessResponse)
async def pay_bill(
    bill_id: int = Path(..., ge=1),
    pay_amount: float = Body(..., embed=True),
    payment_method: Optional[str] = Body(None, embed=True),
    operator_id: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """支付账单"""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    
    if pay_amount <= 0:
        raise HTTPException(status_code=400, detail="支付金额必须大于0")
    
    current_paid = bill.paid_amount or 0
    total_amount = bill.total_amount or 0
    waived_amount = bill.waived_amount or 0
    remaining = total_amount - waived_amount - current_paid
    
    if pay_amount > remaining:
        raise HTTPException(status_code=400, detail=f"支付金额不能超过剩余应付金额 {remaining}")
    
    state_machine = BillStateMachine()
    
    try:
        new_paid = current_paid + pay_amount
        new_remaining = total_amount - waived_amount - new_paid
        
        if new_remaining <= 0 and bill.status == BillState.APPROVED.value:
            new_state = state_machine.transition(bill.status, "pay")
            bill.status = new_state
        
        bill.paid_amount = new_paid
        bill.payment_method = payment_method
        bill.last_paid_at = datetime.now()
        
        review = Review(
            review_code=generate_review_code(),
            bill_id=bill_id,
            reviewer_id=operator_id,
            review_type="bill",
            action="pay",
            comment=f"支付金额: {pay_amount}, 支付方式: {payment_method}",
            reviewed_at=datetime.now()
        )
        db.add(review)
        
        log_audit(
            db,
            action="PAY_BILL",
            entity_type="bill",
            entity_id=bill_id,
            operator_id=operator_id,
            details={
                "bill_code": bill.bill_code,
                "pay_amount": pay_amount,
                "payment_method": payment_method,
                "total_paid": float(bill.paid_amount) if bill.paid_amount else 0
            }
        )
        
        db.commit()
        
        return SuccessResponse(
            success=True,
            message="已记录支付",
            data={
                "bill_id": bill_id,
                "bill_code": bill.bill_code,
                "pay_amount": pay_amount,
                "payment_method": payment_method,
                "total_paid": float(bill.paid_amount) if bill.paid_amount else 0,
                "remaining_amount": max(0, float(new_remaining)),
                "is_fully_paid": new_remaining <= 0
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reviews", response_model=SuccessResponse)
async def list_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    review_type: Optional[str] = None,
    action: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取复核记录列表"""
    query = db.query(Review)
    
    if review_type:
        query = query.filter(Review.review_type == review_type)
    if action:
        query = query.filter(Review.action == action)
    if reviewer_id:
        query = query.filter(Review.reviewer_id == reviewer_id)
    
    total = query.count()
    
    reviews = query.order_by(desc(Review.reviewed_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取复核记录列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "reviews": [
                {
                    "id": r.id,
                    "review_code": r.review_code,
                    "review_type": r.review_type,
                    "action": r.action,
                    "violation_id": r.violation_id,
                    "bill_id": r.bill_id,
                    "reviewer_id": r.reviewer_id,
                    "comment": r.comment,
                    "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None
                }
                for r in reviews
            ]
        }
    )
