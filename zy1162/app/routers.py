from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import math

from app.database import get_db
from app.models import RedPacketActivity, RedPacketStatus
from app.schemas import (
    CreateRedPacketActivityRequest, RedPacketActivityResponse,
    LockBudgetRequest, ClaimPacketRequest, ClaimPacketResponse,
    PaymentCallbackRequest, RiskActionRequest,
    AuditExportRequest, ListActivitiesRequest, PaginatedResponse,
    ErrorResponse
)
from app.services import RedPacketService

router = APIRouter(prefix="/api/v1", tags=["red-packet"])


@router.post("/activities", response_model=RedPacketActivityResponse)
def create_activity(request: CreateRedPacketActivityRequest, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        activity = service.create_activity(request)
        return activity
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activities/lock-budget")
def lock_budget(request: LockBudgetRequest, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        activity, payment = service.lock_budget(request)
        return {
            "activity": {
                "activity_id": activity.activity_id,
                "status": activity.status
            },
            "payment": {
                "payment_id": payment.payment_id,
                "amount": payment.amount,
                "status": payment.status
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activities/claim", response_model=ClaimPacketResponse)
def claim_packet(request: ClaimPacketRequest, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        claim = service.claim_packet(request)
        
        return ClaimPacketResponse(
            request_id=claim.request_id,
            status=claim.status,
            is_success=claim.is_success,
            amount=claim.claimed_amount,
            packet_id=claim.packet_id if claim.packet_id else None,
            error_message=claim.error_message
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payments/callback")
def payment_callback(request: PaymentCallbackRequest, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        payment = service.process_payment_callback(request)
        
        return {
            "payment_id": payment.payment_id,
            "status": payment.status,
            "callback_received": payment.callback_received
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/risk/action")
def risk_action(request: RiskActionRequest, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        record = service.process_risk_action(request)
        
        return {
            "record_id": record.record_id,
            "action": record.action,
            "is_resolved": record.is_resolved
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/retry-failed-claims")
def retry_failed_claims(activity_id: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        service = RedPacketService(db)
        retried_count = service.retry_failed_claims(activity_id)
        
        return {
            "retried_count": retried_count
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/activities/{activity_id}", response_model=RedPacketActivityResponse)
def get_activity(activity_id: str, db: Session = Depends(get_db)):
    activity = db.query(RedPacketActivity).filter(
        RedPacketActivity.activity_id == activity_id
    ).first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    return activity


@router.get("/activities")
def list_activities(
    merchant_id: str,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(RedPacketActivity).filter(
        RedPacketActivity.merchant_id == merchant_id
    )
    
    if status:
        query = query.filter(RedPacketActivity.status == status)
    
    total = query.count()
    total_pages = math.ceil(total / page_size)
    
    activities = query.order_by(
        RedPacketActivity.created_at.desc()
    ).offset((page - 1) * page_size).limit(page_size).all()
    
    items = [
        RedPacketActivityResponse.model_validate(activity)
        for activity in activities
    ]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/ledger/transactions")
def get_ledger_transactions(
    merchant_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = RedPacketService(db)
    transactions = service.get_ledger_transactions(
        merchant_id, start_time, end_time, transaction_type
    )
    
    return {
        "transactions": [
            {
                "transaction_id": t.transaction_id,
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "description": t.description,
                "created_at": t.created_at
            }
            for t in transactions
        ],
        "total": len(transactions)
    }


@router.post("/audit/export")
def export_audit_logs(request: AuditExportRequest, db: Session = Depends(get_db)):
    service = RedPacketService(db)
    logs = service.export_audit_logs(request)
    
    return {
        "logs": [
            {
                "log_id": l.log_id,
                "action": l.action,
                "module": l.module,
                "user_id": l.user_id,
                "activity_id": l.activity_id,
                "packet_id": l.packet_id,
                "created_at": l.created_at
            }
            for l in logs
        ],
        "total": len(logs)
    }
