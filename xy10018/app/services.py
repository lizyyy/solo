import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import (
    User, Reissue, StatusHistory, ReissueHistory, OperationLog, FailedTask,
    UserRole, ReissueStatus, OperationType
)
from .schemas import (
    ReissueCreate, ReissueUpdate, StatusChange, UserCreate, UserUpdate, BatchOperation
)
from .security import get_password_hash

STATUS_TRANSITIONS = {
    ReissueStatus.PENDING: [ReissueStatus.PROCESSING, ReissueStatus.CANCELLED],
    ReissueStatus.PROCESSING: [ReissueStatus.SHIPPED, ReissueStatus.FAILED, ReissueStatus.CANCELLED],
    ReissueStatus.SHIPPED: [ReissueStatus.DELIVERED, ReissueStatus.FAILED],
    ReissueStatus.DELIVERED: [ReissueStatus.COMPLETED, ReissueStatus.FAILED],
    ReissueStatus.COMPLETED: [],
    ReissueStatus.FAILED: [ReissueStatus.PENDING, ReissueStatus.CANCELLED],
    ReissueStatus.CANCELLED: []
}

def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: UserUpdate) -> Optional[User]:
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        return None
    for key, value in user_update.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()

def get_reissue_by_order_no(db: Session, order_no: str) -> Optional[Reissue]:
    return db.query(Reissue).filter(Reissue.order_no == order_no).first()

def reissue_to_dict(reissue: Reissue) -> Dict[str, Any]:
    return {
        "id": reissue.id,
        "order_no": reissue.order_no,
        "customer_name": reissue.customer_name,
        "customer_phone": reissue.customer_phone,
        "address": reissue.address,
        "product_name": reissue.product_name,
        "product_sku": reissue.product_sku,
        "quantity": reissue.quantity,
        "reason": reissue.reason,
        "description": reissue.description,
        "status": reissue.status.value,
        "tracking_number": reissue.tracking_number,
        "shipping_company": reissue.shipping_company,
        "shipping_cost": reissue.shipping_cost,
        "remarks": reissue.remarks,
        "version": reissue.version,
        "created_by": reissue.created_by,
        "assigned_to": reissue.assigned_to,
        "created_at": reissue.created_at.isoformat() if reissue.created_at else None,
        "updated_at": reissue.updated_at.isoformat() if reissue.updated_at else None
    }

def create_history_snapshot(
    db: Session, reissue: Reissue, changed_by: int, change_type: str
) -> ReissueHistory:
    snapshot = reissue_to_dict(reissue)
    history = ReissueHistory(
        reissue_id=reissue.id,
        version=reissue.version,
        snapshot=snapshot,
        changed_by=changed_by,
        change_type=change_type
    )
    db.add(history)
    return history

def log_operation(
    db: Session, user_id: int, operation_type: OperationType,
    reissue_id: Optional[int] = None, detail: Optional[Dict] = None,
    ip_address: Optional[str] = None
) -> OperationLog:
    log = OperationLog(
        user_id=user_id,
        reissue_id=reissue_id,
        operation_type=operation_type,
        detail=detail,
        ip_address=ip_address
    )
    db.add(log)
    return log

def can_transition_status(current_status: ReissueStatus, target_status: ReissueStatus) -> bool:
    return target_status in STATUS_TRANSITIONS.get(current_status, [])

def create_reissue(db: Session, reissue: ReissueCreate, created_by: int) -> Reissue:
    if get_reissue_by_order_no(db, reissue.order_no):
        raise ValueError(f"订单号 {reissue.order_no} 已存在")
    
    db_reissue = Reissue(
        **reissue.model_dump(),
        status=ReissueStatus.PENDING,
        version=1,
        created_by=created_by
    )
    db.add(db_reissue)
    db.flush()
    
    create_history_snapshot(db, db_reissue, created_by, "create")
    log_operation(db, created_by, OperationType.CREATE, db_reissue.id, {
        "order_no": reissue.order_no,
        "customer_name": reissue.customer_name
    })
    
    status_history = StatusHistory(
        reissue_id=db_reissue.id,
        from_status=None,
        to_status=ReissueStatus.PENDING,
        changed_by=created_by,
        remarks="创建补发单"
    )
    db.add(status_history)
    
    db.commit()
    db.refresh(db_reissue)
    return db_reissue

def update_reissue(db: Session, reissue_id: int, reissue_update: ReissueUpdate, changed_by: int) -> Optional[Reissue]:
    db_reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
    if not db_reissue:
        return None
    
    update_data = reissue_update.model_dump(exclude_unset=True)
    if update_data:
        db_reissue.version += 1
        for key, value in update_data.items():
            setattr(db_reissue, key, value)
        
        db.flush()
        create_history_snapshot(db, db_reissue, changed_by, "update")
        log_operation(db, changed_by, OperationType.UPDATE, db_reissue.id, update_data)
        
        db.commit()
        db.refresh(db_reissue)
    
    return db_reissue

def change_status(
    db: Session, reissue_id: int, status_change: StatusChange, changed_by: int
) -> Optional[Reissue]:
    db_reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
    if not db_reissue:
        return None
    
    if not can_transition_status(db_reissue.status, status_change.status):
        raise ValueError(
            f"无法从 {db_reissue.status.value} 转换到 {status_change.status.value}"
        )
    
    old_status = db_reissue.status
    db_reissue.status = status_change.status
    db_reissue.version += 1
    db_reissue.last_error = None
    
    status_history = StatusHistory(
        reissue_id=db_reissue.id,
        from_status=old_status,
        to_status=status_change.status,
        changed_by=changed_by,
        remarks=status_change.remarks
    )
    db.add(status_history)
    
    db.flush()
    create_history_snapshot(db, db_reissue, changed_by, "status_change")
    log_operation(db, changed_by, OperationType.STATUS_CHANGE, db_reissue.id, {
        "from": old_status.value,
        "to": status_change.status.value,
        "remarks": status_change.remarks
    })
    
    db.commit()
    db.refresh(db_reissue)
    return db_reissue

def delete_reissue(db: Session, reissue_id: int, deleted_by: int) -> bool:
    from .models import StatusHistory, ReissueHistory, OperationLog
    
    db_reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
    if not db_reissue:
        return False
    
    log_operation(db, deleted_by, OperationType.DELETE, db_reissue.id, {
        "order_no": db_reissue.order_no,
        "customer_name": db_reissue.customer_name
    })
    db.flush()
    
    db.query(StatusHistory).filter(StatusHistory.reissue_id == reissue_id).delete()
    db.query(ReissueHistory).filter(ReissueHistory.reissue_id == reissue_id).delete()
    db.query(OperationLog).filter(OperationLog.reissue_id == reissue_id, OperationLog.operation_type != OperationType.DELETE).delete()
    
    db.delete(db_reissue)
    db.commit()
    return True

def get_reissues(
    db: Session, skip: int = 0, limit: int = 100,
    status: Optional[ReissueStatus] = None,
    assigned_to: Optional[int] = None,
    created_by: Optional[int] = None,
    search: Optional[str] = None
) -> tuple[List[Reissue], int]:
    query = db.query(Reissue)
    
    if status:
        query = query.filter(Reissue.status == status)
    if assigned_to:
        query = query.filter(Reissue.assigned_to == assigned_to)
    if created_by:
        query = query.filter(Reissue.created_by == created_by)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Reissue.order_no.ilike(search_term)) |
            (Reissue.customer_name.ilike(search_term)) |
            (Reissue.product_name.ilike(search_term))
        )
    
    total = query.count()
    items = query.order_by(Reissue.id.desc()).offset(skip).limit(limit).all()
    
    return items, total

def get_status_history(db: Session, reissue_id: int) -> List[StatusHistory]:
    return db.query(StatusHistory).filter(StatusHistory.reissue_id == reissue_id).order_by(StatusHistory.id).all()

def get_reissue_history(db: Session, reissue_id: int) -> List[ReissueHistory]:
    return db.query(ReissueHistory).filter(ReissueHistory.reissue_id == reissue_id).order_by(ReissueHistory.id.desc()).all()

def record_failed_task(
    db: Session, task_name: str, error_message: str,
    reissue_id: Optional[int] = None, parameters: Optional[Dict] = None,
    error_stack: Optional[str] = None, max_retries: int = 3
) -> FailedTask:
    task = FailedTask(
        task_name=task_name,
        reissue_id=reissue_id,
        parameters=parameters,
        error_message=error_message,
        error_stack=error_stack,
        retry_count=0,
        max_retries=max_retries,
        next_retry_at=datetime.utcnow() + timedelta(minutes=1)
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

def get_failed_tasks(db: Session, status: Optional[str] = None) -> List[FailedTask]:
    query = db.query(FailedTask)
    if status:
        query = query.filter(FailedTask.status == status)
    return query.order_by(FailedTask.id.desc()).all()

def retry_failed_task(db: Session, task_id: int) -> Optional[FailedTask]:
    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not task:
        return None
    
    task.retry_count += 1
    if task.retry_count >= task.max_retries:
        task.status = "exhausted"
    else:
        task.next_retry_at = datetime.utcnow() + timedelta(minutes=task.retry_count * 5)
    
    db.commit()
    db.refresh(task)
    return task

def get_operation_logs(
    db: Session, skip: int = 0, limit: int = 100,
    user_id: Optional[int] = None,
    operation_type: Optional[OperationType] = None
) -> tuple[List[OperationLog], int]:
    query = db.query(OperationLog)
    
    if user_id:
        query = query.filter(OperationLog.user_id == user_id)
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    
    total = query.count()
    items = query.order_by(OperationLog.id.desc()).offset(skip).limit(limit).all()
    
    return items, total

def batch_assign(
    db: Session, ids: List[int], assignee_id: int, changed_by: int
) -> Dict[str, Any]:
    success_count = 0
    failed_ids = []
    
    for reissue_id in ids:
        try:
            reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
            if reissue:
                reissue.assigned_to = assignee_id
                reissue.version += 1
                db.flush()
                create_history_snapshot(db, reissue, changed_by, "batch_assign")
                success_count += 1
            else:
                failed_ids.append(reissue_id)
        except Exception:
            failed_ids.append(reissue_id)
    
    log_operation(db, changed_by, OperationType.BATCH_OPERATION, None, {
        "action": "batch_assign",
        "ids": ids,
        "assignee_id": assignee_id,
        "success_count": success_count,
        "failed_count": len(failed_ids)
    })
    
    db.commit()
    return {"success_count": success_count, "failed_count": len(failed_ids), "failed_ids": failed_ids}

def batch_cancel(
    db: Session, ids: List[int], changed_by: int, remarks: Optional[str] = None
) -> Dict[str, Any]:
    success_count = 0
    failed_ids = []
    
    for reissue_id in ids:
        try:
            reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
            if reissue and can_transition_status(reissue.status, ReissueStatus.CANCELLED):
                old_status = reissue.status
                reissue.status = ReissueStatus.CANCELLED
                reissue.version += 1
                
                status_history = StatusHistory(
                    reissue_id=reissue.id,
                    from_status=old_status,
                    to_status=ReissueStatus.CANCELLED,
                    changed_by=changed_by,
                    remarks=remarks or "批量取消"
                )
                db.add(status_history)
                
                db.flush()
                create_history_snapshot(db, reissue, changed_by, "batch_cancel")
                success_count += 1
            else:
                failed_ids.append(reissue_id)
        except Exception:
            failed_ids.append(reissue_id)
    
    log_operation(db, changed_by, OperationType.BATCH_OPERATION, None, {
        "action": "batch_cancel",
        "ids": ids,
        "success_count": success_count,
        "failed_count": len(failed_ids)
    })
    
    db.commit()
    return {"success_count": success_count, "failed_count": len(failed_ids), "failed_ids": failed_ids}

def get_statistics(db: Session) -> Dict[str, Any]:
    return {
        "total": db.query(func.count(Reissue.id)).scalar(),
        "by_status": {
            status.value: db.query(func.count(Reissue.id)).filter(Reissue.status == status).scalar()
            for status in ReissueStatus
        },
        "failed_tasks": db.query(func.count(FailedTask.id)).filter(FailedTask.status == "pending").scalar(),
        "users": db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    }
