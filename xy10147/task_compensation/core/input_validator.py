from __future__ import annotations

import re
from datetime import datetime, date
from typing import List, Dict, Optional, Any, Tuple
from abc import ABC, abstractmethod

from task_compensation.models import Task, CompensationPlan, SystemConfig


class ValidationError(Exception):
    def __init__(self, message: str, field: Optional[str] = None, 
                 code: Optional[str] = None):
        super().__init__(message)
        self.field = field
        self.code = code


class ValidationResult:
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []
    
    def add_error(self, message: str, field: Optional[str] = None, 
                 code: Optional[str] = None):
        self.errors.append(ValidationError(message, field, code))
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "errors": [
                {
                    "message": str(e),
                    "field": e.field,
                    "code": e.code
                }
                for e in self.errors
            ],
            "warnings": self.warnings
        }


class TaskValidator:
    def __init__(self):
        self._cron_pattern = re.compile(
            r'^(\*|([0-5]?\d)(,[0-5]?\d)*|([0-5]?\d)-([0-5]?\d)|\*\/\d+)\s+'
            r'(\*|([01]?\d|2[0-3])(,[01]?\d|,2[0-3])*|([01]?\d|2[0-3])-([01]?\d|2[0-3])|\*\/\d+)\s+'
            r'(\*|([1-9]|[12]\d|3[01])(,[1-9]|,[12]\d|,3[01])*|([1-9]|[12]\d|3[01])-([1-9]|[12]\d|3[01])|\*\/\d+)\s+'
            r'(\*|([1-9]|1[0-2])(,[1-9]|,1[0-2])*|([1-9]|1[0-2])-([1-9]|1[0-2])|\*\/\d+)\s+'
            r'(\*|[0-6](,[0-6])*|[0-6]-[0-6]|SUN|MON|TUE|WED|THU|FRI|SAT|sun|mon|tue|wed|thu|fri|sat)$'
        )
    
    def validate(self, task: Task, existing_task_ids: List[str] = None) -> ValidationResult:
        result = ValidationResult()
        existing_task_ids = existing_task_ids or []
        
        self._validate_task_id(task, result)
        self._validate_task_name(task, result)
        self._validate_cron_expression(task, result)
        self._validate_timeouts(task, result)
        self._validate_dependencies(task, existing_task_ids, result)
        
        return result
    
    def _validate_task_id(self, task: Task, result: ValidationResult):
        if not task.task_id:
            result.add_error("task_id 不能为空", field="task_id", code="required")
            return
        
        if len(task.task_id) > 255:
            result.add_error("task_id 长度不能超过 255 字符", field="task_id", code="too_long")
        
        if not re.match(r'^[a-zA-Z0-9_-]+$', task.task_id):
            result.add_error(
                "task_id 只能包含字母、数字、下划线和连字符", 
                field="task_id", 
                code="invalid_format"
            )
    
    def _validate_task_name(self, task: Task, result: ValidationResult):
        if not task.task_name:
            result.add_error("task_name 不能为空", field="task_name", code="required")
            return
        
        if len(task.task_name) > 500:
            result.add_error("task_name 长度不能超过 500 字符", field="task_name", code="too_long")
    
    def _validate_cron_expression(self, task: Task, result: ValidationResult):
        if not task.cron_expression:
            result.add_error("cron_expression 不能为空", field="cron_expression", code="required")
            return
        
        parts = task.cron_expression.strip().split()
        if len(parts) != 5:
            result.add_error(
                "cron_expression 格式错误，应为 5 个字段", 
                field="cron_expression", 
                code="invalid_format"
            )
            return
        
        minute, hour, day, month, weekday = parts
        
        if not self._validate_cron_field(minute, 0, 59):
            result.add_error(
                f"cron_expression 分钟字段无效: {minute}", 
                field="cron_expression", 
                code="invalid_minute"
            )
        
        if not self._validate_cron_field(hour, 0, 23):
            result.add_error(
                f"cron_expression 小时字段无效: {hour}", 
                field="cron_expression", 
                code="invalid_hour"
            )
        
        if not self._validate_cron_field(day, 1, 31):
            result.add_error(
                f"cron_expression 日期字段无效: {day}", 
                field="cron_expression", 
                code="invalid_day"
            )
        
        if not self._validate_cron_field(month, 1, 12):
            result.add_error(
                f"cron_expression 月份字段无效: {month}", 
                field="cron_expression", 
                code="invalid_month"
            )
        
        if not self._validate_cron_field(weekday, 0, 6):
            result.add_error(
                f"cron_expression 星期字段无效: {weekday}", 
                field="cron_expression", 
                code="invalid_weekday"
            )
    
    def _validate_cron_field(self, field: str, min_val: int, max_val: int) -> bool:
        if field == '*':
            return True
        
        parts = field.split(',')
        for part in parts:
            if '/' in part:
                base, step = part.split('/')
                if base != '*':
                    try:
                        base_val = int(base)
                        if not (min_val <= base_val <= max_val):
                            return False
                    except ValueError:
                        return False
                try:
                    step_val = int(step)
                    if step_val <= 0:
                        return False
                except ValueError:
                    return False
            elif '-' in part:
                try:
                    start, end = part.split('-')
                    start_val = int(start)
                    end_val = int(end)
                    if not (min_val <= start_val <= max_val and min_val <= end_val <= max_val):
                        return False
                    if start_val > end_val:
                        return False
                except ValueError:
                    return False
            else:
                try:
                    val = int(part)
                    if not (min_val <= val <= max_val):
                        return False
                except ValueError:
                    return False
        
        return True
    
    def _validate_timeouts(self, task: Task, result: ValidationResult):
        if task.timeout < 1:
            result.add_error(
                "timeout 必须大于 0", 
                field="timeout", 
                code="invalid_timeout"
            )
        
        if task.retries < 0:
            result.add_error(
                "retries 不能为负数", 
                field="retries", 
                code="invalid_retries"
            )
    
    def _validate_dependencies(self, task: Task, existing_task_ids: List[str], result: ValidationResult):
        for dep in task.dependencies:
            if dep == task.task_id:
                result.add_error(
                    f"任务不能依赖自己: {dep}", 
                    field="dependencies", 
                    code="self_dependency"
                )
                continue
            
            if existing_task_ids and dep not in existing_task_ids:
                result.add_warning(
                    f"依赖任务 {dep} 尚未注册"
                )


class CompensationPlanValidator:
    def __init__(self):
        pass
    
    def validate(self, plan: CompensationPlan, registry: Any) -> ValidationResult:
        result = ValidationResult()
        
        self._validate_plan_basic(plan, result)
        self._validate_steps(plan, registry, result)
        
        return result
    
    def _validate_plan_basic(self, plan: CompensationPlan, result: ValidationResult):
        if not plan.plan_id:
            result.add_error("plan_id 不能为空", field="plan_id", code="required")
        
        if plan.target_date is None:
            result.add_error("target_date 不能为空", field="target_date", code="required")
        
        if plan.total_steps != len(plan.steps):
            result.add_warning(
                f"total_steps ({plan.total_steps}) 与实际步骤数 ({len(plan.steps)}) 不一致"
            )
    
    def _validate_steps(self, plan: CompensationPlan, registry: Any, result: ValidationResult):
        task_ids_in_plan = set()
        
        for step in plan.steps:
            if step.step_id <= 0:
                result.add_error(
                    f"步骤 ID 必须大于 0: {step.step_id}", 
                    field="steps", 
                    code="invalid_step_id"
                )
            
            if step.task_id not in task_ids_in_plan:
                task_ids_in_plan.add(step.task_id)
            else:
                result.add_warning(
                    f"任务 {step.task_id} 在计划中出现多次"
                )
            
            if registry is not None and step.task_id not in registry:
                result.add_error(
                    f"步骤中的任务不存在: {step.task_id}", 
                    field="steps", 
                    code="task_not_found"
                )
            
            if step.action not in ['execute', 'skip']:
                result.add_error(
                    f"无效的执行动作: {step.action}", 
                    field="steps", 
                    code="invalid_action"
                )
            
            if step.execution_date != plan.target_date:
                result.add_warning(
                    f"步骤 {step.step_id} 的执行日期 ({step.execution_date}) "
                    f"与计划目标日期 ({plan.target_date}) 不一致"
                )
        
        self._validate_dependency_order(plan, result)
    
    def _validate_dependency_order(self, plan: CompensationPlan, result: ValidationResult):
        executed_tasks = set()
        
        for step in plan.steps:
            for dep in step.dependencies:
                if dep not in executed_tasks:
                    result.add_error(
                        f"步骤 {step.step_id} ({step.task_id}) 的依赖 {dep} 未在前面执行", 
                        field="steps", 
                        code="invalid_dependency_order"
                    )
            
            if step.action == 'execute':
                executed_tasks.add(step.task_id)


class DateValidator:
    def validate_compensation_date(self, target_date: date, 
                                   allow_future: bool = False) -> ValidationResult:
        result = ValidationResult()
        today = date.today()
        
        if target_date > today and not allow_future:
            result.add_error(
                f"目标日期 {target_date} 不能是未来日期", 
                field="target_date", 
                code="future_date"
            )
        
        return result


class InputValidator:
    def __init__(self, config: Optional[SystemConfig] = None):
        self.config = config or SystemConfig()
        self.task_validator = TaskValidator()
        self.plan_validator = CompensationPlanValidator()
        self.date_validator = DateValidator()
    
    def validate_task(self, task: Task, existing_task_ids: List[str] = None) -> ValidationResult:
        return self.task_validator.validate(task, existing_task_ids)
    
    def validate_tasks(self, tasks: List[Task]) -> ValidationResult:
        result = ValidationResult()
        task_ids = []
        
        for task in tasks:
            task_result = self.validate_task(task, task_ids)
            result.errors.extend(task_result.errors)
            result.warnings.extend(task_result.warnings)
            task_ids.append(task.task_id)
        
        return result
    
    def validate_plan(self, plan: CompensationPlan, registry: Any = None) -> ValidationResult:
        return self.plan_validator.validate(plan, registry)
    
    def validate_date(self, target_date: date, allow_future: bool = False) -> ValidationResult:
        return self.date_validator.validate_compensation_date(target_date, allow_future)
    
    def validate_task_ids(self, task_ids: List[str], registry: Any) -> ValidationResult:
        result = ValidationResult()
        
        if not task_ids:
            result.add_error("任务ID列表不能为空", field="task_ids", code="empty_list")
            return result
        
        for task_id in task_ids:
            if task_id not in registry:
                result.add_error(
                    f"任务不存在: {task_id}", 
                    field="task_ids", 
                    code="task_not_found"
                )
        
        return result
