from __future__ import annotations

import json
import hashlib
from datetime import datetime, date
from typing import Any, List, Dict, Optional, Set, Callable
from enum import Enum
from pydantic import BaseModel, Field, validator
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class Task(BaseModel):
    task_id: str = Field(..., description="任务唯一标识")
    task_name: str = Field(..., description="任务名称")
    task_type: str = Field(default="batch", description="任务类型")
    cron_expression: str = Field(..., description="Cron 表达式")
    timeout: int = Field(default=3600, description="超时时间（秒）")
    retries: int = Field(default=0, description="重试次数")
    dependencies: List[str] = Field(default_factory=list, description="依赖的任务ID列表")
    idempotency_key: Optional[str] = Field(default=None, description="幂等检查的关键字段模板")
    handler: Optional[Callable] = Field(default=None, description="任务执行函数")
    handler_name: Optional[str] = Field(default=None, description="处理函数名称（用于序列化）")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="任务元数据")
    active: bool = Field(default=True, description="任务是否启用")
    
    class Config:
        arbitrary_types_allowed = True
    
    @validator("task_id")
    def validate_task_id(cls, v):
        if not v or not v.strip():
            raise ValueError("task_id 不能为空")
        if len(v) > 255:
            raise ValueError("task_id 长度不能超过 255 字符")
        return v
    
    def generate_idempotency_hash(self, execution_date: date) -> str:
        key_parts = [self.task_id, execution_date.isoformat()]
        if self.idempotency_key:
            key_parts.append(str(self.idempotency_key))
        key_str = "|".join(key_parts)
        return hashlib.sha256(key_str.encode()).hexdigest()


class TaskResult(BaseModel):
    task_id: str
    status: TaskStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    output: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    error_traceback: Optional[str] = None
    retry_count: int = 0


class TaskExecutionRecord(BaseModel):
    execution_id: str
    task_id: str
    execution_date: date
    status: TaskStatus
    scheduled_time: datetime
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    result: Optional[TaskResult] = None
    idempotency_hash: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
        }


class DependencyGraph(BaseModel):
    tasks: Dict[str, Task] = Field(default_factory=dict)
    adjacency_list: Dict[str, List[str]] = Field(default_factory=dict)
    reverse_adjacency_list: Dict[str, List[str]] = Field(default_factory=dict)
    
    def add_task(self, task: Task) -> None:
        self.tasks[task.task_id] = task
        if task.task_id not in self.adjacency_list:
            self.adjacency_list[task.task_id] = []
        if task.task_id not in self.reverse_adjacency_list:
            self.reverse_adjacency_list[task.task_id] = []
        
        for dep in task.dependencies:
            if dep not in self.adjacency_list[task.task_id]:
                self.adjacency_list[task.task_id].append(dep)
            if task.task_id not in self.reverse_adjacency_list.get(dep, []):
                if dep not in self.reverse_adjacency_list:
                    self.reverse_adjacency_list[dep] = []
                self.reverse_adjacency_list[dep].append(task.task_id)
    
    def get_dependencies(self, task_id: str) -> List[str]:
        return self.adjacency_list.get(task_id, [])
    
    def get_dependents(self, task_id: str) -> List[str]:
        return self.reverse_adjacency_list.get(task_id, [])
    
    def topological_sort(self, task_ids: Optional[List[str]] = None) -> List[str]:
        if task_ids is None:
            task_ids = list(self.tasks.keys())
        
        in_degree = {}
        for task_id in task_ids:
            in_degree[task_id] = len([d for d in self.get_dependencies(task_id) if d in task_ids])
        
        queue = [task_id for task_id in task_ids if in_degree.get(task_id, 0) == 0]
        result = []
        
        while queue:
            current = queue.pop(0)
            result.append(current)
            
            for dependent in self.get_dependents(current):
                if dependent in task_ids:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        if len(result) != len(task_ids):
            remaining = set(task_ids) - set(result)
            raise ValueError(f"存在循环依赖，无法完成拓扑排序: {remaining}")
        
        return result
    
    def validate_no_cycles(self) -> bool:
        try:
            self.topological_sort()
            return True
        except ValueError:
            return False
    
    def get_transitive_dependencies(self, task_id: str) -> Set[str]:
        result = set()
        stack = [task_id]
        
        while stack:
            current = stack.pop()
            for dep in self.get_dependencies(current):
                if dep not in result:
                    result.add(dep)
                    stack.append(dep)
        
        return result


class CompensationStep(BaseModel):
    step_id: int
    task_id: str
    task_name: str
    execution_date: date
    estimated_duration: Optional[float] = None
    dependencies: List[str] = Field(default_factory=list)
    action: str = Field(default="execute", description="执行动作: execute/skip")
    reason: Optional[str] = None
    idempotency_check_needed: bool = Field(default=True)


class CompensationPlan(BaseModel):
    plan_id: str
    generated_at: datetime
    target_date: date
    missed_tasks: List[str] = Field(default_factory=list)
    steps: List[CompensationStep] = Field(default_factory=list)
    total_steps: int = 0
    estimated_total_duration: Optional[float] = None
    warnings: List[str] = Field(default_factory=list)


class FailureSample(BaseModel):
    sample_id: str
    task_id: str
    execution_date: date
    error_message: str
    error_traceback: Optional[str] = None
    input_data: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "task_id": self.task_id,
            "execution_date": self.execution_date.isoformat(),
            "error_message": self.error_message,
            "error_traceback": self.error_traceback,
            "input_data": self.input_data,
            "timestamp": self.timestamp.isoformat(),
        }


class ExecutionReport(BaseModel):
    report_id: str
    plan_id: str
    generated_at: datetime
    target_date: date
    total_tasks: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    cancelled_count: int = 0
    total_duration: float = 0.0
    task_results: List[TaskResult] = Field(default_factory=list)
    failure_samples: List[FailureSample] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    
    def get_success_rate(self) -> float:
        if self.total_tasks == 0:
            return 0.0
        return (self.success_count / self.total_tasks) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "plan_id": self.plan_id,
            "generated_at": self.generated_at.isoformat(),
            "target_date": self.target_date.isoformat(),
            "total_tasks": self.total_tasks,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "skipped_count": self.skipped_count,
            "cancelled_count": self.cancelled_count,
            "success_rate": f"{self.get_success_rate():.2f}%",
            "total_duration_seconds": self.total_duration,
            "recommendations": self.recommendations,
            "task_results": [
                {
                    "task_id": r.task_id,
                    "status": r.status.value,
                    "duration_seconds": r.duration,
                    "error_message": r.error_message,
                }
                for r in self.task_results
            ],
            "failure_samples": [f.to_dict() for f in self.failure_samples],
        }


class SystemConfig(BaseModel):
    data_dir: str = Field(default="./data")
    records_dir: str = Field(default="./data/records")
    reports_dir: str = Field(default="./data/reports")
    max_parallel_executions: int = Field(default=1)
    default_timeout: int = Field(default=3600)
    default_retries: int = Field(default=0)
    enable_idempotency_check: bool = Field(default=True)
    enable_dependency_validation: bool = Field(default=True)


class IdempotencyRecord(BaseModel):
    idempotency_hash: str
    task_id: str
    execution_date: date
    status: TaskStatus
    execution_record_id: Optional[str] = None
    output: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
