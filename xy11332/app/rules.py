from typing import List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from .models import Task, TaskStatus, PatientPriority, Escort, AuditLog, AuditAction
from .schemas import RuleResult


class BaseRule:
    name = "base_rule"
    description = "基础规则"

    def apply(self, task: Task, db: Session) -> RuleResult:
        raise NotImplementedError


class EmergencyPriorityRule(BaseRule):
    name = "emergency_priority"
    description = "急诊优先规则：急诊/紧急患者优先分配，普通患者排队"

    def apply(self, task: Task, db: Session) -> RuleResult:
        if task.priority == PatientPriority.EMERGENCY:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message="急诊患者，优先分配",
                suggestion="立即安排可用陪检员"
            )
        elif task.priority == PatientPriority.URGENT:
            pending_normal = db.query(Task).filter(
                Task.status == TaskStatus.PENDING,
                Task.priority == PatientPriority.NORMAL
            ).count()
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message=f"紧急患者，排队在 {pending_normal} 名普通患者之前",
                suggestion="尽快安排陪检员"
            )
        return RuleResult(
            passed=True,
            rule_name=self.name,
            message="普通患者，按顺序排队"
        )


class EscortCapacityRule(BaseRule):
    name = "escort_capacity"
    description = "陪检员容量规则：检查陪检员是否达到最大任务数"

    def apply(self, task: Task, db: Session, escort_id: int = None) -> RuleResult:
        if not escort_id and not task.escort_id:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message="未指定陪检员，跳过容量检查"
            )

        target_escort_id = escort_id or task.escort_id
        escort = db.query(Escort).filter(Escort.id == target_escort_id).first()

        if not escort:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message=f"陪检员 ID {target_escort_id} 不存在",
                suggestion="请选择有效的陪检员"
            )

        if not escort.is_active:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message=f"陪检员 {escort.name} 已离职/停用",
                suggestion="请选择在职的陪检员"
            )

        active_tasks = db.query(Task).filter(
            Task.escort_id == target_escort_id,
            Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
        ).count()

        if active_tasks >= escort.max_tasks:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message=f"陪检员 {escort.name} 已达最大任务数 {escort.max_tasks}",
                suggestion=f"当前已承担 {active_tasks} 项任务，请选择其他陪检员或等待"
            )

        return RuleResult(
            passed=True,
            rule_name=self.name,
            message=f"陪检员 {escort.name} 可承接任务（当前 {active_tasks}/{escort.max_tasks}）"
        )


class CancellationBackfillRule(BaseRule):
    name = "cancellation_backfill"
    description = "取消补位规则：任务取消后，自动补位下一个排队任务"

    def apply(self, cancelled_task: Task, db: Session) -> Tuple[RuleResult, List[Task]]:
        if cancelled_task.status != TaskStatus.CANCELLED:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message="任务未取消，无需补位"
            ), []

        escort_id = cancelled_task.escort_id
        if not escort_id:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message="任务未分配陪检员，无空位可补"
            ), []

        escort = db.query(Escort).filter(Escort.id == escort_id).first()
        if not escort:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message="原陪检员不存在"
            ), []

        pending_tasks = db.query(Task).filter(
            Task.status == TaskStatus.PENDING
        ).order_by(
            Task.priority.desc(),
            Task.created_at.asc()
        ).all()

        backfilled = []
        for task in pending_tasks:
            active_tasks = db.query(Task).filter(
                Task.escort_id == escort_id,
                Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS])
            ).count()

            if active_tasks < escort.max_tasks:
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
                    reason=f"任务 {cancelled_task.task_no} 取消，自动补位"
                )
                db.add(audit_log)
                backfilled.append(task)
            else:
                break

        db.commit()

        if backfilled:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message=f"已自动补位 {len(backfilled)} 个任务"
            ), backfilled

        return RuleResult(
            passed=True,
            rule_name=self.name,
            message="无待分配任务可补位"
        ), []


class TransferTrailRule(BaseRule):
    name = "transfer_trail"
    description = "转派留痕规则：记录所有转派操作的完整信息"

    def apply(self, task: Task, new_escort_id: int, reason: str, operator: str, db: Session) -> RuleResult:
        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message="只有已分配或进行中的任务可以转派",
                suggestion="请检查任务状态"
            )

        old_escort_id = task.escort_id
        old_escort = db.query(Escort).filter(Escort.id == old_escort_id).first()
        new_escort = db.query(Escort).filter(Escort.id == new_escort_id).first()

        if not new_escort:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message="目标陪检员不存在",
                suggestion="请选择有效的陪检员"
            )

        if not new_escort.is_active:
            return RuleResult(
                passed=False,
                rule_name=self.name,
                message=f"目标陪检员 {new_escort.name} 已停用",
                suggestion="请选择在职的陪检员"
            )

        capacity_rule = EscortCapacityRule()
        capacity_result = capacity_rule.apply(task, db, new_escort_id)
        if not capacity_result.passed:
            return capacity_result

        audit_log = AuditLog(
            task_id=task.id,
            action=AuditAction.TRANSFERRED,
            old_status=task.status,
            new_status=TaskStatus.ASSIGNED,
            old_escort_id=old_escort_id,
            new_escort_id=new_escort_id,
            operator=operator,
            reason=f"从 {old_escort.name if old_escort else '未指定'} 转派至 {new_escort.name}：{reason}"
        )
        db.add(audit_log)

        task.escort_id = new_escort_id
        task.status = TaskStatus.TRANSFERRED
        db.commit()

        return RuleResult(
            passed=True,
            rule_name=self.name,
            message=f"转派成功，已从 {old_escort.name if old_escort else '未指定'} 转派至 {new_escort.name}"
        )


class TimeoutRule(BaseRule):
    name = "timeout"
    description = "超时规则：检查任务是否超时，自动标记并重新分配"

    def apply(self, task: Task, db: Session) -> RuleResult:
        if task.status != TaskStatus.ASSIGNED:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message="非已分配状态，跳过超时检查"
            )

        if not task.assigned_at:
            return RuleResult(
                passed=True,
                rule_name=self.name,
                message="未记录分配时间，无法检查超时"
            )

        timeout_at = task.assigned_at + timedelta(minutes=task.timeout_minutes)
        now = datetime.now(timeout_at.tzinfo)

        if now >= timeout_at:
            task.status = TaskStatus.TIMEOUT

            audit_log = AuditLog(
                task_id=task.id,
                action=AuditAction.TIMEOUT,
                old_status=TaskStatus.ASSIGNED,
                new_status=TaskStatus.TIMEOUT,
                old_escort_id=task.escort_id,
                operator="system",
                reason=f"任务分配后 {task.timeout_minutes} 分钟未接单，系统自动标记超时"
            )
            db.add(audit_log)
            db.commit()

            return RuleResult(
                passed=False,
                rule_name=self.name,
                message=f"任务已超时（分配于 {task.assigned_at.strftime('%Y-%m-%d %H:%M')}）",
                suggestion="请重新分配或取消任务"
            )

        remaining = (timeout_at - now).total_seconds() // 60
        return RuleResult(
            passed=True,
            rule_name=self.name,
            message=f"任务正常，剩余 {int(remaining)} 分钟超时"
        )


class RuleEngine:
    def __init__(self):
        self.rules = [
            EmergencyPriorityRule(),
            EscortCapacityRule(),
        ]

    def validate_assignment(self, task: Task, escort_id: int, db: Session) -> List[RuleResult]:
        results = []

        emergency_rule = EmergencyPriorityRule()
        results.append(emergency_rule.apply(task, db))

        capacity_rule = EscortCapacityRule()
        results.append(capacity_rule.apply(task, db, escort_id))

        return results

    def can_proceed(self, results: List[RuleResult]) -> bool:
        return all(r.passed for r in results)

    def get_blocking_reasons(self, results: List[RuleResult]) -> List[str]:
        return [f"{r.rule_name}: {r.message}" for r in results if not r.passed]


rule_engine = RuleEngine()