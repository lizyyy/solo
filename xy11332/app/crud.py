from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import uuid
from typing import List, Optional
from .models import (
    Patient, Escort, Task, AuditLog, BatchOperation, BatchResult,
    TaskStatus, PatientPriority, AuditAction
)
from .schemas import (
    PatientCreate, EscortCreate, TaskCreate, TaskAssign, TaskTransfer, TaskCancel,
    BatchOperationResult, BatchResultItem
)
from .rules import (
    rule_engine, CancellationBackfillRule, TransferTrailRule, TimeoutRule
)


def generate_task_no() -> str:
    return f"TASK{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


def generate_batch_id() -> str:
    return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"


def create_patient(db: Session, patient: PatientCreate) -> Patient:
    db_patient = Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


def get_patient(db: Session, patient_id: int) -> Optional[Patient]:
    return db.query(Patient).filter(Patient.id == patient_id).first()


def get_patients(db: Session, skip: int = 0, limit: int = 100) -> List[Patient]:
    return db.query(Patient).offset(skip).limit(limit).all()


def create_escort(db: Session, escort: EscortCreate) -> Escort:
    db_escort = Escort(**escort.model_dump())
    db.add(db_escort)
    db.commit()
    db.refresh(db_escort)
    return db_escort


def get_escort(db: Session, escort_id: int) -> Optional[Escort]:
    return db.query(Escort).filter(Escort.id == escort_id).first()


def get_escorts(db: Session, skip: int = 0, limit: int = 100, active_only: bool = True) -> List[Escort]:
    query = db.query(Escort)
    if active_only:
        query = query.filter(Escort.is_active == True)
    return query.offset(skip).limit(limit).all()


def create_task(db: Session, task: TaskCreate) -> tuple[Task, List]:
    db_task = Task(
        **task.model_dump(),
        task_no=generate_task_no()
    )
    db.add(db_task)
    db.flush()

    audit_log = AuditLog(
        task_id=db_task.id,
        action=AuditAction.CREATED,
        new_status=TaskStatus.PENDING,
        operator="system",
        reason=f"任务创建成功，优先级：{task.priority}"
    )
    db.add(audit_log)

    validation_results = rule_engine.validate_assignment(db_task, 0, db)

    db.commit()
    db.refresh(db_task)
    return db_task, validation_results


def get_task(db: Session, task_id: int) -> Optional[Task]:
    return db.query(Task).filter(Task.id == task_id).first()


def get_task_by_no(db: Session, task_no: str) -> Optional[Task]:
    return db.query(Task).filter(Task.task_no == task_no).first()


def get_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    priority: Optional[PatientPriority] = None
) -> List[Task]:
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    return query.order_by(Task.priority.desc(), Task.created_at.asc()).offset(skip).limit(limit).all()


def assign_task(db: Session, task_id: int, escort_id: int) -> tuple[Optional[Task], List]:
    task = get_task(db, task_id)
    if not task:
        return None, []

    if task.status != TaskStatus.PENDING:
        return None, []

    validation_results = rule_engine.validate_assignment(task, escort_id, db)

    if not rule_engine.can_proceed(validation_results):
        return task, validation_results

    task.escort_id = escort_id
    task.status = TaskStatus.ASSIGNED
    task.assigned_at = datetime.now()

    audit_log = AuditLog(
        task_id=task.id,
        action=AuditAction.ASSIGNED,
        old_status=TaskStatus.PENDING,
        new_status=TaskStatus.ASSIGNED,
        new_escort_id=escort_id,
        operator="system",
        reason=f"分配任务给陪检员 ID: {escort_id}"
    )
    db.add(audit_log)
    db.commit()
    db.refresh(task)

    return task, validation_results


def accept_task(db: Session, task_id: int) -> Optional[Task]:
    task = get_task(db, task_id)
    if not task:
        return None

    if task.status != TaskStatus.ASSIGNED:
        return None

    timeout_rule = TimeoutRule()
    timeout_result = timeout_rule.apply(task, db)

    if not timeout_result.passed:
        return task

    task.status = TaskStatus.IN_PROGRESS
    task.accepted_at = datetime.now()

    audit_log = AuditLog(
        task_id=task.id,
        action=AuditAction.ACCEPTED,
        old_status=TaskStatus.ASSIGNED,
        new_status=TaskStatus.IN_PROGRESS,
        operator="escort",
        reason="陪检员已接单"
    )
    db.add(audit_log)
    db.commit()
    db.refresh(task)

    return task


def complete_task(db: Session, task_id: int) -> Optional[Task]:
    task = get_task(db, task_id)
    if not task:
        return None

    if task.status != TaskStatus.IN_PROGRESS:
        return None

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now()

    if task.started_at:
        wait_time = (task.completed_at - task.started_at).total_seconds() // 60
        task.wait_time = int(wait_time)

    audit_log = AuditLog(
        task_id=task.id,
        action=AuditAction.COMPLETED,
        old_status=TaskStatus.IN_PROGRESS,
        new_status=TaskStatus.COMPLETED,
        operator="escort",
        reason="陪检完成"
    )
    db.add(audit_log)
    db.commit()
    db.refresh(task)

    return task


def cancel_task(db: Session, task_id: int, reason: str) -> tuple[Optional[Task], List, List]:
    task = get_task(db, task_id)
    if not task:
        return None, [], []

    if task.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]:
        return None, [], []

    old_status = task.status
    task.status = TaskStatus.CANCELLED
    task.cancelled_at = datetime.now()
    task.reason = reason

    audit_log = AuditLog(
        task_id=task.id,
        action=AuditAction.CANCELLED,
        old_status=old_status,
        new_status=TaskStatus.CANCELLED,
        operator="service_desk",
        reason=f"取消原因：{reason}"
    )
    db.add(audit_log)
    db.commit()

    cancellation_rule = CancellationBackfillRule()
    backfill_result, backfilled_tasks = cancellation_rule.apply(task, db)

    db.refresh(task)
    return task, [backfill_result], backfilled_tasks


def transfer_task(db: Session, task_id: int, new_escort_id: int, reason: str, operator: str = "service_desk") -> tuple[Optional[Task], List]:
    task = get_task(db, task_id)
    if not task:
        return None, []

    transfer_rule = TransferTrailRule()
    result = transfer_rule.apply(task, new_escort_id, reason, operator, db)

    db.refresh(task)
    return task, [result]


def get_task_audit_logs(db: Session, task_id: int) -> List[AuditLog]:
    return db.query(AuditLog).filter(AuditLog.task_id == task_id).order_by(AuditLog.created_at.desc()).all()


def batch_create_tasks(db: Session, tasks_data: List[TaskCreate]) -> BatchOperationResult:
    batch_id = generate_batch_id()
    batch_op = BatchOperation(
        batch_id=batch_id,
        operation_type="create_tasks",
        total_count=len(tasks_data)
    )
    db.add(batch_op)

    results = []
    success_count = 0
    failed_count = 0

    for task_data in tasks_data:
        try:
            task, _ = create_task(db, task_data)
            result = BatchResultItem(
                task_no=task.task_no,
                success=True,
                error_message=None
            )
            results.append(result)
            success_count += 1

            batch_result = BatchResult(
                batch_id=batch_id,
                task_no=task.task_no,
                success=True
            )
            db.add(batch_result)
        except Exception as e:
            result = BatchResultItem(
                task_no="",
                success=False,
                error_message=str(e)
            )
            results.append(result)
            failed_count += 1

    batch_op.success_count = success_count
    batch_op.failed_count = failed_count
    batch_op.completed_at = datetime.now()
    db.commit()

    return BatchOperationResult(
        batch_id=batch_id,
        total_count=len(tasks_data),
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


def batch_assign_tasks(db: Session, task_ids: List[int], escort_id: int) -> BatchOperationResult:
    batch_id = generate_batch_id()
    batch_op = BatchOperation(
        batch_id=batch_id,
        operation_type="assign_tasks",
        total_count=len(task_ids)
    )
    db.add(batch_op)

    results = []
    success_count = 0
    failed_count = 0

    for task_id in task_ids:
        try:
            task = get_task(db, task_id)
            if not task:
                result = BatchResultItem(
                    task_no="",
                    success=False,
                    error_message=f"任务 ID {task_id} 不存在"
                )
                results.append(result)
                failed_count += 1
                continue

            task_no = task.task_no

            if task.status != TaskStatus.PENDING:
                result = BatchResultItem(
                    task_no=task_no,
                    success=False,
                    error_message=f"任务 {task_no} 状态不是待分配"
                )
                results.append(result)
                failed_count += 1
                continue

            assigned_task, validation_results = assign_task(db, task_id, escort_id)

            if not rule_engine.can_proceed(validation_results):
                blocking_reasons = rule_engine.get_blocking_reasons(validation_results)
                result = BatchResultItem(
                    task_no=task_no,
                    success=False,
                    error_message="; ".join(blocking_reasons)
                )
                results.append(result)
                failed_count += 1
                continue

            result = BatchResultItem(
                task_no=task_no,
                success=True,
                error_message=None
            )
            results.append(result)
            success_count += 1

            batch_result = BatchResult(
                batch_id=batch_id,
                task_no=task_no,
                success=True
            )
            db.add(batch_result)

        except Exception as e:
            result = BatchResultItem(
                task_no="",
                success=False,
                error_message=str(e)
            )
            results.append(result)
            failed_count += 1

    batch_op.success_count = success_count
    batch_op.failed_count = failed_count
    batch_op.completed_at = datetime.now()
    db.commit()

    return BatchOperationResult(
        batch_id=batch_id,
        total_count=len(task_ids),
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


def get_statistics(db: Session):
    total_tasks = db.query(func.count(Task.id)).scalar()
    pending_tasks = db.query(func.count(Task.id)).filter(Task.status == TaskStatus.PENDING).scalar()
    completed_tasks = db.query(func.count(Task.id)).filter(Task.status == TaskStatus.COMPLETED).scalar()
    avg_wait_time = db.query(func.avg(Task.wait_time)).filter(Task.wait_time > 0).scalar()

    return {
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "completed_tasks": completed_tasks,
        "avg_wait_time": round(avg_wait_time or 0, 2)
    }