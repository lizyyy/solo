from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.store import Store
from ..models.refund import RefundRequest, RefundOrder
from ..schemas import (
    RefundRequestCreate, RefundCalcPreview,
    RefundApprove, RefundReject, RefundWithdraw, RefundVoid,
    RefundRequestResponse, RefundOrderResponse
)
from ..services.account_service import AccountService
from ..services.refund_service import (
    RefundCalculationService,
    RefundRequestService,
    RefundVoidService
)

router = APIRouter(prefix="/api/refunds", tags=["refunds"])


@router.post("/preview", response_model=RefundCalcPreview)
def preview_refund(data: RefundRequestCreate, db: Session = Depends(get_db)):
    account = AccountService.get_account_by_no(db, data.account_no)
    if not account:
        raise HTTPException(status_code=404, detail="账户不存在")
    
    store = db.query(Store).filter(Store.id == data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    
    try:
        calc = RefundCalculationService.calculate_refund(db, account, data.requested_amount)
        return calc
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/request", response_model=RefundRequestResponse)
def create_refund_request(data: RefundRequestCreate, db: Session = Depends(get_db)):
    account = AccountService.get_account_by_no(db, data.account_no)
    if not account:
        raise HTTPException(status_code=404, detail="账户不存在")
    
    store = db.query(Store).filter(Store.id == data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    
    try:
        request = RefundRequestService.create_request(
            db=db,
            account=account,
            store_id=data.store_id,
            requested_amount=data.requested_amount,
            reason_type=data.reason_type,
            reason_detail=data.reason_detail,
            operator=data.operator
        )
        db.commit()
        db.refresh(request)
        return request
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approve", response_model=RefundOrderResponse)
def approve_refund(data: RefundApprove, db: Session = Depends(get_db)):
    request = db.query(RefundRequest).filter(RefundRequest.id == data.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="退款申请不存在")
    
    try:
        order = RefundRequestService.approve_request(
            db=db,
            request=request,
            approver=data.approver,
            approval_remark=data.approval_remark
        )
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reject", response_model=RefundRequestResponse)
def reject_refund(data: RefundReject, db: Session = Depends(get_db)):
    request = db.query(RefundRequest).filter(RefundRequest.id == data.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="退款申请不存在")
    
    try:
        request = RefundRequestService.reject_request(
            db=db,
            request=request,
            reject_reason=data.reject_reason,
            operator=data.operator
        )
        db.commit()
        db.refresh(request)
        return request
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/withdraw", response_model=RefundRequestResponse)
def withdraw_refund(data: RefundWithdraw, db: Session = Depends(get_db)):
    request = db.query(RefundRequest).filter(RefundRequest.id == data.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="退款申请不存在")
    
    try:
        request = RefundRequestService.withdraw_request(
            db=db,
            request=request,
            withdraw_reason=data.withdraw_reason,
            operator=data.operator
        )
        db.commit()
        db.refresh(request)
        return request
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/void", response_model=RefundOrderResponse)
def void_refund(data: RefundVoid, db: Session = Depends(get_db)):
    order = db.query(RefundOrder).filter(RefundOrder.id == data.refund_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="退款单不存在")
    
    try:
        order = RefundVoidService.void_refund(
            db=db,
            refund_order=order,
            void_reason=data.void_reason,
            operator=data.operator
        )
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/requests", response_model=List[RefundRequestResponse])
def list_requests(db: Session = Depends(get_db)):
    return db.query(RefundRequest).order_by(RefundRequest.id.desc()).all()


@router.get("/orders", response_model=List[RefundOrderResponse])
def list_orders(db: Session = Depends(get_db)):
    return db.query(RefundOrder).order_by(RefundOrder.id.desc()).all()
