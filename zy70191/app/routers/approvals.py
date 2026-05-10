from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import Approval, ApprovalCreate
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/api/approvals", tags=["切换审批"])


@router.post("", response_model=Approval, status_code=status.HTTP_201_CREATED)
def create_approval(
    approval_data: ApprovalCreate,
    db: Session = Depends(get_db)
):
    service = ApprovalService(db)
    approval = service.create_approval(approval_data)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法创建审批记录（可能存在未处理的审批或切换申请不存在）"
        )
    return approval


@router.get("", response_model=List[Approval])
def list_approvals(
    switch_request_id: Optional[int] = None,
    approver: Optional[str] = None,
    pending_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    service = ApprovalService(db)
    if pending_only:
        return service.get_pending_approvals(approver)
    if switch_request_id:
        return service.get_approvals_by_request(switch_request_id)
    return service.get_pending_approvals(approver)


@router.get("/{approval_id}", response_model=Approval)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    service = ApprovalService(db)
    approval = service.get_approval(approval_id)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审批记录不存在"
        )
    return approval


@router.post("/{approval_id}/approve", response_model=Approval)
def approve_request(
    approval_id: int,
    approver: str = Query(..., description="审批人"),
    comment: Optional[str] = Query(None, description="审批意见"),
    db: Session = Depends(get_db)
):
    service = ApprovalService(db)
    approval = service.approve(approval_id, approver, comment)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法审批（审批记录不存在或已处理）"
        )
    return approval


@router.post("/{approval_id}/reject", response_model=Approval)
def reject_request(
    approval_id: int,
    approver: str = Query(..., description="审批人"),
    comment: Optional[str] = Query(None, description="拒绝理由"),
    db: Session = Depends(get_db)
):
    service = ApprovalService(db)
    approval = service.reject(approval_id, approver, comment)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法拒绝（审批记录不存在或已处理）"
        )
    return approval


@router.get("/switch-request/{switch_request_id}/history")
def get_approval_history(switch_request_id: int, db: Session = Depends(get_db)):
    service = ApprovalService(db)
    return service.get_approval_history(switch_request_id)
