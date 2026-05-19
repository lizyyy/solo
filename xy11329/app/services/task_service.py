from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models import (
    Task, Patient, Escort, AuditLog,
    TaskStatus, TaskPriority, OperationType, ExceptionType, Role
)
from app.config import TASK_TIMEOUT_MINUTES


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def _create_patient(
        self,
        name: str,
        medical_record_no: Optional[str] = None,
        phone: Optional[str] = None,
        department: Optional[str] = None,
        bed_no: Optional[str] = None,
    ) -> Patient:
        patient = Patient(
            name=name,
            medical_record_no=medical_record_no,
            phone=phone,
            department=department,
            bed_no=bed_no,
        )
        self.db.add(patient)
        self.db.flush()
        return patient

    def _get_or_create_patient(
        self,
        name: str,
        medical_record_no: Optional[str] = None,
        **kwargs
    ) -> Patient:
        if medical_record_no:
            patient = self.db.query(Patient).filter(
                Patient.medical_record_no == medical_record_no
            ).first()
            if patient:
                return patient
        return self._create_patient(name=name, medical_record_no=medical_record_no, **kwargs)

    def _create_audit_log(
        self,
        task_id: int,
        operation_type: OperationType,
        operator_role: str,
        operator_name: str,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        old_escort_id: Optional[int] = None,
        new_escort_id: Optional[int] = None,
        note: Optional[str] = None,
    ) -> AuditLog:
        audit_log = AuditLog(
            task_id=task_id,
            operation_type=operation_type,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=new_status,
            old_escort_id=old_escort_id,
            new_escort_id=new_escort_id,
            note=note,
        )
        self.db.add(audit_log)
        return audit_log

    def _update_queue_positions(self, task_id: Optional[int] = None):
        pending_tasks = self.db.query(Task).filter(
            Task.status.in_([TaskStatus.PENDING, TaskStatus.ASSIGNED])
        ).order_by(
            Task.priority.desc(),
            Task.created_at.asc()
        ).all()
        
        for idx, task in enumerate(pending_tasks, 1):
            task.queue_position = idx

    def create_task(
        self,
        request_id: str,
        patient_name: str,
        patient_medical_record_no: Optional[str] = None,
        patient_phone: Optional[str] = None,
        patient_department: Optional[str] = None,
        patient_bed_no: Optional[str] = None,
        service_type: Optional[str] = None,
        from_location: Optional[str] = None,
        to_location: Optional[str] = None,
        description: Optional[str] = None,
        priority: TaskPriority = TaskPriority.NORMAL,
        operator_role: str = Role.DISPATCHER,
        operator_name: str = "System",
    ) -> Tuple[Optional[Task], str]:
        existing_task = self.db.query(Task).filter(Task.request_id == request_id).first()
        if existing_task:
            return existing_task, "duplicate"

        patient = self._get_or_create_patient(
            name=patient_name,
            medical_record_no=patient_medical_record_no,
            phone=patient_phone,
            department=patient_department,
            bed_no=patient_bed_no,
        )

        task = Task(
            request_id=request_id,
            patient_id=patient.id,
            status=TaskStatus.PENDING,
            priority=priority,
            service_type=service_type,
            from_location=from_location,
            to_location=to_location,
            description=description,
            operator_role=operator_role,
            operator_name=operator_name,
        )
        self.db.add(task)
        self.db.flush()

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.CREATE,
            operator_role=operator_role,
            operator_name=operator_name,
            new_status=TaskStatus.PENDING,
            note="任务创建成功",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "created"

    def assign_task(
        self,
        task_id: int,
        escort_id: int,
        operator_role: str,
        operator_name: str,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        escort = self.db.query(Escort).filter(Escort.id == escort_id).first()
        if not escort or not escort.is_active:
            return None, "escort_not_found"

        if task.status not in [TaskStatus.PENDING, TaskStatus.ASSIGNED]:
            return task, "invalid_status"

        old_status = task.status
        old_escort_id = task.assigned_escort_id

        task.status = TaskStatus.ASSIGNED
        task.assigned_escort_id = escort_id
        task.assigned_at = datetime.now()
        task.operator_role = operator_role
        task.operator_name = operator_name

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.ASSIGN,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=TaskStatus.ASSIGNED,
            old_escort_id=old_escort_id,
            new_escort_id=escort_id,
            note=f"派单给陪检员: {escort.name}",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "assigned"

    def accept_task(
        self,
        task_id: int,
        operator_role: str,
        operator_name: str,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        if task.status == TaskStatus.ACCEPTED:
            return task, "duplicate"

        if task.status != TaskStatus.ASSIGNED:
            return task, "invalid_status"

        old_status = task.status

        task.status = TaskStatus.ACCEPTED
        task.accepted_at = datetime.now()
        task.operator_role = operator_role
        task.operator_name = operator_name

        if task.created_at and task.accepted_at:
            task.wait_duration = int((task.accepted_at - task.created_at).total_seconds() // 60)

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.ACCEPT,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=TaskStatus.ACCEPTED,
            note="陪检员接单成功",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "accepted"

    def transfer_task(
        self,
        task_id: int,
        new_escort_id: int,
        operator_role: str,
        operator_name: str,
        note: Optional[str] = None,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        new_escort = self.db.query(Escort).filter(Escort.id == new_escort_id).first()
        if not new_escort or not new_escort.is_active:
            return None, "escort_not_found"

        if task.assigned_escort_id == new_escort_id:
            return task, "same_escort"

        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED]:
            return task, "invalid_status"

        old_escort_id = task.assigned_escort_id
        old_status = task.status

        task.assigned_escort_id = new_escort_id
        task.assigned_at = datetime.now()
        task.status = TaskStatus.ASSIGNED
        task.accepted_at = None
        task.operator_role = operator_role
        task.operator_name = operator_name

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.TRANSFER,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=TaskStatus.ASSIGNED,
            old_escort_id=old_escort_id,
            new_escort_id=new_escort_id,
            note=note or f"转派给陪检员: {new_escort.name}",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "transferred"

    def complete_task(
        self,
        task_id: int,
        operator_role: str,
        operator_name: str,
        completion_note: Optional[str] = None,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        if task.status == TaskStatus.COMPLETED:
            return task, "duplicate"

        if task.status not in [TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS]:
            return task, "invalid_status"

        old_status = task.status

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        task.operator_role = operator_role
        task.operator_name = operator_name

        if task.accepted_at and task.completed_at:
            task.service_duration = int((task.completed_at - task.accepted_at).total_seconds() // 60)
        if task.created_at and task.completed_at:
            task.total_duration = int((task.completed_at - task.created_at).total_seconds() // 60)

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.COMPLETE,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=TaskStatus.COMPLETED,
            note=completion_note or "任务完成",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "completed"

    def cancel_task(
        self,
        task_id: int,
        operator_role: str,
        operator_name: str,
        cancel_reason: Optional[str] = None,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        if task.status == TaskStatus.CANCELLED:
            return task, "duplicate"

        if task.status == TaskStatus.COMPLETED:
            return task, "already_completed"

        old_status = task.status

        task.status = TaskStatus.CANCELLED
        task.cancelled_at = datetime.now()
        task.has_exception = True
        task.exception_type = ExceptionType.CANCELLED
        task.exception_note = cancel_reason
        task.operator_role = operator_role
        task.operator_name = operator_name

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.CANCEL,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_status,
            new_status=TaskStatus.CANCELLED,
            note=cancel_reason or "任务取消",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "cancelled"

    def check_timeout(self, task_id: int) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        if task.status == TaskStatus.TIMEOUT:
            return task, "duplicate"

        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED]:
            return task, "invalid_status"

        if not task.assigned_at:
            return task, "no_assign_time"

        timeout_time = task.assigned_at + timedelta(minutes=TASK_TIMEOUT_MINUTES)
        if datetime.now() < timeout_time:
            return task, "not_timeout"

        old_status = task.status
        task.status = TaskStatus.TIMEOUT
        task.timeout_at = datetime.now()
        task.has_exception = True
        task.exception_type = ExceptionType.TIMEOUT

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.TIMEOUT,
            operator_role=Role.ADMIN,
            operator_name="System",
            old_status=old_status,
            new_status=TaskStatus.TIMEOUT,
            note=f"任务超时（{TASK_TIMEOUT_MINUTES}分钟）",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "timeout"

    def update_priority(
        self,
        task_id: int,
        new_priority: TaskPriority,
        operator_role: str,
        operator_name: str,
        note: Optional[str] = None,
    ) -> Tuple[Optional[Task], str]:
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None, "task_not_found"

        if task.priority == new_priority:
            return task, "same_priority"

        if task.status not in [TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.ACCEPTED]:
            return task, "invalid_status"

        old_priority = task.priority
        task.priority = new_priority

        self._update_queue_positions()

        self._create_audit_log(
            task_id=task.id,
            operation_type=OperationType.UPDATE_PRIORITY,
            operator_role=operator_role,
            operator_name=operator_name,
            old_status=old_priority,
            new_status=new_priority,
            note=note or f"优先级从 {old_priority} 调整为 {new_priority}",
        )

        self.db.commit()
        self.db.refresh(task)
        return task, "priority_updated"

    def get_task(self, task_id: int) -> Optional[Task]:
        return self.db.query(Task).filter(Task.id == task_id).first()

    def get_task_by_request_id(self, request_id: str) -> Optional[Task]:
        return self.db.query(Task).filter(Task.request_id == request_id).first()

    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        escort_id: Optional[int] = None,
        priority: Optional[TaskPriority] = None,
        has_exception: Optional[bool] = None,
        exception_type: Optional[ExceptionType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Task]:
        query = self.db.query(Task)

        if status:
            query = query.filter(Task.status == status)
        if escort_id:
            query = query.filter(Task.assigned_escort_id == escort_id)
        if priority:
            query = query.filter(Task.priority == priority)
        if has_exception is not None:
            query = query.filter(Task.has_exception == has_exception)
        if exception_type:
            query = query.filter(Task.exception_type == exception_type)
        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)

        query = query.order_by(Task.created_at.desc())
        return query.offset(skip).limit(limit).all()

    def get_audit_logs(self, task_id: Optional[int] = None, limit: int = 100) -> List[AuditLog]:
        query = self.db.query(AuditLog)
        if task_id:
            query = query.filter(AuditLog.task_id == task_id)
        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
