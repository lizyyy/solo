from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas import (
    OutboundApprovalCreate, OutboundApprovalUpdate, 
    OutboundApproval as ApprovalSchema, OutboundApprovalDetail,
    ApprovalAction, ApprovalTraceResponse, ResponseModel
)
from app.services.approval_service import approval_service
from app.services.task_service import task_service

router = APIRouter(prefix="/api/v1/approvals", tags=["出库审批"])


@router.post("", response_model=ApprovalSchema)
def create_approval(data: OutboundApprovalCreate, db: Session = Depends(get_db)):
    try:
        approval = approval_service.create_approval(
            db, 
            data.model_dump(), 
            operator=data.applicant
        )
        return approval
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[ApprovalSchema])
def list_approvals(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    item_id: Optional[int] = None,
    borrower: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import OutboundApproval
    query = db.query(OutboundApproval)
    
    if status:
        query = query.filter(OutboundApproval.status == status)
    if item_id:
        query = query.filter(OutboundApproval.item_id == item_id)
    if borrower:
        query = query.filter(OutboundApproval.borrower.contains(borrower))
    
    return query.order_by(OutboundApproval.id.desc()).offset(skip).limit(limit).all()


@router.get("/{approval_id}", response_model=OutboundApprovalDetail)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    approval = approval_service.get_approval_detail(db, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 不存在")
    return approval


@router.patch("/{approval_id}", response_model=ApprovalSchema)
def update_approval(approval_id: int, data: OutboundApprovalUpdate, db: Session = Depends(get_db)):
    approval = approval_service.get(db, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 不存在")
    
    from app.models import ApprovalStatus
    if approval.status != ApprovalStatus.DRAFT:
        raise HTTPException(status_code=400, detail="只有草稿状态的申请才能修改")
    
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return approval
    
    updated = approval_service.update(db, approval, update_data)
    return updated


@router.post("/{approval_id}/submit", response_model=ApprovalSchema)
def submit_approval(approval_id: int, operator: str = Query(..., description="操作人"), db: Session = Depends(get_db)):
    try:
        return approval_service.submit_approval(db, approval_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/approve", response_model=ApprovalSchema)
def approve_approval(approval_id: int, action: ApprovalAction, db: Session = Depends(get_db)):
    try:
        return approval_service.approve(
            db, approval_id, 
            approver=action.approver,
            approver_role=action.approver_role,
            comments=action.comments
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/reject", response_model=ApprovalSchema)
def reject_approval(approval_id: int, action: ApprovalAction, db: Session = Depends(get_db)):
    try:
        return approval_service.reject(
            db, approval_id,
            approver=action.approver,
            approver_role=action.approver_role,
            comments=action.comments
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/start-transit", response_model=ApprovalSchema)
def start_transit(approval_id: int, operator: str = Query(..., description="操作人"), db: Session = Depends(get_db)):
    try:
        return approval_service.start_transit(db, approval_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/arrive", response_model=ApprovalSchema)
def mark_at_destination(approval_id: int, operator: str = Query(..., description="操作人"), db: Session = Depends(get_db)):
    try:
        return approval_service.mark_at_destination(db, approval_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/start-return", response_model=ApprovalSchema)
def start_return(approval_id: int, operator: str = Query(..., description="操作人"), db: Session = Depends(get_db)):
    try:
        return approval_service.start_return(db, approval_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/complete", response_model=ApprovalSchema)
def complete_approval(approval_id: int, operator: str = Query(..., description="操作人"), db: Session = Depends(get_db)):
    try:
        return approval_service.complete_approval(db, approval_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/cancel", response_model=ApprovalSchema)
def cancel_approval(approval_id: int, operator: str = Query(..., description="操作人"), reason: str = Query(..., description="取消原因"), db: Session = Depends(get_db)):
    try:
        return approval_service.cancel_approval(db, approval_id, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{approval_id}/trace", response_model=ApprovalTraceResponse)
def get_approval_trace(approval_id: int, db: Session = Depends(get_db)):
    try:
        approval = approval_service.get_approval_detail(db, approval_id)
        if not approval:
            raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 不存在")
        
        timeline = approval_service.get_trace_timeline(db, approval_id)
        
        return ApprovalTraceResponse(
            approval=approval,
            transport_records=approval.transport_records,
            environment_logs=approval.environment_logs,
            insurance=approval.insurance,
            return_inspection=approval.return_inspection,
            operation_history=approval.operation_history,
            timeline=timeline
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/create-task", response_model=ResponseModel)
def create_background_task(
    approval_id: int, 
    task_type: str = Query(..., description="任务类型: notify_insurance, sync_transport, generate_report"),
    db: Session = Depends(get_db)
):
    approval = approval_service.get(db, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 不存在")
    
    task = task_service.create_task(db, task_type, approval_id=approval_id)
    
    return ResponseModel(
        success=True,
        message="后台任务创建成功",
        data={"task_id": task.task_id, "task_type": task.task_type, "status": task.status.value}
    )
