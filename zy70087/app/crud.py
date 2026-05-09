from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import List, Optional
import json

from app import models, schemas

# ==================== Elderly Operations ====================
def get_elderly(db: Session, elderly_id: int):
    return db.query(models.Elderly).filter(models.Elderly.id == elderly_id).first()

def get_elderly_by_id_card(db: Session, id_card: str):
    return db.query(models.Elderly).filter(models.Elderly.id_card == id_card).first()

def get_all_elderly(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Elderly).offset(skip).limit(limit).all()

def create_elderly(db: Session, elderly: schemas.ElderlyCreate):
    db_elderly = models.Elderly(**elderly.dict())
    db.add(db_elderly)
    db.commit()
    db.refresh(db_elderly)
    return db_elderly

# ==================== Visit Plan Operations ====================
def get_visit_plan(db: Session, plan_id: int):
    return db.query(models.VisitPlan).filter(models.VisitPlan.id == plan_id).first()

def get_visit_plan_by_idempotency_key(db: Session, idempotency_key: str):
    return db.query(models.VisitPlan).filter(
        models.VisitPlan.task_idempotency_key == idempotency_key
    ).first()

def get_visit_plans_by_elderly(db: Session, elderly_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.VisitPlan).filter(
        models.VisitPlan.elderly_id == elderly_id
    ).offset(skip).limit(limit).all()

def get_visit_plans_by_date(db: Session, plan_date: date, skip: int = 0, limit: int = 100):
    return db.query(models.VisitPlan).filter(
        models.VisitPlan.plan_date == plan_date
    ).offset(skip).limit(limit).all()

def get_all_visit_plans(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.VisitPlan).offset(skip).limit(limit).all()

def create_visit_plan(db: Session, plan: schemas.VisitPlanCreate):
    existing_plan = get_visit_plan_by_idempotency_key(db, plan.idempotency_key)
    if existing_plan:
        return existing_plan, False
    
    db_plan = models.VisitPlan(
        elderly_id=plan.elderly_id,
        plan_date=plan.plan_date,
        plan_time=plan.plan_time,
        visit_type=plan.visit_type,
        caregiver=plan.caregiver,
        caregiver_phone=plan.caregiver_phone,
        task_idempotency_key=plan.idempotency_key,
        notes=plan.notes
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    record_operation_history(
        db=db,
        plan_id=db_plan.id,
        record_id=db_plan.id,
        record_type="visit_plan",
        operation_type="create",
        operation_detail=f"创建探访计划：{db_plan.visit_type}，日期：{db_plan.plan_date}",
        operator="system",
        new_data=json.dumps({
            "elderly_id": db_plan.elderly_id,
            "plan_date": str(db_plan.plan_date),
            "plan_time": db_plan.plan_time,
            "visit_type": db_plan.visit_type,
            "caregiver": db_plan.caregiver
        })
    )
    
    return db_plan, True

def update_visit_plan(db: Session, plan_id: int, plan_update: schemas.VisitPlanUpdate, operator: str = "system"):
    db_plan = get_visit_plan(db, plan_id)
    if not db_plan:
        return None
    
    original_data = {
        "plan_date": str(db_plan.plan_date),
        "plan_time": db_plan.plan_time,
        "visit_type": db_plan.visit_type,
        "caregiver": db_plan.caregiver,
        "status": db_plan.status
    }
    
    update_data = plan_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plan, key, value)
    
    db.commit()
    db.refresh(db_plan)
    
    record_operation_history(
        db=db,
        plan_id=db_plan.id,
        record_id=db_plan.id,
        record_type="visit_plan",
        operation_type="update",
        operation_detail=f"更新探访计划",
        operator=operator,
        original_data=json.dumps(original_data),
        new_data=json.dumps({
            "plan_date": str(db_plan.plan_date),
            "plan_time": db_plan.plan_time,
            "visit_type": db_plan.visit_type,
            "caregiver": db_plan.caregiver,
            "status": db_plan.status
        })
    )
    
    return db_plan

def find_duplicate_tasks(db: Session, elderly_id: int, plan_date: date, visit_type: str, exclude_plan_id: Optional[int] = None):
    query = db.query(models.VisitPlan).filter(
        models.VisitPlan.elderly_id == elderly_id,
        models.VisitPlan.plan_date == plan_date,
        models.VisitPlan.visit_type == visit_type,
        models.VisitPlan.status.in_(["pending", "scheduled"])
    )
    
    if exclude_plan_id:
        query = query.filter(models.VisitPlan.id != exclude_plan_id)
    
    return query.all()

def merge_duplicate_tasks(db: Session, primary_plan_id: int, merge_plan_ids: List[int], merge_reason: str, merged_by: str):
    primary_plan = get_visit_plan(db, primary_plan_id)
    if not primary_plan:
        return None
    
    merged_plans = []
    for plan_id in merge_plan_ids:
        plan = get_visit_plan(db, plan_id)
        if plan:
            plan.status = "merged"
            merged_plans.append(str(plan_id))
    
    merge_history = models.TaskMergeHistory(
        plan_id=primary_plan_id,
        merged_from_plan_ids=",".join(merged_plans),
        merge_reason=merge_reason,
        merged_by=merged_by
    )
    db.add(merge_history)
    
    for plan_id in merge_plan_ids:
        record_operation_history(
            db=db,
            plan_id=primary_plan_id,
            record_id=plan_id,
            record_type="visit_plan",
            operation_type="merge",
            operation_detail=f"合并到计划 #{primary_plan_id}",
            operator=merged_by,
            original_data=json.dumps({"merged_into": primary_plan_id})
        )
    
    db.commit()
    db.refresh(primary_plan)
    
    return primary_plan

def cancel_visit_plan(db: Session, plan_id: int, operator: str):
    db_plan = get_visit_plan(db, plan_id)
    if not db_plan:
        return None
    
    original_status = db_plan.status
    db_plan.status = "cancelled"
    
    record_operation_history(
        db=db,
        plan_id=db_plan.id,
        record_id=db_plan.id,
        record_type="visit_plan",
        operation_type="cancel",
        operation_detail=f"取消探访计划",
        operator=operator,
        original_data=json.dumps({"status": original_status}),
        new_data=json.dumps({"status": "cancelled"})
    )
    
    db.commit()
    db.refresh(db_plan)
    return db_plan

# ==================== Visit Record Operations ====================
def get_visit_record(db: Session, record_id: int):
    return db.query(models.VisitRecord).filter(models.VisitRecord.id == record_id).first()

def get_visit_records_by_elderly(db: Session, elderly_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.VisitRecord).filter(
        models.VisitRecord.elderly_id == elderly_id
    ).order_by(models.VisitRecord.check_in_time.desc()).offset(skip).limit(limit).all()

def get_visit_records_by_plan(db: Session, plan_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.VisitRecord).filter(
        models.VisitRecord.plan_id == plan_id
    ).offset(skip).limit(limit).all()

def check_in(db: Session, check_in_data: schemas.VisitRecordCheckIn):
    now = datetime.utcnow()
    visit_date = now.date()
    
    existing_visit = db.query(models.VisitRecord).filter(
        models.VisitRecord.elderly_id == check_in_data.elderly_id,
        models.VisitRecord.visit_date == visit_date,
        models.VisitRecord.check_out_time == None
    ).first()
    
    if existing_visit:
        return existing_visit, False
    
    db_record = models.VisitRecord(
        elderly_id=check_in_data.elderly_id,
        plan_id=check_in_data.plan_id,
        visit_date=visit_date,
        check_in_time=now,
        latitude=check_in_data.latitude,
        longitude=check_in_data.longitude,
        location_accuracy=check_in_data.location_accuracy,
        caregiver=check_in_data.caregiver
    )
    db.add(db_record)
    
    if check_in_data.plan_id:
        plan = get_visit_plan(db, check_in_data.plan_id)
        if plan:
            plan.status = "in_progress"
    
    db.commit()
    db.refresh(db_record)
    
    if check_in_data.plan_id:
        record_operation_history(
            db=db,
            plan_id=check_in_data.plan_id,
            record_id=db_record.id,
            record_type="visit_record",
            operation_type="check_in",
            operation_detail=f"签到时间：{now}",
            operator=check_in_data.caregiver,
            new_data=json.dumps({
                "check_in_time": str(now),
                "latitude": check_in_data.latitude,
                "longitude": check_in_data.longitude
            })
        )
    
    return db_record, True

def check_out(db: Session, record_id: int, check_out_data: schemas.VisitRecordCheckOut, operator: str):
    db_record = get_visit_record(db, record_id)
    if not db_record:
        return None
    
    if db_record.check_out_time:
        return db_record
    
    db_record.check_out_time = check_out_data.check_out_time
    db_record.actual_visit_type = check_out_data.actual_visit_type
    db_record.health_condition = check_out_data.health_condition
    db_record.services_provided = check_out_data.services_provided
    db_record.notes = check_out_data.notes
    
    if db_record.plan_id:
        plan = get_visit_plan(db, db_record.plan_id)
        if plan:
            plan.status = "completed"
    
    db.commit()
    db.refresh(db_record)
    
    if db_record.plan_id:
        record_operation_history(
            db=db,
            plan_id=db_record.plan_id,
            record_id=db_record.id,
            record_type="visit_record",
            operation_type="check_out",
            operation_detail=f"签退时间：{check_out_data.check_out_time}",
            operator=operator,
            new_data=json.dumps({
                "check_out_time": str(check_out_data.check_out_time),
                "actual_visit_type": check_out_data.actual_visit_type,
                "services_provided": check_out_data.services_provided
            })
        )
    
    return db_record

def create_backdated_visit(db: Session, visit_data: schemas.VisitRecordCreate, operator: str):
    if not visit_data.is_backdated:
        return None, "Must be backdated"
    
    existing_visit = db.query(models.VisitRecord).filter(
        models.VisitRecord.elderly_id == visit_data.elderly_id,
        models.VisitRecord.visit_date == visit_data.visit_date,
        models.VisitRecord.check_in_time == visit_data.check_in_time
    ).first()
    
    if existing_visit:
        return existing_visit, "Already exists"
    
    db_record = models.VisitRecord(**visit_data.dict())
    db.add(db_record)
    
    if visit_data.plan_id:
        plan = get_visit_plan(db, visit_data.plan_id)
        if plan:
            plan.status = "completed"
    
    db.commit()
    db.refresh(db_record)
    
    if visit_data.plan_id:
        record_operation_history(
            db=db,
            plan_id=visit_data.plan_id,
            record_id=db_record.id,
            record_type="visit_record",
            operation_type="backdate",
            operation_detail=f"补录探访记录：{visit_data.visit_date}",
            operator=operator,
            new_data=json.dumps({
                "visit_date": str(visit_data.visit_date),
                "check_in_time": str(visit_data.check_in_time),
                "is_backdated": True,
                "backdated_reason": visit_data.backdated_reason
            })
        )
    
    return db_record, "Created"

def withdraw_visit_record(db: Session, record_id: int, operator: str, reason: str):
    db_record = get_visit_record(db, record_id)
    if not db_record:
        return None
    
    if db_record.plan_id:
        plan = get_visit_plan(db, db_record.plan_id)
        if plan:
            plan.status = "withdrawn"
    
    record_operation_history(
        db=db,
        plan_id=db_record.plan_id if db_record.plan_id else 0,
        record_id=db_record.id,
        record_type="visit_record",
        operation_type="withdraw",
        operation_detail=f"撤回探访记录，原因：{reason}",
        operator=operator,
        original_data=json.dumps({
            "visit_date": str(db_record.visit_date),
            "check_in_time": str(db_record.check_in_time),
            "caregiver": db_record.caregiver
        })
    )
    
    db.delete(db_record)
    db.commit()
    
    return db_record

# ==================== Exception Report Operations ====================
def get_exception_report(db: Session, exception_id: int):
    return db.query(models.ExceptionReport).filter(models.ExceptionReport.id == exception_id).first()

def get_exception_reports_by_elderly(db: Session, elderly_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.ExceptionReport).filter(
        models.ExceptionReport.elderly_id == elderly_id
    ).order_by(models.ExceptionReport.report_time.desc()).offset(skip).limit(limit).all()

def get_pending_exception_reports(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ExceptionReport).filter(
        models.ExceptionReport.status == "pending"
    ).order_by(models.ExceptionReport.exception_level.desc()).offset(skip).limit(limit).all()

def create_exception_report(db: Session, exception: schemas.ExceptionReportCreate):
    db_exception = models.ExceptionReport(**exception.dict())
    db.add(db_exception)
    
    if exception.plan_id:
        plan = get_visit_plan(db, exception.plan_id)
        if plan:
            plan.status = "exception"
    
    db.commit()
    db.refresh(db_exception)
    
    if exception.plan_id:
        record_operation_history(
            db=db,
            plan_id=exception.plan_id,
            record_id=db_exception.id,
            record_type="exception_report",
            operation_type="create",
            operation_detail=f"上报异常：{exception.exception_type}，级别：{exception.exception_level}",
            operator=exception.reported_by,
            new_data=json.dumps({
                "exception_type": exception.exception_type,
                "exception_level": exception.exception_level,
                "description": exception.description[:200]
            })
        )
    
    return db_exception

def resolve_exception_report(db: Session, exception_id: int, resolve_data: schemas.ExceptionReportResolve):
    db_exception = get_exception_report(db, exception_id)
    if not db_exception:
        return None
    
    db_exception.status = "resolved"
    db_exception.resolved_time = datetime.utcnow()
    db_exception.resolution = resolve_data.resolution
    db_exception.resolved_by = resolve_data.resolved_by
    
    if db_exception.plan_id:
        plan = get_visit_plan(db, db_exception.plan_id)
        if plan and plan.status == "exception":
            plan.status = "completed"
    
    db.commit()
    db.refresh(db_exception)
    
    if db_exception.plan_id:
        record_operation_history(
            db=db,
            plan_id=db_exception.plan_id,
            record_id=db_exception.id,
            record_type="exception_report",
            operation_type="resolve",
            operation_detail=f"解决异常：{resolve_data.resolution[:100]}",
            operator=resolve_data.resolved_by,
            new_data=json.dumps({
                "resolution": resolve_data.resolution,
                "resolved_time": str(db_exception.resolved_time)
            })
        )
    
    return db_exception

# ==================== Notification Operations ====================
def get_notification(db: Session, notification_id: int):
    return db.query(models.Notification).filter(models.Notification.id == notification_id).first()

def get_notifications_by_exception(db: Session, exception_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Notification).filter(
        models.Notification.exception_id == exception_id
    ).offset(skip).limit(limit).all()

def create_notification(db: Session, notification: schemas.NotificationCreate):
    db_notification = models.Notification(**notification.dict())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

def ack_notification(db: Session, notification_id: int, ack_by: str):
    db_notification = get_notification(db, notification_id)
    if not db_notification:
        return None
    
    db_notification.ack_time = datetime.utcnow()
    db_notification.ack_by = ack_by
    db.commit()
    db.refresh(db_notification)
    return db_notification

# ==================== Operation History ====================
def record_operation_history(
    db: Session,
    plan_id: int,
    record_id: Optional[int],
    record_type: Optional[str],
    operation_type: str,
    operation_detail: str,
    operator: str,
    original_data: Optional[str] = None,
    new_data: Optional[str] = None
):
    db_history = models.OperationHistory(
        plan_id=plan_id,
        record_id=record_id,
        record_type=record_type,
        operation_type=operation_type,
        operation_detail=operation_detail,
        operator=operator,
        original_data=original_data,
        new_data=new_data
    )
    db.add(db_history)
    db.commit()
    return db_history

def get_operation_history(db: Session, plan_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.OperationHistory).filter(
        models.OperationHistory.plan_id == plan_id
    ).order_by(models.OperationHistory.operation_time.desc()).offset(skip).limit(limit).all()

# ==================== Reporting ====================
def get_daily_report(db: Session, report_date: date):
    next_day = report_date + timedelta(days=1)
    
    total_plans = db.query(models.VisitPlan).filter(
        models.VisitPlan.plan_date == report_date
    ).count()
    
    completed_visits = db.query(models.VisitPlan).filter(
        models.VisitPlan.plan_date == report_date,
        models.VisitPlan.status == "completed"
    ).count()
    
    pending_visits = db.query(models.VisitPlan).filter(
        models.VisitPlan.plan_date == report_date,
        models.VisitPlan.status.in_(["pending", "scheduled", "in_progress"])
    ).count()
    
    missed_visits = db.query(models.VisitPlan).filter(
        models.VisitPlan.plan_date == report_date,
        models.VisitPlan.status.in_(["cancelled", "missed"])
    ).count()
    
    total_exceptions = db.query(models.ExceptionReport).filter(
        models.ExceptionReport.report_time >= datetime.combine(report_date, datetime.min.time()),
        models.ExceptionReport.report_time < datetime.combine(next_day, datetime.min.time())
    ).count()
    
    pending_exceptions = db.query(models.ExceptionReport).filter(
        models.ExceptionReport.report_time >= datetime.combine(report_date, datetime.min.time()),
        models.ExceptionReport.report_time < datetime.combine(next_day, datetime.min.time()),
        models.ExceptionReport.status == "pending"
    ).count()
    
    resolved_exceptions = db.query(models.ExceptionReport).filter(
        models.ExceptionReport.report_time >= datetime.combine(report_date, datetime.min.time()),
        models.ExceptionReport.report_time < datetime.combine(next_day, datetime.min.time()),
        models.ExceptionReport.status == "resolved"
    ).count()
    
    family_notifications = db.query(models.Notification).filter(
        models.Notification.send_time >= datetime.combine(report_date, datetime.min.time()),
        models.Notification.send_time < datetime.combine(next_day, datetime.min.time()),
        models.Notification.recipient_type == "family"
    ).count()
    
    return schemas.DailyReport(
        report_date=report_date,
        total_plans=total_plans,
        completed_visits=completed_visits,
        pending_visits=pending_visits,
        missed_visits=missed_visits,
        total_exceptions=total_exceptions,
        pending_exceptions=pending_exceptions,
        resolved_exceptions=resolved_exceptions,
        family_notifications_sent=family_notifications
    )

def get_elderly_visit_summary(db: Session, elderly_id: int, start_date: date, end_date: date):
    elderly = get_elderly(db, elderly_id)
    if not elderly:
        return None
    
    total_plans = db.query(models.VisitPlan).filter(
        models.VisitPlan.elderly_id == elderly_id,
        models.VisitPlan.plan_date >= start_date,
        models.VisitPlan.plan_date <= end_date
    ).count()
    
    completed_visits = db.query(models.VisitPlan).filter(
        models.VisitPlan.elderly_id == elderly_id,
        models.VisitPlan.plan_date >= start_date,
        models.VisitPlan.plan_date <= end_date,
        models.VisitPlan.status == "completed"
    ).count()
    
    missed_visits = db.query(models.VisitPlan).filter(
        models.VisitPlan.elderly_id == elderly_id,
        models.VisitPlan.plan_date >= start_date,
        models.VisitPlan.plan_date <= end_date,
        models.VisitPlan.status.in_(["cancelled", "missed"])
    ).count()
    
    last_visit = db.query(models.VisitRecord).filter(
        models.VisitRecord.elderly_id == elderly_id,
        models.VisitRecord.visit_date <= end_date
    ).order_by(models.VisitRecord.visit_date.desc()).first()
    
    total_exceptions = db.query(models.ExceptionReport).filter(
        models.ExceptionReport.elderly_id == elderly_id,
        models.ExceptionReport.report_time >= datetime.combine(start_date, datetime.min.time()),
        models.ExceptionReport.report_time <= datetime.combine(end_date, datetime.max.time())
    ).count()
    
    unresolved_exceptions = db.query(models.ExceptionReport).filter(
        models.ExceptionReport.elderly_id == elderly_id,
        models.ExceptionReport.status == "pending"
    ).count()
    
    return schemas.ElderlyVisitSummary(
        elderly_id=elderly_id,
        elderly_name=elderly.name,
        total_plans=total_plans,
        completed_visits=completed_visits,
        missed_visits=missed_visits,
        last_visit_date=last_visit.visit_date if last_visit else None,
        total_exceptions=total_exceptions,
        unresolved_exceptions=unresolved_exceptions
    )
