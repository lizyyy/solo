from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.approval import ApprovalType, ApprovalStatus
from app.models.user import User, UserRole
from app.schemas.approval import ApprovalCreate, ApprovalProcess, ApprovalResponse
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _get_default_user(db: Session) -> User:
    user = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if not user:
        user = db.query(User).first()
    return user


@router.post("", response_model=ApprovalResponse, status_code=201)
def create_approval(data: ApprovalCreate, db: Session = Depends(get_db)):
    requester = _get_default_user(db)
    if not requester:
        raise HTTPException(status_code=400, detail="系统中没有用户，请先创建用户")
    try:
        return ApprovalService.create(db, data, requester)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[ApprovalResponse])
def list_approvals(
    status: Optional[ApprovalStatus] = None,
    approval_type: Optional[ApprovalType] = None,
    instrument_id: Optional[int] = None,
    requester_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return ApprovalService.list(
        db,
        status=status,
        approval_type=approval_type,
        instrument_id=instrument_id,
        requester_id=requester_id,
        skip=skip,
        limit=limit,
    )


@router.get("/{approval_id}", response_model=ApprovalResponse)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    approval = ApprovalService.get_by_id(db, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="审批申请不存在")
    return approval


@router.post("/{approval_id}/process", response_model=ApprovalResponse)
def process_approval(approval_id: int, data: ApprovalProcess, db: Session = Depends(get_db)):
    approver = _get_default_user(db)
    if not approver:
        raise HTTPException(status_code=400, detail="系统中没有用户")
    try:
        return ApprovalService.process(db, approval_id, data, approver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/cancel", response_model=ApprovalResponse)
def cancel_approval(approval_id: int, reason: str = Query("", description="取消原因"), db: Session = Depends(get_db)):
    requester = _get_default_user(db)
    if not requester:
        raise HTTPException(status_code=400, detail="系统中没有用户")
    try:
        return ApprovalService.cancel(db, approval_id, requester, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
