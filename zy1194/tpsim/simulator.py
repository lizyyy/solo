"""线程池模拟器核心逻辑"""

import random
from typing import List, Dict, Optional, Tuple, Any
from collections import deque
from dataclasses import dataclass, field

from .models import (
    Task, Worker, Producer, TimelineEvent, SimulationConfig, SimulationResult,
    TaskState, WorkerState, DropReason,
    WorkerStatistics, QueueStatistics, TaskStatistics, OptimizationSuggestion
)


class ThreadPoolSimulator:
    """线程池模拟器"""
    
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.current_time: float = 0.0
        
        # 初始化随机数生成器
        if config.seed is not None:
            random.seed(config.seed)
        
        # Worker 池
        self.workers: List[Worker] = []
        self._init_workers()
        
        # 全局队列
        self.global_queue: deque = deque()
        self.global_queue_capacity = config.global_queue_capacity
        
        # 任务管理
        self.all_tasks: Dict[str, Task] = {}
        self.task_dependencies: Dict[str, List[str]] = {}  # 反向依赖：task_id -> [等待它的任务]
        self.completed_tasks: set = set()
        
        # 生产者
        self.producers: List[Producer] = []
        self._init_producers()
        
        # 时间线事件
        self.timeline: List[TimelineEvent] = []
        
        # 统计数据
        self.stats = {
            "tasks_queued_global": 0,
            "tasks_dropped_global": 0,
            "tasks_stolen": 0,
            "steal_attempts": 0,
        }
        
        # 事件队列（用于事件驱动模拟）
        self.event_queue: List[Tuple[float, str, Dict]] = []
    
    def _init_workers(self):
        """初始化 Worker 线程"""
        for i in range(self.config.worker_count):
            worker = Worker(
                id=f"w-{i}",
                name=f"Worker-{i}",
                local_queue_capacity=self.config.local_queue_capacity,
                last_state_change=0.0
            )
            self.workers.append(worker)
    
    def _init_producers(self):
        """初始化生产者"""
        for i, producer_config in enumerate(self.config.producers):
            producer = Producer(
                id=f"p-{i}",
                name=producer_config.get("name", f"Producer-{i}"),
                production_rate=producer_config.get("production_rate", 1.0),
                task_template=producer_config.get("task_template", {})
            )
            self.producers.append(producer)
    
    def add_task(self, task: Task) -> bool:
        """添加任务到系统"""
        if task.id in self.all_tasks:
            return False
        
        self.all_tasks[task.id] = task
        
        # 记录反向依赖
        for dep_id in task.dependencies:
            if dep_id not in self.task_dependencies:
                self.task_dependencies[dep_id] = []
            self.task_dependencies[dep_id].append(task.id)
        
        # 检查是否就绪
        if task.is_ready:
            return self._enqueue_task(task)
        else:
            task.state = TaskState.BLOCKED
            self._add_timeline_event("task_blocked", task_id=task.id, details={
                "reason": "dependencies_pending",
                "dependencies": task.dependencies
            })
            return True
    
    def _enqueue_task(self, task: Task) -> bool:
        """将任务入队"""
        task.queued_time = self.current_time
        task.state = TaskState.QUEUED
        
        # 优先尝试放入本地队列（如果有空闲的 Worker）
        if self.config.use_work_stealing:
            idle_workers = [w for w in self.workers if w.state == WorkerState.IDLE]
            if idle_workers and task.producer_id:
                # 尝试找到与生产者关联的 Worker，或随机选择空闲 Worker
                target_worker = random.choice(idle_workers)
                if not target_worker.is_local_queue_full:
                    target_worker.local_queue.append(task)
                    self._add_timeline_event("task_enqueued_local", task_id=task.id, worker_id=target_worker.id)
                    return True
        
        # 放入全局队列
        if len(self.global_queue) < self.global_queue_capacity:
            self.global_queue.append(task)
            self.stats["tasks_queued_global"] += 1
            self._add_timeline_event("task_enqueued_global", task_id=task.id)
            return True
        else:
            # 队列已满，应用背压策略
            return self._apply_backpressure(task)
    
    def _apply_backpressure(self, task: Task) -> bool:
        """应用背压策略"""
        strategy = self.config.backpressure_strategy
        
        if strategy == "drop":
            task.state = TaskState.DROPPED
            task.drop_reason = DropReason.QUEUE_FULL
            self.stats["tasks_dropped_global"] += 1
            self._add_timeline_event("task_dropped", task_id=task.id, details={
                "reason": "queue_full",
                "strategy": "drop"
            })
            return False
        
        elif strategy == "block":
            # 在模拟中，阻塞意味着任务继续等待（但会有超时）
            if self.current_time - (task.created_time or 0) > self.config.max_queue_wait_time:
                task.state = TaskState.DROPPED
                task.drop_reason = DropReason.DEPENDENCY_TIMEOUT
                self._add_timeline_event("task_dropped", task_id=task.id, details={
                    "reason": "timeout",
                    "max_wait": self.config.max_queue_wait_time
                })
                return False
            # 否则继续尝试
            return True
        
        elif strategy == "reject":
            task.state = TaskState.DROPPED
            task.drop_reason = DropReason.WORKER_OVERLOAD
            self._add_timeline_event("task_rejected", task_id=task.id, details={
                "reason": "system_overload"
            })
            return False
        
        return False
    
    def _add_timeline_event(self, event_type: str, worker_id: Optional[str] = None,
                            task_id: Optional[str] = None, details: Optional[Dict] = None):
        """添加时间线事件"""
        event = TimelineEvent(
            timestamp=self.current_time,
            event_type=event_type,
            worker_id=worker_id,
            task_id=task_id,
            details=details or {}
        )
        self.timeline.append(event)
    
    def _get_worker_by_id(self, worker_id: str) -> Optional[Worker]:
        """根据 ID 获取 Worker"""
        for w in self.workers:
            if w.id == worker_id:
                return w
        return None
    
    def _check_dependencies(self, task_id: str):
        """检查并解锁依赖此任务的其他任务"""
        if task_id in self.task_dependencies:
            for waiting_task_id in self.task_dependencies[task_id]:
                waiting_task = self.all_tasks.get(waiting_task_id)
                if waiting_task and task_id in waiting_task.dependencies:
                    waiting_task.dependencies.remove(task_id)
                    if waiting_task.is_ready:
                        waiting_task.state = TaskState.PENDING
                        self._add_timeline_event("task_ready", task_id=waiting_task_id, details={
                            "unblocked_by": task_id
                        })
                        self._enqueue_task(waiting_task)
    
    def _schedule_event(self, time: float, event_type: str, details: Dict):
        """调度未来事件"""
        self.event_queue.append((time, event_type, details))
        # 保持事件队列按时间排序
        self.event_queue.sort(key=lambda x: x[0])
    
    def _work_steal(self, idle_worker: Worker) -> Optional[Task]:
        """工作窃取：从其他 Worker 的本地队列窃取任务"""
        if not self.config.use_work_stealing:
            return None
        
        self.stats["steal_attempts"] += 1
        idle_worker.steal_attempts += 1
        
        # 选择窃取目标
        steal_strategy = self.config.steal_from
        potential_victims = [w for w in self.workers if w.id != idle_worker.id and w.local_queue_size > 0]
        
        if not potential_victims:
            return None
        
        if steal_strategy == "most_loaded":
            # 从负载最重的 Worker 窃取
            victim = max(potential_victims, key=lambda w: w.local_queue_size)
        elif steal_strategy == "round_robin":
            # 简单实现：随机选择
            victim = random.choice(potential_victims)
        else:  # random
            victim = random.choice(potential_victims)
        
        # 从目标 Worker 的本地队列末尾窃取任务（双端队列策略）
        if victim.local_queue:
            stolen_task = victim.local_queue.pop()  # 从末尾窃取
            idle_worker.tasks_stolen += 1
            idle_worker.steal_successes += 1
            self.stats["tasks_stolen"] += 1
            
            self._add_timeline_event("work_stolen", worker_id=idle_worker.id, task_id=stolen_task.id, details={
                "stolen_from": victim.id,
                "victim_queue_size": len(victim.local_queue)
            })
            
            return stolen_task
        
        return None
    
    def _get_next_task(self, worker: Worker) -> Optional[Task]:
        """为 Worker 获取下一个任务"""
        # 1. 先检查本地队列
        if worker.local_queue:
            return worker.local_queue.popleft() if hasattr(worker.local_queue, 'popleft') else worker.local_queue.pop(0)
        
        # 2. 检查全局队列
        if self.global_queue:
            task = self.global_queue.popleft()
            self._add_timeline_event("task_from_global", worker_id=worker.id, task_id=task.id)
            return task
        
        # 3. 尝试工作窃取
        if self.config.use_work_stealing:
            stolen_task = self._work_steal(worker)
            if stolen_task:
                return stolen_task
        
        return None
    
    def _update_worker_state(self, worker: Worker, new_state: WorkerState, time_delta: float):
        """更新 Worker 状态并统计时间"""
        if worker.state == WorkerState.BUSY:
            worker.total_busy_time += time_delta
        elif worker.state == WorkerState.IDLE:
            worker.total_idle_time += time_delta
        
        worker.state = new_state
        worker.last_state_change = self.current_time
    
    def _process_task_completion(self, worker: Worker, task: Task):
        """处理任务完成"""
        task.end_time = self.current_time
        task.state = TaskState.COMPLETED
        self.completed_tasks.add(task.id)
        
        worker.tasks_completed += 1
        worker.current_task = None
        
        self._add_timeline_event("task_completed", worker_id=worker.id, task_id=task.id, details={
            "wait_time": task.wait_time,
            "turnaround_time": task.turnaround_time
        })
        
        # 检查并解锁依赖
        self._check_dependencies(task.id)
    
    def step(self, time_delta: float) -> bool:
        """执行一个时间步
        
        Args:
            time_delta: 时间增量
            
        Returns:
            是否还有活动需要继续模拟
        """
        self.current_time += time_delta
        
        # 1. 处理事件队列
        while self.event_queue and self.event_queue[0][0] <= self.current_time:
            event_time, event_type, details = self.event_queue.pop(0)
            
            if event_type == "task_finish":
                worker_id = details["worker_id"]
                task_id = details["task_id"]
                worker = self._get_worker_by_id(worker_id)
                task = self.all_tasks.get(task_id)
                
                if worker and task:
                    self._process_task_completion(worker, task)
                    self._update_worker_state(worker, WorkerState.IDLE, time_delta)
        
        # 2. 处理正在运行的任务
        for worker in self.workers:
            if worker.state == WorkerState.BUSY and worker.current_task:
                task = worker.current_task
                # 检查是否完成（在事件队列中处理）
                pass
            elif worker.state == WorkerState.IDLE:
                # 尝试获取新任务
                next_task = self._get_next_task(worker)
                if next_task:
                    worker.current_task = next_task
                    next_task.start_time = self.current_time
                    next_task.worker_id = worker.id
                    next_task.state = TaskState.RUNNING
                    
                    self._update_worker_state(worker, WorkerState.BUSY, time_delta)
                    
                    self._add_timeline_event("task_started", worker_id=worker.id, task_id=next_task.id)
                    
                    # 调度任务完成事件
                    finish_time = self.current_time + next_task.duration
                    self._schedule_event(finish_time, "task_finish", {
                        "worker_id": worker.id,
                        "task_id": next_task.id
                    })
        
        # 3. 检查饥饿任务
        for task in self.all_tasks.values():
            if task.state == TaskState.QUEUED and task.queued_time:
                wait_time = self.current_time - task.queued_time
                if wait_time > self.config.starvation_threshold:
                    if task.state != TaskState.STARVED:
                        task.state = TaskState.STARVED
                        self._add_timeline_event("task_starved", task_id=task.id, details={
                            "wait_time": wait_time,
                            "threshold": self.config.starvation_threshold
                        })
        
        # 4. 检查是否还有活动
        has_active_workers = any(w.state == WorkerState.BUSY for w in self.workers)
        has_pending_tasks = (len(self.global_queue) > 0 or 
                            any(len(w.local_queue) > 0 for w in self.workers))
        has_future_events = len(self.event_queue) > 0
        
        return has_active_workers or has_pending_tasks or has_future_events
    
    def run(self) -> SimulationResult:
        """运行完整模拟"""
        # 初始化：添加配置中的静态任务
        for i, task_config in enumerate(self.config.tasks):
            task = Task(
                id=task_config.get("id", f"t-{i}"),
                name=task_config.get("name", f"Task-{i}"),
                duration=task_config.get("duration", 1.0),
                priority=task_config.get("priority", 0),
                dependencies=task_config.get("dependencies", []),
                producer_id=task_config.get("producer_id", ""),
                created_time=self.current_time
            )
            self.add_task(task)
        
        # 模拟主循环
        time_delta = 0.1  # 时间步长
        end_time = self.current_time + self.config.simulation_duration
        
        while self.current_time < end_time:
            has_activity = self.step(time_delta)
            if not has_activity and not self.producers:
                break
        
        # 计算最终统计
        return self._compute_results()
    
    def _compute_results(self) -> SimulationResult:
        """计算模拟结果"""
        # Worker 统计
        worker_stats = []
        for worker in self.workers:
            # 更新最后一段时间
            time_since_last_change = self.current_time - worker.last_state_change
            if worker.state == WorkerState.BUSY:
                worker.total_busy_time += time_since_last_change
            elif worker.state == WorkerState.IDLE:
                worker.total_idle_time += time_since_last_change
            
            steal_rate = (worker.steal_successes / worker.steal_attempts 
                        if worker.steal_attempts > 0 else 0.0)
            
            worker_stats.append(WorkerStatistics(
                worker_id=worker.id,
                worker_name=worker.name,
                state=worker.state,
                tasks_completed=worker.tasks_completed,
                tasks_stolen=worker.tasks_stolen,
                steal_attempts=worker.steal_attempts,
                steal_success_rate=steal_rate,
                total_busy_time=worker.total_busy_time,
                total_idle_time=worker.total_idle_time,
                utilization=worker.utilization,
                local_queue_size=worker.local_queue_size,
                local_queue_capacity=worker.local_queue_capacity
            ))
        
        # 队列统计
        queue_stats = []
        
        # 全局队列统计
        global_utilization = (len(self.global_queue) / self.global_queue_capacity 
                            if self.global_queue_capacity > 0 else 0)
        queue_stats.append(QueueStatistics(
            queue_type="global",
            worker_id=None,
            current_size=len(self.global_queue),
            capacity=self.global_queue_capacity,
            utilization=global_utilization,
            tasks_queued=self.stats["tasks_queued_global"],
            tasks_dropped=self.stats["tasks_dropped_global"],
            avg_wait_time=0.0,  # 需要更详细计算
            max_wait_time=0.0
        ))
        
        # 本地队列统计
        for worker in self.workers:
            local_utilization = (worker.local_queue_size / worker.local_queue_capacity
                                if worker.local_queue_capacity > 0 else 0)
            queue_stats.append(QueueStatistics(
                queue_type="local",
                worker_id=worker.id,
                current_size=worker.local_queue_size,
                capacity=worker.local_queue_capacity,
                utilization=local_utilization,
                tasks_queued=0,
                tasks_dropped=0,
                avg_wait_time=0.0,
                max_wait_time=0.0
            ))
        
        # 任务统计
        completed = sum(1 for t in self.all_tasks.values() if t.state == TaskState.COMPLETED)
        dropped = sum(1 for t in self.all_tasks.values() if t.state == TaskState.DROPPED)
        starved = sum(1 for t in self.all_tasks.values() if t.state == TaskState.STARVED)
        blocked = sum(1 for t in self.all_tasks.values() if t.state == TaskState.BLOCKED)
        pending = len(self.all_tasks) - completed - dropped
        
        # 计算等待时间统计
        completed_tasks = [t for t in self.all_tasks.values() if t.state == TaskState.COMPLETED]
        wait_times = [t.wait_time for t in completed_tasks if t.wait_time > 0]
        turnaround_times = [t.turnaround_time for t in completed_tasks if t.turnaround_time > 0]
        
        avg_wait = sum(wait_times) / len(wait_times) if wait_times else 0.0
        max_wait = max(wait_times) if wait_times else 0.0
        avg_turnaround = sum(turnaround_times) / len(turnaround_times) if turnaround_times else 0.0
        max_turnaround = max(turnaround_times) if turnaround_times else 0.0
        
        # 吞吐量
        throughput = completed / self.current_time if self.current_time > 0 else 0.0
        
        task_stats = TaskStatistics(
            total_tasks=len(self.all_tasks),
            completed=completed,
            dropped=dropped,
            starved=starved,
            blocked=blocked,
            pending=pending,
            avg_wait_time=avg_wait,
            max_wait_time=max_wait,
            avg_turnaround_time=avg_turnaround,
            max_turnaround_time=max_turnaround,
            throughput=throughput
        )
        
        # 生成调优建议
        suggestions = self._generate_suggestions(worker_stats, task_stats)
        
        return SimulationResult(
            config=self.config,
            timeline=self.timeline,
            worker_stats=worker_stats,
            queue_stats=queue_stats,
            task_stats=task_stats,
            suggestions=suggestions,
            raw_data={
                "final_time": self.current_time,
                "steal_attempts": self.stats["steal_attempts"],
                "tasks_stolen": self.stats["tasks_stolen"],
            }
        )
    
    def _generate_suggestions(self, worker_stats: List[WorkerStatistics], 
                              task_stats: TaskStatistics) -> List[OptimizationSuggestion]:
        """生成调优建议"""
        suggestions = []
        
        # 1. 检查 Worker 利用率
        avg_utilization = sum(w.utilization for w in worker_stats) / len(worker_stats) if worker_stats else 0
        
        if avg_utilization < 0.3:
            suggestions.append(OptimizationSuggestion(
                category="worker_count",
                severity="warning",
                suggestion="Worker 利用率过低，考虑减少 Worker 数量",
                expected_improvement="提高资源利用率，减少上下文切换",
                current_value=f"{self.config.worker_count} 个 Worker，平均利用率 {avg_utilization:.1%}",
                recommended_value="根据实际负载调整，目标利用率 60%-80%"
            ))
        elif avg_utilization > 0.9:
            suggestions.append(OptimizationSuggestion(
                category="worker_count",
                severity="critical",
                suggestion="Worker 利用率过高，系统可能过载",
                expected_improvement="提高系统响应能力，减少任务积压",
                current_value=f"{self.config.worker_count} 个 Worker，平均利用率 {avg_utilization:.1%}",
                recommended_value="增加 Worker 数量，或检查是否有任务阻塞"
            ))
        
        # 2. 检查任务丢弃
        if task_stats.dropped > 0:
            drop_rate = task_stats.dropped / task_stats.total_tasks
            suggestions.append(OptimizationSuggestion(
                category="queue_capacity",
                severity="critical" if drop_rate > 0.1 else "warning",
                suggestion=f"存在任务丢弃（丢弃率 {drop_rate:.1%}）",
                expected_improvement="减少任务丢失，提高系统可靠性",
                current_value=f"丢弃 {task_stats.dropped} 个任务，当前背压策略: {self.config.backpressure_strategy}",
                recommended_value="增加队列容量，或调整背压策略为 'block'"
            ))
        
        # 3. 检查饥饿任务
        if task_stats.starved > 0:
            suggestions.append(OptimizationSuggestion(
                category="scheduling",
                severity="warning",
                suggestion=f"存在 {task_stats.starved} 个饥饿任务",
                expected_improvement="提高任务调度公平性",
                current_value=f"饥饿阈值: {self.config.starvation_threshold}",
                recommended_value="启用优先级调度，或增加 Worker 数量"
            ))
        
        # 4. 检查工作窃取效果
        if self.config.use_work_stealing:
            steal_attempts = sum(w.steal_attempts for w in worker_stats)
            steal_successes = sum(w.steal_successes for w in worker_stats)
            
            if steal_attempts > 0:
                steal_rate = steal_successes / steal_attempts
                if steal_rate < 0.2:
                    suggestions.append(OptimizationSuggestion(
                        category="work_stealing",
                        severity="info",
                        suggestion="工作窃取成功率较低",
                        expected_improvement="提高负载均衡效果",
                        current_value=f"窃取成功率: {steal_rate:.1%}",
                        recommended_value="考虑调整窃取策略（当前: {self.config.steal_from}）"
                    ))
        
        # 5. 检查等待时间
        if task_stats.avg_wait_time > 5.0:
            suggestions.append(OptimizationSuggestion(
                category="performance",
                severity="warning",
                suggestion="任务平均等待时间过长",
                expected_improvement="减少任务响应时间",
                current_value=f"平均等待时间: {task_stats.avg_wait_time:.2f}",
                recommended_value="增加 Worker 数量，或优化任务调度策略"
            ))
        
        return suggestions
