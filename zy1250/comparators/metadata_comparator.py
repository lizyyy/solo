from typing import Dict, Any, List, Set, Tuple
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class MetadataComparator(BaseComparator):
    """元数据对比器"""
    
    COMPARISON_TYPE = 'metadata'
    
    STANDARD_GRPC_METADATA = [
        'authorization',
        'x-request-id',
        'x-b3-traceid',
        'x-b3-spanid',
        'x-b3-parentspanid',
        'x-b3-sampled',
        'x-b3-flags',
        'grpc-accept-encoding',
        'grpc-encoding',
        'grpc-message-type',
        'grpc-status',
        'grpc-message',
    ]
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.ignore_metadata = set(self.config.get('ignore_metadata', []))
        self.required_metadata = set(self.config.get('required_metadata', []))
    
    def compare(self, legacy_data: Dict, grpc_data: Dict) -> ComparisonResult:
        """对比元数据"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        legacy_metadata = legacy_data.get('metadata', [])
        grpc_metadata = grpc_data.get('metadata', [])
        
        legacy_metadata_dict = self._normalize_metadata(legacy_metadata)
        grpc_metadata_dict = self._normalize_metadata(grpc_metadata)
        
        result.details = {
            'legacy_metadata': legacy_metadata_dict,
            'grpc_metadata': grpc_metadata_dict
        }
        
        issues = []
        
        legacy_keys = set(legacy_metadata_dict.keys()) - self.ignore_metadata
        grpc_keys = set(grpc_metadata_dict.keys()) - self.ignore_metadata
        
        missing_in_grpc = legacy_keys - grpc_keys
        extra_in_grpc = grpc_keys - legacy_keys
        common_keys = legacy_keys & grpc_keys
        
        for key in missing_in_grpc:
            issues.append(
                self.create_issue(
                    'metadata_missing',
                    f'元数据缺失: gRPC 缺少 {key}',
                    'warning',
                    legacy_value=legacy_metadata_dict[key],
                    grpc_value=None,
                    suggestion=f'检查 gRPC 是否应该传递元数据 {key}',
                    field_path=f'metadata.{key}'
                )
            )
        
        for key in extra_in_grpc:
            if key.lower() not in [k.lower() for k in self.STANDARD_GRPC_METADATA]:
                issues.append(
                    self.create_issue(
                        'metadata_extra',
                        f'额外元数据: gRPC 有 {key} (老 RPC 没有)',
                        'info',
                        legacy_value=None,
                        grpc_value=grpc_metadata_dict[key],
                        suggestion=f'确认元数据 {key} 是否为 gRPC 特有或是否应该添加到老 RPC',
                        field_path=f'metadata.{key}'
                    )
                )
        
        for key in common_keys:
            legacy_value = legacy_metadata_dict[key]
            grpc_value = grpc_metadata_dict[key]
            
            if legacy_value != grpc_value:
                issues.append(
                    self.create_issue(
                        'metadata_value_mismatch',
                        f'元数据值不匹配: {key}',
                        'warning',
                        legacy_value=legacy_value,
                        grpc_value=grpc_value,
                        suggestion=f'确认元数据 {key} 的值差异是否为预期',
                        field_path=f'metadata.{key}'
                    )
                )
        
        for required_key in self.required_metadata:
            if required_key not in legacy_keys and required_key not in grpc_keys:
                issues.append(
                    self.create_issue(
                        'required_metadata_missing',
                        f'必需元数据缺失: {required_key} (老 RPC 和 gRPC 都没有)',
                        'critical',
                        suggestion=f'确保传递必需的元数据 {required_key}',
                        field_path=f'metadata.{required_key}'
                    )
                )
            elif required_key not in grpc_keys:
                issues.append(
                    self.create_issue(
                        'required_metadata_missing_grpc',
                        f'必需元数据缺失: gRPC 没有 {required_key}',
                        'critical',
                        legacy_value=legacy_metadata_dict.get(required_key),
                        grpc_value=None,
                        suggestion=f'确保 gRPC 传递必需的元数据 {required_key}',
                        field_path=f'metadata.{required_key}'
                    )
                )
        
        idempotent_key_legacy = legacy_data.get('idempotent_key', '')
        idempotent_key_grpc = grpc_data.get('idempotent_key', '')
        
        if idempotent_key_legacy and not idempotent_key_grpc:
            issues.append(
                self.create_issue(
                    'idempotent_key_missing',
                    f'幂等键缺失: 老 RPC 定义了 {idempotent_key_grpc if idempotent_key_grpc else idempotent_key_legacy}，但 gRPC 没有',
                    'critical',
                    legacy_value=idempotent_key_legacy,
                    grpc_value=idempotent_key_grpc,
                    suggestion='确保 gRPC 实现了正确的幂等键处理',
                    field_path='idempotent_key'
                )
            )
        elif idempotent_key_legacy and idempotent_key_grpc:
            if idempotent_key_legacy != idempotent_key_grpc:
                issues.append(
                    self.create_issue(
                        'idempotent_key_mismatch',
                        f'幂等键不匹配: 老 RPC {idempotent_key_legacy}, gRPC {idempotent_key_grpc}',
                        'warning',
                        legacy_value=idempotent_key_legacy,
                        grpc_value=idempotent_key_grpc,
                        suggestion='确认幂等键定义是否一致',
                        field_path='idempotent_key'
                    )
                )
        
        result.issues = issues
        result.is_match = len(issues) == 0
        
        return result
    
    def _normalize_metadata(self, metadata: Any) -> Dict[str, Any]:
        """标准化元数据格式"""
        result = {}
        
        if isinstance(metadata, dict):
            return {k.lower(): v for k, v in metadata.items()}
        
        if isinstance(metadata, list):
            for item in metadata:
                if isinstance(item, dict):
                    key = item.get('key', item.get('name', '')).lower()
                    value = item.get('value', '')
                    if key:
                        result[key] = value
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    key = str(item[0]).lower()
                    value = item[1]
                    result[key] = value
        
        return result
