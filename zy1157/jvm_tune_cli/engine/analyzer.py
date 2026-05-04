"""
JVM Analysis Engine - Analyzes GC events, metrics, and identifies risks
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import statistics
import logging

from ..models.gc_event import GCEvent, GCEventType
from ..models.metrics import PodMetrics, TrafficMetrics
from ..models.jvm_options import JVMOptions
from ..models.analysis import (
    AnalysisResult, GCPauseStatistics, HeapStatistics,
    ContainerStatistics, TrafficStatistics, RiskFactor, RiskCategory
)
from ..models.tuning_policy import RiskLevel

logger = logging.getLogger(__name__)


class JVMAnalyzer:
    def __init__(self):
        self.gc_events: List[GCEvent] = []
        self.pod_metrics: List[PodMetrics] = []
        self.traffic_metrics: List[TrafficMetrics] = []
        self.jvm_options: Optional[JVMOptions] = None
        self.slo_config: Dict[str, Any] = {}
        
        self._set_default_slo()
    
    def _set_default_slo(self):
        self.slo_config = {
            'max_pause_ms': 200,
            'max_gc_overhead_percent': 10,
            'max_full_gc_per_hour': 1,
            'memory_headroom_min_percent': 15
        }
    
    def set_gc_events(self, events: List[GCEvent]):
        self.gc_events = sorted(events, key=lambda e: e.timestamp)
    
    def set_pod_metrics(self, metrics: List[PodMetrics]):
        self.pod_metrics = sorted(metrics, key=lambda m: m.timestamp)
    
    def set_traffic_metrics(self, metrics: List[TrafficMetrics]):
        self.traffic_metrics = sorted(metrics, key=lambda m: m.timestamp)
    
    def set_jvm_options(self, options: JVMOptions):
        self.jvm_options = options
    
    def set_slo_config(self, config: Dict[str, Any]):
        self.slo_config.update(config)
    
    def analyze(self) -> AnalysisResult:
        pause_stats = self._calculate_pause_statistics()
        heap_stats = self._calculate_heap_statistics()
        container_stats = self._calculate_container_statistics()
        traffic_stats = self._calculate_traffic_statistics()
        
        risk_factors = self._identify_risk_factors(pause_stats, heap_stats, container_stats, traffic_stats)
        parameter_conflicts = self._identify_parameter_conflicts()
        
        summary = self._generate_summary(pause_stats, heap_stats, container_stats, traffic_stats, risk_factors)
        
        return AnalysisResult(
            timestamp=datetime.now(),
            pause_stats=pause_stats,
            heap_stats=heap_stats,
            container_stats=container_stats,
            traffic_stats=traffic_stats,
            risk_factors=risk_factors,
            parameter_conflicts=parameter_conflicts,
            summary=summary
        )
    
    def _calculate_pause_statistics(self) -> GCPauseStatistics:
        if not self.gc_events:
            return GCPauseStatistics(
                total_gc_count=0,
                total_pause_ms=0,
                total_runtime_ms=0,
                pause_ms_p50=0,
                pause_ms_p95=0,
                pause_ms_p99=0,
                pause_ms_max=0,
                pause_ms_mean=0,
                throughput_percent=100,
                gc_overhead_percent=0,
                young_gc_count=0,
                young_gc_total_ms=0,
                full_gc_count=0,
                full_gc_total_ms=0,
                mixed_gc_count=0,
                mixed_gc_total_ms=0,
                humongous_allocation_count=0,
                promotion_failure_count=0
            )
        
        stw_events = [e for e in self.gc_events if e.is_stop_the_world and e.duration_ms > 0]
        
        if not stw_events:
            stw_events = self.gc_events
        
        durations = [e.duration_ms for e in stw_events]
        
        young_gcs = [e for e in self.gc_events if e.event_type == GCEventType.YOUNG_GC]
        full_gcs = [e for e in self.gc_events if e.event_type == GCEventType.FULL_GC]
        mixed_gcs = [e for e in self.gc_events if e.event_type == GCEventType.MIXED_GC]
        humongous = [e for e in self.gc_events if e.event_type == GCEventType.HUMONGOUS_ALLOCATION]
        promotion_failures = [e for e in self.gc_events if e.event_type == GCEventType.PROMOTION_FAILED]
        
        total_runtime_ms = self._calculate_total_runtime()
        total_pause_ms = sum(durations)
        
        gc_overhead = (total_pause_ms / total_runtime_ms * 100) if total_runtime_ms > 0 else 0
        throughput = 100 - gc_overhead
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        return GCPauseStatistics(
            total_gc_count=len(self.gc_events),
            total_pause_ms=total_pause_ms,
            total_runtime_ms=total_runtime_ms,
            pause_ms_p50=percentile(durations, 50),
            pause_ms_p95=percentile(durations, 95),
            pause_ms_p99=percentile(durations, 99),
            pause_ms_max=max(durations) if durations else 0,
            pause_ms_mean=statistics.mean(durations) if durations else 0,
            throughput_percent=throughput,
            gc_overhead_percent=gc_overhead,
            young_gc_count=len(young_gcs),
            young_gc_total_ms=sum(e.duration_ms for e in young_gcs),
            full_gc_count=len(full_gcs),
            full_gc_total_ms=sum(e.duration_ms for e in full_gcs),
            mixed_gc_count=len(mixed_gcs),
            mixed_gc_total_ms=sum(e.duration_ms for e in mixed_gcs),
            humongous_allocation_count=len(humongous),
            promotion_failure_count=len(promotion_failures)
        )
    
    def _calculate_total_runtime(self) -> float:
        if len(self.gc_events) < 2:
            return 3600000
        
        first = self.gc_events[0].timestamp
        last = self.gc_events[-1].timestamp
        return (last - first).total_seconds() * 1000 or 3600000
    
    def _calculate_heap_statistics(self) -> HeapStatistics:
        heap_events = [e for e in self.gc_events if e.heap_max_bytes > 0]
        
        if not heap_events:
            heap_max = self.jvm_options.xmx_bytes if self.jvm_options else 0
            return HeapStatistics(
                heap_max_bytes=heap_max,
                heap_peak_bytes=0,
                heap_avg_bytes=0,
                heap_usage_percent_p50=0,
                heap_usage_percent_p95=0,
                heap_usage_percent_p99=0,
                young_gen_peak_bytes=0,
                old_gen_peak_bytes=0,
                avg_reclaimed_per_gc_bytes=0,
                avg_reclaimed_per_gc_percent=0
            )
        
        heap_max = heap_events[0].heap_max_bytes
        heap_used_list = [e.heap_before_bytes for e in heap_events]
        heap_reclaimed_list = [e.heap_reclaimed_bytes for e in heap_events]
        heap_reclaimed_percent_list = [e.heap_reclaimed_percent for e in heap_events]
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        heap_usage_percents = [
            (h / heap_max * 100) if heap_max > 0 else 0 
            for h in heap_used_list
        ]
        
        young_list = [e.young_before_bytes for e in heap_events if e.young_before_bytes > 0]
        old_list = [e.old_before_bytes for e in heap_events if e.old_before_bytes > 0]
        
        return HeapStatistics(
            heap_max_bytes=heap_max,
            heap_peak_bytes=max(heap_used_list) if heap_used_list else 0,
            heap_avg_bytes=int(statistics.mean(heap_used_list)) if heap_used_list else 0,
            heap_usage_percent_p50=percentile(heap_usage_percents, 50),
            heap_usage_percent_p95=percentile(heap_usage_percents, 95),
            heap_usage_percent_p99=percentile(heap_usage_percents, 99),
            young_gen_peak_bytes=max(young_list) if young_list else 0,
            old_gen_peak_bytes=max(old_list) if old_list else 0,
            avg_reclaimed_per_gc_bytes=int(statistics.mean(heap_reclaimed_list)) if heap_reclaimed_list else 0,
            avg_reclaimed_per_gc_percent=statistics.mean(heap_reclaimed_percent_list) if heap_reclaimed_percent_list else 0
        )
    
    def _calculate_container_statistics(self) -> ContainerStatistics:
        if not self.pod_metrics:
            return ContainerStatistics(
                memory_limit_bytes=0,
                memory_peak_bytes=0,
                memory_avg_bytes=0,
                memory_headroom_min_bytes=0,
                memory_headroom_avg_bytes=0,
                oom_kill_risk_percent=0,
                jvm_heap_vs_container_ratio=0
            )
        
        memory_limit = self.pod_metrics[0].memory_limit_bytes
        working_set_list = [m.memory_working_set_bytes for m in self.pod_metrics]
        headroom_list = [m.memory_headroom_bytes for m in self.pod_metrics]
        
        jvm_heap_used_list = [m.jvm_heap_used_bytes for m in self.pod_metrics if m.jvm_heap_used_bytes > 0]
        
        high_usage_count = sum(1 for m in self.pod_metrics if m.memory_usage_percent >= 90)
        oom_risk = (high_usage_count / len(self.pod_metrics) * 100) if self.pod_metrics else 0
        
        jvm_heap_max = self.jvm_options.xmx_bytes if self.jvm_options else 0
        heap_container_ratio = (jvm_heap_max / memory_limit) if memory_limit > 0 else 0
        
        return ContainerStatistics(
            memory_limit_bytes=memory_limit,
            memory_peak_bytes=max(working_set_list) if working_set_list else 0,
            memory_avg_bytes=int(statistics.mean(working_set_list)) if working_set_list else 0,
            memory_headroom_min_bytes=min(headroom_list) if headroom_list else 0,
            memory_headroom_avg_bytes=int(statistics.mean(headroom_list)) if headroom_list else 0,
            oom_kill_risk_percent=oom_risk,
            jvm_heap_vs_container_ratio=heap_container_ratio
        )
    
    def _calculate_traffic_statistics(self) -> Optional[TrafficStatistics]:
        if not self.traffic_metrics:
            return None
        
        rps_list = [t.requests_per_second for t in self.traffic_metrics]
        p99_list = [t.response_time_ms_p99 for t in self.traffic_metrics]
        error_list = [t.error_rate for t in self.traffic_metrics]
        
        gc_timestamps = [e.timestamp for e in self.gc_events if e.duration_ms > 100]
        traffic_correlated = False
        for gc_ts in gc_timestamps:
            for t in self.traffic_metrics:
                time_diff = abs((t.timestamp - gc_ts).total_seconds())
                if time_diff < 60 and t.requests_per_second > 0:
                    traffic_correlated = True
                    break
        
        return TrafficStatistics(
            peak_rps=max(rps_list) if rps_list else 0,
            avg_rps=statistics.mean(rps_list) if rps_list else 0,
            peak_response_ms_p99=max(p99_list) if p99_list else 0,
            avg_response_ms_p99=statistics.mean(p99_list) if p99_list else 0,
            peak_error_rate=max(error_list) if error_list else 0,
            traffic_correlated_gc=traffic_correlated
        )
    
    def _identify_risk_factors(
        self,
        pause_stats: GCPauseStatistics,
        heap_stats: HeapStatistics,
        container_stats: ContainerStatistics,
        traffic_stats: Optional[TrafficStatistics]
    ) -> List[RiskFactor]:
        risks: List[RiskFactor] = []
        
        max_pause_slo = self.slo_config.get('max_pause_ms', 200)
        max_overhead = self.slo_config.get('max_gc_overhead_percent', 10)
        max_full_gc_per_hour = self.slo_config.get('max_full_gc_per_hour', 1)
        min_headroom = self.slo_config.get('memory_headroom_min_percent', 15)
        
        total_runtime_hours = pause_stats.total_runtime_ms / (1000 * 3600)
        full_gc_rate = pause_stats.full_gc_count / total_runtime_hours if total_runtime_hours > 0 else 0
        
        if pause_stats.full_gc_count > 0:
            risk = RiskFactor(
                id="FULL_GC_DETECTED",
                category=RiskCategory.FULL_GC,
                level=RiskLevel.CRITICAL if full_gc_rate > max_full_gc_per_hour else RiskLevel.HIGH,
                title="Full GC 事件检测",
                description=f"检测到 {pause_stats.full_gc_count} 次 Full GC，这会导致长时间的 Stop-The-World 暂停。",
                evidence=f"Full GC 计数: {pause_stats.full_gc_count}, 总耗时: {pause_stats.full_gc_total_ms:.2f}ms, 频率: {full_gc_rate:.2f}/小时",
                count=pause_stats.full_gc_count
            )
            full_gc_events = [e for e in self.gc_events if e.event_type == GCEventType.FULL_GC]
            if full_gc_events:
                risk.first_seen = full_gc_events[0].timestamp
                risk.last_seen = full_gc_events[-1].timestamp
                risk.related_events = [e.to_dict() for e in full_gc_events[:5]]
            risks.append(risk)
        
        if pause_stats.pause_ms_max > max_pause_slo:
            risk = RiskFactor(
                id="PAUSE_SLO_VIOLATION",
                category=RiskCategory.PAUSE_SLO_VIOLATION,
                level=RiskLevel.HIGH if pause_stats.pause_ms_max > max_pause_slo * 1.5 else RiskLevel.MEDIUM,
                title="GC 暂停时间 SLO 超标",
                description=f"GC 暂停时间超过设定的 SLO 阈值 {max_pause_slo}ms。",
                evidence=f"最大暂停: {pause_stats.pause_ms_max:.2f}ms, P99: {pause_stats.pause_ms_p99:.2f}ms, P95: {pause_stats.pause_ms_p95:.2f}ms, SLO阈值: {max_pause_slo}ms",
                count=sum(1 for e in self.gc_events if e.duration_ms > max_pause_slo)
            )
            risks.append(risk)
        
        if pause_stats.gc_overhead_percent > max_overhead:
            risk = RiskFactor(
                id="GC_OVERHEAD_HIGH",
                category=RiskCategory.PAUSE_SLO_VIOLATION,
                level=RiskLevel.HIGH if pause_stats.gc_overhead_percent > 15 else RiskLevel.MEDIUM,
                title="GC 开销过高",
                description=f"GC 开销比例超过阈值 {max_overhead}%，这会影响应用吞吐量。",
                evidence=f"GC 开销: {pause_stats.gc_overhead_percent:.2f}%, 吞吐量: {pause_stats.throughput_percent:.2f}%, 阈值: {max_overhead}%",
                count=1
            )
            risks.append(risk)
        
        if pause_stats.humongous_allocation_count > 0:
            risk = RiskFactor(
                id="HUMONGOUS_ALLOCATION",
                category=RiskCategory.HUMONGOUS_ALLOCATION,
                level=RiskLevel.HIGH if pause_stats.humongous_allocation_count > 10 else RiskLevel.MEDIUM,
                title="大对象分配检测",
                description=f"检测到 {pause_stats.humongous_allocation_count} 次大对象 (Humongous) 分配，这会导致频繁的 GC 问题。",
                evidence=f"大对象分配计数: {pause_stats.humongous_allocation_count}",
                count=pause_stats.humongous_allocation_count
            )
            risks.append(risk)
        
        if pause_stats.promotion_failure_count > 0:
            risk = RiskFactor(
                id="PROMOTION_FAILURE",
                category=RiskCategory.PROMOTION_FAILURE,
                level=RiskLevel.CRITICAL,
                title="晋升失败检测",
                description=f"检测到 {pause_stats.promotion_failure_count} 次晋升失败，这通常意味着老年代空间不足或碎片化严重。",
                evidence=f"晋升失败计数: {pause_stats.promotion_failure_count}",
                count=pause_stats.promotion_failure_count
            )
            risks.append(risk)
        
        if container_stats.oom_kill_risk_percent > 0:
            risk = RiskFactor(
                id="OOM_KILL_RISK",
                category=RiskCategory.OOM_RISK,
                level=RiskLevel.CRITICAL if container_stats.oom_kill_risk_percent > 50 else RiskLevel.HIGH,
                title="OOM Killed 风险",
                description="容器内存使用率接近限制，存在被 OOM Killed 的风险。",
                evidence=f"内存使用峰值: {container_stats.memory_peak_bytes / (1024**3):.2f}GB, "
                        f"限制: {container_stats.memory_limit_bytes / (1024**3):.2f}GB, "
                        f"OOM风险比例: {container_stats.oom_kill_risk_percent:.2f}%",
                count=int(container_stats.oom_kill_risk_percent / 10)
            )
            risks.append(risk)
        
        container_limit = container_stats.memory_limit_bytes
        heap_max = self.jvm_options.xmx_bytes if self.jvm_options else 0
        if heap_max > 0 and container_limit > 0:
            heap_ratio = heap_max / container_limit
            if heap_ratio > 0.85:
                risk = RiskFactor(
                    id="HEAP_CONTAINER_MISMATCH",
                    category=RiskCategory.CONTAINER_MISMATCH,
                    level=RiskLevel.HIGH if heap_ratio > 0.9 else RiskLevel.MEDIUM,
                    title="堆内存与容器内存不匹配",
                    description=f"JVM 堆内存 ({heap_ratio*100:.1f}%) 占容器内存比例过高，没有预留足够的 Native 内存空间。",
                    evidence=f"堆大小: {heap_max / (1024**3):.2f}GB, "
                            f"容器限制: {container_limit / (1024**3):.2f}GB, "
                            f"比例: {heap_ratio*100:.1f}%, 建议最大 75%",
                    count=1
                )
                risks.append(risk)
        
        if heap_stats.heap_usage_percent_p99 > 90:
            risk = RiskFactor(
                id="HEAP_PRESSURE_HIGH",
                category=RiskCategory.OOM_RISK,
                level=RiskLevel.HIGH,
                title="堆内存压力过高",
                description=f"堆内存使用接近上限，P99 使用率超过 90%。",
                evidence=f"堆 P99 使用率: {heap_stats.heap_usage_percent_p99:.2f}%, "
                        f"峰值: {heap_stats.heap_peak_bytes / (1024**3):.2f}GB",
                count=1
            )
            risks.append(risk)
        
        if self.jvm_options:
            conflicts = self.jvm_options.validate()
            for conflict in conflicts:
                risk = RiskFactor(
                    id=f"PARAM_CONFLICT_{len(risks)}",
                    category=RiskCategory.PARAMETER_CONFLICT,
                    level=RiskLevel.MEDIUM,
                    title="JVM 参数冲突",
                    description="检测到 JVM 参数配置冲突或不合理。",
                    evidence=conflict,
                    count=1
                )
                risks.append(risk)
        
        return sorted(risks, key=lambda r: {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.INFO: 4
        }[r.level])
    
    def _identify_parameter_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        
        if not self.jvm_options:
            return conflicts
        
        if self.jvm_options.disable_explicit_gc and self.jvm_options.explicit_gc_invokes_concurrent:
            conflicts.append({
                "parameter1": "-XX:+DisableExplicitGC",
                "parameter2": "-XX:+ExplicitGCInvokesConcurrent",
                "conflict": "两个参数互斥，同时设置会导致行为不一致",
                "recommendation": "只保留一个，建议使用 -XX:+ExplicitGCInvokesConcurrent"
            })
        
        if self.jvm_options.is_g1:
            if self.jvm_options.new_ratio is not None or self.jvm_options.survivor_ratio is not None:
                conflicts.append({
                    "parameter1": "-XX:NewRatio/-XX:SurvivorRatio",
                    "parameter2": "G1 GC",
                    "conflict": "G1 GC 不推荐使用固定的新生代比例设置，会影响 G1 的自动调优能力",
                    "recommendation": "移除 -XX:NewRatio 和 -XX:SurvivorRatio，让 G1 自动管理"
                })
        
        if self.jvm_options.xms_bytes > 0 and self.jvm_options.xmx_bytes > 0:
            if self.jvm_options.xms_bytes != self.jvm_options.xmx_bytes:
                conflicts.append({
                    "parameter1": "-Xms",
                    "parameter2": "-Xmx",
                    "conflict": "堆内存初始值和最大值不一致，可能导致运行时调整带来的性能波动",
                    "recommendation": "设置 -Xms 等于 -Xmx 以避免运行时堆调整"
                })
        
        return conflicts
    
    def _generate_summary(
        self,
        pause_stats: GCPauseStatistics,
        heap_stats: HeapStatistics,
        container_stats: ContainerStatistics,
        traffic_stats: Optional[TrafficStatistics],
        risks: List[RiskFactor]
    ) -> Dict[str, Any]:
        critical_risks = [r for r in risks if r.level == RiskLevel.CRITICAL]
        high_risks = [r for r in risks if r.level == RiskLevel.HIGH]
        medium_risks = [r for r in risks if r.level == RiskLevel.MEDIUM]
        
        overall_health = "Good"
        if critical_risks:
            overall_health = "Critical"
        elif high_risks:
            overall_health = "Poor"
        elif medium_risks:
            overall_health = "Fair"
        
        return {
            "overall_health": overall_health,
            "risk_summary": {
                "critical": len(critical_risks),
                "high": len(high_risks),
                "medium": len(medium_risks),
                "low": len([r for r in risks if r.level == RiskLevel.LOW])
            },
            "gc_summary": {
                "total_gc_count": pause_stats.total_gc_count,
                "full_gc_count": pause_stats.full_gc_count,
                "max_pause_ms": round(pause_stats.pause_ms_max, 2),
                "gc_overhead_percent": round(pause_stats.gc_overhead_percent, 2)
            },
            "memory_summary": {
                "heap_max_gb": round(heap_stats.heap_max_bytes / (1024**3), 2),
                "container_limit_gb": round(container_stats.memory_limit_bytes / (1024**3), 2),
                "oom_risk_percent": round(container_stats.oom_kill_risk_percent, 2)
            },
            "recommended_actions": self._generate_recommended_actions(risks)
        }
    
    def _generate_recommended_actions(self, risks: List[RiskFactor]) -> List[str]:
        actions = []
        
        critical_risks = [r for r in risks if r.level == RiskLevel.CRITICAL]
        high_risks = [r for r in risks if r.level == RiskLevel.HIGH]
        
        for risk in critical_risks:
            if risk.category == RiskCategory.FULL_GC:
                actions.append("立即调查 Full GC 原因 - 检查老年代空间、元数据区或大对象分配")
            elif risk.category == RiskCategory.PROMOTION_FAILURE:
                actions.append("处理晋升失败 - 考虑增加堆内存、调整老年代比例或更换 GC 收集器")
            elif risk.category == RiskCategory.OOM_RISK:
                actions.append("立即处理 OOM 风险 - 增加容器内存或减少堆内存配置")
        
        for risk in high_risks:
            if risk.category == RiskCategory.PAUSE_SLO_VIOLATION:
                actions.append("优化 GC 暂停时间 - 调整 MaxGCPauseMillis 或考虑使用 ZGC")
            elif risk.category == RiskCategory.HUMONGOUS_ALLOCATION:
                actions.append("优化大对象分配 - 检查是否有大于 Region 一半的对象分配")
            elif risk.category == RiskCategory.CONTAINER_MISMATCH:
                actions.append("调整堆内存与容器内存比例 - 建议堆不超过容器内存的 75%")
        
        if not actions:
            actions.append("当前配置整体良好，继续监控 GC 指标")
        
        return actions
