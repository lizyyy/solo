import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from models import (
    Patient, Escort, InspectionTask, TaskHistory, TransferRecord,
    DailyStatistics, TaskStatus, Priority
)
from database import get_session


class OperationResult:
    def __init__(self, success: bool, message: str, data: Any = None, reason: str = None):
        self.success = success
        self.message = message
        self.data = data
        self.reason = reason

    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "message": self.message,
            "data": self.data,
            "reason": self.reason
        }


class ClinicService:
    def __init__(self, session: Session = None):
        self.session = session or get_session().__enter__()

    def _generate_idempotency_key(self, **kwargs) -> str:
        sorted_items = sorted(kwargs.items())
        key_str = json.dumps(sorted_items, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()

    def _record_history(self, task: InspectionTask, action: str, reason: str = None,
                        details: Dict = None, operator_type: str = "system", operator_id: str = None):
        history = TaskHistory(
            task_id=task.id,
            action=action,
            from_status=task.status,
            to_status=task.status,
            operator_type=operator_type,
            operator_id=operator_id,
            reason=reason,
            details=json.dumps(details) if details else None
        )
        self.session.add(history)
        self.session.flush()

    def _update_status_with_history(self, task: InspectionTask, new_status: str, action: str,
                                     reason: str = None, details: Dict = None,
                                     operator_type: str = "system", operator_id: str = None):
        from_status = task.status
        task.status = new_status
        history = TaskHistory(
            task_id=task.id,
            action=action,
            from_status=from_status,
            to_status=new_status,
            operator_type=operator_type,
            operator_id=operator_id,
            reason=reason,
            details=json.dumps(details) if details else None
        )
        self.session.add(history)
        self.session.flush()

    def create_patient(self, patient_id: str, name: str, age: int = None, gender: str = None,
                       department: str = None, bed_number: str = None) -> OperationResult:
        existing = self.session.query(Patient).filter_by(patient_id=patient_id).first()
        if existing:
            return OperationResult(
                success=True,
                message="患者已存在，返回已有数据",
                data={"id": existing.id, "patient_id": existing.patient_id, "name": existing.name},
                reason="幂等处理：患者ID已存在"
            )

        patient = Patient(
            patient_id=patient_id,
            name=name,
            age=age,
            gender=gender,
            department=department,
            bed_number=bed_number
        )
        self.session.add(patient)
        self.session.flush()
        return OperationResult(
            success=True,
            message="患者创建成功",
            data={"id": patient.id, "patient_id": patient_id, "name": name}
        )

    def create_escort(self, escort_id: str, name: str, phone: str = None,
                      max_tasks: int = 3) -> OperationResult:
        existing = self.session.query(Escort).filter_by(escort_id=escort_id).first()
        if existing:
            return OperationResult(
                success=True,
                message="陪检员已存在，返回已有数据",
                data={"id": existing.id, "escort_id": existing.escort_id, "name": existing.name},
                reason="幂等处理：陪检员ID已存在"
            )

        escort = Escort(
            escort_id=escort_id,
            name=name,
            phone=phone,
            max_tasks=max_tasks
        )
        self.session.add(escort)
        self.session.flush()
        return OperationResult(
            success=True,
            message="陪检员创建成功",
            data={"id": escort.id, "escort_id": escort_id, "name": name}
        )

    def _find_best_escort(self, priority: str) -> Optional[Escort]:
        query = self.session.query(Escort).filter_by(status="available")

        if priority == Priority.EMERGENCY.value:
            query = query.order_by(Escort.current_task_count.asc(), Escort.total_completed.desc())
        else:
            query = query.order_by(Escort.current_task_count.asc(), Escort.total_completed.desc())

        escorts = query.all()
        for escort in escorts:
            if escort.current_task_count < escort.max_tasks:
                return escort
        return None

    def create_task(self, task_id: str, patient_id: str, inspection_type: str,
                    inspection_location: str = None, priority: str = Priority.NORMAL.value,
                    estimated_duration: int = 30, idempotency_key: str = None) -> OperationResult:
        if not idempotency_key:
            idempotency_key = self._generate_idempotency_key(
                task_id=task_id, patient_id=patient_id,
                inspection_type=inspection_type, action="create"
            )

        existing_task = self.session.query(InspectionTask).filter_by(
            request_idempotency_key=idempotency_key
        ).first()
        if existing_task:
            return OperationResult(
                success=True,
                message="任务已存在，返回已有数据",
                data={"task_id": existing_task.task_id, "status": existing_task.status},
                reason="幂等处理：请求已处理过"
            )

        patient = self.session.query(Patient).filter_by(patient_id=patient_id).first()
        if not patient:
            return OperationResult(
                success=False,
                message="患者不存在",
                reason=f"患者ID {patient_id} 未找到"
            )

        task = InspectionTask(
            task_id=task_id,
            patient_id=patient.id,
            inspection_type=inspection_type,
            inspection_location=inspection_location,
            priority=priority,
            estimated_duration=estimated_duration,
            request_idempotency_key=idempotency_key
        )
        self.session.add(task)
        self.session.flush()
        self._record_history(task, "CREATE", "任务创建成功", {"priority": priority})

        return OperationResult(
            success=True,
            message="任务创建成功",
            data={"task_id": task_id, "status": TaskStatus.PENDING.value, "priority": priority}
        )

    def assign_task(self, task_id: str, escort_id: str = None,
                    operator_id: str = None) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        if task.status not in [TaskStatus.PENDING.value, TaskStatus.CANCELLED.value]:
            return OperationResult(
                success=False,
                message="任务状态不允许派单",
                reason=f"当前状态 {task.status}，仅 pending 或 cancelled 状态可派单"
            )

        if escort_id:
            escort = self.session.query(Escort).filter_by(escort_id=escort_id).first()
            if not escort:
                return OperationResult(
                    success=False,
                    message="陪检员不存在",
                    reason=f"陪检员ID {escort_id} 未找到"
                )
            if escort.current_task_count >= escort.max_tasks:
                return OperationResult(
                    success=False,
                    message="陪检员任务已满",
                    reason=f"陪检员 {escort.name} 当前任务数已达上限 {escort.max_tasks}"
                )
        else:
            escort = self._find_best_escort(task.priority)
            if not escort:
                return OperationResult(
                    success=False,
                    message="无可用陪检员",
                    reason="当前没有可用的陪检员，请稍后重试"
                )

        task.assigned_escort_id = escort.id
        task.timeout_at = datetime.utcnow() + timedelta(minutes=30)
        escort.current_task_count += 1

        self._update_status_with_history(
            task, TaskStatus.ASSIGNED.value, "ASSIGN",
            reason=f"派单给陪检员 {escort.name}",
            details={"escort_id": escort.escort_id, "escort_name": escort.name},
            operator_type="dispatcher",
            operator_id=operator_id
        )

        return OperationResult(
            success=True,
            message="派单成功",
            data={"task_id": task_id, "escort_id": escort.escort_id, "escort_name": escort.name}
        )

    def accept_task(self, task_id: str, escort_id: str) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        escort = self.session.query(Escort).filter_by(escort_id=escort_id).first()
        if not escort:
            return OperationResult(
                success=False,
                message="陪检员不存在",
                reason=f"陪检员ID {escort_id} 未找到"
            )

        if task.assigned_escort_id != escort.id:
            return OperationResult(
                success=False,
                message="无权限接单",
                reason=f"任务 {task_id} 未派给陪检员 {escort_id}"
            )

        if task.status != TaskStatus.ASSIGNED.value:
            return OperationResult(
                success=False,
                message="任务状态不允许接单",
                reason=f"当前状态 {task.status}，仅 assigned 状态可接单"
            )

        task.accepted_at = datetime.utcnow()
        task.wait_time_seconds = int((task.accepted_at - task.created_at).total_seconds())

        self._update_status_with_history(
            task, TaskStatus.ACCEPTED.value, "ACCEPT",
            reason="陪检员确认接单",
            details={"escort_id": escort_id, "accepted_at": task.accepted_at.isoformat()},
            operator_type="escort",
            operator_id=escort_id
        )

        return OperationResult(
            success=True,
            message="接单成功",
            data={"task_id": task_id, "wait_time_seconds": task.wait_time_seconds}
        )

    def start_task(self, task_id: str, escort_id: str) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        if task.status != TaskStatus.ACCEPTED.value:
            return OperationResult(
                success=False,
                message="任务状态不允许开始",
                reason=f"当前状态 {task.status}，仅 accepted 状态可开始"
            )

        task.started_at = datetime.utcnow()
        self._update_status_with_history(
            task, TaskStatus.IN_PROGRESS.value, "START",
            reason="陪检员开始执行任务",
            operator_type="escort",
            operator_id=escort_id
        )

        return OperationResult(
            success=True,
            message="任务开始执行",
            data={"task_id": task_id, "started_at": task.started_at.isoformat()}
        )

    def complete_task(self, task_id: str, escort_id: str, actual_duration: int = None) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        if task.status not in [TaskStatus.IN_PROGRESS.value, TaskStatus.ACCEPTED.value]:
            return OperationResult(
                success=False,
                message="任务状态不允许完成",
                reason=f"当前状态 {task.status}，仅 in_progress 或 accepted 状态可完成"
            )

        task.completed_at = datetime.utcnow()
        if actual_duration:
            task.actual_duration_seconds = actual_duration
        elif task.started_at:
            task.actual_duration_seconds = int((task.completed_at - task.started_at).total_seconds())

        if task.assigned_escort_id:
            escort = self.session.query(Escort).filter_by(id=task.assigned_escort_id).first()
            if escort:
                escort.current_task_count -= 1
                escort.total_completed += 1

        self._update_status_with_history(
            task, TaskStatus.COMPLETED.value, "COMPLETE",
            reason="任务完成",
            details={"actual_duration_seconds": task.actual_duration_seconds},
            operator_type="escort",
            operator_id=escort_id
        )

        self._update_daily_statistics()

        return OperationResult(
            success=True,
            message="任务完成",
            data={"task_id": task_id, "actual_duration_seconds": task.actual_duration_seconds}
        )

    def cancel_task(self, task_id: str, reason: str, operator_id: str = None) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        if task.status in [TaskStatus.COMPLETED.value, TaskStatus.CANCELLED.value]:
            return OperationResult(
                success=False,
                message="任务已完成或已取消",
                reason=f"当前状态 {task.status}，无法取消"
            )

        if task.assigned_escort_id:
            escort = self.session.query(Escort).filter_by(id=task.assigned_escort_id).first()
            if escort:
                escort.current_task_count -= 1

        self._update_status_with_history(
            task, TaskStatus.CANCELLED.value, "CANCEL",
            reason=reason,
            operator_type="dispatcher",
            operator_id=operator_id
        )

        pending_tasks = self.session.query(InspectionTask).filter_by(
            status=TaskStatus.PENDING.value
        ).order_by(
            InspectionTask.priority.desc(),
            InspectionTask.created_at.asc()
        ).first()

        if pending_tasks:
            reassign_result = self.assign_task(pending_tasks.task_id, operator_id=operator_id)
            if reassign_result.success:
                self._record_history(
                    pending_tasks, "REASSIGN",
                    reason="取消补位：因其他任务取消，此任务获得优先派单"
                )

        return OperationResult(
            success=True,
            message="任务取消成功",
            data={"task_id": task_id, "cancelled_at": datetime.utcnow().isoformat()}
        )

    def transfer_task(self, task_id: str, from_escort_id: str, to_escort_id: str,
                      reason: str) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        from_escort = self.session.query(Escort).filter_by(escort_id=from_escort_id).first()
        to_escort = self.session.query(Escort).filter_by(escort_id=to_escort_id).first()

        if not from_escort or not to_escort:
            return OperationResult(
                success=False,
                message="陪检员不存在",
                reason="转出或转入陪检员ID无效"
            )

        if task.assigned_escort_id != from_escort.id:
            return OperationResult(
                success=False,
                message="无权限转派",
                reason=f"任务 {task_id} 未派给陪检员 {from_escort_id}"
            )

        if to_escort.current_task_count >= to_escort.max_tasks:
            return OperationResult(
                success=False,
                message="目标陪检员任务已满",
                reason=f"陪检员 {to_escort.name} 当前任务数已达上限"
            )

        from_escort.current_task_count -= 1
        to_escort.current_task_count += 1
        task.assigned_escort_id = to_escort.id

        transfer_record = TransferRecord(
            task_id=task.id,
            from_escort_id=from_escort.id,
            to_escort_id=to_escort.id,
            reason=reason
        )
        self.session.add(transfer_record)

        self._update_status_with_history(
            task, TaskStatus.ASSIGNED.value, "TRANSFER",
            reason=reason,
            details={
                "from_escort": from_escort_id,
                "to_escort": to_escort_id,
                "transfer_reason": reason
            },
            operator_type="dispatcher"
        )

        return OperationResult(
            success=True,
            message="转派成功",
            data={
                "task_id": task_id,
                "from_escort": from_escort.name,
                "to_escort": to_escort.name
            }
        )

    def get_task_history(self, task_id: str) -> OperationResult:
        task = self.session.query(InspectionTask).filter_by(task_id=task_id).first()
        if not task:
            return OperationResult(
                success=False,
                message="任务不存在",
                reason=f"任务ID {task_id} 未找到"
            )

        history_list = []
        for h in task.history:
            history_list.append({
                "action": h.action,
                "from_status": h.from_status,
                "to_status": h.to_status,
                "reason": h.reason,
                "operator_type": h.operator_type,
                "operator_id": h.operator_id,
                "created_at": h.created_at.isoformat()
            })

        return OperationResult(
            success=True,
            message="查询成功",
            data={
                "task_id": task_id,
                "current_status": task.status,
                "history": history_list
            }
        )

    def _update_daily_statistics(self):
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        stats = self.session.query(DailyStatistics).filter_by(date=today_str).first()

        if not stats:
            stats = DailyStatistics(date=today_str)
            self.session.add(stats)

        completed_tasks = self.session.query(InspectionTask).filter(
            InspectionTask.status == TaskStatus.COMPLETED.value,
            InspectionTask.completed_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).all()

        cancelled_tasks = self.session.query(InspectionTask).filter(
            InspectionTask.status == TaskStatus.CANCELLED.value
        ).count()

        emergency_tasks = self.session.query(InspectionTask).filter(
            InspectionTask.priority == Priority.EMERGENCY.value
        ).count()

        transfer_count = self.session.query(TransferRecord).filter(
            TransferRecord.transfer_time >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()

        wait_times = [t.wait_time_seconds for t in completed_tasks if t.wait_time_seconds]
        durations = [t.actual_duration_seconds for t in completed_tasks if t.actual_duration_seconds]

        stats.total_tasks = self.session.query(InspectionTask).count()
        stats.completed_tasks = len(completed_tasks)
        stats.cancelled_tasks = cancelled_tasks
        stats.emergency_tasks = emergency_tasks
        stats.total_transfers = transfer_count

        if wait_times:
            stats.avg_wait_time_seconds = sum(wait_times) / len(wait_times)
        if durations:
            stats.avg_completion_time_seconds = sum(durations) / len(durations)

    def get_daily_report(self, date_str: str = None) -> OperationResult:
        if not date_str:
            date_str = datetime.utcnow().strftime("%Y-%m-%d")

        stats = self.session.query(DailyStatistics).filter_by(date=date_str).first()

        if not stats:
            return OperationResult(
                success=True,
                message="当日无统计数据",
                data={"date": date_str, "message": "无数据"}
            )

        return OperationResult(
            success=True,
            message="统计报告生成成功",
            data={
                "date": stats.date,
                "total_tasks": stats.total_tasks,
                "completed_tasks": stats.completed_tasks,
                "cancelled_tasks": stats.cancelled_tasks,
                "timeout_tasks": stats.timeout_tasks,
                "emergency_tasks": stats.emergency_tasks,
                "avg_wait_time_minutes": round(stats.avg_wait_time_seconds / 60, 2) if stats.avg_wait_time_seconds else 0,
                "avg_completion_time_minutes": round(stats.avg_completion_time_seconds / 60, 2) if stats.avg_completion_time_seconds else 0,
                "total_transfers": stats.total_transfers
            }
        )

    def list_tasks(self, status: str = None, priority: str = None) -> OperationResult:
        query = self.session.query(InspectionTask)
        if status:
            query = query.filter_by(status=status)
        if priority:
            query = query.filter_by(priority=priority)

        tasks = query.order_by(InspectionTask.created_at.desc()).all()
        task_list = []
        for t in tasks:
            task_list.append({
                "task_id": t.task_id,
                "patient_name": t.patient.name if t.patient else None,
                "inspection_type": t.inspection_type,
                "priority": t.priority,
                "status": t.status,
                "escort_name": t.assigned_escort.name if t.assigned_escort else None,
                "created_at": t.created_at.isoformat()
            })

        return OperationResult(
            success=True,
            message="查询成功",
            data={"count": len(task_list), "tasks": task_list}
        )

    def close(self):
        try:
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
        finally:
            self.session.close()
