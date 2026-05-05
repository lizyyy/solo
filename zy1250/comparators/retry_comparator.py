from typing import Dict, Any, List, Optional
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class RetryComparator(BaseComparator):
    """重试语义对比器"""
    
    COMPARISON_TYPE = 'retry'
    
    DEFAULT_LEGACY_RETRY = {
        'max_attempts': 3,
        'initial_backoff_ms': 100,
        'max_backoff_ms': 1000,
        'backoff_multiplier': 2,
        'retryable_errors': ['TIMEOUT', 'UNAVAILABLE', 'INTERNAL_ERROR']
    }
    
    DEFAULT_GRPC_RETRY = {
        'max_attempts': 3,
        'initial_backoff': '0.1s',
        'max_backoff': '1s',
        'backoff_multiplier': 2,
        'retryable_status_codes': [4, 14, 13]
    }
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
    
    def compare(self, legacy_data: Dict, grpc_data: Dict) -> ComparisonResult:
        """对比重试策略"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        legacy_retry = legacy_data.get('retry_policy', self.DEFAULT_LEGACY_RETRY.copy())
        grpc_retry = grpc_data.get('retry_policy', self.DEFAULT_GRPC_RETRY.copy())
        
        result.details = {
            'legacy_retry': legacy_retry,
            'grpc_retry': grpc_retry
        }
        
        issues = []
        
        legacy_max_attempts = legacy_retry.get('max_attempts', 3)
        grpc_max_attempts = grpc_retry.get('max_attempts', 3)
        
        if legacy_max_attempts != grpc_max_attempts:
            issues.append(
                self.create_issue(
                    'max_attempts_mismatch',
                    f'最大重试次数不匹配: 老 RPC {legacy_max_attempts} 次, gRPC {grpc_max_attempts} 次',
                    'warning',
                    legacy_value=legacy_max_attempts,
                    grpc_value=grpc_max_attempts,
                    suggestion='确认重试次数是否应该一致',
                    field_path='retry_policy.max_attempts'
                )
            )
        
        legacy_initial_backoff = self._parse_backoff(legacy_retry.get('initial_backoff_ms', 100), 'ms')
        grpc_initial_backoff = self._parse_backoff(grpc_retry.get('initial_backoff', '0.1s'), 's')
        
        if abs(legacy_initial_backoff - grpc_initial_backoff) > 50:
            issues.append(
                self.create_issue(
                    'initial_backoff_mismatch',
                    f'初始退避时间不匹配: 老 RPC {legacy_initial_backoff}ms, gRPC {grpc_initial_backoff}ms',
                    'warning',
                    legacy_value=legacy_initial_backoff,
                    grpc_value=grpc_initial_backoff,
                    suggestion='确认退避策略是否应该一致',
                    field_path='retry_policy.initial_backoff'
                )
            )
        
        legacy_max_backoff = self._parse_backoff(legacy_retry.get('max_backoff_ms', 1000), 'ms')
        grpc_max_backoff = self._parse_backoff(grpc_retry.get('max_backoff', '1s'), 's')
        
        if abs(legacy_max_backoff - grpc_max_backoff) > 100:
            issues.append(
                self.create_issue(
                    'max_backoff_mismatch',
                    f'最大退避时间不匹配: 老 RPC {legacy_max_backoff}ms, gRPC {grpc_max_backoff}ms',
                    'warning',
                    legacy_value=legacy_max_backoff,
                    grpc_value=grpc_max_backoff,
                    suggestion='确认退避策略是否应该一致',
                    field_path='retry_policy.max_backoff'
                )
            )
        
        legacy_multiplier = legacy_retry.get('backoff_multiplier', 2)
        grpc_multiplier = grpc_retry.get('backoff_multiplier', 2)
        
        if legacy_multiplier != grpc_multiplier:
            issues.append(
                self.create_issue(
                    'backoff_multiplier_mismatch',
                    f'退避乘数不匹配: 老 RPC {legacy_multiplier}, gRPC {grpc_multiplier}',
                    'warning',
                    legacy_value=legacy_multiplier,
                    grpc_value=grpc_multiplier,
                    suggestion='确认退避策略是否应该一致',
                    field_path='retry_policy.backoff_multiplier'
                )
            )
        
        legacy_retryable = set(legacy_retry.get('retryable_errors', []))
        grpc_retryable = set(grpc_retry.get('retryable_status_codes', []))
        
        if legacy_retryable and grpc_retryable:
            mapped_grpc = self._map_legacy_errors_to_grpc(legacy_retryable)
            missing = set(mapped_grpc) - grpc_retryable
            extra = grpc_retryable - set(mapped_grpc)
            
            if missing:
                issues.append(
                    self.create_issue(
                        'retryable_errors_missing',
                        f'gRPC 缺少可重试状态码: {missing}',
                        'critical',
                        legacy_value=list(legacy_retryable),
                        grpc_value=list(grpc_retryable),
                        suggestion='检查 gRPC 重试策略是否包含所有必要的可重试状态码',
                        field_path='retry_policy.retryable_status_codes'
                    )
                )
            
            if extra:
                issues.append(
                    self.create_issue(
                        'retryable_errors_extra',
                        f'gRPC 有额外的可重试状态码: {extra}',
                        'info',
                        legacy_value=list(legacy_retryable),
                        grpc_value=list(grpc_retryable),
                        suggestion='确认这些额外的状态码是否应该是可重试的',
                        field_path='retry_policy.retryable_status_codes'
                    )
                )
        
        result.issues = issues
        result.is_match = len(issues) == 0
        
        return result
    
    def _parse_backoff(self, value: Any, default_unit: str) -> int:
        """解析退避时间为毫秒"""
        if isinstance(value, int):
            if default_unit == 's':
                return value * 1000
            return value
        
        if isinstance(value, str):
            if value.endswith('ms'):
                return int(value[:-2])
            elif value.endswith('s'):
                return int(float(value[:-1]) * 1000)
            elif value.endswith('m'):
                return int(float(value[:-1]) * 60 * 1000)
        
        return 100
    
    def _map_legacy_errors_to_grpc(self, legacy_errors: set) -> List[int]:
        """将老 RPC 错误映射到 gRPC 状态码"""
        error_map = {
            'TIMEOUT': 4,
            'DEADLINE_EXCEEDED': 4,
            'UNAVAILABLE': 14,
            'INTERNAL_ERROR': 13,
            'INTERNAL': 13,
            'RESOURCE_EXHAUSTED': 8,
            'ABORTED': 10,
        }
        
        return [error_map[e] for e in legacy_errors if e in error_map]
