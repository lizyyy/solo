from typing import Dict, Any, List, Optional
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class StatusCodeComparator(BaseComparator):
    """状态码对比器"""
    
    COMPARISON_TYPE = 'status_code'
    
    LEGACY_TO_GRPC_STATUS_MAP = {
        200: 0,
        400: 3,
        401: 16,
        403: 7,
        404: 5,
        409: 6,
        412: 9,
        429: 8,
        500: 13,
        501: 12,
        503: 14,
        504: 4,
    }
    
    GRPC_STATUS_NAMES = {
        0: 'OK',
        1: 'CANCELLED',
        2: 'UNKNOWN',
        3: 'INVALID_ARGUMENT',
        4: 'DEADLINE_EXCEEDED',
        5: 'NOT_FOUND',
        6: 'ALREADY_EXISTS',
        7: 'PERMISSION_DENIED',
        8: 'RESOURCE_EXHAUSTED',
        9: 'FAILED_PRECONDITION',
        10: 'ABORTED',
        11: 'OUT_OF_RANGE',
        12: 'UNIMPLEMENTED',
        13: 'INTERNAL',
        14: 'UNAVAILABLE',
        15: 'DATA_LOSS',
        16: 'UNAUTHENTICATED',
    }
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.custom_mapping = self.config.get('status_mapping', {})
    
    def compare(self, legacy_data: Dict, grpc_data: Dict) -> ComparisonResult:
        """对比状态码"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        legacy_success = legacy_data.get('success', False)
        grpc_success = grpc_data.get('success', False)
        
        legacy_status = legacy_data.get('status_code')
        legacy_error_code = legacy_data.get('error', {}).get('code') if not legacy_success else None
        
        grpc_code = grpc_data.get('grpc_code', 0 if grpc_success else 13)
        grpc_error_code = grpc_data.get('error', {}).get('code') if not grpc_success else None
        
        result.details = {
            'legacy_success': legacy_success,
            'grpc_success': grpc_success,
            'legacy_status_code': legacy_status,
            'legacy_error_code': legacy_error_code,
            'grpc_code': grpc_code,
            'grpc_code_name': self.GRPC_STATUS_NAMES.get(grpc_code, 'UNKNOWN'),
            'grpc_error_code': grpc_error_code
        }
        
        issues = []
        
        if legacy_success != grpc_success:
            if legacy_success and not grpc_success:
                issues.append(
                    self.create_issue(
                        'success_mismatch',
                        '状态不匹配: 老 RPC 成功但 gRPC 失败',
                        'critical',
                        legacy_value={'success': True, 'status': legacy_status},
                        grpc_value={'success': False, 'code': grpc_code, 'error': grpc_error_code},
                        suggestion='检查 gRPC 实现是否正确处理了该请求',
                        field_path='success'
                    )
                )
            elif not legacy_success and grpc_success:
                issues.append(
                    self.create_issue(
                        'success_mismatch',
                        '状态不匹配: 老 RPC 失败但 gRPC 成功',
                        'critical',
                        legacy_value={'success': False, 'error': legacy_error_code},
                        grpc_value={'success': True, 'code': grpc_code},
                        suggestion='检查 gRPC 是否应该返回错误，或老 RPC 的错误处理是否正确',
                        field_path='success'
                    )
                )
        else:
            if legacy_success:
                expected_grpc_code = self._map_legacy_to_grpc(legacy_status)
                if grpc_code != expected_grpc_code:
                    issues.append(
                        self.create_issue(
                            'status_code_mismatch',
                            f'状态码不匹配: 老 HTTP 状态 {legacy_status} -> 期望 gRPC 代码 {expected_grpc_code} ({self.GRPC_STATUS_NAMES.get(expected_grpc_code)}), 实际 {grpc_code} ({self.GRPC_STATUS_NAMES.get(grpc_code)})',
                            'warning',
                            legacy_value=legacy_status,
                            grpc_value=grpc_code,
                            suggestion='确认状态码映射是否正确',
                            field_path='status_code'
                        )
                    )
            else:
                expected_grpc_code = self._map_legacy_to_grpc(legacy_status)
                if legacy_error_code and grpc_error_code:
                    if legacy_error_code != grpc_error_code:
                        issues.append(
                            self.create_issue(
                                'error_code_mismatch',
                                f'错误码不匹配: 老 RPC {legacy_error_code}, gRPC {grpc_error_code}',
                                'warning',
                                legacy_value=legacy_error_code,
                                grpc_value=grpc_error_code,
                                suggestion='确认错误码映射是否正确',
                                field_path='error.code'
                            )
                        )
                
                if grpc_code != expected_grpc_code and expected_grpc_code is not None:
                    issues.append(
                        self.create_issue(
                            'grpc_code_mismatch',
                            f'gRPC 状态码不匹配: 期望 {expected_grpc_code} ({self.GRPC_STATUS_NAMES.get(expected_grpc_code)}), 实际 {grpc_code} ({self.GRPC_STATUS_NAMES.get(grpc_code)})',
                            'warning',
                            legacy_value=legacy_status,
                            grpc_value=grpc_code,
                            suggestion='确认 gRPC 错误状态码映射是否正确',
                            field_path='grpc_code'
                        )
                    )
        
        result.issues = issues
        result.is_match = len(issues) == 0
        
        return result
    
    def _map_legacy_to_grpc(self, legacy_status: Optional[int]) -> Optional[int]:
        """将老 RPC 状态码映射到 gRPC 状态码"""
        if legacy_status is None:
            return None
        
        if str(legacy_status) in self.custom_mapping:
            return self.custom_mapping[str(legacy_status)]
        
        return self.LEGACY_TO_GRPC_STATUS_MAP.get(legacy_status)
