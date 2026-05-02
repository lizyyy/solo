import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    severity: Severity
    message: str
    source_file: Optional[str] = None
    row_num: Optional[int] = None
    table_name: Optional[str] = None
    field_name: Optional[str] = None
    value: Any = None
    rule: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity.value,
            "message": self.message,
            "source_file": self.source_file,
            "row_num": self.row_num,
            "table_name": self.table_name,
            "field_name": self.field_name,
            "value": str(self.value) if self.value is not None else None,
            "rule": self.rule,
        }


@dataclass
class ValidationResult:
    table_name: str
    rows: List[Dict[str, Any]] = field(default_factory=list)
    issues: List[ValidationIssue] = field(default_factory=list)
    
    def has_errors(self) -> bool:
        return any(i.severity == Severity.ERROR for i in self.issues)
    
    def has_warnings(self) -> bool:
        return any(i.severity == Severity.WARNING for i in self.issues)
    
    def get_errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.ERROR]
    
    def get_warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == Severity.WARNING]


class BaseValidator(ABC):
    def __init__(self, name: str):
        self.name = name
    
    @abstractmethod
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        pass


class RequiredFieldValidator(BaseValidator):
    def __init__(self):
        super().__init__("required_field")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        required_columns = schema_config.get_required_columns(table_name)
        
        for row in rows:
            for col in required_columns:
                value = row.get(col)
                if value is None or value == "":
                    issues.append(ValidationIssue(
                        severity=Severity.ERROR,
                        message=f"必填字段 '{col}' 缺失或为空",
                        source_file=row.get("_source_file"),
                        row_num=row.get("_row_num"),
                        table_name=table_name,
                        field_name=col,
                        rule=self.name,
                    ))
        
        return issues


class TypeValidator(BaseValidator):
    def __init__(self):
        super().__init__("type_check")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        columns = schema_config.get_columns(table_name)
        
        for row in rows:
            for col_name, col_config in columns.items():
                value = row.get(col_name)
                if value is None:
                    continue
                
                expected_type = col_config.get("type", "string").lower()
                
                if expected_type == "integer":
                    if not self._is_integer(value):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 期望类型为整数，但值为 '{value}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
                
                elif expected_type == "float" or expected_type == "decimal":
                    if not self._is_float(value):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 期望类型为数值，但值为 '{value}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
                
                elif expected_type == "boolean":
                    if not self._is_boolean(value):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 期望类型为布尔值，但值为 '{value}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
                
                elif expected_type == "date":
                    if not self._is_date(value):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 期望类型为日期，但值为 '{value}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
                
                elif expected_type == "datetime":
                    if not self._is_datetime(value):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 期望类型为日期时间，但值为 '{value}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
        
        return issues
    
    def _is_integer(self, value: Any) -> bool:
        try:
            int(value)
            return True
        except (ValueError, TypeError):
            return False
    
    def _is_float(self, value: Any) -> bool:
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False
    
    def _is_boolean(self, value: Any) -> bool:
        if isinstance(value, bool):
            return True
        lower_val = str(value).lower().strip()
        return lower_val in ("true", "false", "yes", "no", "1", "0", "on", "off")
    
    def _is_date(self, value: Any) -> bool:
        from dateutil import parser as date_parser
        try:
            date_parser.parse(str(value).strip(), fuzzy=True)
            return True
        except (ValueError, TypeError):
            return False
    
    def _is_datetime(self, value: Any) -> bool:
        return self._is_date(value)


class LengthValidator(BaseValidator):
    def __init__(self):
        super().__init__("length_check")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        columns = schema_config.get_columns(table_name)
        
        for row in rows:
            for col_name, col_config in columns.items():
                value = row.get(col_name)
                if value is None:
                    continue
                
                max_length = col_config.get("max_length")
                if max_length and len(str(value)) > max_length:
                    issues.append(ValidationIssue(
                        severity=Severity.ERROR,
                        message=f"字段 '{col_name}' 超过最大长度 {max_length}（实际长度 {len(str(value))}）",
                        source_file=row.get("_source_file"),
                        row_num=row.get("_row_num"),
                        table_name=table_name,
                        field_name=col_name,
                        value=str(value)[:50],
                        rule=self.name,
                    ))
        
        return issues


class EnumValidator(BaseValidator):
    def __init__(self):
        super().__init__("enum_check")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        columns = schema_config.get_columns(table_name)
        
        for row in rows:
            for col_name, col_config in columns.items():
                value = row.get(col_name)
                if value is None:
                    continue
                
                enum_values = col_config.get("enum")
                if enum_values:
                    if str(value).strip() not in enum_values:
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"字段 '{col_name}' 的值 '{value}' 不在允许的枚举值列表中: {enum_values}",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
        
        return issues


class EmailValidator(BaseValidator):
    EMAIL_PATTERN = re.compile(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    )
    
    def __init__(self):
        super().__init__("email_format")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        columns = schema_config.get_columns(table_name)
        
        for row in rows:
            for col_name, col_config in columns.items():
                value = row.get(col_name)
                if value is None:
                    continue
                
                format_type = col_config.get("format")
                if format_type == "email" or "email" in col_name.lower():
                    email_val = str(value).strip()
                    if not self.EMAIL_PATTERN.match(email_val):
                        issues.append(ValidationIssue(
                            severity=Severity.WARNING,
                            message=f"字段 '{col_name}' 的邮箱格式可能无效: '{email_val}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
        
        return issues


class PhoneValidator(BaseValidator):
    PHONE_PATTERN = re.compile(r"^[+\d\-\s()]{7,20}$")
    
    def __init__(self):
        super().__init__("phone_format")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        columns = schema_config.get_columns(table_name)
        
        for row in rows:
            for col_name, col_config in columns.items():
                value = row.get(col_name)
                if value is None:
                    continue
                
                format_type = col_config.get("format")
                if format_type == "phone" or "phone" in col_name.lower():
                    phone_val = str(value).strip()
                    if not self.PHONE_PATTERN.match(phone_val):
                        issues.append(ValidationIssue(
                            severity=Severity.WARNING,
                            message=f"字段 '{col_name}' 的手机号格式可能无效: '{phone_val}'",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=col_name,
                            value=value,
                            rule=self.name,
                        ))
        
        return issues


class ForeignKeyValidator(BaseValidator):
    def __init__(self):
        super().__init__("foreign_key")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        foreign_keys = schema_config.get_foreign_keys(table_name)
        
        for fk in foreign_keys:
            column = fk["column"]
            ref_table = fk["referenced_table"]
            ref_column = fk["referenced_column"]
            
            ref_rows = all_data.get(ref_table, [])
            ref_values: Set[Any] = set()
            for ref_row in ref_rows:
                ref_val = ref_row.get(ref_column)
                if ref_val is not None:
                    ref_values.add(str(ref_val).strip())
            
            for row in rows:
                value = row.get(column)
                if value is None:
                    continue
                
                val_str = str(value).strip()
                if val_str not in ref_values:
                    issues.append(ValidationIssue(
                        severity=Severity.ERROR,
                        message=f"外键引用不存在: '{table_name}.{column}' = '{val_str}' 引用 '{ref_table}.{ref_column}'",
                        source_file=row.get("_source_file"),
                        row_num=row.get("_row_num"),
                        table_name=table_name,
                        field_name=column,
                        value=value,
                        rule=self.name,
                    ))
        
        return issues


class DuplicateNaturalKeyValidator(BaseValidator):
    def __init__(self):
        super().__init__("duplicate_natural_key")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        natural_keys = mapping_config.get_natural_keys(table_name)
        
        if not natural_keys:
            return issues
        
        seen_keys: Dict[str, List[Tuple[int, str]]] = {}
        
        for row in rows:
            key_parts = []
            for key_field in natural_keys:
                val = row.get(key_field)
                key_parts.append(str(val).strip() if val is not None else "")
            composite_key = "|".join(key_parts)
            
            if composite_key in seen_keys:
                seen_keys[composite_key].append((
                    row.get("_row_num", 0),
                    row.get("_source_file", ""),
                ))
            else:
                seen_keys[composite_key] = [
                    (row.get("_row_num", 0), row.get("_source_file", ""))
                ]
        
        for key, locations in seen_keys.items():
            if len(locations) > 1:
                row_nums = [str(rn) for rn, _ in locations]
                for row_num, source_file in locations:
                    issues.append(ValidationIssue(
                        severity=Severity.ERROR,
                        message=f"自然键重复 '{natural_keys}': '{key}'，出现在行 {', '.join(row_nums)}",
                        source_file=source_file,
                        row_num=row_num,
                        table_name=table_name,
                        field_name=", ".join(natural_keys),
                        value=key,
                        rule=self.name,
                    ))
        
        return issues


class OrphanValidator(BaseValidator):
    def __init__(self):
        super().__init__("orphan_check")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        foreign_keys = schema_config.get_foreign_keys(table_name)
        
        for fk in foreign_keys:
            column = fk["column"]
            ref_table = fk["referenced_table"]
            ref_column = fk["referenced_column"]
            
            ref_rows = all_data.get(ref_table, [])
            ref_values: Set[Any] = set()
            for ref_row in ref_rows:
                ref_val = ref_row.get(ref_column)
                if ref_val is not None:
                    ref_values.add(str(ref_val).strip())
            
            for row in rows:
                value = row.get(column)
                if value is not None:
                    val_str = str(value).strip()
                    if val_str not in ref_values:
                        issues.append(ValidationIssue(
                            severity=Severity.WARNING,
                            message=f"检测到孤立记录: 无对应的 '{ref_table}' 记录",
                            source_file=row.get("_source_file"),
                            row_num=row.get("_row_num"),
                            table_name=table_name,
                            field_name=column,
                            value=value,
                            rule=self.name,
                        ))
        
        return issues


class MissingMappingValidator(BaseValidator):
    def __init__(self):
        super().__init__("missing_mapping")
    
    def validate(
        self,
        table_name: str,
        rows: List[Dict[str, Any]],
        schema_config: Any,
        mapping_config: Any,
        all_data: Dict[str, List[Dict[str, Any]]],
    ) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        
        columns = schema_config.get_columns(table_name)
        field_mappings = mapping_config.get_field_mappings(table_name)
        
        for col_name, col_config in columns.items():
            if col_name not in field_mappings:
                has_default = col_config.get("default") is not None
                is_auto_increment = col_config.get("auto_increment", False)
                
                if not has_default and not is_auto_increment:
                    if col_config.get("required", False):
                        issues.append(ValidationIssue(
                            severity=Severity.ERROR,
                            message=f"目标表 '{table_name}' 的必填字段 '{col_name}' 没有对应的映射配置",
                            table_name=table_name,
                            field_name=col_name,
                            rule=self.name,
                        ))
                    else:
                        issues.append(ValidationIssue(
                            severity=Severity.WARNING,
                            message=f"目标表 '{table_name}' 的字段 '{col_name}' 没有对应的映射配置（非必填，将使用 NULL）",
                            table_name=table_name,
                            field_name=col_name,
                            rule=self.name,
                        ))
        
        return issues


DEFAULT_VALIDATORS: List[BaseValidator] = [
    MissingMappingValidator(),
    RequiredFieldValidator(),
    TypeValidator(),
    LengthValidator(),
    EnumValidator(),
    EmailValidator(),
    PhoneValidator(),
    DuplicateNaturalKeyValidator(),
    ForeignKeyValidator(),
]
