from typing import Dict, Any, List, Set
from .base_comparator import BaseComparator, ComparisonResult, ComparisonIssue


class FieldComparator(BaseComparator):
    """字段对比器"""
    
    COMPARISON_TYPE = 'field'
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.ignore_fields = set(self.config.get('ignore_fields', ['_method', '_timestamp', '_success', '_service']))
        self.type_mapping = self.config.get('type_mapping', {
            'int64': 'int',
            'int32': 'int',
            'string': 'str',
            'bool': 'bool',
            'double': 'float',
            'float': 'float',
        })
    
    def compare(self, legacy_data: Any, grpc_data: Any) -> ComparisonResult:
        """对比两个数据结构的字段"""
        result = ComparisonResult(
            legacy_data=legacy_data,
            grpc_data=grpc_data
        )
        
        if isinstance(legacy_data, dict) and isinstance(grpc_data, dict):
            result.issues = self._compare_dicts(legacy_data, grpc_data, '')
        elif isinstance(legacy_data, list) and isinstance(grpc_data, list):
            result.issues = self._compare_lists(legacy_data, grpc_data, '')
        else:
            result.issues = [
                self.create_issue(
                    'type_mismatch',
                    f'类型不匹配: 老 RPC 返回 {type(legacy_data).__name__}, gRPC 返回 {type(grpc_data).__name__}',
                    'critical',
                    legacy_data,
                    grpc_data,
                    '检查两个接口的响应结构是否一致'
                )
            ]
        
        result.is_match = len(result.issues) == 0
        result.details['total_issues'] = len(result.issues)
        result.details['critical_issues'] = len([i for i in result.issues if i.severity == 'critical'])
        result.details['warning_issues'] = len([i for i in result.issues if i.severity == 'warning'])
        
        return result
    
    def _compare_dicts(self, legacy_dict: Dict, grpc_dict: Dict, path: str) -> List[ComparisonIssue]:
        """对比两个字典"""
        issues = []
        
        legacy_keys = set(legacy_dict.keys()) - self.ignore_fields
        grpc_keys = set(grpc_dict.keys()) - self.ignore_fields
        
        missing_in_grpc = legacy_keys - grpc_keys
        extra_in_grpc = grpc_keys - legacy_keys
        common_keys = legacy_keys & grpc_keys
        
        for key in missing_in_grpc:
            full_path = f'{path}.{key}' if path else key
            issues.append(
                self.create_issue(
                    'missing_field',
                    f'字段缺失: gRPC 响应中缺少字段 {full_path}',
                    'critical',
                    legacy_value=legacy_dict[key],
                    grpc_value=None,
                    suggestion='检查 proto 定义是否包含此字段，或是否需要添加此字段',
                    field_path=full_path
                )
            )
        
        for key in extra_in_grpc:
            full_path = f'{path}.{key}' if path else key
            issues.append(
                self.create_issue(
                    'extra_field',
                    f'额外字段: gRPC 响应中多出字段 {full_path}',
                    'warning',
                    legacy_value=None,
                    grpc_value=grpc_dict[key],
                    suggestion='确认此字段是否在老 RPC 中应该存在，或是否为新增字段',
                    field_path=full_path
                )
            )
        
        for key in common_keys:
            full_path = f'{path}.{key}' if path else key
            legacy_value = legacy_dict[key]
            grpc_value = grpc_dict[key]
            
            if isinstance(legacy_value, dict) and isinstance(grpc_value, dict):
                issues.extend(self._compare_dicts(legacy_value, grpc_value, full_path))
            elif isinstance(legacy_value, list) and isinstance(grpc_value, list):
                issues.extend(self._compare_lists(legacy_value, grpc_value, full_path))
            else:
                issues.extend(self._compare_values(legacy_value, grpc_value, full_path))
        
        return issues
    
    def _compare_lists(self, legacy_list: List, grpc_list: List, path: str) -> List[ComparisonIssue]:
        """对比两个列表"""
        issues = []
        
        if len(legacy_list) != len(grpc_list):
            issues.append(
                self.create_issue(
                    'list_length_mismatch',
                    f'列表长度不匹配: {path} - 老 RPC 有 {len(legacy_list)} 项, gRPC 有 {len(grpc_list)} 项',
                    'warning',
                    legacy_value=len(legacy_list),
                    grpc_value=len(grpc_list),
                    suggestion='检查列表长度是否符合预期，或是否为分页/过滤差异',
                    field_path=path
                )
            )
        
        min_length = min(len(legacy_list), len(grpc_list))
        for i in range(min_length):
            item_path = f'{path}[{i}]'
            legacy_item = legacy_list[i]
            grpc_item = grpc_list[i]
            
            if isinstance(legacy_item, dict) and isinstance(grpc_item, dict):
                issues.extend(self._compare_dicts(legacy_item, grpc_item, item_path))
            elif isinstance(legacy_item, list) and isinstance(grpc_item, list):
                issues.extend(self._compare_lists(legacy_item, grpc_item, item_path))
            else:
                issues.extend(self._compare_values(legacy_item, grpc_item, item_path))
        
        return issues
    
    def _compare_values(self, legacy_value: Any, grpc_value: Any, path: str) -> List[ComparisonIssue]:
        """对比两个值"""
        issues = []
        
        legacy_type = type(legacy_value).__name__
        grpc_type = type(grpc_value).__name__
        
        normalized_legacy_type = self.type_mapping.get(legacy_type, legacy_type)
        normalized_grpc_type = self.type_mapping.get(grpc_type, grpc_type)
        
        if normalized_legacy_type != normalized_grpc_type:
            issues.append(
                self.create_issue(
                    'type_mismatch',
                    f'类型不匹配: {path} - 老 RPC 类型 {legacy_type}, gRPC 类型 {grpc_type}',
                    'warning',
                    legacy_value=legacy_value,
                    grpc_value=grpc_value,
                    suggestion='检查类型映射是否正确，或是否需要转换类型',
                    field_path=path
                )
            )
        
        if legacy_value != grpc_value:
            issues.append(
                self.create_issue(
                    'value_mismatch',
                    f'值不匹配: {path}',
                    'warning',
                    legacy_value=legacy_value,
                    grpc_value=grpc_value,
                    suggestion='确认值差异是否为预期，或是否存在业务逻辑差异',
                    field_path=path
                )
            )
        
        return issues
