from typing import List, Optional
from datetime import datetime
from uuid import uuid4

from models import Task, TaskStatus, TaskPriority, ActionType, ActionLog, RuleResult, Escort
from storage import Storage


class RuleEngine:
    def __init__(self, storage: Storage):
        self.storage = storage

    def validate_create_task(self, task: Task) -> List[RuleResult]:
        results = []
        results.append(self._emergency_priority_rule(task))
        return results

    def validate_accept_task(self, task: Task, escort: Escort) -> List[RuleResult]:
        results = []
        results.append(self._task_pending_rule(task))
        results.append(self._escort_active_rule(escort))
        return results

    def validate_cancel_task(self, task: Task) -> List[RuleResult]:
        results = []
        results.append(self._task_not_completed_rule(task))
        return results

    def validate_reassign_task(self, task: Task, from_escort: Optional[Escort], to_escort: Escort) -> List[RuleResult]:
        results = []
        results.append(self._task_active_rule(task))
        results.append(self._escort_active_rule(to_escort))
        return results

    def validate_jump_queue(self, task: Task, target_position: int) -> List[RuleResult]:
        results = []
        results.append(self._task_pending_rule(task))
        results.append(self._emergency_jump_restriction(task, target_position))
        return results

    def _emergency_priority_rule(self, task: Task) -> RuleResult:
        if task.priority == TaskPriority.EMERGENCY:
            return RuleResult(
                passed=True,
                reason="急诊患者，自动提升为最高优先级，排在所有普通任务之前",
                rule_name="急诊优先规则"
            )
        return RuleResult(
            passed=True,
            reason="普通患者，按创建时间排队",
            rule_name="普通排队规则"
        )

    def _task_pending_rule(self, task: Task) -> RuleResult:
        if task.status == TaskStatus.PENDING:
            return RuleResult(
                passed=True,
                reason="任务处于待接单状态",
                rule_name="待接单校验"
            )
        return RuleResult(
            passed=False,
            reason=f"任务状态为{task.status.value}，无法执行此操作",
            rule_name="待接单校验"
        )

    def _task_active_rule(self, task: Task) -> RuleResult:
        active_statuses = [TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]
        if task.status in active_statuses:
            return RuleResult(
                passed=True,
                reason="任务处于活跃状态",
                rule_name="活跃状态校验"
            )
        return RuleResult(
            passed=False,
            reason=f"任务状态为{task.status.value}，无法执行此操作",
            rule_name="活跃状态校验"
        )

    def _task_not_completed_rule(self, task: Task) -> RuleResult:
        if task.status == TaskStatus.COMPLETED:
            return RuleResult(
                passed=False,
                reason="任务已完成，无法取消",
                rule_name="非完成状态校验"
            )
        return RuleResult(
            passed=True,
            reason="任务未完成，可以取消",
            rule_name="非完成状态校验"
        )

    def _escort_active_rule(self, escort: Escort) -> RuleResult:
        if escort.is_active:
            return RuleResult(
                passed=True,
                reason="陪检员处于在职状态",
                rule_name="陪检员在职校验"
            )
        return RuleResult(
            passed=False,
            reason="陪检员已离职，无法接单",
            rule_name="陪检员在职校验"
        )

    def _emergency_jump_restriction(self, task: Task, target_position: int) -> RuleResult:
        pending_tasks = self.storage.get_pending_tasks()
        emergency_before = sum(
            1 for t in pending_tasks
            if t.priority == TaskPriority.EMERGENCY and t.id != task.id and t.position < target_position
        )
        if task.priority != TaskPriority.EMERGENCY and emergency_before > 0:
            return RuleResult(
                passed=False,
                reason=f"存在{emergency_before}个急诊任务，普通任务无法插队到急诊任务之前",
                rule_name="急诊不可超越规则"
            )
        return RuleResult(
            passed=True,
            reason="插队位置合法",
            rule_name="急诊不可超越规则"
        )

    def all_passed(self, results: List[RuleResult]) -> bool:
        return all(r.passed for r in results)

    def get_failed_reasons(self, results: List[RuleResult]) -> List[str]:
        return [f"[{r.rule_name}] {r.reason}" for r in results if not r.passed]


class TaskService:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.rule_engine = RuleEngine(storage)

    def _create_action_log(self, task_id: str, action_type: ActionType, operator: str,
                           reason: str, success: bool = True,
                           from_escort_id: Optional[str] = None,
                           to_escort_id: Optional[str] = None) -> ActionLog:
        return ActionLog(
            id=str(uuid4()),
            task_id=task_id,
            action_type=action_type,
            operator=operator,
            timestamp=datetime.now(),
            reason=reason,
            from_escort_id=from_escort_id,
            to_escort_id=to_escort_id,
            success=success
        )

    def create_task(self, patient, is_emergency: bool = False, operator: str = "system"):
        from models import Task as TaskModel
        task = TaskModel(
            id=str(uuid4()),
            patient=patient,
            priority=TaskPriority.EMERGENCY if is_emergency else TaskPriority.NORMAL,
            status=TaskStatus.PENDING,
            created_at=datetime.now(),
            position=self.storage.get_next_position()
        )
        rule_results = self.rule_engine.validate_create_task(task)
        reason = "; ".join(r.reason for r in rule_results)
        log = self._create_action_log(task.id, ActionType.CREATE, operator, reason)
        task.action_logs.append(log)
        self.storage.save_task(task)
        return task, rule_results

    def accept_task(self, task_id: str, escort_id: str, operator: str) -> tuple:
        task = self.storage.get_task(task_id)
        escort = self.storage.get_escort(escort_id)
        if not task:
            return None, [RuleResult(False, "任务不存在", "存在性校验")], None
        if not escort:
            return None, [RuleResult(False, "陪检员不存在", "存在性校验")], None
        rule_results = self.rule_engine.validate_accept_task(task, escort)
        if not self.rule_engine.all_passed(rule_results):
            reason = "; ".join(self.rule_engine.get_failed_reasons(rule_results))
            log = self._create_action_log(task.id, ActionType.ACCEPT, operator, reason, success=False)
            self.storage.add_action_log(task.id, log)
            return None, rule_results, None
        task.escort = escort
        task.status = TaskStatus.ASSIGNED
        task.accepted_at = datetime.now()
        reason = "; ".join(r.reason for r in rule_results)
        log = self._create_action_log(task.id, ActionType.ACCEPT, operator, reason, to_escort_id=escort_id)
        task.action_logs.append(log)
        self.storage.save_task(task)
        return task, rule_results, None

    def cancel_task(self, task_id: str, operator: str, cancel_reason: str) -> tuple:
        task = self.storage.get_task(task_id)
        if not task:
            return None, [RuleResult(False, "任务不存在", "存在性校验")], None
        rule_results = self.rule_engine.validate_cancel_task(task)
        if not self.rule_engine.all_passed(rule_results):
            reason = "; ".join(self.rule_engine.get_failed_reasons(rule_results))
            log = self._create_action_log(task.id, ActionType.CANCEL, operator, reason, success=False)
            self.storage.add_action_log(task.id, log)
            return None, rule_results, None
        old_position = task.position
        task.status = TaskStatus.CANCELLED
        reason = f"取消原因: {cancel_reason}"
        log = self._create_action_log(task.id, ActionType.CANCEL, operator, reason)
        task.action_logs.append(log)
        self.storage.save_task(task)
        fill_result = self._fill_cancel_position(old_position, task.id, operator)
        return task, rule_results, fill_result

    def _fill_cancel_position(self, vacated_position: int, cancelled_task_id: str, operator: str):
        pending_tasks = self.storage.get_pending_tasks()
        affected = []
        for task in pending_tasks:
            if task.id == cancelled_task_id:
                continue
            if task.position > vacated_position:
                task.position -= 1
                affected.append(task.id)
                self.storage.save_task(task)
        return {
            "vacated_position": vacated_position,
            "affected_tasks": affected,
            "message": f"{len(affected)}个任务向前补位" if affected else "无需要补位的任务"
        }

    def reassign_task(self, task_id: str, to_escort_id: str, operator: str, reassign_reason: str) -> tuple:
        task = self.storage.get_task(task_id)
        to_escort = self.storage.get_escort(to_escort_id)
        if not task:
            return None, [RuleResult(False, "任务不存在", "存在性校验")]
        if not to_escort:
            return None, [RuleResult(False, "目标陪检员不存在", "存在性校验")]
        from_escort_id = task.escort.id if task.escort else None
        rule_results = self.rule_engine.validate_reassign_task(task, task.escort, to_escort)
        if not self.rule_engine.all_passed(rule_results):
            reason = "; ".join(self.rule_engine.get_failed_reasons(rule_results))
            log = self._create_action_log(task.id, ActionType.REASSIGN, operator, reason, success=False)
            self.storage.add_action_log(task.id, log)
            return None, rule_results
        task.escort = to_escort
        task.status = TaskStatus.ASSIGNED
        reason = f"转派原因: {reassign_reason}"
        log = self._create_action_log(
            task.id, ActionType.REASSIGN, operator, reason,
            from_escort_id=from_escort_id, to_escort_id=to_escort_id
        )
        task.action_logs.append(log)
        self.storage.save_task(task)
        return task, rule_results

    def jump_queue(self, task_id: str, target_position: int, operator: str, jump_reason: str) -> tuple:
        task = self.storage.get_task(task_id)
        if not task:
            return None, [RuleResult(False, "任务不存在", "存在性校验")]
        rule_results = self.rule_engine.validate_jump_queue(task, target_position)
        if not self.rule_engine.all_passed(rule_results):
            reason = "; ".join(self.rule_engine.get_failed_reasons(rule_results))
            log = self._create_action_log(task.id, ActionType.JUMP_QUEUE, operator, reason, success=False)
            self.storage.add_action_log(task.id, log)
            return None, rule_results
        old_position = task.position
        affected = []
        pending_tasks = self.storage.get_pending_tasks()
        for t in pending_tasks:
            if t.id == task_id:
                continue
            if old_position < target_position:
                if old_position < t.position <= target_position:
                    t.position -= 1
                    affected.append(t.id)
                    self.storage.save_task(t)
            else:
                if target_position <= t.position < old_position:
                    t.position += 1
                    affected.append(t.id)
                    self.storage.save_task(t)
        task.position = target_position
        reason = f"插队原因: {jump_reason}, 从位置{old_position}移到{target_position}, 影响{len(affected)}个任务"
        log = self._create_action_log(task.id, ActionType.JUMP_QUEUE, operator, reason)
        task.action_logs.append(log)
        self.storage.save_task(task)
        return task, rule_results

    def process_timeout(self, operator: str = "system") -> dict:
        pending_tasks = self.storage.get_pending_tasks()
        timeout_tasks = []
        for task in pending_tasks:
            if task.is_timeout():
                old_position = task.position
                task.status = TaskStatus.TIMEOUT
                reason = f"任务等待超过{task.timeout_minutes}分钟，标记为超时"
                log = self._create_action_log(task.id, ActionType.TIMEOUT, operator, reason)
                task.action_logs.append(log)
                self.storage.save_task(task)
                self._fill_cancel_position(old_position, task.id, operator)
                timeout_tasks.append(task.id)
        return {
            "timeout_count": len(timeout_tasks),
            "timeout_task_ids": timeout_tasks
        }

    def complete_task(self, task_id: str, operator: str):
        task = self.storage.get_task(task_id)
        if not task:
            return None, [RuleResult(False, "任务不存在", "存在性校验")]
        if task.status not in [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]:
            return None, [RuleResult(False, "只有已分配或进行中的任务可以完成", "状态校验")]
        from datetime import datetime
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        reason = "任务已完成"
        log = self._create_action_log(task.id, ActionType.COMPLETE, operator, reason)
        task.action_logs.append(log)
        self.storage.save_task(task)
        return task, []
