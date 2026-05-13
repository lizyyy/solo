from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .models import (
    Task, TaskStatus, TaskPriority,
    TenantConfig, TenantRuntimeState, SchedulerState
)


class Scheduler:
    def __init__(self, state: SchedulerState):
        self.state = state
        self._ensure_tenant_runtime()

    def _ensure_tenant_runtime(self):
        for tenant_id in self.state.tenant_configs:
            if tenant_id not in self.state.tenant_runtime:
                self.state.tenant_runtime[tenant_id] = TenantRuntimeState(tenant_id=tenant_id)

    def register_tenant(self, config: TenantConfig) -> bool:
        if config.tenant_id in self.state.tenant_configs:
            return False
        self.state.tenant_configs[config.tenant_id] = config
        self.state.tenant_runtime[config.tenant_id] = TenantRuntimeState(
            tenant_id=config.tenant_id
        )
        return True

    def get_effective_quota(self, tenant_id: str) -> int:
        if tenant_id not in self.state.tenant_configs:
            return 0
        config = self.state.tenant_configs[tenant_id]
        runtime = self.state.tenant_runtime.get(tenant_id)
        if not runtime:
            return config.concurrency_quota
        
        base_quota = config.concurrency_quota
        reduction = runtime.quota_reduction_percent
        effective = int(base_quota * (100 - reduction) / 100)
        return max(1, effective)

    def submit_task(
        self,
        task_id: str,
        tenant_id: str,
        name: str,
        task_type: str,
        priority: TaskPriority = TaskPriority.NORMAL,
        weight: int = 1,
        max_retries: int = 3,
        metadata: Optional[Dict] = None,
        is_urgent_promotion: bool = False,
        promotion_reason: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[Task]]:
        if tenant_id not in self.state.tenant_configs:
            return False, f"租户 {tenant_id} 不存在", None

        config = self.state.tenant_configs[tenant_id]
        runtime = self.state.tenant_runtime[tenant_id]

        if not config.is_active:
            return False, f"租户 {tenant_id} 已被禁用", None

        if task_id in self.state.tasks:
            existing = self.state.tasks[task_id]
            return True, f"任务已存在 (幂等性保证) - 当前状态: {existing.status.value}", existing

        pending_count = len(
            [t for t in self.state.tasks.values()
             if t.tenant_id == tenant_id and t.status == TaskStatus.PENDING]
        )
        if pending_count >= config.max_queue_size:
            return False, f"租户 {tenant_id} 队列已满 (最大: {config.max_queue_size})", None

        task = Task(
            id=task_id,
            tenant_id=tenant_id,
            name=name,
            task_type=task_type,
            priority=priority,
            weight=weight,
            max_retries=max_retries,
            metadata=metadata or {},
            is_urgent_promotion=is_urgent_promotion,
            promotion_reason=promotion_reason,
        )

        self.state.tasks[task_id] = task
        runtime.pending_tasks.append(task_id)

        return True, "任务提交成功", task

    def get_schedule_order(self, max_tasks: int = 10) -> List[Task]:
        candidates = []
        for task in self.state.tasks.values():
            if task.status != TaskStatus.PENDING:
                continue
            tenant_id = task.tenant_id
            if tenant_id not in self.state.tenant_configs:
                continue
            config = self.state.tenant_configs[tenant_id]
            if not config.is_active:
                continue
            runtime = self.state.tenant_runtime.get(tenant_id)
            if not runtime:
                continue
            effective_quota = self.get_effective_quota(tenant_id)
            if len(runtime.running_tasks) >= effective_quota:
                continue
            candidates.append(task)

        priority_order = {
            TaskPriority.URGENT: 0,
            TaskPriority.HIGH: 1,
            TaskPriority.NORMAL: 2,
            TaskPriority.LOW: 3,
        }

        sorted_candidates = sorted(
            candidates,
            key=lambda t: (
                priority_order[t.priority],
                -self.state.tenant_configs.get(t.tenant_id, TenantConfig(tenant_id="", name="")).weight,
                t.created_at,
            ),
        )

        tenant_tasks = defaultdict(list)
        for task in sorted_candidates:
            tenant_tasks[task.tenant_id].append(task)

        result = []
        tenant_weights = {
            tid: cfg.weight for tid, cfg in self.state.tenant_configs.items()
        }
        total_weight = sum(tenant_weights.values()) if tenant_weights else 1

        round_robin_tenants = list(tenant_weights.keys())
        while len(result) < max_tasks and tenant_tasks:
            for tenant_id in round_robin_tenants:
                if tenant_id not in tenant_tasks or not tenant_tasks[tenant_id]:
                    continue
                if len(result) >= max_tasks:
                    break
                runtime = self.state.tenant_runtime.get(tenant_id)
                effective_quota = self.get_effective_quota(tenant_id)
                if runtime and len(runtime.running_tasks) >= effective_quota:
                    continue
                if tenant_tasks[tenant_id]:
                    task = tenant_tasks[tenant_id].pop(0)
                    result.append(task)
                    if not tenant_tasks[tenant_id]:
                        del tenant_tasks[tenant_id]

        return result

    def start_task(self, task_id: str) -> bool:
        if task_id not in self.state.tasks:
            return False
        task = self.state.tasks[task_id]
        if task.status != TaskStatus.PENDING:
            return False
        
        tenant_id = task.tenant_id
        runtime = self.state.tenant_runtime.get(tenant_id)
        if not runtime:
            return False

        effective_quota = self.get_effective_quota(tenant_id)
        if len(runtime.running_tasks) >= effective_quota:
            return False

        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        runtime.running_tasks.append(task_id)
        if task_id in runtime.pending_tasks:
            runtime.pending_tasks.remove(task_id)

        return True

    def complete_task(self, task_id: str, execution_time_ms: int = 0) -> bool:
        if task_id not in self.state.tasks:
            return False
        task = self.state.tasks[task_id]
        if task.status != TaskStatus.RUNNING:
            return False

        tenant_id = task.tenant_id
        runtime = self.state.tenant_runtime.get(tenant_id)

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        task.execution_history.append({
            "attempt": task.retry_count + 1,
            "status": "completed",
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "execution_time_ms": execution_time_ms,
        })

        if runtime:
            if task_id in runtime.running_tasks:
                runtime.running_tasks.remove(task_id)
            runtime.completed_tasks += 1
            runtime.consecutive_failures = 0
            if runtime.quota_reduction_percent > 0:
                runtime.quota_reduction_percent = max(0, runtime.quota_reduction_percent - 10)
            runtime.total_execution_time_ms += execution_time_ms

        self.state.total_completed += 1
        return True

    def fail_task(self, task_id: str, error_message: str, execution_time_ms: int = 0) -> Tuple[bool, bool, str]:
        if task_id not in self.state.tasks:
            return False, False, "任务不存在"
        task = self.state.tasks[task_id]
        if task.status != TaskStatus.RUNNING:
            return False, False, "任务不在运行状态"

        tenant_id = task.tenant_id
        runtime = self.state.tenant_runtime.get(tenant_id)
        config = self.state.tenant_configs.get(tenant_id)

        task.retry_count += 1
        task.execution_history.append({
            "attempt": task.retry_count,
            "status": "failed",
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "failed_at": datetime.now().isoformat(),
            "error": error_message,
            "execution_time_ms": execution_time_ms,
        })

        if runtime:
            runtime.consecutive_failures += 1
            runtime.last_failure_time = datetime.now()
            if task_id in runtime.running_tasks:
                runtime.running_tasks.remove(task_id)

        should_retry = task.retry_count < task.max_retries

        if should_retry:
            task.status = TaskStatus.PENDING
            task.error_message = error_message
            if runtime:
                runtime.pending_tasks.append(task_id)
            return True, True, f"任务失败，将重试 (第{task.retry_count}/{task.max_retries}次)"
        else:
            task.status = TaskStatus.FAILED
            task.error_message = error_message
            task.completed_at = datetime.now()
            self.state.total_failed += 1
            if runtime:
                runtime.failed_tasks += 1
            if config and runtime:
                if runtime.consecutive_failures >= config.failure_threshold:
                    runtime.quota_reduction_percent = min(
                        80,
                        runtime.quota_reduction_percent + config.failure_penalty_percent
                    )
            return True, False, "任务失败且已耗尽重试次数"

    def promote_to_urgent(self, task_id: str, reason: str) -> bool:
        if task_id not in self.state.tasks:
            return False
        task = self.state.tasks[task_id]
        if task.status != TaskStatus.PENDING:
            return False
        if task.priority == TaskPriority.URGENT:
            return False

        task.is_urgent_promotion = True
        task.promotion_reason = reason
        task.priority = TaskPriority.URGENT
        return True

    def get_tenant_stats(self) -> Dict:
        stats = {}
        for tenant_id, config in self.state.tenant_configs.items():
            runtime = self.state.tenant_runtime.get(tenant_id)
            if not runtime:
                continue
            effective_quota = self.get_effective_quota(tenant_id)
            stats[tenant_id] = {
                "config": config,
                "runtime": runtime,
                "effective_quota": effective_quota,
                "running_count": len(runtime.running_tasks),
                "pending_count": len(runtime.pending_tasks),
            }
        return stats

    def get_pending_tasks(self, tenant_id: Optional[str] = None) -> List[Task]:
        tasks = []
        for task in self.state.tasks.values():
            if task.status != TaskStatus.PENDING:
                continue
            if tenant_id and task.tenant_id != tenant_id:
                continue
            tasks.append(task)
        return sorted(tasks, key=lambda t: t.created_at)

    def get_failed_tasks(self, tenant_id: Optional[str] = None) -> List[Task]:
        tasks = []
        for task in self.state.tasks.values():
            if task.status != TaskStatus.FAILED:
                continue
            if tenant_id and task.tenant_id != tenant_id:
                continue
            tasks.append(task)
        return sorted(tasks, key=lambda t: t.completed_at if t.completed_at else t.created_at, reverse=True)

    def rebalance_quotas(self) -> Dict[str, int]:
        changes = {}
        for tenant_id, config in self.state.tenant_configs.items():
            runtime = self.state.tenant_runtime.get(tenant_id)
            if not runtime:
                continue
            if runtime.consecutive_failures == 0 and runtime.quota_reduction_percent > 0:
                old_reduction = runtime.quota_reduction_percent
                runtime.quota_reduction_percent = max(0, runtime.quota_reduction_percent - 20)
                if old_reduction != runtime.quota_reduction_percent:
                    changes[tenant_id] = runtime.quota_reduction_percent
        return changes
