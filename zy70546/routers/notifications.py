from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import (
    Notification, NotificationStatus, NotificationBatch,
    FailureRecord
)
from schemas import (
    NotificationResponse, NotificationConfirm, ManualFixRequest,
    BatchProcessRequest, BatchProcessResponse, FailureRecordResponse,
    ErrorResponse, generate_id
)
from bloodline_service import batch_process_bloodline_changes

router = APIRouter()

@router.post("/batch-process", response_model=BatchProcessResponse, responses={400: {"model": ErrorResponse}})
def process_batch_bloodline_changes(
    request: BatchProcessRequest,
    db: Session = Depends(get_db)
):
    if not request.bloodline_relations:
        raise HTTPException(status_code=400, detail={
            "error_code": "EMPTY_BATCH",
            "error_message": "批量数据不能为空"
        })
    
    try:
        batch_id, notifications, matched, filtered, failed = batch_process_bloodline_changes(
            db, request.bloodline_relations, request.batch_id
        )
        return BatchProcessResponse(
            batch_id=batch_id,
            total_count=len(request.bloodline_relations),
            matched_count=matched,
            filtered_count=filtered,
            failed_count=failed,
            notification_ids=[n.id for n in notifications]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error_code": "PROCESS_ERROR",
            "error_message": str(e),
            "error_details": {"step": "batch_process"}
        })

@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    team_name: Optional[str] = Query(None, description="按团队名称过滤"),
    batch_id: Optional[str] = Query(None, description="按批次ID过滤"),
    status: Optional[NotificationStatus] = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Notification)
    if team_name:
        query = query.filter(Notification.team_name == team_name)
    if batch_id:
        query = query.filter(Notification.batch_id == batch_id)
    if status:
        query = query.filter(Notification.status == status)
    return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/{notification_id}", response_model=NotificationResponse, responses={404: {"model": ErrorResponse}})
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"通知ID {notification_id} 不存在"
        })
    return notification

@router.put("/{notification_id}/status", response_model=NotificationResponse, responses={404: {"model": ErrorResponse}})
def update_notification_status(
    notification_id: int,
    target_status: NotificationStatus,
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"通知ID {notification_id} 不存在"
        })
    
    valid_transitions = {
        NotificationStatus.PENDING: [NotificationStatus.MATCHED, NotificationStatus.FILTERED, NotificationStatus.FAILED],
        NotificationStatus.MATCHED: [NotificationStatus.DEDUPLICATED, NotificationStatus.FAILED],
        NotificationStatus.DEDUPLICATED: [NotificationStatus.NOTIFIED, NotificationStatus.FAILED],
        NotificationStatus.NOTIFIED: [NotificationStatus.CONFIRMED, NotificationStatus.FAILED],
        NotificationStatus.FAILED: [NotificationStatus.MANUALLY_FIXED],
    }
    
    if notification.status not in valid_transitions or target_status not in valid_transitions.get(notification.status, []):
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_TRANSITION",
            "error_message": f"无法从 {notification.status} 转换到 {target_status}",
            "error_details": {"valid_next_states": valid_transitions.get(notification.status, [])}
        })
    
    notification.status = target_status
    if target_status == NotificationStatus.NOTIFIED:
        notification.notified_at = datetime.now()
    
    db.commit()
    db.refresh(notification)
    return notification

@router.post("/{notification_id}/confirm", response_model=NotificationResponse, responses={404: {"model": ErrorResponse}})
def confirm_notification(
    notification_id: int,
    confirm_data: NotificationConfirm,
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"通知ID {notification_id} 不存在"
        })
    
    if notification.status != NotificationStatus.NOTIFIED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"只有NOTIFIED状态的通知可以确认，当前状态: {notification.status}"
        })
    
    notification.status = NotificationStatus.CONFIRMED
    notification.confirmed_at = datetime.now()
    notification.confirmed_by = confirm_data.confirmed_by
    notification.confirm_note = confirm_data.confirm_note
    
    db.commit()
    db.refresh(notification)
    return notification

@router.post("/{notification_id}/manual-fix", response_model=NotificationResponse, responses={404: {"model": ErrorResponse}})
def manual_fix_notification(
    notification_id: int,
    fix_data: ManualFixRequest,
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"通知ID {notification_id} 不存在"
        })
    
    if notification.status != NotificationStatus.FAILED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"只有FAILED状态的通知可以人工修正，当前状态: {notification.status}"
        })
    
    failure_record = db.query(FailureRecord).filter(FailureRecord.notification_id == notification_id).first()
    if failure_record and fix_data.final_conclusion:
        failure_record.final_conclusion = fix_data.final_conclusion
    
    notification.status = fix_data.target_status
    notification.confirm_note = f"人工修正: {fix_data.fixed_by} - {fix_data.fix_note}"
    
    db.commit()
    db.refresh(notification)
    return notification

@router.get("/failures/", response_model=List[FailureRecordResponse])
def list_failure_records(
    batch_id: Optional[str] = Query(None, description="按批次ID过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(FailureRecord).join(Notification)
    if batch_id:
        query = query.filter(Notification.batch_id == batch_id)
    return query.order_by(FailureRecord.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/batches/")
def list_batches(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(NotificationBatch)
    if status:
        query = query.filter(NotificationBatch.status == status)
    return query.order_by(NotificationBatch.created_at.desc()).offset(skip).limit(limit).all()
