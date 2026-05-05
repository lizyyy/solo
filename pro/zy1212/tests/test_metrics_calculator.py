import pytest
from datetime import datetime, timedelta

from app.services.metrics_calculator import (
    calculate_percentile,
    calculate_all_metrics,
    parse_k6_summary,
    parse_jmeter_summary,
)


class TestPercentileCalculation:
    def test_calculate_percentile_simple(self):
        sorted_data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        
        assert calculate_percentile(sorted_data, 50) == pytest.approx(55.0)
        assert calculate_percentile(sorted_data, 95) == pytest.approx(95.5)
        assert calculate_percentile(sorted_data, 99) == pytest.approx(99.1)
    
    def test_calculate_percentile_empty(self):
        assert calculate_percentile([], 50) == 0.0
    
    def test_calculate_percentile_single_value(self):
        assert calculate_percentile([50], 95) == 50.0
    
    def test_calculate_percentile_boundary(self):
        sorted_data = [1, 2, 3, 4, 5]
        assert calculate_percentile(sorted_data, 0) == 1.0
        assert calculate_percentile(sorted_data, 100) == 5.0


class TestMetricsCalculation:
    def test_calculate_all_metrics_full(self):
        raw_response_times = [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 200, 250, 300, 500]
        
        result = calculate_all_metrics(
            raw_response_times=raw_response_times,
            duration_seconds=60,
            total_errors=5,
            total_requests=1000,
            bytes_sent=1000000,
            bytes_received=5000000,
        )
        
        assert result.total_requests == 1000
        assert result.total_errors == 5
        assert result.error_rate == pytest.approx(0.005)
        
        assert result.qps == pytest.approx(16.67, rel=1e-2)
        assert result.tps == pytest.approx(16.67, rel=1e-2)
        
        assert result.avg_response_time_ms > 0
        assert result.min_response_time_ms == 50
        assert result.max_response_time_ms == 500
        
        assert result.throughput_kbps > 0
        
    def test_calculate_all_metrics_minimal(self):
        result = calculate_all_metrics(
            raw_response_times=[100, 200, 300],
            duration_seconds=10,
            total_errors=0,
            total_requests=100,
        )
        
        assert result.error_rate == 0.0
        assert result.qps == 10.0
        assert result.p50_response_time_ms == 200.0
        
    def test_calculate_all_metrics_zero_duration(self):
        result = calculate_all_metrics(
            raw_response_times=[100, 200],
            duration_seconds=0,
            total_errors=0,
            total_requests=10,
        )
        
        assert result.qps == 0.0
        assert result.throughput_kbps == 0.0


class TestK6SummaryParsing:
    def test_parse_k6_summary_valid(self):
        k6_data = {
            "metrics": {
                "http_req_duration": {
                    "avg": 245.5,
                    "min": 15.2,
                    "med": 180.0,
                    "max": 3500.0,
                    "p(90)": 420.0,
                    "p(95)": 580.0,
                    "p(99)": 1250.0,
                },
                "http_reqs": {
                    "count": 864000,
                    "rate": 480.0,
                },
                "http_req_failed": {
                    "rate": 0.01,
                },
                "data_sent": {
                    "count": 5600000000,
                },
                "data_received": {
                    "count": 12400000000,
                },
            },
            "state": {
                "testRunDurationMs": 1800000,
            },
        }
        
        result = parse_k6_summary(k6_data)
        
        assert result.avg_response_time_ms == 245.5
        assert result.min_response_time_ms == 15.2
        assert result.max_response_time_ms == 3500.0
        assert result.p50_response_time_ms == 180.0
        assert result.p90_response_time_ms == 420.0
        assert result.p95_response_time_ms == 580.0
        assert result.p99_response_time_ms == 1250.0
        assert result.total_requests == 864000
        assert result.qps == 480.0
        assert result.error_rate == 0.01
        assert result.bytes_sent == 5600000000
        assert result.bytes_received == 12400000000
        
    def test_parse_k6_summary_incomplete(self):
        k6_data = {
            "metrics": {
                "http_req_duration": {
                    "avg": 100.0,
                },
            },
        }
        
        result = parse_k6_summary(k6_data)
        
        assert result.avg_response_time_ms == 100.0
        assert result.p50_response_time_ms == 0.0
        assert result.total_requests == 0
        
    def test_parse_k6_summary_empty(self):
        result = parse_k6_summary({})
        assert result.total_requests == 0
        assert result.error_rate == 0.0


class TestJMeterSummaryParsing:
    def test_parse_jmeter_summary_valid(self):
        jmeter_data = {
            "Total": {
                "sampleCount": 864000,
                "errorCount": 8640,
                "errorPct": 1.0,
                "meanResTime": 245.5,
                "medianResTime": 180,
                "minResTime": 15,
                "maxResTime": 3500,
                "pct1ResTime": 420,
                "pct2ResTime": 580,
                "pct3ResTime": 1250,
                "throughput": 480.0,
                "sentKBytesPerSec": 3047.0,
                "receivedKBytesPerSec": 6747.0,
            },
        }
        
        result = parse_jmeter_summary(jmeter_data)
        
        assert result.avg_response_time_ms == 245.5
        assert result.min_response_time_ms == 15
        assert result.max_response_time_ms == 3500
        assert result.p50_response_time_ms == 180
        assert result.p90_response_time_ms == 420
        assert result.p95_response_time_ms == 580
        assert result.p99_response_time_ms == 1250
        assert result.total_requests == 864000
        assert result.total_errors == 8640
        assert result.error_rate == 0.01
        assert result.qps == 480.0
        assert result.throughput_kbps > 0
        
    def test_parse_jmeter_summary_incomplete(self):
        jmeter_data = {
            "Total": {
                "sampleCount": 1000,
                "meanResTime": 100.0,
            },
        }
        
        result = parse_jmeter_summary(jmeter_data)
        
        assert result.total_requests == 1000
        assert result.avg_response_time_ms == 100.0
        
    def test_parse_jmeter_summary_empty(self):
        result = parse_jmeter_summary({})
        assert result.total_requests == 0
