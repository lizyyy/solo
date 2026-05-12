import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
from datetime import datetime

from .config import Region, Task
from .templates import TemplateManager
from .cache_client import MockCacheClient, CacheOperationResult


class TaskStatus(Enum):
    PENDING = "pending"
    SKIPPED = "skipped"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL_SUCCESS = "partial_success"
    INCONSISTENT = "inconsistent"


class RegionTaskStatus(Enum):
    PENDING = "pending"
    SKIPPED = "skipped"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    INCONSISTENT = "inconsistent"
    DUPLICATE = "duplicate"


@dataclass
class RegionTaskResult:
    region_id: str
    region_name: str
    cache_key: str
    status: RegionTaskStatus
    retry_count: int = 0
    failure_reason: Optional[str] = None
    skip_reason: Optional[str] = None
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    is_consistent: bool = True
    old_value: Optional[str] = None


@dataclass
class TaskExecutionResult:
    task_id: str
    template: str
    cache_key: str
    status: TaskStatus
    region_results: Dict[str, RegionTaskResult] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class InvalidationExecutor:
    def __init__(
        self,
        template_manager: TemplateManager,
        cache_client: MockCacheClient,
        max_retries: int = 3,
        retry_delay: float = 1.0
    ):
        self.template_manager = template_manager
        self.cache_client = cache_client
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._executed_tasks: Dict[str, List[str]] = {}

    def pre_check(
        self,
        regions: Dict[str, Region],
        tasks: List[Task]
    ) -> Tuple[List[str], List[str], List[str]]:
        errors = []
        warnings = []
        info = []

        seen_task_ids = set()
        duplicate_tasks = []

        for task in tasks:
            if task.id in seen_task_ids:
                duplicate_tasks.append(task.id)
                warnings.append(f"发现重复任务 ID: {task.id}")
            seen_task_ids.add(task.id)

            valid, template_errors = self.template_manager.validate_template(task.template)
            if not valid:
                errors.extend(template_errors)
                continue

            valid, var_errors = self.template_manager.validate_variables(
                task.template, task.variables
            )
            if not valid:
                for var_error in var_errors:
                    errors.append(f"任务 {task.id}: {var_error}")

            for region_id in task.skip_regions:
                if region_id not in regions:
                    warnings.append(f"任务 {task.id}: 跳过的区域不存在: {region_id}")
                
                if not task.skip_reason:
                    warnings.append(f"任务 {task.id}: 区域 {region_id} 被跳过但未提供原因")

        for region_id, region in regions.items():
            result = self.cache_client.ping(region_id)
            if not result.success:
                errors.append(f"区域不可达: {region.name} ({region_id}) - {result.message}")
            else:
                info.append(f"区域可达: {region.name} ({region_id})")

        return errors, warnings, info

    def execute_task(
        self,
        task: Task,
        regions: Dict[str, Region]
    ) -> TaskExecutionResult:
        result = TaskExecutionResult(
            task_id=task.id,
            template=task.template,
            cache_key="",
            status=TaskStatus.PENDING,
            start_time=datetime.now()
        )

        cache_key, key_errors = self.template_manager.build_cache_key(
            task.template, task.variables
        )
        if not cache_key:
            result.errors.extend(key_errors)
            result.status = TaskStatus.FAILED
            result.end_time = datetime.now()
            return result
        
        result.cache_key = cache_key

        if task.id in self._executed_tasks:
            if cache_key in self._executed_tasks[task.id]:
                result.warnings.append(f"任务 {task.id} 已执行过相同缓存键 {cache_key}")
                for region_id, region in regions.items():
                    if region_id in task.skip_regions:
                        continue
                    region_result = RegionTaskResult(
                        region_id=region_id,
                        region_name=region.name,
                        cache_key=cache_key,
                        status=RegionTaskStatus.DUPLICATE,
                        skip_reason="任务重复执行"
                    )
                    result.region_results[region_id] = region_result
                result.status = TaskStatus.PARTIAL_SUCCESS
                result.end_time = datetime.now()
                return result

        self._executed_tasks.setdefault(task.id, []).append(cache_key)

        success_count = 0
        failed_count = 0
        inconsistent_count = 0

        for region_id, region in regions.items():
            region_result = self._process_region(
                task, region, cache_key
            )
            result.region_results[region_id] = region_result

            if region_result.status == RegionTaskStatus.SUCCESS:
                success_count += 1
            elif region_result.status == RegionTaskStatus.FAILED:
                failed_count += 1
            elif region_result.status == RegionTaskStatus.INCONSISTENT:
                inconsistent_count += 1

        if failed_count == 0 and inconsistent_count == 0:
            result.status = TaskStatus.SUCCESS
        elif failed_count > 0:
            result.status = TaskStatus.FAILED
        elif inconsistent_count > 0:
            result.status = TaskStatus.INCONSISTENT
        else:
            result.status = TaskStatus.PARTIAL_SUCCESS

        result.end_time = datetime.now()
        return result

    def _process_region(
        self,
        task: Task,
        region: Region,
        cache_key: str
    ) -> RegionTaskResult:
        region_result = RegionTaskResult(
            region_id=region.id,
            region_name=region.name,
            cache_key=cache_key,
            expected_value=task.expected_value,
            status=RegionTaskStatus.PENDING
        )

        if region.id in task.skip_regions:
            region_result.status = RegionTaskStatus.SKIPPED
            region_result.skip_reason = task.skip_reason or "未提供跳过原因"
            return region_result

        ping_result = self.cache_client.ping(region.id)
        if not ping_result.success:
            region_result.status = RegionTaskStatus.FAILED
            region_result.failure_reason = ping_result.message
            return region_result

        get_result = self.cache_client.get(region.id, cache_key)
        if get_result.success and get_result.value:
            region_result.old_value = get_result.value

        for attempt in range(self.max_retries + 1):
            if attempt > 0:
                time.sleep(self.retry_delay)
                region_result.retry_count = attempt
                region_result.status = RegionTaskStatus.RETRYING

            delete_result = self.cache_client.delete(region.id, cache_key)
            if delete_result.success:
                region_result.status = RegionTaskStatus.SUCCESS
                break
            else:
                region_result.failure_reason = delete_result.message
                region_result.status = RegionTaskStatus.FAILED

        if region_result.status == RegionTaskStatus.SUCCESS:
            check_result = self.cache_client.get(region.id, cache_key)
            if check_result.success and check_result.value is not None:
                region_result.status = RegionTaskStatus.INCONSISTENT
                region_result.actual_value = check_result.value
                region_result.is_consistent = False
                region_result.failure_reason = "失效成功但复查仍有旧值"

        return region_result

    def execute_all(
        self,
        regions: Dict[str, Region],
        tasks: List[Task]
    ) -> List[TaskExecutionResult]:
        results = []
        for task in tasks:
            result = self.execute_task(task, regions)
            results.append(result)
        return results

    def get_execution_history(self) -> Dict[str, List[str]]:
        return self._executed_tasks.copy()

    def reset_execution_history(self):
        self._executed_tasks.clear()
