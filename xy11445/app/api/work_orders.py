from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid

from app.models.database import get_db
from app.models.enums import WorkOrderStatus
from app.schemas import (
    WorkOrderResponse,
    WorkOrderDetailResponse,
    StatusChangeRequest,
    ReviewRequest,
    FreezeRequest,
    UnfreezeRequest,
    AttachmentUploadResponse,
    AuditLogResponse,
)
from app.services.work_order_service import WorkOrderService
from app.services.audit import AuditService

router = APIRouter(prefix="/work-orders", tags=["工单管理"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("", response_model=List[WorkOrderResponse])
def list_work_orders(
    skip: int = 0,
    limit: int = 100,
    area: str = None,
    status: str = None,
    source: str = None,
    pile_no: str = None,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    return service.list_work_orders(skip, limit, area, status, source, pile_no)


@router.get("/{work_order_id}", response_model=WorkOrderDetailResponse)
def get_work_order(work_order_id: str, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    detail = service.get_work_order_detail(work_order_id)
    if not detail:
        raise HTTPException(status_code=404, detail="工单不存在")

    wo = detail["work_order"]
    return WorkOrderDetailResponse(
        id=wo.id,
        order_no=wo.order_no,
        batch_id=wo.batch_id,
        pile_no=wo.pile_no,
        area=wo.area,
        source=wo.source,
        alarm_type=wo.alarm_type,
        alarm_level=wo.alarm_level,
        alarm_time=wo.alarm_time,
        alarm_content=wo.alarm_content,
        status=wo.status,
        status_before_freeze=wo.status_before_freeze,
        fault_duration=wo.fault_duration,
        fault_duration_before=wo.fault_duration_before,
        handler=wo.handler,
        reviewer=wo.reviewer,
        review_reason=wo.review_reason,
        manual_reason=wo.manual_reason,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
        frozen_at=wo.frozen_at,
        archived_at=wo.archived_at,
        status_transitions=detail["status_transitions"],
        attachments=detail["attachments"],
        audit_logs=detail["audit_logs"],
    )


@router.post("/{work_order_id}/status")
def change_status(
    work_order_id: str,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.change_status(
        work_order_id,
        request.target_status,
        request.operator,
        request.reason,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/review")
def review_work_order(
    work_order_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.review(
        work_order_id,
        request.operator,
        request.approved,
        request.reason,
        request.manual_reason,
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/freeze")
def freeze_work_order(
    work_order_id: str,
    request: FreezeRequest,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.freeze(work_order_id, request.operator, request.reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/unfreeze")
def unfreeze_work_order(
    work_order_id: str,
    request: UnfreezeRequest,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.unfreeze(work_order_id, request.operator, request.reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/withdraw")
def withdraw_work_order(
    work_order_id: str,
    operator: str,
    reason: str,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.withdraw(work_order_id, operator, reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/archive")
def archive_work_order(
    work_order_id: str,
    operator: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.archive(work_order_id, operator, reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/offline-recovery")
def handle_offline_recovery(
    work_order_id: str,
    operator: str,
    actual_fault_duration: float,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    success, message = service.handle_offline_recovery(
        work_order_id, operator, actual_fault_duration
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.post("/{work_order_id}/attachments", response_model=AttachmentUploadResponse)
def upload_attachment(
    work_order_id: str,
    uploaded_by: str,
    file: UploadFile = File(...),
    remark: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = WorkOrderService(db)
    wo = service.get_work_order_by_id(work_order_id)
    if not wo:
        raise HTTPException(status_code=404, detail="工单不存在")

    file_ext = os.path.splitext(file.filename)[1]
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    file_size = os.path.getsize(file_path)
    file_type = file.content_type or "application/octet-stream"

    attachment = service.add_attachment(
        work_order_id=work_order_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        uploaded_by=uploaded_by,
        remark=remark,
    )

    return AttachmentUploadResponse(
        id=attachment.id,
        file_name=attachment.file_name,
        file_type=attachment.file_type,
        file_size=attachment.file_size,
        uploaded_by=attachment.uploaded_by,
        uploaded_at=attachment.uploaded_at,
    )


@router.get("/{work_order_id}/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    work_order_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    service = AuditService(db)
    logs = service.get_work_order_history(work_order_id, skip, limit)
    return logs
