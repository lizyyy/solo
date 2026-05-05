"""数据模型定义"""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional, List, Dict, Any
from datetime import datetime


class TaskState(Enum):
    """任务状态"""
    PENDING = auto()      # 待执行
    QUEUED = auto()       # 已入队
    RUNNING = auto()      # 运行中
    COMPLETED = auto()    # 已完成
    DROPPED = auto()      # 已丢弃（背压）
    BLOCKED = auto()      # 被阻塞（依赖未满足）
    STARVED = auto()      # 饥饿（长时间未被调度）


class WorkerState(Enum):
    """Worker 状态"""
    IDLE = auto()         # 空闲
    BUSY = auto()         # 忙碌
    STEALING = auto()     # 工作窃取中
    BLOCKED = auto()      # 阻塞（等待任务）


class DropReason(Enum):
    """任务丢弃原因"""
    QUEUE_FULL = auto()           # 队列已满
    DEPENDENCY_TIMEOUT = auto()   # 依赖超时
    WORKER_OVERLOAD = auto()      # Worker 过载


@dataclass
class Task:
    """任务定义"""
    id: str
    name: str = ""
    duration: float = 1.0          # 执行耗时（单位：模拟时间单位）
    priority: int = 0              # 优先级（越大优先级越高）
    dependencies: List[str] = field(default_factory=list)  # 依赖的任务 ID
    producer_id: str = ""          # 生产者 ID
    created_time: float = 0.0      # 创建时间
    queued_time: Optional[float] = None    # 入队时间
    start_time: Optional[float] = None      # 开始执行时间
    end_time: Optional[float] = None        # 结束时间
    state: TaskState = TaskState.PENDING
    worker_id: Optional[str] = None         # 执行的 Worker ID
    drop_reason: Optional[DropReason] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def wait_time(self) -> float:
        """等待时间"""
        if self.queued_time is None or self.start_time is None:
            return 0.0
        return self.start_time - self.queued_time

    @property
    def turnaround_time(self) -> float:
        """周转时间"""
        if self.created_time is None or self.end_time is None:
            return 0.0
        return self.end_time - self.created_time

    @property
    def is_ready(self) -> bool:
        """是否就绪（依赖都已完成）"""
        return len(self.dependencies) == 0


@dataclass
class Worker:
    """工作线程"""
    id: str
    name: str = ""
    state: WorkerState = WorkerState.IDLE
    current_task: Optional[Task] = None
    local_queue: List[Task] = field(default_factory=list)
    local_queue_capacity: int = 10
    tasks_completed: int = 0
    tasks_stolen: int = 0
    total_busy_time: float = 0.0
    total_idle_time: float = 0.0
    last_state_change: float = 0.0
    steal_attempts: int = 0
    steal_successes: int = 0

    @property
    def local_queue_size(self) -> int:
        return len(self.local_queue)

    @property
    def is_local_queue_full(self) -> bool:
        return len(self.local_queue) >= self.local_queue_capacity

    @property
    def utilization(self) -> float:
        """利用率"""
        total = self.total_busy_time + self.total_idle_time
        if total == 0:
            return 0.0
        return self.total_busy_time / total


@dataclass
class Producer:
    """任务生产者"""
    id: str
    name: str = ""
    production_rate: float = 1.0    # 生产速率（单位时间任务数）
    tasks_produced: int = 0
    last_production_time: float = 0.0
    task_template: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelineEvent:
    """时间线事件"""
    timestamp: float
    event_type: str
    worker_id: Optional[str] = None
    task_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationConfig:
    """模拟配置"""
    # 线程池配置
    worker_count: int = 4
    local_queue_capacity: int = 10
    global_queue_capacity: int = 100
    
    # 队列策略
    use_work_stealing: bool = True
    steal_from: str = "random"  # random, round_robin, most_loaded
    
    # 背压策略
    backpressure_strategy: str = "drop"  # drop, block, reject
    max_queue_wait_time: float = 60.0    # 最大等待时间（超时则丢弃）
    
    # 饥饿检测
    starvation_threshold: float = 30.0    # 饥饿阈值（等待时间超过则视为饥饿）
    
    # 模拟时长
    simulation_duration: float = 100.0
    
    # 随机种子（用于可复现）
    seed: Optional[int] = None
    
    # 任务配置
    tasks: List[Dict[str, Any]] = field(default_factory=list)
    producers: List[Dict[str, Any]] = field(default_factory=list)
    
    # 输出配置
    verbose: bool = False


@dataclass
class WorkerStatistics:
    """Worker 统计信息"""
    worker_id: str
    worker_name: str
    state: WorkerState
    tasks_completed: int
    tasks_stolen: int
    steal_attempts: int
    steal_success_rate: float
    total_busy_time: float
    total_idle_time: float
    utilization: float
    local_queue_size: int
    local_queue_capacity: int


@dataclass
class QueueStatistics:
    """队列统计信息"""
    queue_type: str  # global, local
    worker_id: Optional[str]
    current_size: int
    capacity: int
    utilization: float
    tasks_queued: int
    tasks_dropped: int
    avg_wait_time: float
    max_wait_time: float


@dataclass
class TaskStatistics:
    """任务统计信息"""
    total_tasks: int
    completed: int
    dropped: int
    starved: int
    blocked: int
    pending: int
    avg_wait_time: float
    max_wait_time: float
    avg_turnaround_time: float
    max_turnaround_time: float
    throughput: float  # 任务数/单位时间


@dataclass
class OptimizationSuggestion:
    """调优建议"""
    category: str  # worker_count, queue_capacity, strategy, etc.
    severity: str  # critical, warning, info
    suggestion: str
    expected_improvement: str
    current_value: Any
    recommended_value: Any


@dataclass
class SimulationResult:
    """模拟结果"""
    config: SimulationConfig
    timeline: List[TimelineEvent]
    worker_stats: List[WorkerStatistics]
    queue_stats: List[QueueStatistics]
    task_stats: TaskStatistics
    suggestions: List[OptimizationSuggestion]
    raw_data: Dict[str, Any] = field(default_factory=dict)
