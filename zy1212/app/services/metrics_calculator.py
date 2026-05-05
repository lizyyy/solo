from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import math
import statistics


class MetricsCalculator:
    
    @staticmethod
    def calculate_percentile(data: List[float], percentile: float) -> float:
        if not data:
            return 0.0
        
        sorted_data = sorted(data)
        n = len(sorted_data)
        
        if n == 1:
            return sorted_data[0]
        
        index = (n - 1) * percentile / 100.0
        lower = math.floor(index)
        upper = math.ceil(index)
        
        if lower == upper:
            return sorted_data[int(index)]
        
        weight = index - lower
        return sorted_data[int(lower)] * (1 - weight) + sorted_data[int(upper)] * weight
    
    @staticmethod
    def calculate_response_time_metrics(response_times_ms: List[float]) -> Dict[str, float]:
        if not response_times_ms:
            return {
                "avg_response_time_ms": 0.0,
                "min_response_time_ms": 0.0,
                "max_response_time_ms": 0.0,
                "p50_response_time_ms": 0.0,
                "p95_response_time_ms": 0.0,
                "p99_response_time_ms": 0.0,
            }
        
        return {
            "avg_response_time_ms": statistics.mean(response_times_ms),
            "min_response_time_ms": min(response_times_ms),
            "max_response_time_ms": max(response_times_ms),
            "p50_response_time_ms": MetricsCalculator.calculate_percentile(response_times_ms, 50),
            "p95_response_time_ms": MetricsCalculator.calculate_percentile(response_times_ms, 95),
            "p99_response_time_ms": MetricsCalculator.calculate_percentile(response_times_ms, 99),
        }
    
    @staticmethod
    def calculate_qps(total_requests: int, duration_seconds: float) -> float:
        if duration_seconds <= 0:
            return 0.0
        return total_requests / duration_seconds
    
    @staticmethod
    def calculate_tps(successful_requests: int, duration_seconds: float) -> float:
        if duration_seconds <= 0:
            return 0.0
        return successful_requests / duration_seconds
    
    @staticmethod
    def calculate_error_rate(total_requests: int, failed_requests: int) -> float:
        if total_requests <= 0:
            return 0.0
        return failed_requests / total_requests
    
    @staticmethod
    def calculate_throughput_bytes_per_sec(total_bytes: int, duration_seconds: float) -> float:
        if duration_seconds <= 0:
            return 0.0
        return total_bytes / duration_seconds
    
    @staticmethod
    def calculate_capacity_utilization(
        current_qps: float,
        max_qps_estimated: int,
        cpu_utilization_percent: Optional[float] = None,
        memory_utilization_percent: Optional[float] = None,
        network_utilization_percent: Optional[float] = None
    ) -> float:
        utilizations = []
        
        if max_qps_estimated > 0 and current_qps > 0:
            qps_utilization = (current_qps / max_qps_estimated) * 100
            utilizations.append(qps_utilization)
        
        if cpu_utilization_percent is not None:
            utilizations.append(cpu_utilization_percent)
        
        if memory_utilization_percent is not None:
            utilizations.append(memory_utilization_percent)
        
        if network_utilization_percent is not None:
            utilizations.append(network_utilization_percent)
        
        if not utilizations:
            return 0.0
        
        return max(utilizations)
    
    @staticmethod
    def calculate_all_metrics(
        response_times_ms: List[float],
        total_requests: int,
        failed_requests: int,
        duration_seconds: float,
        total_bytes: int = 0,
        max_qps_estimated: Optional[int] = None,
        cpu_utilization_percent: Optional[float] = None,
        memory_utilization_percent: Optional[float] = None,
        network_utilization_percent: Optional[float] = None
    ) -> Dict[str, Any]:
        response_time_metrics = MetricsCalculator.calculate_response_time_metrics(response_times_ms)
        
        successful_requests = total_requests - failed_requests
        
        qps = MetricsCalculator.calculate_qps(total_requests, duration_seconds)
        tps = MetricsCalculator.calculate_tps(successful_requests, duration_seconds)
        error_rate = MetricsCalculator.calculate_error_rate(total_requests, failed_requests)
        throughput_bytes_per_sec = MetricsCalculator.calculate_throughput_bytes_per_sec(total_bytes, duration_seconds)
        
        capacity_utilization = 0.0
        if max_qps_estimated is not None:
            capacity_utilization = MetricsCalculator.calculate_capacity_utilization(
                current_qps=qps,
                max_qps_estimated=max_qps_estimated,
                cpu_utilization_percent=cpu_utilization_percent,
                memory_utilization_percent=memory_utilization_percent,
                network_utilization_percent=network_utilization_percent
            )
        
        return {
            **response_time_metrics,
            "qps": qps,
            "tps": tps,
            "error_rate": error_rate,
            "throughput_bytes_per_sec": throughput_bytes_per_sec,
            "capacity_utilization_percent": capacity_utilization,
            "total_requests": total_requests,
            "failed_requests": failed_requests,
            "successful_requests": successful_requests,
            "duration_seconds": duration_seconds,
        }
    
    @staticmethod
    def parse_k6_summary(k6_summary: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "response_times_ms": [],
            "total_requests": 0,
            "failed_requests": 0,
            "duration_seconds": 0,
            "total_bytes": 0,
        }
        
        if "metrics" in k6_summary:
            metrics = k6_summary["metrics"]
            
            if "http_req_duration" in metrics:
                req_duration = metrics["http_req_duration"]
                result["avg_response_time_ms"] = req_duration.get("avg", 0)
                result["min_response_time_ms"] = req_duration.get("min", 0)
                result["max_response_time_ms"] = req_duration.get("max", 0)
                result["p50_response_time_ms"] = req_duration.get("p(50)", 0)
                result["p95_response_time_ms"] = req_duration.get("p(95)", 0)
                result["p99_response_time_ms"] = req_duration.get("p(99)", 0)
            
            if "http_reqs" in metrics:
                result["total_requests"] = metrics["http_reqs"].get("count", 0)
            
            if "http_req_failed" in metrics:
                failed = metrics["http_req_failed"].get("count", 0)
                result["failed_requests"] = failed
            
            if "data_received" in metrics:
                result["total_bytes"] += metrics["data_received"].get("count", 0)
            
            if "data_sent" in metrics:
                result["total_bytes"] += metrics["data_sent"].get("count", 0)
        
        if "state" in k6_summary:
            state = k6_summary["state"]
            if "testRunDurationMs" in state:
                result["duration_seconds"] = state["testRunDurationMs"] / 1000.0
        
        return result
    
    @staticmethod
    def parse_jmeter_summary(jmeter_summary: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "response_times_ms": [],
            "total_requests": 0,
            "failed_requests": 0,
            "duration_seconds": 0,
            "total_bytes": 0,
        }
        
        if "Total" in jmeter_summary:
            total = jmeter_summary["Total"]
            result["total_requests"] = total.get("sampleCount", 0)
            result["failed_requests"] = total.get("errorCount", 0)
            result["avg_response_time_ms"] = total.get("meanResTime", 0)
            result["min_response_time_ms"] = total.get("minResTime", 0)
            result["max_response_time_ms"] = total.get("maxResTime", 0)
            result["p50_response_time_ms"] = total.get("pct1ResTime", 0)
            result["p95_response_time_ms"] = total.get("pct2ResTime", 0)
            result["p99_response_time_ms"] = total.get("pct3ResTime", 0)
            result["throughput_bytes_per_sec"] = total.get("throughput", 0)
        
        return result
