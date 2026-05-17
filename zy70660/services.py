from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Dict
from database import (
    AccessLog, Employee, Whitelist, DetectionTask,
    AnomalyRecord, AnomalyHistory, DoorArea
)
import schemas


def get_whitelist_card_numbers(db: Session) -> set:
    whitelists = db.query(Whitelist).filter(Whitelist.is_active == True).all()
    return {w.card_number for w in whitelists}


def get_employee_by_card_number(db: Session, card_number: str):
    return db.query(Employee).filter(Employee.card_number == card_number).first()


def detect_anomalies(db: Session, task_id: int, time_window_minutes: int = 60) -> int:
    task = db.query(DetectionTask).filter(DetectionTask.id == task_id).first()
    if not task:
        return 0

    task.started_at = datetime.utcnow()
    task.status = "running"
    db.commit()

    whitelist_cards = get_whitelist_card_numbers(db)

    logs = db.query(AccessLog).order_by(AccessLog.card_number, AccessLog.swipe_time).all()

    card_logs: Dict[str, List[AccessLog]] = {}
    for log in logs:
        if log.card_number not in card_logs:
            card_logs[log.card_number] = []
        card_logs[log.card_number].append(log)

    anomaly_count = 0
    time_window = timedelta(minutes=time_window_minutes)

    for card_number, card_log_list in card_logs.items():
        if card_number in whitelist_cards:
            continue

        for i in range(len(card_log_list) - 1):
            current_log = card_log_list[i]
            next_log = card_log_list[i + 1]

            if current_log.door_area_id == next_log.door_area_id:
                continue

            time_diff = next_log.swipe_time - current_log.swipe_time
            if time_diff <= time_window:
                first_door = db.query(DoorArea).filter(DoorArea.id == current_log.door_area_id).first()
                second_door = db.query(DoorArea).filter(DoorArea.id == next_log.door_area_id).first()

                employee = get_employee_by_card_number(db, card_number)

                anomaly = AnomalyRecord(
                    task_id=task_id,
                    card_number=card_number,
                    employee_id=employee.employee_id if employee else None,
                    employee_name=employee.name if employee else None,
                    first_log_id=current_log.id,
                    second_log_id=next_log.id,
                    first_door_area=first_door.name if first_door else "Unknown",
                    second_door_area=second_door.name if second_door else "Unknown",
                    first_swipe_time=current_log.swipe_time,
                    second_swipe_time=next_log.swipe_time,
                    time_diff_minutes=time_diff.total_seconds() / 60,
                    status="pending"
                )
                db.add(anomaly)
                anomaly_count += 1

    task.completed_at = datetime.utcnow()
    task.status = "completed"
    task.total_anomalies = anomaly_count
    db.commit()

    return anomaly_count


def update_anomaly_status(
    db: Session,
    anomaly_id: int,
    new_status: str,
    handler: str,
    remark: str = None
) -> AnomalyRecord:
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        return None

    if anomaly.status == "closed":
        raise ValueError("Cannot modify closed anomaly")

    if anomaly.current_handler and anomaly.current_handler != handler:
        raise ValueError(f"Anomaly is being handled by {anomaly.current_handler}")

    old_status = anomaly.status
    anomaly.status = new_status
    anomaly.current_handler = handler
    anomaly.updated_at = datetime.utcnow()

    history = AnomalyHistory(
        anomaly_id=anomaly_id,
        action="status_update",
        old_status=old_status,
        new_status=new_status,
        handler=handler,
        remark=remark
    )
    db.add(history)
    db.commit()
    db.refresh(anomaly)

    return anomaly


def correct_anomaly(
    db: Session,
    anomaly_id: int,
    conclusion: str,
    is_anomaly: bool,
    handler: str,
    remark: str = None
) -> AnomalyRecord:
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        return None

    if anomaly.status == "closed":
        raise ValueError("Cannot modify closed anomaly")

    if anomaly.current_handler and anomaly.current_handler != handler:
        raise ValueError(f"Anomaly is being handled by {anomaly.current_handler}")

    old_status = anomaly.status
    anomaly.status = "corrected"
    anomaly.final_conclusion = conclusion
    anomaly.is_confirmed_anomaly = is_anomaly
    anomaly.current_handler = handler
    anomaly.updated_at = datetime.utcnow()

    history = AnomalyHistory(
        anomaly_id=anomaly_id,
        action="correct",
        old_status=old_status,
        new_status="corrected",
        handler=handler,
        remark=remark or conclusion
    )
    db.add(history)
    db.commit()
    db.refresh(anomaly)

    return anomaly


def close_anomaly(
    db: Session,
    anomaly_id: int,
    reason: str,
    handler: str
) -> AnomalyRecord:
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        return None

    if anomaly.status == "closed":
        raise ValueError("Anomaly is already closed")

    old_status = anomaly.status
    anomaly.status = "closed"
    anomaly.close_reason = reason
    anomaly.closed_by = handler
    anomaly.closed_at = datetime.utcnow()
    anomaly.updated_at = datetime.utcnow()

    history = AnomalyHistory(
        anomaly_id=anomaly_id,
        action="close",
        old_status=old_status,
        new_status="closed",
        handler=handler,
        remark=reason
    )
    db.add(history)
    db.commit()
    db.refresh(anomaly)

    return anomaly


def get_anomalies(
    db: Session,
    status: str = None,
    card_number: str = None,
    page: int = 1,
    page_size: int = 20
):
    query = db.query(AnomalyRecord)

    if status:
        query = query.filter(AnomalyRecord.status == status)
    if card_number:
        query = query.filter(AnomalyRecord.card_number == card_number)

    total = query.count()
    items = query.order_by(AnomalyRecord.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items
    }


def export_anomalies_to_csv(db: Session, status: str = None) -> str:
    query = db.query(AnomalyRecord)
    if status:
        query = query.filter(AnomalyRecord.status == status)

    anomalies = query.order_by(AnomalyRecord.created_at.desc()).all()

    csv_lines = [
        "ID,卡号,员工ID,员工姓名,第一门区,第二门区,第一次刷卡时间,第二次刷卡时间,时间差(分钟),状态,处理人,结论,是否异常,关闭原因,创建时间"
    ]

    for a in anomalies:
        line = (
            f"{a.id},"
            f"{a.card_number},"
            f"{a.employee_id or ''},"
            f"{a.employee_name or ''},"
            f"{a.first_door_area},"
            f"{a.second_door_area},"
            f"{a.first_swipe_time},"
            f"{a.second_swipe_time},"
            f"{a.time_diff_minutes:.2f},"
            f"{a.status},"
            f"{a.current_handler or ''},"
            f"{(a.final_conclusion or '').replace(',', ';')},"
            f"{a.is_confirmed_anomaly or ''},"
            f"{(a.close_reason or '').replace(',', ';')},"
            f"{a.created_at}"
        )
        csv_lines.append(line)

    return "\n".join(csv_lines)


def create_detection_task(db: Session, task: schemas.DetectionTaskCreate) -> DetectionTask:
    db_task = DetectionTask(
        name=task.name,
        time_window_minutes=task.time_window_minutes,
        created_by=task.created_by,
        status="pending"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
