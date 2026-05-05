"""结果分析器"""

from typing import List, Dict, Any, Optional
from dataclasses import asdict

from .models import (
    SimulationResult, TaskStatistics, WorkerStatistics,
    QueueStatistics, OptimizationSuggestion, TimelineEvent,
    WorkerState, TaskState
)


class ResultAnalyzer:
    """模拟结果分析器"""
    
    def __init__(self, result: SimulationResult):
        self.result = result
    
    def get_overview(self) -> Dict[str, Any]:
        """获取模拟概览"""
        task_stats = self.result.task_stats
        worker_stats = self.result.worker_stats
        
        # 计算平均 Worker 利用率
        avg_utilization = (sum(w.utilization for w in worker_stats) / len(worker_stats)
                          if worker_stats else 0.0)
        
        # 计算任务成功率
        success_rate = (task_stats.completed / task_stats.total_tasks
                       if task_stats.total_tasks > 0 else 1.0)
        
        return {
            "simulation_duration": self.result.raw_data.get("final_time", 0),
            "total_tasks": task_stats.total_tasks,
            "completed_tasks": task_stats.completed,
            "dropped_tasks": task_stats.dropped,
            "starved_tasks": task_stats.starved,
            "success_rate": success_rate,
            "throughput": task_stats.throughput,
            "avg_wait_time": task_stats.avg_wait_time,
            "avg_turnaround_time": task_stats.avg_turnaround_time,
            "worker_count": len(worker_stats),
            "avg_worker_utilization": avg_utilization,
            "work_stealing_enabled": self.result.config.use_work_stealing,
            "total_steal_attempts": self.result.raw_data.get("steal_attempts", 0),
            "total_tasks_stolen": self.result.raw_data.get("tasks_stolen", 0),
        }
    
    def get_worker_utilization_details(self) -> List[Dict[str, Any]]:
        """获取 Worker 利用率详情"""
        details = []
        for ws in self.result.worker_stats:
            details.append({
                "worker_id": ws.worker_id,
                "worker_name": ws.worker_name,
                "state": ws.state.name,
                "tasks_completed": ws.tasks_completed,
                "tasks_stolen": ws.tasks_stolen,
                "steal_attempts": ws.steal_attempts,
                "steal_success_rate": ws.steal_success_rate,
                "busy_time": ws.total_busy_time,
                "idle_time": ws.total_idle_time,
                "utilization": ws.utilization,
                "local_queue_size": ws.local_queue_size,
                "local_queue_capacity": ws.local_queue_capacity,
            })
        return details
    
    def get_queue_analysis(self) -> Dict[str, Any]:
        """获取队列分析"""
        global_queues = [q for q in self.result.queue_stats if q.queue_type == "global"]
        local_queues = [q for q in self.result.queue_stats if q.queue_type == "local"]
        
        # 计算队列背压指标
        global_queue = global_queues[0] if global_queues else None
        
        return {
            "global_queue": {
                "current_size": global_queue.current_size if global_queue else 0,
                "capacity": global_queue.capacity if global_queue else 0,
                "utilization": global_queue.utilization if global_queue else 0,
                "tasks_queued": global_queue.tasks_queued if global_queue else 0,
                "tasks_dropped": global_queue.tasks_dropped if global_queue else 0,
            },
            "local_queues": [
                {
                    "worker_id": q.worker_id,
                    "current_size": q.current_size,
                    "capacity": q.capacity,
                    "utilization": q.utilization,
                }
                for q in local_queues
            ],
            "total_tasks_dropped": self.result.task_stats.dropped,
            "backpressure_strategy": self.result.config.backpressure_strategy,
        }
    
    def get_timeline_summary(self, max_events: int = 100) -> List[Dict[str, Any]]:
        """获取时间线摘要"""
        events = self.result.timeline
        
        # 按事件类型统计
        event_counts: Dict[str, int] = {}
        for event in events:
            event_counts[event.event_type] = event_counts.get(event.event_type, 0) + 1
        
        # 选择关键事件进行展示
        key_event_types = {
            "task_enqueued_global", "task_enqueued_local",
            "task_started", "task_completed",
            "task_dropped", "task_starved", "task_blocked",
            "work_stolen",
        }
        
        key_events = [e for e in events if e.event_type in key_event_types]
        
        # 如果事件太多，按时间均匀采样
        if len(key_events) > max_events:
            step = len(key_events) // max_events
            key_events = key_events[::step]
        
        summary_events = []
        for event in key_events:
            summary_events.append({
                "timestamp": event.timestamp,
                "event_type": event.event_type,
                "worker_id": event.worker_id,
                "task_id": event.task_id,
                "details": event.details,
            })
        
        return summary_events
    
    def get_bottleneck_analysis(self) -> Dict[str, Any]:
        """瓶颈分析"""
        bottlenecks = []
        
        task_stats = self.result.task_stats
        worker_stats = self.result.worker_stats
        
        # 1. 检查 Worker 利用率不平衡
        if len(worker_stats) > 1:
            utilizations = [w.utilization for w in worker_stats]
            max_util = max(utilizations)
            min_util = min(utilizations)
            util_diff = max_util - min_util
            
            if util_diff > 0.3:
                bottlenecks.append({
                    "type": "worker_imbalance",
                    "severity": "warning" if util_diff > 0.5 else "info",
                    "description": "Worker 负载不平衡",
                    "details": {
                        "max_utilization": max_util,
                        "min_utilization": min_util,
                        "difference": util_diff,
                        "suggestion": "考虑启用工作窃取或调整任务分配策略"
                    }
                })
        
        # 2. 检查任务丢弃
        if task_stats.dropped > 0:
            drop_rate = task_stats.dropped / task_stats.total_tasks
            bottlenecks.append({
                "type": "task_dropping",
                "severity": "critical" if drop_rate > 0.1 else "warning",
                "description": f"任务丢弃率 {drop_rate:.1%}",
                "details": {
                    "dropped_tasks": task_stats.dropped,
                    "total_tasks": task_stats.total_tasks,
                    "drop_rate": drop_rate,
                    "backpressure_strategy": self.result.config.backpressure_strategy,
                    "suggestion": "增加队列容量或调整背压策略"
                }
            })
        
        # 3. 检查饥饿任务
        if task_stats.starved > 0:
            bottlenecks.append({
                "type": "starvation",
                "severity": "warning",
                "description": f"存在 {task_stats.starved} 个饥饿任务",
                "details": {
                    "starved_tasks": task_stats.starved,
                    "starvation_threshold": self.result.config.starvation_threshold,
                    "suggestion": "增加 Worker 数量或启用优先级调度"
                }
            })
        
        # 4. 检查平均等待时间
        if task_stats.avg_wait_time > 5.0:
            bottlenecks.append({
                "type": "high_wait_time",
                "severity": "warning",
                "description": f"任务平均等待时间过长",
                "details": {
                    "avg_wait_time": task_stats.avg_wait_time,
                    "max_wait_time": task_stats.max_wait_time,
                    "suggestion": "增加 Worker 数量或优化任务调度"
                }
            })
        
        return {
            "bottlenecks": bottlenecks,
            "total_bottlenecks": len(bottlenecks),
            "critical_count": sum(1 for b in bottlenecks if b["severity"] == "critical"),
            "warning_count": sum(1 for b in bottlenecks if b["severity"] == "warning"),
        }
    
    def get_suggestions_summary(self) -> List[Dict[str, Any]]:
        """获取调优建议摘要"""
        suggestions = []
        for s in self.result.suggestions:
            suggestions.append({
                "category": s.category,
                "severity": s.severity,
                "suggestion": s.suggestion,
                "expected_improvement": s.expected_improvement,
                "current_value": str(s.current_value),
                "recommended_value": str(s.recommended_value),
            })
        
        # 按严重程度排序
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        suggestions.sort(key=lambda x: severity_order.get(x["severity"], 3))
        
        return suggestions
    
    def get_full_analysis(self) -> Dict[str, Any]:
        """获取完整分析报告"""
        return {
            "overview": self.get_overview(),
            "worker_details": self.get_worker_utilization_details(),
            "queue_analysis": self.get_queue_analysis(),
            "timeline_summary": self.get_timeline_summary(),
            "bottleneck_analysis": self.get_bottleneck_analysis(),
            "suggestions": self.get_suggestions_summary(),
            "config": asdict(self.result.config),
        }
