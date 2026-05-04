"""
Metrics data models for Pod and Traffic
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class PodMetrics:
    timestamp: datetime
    pod_name: str
    namespace: str
    container_name: str
    
    cpu_usage_cores: float = 0.0
    cpu_limit_cores: float = 0.0
    cpu_request_cores: float = 0.0
    
    memory_usage_bytes: int = 0
    memory_limit_bytes: int = 0
    memory_request_bytes: int = 0
    memory_working_set_bytes: int = 0
    memory_cache_bytes: int = 0
    
    container_memory_rss_bytes: int = 0
    container_memory_swap_bytes: int = 0
    
    jvm_heap_used_bytes: int = 0
    jvm_heap_max_bytes: int = 0
    jvm_heap_committed_bytes: int = 0
    jvm_non_heap_used_bytes: int = 0
    
    network_rx_bytes: int = 0
    network_tx_bytes: int = 0
    
    restart_count: int = 0
    is_ready: bool = True
    
    extra_info: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def memory_headroom_bytes(self) -> int:
        if self.memory_limit_bytes == 0:
            return 0
        return self.memory_limit_bytes - self.memory_working_set_bytes
    
    @property
    def memory_usage_percent(self) -> float:
        if self.memory_limit_bytes == 0:
            return 0.0
        return (self.memory_working_set_bytes / self.memory_limit_bytes) * 100
    
    @property
    def jvm_heap_usage_percent(self) -> float:
        if self.jvm_heap_max_bytes == 0:
            return 0.0
        return (self.jvm_heap_used_bytes / self.jvm_heap_max_bytes) * 100
    
    @property
    def is_near_oom_kill(self) -> bool:
        return self.memory_usage_percent >= 90.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "pod_name": self.pod_name,
            "namespace": self.namespace,
            "container_name": self.container_name,
            "memory_working_set_bytes": self.memory_working_set_bytes,
            "memory_limit_bytes": self.memory_limit_bytes,
            "memory_headroom_bytes": self.memory_headroom_bytes,
            "memory_usage_percent": round(self.memory_usage_percent, 2),
            "jvm_heap_used_bytes": self.jvm_heap_used_bytes,
            "jvm_heap_max_bytes": self.jvm_heap_max_bytes,
            "jvm_heap_usage_percent": round(self.jvm_heap_usage_percent, 2),
            "cpu_usage_cores": self.cpu_usage_cores,
            "cpu_limit_cores": self.cpu_limit_cores,
            "is_near_oom_kill": self.is_near_oom_kill,
            "restart_count": self.restart_count,
            **self.extra_info
        }


@dataclass
class TrafficMetrics:
    timestamp: datetime
    
    requests_per_second: float = 0.0
    response_time_ms_p50: float = 0.0
    response_time_ms_p95: float = 0.0
    response_time_ms_p99: float = 0.0
    
    error_rate: float = 0.0
    throughput_bytes_per_second: float = 0.0
    
    active_connections: int = 0
    queue_length: int = 0
    
    extra_info: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_traffic_peak(self) -> bool:
        return self.requests_per_second > 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "requests_per_second": round(self.requests_per_second, 2),
            "response_time_ms_p50": round(self.response_time_ms_p50, 2),
            "response_time_ms_p95": round(self.response_time_ms_p95, 2),
            "response_time_ms_p99": round(self.response_time_ms_p99, 2),
            "error_rate": round(self.error_rate, 4),
            "throughput_bytes_per_second": round(self.throughput_bytes_per_second, 2),
            "active_connections": self.active_connections,
            "queue_length": self.queue_length,
            **self.extra_info
        }
