from typing import Dict, Any, List, Optional
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class ErrorMappingComparator(BaseComparator):
    """错误映射对比器"""
    
    COMPARISON_TYPE = 'error_mapping'
    
    STANDARD_ERROR_MAP = {
        'INVALID_ARGUMENT': {
            'grpc_code': 3,
            'http_code': 400,
            'description': '客户端指定了无效参数'
        },
        'NOT_FOUND': {
            'grpc_code': 5,
            'http_code': 404,
            'description': '未找到请求的资源'
        },
        'ALREADY_EXISTS': {
            'grpc_code': 6,
            'http_code': 409,
            'description': '资源已存在'
        },
        'PERMISSION_DENIED': {
            'grpc_code': 7,
            'http_code': 403,
            'description': '权限不足'
        },
        'UNAUTHENTICATED': {
            'grpc_code': 16,
            'http_code': 401,
            'description': '未认证'
        },
        'RESOURCE_EXHAUSTED': {
            'grpc_code': 8,
            'http_code': 429,
            'description': '资源耗尽（如限流）'
        },
        'FAILED_PRECONDITION': {
            'grpc_code': 9,
            'http_code': 412,
            'description': '前置条件失败'
        },
        'ABORTED': {
            'grpc_code': 10,
            'http_code': 409,
            'description': '操作被中止'
        },
        'OUT_OF_RANGE': {
            'grpc_code': 11,
            'http_code': 400,
            'description': '参数超出范围'
        },
        'UNIMPLEMENTED': {
            'grpc_code': 12,
            'http_code': 501,
            'description': '方法未实现'
        },
        'INTERNAL': {
            'grpc_code': 13,
            'http_code': 500,
            'description': '内部错误'
        },
        'UNAVAILABLE': {
            'grpc_code': 14,
            'http_code': 503,
            'description': '服务不可用'
        },
        'DATA_LOSS': {
            'grpc_code': 15,
            'http_code': 500,
            'description': '数据丢失'
        },
        'DEADLINE_EXCEEDED': {
            'grpc_code': 4,
            'http_code': 504,
            'description': '超时'
        },
        'CANCELLED': {
            'grpc_code': 1,
            'http_code': 499,
            'description': '客户端取消'
        }
    }
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.custom_mapping = self.config.get('error_mapping', {})
    
    def compare(self, legacy_data: Dict, grpc_data: Dict) -> ComparisonResult:
        """对比错误映射"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        legacy_error_codes = legacy_data.get('error_codes', [])
        grpc_error_config = grpc_data.get('error_config', {})
        
        result.details = {
            'legacy_error_codes': legacy_error_codes,
            'grpc_error_config': grpc_error_config
        }
        
        issues = []
        
        if not legacy_error_codes:
            issues.append(
                self.create_issue(
                    'no_legacy_error_codes',
                    '老 RPC 未定义错误码',
                    'info',
                    suggestion='建议在 rpc-services.yaml 中定义所有可能的错误码'
                )
            )
        else:
            for legacy_error in legacy_error_codes:
                issues.extend(self._check_error_mapping(legacy_error, grpc_error_config))
        
        result.issues = issues
        result.is_match = len(issues) == 0
        
        return result
    
    def _check_error_mapping(self, legacy_error: Dict, grpc_error_config: Dict) -> List[ComparisonIssue]:
        """检查单个错误码的映射"""
        issues = []
        
        legacy_code = legacy_error.get('code', '')
        legacy_description = legacy_error.get('description', '')
        legacy_http_code = legacy_error.get('http_code')
        
        if not legacy_code:
            return issues
        
        standard_mapping = self.STANDARD_ERROR_MAP.get(legacy_code)
        custom_mapping = self.custom_mapping.get(legacy_code)
        
        if custom_mapping:
            expected_grpc = custom_mapping.get('grpc_code')
        elif standard_mapping:
            expected_grpc = standard_mapping['grpc_code']
        else:
            expected_grpc = None
        
        grpc_mappings = grpc_error_config.get('mappings', {})
        actual_grpc = grpc_mappings.get(legacy_code)
        
        if expected_grpc is not None:
            if actual_grpc is None:
                issues.append(
                    self.create_issue(
                        'error_mapping_missing',
                        f'错误码 {legacy_code} 缺少 gRPC 映射',
                        'critical',
                        legacy_value={'code': legacy_code, 'http_code': legacy_http_code},
                        grpc_value=None,
                        suggestion=f'建议映射到 gRPC 代码 {expected_grpc} ({self._get_grpc_status_name(expected_grpc)})',
                        field_path=f'error_codes.{legacy_code}'
                    )
                )
            elif actual_grpc != expected_grpc:
                issues.append(
                    self.create_issue(
                        'error_mapping_incorrect',
                        f'错误码 {legacy_code} 映射不正确: 期望 {expected_grpc} ({self._get_grpc_status_name(expected_grpc)}), 实际 {actual_grpc} ({self._get_grpc_status_name(actual_grpc)})',
                        'warning',
                        legacy_value={'code': legacy_code, 'http_code': legacy_http_code},
                        grpc_value=actual_grpc,
                        suggestion='确认错误码映射是否符合业务需求',
                        field_path=f'error_codes.{legacy_code}'
                    )
                )
        
        if legacy_http_code:
            http_to_grpc_map = {
                400: 3, 401: 16, 403: 7, 404: 5,
                409: 6, 412: 9, 429: 8,
                500: 13, 501: 12, 503: 14, 504: 4
            }
            
            expected_from_http = http_to_grpc_map.get(legacy_http_code)
            if expected_from_http and actual_grpc and actual_grpc != expected_from_http:
                issues.append(
                    self.create_issue(
                        'http_to_grpc_mismatch',
                        f'HTTP 状态码 {legacy_http_code} 对应 gRPC 代码应为 {expected_from_http}, 实际 {actual_grpc}',
                        'warning',
                        legacy_value=legacy_http_code,
                        grpc_value=actual_grpc,
                        suggestion='确认 HTTP 到 gRPC 状态码映射是否正确',
                        field_path=f'error_codes.{legacy_code}.http_code'
                    )
                )
        
        return issues
    
    def _get_grpc_status_name(self, code: int) -> str:
        """获取 gRPC 状态码名称"""
        names = {
            0: 'OK', 1: 'CANCELLED', 2: 'UNKNOWN', 3: 'INVALID_ARGUMENT',
            4: 'DEADLINE_EXCEEDED', 5: 'NOT_FOUND', 6: 'ALREADY_EXISTS',
            7: 'PERMISSION_DENIED', 8: 'RESOURCE_EXHAUSTED', 9: 'FAILED_PRECONDITION',
            10: 'ABORTED', 11: 'OUT_OF_RANGE', 12: 'UNIMPLEMENTED',
            13: 'INTERNAL', 14: 'UNAVAILABLE', 15: 'DATA_LOSS', 16: 'UNAUTHENTICATED'
        }
        return names.get(code, 'UNKNOWN')
