from __future__ import annotations

import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Set

from task_compensation.models import (
    Task, CompensationPlan, CompensationStep, TaskStatus, IdempotencyRecord
)
from task_compensation.core.task_registry import TaskRegistry
from task_compensation.core.idempotency_checker import IdempotencyChecker


class CompensationPlanner:
    def __init__(
        self,
        registry: TaskRegistry,
        idempotency_checker: Optional[IdempotencyChecker] = None,
        enable_idempotency_check: bool = True
    ):
        self.registry = registry
        self.idempotency_checker = idempotency_checker
        self.enable_idempotency_check = enable_idempotency_check
    
    def create_plan(
        self,
        target_date: date,
        missed_task_ids: List[str],
        include_dependencies: bool = True,
        auto_skip_successful: bool = True
    ) -> CompensationPlan:
        plan_id = str(uuid.uuid4())
        
        warnings = []
        all_task_ids_to_include = set(missed_task_ids)
        
        if include_dependencies:
            all_task_ids_to_include = self._collect_with_transitive_dependencies(missed_task_ids, warnings)
        
        execution_order = self._get_safe_execution_order(all_task_ids_to_include, warnings)
        
        steps = []
        for index, task_id in enumerate(execution_order):
            task = self.registry.get_task(task_id)
            if not task:
                warnings.append(f"任务 {task_id} 不存在，已跳过")
                continue
            
            step = self._create_step(
                step_id=index + 1,
                task=task,
                execution_date=target_date,
                is_primary_task=task_id in missed_task_ids,
                auto_skip_successful=auto_skip_successful
            )
            steps.append(step)
        
        estimated_duration = sum(
            step.estimated_duration for step in steps 
            if step.estimated_duration is not None and step.action == "execute"
        ) if steps else None
        
        return CompensationPlan(
            plan_id=plan_id,
            generated_at=datetime.now(),
            target_date=target_date,
            missed_tasks=missed_task_ids,
            steps=steps,
            total_steps=len(steps),
            estimated_total_duration=estimated_duration,
            warnings=warnings
        )
    
    def _collect_with_transitive_dependencies(
        self,
        task_ids: List[str],
        warnings: List[str]
    ) -> Set[str]:
        graph = self.registry.get_dependency_graph()
        result = set()
        
        for task_id in task_ids:
            if task_id not in self.registry:
                warnings.append(f"任务 {task_id} 不存在，已跳过")
                continue
            
            result.add(task_id)
            deps = graph.get_transitive_dependencies(task_id)
            result.update(deps)
        
        return result
    
    def _get_safe_execution_order(
        self,
        task_ids: Set[str],
        warnings: List[str]
    ) -> List[str]:
        try:
            return self.registry.get_execution_order(list(task_ids))
        except ValueError as e:
            warnings.append(f"拓扑排序失败: {str(e)}，使用默认顺序")
            return list(task_ids)
    
    def _create_step(
        self,
        step_id: int,
        task: Task,
        execution_date: date,
        is_primary_task: bool,
        auto_skip_successful: bool
    ) -> CompensationStep:
        estimated_duration = self._estimate_task_duration(task)
        idempotency_check_needed = self._needs_idempotency_check(task)
        
        action = "execute"
        reason = None
        
        if auto_skip_successful and self.enable_idempotency_check and self.idempotency_checker:
            try:
                record = self.idempotency_checker.check(task.task_id, execution_date)
                if record and record.status == TaskStatus.SUCCESS:
                    action = "skip"
                    reason = f"幂等检查发现已成功执行，跳过 (record_id: {record.execution_record_id})"
            except Exception as e:
                reason = f"幂等检查失败，继续执行: {str(e)}"
        
        if not task.active:
            action = "skip"
            reason = "任务已禁用"
        
        if not is_primary_task and action == "execute":
            reason = "依赖任务，需确保已成功执行"
        
        return CompensationStep(
            step_id=step_id,
            task_id=task.task_id,
            task_name=task.task_name,
            execution_date=execution_date,
            estimated_duration=estimated_duration,
            dependencies=task.dependencies.copy(),
            action=action,
            reason=reason,
            idempotency_check_needed=idempotency_check_needed
        )
    
    def _estimate_task_duration(self, task: Task) -> Optional[float]:
        metadata = task.metadata or {}
        return metadata.get('estimated_duration_seconds')
    
    def _needs_idempotency_check(self, task: Task) -> bool:
        if not self.enable_idempotency_check:
            return False
        
        return task.idempotency_key is not None or self.idempotency_checker is not None
    
    def create_plan_for_multiple_dates(
        self,
        dates: List[date],
        missed_tasks_by_date: Dict[str, List[str]],
        include_dependencies: bool = True,
        auto_skip_successful: bool = True
    ) -> List[CompensationPlan]:
        plans = []
        
        sorted_dates = sorted(dates)
        
        for target_date in sorted_dates:
            date_key = target_date.isoformat()
            missed_task_ids = missed_tasks_by_date.get(date_key, [])
            
            if not missed_task_ids:
                continue
            
            plan = self.create_plan(
                target_date=target_date,
                missed_task_ids=missed_task_ids,
                include_dependencies=include_dependencies,
                auto_skip_successful=auto_skip_successful
            )
            plans.append(plan)
        
        return plans
    
    def validate_plan(self, plan: CompensationPlan) -> List[str]:
        errors = []
        warnings = []
        
        executed_tasks = set()
        for step in plan.steps:
            for dep in step.dependencies:
                if dep not in executed_tasks:
                    errors.append(f"步骤 {step.step_id} ({step.task_id}) 的依赖 {dep} 未在前面执行")
            
            if step.action == "execute":
                executed_tasks.add(step.task_id)
        
        task_set = set()
        for step in plan.steps:
            if step.task_id in task_set:
                warnings.append(f"任务 {step.task_id} 在计划中出现多次")
            task_set.add(step.task_id)
        
        return errors + [f"警告: {w}" for w in warnings]
