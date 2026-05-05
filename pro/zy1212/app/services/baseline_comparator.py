from typing import List, Dict, Any, Optional
from datetime import datetime
from app.schemas.common import (
    MetricComparison,
    BaselineComparisonResult,
)


class BaselineComparator:
    
    METRIC_CONFIG = {
        "qps": {"higher_is_better": True, "threshold_percent": 10, "label": "QPS"},
        "tps": {"higher_is_better": True, "threshold_percent": 10, "label": "TPS"},
        "avg_response_time_ms": {"higher_is_better": False, "threshold_percent": 20, "label": "平均响应时间(ms)"},
        "p50_response_time_ms": {"higher_is_better": False, "threshold_percent": 20, "label": "P50响应时间(ms)"},
        "p95_response_time_ms": {"higher_is_better": False, "threshold_percent": 15, "label": "P95响应时间(ms)"},
        "p99_response_time_ms": {"higher_is_better": False, "threshold_percent": 15, "label": "P99响应时间(ms)"},
        "error_rate": {"higher_is_better": False, "threshold_percent": 50, "label": "错误率"},
        "throughput_bytes_per_sec": {"higher_is_better": True, "threshold_percent": 10, "label": "吞吐量(字节/秒)"},
        "capacity_utilization_percent": {"higher_is_better": False, "threshold_percent": 10, "label": "容量利用率(%)"},
    }
    
    @staticmethod
    def calculate_change_percent(baseline: float, current: float) -> float:
        if baseline == 0:
            if current == 0:
                return 0.0
            return 100.0 if current > 0 else -100.0
        return ((current - baseline) / baseline) * 100
    
    @staticmethod
    def is_improvement(metric_name: str, baseline: float, current: float) -> bool:
        config = BaselineComparator.METRIC_CONFIG.get(metric_name)
        if not config:
            return current >= baseline
        
        higher_is_better = config["higher_is_better"]
        
        if higher_is_better:
            return current >= baseline
        else:
            return current <= baseline
    
    @staticmethod
    def compare_metric(
        metric_name: str,
        baseline_value: float,
        current_value: float
    ) -> MetricComparison:
        change_percent = BaselineComparator.calculate_change_percent(baseline_value, current_value)
        is_improvement = BaselineComparator.is_improvement(metric_name, baseline_value, current_value)
        
        config = BaselineComparator.METRIC_CONFIG.get(metric_name, {})
        
        return MetricComparison(
            metric_name=config.get("label", metric_name),
            baseline_value=baseline_value,
            current_value=current_value,
            change_percent=round(change_percent, 2),
            is_improvement=is_improvement,
        )
    
    @staticmethod
    def compare_batches(
        baseline_batch: Dict[str, Any],
        current_batch: Dict[str, Any],
        metrics_to_compare: Optional[List[str]] = None
    ) -> BaselineComparisonResult:
        baseline_id = baseline_batch.get("id", 0)
        current_id = current_batch.get("id", 0)
        
        if metrics_to_compare is None:
            metrics_to_compare = list(BaselineComparator.METRIC_CONFIG.keys())
        
        comparisons = []
        
        for metric_name in metrics_to_compare:
            baseline_value = baseline_batch.get(metric_name)
            current_value = current_batch.get(metric_name)
            
            if baseline_value is None or current_value is None:
                continue
            
            if isinstance(baseline_value, (int, float)) and isinstance(current_value, (int, float)):
                comparison = BaselineComparator.compare_metric(
                    metric_name,
                    float(baseline_value),
                    float(current_value)
                )
                comparisons.append(comparison)
        
        improvements = [c for c in comparisons if c.is_improvement]
        regressions = [c for c in comparisons if not c.is_improvement]
        
        significant_regressions = []
        for regression in regressions:
            metric_key = None
            for key, config in BaselineComparator.METRIC_CONFIG.items():
                if config.get("label") == regression.metric_name:
                    metric_key = key
                    break
            
            if metric_key:
                config = BaselineComparator.METRIC_CONFIG[metric_key]
                threshold = config.get("threshold_percent", 10)
                
                if abs(regression.change_percent) > threshold:
                    significant_regressions.append(regression)
        
        if len(significant_regressions) > 0:
            overall_status = "degraded"
        elif len(regressions) > 0:
            overall_status = "warning"
        elif len(improvements) > 0:
            overall_status = "improved"
        else:
            overall_status = "stable"
        
        summary_parts = []
        
        if len(improvements) > 0:
            summary_parts.append(f"有 {len(improvements)} 项指标改善")
        if len(regressions) > 0:
            summary_parts.append(f"有 {len(regressions)} 项指标下降")
        if len(significant_regressions) > 0:
            summary_parts.append(f"其中 {len(significant_regressions)} 项下降超过阈值")
        
        summary = "；".join(summary_parts) if summary_parts else "无显著变化"
        
        return BaselineComparisonResult(
            baseline_batch_id=baseline_id,
            current_batch_id=current_id,
            comparisons=comparisons,
            overall_status=overall_status,
            summary=summary,
        )
    
    @staticmethod
    def generate_comparison_report(
        comparison_result: BaselineComparisonResult
    ) -> Dict[str, Any]:
        improvements = [c for c in comparison_result.comparisons if c.is_improvement]
        regressions = [c for c in comparison_result.comparisons if not c.is_improvement]
        
        return {
            "baseline_batch_id": comparison_result.baseline_batch_id,
            "current_batch_id": comparison_result.current_batch_id,
            "overall_status": comparison_result.overall_status,
            "summary": comparison_result.summary,
            "improvements": [
                {
                    "metric_name": c.metric_name,
                    "baseline_value": c.baseline_value,
                    "current_value": c.current_value,
                    "change_percent": c.change_percent,
                }
                for c in improvements
            ],
            "regressions": [
                {
                    "metric_name": c.metric_name,
                    "baseline_value": c.baseline_value,
                    "current_value": c.current_value,
                    "change_percent": c.change_percent,
                }
                for c in regressions
            ],
            "all_comparisons": [
                {
                    "metric_name": c.metric_name,
                    "baseline_value": c.baseline_value,
                    "current_value": c.current_value,
                    "change_percent": c.change_percent,
                    "is_improvement": c.is_improvement,
                }
                for c in comparison_result.comparisons
            ],
        }
