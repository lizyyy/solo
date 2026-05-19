from typing import List, Tuple
from schemas import (
    ScenarioBase,
    ComparisonThreshold,
    ConclusionType,
    ScenarioComparison
)
from parser import match_scenario_pattern
import uuid


class MetricsNormalizer:
    @staticmethod
    def normalize_throughput(value: float) -> float:
        return round(value, 2)

    @staticmethod
    def normalize_p95(value: float) -> float:
        return round(value, 2)

    @staticmethod
    def normalize_error_rate(value: float) -> float:
        return round(value, 4)


class DegradationDetector:
    def __init__(self, thresholds: ComparisonThreshold):
        self.thresholds = thresholds

    def check_throughput_degradation(self, base: float, target: float) -> Tuple[float, bool]:
        if base == 0:
            return 0.0, False
        degradation_pct = ((base - target) / base) * 100
        degraded = degradation_pct > self.thresholds.throughput_threshold_pct
        return round(degradation_pct, 2), degraded

    def check_p95_degradation(self, base: float, target: float) -> Tuple[float, bool]:
        if base == 0:
            return 0.0, False
        degradation_pct = ((target - base) / base) * 100
        degraded = degradation_pct > self.thresholds.p95_threshold_pct
        return round(degradation_pct, 2), degraded

    def check_error_rate_increase(self, base: float, target: float) -> Tuple[float, bool]:
        increase_pct = target - base
        increased = increase_pct > self.thresholds.error_rate_threshold_pct
        return round(increase_pct, 4), increased

    def needs_manual_review(self, throughput_deg: float, p95_deg: float, error_inc: float) -> bool:
        near_threshold = 0.8
        return (
            (throughput_deg > 0 and throughput_deg >= self.thresholds.throughput_threshold_pct * near_threshold)
            or (p95_deg > 0 and p95_deg >= self.thresholds.p95_threshold_pct * near_threshold)
            or (error_inc > 0 and error_inc >= self.thresholds.error_rate_threshold_pct * near_threshold)
        )


class ComparisonService:
    def __init__(self, thresholds: ComparisonThreshold = None):
        self.thresholds = thresholds or ComparisonThreshold()
        self.detector = DegradationDetector(self.thresholds)
        self.normalizer = MetricsNormalizer()

    def compare_scenarios(
        self,
        base_scenarios: List[ScenarioBase],
        target_scenarios: List[ScenarioBase],
        scenario_pattern: str = None
    ) -> List[ScenarioComparison]:
        base_map = {s.scenario_name: s for s in base_scenarios}
        target_map = {s.scenario_name: s for s in target_scenarios}
        
        results = []
        all_names = set(base_map.keys()) | set(target_map.keys())
        
        for name in all_names:
            if not match_scenario_pattern(name, scenario_pattern):
                continue
            
            base = base_map.get(name)
            target = target_map.get(name)
            
            if not base or not target:
                continue
            
            throughput_deg, throughput_degraded = self.detector.check_throughput_degradation(
                self.normalizer.normalize_throughput(base.throughput),
                self.normalizer.normalize_throughput(target.throughput)
            )
            
            p95_deg, p95_degraded = self.detector.check_p95_degradation(
                self.normalizer.normalize_p95(base.p95),
                self.normalizer.normalize_p95(target.p95)
            )
            
            error_inc, error_increased = self.detector.check_error_rate_increase(
                self.normalizer.normalize_error_rate(base.error_rate),
                self.normalizer.normalize_error_rate(target.error_rate)
            )
            
            is_degraded = throughput_degraded or p95_degraded or error_increased
            need_review = self.detector.needs_manual_review(throughput_deg, p95_deg, error_inc)
            
            if is_degraded:
                conclusion = ConclusionType.DEGRADED
            elif need_review:
                conclusion = ConclusionType.NEED_REVIEW
            else:
                conclusion = ConclusionType.PASS
            
            result = ScenarioComparison(
                scenario_name=name,
                base_throughput=self.normalizer.normalize_throughput(base.throughput),
                target_throughput=self.normalizer.normalize_throughput(target.throughput),
                throughput_degradation_pct=throughput_deg,
                base_p95=self.normalizer.normalize_p95(base.p95),
                target_p95=self.normalizer.normalize_p95(target.p95),
                p95_degradation_pct=p95_deg,
                base_error_rate=self.normalizer.normalize_error_rate(base.error_rate),
                target_error_rate=self.normalizer.normalize_error_rate(target.error_rate),
                error_rate_increase_pct=error_inc,
                conclusion=conclusion,
                need_manual_review=need_review
            )
            results.append(result)
        
        return results

    def generate_comparison_id(self) -> str:
        return f"comp_{uuid.uuid4().hex[:12]}"
