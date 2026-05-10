from datetime import datetime, date, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException, status

from app.models import (
    Appointment, ColdStorageBay, InspectionWindow, InspectionQueue,
    StorageLock, SkipRecord, LoadingReceipt, FailedTask,
    AppointmentStatus, StorageStatus, InspectionStatus, SkipType
)
from app.schemas import (
    AppointmentCreate, LoadingReceiptCreate, InspectionResultRequest,
    SkipRequest, RetryRequest
)


def generate_appointment_no() -> str:
    today = datetime.now().strftime("%Y%m%d")
    timestamp = datetime.now().strftime("%H%M%S")
    return f"APPT-{today}-{timestamp}"


def generate_receipt_no() -> str:
    today = datetime.now().strftime("%Y%m%d")
    timestamp = datetime.now().strftime("%H%M%S")
    return f"RCPT-{today}-{timestamp}"


def log_failed_task(
    db: Session,
    appointment_id: int,
    task_type: str,
    task_description: str,
    error_message: str,
    error_details: Optional[str] = None,
    max_retries: int = 3
) -> FailedTask:
    failed_task = FailedTask(
        appointment_id=appointment_id,
        task_type=task_type,
        task_description=task_description,
        error_message=error_message,
        error_details=error_details,
        max_retries=max_retries
    )
    db.add(failed_task)
    db.flush()
    return failed_task


def find_available_storage_bay(
    db: Session,
    volume_required: float,
    temperature_requirement: str
) -> Optional[ColdStorageBay]:
    available_bays = db.query(ColdStorageBay).filter(
        ColdStorageBay.status == StorageStatus.AVAILABLE,
        ColdStorageBay.temperature_zone == temperature_requirement,
        ColdStorageBay.capacity_cubic_meters >= volume_required
    ).order_by(ColdStorageBay.id).first()
    return available_bays


def get_next_queue_number(db: Session, window_id: int, queue_date: date) -> int:
    max_number = db.query(InspectionQueue).filter(
        InspectionQueue.inspection_window_id == window_id,
        InspectionQueue.queue_date == queue_date
    ).count()
    return max_number + 1


def create_appointment(db: Session, appointment_data: AppointmentCreate) -> Tuple[Appointment, Optional[str]]:
    appointment_no = generate_appointment_no()
    
    appointment = Appointment(
        appointment_no=appointment_no,
        **appointment_data.model_dump()
    )
    db.add(appointment)
    db.flush()
    
    available_bay = find_available_storage_bay(
        db, 
        appointment_data.volume_cubic_meters,
        appointment_data.temperature_requirement
    )
    
    lock_error = None
    if available_bay:
        try:
            lock_storage_bay(db, appointment.id, available_bay.id)
        except Exception as e:
            lock_error = str(e)
            log_failed_task(
                db, appointment.id, "storage_lock",
                "锁定仓位失败", str(e),
                error_details=f"尝试锁定仓位: {available_bay.bay_code}"
            )
    
    appointment.status = AppointmentStatus.CONFIRMED if available_bay else AppointmentStatus.PENDING
    db.commit()
    db.refresh(appointment)
    
    return appointment, lock_error


def lock_storage_bay(db: Session, appointment_id: int, storage_bay_id: int) -> StorageLock:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    storage_bay = db.query(ColdStorageBay).filter(ColdStorageBay.id == storage_bay_id).first()
    if not storage_bay:
        raise HTTPException(status_code=404, detail="仓位不存在")
    
    if storage_bay.status != StorageStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail=f"仓位 {storage_bay.bay_code} 当前不可用")
    
    if storage_bay.capacity_cubic_meters < appointment.volume_cubic_meters:
        raise HTTPException(status_code=400, detail="仓位容量不足")
    
    existing_lock = db.query(StorageLock).filter(
        StorageLock.appointment_id == appointment_id,
        StorageLock.is_released == False
    ).first()
    if existing_lock:
        raise HTTPException(status_code=400, detail="该预约已锁定仓位")
    
    storage_bay.status = StorageStatus.LOCKED
    storage_bay.current_appointment_id = appointment_id
    
    expiry_time = datetime.utcnow() + timedelta(hours=24)
    storage_lock = StorageLock(
        appointment_id=appointment_id,
        storage_bay_id=storage_bay_id,
        lock_expiry_time=expiry_time
    )
    db.add(storage_lock)
    
    appointment.storage_bay_id = storage_bay_id
    
    db.flush()
    return storage_lock


def check_in_vehicle(db: Session, appointment_no: str) -> Appointment:
    appointment = db.query(Appointment).filter(
        Appointment.appointment_no == appointment_no
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    if appointment.status not in [AppointmentStatus.CONFIRMED, AppointmentStatus.SKIPPED]:
        raise HTTPException(
            status_code=400, 
            detail=f"当前预约状态为 {appointment.status}，无法进行签到"
        )
    
    active_window = db.query(InspectionWindow).filter(
        InspectionWindow.is_active == True
    ).first()
    if not active_window:
        log_failed_task(
            db, appointment.id, "inspection_queue",
            "加入检测排队失败", "没有可用的检测窗口"
        )
        raise HTTPException(status_code=400, detail="没有可用的检测窗口")
    
    today = date.today()
    queue_number = get_next_queue_number(db, active_window.id, today)
    
    existing_queue = db.query(InspectionQueue).filter(
        InspectionQueue.appointment_id == appointment.id
    ).first()
    
    if existing_queue:
        existing_queue.inspection_window_id = active_window.id
        existing_queue.queue_number = queue_number
        existing_queue.queue_date = today
        existing_queue.status = InspectionStatus.WAITING
        existing_queue.checked_in_time = datetime.utcnow()
        existing_queue.inspection_start_time = None
        existing_queue.inspection_end_time = None
        existing_queue.expected_wait_minutes = max(0, (queue_number - 1) * 12)
    else:
        queue_record = InspectionQueue(
            appointment_id=appointment.id,
            inspection_window_id=active_window.id,
            queue_number=queue_number,
            queue_date=today,
            checked_in_time=datetime.utcnow(),
            expected_wait_minutes=max(0, (queue_number - 1) * 12)
        )
        db.add(queue_record)
    
    appointment.status = AppointmentStatus.CHECKED_IN
    
    db.commit()
    db.refresh(appointment)
    return appointment


def skip_current_appointment(db: Session, appointment_id: int, skip_request: SkipRequest) -> SkipRecord:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    queue_record = db.query(InspectionQueue).filter(
        InspectionQueue.appointment_id == appointment_id
    ).first()
    if not queue_record or queue_record.status not in [InspectionStatus.WAITING, InspectionStatus.IN_PROGRESS]:
        raise HTTPException(status_code=400, detail="该预约不在检测排队中")
    
    original_queue_number = queue_record.queue_number
    
    skip_record = SkipRecord(
        appointment_id=appointment_id,
        skip_type=skip_request.skip_type,
        skip_reason=skip_request.skip_reason,
        original_queue_number=original_queue_number,
        operator_name=skip_request.operator_name
    )
    db.add(skip_record)
    
    queue_record.status = InspectionStatus.SKIPPED
    appointment.status = AppointmentStatus.SKIPPED
    
    db.commit()
    db.refresh(skip_record)
    return skip_record


def reassign_skipped_appointment(db: Session, skip_record_id: int) -> InspectionQueue:
    skip_record = db.query(SkipRecord).filter(SkipRecord.id == skip_record_id).first()
    if not skip_record:
        raise HTTPException(status_code=404, detail="过号记录不存在")
    
    if skip_record.is_reassigned:
        raise HTTPException(status_code=400, detail="该过号记录已重新分配")
    
    appointment = skip_record.appointment
    if not appointment:
        raise HTTPException(status_code=404, detail="关联预约不存在")
    
    active_window = db.query(InspectionWindow).filter(
        InspectionWindow.is_active == True
    ).first()
    if not active_window:
        raise HTTPException(status_code=400, detail="没有可用的检测窗口")
    
    today = date.today()
    new_queue_number = get_next_queue_number(db, active_window.id, today)
    
    queue_record = db.query(InspectionQueue).filter(
        InspectionQueue.appointment_id == appointment.id
    ).first()
    
    if queue_record:
        queue_record.inspection_window_id = active_window.id
        queue_record.queue_number = new_queue_number
        queue_record.queue_date = today
        queue_record.status = InspectionStatus.WAITING
        queue_record.expected_wait_minutes = max(0, (new_queue_number - 1) * 12)
    else:
        queue_record = InspectionQueue(
            appointment_id=appointment.id,
            inspection_window_id=active_window.id,
            queue_number=new_queue_number,
            queue_date=today,
            expected_wait_minutes=max(0, (new_queue_number - 1) * 12)
        )
        db.add(queue_record)
    
    skip_record.new_queue_number = new_queue_number
    skip_record.is_reassigned = True
    skip_record.reassigned_at = datetime.utcnow()
    
    appointment.status = AppointmentStatus.CHECKED_IN
    
    db.commit()
    db.refresh(queue_record)
    return queue_record


def process_inspection_result(
    db: Session, 
    appointment_id: int, 
    result_request: InspectionResultRequest
) -> InspectionQueue:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    queue_record = db.query(InspectionQueue).filter(
        InspectionQueue.appointment_id == appointment_id
    ).first()
    if not queue_record:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    if queue_record.status == InspectionStatus.WAITING:
        queue_record.inspection_start_time = datetime.utcnow()
    
    if queue_record.checked_in_time and queue_record.inspection_start_time:
        wait_duration = queue_record.inspection_start_time - queue_record.checked_in_time
        queue_record.actual_wait_minutes = int(wait_duration.total_seconds() // 60)
    
    queue_record.status = result_request.inspection_status
    queue_record.inspector_name = result_request.inspector_name
    queue_record.inspection_notes = result_request.notes
    queue_record.inspection_end_time = datetime.utcnow()
    
    if result_request.inspection_status == InspectionStatus.PASSED:
        appointment.status = AppointmentStatus.INSPECTION_PASSED
    elif result_request.inspection_status == InspectionStatus.FAILED:
        appointment.status = AppointmentStatus.INSPECTION_FAILED
    
    db.commit()
    db.refresh(queue_record)
    return queue_record


def start_loading(db: Session, appointment_id: int) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    if appointment.status != AppointmentStatus.INSPECTION_PASSED:
        raise HTTPException(
            status_code=400, 
            detail=f"当前状态为 {appointment.status}，检测合格后才能开始装卸"
        )
    
    if not appointment.storage_bay_id:
        available_bay = find_available_storage_bay(
            db, appointment.volume_cubic_meters, appointment.temperature_requirement
        )
        if not available_bay:
            log_failed_task(
                db, appointment.id, "loading_start",
                "开始装卸失败", "没有可用的仓位"
            )
            raise HTTPException(status_code=400, detail="没有可用的仓位")
        lock_storage_bay(db, appointment.id, available_bay.id)
    
    storage_bay = db.query(ColdStorageBay).filter(
        ColdStorageBay.id == appointment.storage_bay_id
    ).first()
    
    storage_bay.status = StorageStatus.OCCUPIED
    appointment.status = AppointmentStatus.IN_LOADING
    
    db.commit()
    db.refresh(appointment)
    return appointment


def create_loading_receipt(
    db: Session, 
    appointment_id: int, 
    receipt_data: LoadingReceiptCreate
) -> LoadingReceipt:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    if appointment.status != AppointmentStatus.IN_LOADING:
        raise HTTPException(
            status_code=400, 
            detail=f"当前状态为 {appointment.status}，请先开始装卸"
        )
    
    existing_receipt = db.query(LoadingReceipt).filter(
        LoadingReceipt.appointment_id == appointment_id
    ).first()
    if existing_receipt:
        raise HTTPException(status_code=400, detail="装卸回执已存在")
    
    receipt_no = generate_receipt_no()
    
    receipt = LoadingReceipt(
        appointment_id=appointment_id,
        receipt_no=receipt_no,
        storage_bay_id=appointment.storage_bay_id,
        loading_start_time=datetime.utcnow(),
        **receipt_data.model_dump()
    )
    db.add(receipt)
    
    appointment.status = AppointmentStatus.COMPLETED
    receipt.loading_end_time = datetime.utcnow()
    
    storage_lock = db.query(StorageLock).filter(
        StorageLock.appointment_id == appointment_id,
        StorageLock.is_released == False
    ).first()
    if storage_lock:
        storage_lock.is_released = True
        storage_lock.released_at = datetime.utcnow()
        storage_lock.release_reason = "入库完成"
    
    db.commit()
    db.refresh(receipt)
    return receipt


def get_queue_statistics(db: Session) -> dict:
    today = date.today()
    
    total_waiting = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        InspectionQueue.status == InspectionStatus.WAITING
    ).count()
    
    total_in_inspection = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        InspectionQueue.status == InspectionStatus.IN_PROGRESS
    ).count()
    
    total_completed = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        or_(
            InspectionQueue.status == InspectionStatus.PASSED,
            InspectionQueue.status == InspectionStatus.FAILED
        )
    ).count()
    
    total_skipped = db.query(SkipRecord).filter(
        SkipRecord.skip_time >= datetime.combine(today, datetime.min.time())
    ).count()
    
    completed_records = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        InspectionQueue.actual_wait_minutes != None
    ).all()
    
    total_wait_time = sum(r.actual_wait_minutes for r in completed_records if r.actual_wait_minutes)
    avg_wait = total_wait_time / len(completed_records) if completed_records else 0.0
    
    current_queue = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        or_(
            InspectionQueue.status == InspectionStatus.WAITING,
            InspectionQueue.status == InspectionStatus.IN_PROGRESS
        )
    ).order_by(InspectionQueue.queue_number).all()
    
    return {
        "total_waiting": total_waiting,
        "total_in_inspection": total_in_inspection,
        "total_completed_today": total_completed,
        "total_skipped_today": total_skipped,
        "average_wait_minutes": round(avg_wait, 1),
        "current_queue": current_queue
    }


def retry_failed_task(db: Session, task_id: int, operator_name: Optional[str] = None) -> dict:
    failed_task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not failed_task:
        raise HTTPException(status_code=404, detail="失败任务不存在")
    
    if failed_task.is_resolved:
        raise HTTPException(status_code=400, detail="该任务已解决")
    
    if failed_task.retry_count >= failed_task.max_retries:
        raise HTTPException(
            status_code=400, 
            detail=f"已达到最大重试次数 ({failed_task.max_retries})，请联系管理员"
        )
    
    appointment = failed_task.appointment
    if not appointment:
        raise HTTPException(status_code=404, detail="关联预约不存在")
    
    result = {"success": False, "message": "", "action_taken": ""}
    
    try:
        if failed_task.task_type == "storage_lock":
            available_bay = find_available_storage_bay(
                db, appointment.volume_cubic_meters, appointment.temperature_requirement
            )
            if available_bay:
                lock_storage_bay(db, appointment.id, available_bay.id)
                appointment.status = AppointmentStatus.CONFIRMED
                result["message"] = "仓位锁定成功"
                result["action_taken"] = f"锁定仓位: {available_bay.bay_code}"
                result["success"] = True
            else:
                result["message"] = "当前没有可用仓位，请稍后重试或联系管理员"
                result["action_taken"] = "检查可用仓位"
        
        elif failed_task.task_type == "inspection_queue":
            appointment.status = AppointmentStatus.CONFIRMED
            check_in_vehicle(db, appointment.appointment_no)
            result["message"] = "重新加入检测排队成功"
            result["action_taken"] = "重新签到并分配排队号"
            result["success"] = True
        
        elif failed_task.task_type == "loading_start":
            if appointment.status == AppointmentStatus.INSPECTION_PASSED:
                start_loading(db, appointment.id)
                result["message"] = "开始装卸成功"
                result["action_taken"] = "分配仓位并开始装卸"
                result["success"] = True
            else:
                result["message"] = f"预约状态为 {appointment.status}，需要检测合格后才能装卸"
                result["action_taken"] = "检查预约状态"
        
        else:
            result["message"] = f"未知的任务类型: {failed_task.task_type}"
            result["action_taken"] = "请联系管理员处理"
        
        failed_task.retry_count += 1
        failed_task.last_retry_at = datetime.utcnow()
        
        if result["success"]:
            failed_task.is_resolved = True
            failed_task.resolved_at = datetime.utcnow()
            failed_task.resolution_notes = f"{result['message']} - 操作人: {operator_name or '系统'}"
        
        db.commit()
        db.refresh(failed_task)
        
    except HTTPException as e:
        failed_task.retry_count += 1
        failed_task.last_retry_at = datetime.utcnow()
        db.commit()
        raise e
    
    return result


def get_appointment_with_details(db: Session, appointment_id: int) -> dict:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    
    queue_record = db.query(InspectionQueue).filter(
        InspectionQueue.appointment_id == appointment_id
    ).first()
    
    result = {
        "appointment": appointment,
        "storage_bay": appointment.storage_bay,
        "queue_position": None,
        "expected_wait_minutes": None
    }
    
    if queue_record and queue_record.status == InspectionStatus.WAITING:
        today = date.today()
        position = db.query(InspectionQueue).filter(
            InspectionQueue.inspection_window_id == queue_record.inspection_window_id,
            InspectionQueue.queue_date == today,
            InspectionQueue.status == InspectionStatus.WAITING,
            InspectionQueue.queue_number <= queue_record.queue_number
        ).count()
        result["queue_position"] = position
        result["expected_wait_minutes"] = max(0, (position - 1) * 12)
    
    return result
