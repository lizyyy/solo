"""
Pod Metrics and Traffic Metrics CSV Parsers
"""

import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

from ..models.metrics import PodMetrics, TrafficMetrics

logger = logging.getLogger(__name__)


class PodMetricsParser:
    def __init__(self):
        self.metrics: List[PodMetrics] = []
        self.column_mapping = {
            'timestamp': ['timestamp', 'time', 'datetime', 'date'],
            'pod_name': ['pod', 'pod_name', 'podname', 'name'],
            'namespace': ['namespace', 'ns'],
            'container_name': ['container', 'container_name', 'containername'],
            'cpu_usage_cores': ['cpu_usage', 'cpu', 'cpu_cores', 'usage_cpu_cores'],
            'cpu_limit_cores': ['cpu_limit', 'cpu_limits', 'limits_cpu'],
            'cpu_request_cores': ['cpu_request', 'cpu_requests', 'requests_cpu'],
            'memory_usage_bytes': ['memory_usage', 'memory', 'memory_bytes', 'usage_memory'],
            'memory_limit_bytes': ['memory_limit', 'memory_limits', 'limits_memory'],
            'memory_request_bytes': ['memory_request', 'memory_requests', 'requests_memory'],
            'memory_working_set_bytes': ['memory_working_set', 'working_set', 'memory_workingset'],
            'memory_cache_bytes': ['memory_cache', 'cache'],
            'container_memory_rss_bytes': ['rss', 'memory_rss', 'container_rss'],
            'container_memory_swap_bytes': ['swap', 'memory_swap'],
            'jvm_heap_used_bytes': ['jvm_heap_used', 'heap_used', 'jvm_heap'],
            'jvm_heap_max_bytes': ['jvm_heap_max', 'heap_max', 'max_heap'],
            'jvm_heap_committed_bytes': ['jvm_heap_committed', 'heap_committed'],
            'jvm_non_heap_used_bytes': ['jvm_non_heap', 'non_heap_used'],
            'network_rx_bytes': ['network_rx', 'rx_bytes', 'receive'],
            'network_tx_bytes': ['network_tx', 'tx_bytes', 'transmit'],
            'restart_count': ['restart_count', 'restarts', 'restart'],
            'is_ready': ['ready', 'is_ready', 'status'],
        }
    
    def parse_file(self, filepath: str) -> List[PodMetrics]:
        self.metrics = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                metric = self._parse_row(row)
                if metric:
                    self.metrics.append(metric)
        
        return self.metrics
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[PodMetrics]:
        try:
            mapped = self._map_columns(row)
            
            timestamp = self._parse_timestamp(mapped.get('timestamp'))
            if not timestamp:
                timestamp = datetime.now()
            
            return PodMetrics(
                timestamp=timestamp,
                pod_name=mapped.get('pod_name', 'unknown'),
                namespace=mapped.get('namespace', 'default'),
                container_name=mapped.get('container_name', 'unknown'),
                
                cpu_usage_cores=self._parse_float(mapped.get('cpu_usage_cores')),
                cpu_limit_cores=self._parse_float(mapped.get('cpu_limit_cores')),
                cpu_request_cores=self._parse_float(mapped.get('cpu_request_cores')),
                
                memory_usage_bytes=self._parse_bytes(mapped.get('memory_usage_bytes')),
                memory_limit_bytes=self._parse_bytes(mapped.get('memory_limit_bytes')),
                memory_request_bytes=self._parse_bytes(mapped.get('memory_request_bytes')),
                memory_working_set_bytes=self._parse_bytes(mapped.get('memory_working_set_bytes', mapped.get('memory_usage_bytes'))),
                memory_cache_bytes=self._parse_bytes(mapped.get('memory_cache_bytes')),
                
                container_memory_rss_bytes=self._parse_bytes(mapped.get('container_memory_rss_bytes')),
                container_memory_swap_bytes=self._parse_bytes(mapped.get('container_memory_swap_bytes')),
                
                jvm_heap_used_bytes=self._parse_bytes(mapped.get('jvm_heap_used_bytes')),
                jvm_heap_max_bytes=self._parse_bytes(mapped.get('jvm_heap_max_bytes')),
                jvm_heap_committed_bytes=self._parse_bytes(mapped.get('jvm_heap_committed_bytes')),
                jvm_non_heap_used_bytes=self._parse_bytes(mapped.get('jvm_non_heap_used_bytes')),
                
                network_rx_bytes=self._parse_bytes(mapped.get('network_rx_bytes')),
                network_tx_bytes=self._parse_bytes(mapped.get('network_tx_bytes')),
                
                restart_count=self._parse_int(mapped.get('restart_count')),
                is_ready=self._parse_bool(mapped.get('is_ready', 'true')),
            )
        except Exception as e:
            logger.debug(f"Failed to parse pod metrics row: {e}")
            return None
    
    def _map_columns(self, row: Dict[str, str]) -> Dict[str, str]:
        result = {}
        row_lower = {k.lower(): v for k, v in row.items()}
        
        for target_field, possible_cols in self.column_mapping.items():
            for col in possible_cols:
                if col in row_lower:
                    result[target_field] = row_lower[col]
                    break
            
            if target_field not in result:
                for original_col in row.keys():
                    if any(pc in original_col.lower() for pc in possible_cols):
                        result[target_field] = row[original_col]
                        break
        
        return result
    
    def _parse_timestamp(self, value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        
        value = value.strip()
        
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.replace('+00:00', '').replace('Z', ''), fmt)
            except ValueError:
                continue
        
        try:
            ts = float(value)
            if ts > 1e12:
                return datetime.fromtimestamp(ts / 1000)
            elif ts > 1e9:
                return datetime.fromtimestamp(ts)
        except ValueError:
            pass
        
        return None
    
    def _parse_float(self, value: Optional[str]) -> float:
        if not value:
            return 0.0
        
        value = value.strip().lower()
        
        multipliers = {
            'n': 1e-9, 'nano': 1e-9,
            'u': 1e-6, 'micro': 1e-6,
            'm': 1e-3, 'milli': 1e-3,
            'k': 1e3, 'kilo': 1e3,
        }
        
        for suffix, multiplier in multipliers.items():
            if value.endswith(suffix):
                try:
                    num = float(value[:-len(suffix)])
                    return num * multiplier
                except ValueError:
                    pass
        
        try:
            return float(value)
        except ValueError:
            return 0.0
    
    def _parse_bytes(self, value: Optional[str]) -> int:
        if not value:
            return 0
        
        value = value.strip().lower()
        
        multipliers = {
            'ki': 1024, 'kib': 1024,
            'mi': 1024**2, 'mib': 1024**2,
            'gi': 1024**3, 'gib': 1024**3,
            'ti': 1024**4, 'tib': 1024**4,
            'k': 1000, 'kb': 1000,
            'm': 1000**2, 'mb': 1000**2,
            'g': 1000**3, 'gb': 1000**3,
            't': 1000**4, 'tb': 1000**4,
        }
        
        for suffix, multiplier in sorted(multipliers.items(), key=lambda x: -len(x[0])):
            if value.endswith(suffix):
                try:
                    num = float(value[:-len(suffix)])
                    return int(num * multiplier)
                except ValueError:
                    pass
        
        try:
            return int(float(value))
        except ValueError:
            return 0
    
    def _parse_int(self, value: Optional[str]) -> int:
        if not value:
            return 0
        try:
            return int(float(value))
        except ValueError:
            return 0
    
    def _parse_bool(self, value: str) -> bool:
        return str(value).lower() in ('true', '1', 'yes', 'y', 'ready')


class TrafficMetricsParser:
    def __init__(self):
        self.metrics: List[TrafficMetrics] = []
    
    def parse_file(self, filepath: str) -> List[TrafficMetrics]:
        self.metrics = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                metric = self._parse_row(row)
                if metric:
                    self.metrics.append(metric)
        
        return self.metrics
    
    def _parse_row(self, row: Dict[str, str]) -> Optional[TrafficMetrics]:
        try:
            row_lower = {k.lower(): v for k, v in row.items()}
            
            timestamp_str = row_lower.get('timestamp', row_lower.get('time', ''))
            timestamp = self._parse_timestamp(timestamp_str) or datetime.now()
            
            return TrafficMetrics(
                timestamp=timestamp,
                requests_per_second=self._parse_float(
                    row_lower.get('rps', row_lower.get('requests_per_second', row_lower.get('qps', '0')))
                ),
                response_time_ms_p50=self._parse_float(
                    row_lower.get('p50', row_lower.get('response_time_p50', row_lower.get('latency_p50', '0')))
                ),
                response_time_ms_p95=self._parse_float(
                    row_lower.get('p95', row_lower.get('response_time_p95', row_lower.get('latency_p95', '0')))
                ),
                response_time_ms_p99=self._parse_float(
                    row_lower.get('p99', row_lower.get('response_time_p99', row_lower.get('latency_p99', '0')))
                ),
                error_rate=self._parse_float(
                    row_lower.get('error_rate', row_lower.get('errors', '0'))
                ),
                throughput_bytes_per_second=self._parse_bytes(
                    row_lower.get('throughput', row_lower.get('bandwidth', '0'))
                ),
                active_connections=self._parse_int(
                    row_lower.get('connections', row_lower.get('active_connections', '0'))
                ),
                queue_length=self._parse_int(
                    row_lower.get('queue', row_lower.get('queue_length', '0'))
                ),
            )
        except Exception as e:
            logger.debug(f"Failed to parse traffic metrics row: {e}")
            return None
    
    def _parse_timestamp(self, value: str) -> Optional[datetime]:
        if not value:
            return None
        
        value = value.strip()
        
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value.replace('Z', '').replace('+00:00', ''), fmt)
            except ValueError:
                continue
        
        try:
            ts = float(value)
            if ts > 1e12:
                return datetime.fromtimestamp(ts / 1000)
            elif ts > 1e9:
                return datetime.fromtimestamp(ts)
        except ValueError:
            pass
        
        return None
    
    def _parse_float(self, value: str) -> float:
        if not value:
            return 0.0
        try:
            return float(value.strip())
        except ValueError:
            return 0.0
    
    def _parse_int(self, value: str) -> int:
        if not value:
            return 0
        try:
            return int(float(value.strip()))
        except ValueError:
            return 0
    
    def _parse_bytes(self, value: str) -> int:
        if not value:
            return 0
        
        value = value.strip().lower()
        
        multipliers = {
            'k': 1000, 'kb': 1000,
            'm': 1000**2, 'mb': 1000**2,
            'g': 1000**3, 'gb': 1000**3,
            'ki': 1024, 'kib': 1024,
            'mi': 1024**2, 'mib': 1024**2,
            'gi': 1024**3, 'gib': 1024**3,
        }
        
        for suffix, multiplier in sorted(multipliers.items(), key=lambda x: -len(x[0])):
            if value.endswith(suffix):
                try:
                    num = float(value[:-len(suffix)])
                    return int(num * multiplier)
                except ValueError:
                    pass
        
        try:
            return int(float(value))
        except ValueError:
            return 0
