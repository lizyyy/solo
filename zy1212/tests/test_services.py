import pytest
from datetime import datetime, timedelta

from app.services.baseline_comparator import compare_batches
from app.services.slo_evaluator import evaluate_batch, SLOCriteria
from app.schemas.common import SLOStatusEnum


class TestBaselineComparator:
    def test_compare_batches_improvement(self):
        baseline_metrics = {
            "qps": 500.0,
            "avg_response_time_ms": 200.0,
            "p95_response_time_ms": 400.0,
            "p99_response_time_ms": 800.0,
            "error_rate": 0.02,
            "throughput_kbps": 2000.0,
        }
        
        current_metrics = {
            "qps": 750.0,
            "avg_response_time_ms": 100.0,
            "p95_response_time_ms": 200.0,
            "p99_response_time_ms": 400.0,
            "error_rate": 0.005,
            "throughput_kbps": 3000.0,
        }
        
        result = compare_batches(baseline_metrics, current_metrics)
        
        assert result.qps.change_percent == 50.0
        assert result.qps.is_improvement is True
        assert result.qps.is_significant is True
        
        assert result.avg_response_time_ms.change_percent == -50.0
        assert result.avg_response_time_ms.is_improvement is True
        
        assert result.p95_response_time_ms.is_improvement is True
        assert result.error_rate.is_improvement is True
        
    def test_compare_batches_degradation(self):
        baseline_metrics = {
            "qps": 700.0,
            "avg_response_time_ms": 100.0,
            "error_rate": 0.005,
        }
        
        current_metrics = {
            "qps": 500.0,
            "avg_response_time_ms": 250.0,
            "error_rate": 0.03,
        }
        
        result = compare_batches(baseline_metrics, current_metrics)
        
        assert result.qps.is_improvement is False
        assert result.avg_response_time_ms.is_improvement is False
        assert result.error_rate.is_improvement is False
        
    def test_compare_batches_thresholds(self):
        baseline_metrics = {"qps": 1000.0}
        current_metrics = {"qps": 1010.0}
        
        result = compare_batches(
            baseline_metrics,
            current_metrics,
            significant_threshold=5.0,
        )
        
        assert result.qps.is_significant is False


class TestSLOEvaluator:
    def test_evaluate_batch_pass_all(self):
        batch_metrics = {
            "qps": 800.0,
            "avg_response_time_ms": 80.0,
            "p95_response_time_ms": 150.0,
            "p99_response_time_ms": 300.0,
            "error_rate": 0.001,
        }
        
        slo_criteria = SLOCriteria(
            min_qps=500.0,
            max_avg_latency_ms=200.0,
            max_p95_latency_ms=300.0,
            max_p99_latency_ms=500.0,
            max_error_rate=0.01,
        )
        
        result = evaluate_batch(batch_metrics, slo_criteria)
        
        assert result.status == SLOStatusEnum.PASS
        assert result.passed_count == 5
        assert result.failed_count == 0
        assert result.warning_count == 0
        
    def test_evaluate_batch_fail_critical(self):
        batch_metrics = {
            "qps": 300.0,
            "error_rate": 0.05,
        }
        
        slo_criteria = SLOCriteria(
            min_qps=500.0,
            max_error_rate=0.01,
        )
        
        result = evaluate_batch(batch_metrics, slo_criteria)
        
        assert result.status == SLOStatusEnum.FAIL
        assert result.failed_count >= 1
        
    def test_evaluate_batch_warning(self):
        batch_metrics = {
            "qps": 550.0,
            "error_rate": 0.008,
        }
        
        slo_criteria = SLOCriteria(
            min_qps=500.0,
            min_qps_warning=600.0,
            max_error_rate=0.01,
            max_error_rate_warning=0.005,
        )
        
        result = evaluate_batch(batch_metrics, slo_criteria)
        
        assert result.warning_count >= 1
        
    def test_evaluate_batch_partial(self):
        batch_metrics = {
            "qps": 600.0,
            "avg_response_time_ms": 150.0,
            "error_rate": 0.02,
        }
        
        slo_criteria = SLOCriteria(
            min_qps=500.0,
            max_avg_latency_ms=200.0,
            max_error_rate=0.01,
        )
        
        result = evaluate_batch(batch_metrics, slo_criteria)
        
        assert result.status == SLOStatusEnum.FAIL
        assert result.failed_count == 1
        assert result.passed_count == 2
        
    def test_evaluate_batch_no_criteria(self):
        batch_metrics = {"qps": 1000.0}
        slo_criteria = SLOCriteria()
        
        result = evaluate_batch(batch_metrics, slo_criteria)
        
        assert result.status == SLOStatusEnum.PASS
        assert result.passed_count == 0
