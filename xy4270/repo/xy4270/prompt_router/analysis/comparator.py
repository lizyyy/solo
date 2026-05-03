"""
比较分析模块：成本、延迟、失败率、命中原因分析
"""

from collections import defaultdict
from statistics import mean, median
from typing import Any, Dict, List, Optional, Tuple

from ..core.models import (
    ComparisonResult,
    RouteResult,
    RouteStatus,
    RunSummary,
)


class MetricsCalculator:
    """指标计算器"""
    
    @staticmethod
    def calculate_run_summary(
        run_id: str,
        results: List[RouteResult]
    ) -> RunSummary:
        """计算运行摘要"""
        if not results:
            return RunSummary(
                run_id=run_id,
                policy_name="unknown",
                policy_version="unknown",
                total_cases=0,
                success_count=0,
                failed_count=0,
                total_cost=0.0,
                avg_latency_ms=0.0,
                p50_latency_ms=0.0,
                p95_latency_ms=0.0,
                p99_latency_ms=0.0,
                failure_rate=0.0,
                success_rate=0.0,
                degradation_rate=0.0,
                retry_rate=0.0,
                model_distribution={},
                status_distribution={},
                hit_reasons={},
            )
        
        policy_name = results[0].policy_name
        policy_version = results[0].policy_version
        
        total_cases = len(results)
        success_count = sum(1 for r in results if r.success)
        failed_count = total_cases - success_count
        
        total_cost = sum(r.total_cost for r in results)
        
        latencies = [r.final_latency_ms for r in results]
        avg_latency = mean(latencies)
        
        sorted_latencies = sorted(latencies)
        p50 = MetricsCalculator._percentile(sorted_latencies, 50)
        p95 = MetricsCalculator._percentile(sorted_latencies, 95)
        p99 = MetricsCalculator._percentile(sorted_latencies, 99)
        
        success_rate = success_count / total_cases
        failure_rate = failed_count / total_cases
        
        degradation_count = sum(1 for r in results if r.degradation_triggered)
        degradation_rate = degradation_count / total_cases
        
        retry_count = sum(1 for r in results if r.retry_count > 0)
        retry_rate = retry_count / total_cases
        
        model_distribution: Dict[str, int] = defaultdict(int)
        for r in results:
            model_distribution[r.final_model] += 1
        
        status_distribution: Dict[str, int] = defaultdict(int)
        for r in results:
            status_val = r.final_status.value if hasattr(r.final_status, "value") else str(r.final_status)
            status_distribution[status_val] += 1
        
        hit_reasons: Dict[str, int] = defaultdict(int)
        for r in results:
            if r.hit_reason:
                hit_reasons[r.hit_reason] += 1
        
        return RunSummary(
            run_id=run_id,
            policy_name=policy_name,
            policy_version=policy_version,
            total_cases=total_cases,
            success_count=success_count,
            failed_count=failed_count,
            total_cost=total_cost,
            avg_latency_ms=avg_latency,
            p50_latency_ms=p50,
            p95_latency_ms=p95,
            p99_latency_ms=p99,
            failure_rate=failure_rate,
            success_rate=success_rate,
            degradation_rate=degradation_rate,
            retry_rate=retry_rate,
            model_distribution=dict(model_distribution),
            status_distribution=dict(status_distribution),
            hit_reasons=dict(hit_reasons),
        )
    
    @staticmethod
    def _percentile(sorted_data: List[float], percentile: int) -> float:
        """计算百分位数"""
        if not sorted_data:
            return 0.0
        
        n = len(sorted_data)
        if n == 1:
            return sorted_data[0]
        
        index = (percentile / 100) * (n - 1)
        lower = int(index)
        upper = min(lower + 1, n - 1)
        weight = index - lower
        
        return sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight


class RunComparator:
    """运行比较器"""
    
    def __init__(self, results_a: List[RouteResult], results_b: List[RouteResult]):
        self.results_a = results_a
        self.results_b = results_b
        
        self._results_a_by_case: Dict[str, RouteResult] = {
            r.test_case_id: r for r in results_a
        }
        self._results_b_by_case: Dict[str, RouteResult] = {
            r.test_case_id: r for r in results_b
        }
        
        self.common_case_ids = set(self._results_a_by_case.keys()) & set(self._results_b_by_case.keys())
    
    def compare(self) -> ComparisonResult:
        """比较两次运行"""
        total_a = len(self.results_a)
        total_b = len(self.results_b)
        total_cases = max(total_a, total_b)
        common_cases = len(self.common_case_ids)
        
        summary_a = MetricsCalculator.calculate_run_summary(
            "run_a", self.results_a
        )
        summary_b = MetricsCalculator.calculate_run_summary(
            "run_b", self.results_b
        )
        
        cost_diff = summary_b.total_cost - summary_a.total_cost
        cost_pct_change = self._percentage_change(
            summary_a.total_cost, summary_b.total_cost
        )
        
        latency_diff = summary_b.avg_latency_ms - summary_a.avg_latency_ms
        latency_pct_change = self._percentage_change(
            summary_a.avg_latency_ms, summary_b.avg_latency_ms
        )
        
        success_rate_diff = summary_b.success_rate - summary_a.success_rate
        
        model_switch_count = 0
        status_change_count = 0
        detailed_comparisons: List[Dict[str, Any]] = []
        
        for case_id in self.common_case_ids:
            r_a = self._results_a_by_case[case_id]
            r_b = self._results_b_by_case[case_id]
            
            model_changed = r_a.final_model != r_b.final_model
            if model_changed:
                model_switch_count += 1
            
            status_a_val = r_a.final_status.value if hasattr(r_a.final_status, "value") else str(r_a.final_status)
            status_b_val = r_b.final_status.value if hasattr(r_b.final_status, "value") else str(r_b.final_status)
            status_changed = status_a_val != status_b_val
            if status_changed:
                status_change_count += 1
            
            detailed_comparisons.append({
                "test_case_id": case_id,
                "policy_a": {
                    "model": r_a.final_model,
                    "status": status_a_val,
                    "success": r_a.success,
                    "latency_ms": r_a.final_latency_ms,
                    "cost": r_a.total_cost,
                    "hit_reason": r_a.hit_reason,
                    "degradation": r_a.degradation_triggered,
                    "retry_count": r_a.retry_count,
                },
                "policy_b": {
                    "model": r_b.final_model,
                    "status": status_b_val,
                    "success": r_b.success,
                    "latency_ms": r_b.final_latency_ms,
                    "cost": r_b.total_cost,
                    "hit_reason": r_b.hit_reason,
                    "degradation": r_b.degradation_triggered,
                    "retry_count": r_b.retry_count,
                },
                "model_changed": model_changed,
                "status_changed": status_changed,
                "cost_diff": r_b.total_cost - r_a.total_cost,
                "latency_diff_ms": r_b.final_latency_ms - r_a.final_latency_ms,
                "success_changed": r_a.success != r_b.success,
            })
        
        return ComparisonResult(
            run_a_id=self.results_a[0].id if self.results_a else "",
            run_b_id=self.results_b[0].id if self.results_b else "",
            policy_a=summary_a.policy_name,
            policy_b=summary_b.policy_name,
            total_cases=total_cases,
            common_cases=common_cases,
            cost_difference=cost_diff,
            cost_percentage_change=cost_pct_change,
            latency_difference_ms=latency_diff,
            latency_percentage_change=latency_pct_change,
            success_rate_difference=success_rate_diff,
            model_switch_count=model_switch_count,
            status_change_count=status_change_count,
            detailed_comparisons=detailed_comparisons,
        )
    
    def _percentage_change(self, old: float, new: float) -> float:
        """计算百分比变化"""
        if old == 0:
            return 0.0 if new == 0 else 100.0
        return ((new - old) / old) * 100
    
    def get_status_changes(self) -> List[Dict[str, Any]]:
        """获取状态变化的详细列表"""
        changes = []
        for case_id in self.common_case_ids:
            r_a = self._results_a_by_case[case_id]
            r_b = self._results_b_by_case[case_id]
            
            status_a_val = r_a.final_status.value if hasattr(r_a.final_status, "value") else str(r_a.final_status)
            status_b_val = r_b.final_status.value if hasattr(r_b.final_status, "value") else str(r_b.final_status)
            
            if status_a_val != status_b_val:
                changes.append({
                    "test_case_id": case_id,
                    "from_status": status_a_val,
                    "to_status": status_b_val,
                    "from_model": r_a.final_model,
                    "to_model": r_b.final_model,
                    "from_hit_reason": r_a.hit_reason,
                    "to_hit_reason": r_b.hit_reason,
                })
        return changes
    
    def get_model_switches(self) -> List[Dict[str, Any]]:
        """获取模型切换的详细列表"""
        switches = []
        for case_id in self.common_case_ids:
            r_a = self._results_a_by_case[case_id]
            r_b = self._results_b_by_case[case_id]
            
            if r_a.final_model != r_b.final_model:
                status_a_val = r_a.final_status.value if hasattr(r_a.final_status, "value") else str(r_a.final_status)
                status_b_val = r_b.final_status.value if hasattr(r_b.final_status, "value") else str(r_b.final_status)
                switches.append({
                    "test_case_id": case_id,
                    "from_model": r_a.final_model,
                    "to_model": r_b.final_model,
                    "from_status": status_a_val,
                    "to_status": status_b_val,
                    "from_hit_reason": r_a.hit_reason,
                    "to_hit_reason": r_b.hit_reason,
                })
        return switches
    
    def get_cost_analysis(self) -> Dict[str, Any]:
        """获取成本分析"""
        cost_increases = []
        cost_decreases = []
        
        for case_id in self.common_case_ids:
            r_a = self._results_a_by_case[case_id]
            r_b = self._results_b_by_case[case_id]
            
            diff = r_b.total_cost - r_a.total_cost
            if diff > 0:
                cost_increases.append({
                    "test_case_id": case_id,
                    "increase": diff,
                    "from_cost": r_a.total_cost,
                    "to_cost": r_b.total_cost,
                    "from_model": r_a.final_model,
                    "to_model": r_b.final_model,
                })
            elif diff < 0:
                cost_decreases.append({
                    "test_case_id": case_id,
                    "decrease": abs(diff),
                    "from_cost": r_a.total_cost,
                    "to_cost": r_b.total_cost,
                    "from_model": r_a.final_model,
                    "to_model": r_b.final_model,
                })
        
        cost_increases.sort(key=lambda x: x["increase"], reverse=True)
        cost_decreases.sort(key=lambda x: x["decrease"], reverse=True)
        
        return {
            "total_increase": sum(x["increase"] for x in cost_increases),
            "total_decrease": sum(x["decrease"] for x in cost_decreases),
            "net_change": sum(x["increase"] for x in cost_increases) - sum(x["decrease"] for x in cost_decreases),
            "top_increases": cost_increases[:10],
            "top_decreases": cost_decreases[:10],
            "increase_count": len(cost_increases),
            "decrease_count": len(cost_decreases),
        }


class HitReasonAnalyzer:
    """命中原因分析器"""
    
    def __init__(self, results: List[RouteResult]):
        self.results = results
    
    def analyze(self) -> Dict[str, Any]:
        """分析命中原因分布"""
        hit_reasons: Dict[str, int] = defaultdict(int)
        hit_reason_details: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for result in self.results:
            if result.hit_reason:
                hit_reasons[result.hit_reason] += 1
                status_val = result.final_status.value if hasattr(result.final_status, "value") else str(result.final_status)
                hit_reason_details[result.hit_reason].append({
                    "test_case_id": result.test_case_id,
                    "final_model": result.final_model,
                    "final_status": status_val,
                    "success": result.success,
                    "latency_ms": result.final_latency_ms,
                    "cost": result.total_cost,
                })
        
        total = len(self.results)
        
        analysis: Dict[str, Any] = {
            "total_cases": total,
            "hit_reasons": dict(hit_reasons),
            "by_category": {
                "success": {
                    "primary_success": hit_reasons.get("primary_success", 0),
                    "degraded_success": hit_reasons.get("degraded_success", 0),
                    "circuit_recovered": hit_reasons.get("circuit_recovered", 0),
                },
                "retries": {
                    k: v for k, v in hit_reasons.items()
                    if k.startswith("retry_on_")
                },
                "failures": {
                    "circuit_breakers": {
                        k: v for k, v in hit_reasons.items()
                        if "circuit" in k.lower() and "recovered" not in k.lower()
                    },
                    "budget_exceeded": {
                        k: v for k, v in hit_reasons.items()
                        if "budget" in k.lower()
                    },
                    "sensitive_blocked": hit_reasons.get("sensitive_blocked", 0),
                    "no_primary_available": hit_reasons.get("no_primary_available", 0),
                },
            },
            "percentages": {},
            "details": dict(hit_reason_details),
        }
        
        for reason, count in hit_reasons.items():
            analysis["percentages"][reason] = count / total if total > 0 else 0.0
        
        return analysis
