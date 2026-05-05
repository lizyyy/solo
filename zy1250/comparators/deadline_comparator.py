from typing import Dict, Any, List
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class DeadlineComparator(BaseComparator):
    """超时/Deadline 对比器"""
    
    COMPARISON_TYPE = 'deadline'
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.tolerance_ms = self.config.get('tolerance_ms', 5000)  # 5秒容差
        self.min_deadline_ms = self.config.get('min_deadline_ms', 1000)  # 最小 1 秒
    
    def compare(self, legacy_data: Dict, grpc_data: Dict) -> ComparisonResult:
        """对比超时设置"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        legacy_deadline = legacy_data.get('deadline_ms', 30000)
        grpc_deadline = grpc_data.get('deadline_ms', 30000)
        
        legacy_elapsed = legacy_data.get('elapsed_ms', 0)
        grpc_elapsed = grpc_data.get('elapsed_ms', 0)
        
        result.details = {
            'legacy_deadline_ms': legacy_deadline,
            'grpc_deadline_ms': grpc_deadline,
            'legacy_elapsed_ms': legacy_elapsed,
            'grpc_elapsed_ms': grpc_elapsed
        }
        
        issues = []
        
        if legacy_deadline != grpc_deadline:
            diff_ms = abs(legacy_deadline - grpc_deadline)
            if diff_ms > self.tolerance_ms:
                issues.append(
                    self.create_issue(
                        'deadline_mismatch',
                        f'Deadline 设置差异过大: 老 RPC {legacy_deadline}ms, gRPC {grpc_deadline}ms (差异 {diff_ms}ms)',
                        'warning',
                        legacy_value=legacy_deadline,
                        grpc_value=grpc_deadline,
                        suggestion='确认两个接口的超时时间是否应该一致，或是否为业务需求',
                        field_path='deadline_ms'
                    )
                )
            else:
                issues.append(
                    self.create_issue(
                        'deadline_minor_mismatch',
                        f'Deadline 有轻微差异: 老 RPC {legacy_deadline}ms, gRPC {grpc_deadline}ms (差异 {diff_ms}ms, 在容差范围内)',
                        'info',
                        legacy_value=legacy_deadline,
                        grpc_value=grpc_deadline,
                        suggestion='如果是业务需求，可以忽略此差异',
                        field_path='deadline_ms'
                    )
                )
        
        if legacy_deadline < self.min_deadline_ms:
            issues.append(
                self.create_issue(
                    'deadline_too_short',
                    f'老 RPC Deadline 过短: {legacy_deadline}ms (建议至少 {self.min_deadline_ms}ms)',
                    'critical',
                    legacy_value=legacy_deadline,
                    suggestion='考虑增加超时时间以避免网络波动导致的失败',
                    field_path='deadline_ms'
                )
            )
        
        if grpc_deadline < self.min_deadline_ms:
            issues.append(
                self.create_issue(
                    'deadline_too_short',
                    f'gRPC Deadline 过短: {grpc_deadline}ms (建议至少 {self.min_deadline_ms}ms)',
                    'critical',
                    grpc_value=grpc_deadline,
                    suggestion='考虑增加超时时间以避免网络波动导致的失败',
                    field_path='deadline_ms'
                )
            )
        
        if legacy_elapsed > 0 and grpc_elapsed > 0:
            elapsed_diff_ms = abs(legacy_elapsed - grpc_elapsed)
            result.details['elapsed_diff_ms'] = elapsed_diff_ms
            
            if elapsed_diff_ms > self.tolerance_ms:
                issues.append(
                    self.create_issue(
                        'response_time_diff',
                        f'响应时间差异较大: 老 RPC {legacy_elapsed:.2f}ms, gRPC {grpc_elapsed:.2f}ms (差异 {elapsed_diff_ms:.2f}ms)',
                        'warning',
                        legacy_value=legacy_elapsed,
                        grpc_value=grpc_elapsed,
                        suggestion='检查 gRPC 实现是否存在性能问题，或是否为预期差异',
                        field_path='elapsed_ms'
                    )
                )
        
        result.issues = issues
        result.is_match = len(issues) == 0
        
        return result
