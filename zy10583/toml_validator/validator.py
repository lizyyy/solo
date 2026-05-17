from typing import Any, Dict, List, Optional
import json
from .models import ConfigSchema, FieldSchema, ValidationError, ValidationResult, ErrorType
from .parser import TomlParser


class TomlValidator:
    def __init__(self, schema: ConfigSchema):
        self.schema = schema
        self.parser = TomlParser()

    @classmethod
    def from_schema_file(cls, schema_path: str) -> "TomlValidator":
        with open(schema_path, "r", encoding="utf-8") as f:
            schema_data = json.load(f)
        schema = ConfigSchema(**schema_data)
        return cls(schema)

    @classmethod
    def from_schema_dict(cls, schema_dict: Dict[str, Any]) -> "TomlValidator":
        schema = ConfigSchema(**schema_dict)
        return cls(schema)

    def validate(self, toml_path: str, apply_defaults: bool = True) -> ValidationResult:
        with open(toml_path, "r", encoding="utf-8") as f:
            content = f.read()

        data, parse_error = self.parser.parse(content)

        if parse_error:
            return ValidationResult(
                is_valid=False,
                errors=[ValidationError(
                    error_type=ErrorType.PARSE_ERROR,
                    field_path="",
                    message=f"解析失败: {parse_error}",
                    line=None,
                    column=None
                )],
                file_path=toml_path,
                schema_path=None
            )

        errors: List[ValidationError] = []
        defaults_applied: Dict[str, Any] = {}

        for field_schema in self.schema.fields:
            field_errors = self._validate_field(data, field_schema)
            errors.extend(field_errors)

            if apply_defaults and field_schema.default is not None:
                value = self.parser.get_nested_value(data, field_schema.path)
                if value is None:
                    defaults_applied[field_schema.path] = field_schema.default

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            defaults_applied=defaults_applied,
            file_path=toml_path
        )

    def _validate_field(self, data: Dict[str, Any], field_schema: FieldSchema) -> List[ValidationError]:
        errors: List[ValidationError] = []
        value = self.parser.get_nested_value(data, field_schema.path)
        line, column = self.parser.get_location(field_schema.path)

        if value is None:
            if field_schema.required:
                errors.append(ValidationError(
                    error_type=ErrorType.MISSING_FIELD,
                    field_path=field_schema.path,
                    message=f"缺少必填字段: {field_schema.path}",
                    line=line,
                    column=column
                ))
            return errors

        type_error = self._check_type(value, field_schema.type)
        if type_error:
            errors.append(ValidationError(
                error_type=ErrorType.INVALID_TYPE,
                field_path=field_schema.path,
                message=type_error,
                line=line,
                column=column,
                value=value
            ))
            return errors

        if field_schema.enum and value not in field_schema.enum:
            errors.append(ValidationError(
                error_type=ErrorType.INVALID_ENUM,
                field_path=field_schema.path,
                message=f"值 '{value}' 不在允许的枚举值中: {field_schema.enum}",
                line=line,
                column=column,
                value=value
            ))

        if field_schema.min_value is not None and value < field_schema.min_value:
            errors.append(ValidationError(
                error_type=ErrorType.OUT_OF_RANGE,
                field_path=field_schema.path,
                message=f"值 {value} 小于最小值 {field_schema.min_value}",
                line=line,
                column=column,
                value=value
            ))

        if field_schema.max_value is not None and value > field_schema.max_value:
            errors.append(ValidationError(
                error_type=ErrorType.OUT_OF_RANGE,
                field_path=field_schema.path,
                message=f"值 {value} 大于最大值 {field_schema.max_value}",
                line=line,
                column=column,
                value=value
            ))

        return errors

    def _check_type(self, value: Any, expected_type: str) -> Optional[str]:
        type_mapping = {
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
            "array": list,
            "object": dict
        }

        expected_python_type = type_mapping.get(expected_type)
        if expected_python_type is None:
            return f"未知的类型: {expected_type}"

        if not isinstance(value, expected_python_type):
            return f"类型不匹配: 期望 {expected_type}, 实际 {type(value).__name__}"

        return None
