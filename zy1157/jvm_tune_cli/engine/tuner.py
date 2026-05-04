"""
JVM Tuner - Generates tuning recommendations based on analysis
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import logging

from ..models.gc_event import GCEvent, GCEventType
from ..models.jvm_options import JVMOptions, GCCollector
from ..models.analysis import AnalysisResult
from ..models.tuning_policy import (
    TuningResult, TuningRecommendation, TuningParameter,
    RiskLevel, RecommendationType, SimulationResult
)

logger = logging.getLogger(__name__)


class JVMTuner:
    def __init__(self):
        self.base_options: Optional[JVMOptions] = None
        self.base_analysis: Optional[AnalysisResult] = None
        self.base_events: List[GCEvent] = []
        self.simulation_results: List[SimulationResult] = []
        
        self._container_memory_limit: int = 0
        self._slo_config: Dict[str, Any] = {}
    
    def set_base_data(
        self,
        options: JVMOptions,
        analysis: Optional[AnalysisResult] = None,
        events: List[GCEvent] = None,
        container_memory_limit: int = 0
    ):
        self.base_options = options
        self.base_analysis = analysis
        self.base_events = events or []
        self._container_memory_limit = container_memory_limit
        
        self._set_default_slo()
    
    def _set_default_slo(self):
        self._slo_config = {
            'max_pause_ms': 200,
            'max_gc_overhead_percent': 10,
            'max_full_gc_per_hour': 1,
            'memory_headroom_min_percent': 15
        }
    
    def set_slo_config(self, config: Dict[str, Any]):
        self._slo_config.update(config)
    
    def add_simulation_result(self, result: SimulationResult):
        self.simulation_results.append(result)
    
    def tune(self) -> TuningResult:
        if not self.base_options:
            raise ValueError("No base JVM options set")
        
        recommendations = self._generate_recommendations()
        
        recommended_options = self._build_recommended_options(recommendations)
        
        container_reserve = self._calculate_container_reserve()
        
        summary = self._build_summary(recommendations)
        
        return TuningResult(
            timestamp=datetime.now(),
            original_jvm_options=self.base_options.to_dict(),
            recommended_jvm_options=recommended_options,
            recommendations=recommendations,
            simulations=self.simulation_results,
            container_memory_reserve_recommendation=container_reserve,
            summary=summary
        )
    
    def _generate_recommendations(self) -> List[TuningRecommendation]:
        recommendations: List[TuningRecommendation] = []
        
        if not self.base_analysis:
            return self._generate_basic_recommendations()
        
        pause_stats = self.base_analysis.pause_stats
        heap_stats = self.base_analysis.heap_stats
        container_stats = self.base_analysis.container_stats
        
        max_pause_slo = self._slo_config.get('max_pause_ms', 200)
        max_overhead = self._slo_config.get('max_gc_overhead_percent', 10)
        max_full_gc = self._slo_config.get('max_full_gc_per_hour', 1)
        min_headroom = self._slo_config.get('memory_headroom_min_percent', 15)
        
        if pause_stats.full_gc_count > 0:
            total_runtime_hours = pause_stats.total_runtime_ms / (1000 * 3600)
            full_gc_rate = pause_stats.full_gc_count / total_runtime_hours if total_runtime_hours > 0 else 0
            
            if full_gc_rate > max_full_gc:
                rec = self._create_full_gc_recommendation(full_gc_rate, pause_stats)
                if rec:
                    recommendations.append(rec)
        
        if pause_stats.pause_ms_max > max_pause_slo:
            rec = self._create_pause_slo_recommendation(pause_stats, max_pause_slo)
            if rec:
                recommendations.append(rec)
        
        if pause_stats.gc_overhead_percent > max_overhead:
            rec = self._create_overhead_recommendation(pause_stats, max_overhead)
            if rec:
                recommendations.append(rec)
        
        if pause_stats.humongous_allocation_count > 0:
            rec = self._create_humongous_recommendation(pause_stats)
            if rec:
                recommendations.append(rec)
        
        if pause_stats.promotion_failure_count > 0:
            rec = self._create_promotion_failure_recommendation(pause_stats)
            if rec:
                recommendations.append(rec)
        
        if container_stats.memory_limit_bytes > 0:
            headroom_percent = (container_stats.memory_headroom_min_bytes / container_stats.memory_limit_bytes * 100)
            if headroom_percent < min_headroom:
                rec = self._create_container_reserve_recommendation(container_stats, headroom_percent, min_headroom)
                if rec:
                    recommendations.append(rec)
            
            heap_ratio = container_stats.jvm_heap_vs_container_ratio
            if heap_ratio > 0.85 and self.base_options:
                rec = self._create_heap_container_ratio_recommendation(heap_ratio, self.base_options.xmx_bytes, container_stats.memory_limit_bytes)
                if rec:
                    recommendations.append(rec)
        
        if self.base_options:
            conflicts = self.base_options.validate()
            for conflict in conflicts:
                rec = self._create_parameter_conflict_recommendation(conflict)
                if rec:
                    recommendations.append(rec)
        
        return sorted(recommendations, key=lambda r: {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.INFO: 4
        }[r.risk_level])
    
    def _generate_basic_recommendations(self) -> List[TuningRecommendation]:
        recommendations: List[TuningRecommendation] = []
        
        if not self.base_options:
            return recommendations
        
        if self.base_options.xmx_bytes == 0:
            recommendations.append(TuningRecommendation(
                id="RECOMMEND_001",
                type=RecommendationType.HEAP_SIZE,
                risk_level=RiskLevel.HIGH,
                priority=1,
                title="建议设置堆内存限制",
                description="当前未设置 -Xmx，JVM 可能会使用过多内存导致容器 OOM Killed。",
                root_cause="未设置 -Xmx 堆内存上限",
                impact="存在容器被 OOM Killed 的风险",
                current_config="-Xmx 未设置",
                recommended_config="-Xmx4g (根据容器内存调整)",
                parameters=[
                    TuningParameter(
                        name="-Xmx",
                        current_value=None,
                        recommended_value="4g",
                        unit="GB",
                        description="最大堆内存大小"
                    )
                ]
            ))
        
        if self.base_options.xms_bytes > 0 and self.base_options.xmx_bytes > 0:
            if self.base_options.xms_bytes != self.base_options.xmx_bytes:
                recommendations.append(TuningRecommendation(
                    id="RECOMMEND_002",
                    type=RecommendationType.HEAP_SIZE,
                    risk_level=RiskLevel.MEDIUM,
                    priority=2,
                    title="建议固定堆内存大小",
                description="堆内存初始值和最大值不一致，可能导致运行时调整带来的性能波动。",
                root_cause="-Xms != -Xmx",
                impact="可能引起 GC 行为不稳定和性能波动",
                current_config=f"-Xms{self.base_options.xms_bytes // (1024**3)}g -Xmx{self.base_options.xmx_bytes // (1024**3)}g",
                recommended_config=f"-Xms{self.base_options.xmx_bytes // (1024**3)}g -Xmx{self.base_options.xmx_bytes // (1024**3)}g",
                parameters=[
                    TuningParameter(
                        name="-Xms",
                        current_value=self.base_options.xms_bytes // (1024**3),
                        recommended_value=self.base_options.xmx_bytes // (1024**3),
                        unit="GB",
                        description="初始堆内存大小"
                    )
                ]
            ))
        
        if self.base_options.max_metaspace_size_bytes is None:
            recommendations.append(TuningRecommendation(
                id="RECOMMEND_003",
                type=RecommendationType.METASPACE,
                risk_level=RiskLevel.LOW,
                priority=3,
                title="建议设置元空间上限",
                description="元空间未设置上限，在容器环境中可能导致 Native 内存耗尽。",
                root_cause="-XX:MaxMetaspaceSize 未设置",
                impact="元空间可能无限增长",
                current_config="未设置 -XX:MaxMetaspaceSize",
                recommended_config="-XX:MaxMetaspaceSize=256m",
                parameters=[
                    TuningParameter(
                        name="-XX:MaxMetaspaceSize",
                        current_value=None,
                        recommended_value=256,
                        unit="MB",
                        description="最大元空间大小"
                    )
                ]
            ))
        
        return recommendations
    
    def _create_full_gc_recommendation(self, rate: float, stats) -> Optional[TuningRecommendation]:
        level = RiskLevel.CRITICAL if rate > 5 else RiskLevel.HIGH
        
        return TuningRecommendation(
            id="RECOMMEND_FULL_GC",
            type=RecommendationType.GC_COLLECTOR,
            risk_level=level,
            priority=1,
            title="Full GC 频繁",
            description=f"检测到 Full GC 频率为 {rate:.2f}/小时，超过阈值。",
            root_cause="老年代空间不足、大对象分配或元空间耗尽",
            impact="长时间 Stop-The-World 暂停，接口抖动",
            current_config=f"当前 Full GC 频率: {rate:.2f}/小时",
            recommended_config="增加堆内存、调整老年代比例或考虑 ZGC/Shenandoah",
            parameters=[
                TuningParameter(
                    name="堆内存大小",
                    current_value=self.base_options.xmx_bytes // (1024**3) if self.base_options else None,
                    recommended_value="增加 50%",
                    unit="GB",
                    description="增加堆内存减少 Full GC 频率"
                ),
                TuningParameter(
                    name="GC 收集器",
                    current_value=self.base_options.gc_collector.value if self.base_options else "Unknown",
                    recommended_value="考虑 ZGC 或 Shenandoah",
                    description="低延迟收集器可以避免 Full GC"
                )
            ]
        )
    
    def _create_pause_slo_recommendation(self, stats, slo_ms: float) -> Optional[TuningRecommendation]:
        level = RiskLevel.HIGH if stats.pause_ms_max > slo_ms * 1.5 else RiskLevel.MEDIUM
        
        return TuningRecommendation(
            id="RECOMMEND_PAUSE_SLO",
            type=RecommendationType.PAUSE_TARGET,
            risk_level=level,
            priority=2,
            title="GC 暂停时间超过 SLO",
            description=f"最大暂停时间 {stats.pause_ms_max:.2f}ms 超过 SLO 阈值 {slo_ms}ms。",
            root_cause="暂停目标设置不合理或堆内存配置不当",
            impact="接口响应抖动，用户体验差",
            current_config=f"MaxGCPauseMillis: {self.base_options.max_gc_pause_millis if self.base_options else '默认'}, 实际暂停: {stats.pause_ms_max:.2f}ms",
            recommended_config="调整 MaxGCPauseMillis 或使用低延迟收集器",
            parameters=[
                TuningParameter(
                    name="-XX:MaxGCPauseMillis",
                    current_value=self.base_options.max_gc_pause_millis if self.base_options else None,
                    recommended_value=slo_ms,
                    unit="ms",
                    description="目标最大 GC 暂停时间"
                )
            ]
        )
    
    def _create_overhead_recommendation(self, stats, max_overhead: float) -> Optional[TuningRecommendation]:
        level = RiskLevel.HIGH if stats.gc_overhead_percent > 15 else RiskLevel.MEDIUM
        
        return TuningRecommendation(
            id="RECOMMEND_OVERHEAD",
            type=RecommendationType.HEAP_SIZE,
            risk_level=level,
            priority=3,
            title="GC 开销过高",
            description=f"GC 开销 {stats.gc_overhead_percent:.2f}% 超过阈值 {max_overhead}%。",
            root_cause="堆内存过小或对象分配率过高",
            impact="应用吞吐量下降，CPU 使用率高",
            current_config=f"GC 开销: {stats.gc_overhead_percent:.2f}%",
            recommended_config="增加堆内存或优化对象分配",
            parameters=[
                TuningParameter(
                    name="堆内存",
                    current_value=self.base_options.xmx_bytes // (1024**3) if self.base_options else None,
                    recommended_value="增加 25-50%",
                    unit="GB",
                    description="增加堆内存减少 GC 频率"
                )
            ]
        )
    
    def _create_humongous_recommendation(self, stats) -> Optional[TuningRecommendation]:
        level = RiskLevel.HIGH if stats.humongous_allocation_count > 10 else RiskLevel.MEDIUM
        
        return TuningRecommendation(
            id="RECOMMEND_HUMONGOUS",
            type=RecommendationType.REGION_SIZE,
            risk_level=level,
            priority=4,
            title="大对象分配频繁",
            description=f"检测到 {stats.humongous_allocation_count} 次大对象 (Humongous) 分配。",
            root_cause="存在大于 Region 一半的对象分配",
            impact="导致老年代碎片化，触发 Full GC",
            current_config=f"Region 大小: {self.base_options.g1_heap_region_size_bytes // (1024**2) if self.base_options and self.base_options.g1_heap_region_size_bytes else '默认'} MB",
            recommended_config="增加 Region 大小或优化代码减少大对象",
            parameters=[
                TuningParameter(
                    name="-XX:G1HeapRegionSize",
                    current_value=self.base_options.g1_heap_region_size_bytes // (1024**2) if self.base_options and self.base_options.g1_heap_region_size_bytes else None,
                    recommended_value="加倍或使用推荐值",
                    unit="MB",
                    description="G1 Region 大小，大对象阈值为 Region 的一半"
                )
            ]
        )
    
    def _create_promotion_failure_recommendation(self, stats) -> Optional[TuningRecommendation]:
        return TuningRecommendation(
            id="RECOMMEND_PROMOTION",
            type=RecommendationType.YOUNG_GEN,
            risk_level=RiskLevel.CRITICAL,
            priority=1,
            title="晋升失败",
            description=f"检测到 {stats.promotion_failure_count} 次晋升失败。",
            root_cause="老年代空间不足或碎片化严重",
            impact="触发 Full GC，长时间暂停",
            current_config=f"晋升失败次数: {stats.promotion_failure_count}",
            recommended_config="增加堆内存、调整老年代比例或使用低延迟收集器",
            parameters=[
                TuningParameter(
                    name="堆内存",
                    current_value=self.base_options.xmx_bytes // (1024**3) if self.base_options else None,
                    recommended_value="增加 50%",
                    unit="GB",
                    description="增加整体堆内存"
                ),
                TuningParameter(
                    name="GC 收集器",
                    current_value=self.base_options.gc_collector.value if self.base_options else "Unknown",
                    recommended_value="ZGC 或 Shenandoah",
                    description="低延迟收集器使用不同的晋升机制"
                )
            ]
        )
    
    def _create_container_reserve_recommendation(
        self,
        container_stats,
        headroom_percent: float,
        min_headroom: float
    ) -> Optional[TuningRecommendation]:
        return TuningRecommendation(
            id="RECOMMEND_CONTAINER_RESERVE",
            type=RecommendationType.CONTAINER_RESERVE,
            risk_level=RiskLevel.HIGH,
            priority=2,
            title="容器内存预留不足",
            description=f"最小内存余量 {headroom_percent:.1f}% 低于建议值 {min_headroom}%。",
            root_cause="堆内存配置过大，未预留足够的 Native 内存",
            impact="存在 OOM Killed 风险",
            current_config=f"容器限制: {container_stats.memory_limit_bytes // (1024**3)}GB, 堆大小: {self.base_options.xmx_bytes // (1024**3) if self.base_options else '未知'}GB",
            recommended_config="建议堆内存不超过容器内存的 75%",
            parameters=[
                TuningParameter(
                    name="堆/容器比例",
                    current_value=f"{container_stats.jvm_heap_vs_container_ratio * 100:.1f}%",
                    recommended_value="<= 75%",
                    description="堆内存占容器内存的比例"
                )
            ]
        )
    
    def _create_heap_container_ratio_recommendation(
        self,
        ratio: float,
        heap_bytes: int,
        container_bytes: int
    ) -> Optional[TuningRecommendation]:
        return TuningRecommendation(
            id="RECOMMEND_HEAP_RATIO",
            type=RecommendationType.CONTAINER_RESERVE,
            risk_level=RiskLevel.HIGH,
            priority=3,
            title="堆内存比例过高",
            description=f"堆内存占容器内存的比例为 {ratio*100:.1f}%，超过建议的 75%。",
            root_cause="-Xmx 配置过大",
            impact="Native 内存不足，可能导致 OOM Killed",
            current_config=f"堆大小: {heap_bytes // (1024**3)}GB, 容器限制: {container_bytes // (1024**3)}GB, 比例: {ratio*100:.1f}%",
            recommended_config=f"建议堆大小: {int(container_bytes * 0.75) // (1024**3)}GB",
            parameters=[
                TuningParameter(
                    name="-Xmx",
                    current_value=heap_bytes // (1024**3),
                    recommended_value=int(container_bytes * 0.75) // (1024**3),
                    unit="GB",
                    description="最大堆内存大小"
                )
            ]
        )
    
    def _create_parameter_conflict_recommendation(self, conflict: str) -> Optional[TuningRecommendation]:
        return TuningRecommendation(
            id="RECOMMEND_PARAM_CONFLICT",
            type=RecommendationType.ADVANCED,
            risk_level=RiskLevel.MEDIUM,
            priority=5,
            title="JVM 参数冲突",
            description="检测到 JVM 参数配置冲突或不合理。",
            root_cause="参数配置矛盾",
            impact="可能导致预期外的 GC 行为",
            current_config=conflict,
            recommended_config="修正冲突的参数配置",
            parameters=[]
        )
    
    def _build_recommended_options(self, recommendations: List[TuningRecommendation]) -> Dict[str, Any]:
        if not self.base_options:
            return {}
        
        opts = self.base_options.to_dict()
        changes: Dict[str, Any] = {}
        
        for rec in recommendations:
            for param in rec.parameters:
                if param.needs_change and param.recommended_value is not None:
                    changes[param.name] = param.recommended_value
        
        if "-Xmx" in changes:
            val = changes["-Xmx"]
            if isinstance(val, (int, float)):
                opts["xmx_bytes"] = int(val) * (1024**3)
                opts["xmx_gb"] = float(val)
                if opts.get("xms_bytes") != opts["xmx_bytes"]:
                    opts["xms_bytes"] = opts["xmx_bytes"]
                    opts["xms_gb"] = opts["xmx_gb"]
        
        if "-XX:MaxGCPauseMillis" in changes:
            opts["max_gc_pause_millis"] = int(changes["-XX:MaxGCPauseMillis"])
        
        if "-XX:G1HeapRegionSize" in changes:
            val = changes["-XX:G1HeapRegionSize"]
            if isinstance(val, (int, float)):
                opts["g1_heap_region_size_bytes"] = int(val) * (1024**2)
                opts["g1_heap_region_size_mb"] = float(val)
        
        return opts
    
    def _calculate_container_reserve(self) -> Optional[Dict[str, Any]]:
        if not self._container_memory_limit and self.base_analysis:
            self._container_memory_limit = self.base_analysis.container_stats.memory_limit_bytes
        
        if not self._container_memory_limit:
            return None
        
        heap_bytes = self.base_options.xmx_bytes if self.base_options else 0
        
        recommended_heap = int(self._container_memory_limit * 0.75)
        min_reserve = int(self._container_memory_limit * 0.15)
        current_reserve = self._container_memory_limit - heap_bytes
        
        return {
            "container_limit_bytes": self._container_memory_limit,
            "container_limit_gb": round(self._container_memory_limit / (1024**3), 2),
            "current_heap_bytes": heap_bytes,
            "current_heap_gb": round(heap_bytes / (1024**3), 2),
            "current_reserve_bytes": current_reserve,
            "current_reserve_gb": round(current_reserve / (1024**3), 2),
            "current_reserve_percent": round(current_reserve / self._container_memory_limit * 100, 2),
            "recommended_heap_bytes": recommended_heap,
            "recommended_heap_gb": round(recommended_heap / (1024**3), 2),
            "recommended_reserve_bytes": self._container_memory_limit - recommended_heap,
            "recommended_reserve_gb": round((self._container_memory_limit - recommended_heap) / (1024**3), 2),
            "min_reserve_percent": 15,
            "max_heap_ratio": 0.75
        }
    
    def _build_summary(self, recommendations: List[TuningRecommendation]) -> Dict[str, Any]:
        critical = [r for r in recommendations if r.risk_level == RiskLevel.CRITICAL]
        high = [r for r in recommendations if r.risk_level == RiskLevel.HIGH]
        medium = [r for r in recommendations if r.risk_level == RiskLevel.MEDIUM]
        
        overall_status = "Good"
        if critical:
            overall_status = "Critical"
        elif high:
            overall_status = "Poor"
        elif medium:
            overall_status = "Fair"
        
        top_actions = []
        for r in recommendations[:3]:
            top_actions.append({
                "priority": r.priority,
                "risk_level": r.risk_level.value,
                "title": r.title,
                "recommended_config": r.recommended_config
            })
        
        return {
            "overall_status": overall_status,
            "recommendation_summary": {
                "critical": len(critical),
                "high": len(high),
                "medium": len(medium),
                "low": len([r for r in recommendations if r.risk_level == RiskLevel.LOW])
            },
            "top_recommended_actions": top_actions,
            "simulation_count": len(self.simulation_results)
        }
