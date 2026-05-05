from typing import List, Dict, Any, Optional
from datetime import datetime
from app.schemas.common import (
    SLOCriteria,
    SLOEvaluationResult,
    SLOStatusEnum,
)


class SLOEvaluator:
    
    @staticmethod
    def evaluate_batch(
        batch_metrics: Dict[str, Any],
        criteria: SLOCriteria
    ) -> SLOEvaluationResult:
        violations = []
        warnings = []
        
        if criteria.max_response_time_ms is not None:
            avg_response = batch_metrics.get("avg_response_time_ms")
            if avg_response is not None and avg_response > criteria.max_response_time_ms:
                violations.append(
                    f"平均响应时间 {avg_response:.2f}ms 超过阈值 {criteria.max_response_time_ms}ms"
                )
            elif avg_response is not None and avg_response > criteria.max_response_time_ms * 0.8:
                warnings.append(
                    f"平均响应时间 {avg_response:.2f}ms 接近阈值 {criteria.max_response_time_ms}ms (超过80%)"
                )
        
        if criteria.max_p95_response_time_ms is not None:
            p95_response = batch_metrics.get("p95_response_time_ms")
            if p95_response is not None and p95_response > criteria.max_p95_response_time_ms:
                violations.append(
                    f"P95响应时间 {p95_response:.2f}ms 超过阈值 {criteria.max_p95_response_time_ms}ms"
                )
            elif p95_response is not None and p95_response > criteria.max_p95_response_time_ms * 0.8:
                warnings.append(
                    f"P95响应时间 {p95_response:.2f}ms 接近阈值 {criteria.max_p95_response_time_ms}ms"
                )
        
        if criteria.max_p99_response_time_ms is not None:
            p99_response = batch_metrics.get("p99_response_time_ms")
            if p99_response is not None and p99_response > criteria.max_p99_response_time_ms:
                violations.append(
                    f"P99响应时间 {p99_response:.2f}ms 超过阈值 {criteria.max_p99_response_time_ms}ms"
                )
            elif p99_response is not None and p99_response > criteria.max_p99_response_time_ms * 0.8:
                warnings.append(
                    f"P99响应时间 {p99_response:.2f}ms 接近阈值 {criteria.max_p99_response_time_ms}ms"
                )
        
        if criteria.max_error_rate is not None:
            error_rate = batch_metrics.get("error_rate")
            if error_rate is not None and error_rate > criteria.max_error_rate:
                violations.append(
                    f"错误率 {error_rate*100:.2f}% 超过阈值 {criteria.max_error_rate*100:.2f}%"
                )
            elif error_rate is not None and error_rate > criteria.max_error_rate * 0.8:
                warnings.append(
                    f"错误率 {error_rate*100:.2f}% 接近阈值 {criteria.max_error_rate*100:.2f}%"
                )
        
        if criteria.min_qps is not None:
            qps = batch_metrics.get("qps")
            if qps is not None and qps < criteria.min_qps:
                violations.append(
                    f"QPS {qps:.2f} 低于最低要求 {criteria.min_qps}"
                )
            elif qps is not None and qps < criteria.min_qps * 1.2:
                warnings.append(
                    f"QPS {qps:.2f} 接近最低要求 {criteria.min_qps}"
                )
        
        if criteria.max_cpu_utilization is not None:
            cpu_util = batch_metrics.get("cpu_utilization_percent")
            if cpu_util is not None and cpu_util > criteria.max_cpu_utilization:
                violations.append(
                    f"CPU利用率 {cpu_util:.2f}% 超过阈值 {criteria.max_cpu_utilization}%"
                )
            elif cpu_util is not None and cpu_util > criteria.max_cpu_utilization * 0.8:
                warnings.append(
                    f"CPU利用率 {cpu_util:.2f}% 接近阈值 {criteria.max_cpu_utilization}%"
                )
        
        if criteria.max_memory_utilization is not None:
            memory_util = batch_metrics.get("memory_utilization_percent")
            if memory_util is not None and memory_util > criteria.max_memory_utilization:
                violations.append(
                    f"内存利用率 {memory_util:.2f}% 超过阈值 {criteria.max_memory_utilization}%"
                )
            elif memory_util is not None and memory_util > criteria.max_memory_utilization * 0.8:
                warnings.append(
                    f"内存利用率 {memory_util:.2f}% 接近阈值 {criteria.max_memory_utilization}%"
                )
        
        passed = len(violations) == 0
        
        if passed:
            if len(warnings) > 0:
                status = SLOStatusEnum.warning
            else:
                status = SLOStatusEnum.passed
        else:
            status = SLOStatusEnum.failed
        
        if status == SLOStatusEnum.passed:
            summary = "所有 SLO 指标均符合要求"
        elif status == SLOStatusEnum.warning:
            summary = f"有 {len(warnings)} 项指标接近阈值，请关注"
        else:
            summary = f"有 {len(violations)} 项指标违反 SLO 要求"
        
        return SLOEvaluationResult(
            criteria=criteria,
            passed=passed,
            status=status,
            violations=violations,
            warnings=warnings,
            summary=summary,
        )
    
    @staticmethod
    def get_default_criteria() -> SLOCriteria:
        return SLOCriteria(
            max_response_time_ms=500,
            max_p95_response_time_ms=1000,
            max_p99_response_time_ms=2000,
            max_error_rate=0.05,
            min_qps=1000,
            max_cpu_utilization=80,
            max_memory_utilization=85,
        )
