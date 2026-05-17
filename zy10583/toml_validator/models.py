from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class ErrorType(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_TYPE = "invalid_type"
    INVALID_ENUM = "invalid_enum"
    OUT_OF_RANGE = "out_of_range"
    UNKNOWN_FIELD = "unknown_field"
    PARSE_ERROR = "parse_error"


class FieldSchema(BaseModel):
    path: str
    type: str = "string"
    required: bool = True
    default: Optional[Any] = None
    enum: Optional[List[Any]] = None
    min_value: Optional[Union[int, float]] = None
    max_value: Optional[Union[int, float]] = None
    description: Optional[str] = None


class ValidationError(BaseModel):
    error_type: ErrorType
    field_path: str
    message: str
    line: Optional[int] = None
    column: Optional[int] = None
    value: Optional[Any] = None


class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)
    defaults_applied: Dict[str, Any] = Field(default_factory=dict)
    file_path: str
    schema_path: Optional[str] = None


class ConfigSchema(BaseModel):
    name: str
    version: str = "1.0"
    fields: List[FieldSchema] = Field(default_factory=list)
