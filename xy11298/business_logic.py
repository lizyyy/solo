from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import CleaningTask, CleaningPhoto, Deduction, Rework, OperationLog, Settlement
import schemas

REQUIRED_PHOTO_TYPES = ["living_room", "bedroom", "bathroom", "kitchen", "overall"]
TIMEOUT_DEDUCTION_RATE = 10
REWORK_DEDUCTION_AMOUNT = 50


def check_photo_completeness(db: Session, task_id: int) -> tuple[bool, list[str]]:
    photos = db.query(CleaningPhoto).filter(CleaningPhoto.task_id == task_id).all()
    existing_types = set(p.photo_type for p in photos)
    missing_types = [pt for pt in REQUIRED_PHOTO_TYPES if pt not in existing_types]
    
    if missing_types:
        return False, [f"缺少照片: {', '.join(missing_types)}"]
    return True, ["照片齐全"]


def check_timeout(db: Session, task_id: int) -> tuple[bool, list[str], float]:
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    if not task:
        return False, ["任务不存在"], 0
    
    now = datetime.utcnow()
    if now > task.deadline:
        hours_overdue = (now - task.deadline).total_seconds() / 3600
        deduction = min(hours_overdue * TIMEOUT_DEDUCTION_RATE, task.base_fee * 0.5)
        return True, [f"超时 {hours_overdue:.1f} 小时"], deduction
    return False, ["在规定时间内完成"], 0


def check_rework_impact(db: Session, task_id: int) -> tuple[bool, list[str], float]:
    reworks = db.query(Rework).filter(
        Rework.task_id == task_id,
        Rework.affects_settlement == True
    ).all()
    
    if reworks:
        deduction = len(reworks) * REWORK_DEDUCTION_AMOUNT
        reasons = [f"返工 #{i+1}: {rw.reason}" for i, rw in enumerate(reworks)]
        return True, reasons, deduction
    return False, ["无返工记录"], 0


def calculate_task_deductions(db: Session, task_id: int) -> dict:
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    if not task:
        return {"success": False, "reason": "任务不存在"}
    
    details = []
    total_deduction = 0
    
    photos_complete, photo_reasons = check_photo_completeness(db, task_id)
    details.extend(photo_reasons)
    if not photos_complete:
        total_deduction += task.base_fee * 0.3
    
    has_timeout, timeout_reasons, timeout_deduction = check_timeout(db, task_id)
    details.extend(timeout_reasons)
    if has_timeout:
        total_deduction += timeout_deduction
    
    has_rework, rework_reasons, rework_deduction = check_rework_impact(db, task_id)
    details.extend(rework_reasons)
    if has_rework:
        total_deduction += rework_deduction
    
    task.deduction_amount = total_deduction
    task.final_fee = max(task.base_fee - total_deduction, 0)
    db.commit()
    
    return {
        "success": True,
        "task_id": task_id,
        "base_fee": task.base_fee,
        "total_deduction": total_deduction,
        "final_fee": task.final_fee,
        "details": details,
        "photos_complete": photos_complete,
        "has_timeout": has_timeout,
        "has_rework": has_rework
    }


def apply_deduction(db: Session, deduction_data: schemas.DeductionCreate) -> dict:
    existing = db.query(Deduction).filter(
        Deduction.task_id == deduction_data.task_id,
        Deduction.deduction_type == deduction_data.deduction_type,
        Deduction.reason == deduction_data.reason
    ).first()
    
    if existing:
        return {
            "success": True,
            "message": "扣款已存在，跳过重复扣款",
            "deduction": existing
        }
    
    deduction = Deduction(**deduction_data.model_dump())
    db.add(deduction)
    db.flush()
    
    task = db.query(CleaningTask).filter(CleaningTask.id == deduction_data.task_id).first()
    if task:
        task.deduction_amount += deduction_data.amount
        task.final_fee = max(task.base_fee - task.deduction_amount, 0)
    
    db.commit()
    db.refresh(deduction)
    
    return {
        "success": True,
        "message": "扣款已应用",
        "deduction": deduction
    }


def log_operation(db: Session, op_type: str, ref_id: str, status: str, message: str, operator: str = None):
    log = OperationLog(
        operation_type=op_type,
        reference_id=ref_id,
        status=status,
        message=message,
        operator=operator
    )
    db.add(log)
    db.commit()


def validate_task_for_inspection(db: Session, task_id: int) -> tuple[bool, list[str]]:
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    if not task:
        return False, ["任务不存在"]
    
    if task.status not in ["assigned", "in_progress"]:
        return False, [f"任务状态 {task.status} 不允许验收"]
    
    photos_complete, photo_reasons = check_photo_completeness(db, task_id)
    if not photos_complete:
        return False, photo_reasons
    
    return True, ["验证通过，可以验收"]


def can_settle_task(db: Session, task_id: int) -> tuple[bool, list[str]]:
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    if not task:
        return False, ["任务不存在"]
    
    reasons = []
    
    if task.status != "completed":
        reasons.append(f"任务状态 {task.status}，不是已完成")
    
    pending_reworks = db.query(Rework).filter(
        Rework.task_id == task_id,
        Rework.completed == False
    ).count()
    
    if pending_reworks > 0:
        reasons.append(f"有 {pending_reworks} 个返工未完成")
    
    if reasons:
        return False, reasons
    return True, ["可以结算"]


def get_task_status_reason(db: Session, task_id: int) -> dict:
    task = db.query(CleaningTask).filter(CleaningTask.id == task_id).first()
    if not task:
        return {"status": "not_found", "reason": "任务不存在"}
    
    reasons = []
    photos_complete, photo_reasons = check_photo_completeness(db, task_id)
    reasons.extend(photo_reasons)
    
    has_timeout, timeout_reasons, _ = check_timeout(db, task_id)
    reasons.extend(timeout_reasons)
    
    has_rework, rework_reasons, _ = check_rework_impact(db, task_id)
    reasons.extend(rework_reasons)
    
    return {
        "task_id": task_id,
        "task_no": task.task_no,
        "status": task.status,
        "reasons": reasons,
        "photos_complete": photos_complete,
        "has_timeout": has_timeout,
        "has_rework": has_rework,
        "deduction_amount": task.deduction_amount,
        "final_fee": task.final_fee
    }