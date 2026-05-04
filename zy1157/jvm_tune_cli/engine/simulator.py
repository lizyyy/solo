"""
GC Collector Simulator - Simulates different GC configurations
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import statistics
import logging

from ..models.gc_event import GCEvent, GCEventType
from ..models.jvm_options import JVMOptions, GCCollector
from ..models.analysis import AnalysisResult, GCPauseStatistics
from ..models.tuning_policy import (
    SimulationResult, RiskLevel, RecommendationType,
    TuningRecommendation, TuningParameter
)

logger = logging.getLogger(__name__)


class GCCollectorSimulator:
    def __init__(self):
        self.base_events: List[GCEvent] = []
        self.base_analysis: Optional[AnalysisResult] = None
        self.base_options: Optional[JVMOptions] = None
    
    def set_base_data(
        self,
        events: List[GCEvent],
        analysis: Optional[AnalysisResult] = None,
        options: Optional[JVMOptions] = None
    ):
        self.base_events = sorted(events, key=lambda e: e.timestamp)
        self.base_analysis = analysis
        self.base_options = options
    
    def simulate_g1(
        self,
        heap_size_bytes: int,
        region_size_bytes: int = 0,
        max_pause_millis: int = 200,
        young_percent: int = 0,
        max_young_percent: int = 60
    ) -> SimulationResult:
        if not self.base_events:
            return self._create_empty_simulation("G1 GC Simulation")
        
        base_stats = self._get_base_stats()
        heap_ratio = heap_size_bytes / base_stats["heap_max_bytes"] if base_stats["heap_max_bytes"] > 0 else 1.0
        
        if region_size_bytes == 0:
            region_size_bytes = self._calculate_optimal_region_size(heap_size_bytes)
        
        young_actual_percent = young_percent or 30
        young_size_bytes = heap_size_bytes * young_actual_percent / 100
        
        base_pauses = [e.duration_ms for e in self.base_events if e.is_stop_the_world and e.duration_ms > 0]
        if not base_pauses:
            base_pauses = [50.0]
        
        region_count = heap_size_bytes // region_size_bytes
        
        region_effect = self._calculate_region_effect(region_count)
        
        pause_multiplier = self._calculate_pause_multiplier(heap_ratio, max_pause_millis, young_actual_percent)
        
        simulated_pauses = [p * pause_multiplier * region_effect for p in base_pauses]
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        humongous_count = self._predict_humongous_allocations(heap_size_bytes, region_size_bytes)
        full_gc_count = self._predict_full_gc_count(heap_ratio, base_stats["full_gc_count"])
        promotion_failures = self._predict_promotion_failures(young_size_bytes, base_stats["promotion_failure_count"])
        
        slo_violation = any(p > max_pause_millis * 1.2 for p in simulated_pauses)
        
        return SimulationResult(
            scenario_name=f"G1 GC - {heap_size_bytes // (1024**3)}GB Heap",
            target_gc_collector=GCCollector.G1,
            simulated_pause_ms_p50=percentile(simulated_pauses, 50),
            simulated_pause_ms_p95=percentile(simulated_pauses, 95),
            simulated_pause_ms_p99=percentile(simulated_pauses, 99),
            simulated_max_pause_ms=max(simulated_pauses) if simulated_pauses else 0,
            simulated_throughput=100 - (base_stats["gc_overhead_percent"] * pause_multiplier),
            simulated_heap_usage_percent=base_stats["heap_usage_p99"] / heap_ratio if heap_ratio > 0 else 70,
            expected_full_gc_count=full_gc_count,
            expected_humongous_allocations=humongous_count,
            expected_promotion_failures=promotion_failures,
            is_slo_violation_expected=slo_violation,
            parameters={
                "heap_size_gb": round(heap_size_bytes / (1024**3), 2),
                "region_size_mb": round(region_size_bytes / (1024**2), 2),
                "max_pause_millis": max_pause_millis,
                "young_percent": young_actual_percent,
                "max_young_percent": max_young_percent,
                "region_count": region_count,
                "pause_multiplier": round(pause_multiplier, 3),
                "region_effect": round(region_effect, 3)
            }
        )
    
    def simulate_zgc(
        self,
        heap_size_bytes: int,
        max_pause_millis: int = 200,
        use_large_pages: bool = False
    ) -> SimulationResult:
        if not self.base_events:
            return self._create_empty_simulation("ZGC Simulation")
        
        base_stats = self._get_base_stats()
        heap_ratio = heap_size_bytes / base_stats["heap_max_bytes"] if base_stats["heap_max_bytes"] > 0 else 1.0
        
        base_pauses = [e.duration_ms for e in self.base_events if e.is_stop_the_world and e.duration_ms > 0]
        if not base_pauses:
            base_pauses = [50.0]
        
        zgc_pause_multiplier = 0.3
        
        simulated_pauses = [p * zgc_pause_multiplier for p in base_pauses]
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        full_gc_count = self._predict_full_gc_count(heap_ratio, base_stats["full_gc_count"])
        humongous_count = 0
        promotion_failures = 0
        
        slo_violation = any(p > max_pause_millis * 1.2 for p in simulated_pauses)
        
        return SimulationResult(
            scenario_name=f"ZGC - {heap_size_bytes // (1024**3)}GB Heap",
            target_gc_collector=GCCollector.ZGC,
            simulated_pause_ms_p50=percentile(simulated_pauses, 50),
            simulated_pause_ms_p95=percentile(simulated_pauses, 95),
            simulated_pause_ms_p99=percentile(simulated_pauses, 99),
            simulated_max_pause_ms=max(simulated_pauses) if simulated_pauses else 0,
            simulated_throughput=100 - (base_stats["gc_overhead_percent"] * zgc_pause_multiplier),
            simulated_heap_usage_percent=base_stats["heap_usage_p99"] / heap_ratio if heap_ratio > 0 else 70,
            expected_full_gc_count=full_gc_count,
            expected_humongous_allocations=humongous_count,
            expected_promotion_failures=promotion_failures,
            is_slo_violation_expected=slo_violation,
            parameters={
                "heap_size_gb": round(heap_size_bytes / (1024**3), 2),
                "max_pause_millis": max_pause_millis,
                "use_large_pages": use_large_pages,
                "zgc_pause_reduction": f"{(1-zgc_pause_multiplier)*100:.1f}%",
                "pause_multiplier": round(zgc_pause_multiplier, 3)
            }
        )
    
    def simulate_shenandoah(
        self,
        heap_size_bytes: int,
        max_pause_millis: int = 200
    ) -> SimulationResult:
        if not self.base_events:
            return self._create_empty_simulation("Shenandoah Simulation")
        
        base_stats = self._get_base_stats()
        heap_ratio = heap_size_bytes / base_stats["heap_max_bytes"] if base_stats["heap_max_bytes"] > 0 else 1.0
        
        base_pauses = [e.duration_ms for e in self.base_events if e.is_stop_the_world and e.duration_ms > 0]
        if not base_pauses:
            base_pauses = [50.0]
        
        shenandoah_pause_multiplier = 0.4
        
        simulated_pauses = [p * shenandoah_pause_multiplier for p in base_pauses]
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        full_gc_count = self._predict_full_gc_count(heap_ratio, base_stats["full_gc_count"])
        
        slo_violation = any(p > max_pause_millis * 1.2 for p in simulated_pauses)
        
        return SimulationResult(
            scenario_name=f"Shenandoah - {heap_size_bytes // (1024**3)}GB Heap",
            target_gc_collector=GCCollector.SHENANDOAH,
            simulated_pause_ms_p50=percentile(simulated_pauses, 50),
            simulated_pause_ms_p95=percentile(simulated_pauses, 95),
            simulated_pause_ms_p99=percentile(simulated_pauses, 99),
            simulated_max_pause_ms=max(simulated_pauses) if simulated_pauses else 0,
            simulated_throughput=100 - (base_stats["gc_overhead_percent"] * shenandoah_pause_multiplier),
            simulated_heap_usage_percent=base_stats["heap_usage_p99"] / heap_ratio if heap_ratio > 0 else 70,
            expected_full_gc_count=full_gc_count,
            expected_humongous_allocations=0,
            expected_promotion_failures=0,
            is_slo_violation_expected=slo_violation,
            parameters={
                "heap_size_gb": round(heap_size_bytes / (1024**3), 2),
                "max_pause_millis": max_pause_millis,
                "pause_multiplier": round(shenandoah_pause_multiplier, 3)
            }
        )
    
    def simulate_parallel(
        self,
        heap_size_bytes: int,
        young_ratio: int = 2
    ) -> SimulationResult:
        if not self.base_events:
            return self._create_empty_simulation("Parallel GC Simulation")
        
        base_stats = self._get_base_stats()
        heap_ratio = heap_size_bytes / base_stats["heap_max_bytes"] if base_stats["heap_max_bytes"] > 0 else 1.0
        
        base_pauses = [e.duration_ms for e in self.base_events if e.is_stop_the_world and e.duration_ms > 0]
        if not base_pauses:
            base_pauses = [50.0]
        
        parallel_pause_multiplier = 0.8 if heap_ratio > 1.5 else 1.2
        
        simulated_pauses = [p * parallel_pause_multiplier for p in base_pauses]
        
        def percentile(data: List[float], p: float) -> float:
            if not data:
                return 0.0
            sorted_data = sorted(data)
            index = min(int(len(sorted_data) * p / 100), len(sorted_data) - 1)
            return sorted_data[index]
        
        full_gc_count = self._predict_full_gc_count(heap_ratio, base_stats["full_gc_count"])
        
        return SimulationResult(
            scenario_name=f"Parallel GC - {heap_size_bytes // (1024**3)}GB Heap",
            target_gc_collector=GCCollector.PARALLEL,
            simulated_pause_ms_p50=percentile(simulated_pauses, 50),
            simulated_pause_ms_p95=percentile(simulated_pauses, 95),
            simulated_pause_ms_p99=percentile(simulated_pauses, 99),
            simulated_max_pause_ms=max(simulated_pauses) if simulated_pauses else 0,
            simulated_throughput=100 - (base_stats["gc_overhead_percent"] * parallel_pause_multiplier * 0.8),
            simulated_heap_usage_percent=base_stats["heap_usage_p99"] / heap_ratio if heap_ratio > 0 else 70,
            expected_full_gc_count=full_gc_count,
            expected_humongous_allocations=0,
            expected_promotion_failures=base_stats["promotion_failure_count"],
            is_slo_violation_expected=max(simulated_pauses) > 500 if simulated_pauses else False,
            parameters={
                "heap_size_gb": round(heap_size_bytes / (1024**3), 2),
                "young_ratio": young_ratio,
                "pause_multiplier": round(parallel_pause_multiplier, 3),
                "throughput_advantage": "Better throughput for batch jobs"
            }
        )
    
    def compare_collectors(
        self,
        heap_size_bytes: int,
        max_pause_millis: int = 200
    ) -> List[SimulationResult]:
        results = []
        
        if self.base_options:
            if self.base_options.is_g1:
                results.append(self.simulate_g1(heap_size_bytes, max_pause_millis=max_pause_millis))
            elif self.base_options.is_zgc:
                results.append(self.simulate_zgc(heap_size_bytes, max_pause_millis=max_pause_millis))
        
        results.append(self.simulate_g1(heap_size_bytes, max_pause_millis=max_pause_millis))
        results.append(self.simulate_zgc(heap_size_bytes, max_pause_millis=max_pause_millis))
        results.append(self.simulate_shenandoah(heap_size_bytes, max_pause_millis=max_pause_millis))
        results.append(self.simulate_parallel(heap_size_bytes))
        
        return results
    
    def compare_heap_sizes(
        self,
        base_heap_bytes: int,
        multipliers: List[float] = None,
        collector: GCCollector = GCCollector.G1
    ) -> List[SimulationResult]:
        if multipliers is None:
            multipliers = [0.8, 1.0, 1.25, 1.5, 2.0]
        
        results = []
        
        for mult in multipliers:
            heap_size = int(base_heap_bytes * mult)
            
            if collector == GCCollector.G1:
                result = self.simulate_g1(heap_size)
            elif collector == GCCollector.ZGC:
                result = self.simulate_zgc(heap_size)
            elif collector == GCCollector.SHENANDOAH:
                result = self.simulate_shenandoah(heap_size)
            else:
                result = self.simulate_parallel(heap_size)
            
            result.parameters["heap_multiplier"] = mult
            results.append(result)
        
        return results
    
    def _get_base_stats(self) -> Dict[str, Any]:
        if self.base_analysis:
            pause_stats = self.base_analysis.pause_stats
            heap_stats = self.base_analysis.heap_stats
            return {
                "heap_max_bytes": heap_stats.heap_max_bytes,
                "heap_usage_p99": heap_stats.heap_usage_percent_p99,
                "gc_overhead_percent": pause_stats.gc_overhead_percent,
                "full_gc_count": pause_stats.full_gc_count,
                "promotion_failure_count": pause_stats.promotion_failure_count,
                "humongous_count": pause_stats.humongous_allocation_count,
            }
        
        if not self.base_events:
            return {
                "heap_max_bytes": 4 * 1024**3,
                "heap_usage_p99": 70,
                "gc_overhead_percent": 5,
                "full_gc_count": 0,
                "promotion_failure_count": 0,
                "humongous_count": 0,
            }
        
        heap_sizes = [e.heap_max_bytes for e in self.base_events if e.heap_max_bytes > 0]
        heap_max = heap_sizes[0] if heap_sizes else 4 * 1024**3
        
        stw_events = [e for e in self.base_events if e.is_stop_the_world and e.duration_ms > 0]
        if stw_events:
            total_pause = sum(e.duration_ms for e in stw_events)
            if len(self.base_events) >= 2:
                first = self.base_events[0].timestamp
                last = self.base_events[-1].timestamp
                total_ms = (last - first).total_seconds() * 1000
                gc_overhead = (total_pause / total_ms * 100) if total_ms > 0 else 5
            else:
                gc_overhead = 5
        else:
            gc_overhead = 5
        
        return {
            "heap_max_bytes": heap_max,
            "heap_usage_p99": 70,
            "gc_overhead_percent": gc_overhead,
            "full_gc_count": sum(1 for e in self.base_events if e.event_type == GCEventType.FULL_GC),
            "promotion_failure_count": sum(1 for e in self.base_events if e.event_type == GCEventType.PROMOTION_FAILED),
            "humongous_count": sum(1 for e in self.base_events if e.event_type == GCEventType.HUMONGOUS_ALLOCATION),
        }
    
    def _calculate_optimal_region_size(self, heap_bytes: int) -> int:
        if heap_bytes <= 4 * 1024**3:
            return 1 * 1024**2
        elif heap_bytes <= 8 * 1024**3:
            return 2 * 1024**2
        elif heap_bytes <= 16 * 1024**3:
            return 4 * 1024**2
        elif heap_bytes <= 32 * 1024**3:
            return 8 * 1024**2
        elif heap_bytes <= 64 * 1024**3:
            return 16 * 1024**2
        else:
            return 32 * 1024**2
    
    def _calculate_region_effect(self, region_count: int) -> float:
        if region_count < 1000:
            return 0.9
        elif region_count < 2000:
            return 1.0
        elif region_count < 4000:
            return 1.1
        else:
            return 1.2
    
    def _calculate_pause_multiplier(
        self,
        heap_ratio: float,
        max_pause_millis: int,
        young_percent: int
    ) -> float:
        multiplier = 1.0
        
        if heap_ratio > 1.5:
            multiplier *= 0.85
        elif heap_ratio < 0.9:
            multiplier *= 1.3
        
        if max_pause_millis > 300:
            multiplier *= 0.9
        elif max_pause_millis < 100:
            multiplier *= 1.2
        
        if young_percent > 40:
            multiplier *= 1.1
        elif young_percent < 20:
            multiplier *= 0.95
        
        return multiplier
    
    def _predict_full_gc_count(self, heap_ratio: float, base_count: int) -> int:
        if heap_ratio > 1.5:
            return max(0, int(base_count * 0.3))
        elif heap_ratio > 1.0:
            return max(0, int(base_count * 0.6))
        elif heap_ratio < 0.8:
            return int(base_count * 1.5)
        return base_count
    
    def _predict_humongous_allocations(self, heap_bytes: int, region_bytes: int) -> int:
        if self.base_analysis:
            base_count = self.base_analysis.pause_stats.humongous_allocation_count
        else:
            base_count = sum(1 for e in self.base_events if e.event_type == GCEventType.HUMONGOUS_ALLOCATION)
        
        half_region = region_bytes / 2
        if half_region > 512 * 1024:
            return max(0, int(base_count * 0.7))
        
        return base_count
    
    def _predict_promotion_failures(self, young_bytes: int, base_count: int) -> int:
        if young_bytes > 2 * 1024**3:
            return max(0, int(base_count * 0.5))
        elif young_bytes > 1 * 1024**3:
            return max(0, int(base_count * 0.8))
        
        return base_count
    
    def _create_empty_simulation(self, name: str) -> SimulationResult:
        return SimulationResult(
            scenario_name=name,
            target_gc_collector=GCCollector.UNKNOWN,
            simulated_pause_ms_p50=0,
            simulated_pause_ms_p95=0,
            simulated_pause_ms_p99=0,
            simulated_max_pause_ms=0,
            simulated_throughput=100,
            simulated_heap_usage_percent=0,
            expected_full_gc_count=0,
            expected_humongous_allocations=0,
            expected_promotion_failures=0,
            is_slo_violation_expected=False,
            parameters={"note": "No base events for simulation"}
        )
