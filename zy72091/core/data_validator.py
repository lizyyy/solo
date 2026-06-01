from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict


@dataclass
class ValidationIssue:
    record_id: str
    issue_type: str
    severity: str
    message: str
    field_name: Optional[str] = None
    value: Optional[Any] = None


@dataclass
class ValidationResult:
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    duplicate_groups: Dict[str, List[str]] = field(default_factory=dict)
    null_records: List[str] = field(default_factory=list)
    boundary_records: List[str] = field(default_factory=list)
    
    def get_issues_by_severity(self, severity: str) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == severity]
    
    def get_issues_by_type(self, issue_type: str) -> List[ValidationIssue]:
        return [i for i in self.issues if i.issue_type == issue_type]


class DataValidator:
    """
    数据验证器 - 检测空值、重复项、边界值
    """
    
    REQUIRED_FIELDS = ['record_id', 'arrival_rate', 'service_rate', 'num_servers', 'source']
    
    def __init__(self):
        self.seen_ids = set()
        self.value_groups = defaultdict(list)
    
    def validate_dataset(self, records: List[Dict]) -> ValidationResult:
        """
        验证整个数据集
        """
        result = ValidationResult(is_valid=True)
        self.seen_ids.clear()
        self.value_groups.clear()
        
        for record in records:
            record_id = record.get('record_id', 'UNKNOWN')
            
            self._check_null_values(record, record_id, result)
            self._check_duplicate_ids(record, record_id, result)
            self._check_duplicate_records(record, record_id, result)
            self._check_boundary_values(record, record_id, result)
            self._check_data_types(record, record_id, result)
        
        result.is_valid = len(result.get_issues_by_severity('error')) == 0
        self._summarize_duplicates(result)
        
        return result
    
    def _check_null_values(self, record: Dict, record_id: str, result: ValidationResult):
        """检测空值"""
        for field in self.REQUIRED_FIELDS:
            value = record.get(field)
            if value is None or (isinstance(value, str) and value.strip() == ''):
                result.issues.append(ValidationIssue(
                    record_id=record_id,
                    issue_type='null_value',
                    severity='error',
                    message=f'必填字段 [{field}] 为空',
                    field_name=field,
                    value=None
                ))
                if record_id not in result.null_records:
                    result.null_records.append(record_id)
    
    def _check_duplicate_ids(self, record: Dict, record_id: str, result: ValidationResult):
        """检测重复ID"""
        if record_id in self.seen_ids:
            result.issues.append(ValidationIssue(
                record_id=record_id,
                issue_type='duplicate_id',
                severity='error',
                message=f'record_id [{record_id}] 重复出现',
                field_name='record_id',
                value=record_id
            ))
        else:
            self.seen_ids.add(record_id)
    
    def _check_duplicate_records(self, record: Dict, record_id: str, result: ValidationResult):
        """检测重复记录（相同参数值）"""
        key_fields = ['arrival_rate', 'service_rate', 'num_servers']
        key_values = []
        for f in key_fields:
            v = record.get(f)
            key_values.append(str(v))
        key = '|'.join(key_values)
        
        self.value_groups[key].append(record_id)
    
    def _check_boundary_values(self, record: Dict, record_id: str, result: ValidationResult):
        """检测边界值"""
        from .queue_model import MMcQueueModel
        limits = MMcQueueModel.BOUNDARY_LIMITS
        
        boundary_fields = [
            ('arrival_rate', limits['arrival_rate_min'], limits['arrival_rate_max']),
            ('service_rate', limits['service_rate_min'], limits['service_rate_max']),
            ('num_servers', limits['num_servers_min'], limits['num_servers_max'])
        ]
        
        for field_name, min_val, max_val in boundary_fields:
            value = record.get(field_name)
            if value is None:
                continue
            
            try:
                num_value = float(value)
                if abs(num_value - min_val) < 0.001 or abs(num_value - max_val) < 0.001:
                    result.issues.append(ValidationIssue(
                        record_id=record_id,
                        issue_type='boundary_value',
                        severity='warning',
                        message=f'字段 [{field_name}] 值为 {value}，接近边界 [{min_val}, {max_val}]',
                        field_name=field_name,
                        value=value
                    ))
                    if record_id not in result.boundary_records:
                        result.boundary_records.append(record_id)
            except (ValueError, TypeError):
                pass
    
    def _check_data_types(self, record: Dict, record_id: str, result: ValidationResult):
        """检测数据类型"""
        numeric_fields = ['arrival_rate', 'service_rate', 'num_servers']
        
        for field in numeric_fields:
            value = record.get(field)
            if value is None:
                continue
            
            try:
                if field == 'num_servers':
                    int_val = int(value)
                    if int_val <= 0:
                        result.issues.append(ValidationIssue(
                            record_id=record_id,
                            issue_type='invalid_value',
                            severity='error',
                            message=f'泊位数量必须为正整数，当前值: {value}',
                            field_name=field,
                            value=value
                        ))
                else:
                    float_val = float(value)
                    if float_val <= 0:
                        result.issues.append(ValidationIssue(
                            record_id=record_id,
                            issue_type='invalid_value',
                            severity='error',
                            message=f'{field} 必须为正数，当前值: {value}',
                            field_name=field,
                            value=value
                        ))
            except (ValueError, TypeError):
                result.issues.append(ValidationIssue(
                    record_id=record_id,
                    issue_type='invalid_type',
                    severity='error',
                    message=f'字段 [{field}] 类型错误，应为数字，当前值: {value}',
                    field_name=field,
                    value=value
                ))
    
    def _summarize_duplicates(self, result: ValidationResult):
        """汇总重复记录"""
        for key, record_ids in self.value_groups.items():
            if len(record_ids) > 1:
                group_id = f'group_{len(result.duplicate_groups) + 1}'
                result.duplicate_groups[group_id] = record_ids
                for rid in record_ids:
                    result.issues.append(ValidationIssue(
                        record_id=rid,
                        issue_type='duplicate_params',
                        severity='warning',
                        message=f'与其他记录参数重复: {", ".join(record_ids)}',
                        field_name='parameters',
                        value=key
                    ))
