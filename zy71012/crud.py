from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, timedelta
import models, schemas
from models import AlarmStatus
import json

TIMEOUT_MINUTES = 30
MERGE_WINDOW_MINUTES = 60


def generate_alarm_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"ELV-{today}-"
    max_no = db.query(func.max(models.ElevatorAlarm.alarm_no)).filter(
        models.ElevatorAlarm.alarm_no.like(f"{prefix}%")
    ).scalar()
    if max_no:
        seq = int(max_no.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def check_timeout(alarm: models.ElevatorAlarm) -> tuple[bool, str]:
    if alarm.status in [AlarmStatus.PENDING, AlarmStatus.MAINTENANCE_DISPATCHED]:
        if alarm.dispatched_time:
            elapsed = datetime.now() - alarm.dispatched_time
        else:
            elapsed = datetime.now() - alarm.alarm_time
        
        if elapsed > timedelta(minutes=TIMEOUT_MINUTES):
            reason = f"超时{int(elapsed.total_seconds() // 60)}分钟未到场"
            return True, reason
    return False, ""


def find_duplicate_alarms(db: Session, elevator_no: str, alarm_time: datetime, exclude_id: int = None) -> list:
    window_start = alarm_time - timedelta(minutes=MERGE_WINDOW_MINUTES)
    window_end = alarm_time + timedelta(minutes=MERGE_WINDOW_MINUTES)
    
    query = db.query(models.ElevatorAlarm).filter(
        and_(
            models.ElevatorAlarm.elevator_no == elevator_no,
            models.ElevatorAlarm.alarm_time >= window_start,
            models.ElevatorAlarm.alarm_time <= window_end,
            models.ElevatorAlarm.parent_id.is_(None),
            models.ElevatorAlarm.status.notin_([AlarmStatus.CLOSED, AlarmStatus.CANCELLED])
        )
    )
    if exclude_id:
        query = query.filter(models.ElevatorAlarm.id != exclude_id)
    return query.all()


def create_alarm(db: Session, alarm: schemas.ElevatorAlarmCreate) -> models.ElevatorAlarm:
    alarm_no = generate_alarm_no(db)
    db_alarm = models.ElevatorAlarm(
        alarm_no=alarm_no,
        elevator_no=alarm.elevator_no,
        alarm_time=alarm.alarm_time,
        passenger_count=alarm.passenger_count,
        source=alarm.source,
        location=alarm.location,
        description=alarm.description,
        created_by=alarm.created_by,
        maintenance_person=alarm.maintenance_person,
        maintenance_phone=alarm.maintenance_phone,
        status=AlarmStatus.PENDING,
    )
    db.add(db_alarm)
    db.flush()
    
    status_history = models.StatusHistory(
        alarm_id=db_alarm.id,
        from_status=None,
        to_status=AlarmStatus.PENDING,
        operator=alarm.created_by,
        remark="报警创建"
    )
    db.add(status_history)
    db.commit()
    db.refresh(db_alarm)
    
    duplicates = find_duplicate_alarms(db, alarm.elevator_no, alarm.alarm_time, db_alarm.id)
    if duplicates:
        primary = duplicates[0]
        merge_alarm_internal(db, db_alarm, primary, alarm.created_by, "系统自动合并重复报警")
        db.refresh(primary)
        return primary
    
    return db_alarm


def get_alarm(db: Session, alarm_id: int) -> models.ElevatorAlarm:
    alarm = db.query(models.ElevatorAlarm).filter(models.ElevatorAlarm.id == alarm_id).first()
    if alarm:
        is_timeout, reason = check_timeout(alarm)
        if is_timeout and not alarm.is_timeout:
            alarm.is_timeout = True
            alarm.timeout_reason = reason
            db.commit()
            db.refresh(alarm)
    return alarm


def get_alarms(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    elevator_no: str = None,
    is_timeout: bool = None,
    start_time: datetime = None,
    end_time: datetime = None,
    source: str = None,
    maintenance_person: str = None,
    has_merged: bool = None,
    has_resubmit: bool = None,
) -> tuple[list, int]:
    query = db.query(models.ElevatorAlarm)
    
    if status:
        query = query.filter(models.ElevatorAlarm.status == status)
    if elevator_no:
        query = query.filter(models.ElevatorAlarm.elevator_no.contains(elevator_no))
    if is_timeout is not None:
        query = query.filter(models.ElevatorAlarm.is_timeout == is_timeout)
    if start_time:
        query = query.filter(models.ElevatorAlarm.alarm_time >= start_time)
    if end_time:
        query = query.filter(models.ElevatorAlarm.alarm_time <= end_time)
    if source:
        query = query.filter(models.ElevatorAlarm.source == source)
    if maintenance_person:
        query = query.filter(models.ElevatorAlarm.maintenance_person.contains(maintenance_person))
    if has_merged is not None:
        if has_merged:
            query = query.filter(models.ElevatorAlarm.merge_count > 0)
        else:
            query = query.filter(models.ElevatorAlarm.merge_count == 0)
    if has_resubmit is not None:
        if has_resubmit:
            query = query.filter(models.ElevatorAlarm.resubmit_count > 0)
        else:
            query = query.filter(models.ElevatorAlarm.resubmit_count == 0)
    
    total = query.count()
    alarms = query.order_by(models.ElevatorAlarm.alarm_time.desc()).offset(skip).limit(limit).all()
    
    for alarm in alarms:
        is_timeout, reason = check_timeout(alarm)
        if is_timeout and not alarm.is_timeout:
            alarm.is_timeout = True
            alarm.timeout_reason = reason
    db.commit()
    
    return alarms, total


STATUS_TRANSITIONS = {
    AlarmStatus.PENDING: [AlarmStatus.MAINTENANCE_DISPATCHED, AlarmStatus.CANCELLED],
    AlarmStatus.MAINTENANCE_DISPATCHED: [AlarmStatus.ON_SITE, AlarmStatus.CANCELLED],
    AlarmStatus.ON_SITE: [AlarmStatus.RESCUING, AlarmStatus.CANCELLED],
    AlarmStatus.RESCUING: [AlarmStatus.RESOLVED, AlarmStatus.CANCELLED],
    AlarmStatus.RESOLVED: [AlarmStatus.REVIEWING, AlarmStatus.CANCELLED],
    AlarmStatus.REVIEWING: [AlarmStatus.CLOSED, AlarmStatus.REJECTED],
    AlarmStatus.REJECTED: [AlarmStatus.REVIEWING, AlarmStatus.CANCELLED],
    AlarmStatus.CLOSED: [],
    AlarmStatus.CANCELLED: [],
}


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in STATUS_TRANSITIONS.get(from_status, [])


def transition_status(
    db: Session,
    alarm_id: int,
    new_status: str,
    operator: str,
    remark: str = None,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    if not can_transition(alarm.status, new_status):
        raise ValueError(f"无法从 {alarm.status} 转换到 {new_status}")
    
    old_status = alarm.status
    alarm.status = new_status
    
    status_history = models.StatusHistory(
        alarm_id=alarm_id,
        from_status=old_status,
        to_status=new_status,
        operator=operator,
        remark=remark
    )
    db.add(status_history)
    db.commit()
    db.refresh(alarm)
    return alarm


def dispatch_maintenance(
    db: Session,
    alarm_id: int,
    data: schemas.DispatchMaintenance,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    old_mp = alarm.maintenance_person
    old_mp_phone = alarm.maintenance_phone
    
    alarm.maintenance_person = data.maintenance_person
    alarm.maintenance_phone = data.maintenance_phone
    alarm.dispatched_time = datetime.now()
    
    if old_mp:
        audit = models.AuditLog(
            alarm_id=alarm_id,
            field_name="maintenance_person",
            old_value=old_mp,
            new_value=data.maintenance_person,
            operator=data.operator,
            change_reason="重新派单"
        )
        db.add(audit)
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.MAINTENANCE_DISPATCHED,
        data.operator, data.remark or f"派单给 {data.maintenance_person}"
    )
    return alarm


def arrive_on_site(
    db: Session,
    alarm_id: int,
    data: schemas.ArriveOnSite,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    alarm.arrived_time = datetime.now()
    db.commit()
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.ON_SITE,
        data.operator, data.remark or "维保人员已到场"
    )
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.RESCUING,
        data.operator, "开始救援"
    )
    return alarm


def resolve_alarm(
    db: Session,
    alarm_id: int,
    data: schemas.ResolveAlarm,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    alarm.resolved_time = datetime.now()
    alarm.resolution = data.resolution
    db.commit()
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.RESOLVED,
        data.operator, data.remark or "故障已解决"
    )
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.REVIEWING,
        data.operator, "提交审核"
    )
    return alarm


def review_alarm(
    db: Session,
    alarm_id: int,
    data: schemas.ReviewAlarm,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    alarm.reviewer = data.reviewer
    alarm.review_comment = data.comment
    alarm.review_time = datetime.now()
    
    if data.is_approved:
        alarm = transition_status(
            db, alarm_id, AlarmStatus.CLOSED,
            data.reviewer, data.comment or "审核通过，已结案"
        )
    else:
        if alarm.previous_rejection:
            history = alarm.previous_rejection.get("history", [])
        else:
            history = []
        history.append({
            "reject_time": datetime.now().isoformat(),
            "reviewer": data.reviewer,
            "comment": data.comment
        })
        alarm.previous_rejection = {"history": history}
        
        alarm = transition_status(
            db, alarm_id, AlarmStatus.REJECTED,
            data.reviewer, data.comment or "审核驳回"
        )
    return alarm


def resubmit_alarm(
    db: Session,
    alarm_id: int,
    data: schemas.ResubmitAlarm,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    if alarm.status != AlarmStatus.REJECTED:
        raise ValueError("只有被驳回的记录才能重新提交")
    
    if data.resolution:
        old_resolution = alarm.resolution
        alarm.resolution = data.resolution
        
        audit = models.AuditLog(
            alarm_id=alarm_id,
            field_name="resolution",
            old_value=old_resolution,
            new_value=data.resolution,
            operator=data.operator,
            change_reason="重新提交审核"
        )
        db.add(audit)
    
    alarm.resubmit_count += 1
    db.commit()
    
    alarm = transition_status(
        db, alarm_id, AlarmStatus.REVIEWING,
        data.operator, data.remark or "重新提交审核"
    )
    return alarm


def cancel_alarm(
    db: Session,
    alarm_id: int,
    operator: str,
    reason: str,
) -> models.ElevatorAlarm:
    alarm = transition_status(
        db, alarm_id, AlarmStatus.CANCELLED,
        operator, reason or "撤回报警"
    )
    return alarm


def merge_alarm_internal(
    db: Session,
    source_alarm: models.ElevatorAlarm,
    target_alarm: models.ElevatorAlarm,
    operator: str,
    remark: str,
):
    source_alarm.parent_id = target_alarm.id
    target_alarm.merge_count += 1
    
    for call in source_alarm.call_records:
        call.alarm_id = target_alarm.id
    
    status_history = models.StatusHistory(
        alarm_id=target_alarm.id,
        from_status=target_alarm.status,
        to_status=target_alarm.status,
        operator=operator,
        remark=f"{remark}: 合并 {source_alarm.alarm_no}"
    )
    db.add(status_history)
    db.commit()


def merge_alarm(
    db: Session,
    source_alarm_id: int,
    data: schemas.MergeAlarm,
) -> models.ElevatorAlarm:
    source = get_alarm(db, source_alarm_id)
    target = get_alarm(db, data.target_alarm_id)
    
    if not source or not target:
        raise ValueError("报警记录不存在")
    
    if source.id == target.id:
        raise ValueError("不能合并到自己")
    
    if target.parent_id:
        raise ValueError("目标报警已被合并到其他记录")
    
    merge_alarm_internal(db, source, target, data.operator, data.remark or "手动合并")
    db.refresh(target)
    return target


def add_call_record(
    db: Session,
    alarm_id: int,
    call: schemas.CallRecordCreate,
) -> models.CallRecord:
    db_call = models.CallRecord(
        alarm_id=alarm_id,
        **call.model_dump()
    )
    db.add(db_call)
    db.commit()
    db.refresh(db_call)
    return db_call


def update_alarm(
    db: Session,
    alarm_id: int,
    update_data: schemas.ElevatorAlarmUpdate,
    operator: str,
    change_reason: str,
) -> models.ElevatorAlarm:
    alarm = get_alarm(db, alarm_id)
    if not alarm:
        raise ValueError("报警记录不存在")
    
    data_dict = update_data.model_dump(exclude_unset=True)
    for field, new_value in data_dict.items():
        old_value = getattr(alarm, field)
        if old_value != new_value:
            audit = models.AuditLog(
                alarm_id=alarm_id,
                field_name=field,
                old_value=str(old_value) if old_value else None,
                new_value=str(new_value) if new_value else None,
                operator=operator,
                change_reason=change_reason
            )
            db.add(audit)
            setattr(alarm, field, new_value)
    
    db.commit()
    db.refresh(alarm)
    return alarm
