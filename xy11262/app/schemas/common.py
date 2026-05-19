from datetime import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, field_validator, model_validator

from app.core.config import settings


def mask_sensitive_value(value: str, field_name: str) -> str:
    if not value or len(value) <= 4:
        return value
    
    if field_name in settings.SENSITIVE_FIELDS:
        keep_start = settings.SENSITIVE_MASK_KEEP_START
        keep_end = settings.SENSITIVE_MASK_KEEP_END
        
        if len(value) <= keep_start + keep_end:
            keep_start = 1
            keep_end = 1
        
        masked = (
            value[:keep_start] +
            settings.SENSITIVE_MASK_CHAR * (len(value) - keep_start - keep_end) +
            value[-keep_end:]
        )
        return masked
    return value


class SensitiveBaseModel(BaseModel):
    def model_dump_sanitized(self) -> Dict[str, Any]:
        data = self.model_dump()
        return self._sanitize_dict(data)
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in data.items():
            if isinstance(value, dict):
                result[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self._sanitize_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            elif isinstance(value, str):
                result[key] = mask_sensitive_value(value, key)
            else:
                result[key] = value
        return result


class Pagination(BaseModel):
    page: int = 1
    page_size: int = 20
    total: int = 0


class ApiResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Optional[Any] = None
    pagination: Optional[Pagination] = None


class ValidationErrorDetail(BaseModel):
    field: str
    message: str
    suggested_value: Optional[str] = None


class BadRecordCreate(BaseModel):
    row_number: Optional[int] = None
    original_data: Dict[str, Any]
    error_type: str
    error_message: str
    suggested_fix: Optional[str] = None
    field_errors: Optional[List[ValidationErrorDetail]] = None


class ValidationResult(BaseModel):
    is_valid: bool
    cleaned_data: Optional[Dict[str, Any]] = None
    errors: List[ValidationErrorDetail] = []
