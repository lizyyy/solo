from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from datetime import datetime

from app.core.database import get_db
from app.models.models import (
    AbnormalReceipt,
    User,
    UserRole,
    ReceiptStatus,
    StatusHistory
)
from app.schemas.schemas import (
    AbnormalReceiptCreate,
    AbnormalReceiptResponse,
    StatusHistoryResponse,
    StatusChangeRequest,
    ExportRequest
)
from app.utils.security import get_current_active_user, require_role
from app.services.state_machine import StateMachine, StateTransitionError, PermissionError
from app.services.report_service import ReportService

router = APIRouter(prefix="/receipts", tags=["异常回执"])


@router.get("/", response_model=List[AbnormalReceiptResponse])
async def list_receipts(
    batch_id: Optional[int] = None,
    college: Optional[str] = None,
    status: Optional[List[ReceiptStatus]] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.COLLEGE_SECRETARY:
        college = current_user.college

    receipts = ReportService.query_receipts(
        db=db,
        batch_id=batch_id,
        college=college,
        status=status,
        skip=skip,
        limit=limit
    )
    return receipts


@router.get("/{receipt_id}", response_model=AbnormalReceiptResponse)
async def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权访问其他学院的回执")

    return receipt


@router.get("/{receipt_id}/history", response_model=List[StatusHistoryResponse])
async def get_receipt_history(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权访问其他学院的回执")

    histories = StateMachine.get_status_history(db, receipt_id)
    result = []
    for h in histories:
        changer = db.query(User).filter(User.id == h.changed_by).first()
        result.append(StatusHistoryResponse(
            id=h.id,
            receipt_id=h.receipt_id,
            from_status=h.from_status,
            to_status=h.to_status,
            change_reason=h.change_reason,
            manual_reason=h.manual_reason,
            created_at=h.created_at,
            changer_name=changer.real_name if changer else None
        ))
    return result


@router.post("/{receipt_id}/submit", response_model=AbnormalReceiptResponse)
async def submit_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.TEACHER]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.PENDING_REVIEW,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/approve", response_model=AbnormalReceiptResponse)
async def approve_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.APPROVED,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/reject", response_model=AbnormalReceiptResponse)
async def reject_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.REJECTED,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/freeze", response_model=AbnormalReceiptResponse)
async def freeze_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.FROZEN,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/settle", response_model=AbnormalReceiptResponse)
async def settle_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.SETTLED,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/archive", response_model=AbnormalReceiptResponse)
async def archive_receipt(
    receipt_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.transition(
            db=db,
            receipt=receipt,
            to_status=ReceiptStatus.ARCHIVED,
            user=current_user,
            change_reason=request.change_reason,
            manual_reason=request.manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/unfreeze", response_model=AbnormalReceiptResponse)
async def unfreeze_receipt(
    receipt_id: int,
    target_status: ReceiptStatus,
    change_reason: Optional[str] = None,
    manual_reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    try:
        updated = StateMachine.unfreeze(
            db=db,
            receipt=receipt,
            target_status=target_status,
            user=current_user,
            change_reason=change_reason,
            manual_reason=manual_reason
        )
        db.commit()
        db.refresh(updated)
        return updated
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{receipt_id}/approval-email")
async def add_approval_email(
    receipt_id: int,
    email_content: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    receipt = db.query(AbnormalReceipt).filter(AbnormalReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and receipt.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的回执")

    receipt.approval_email_content = email_content
    db.commit()

    return {"message": "审批邮件已保存", "receipt_id": receipt_id}
