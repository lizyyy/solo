import re
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from pydantic import ValidationError

from app.models.hazard import HazardLevel
from app.schemas.hazard import HazardCreate
from app.schemas.common import ValidationResult, ValidationErrorDetail


class ValidationService:
    @staticmethod
    def validate_phone(phone: str, field_name: str = "phone") -> Tuple[bool, Optional[str], Optional[str]]:
        if not phone or not phone.strip():
            return True, None, None
        
        cleaned = phone.strip()
        digits_only = re.sub(r'[\s\-]', '', cleaned)
        
        if not digits_only.isdigit():
            return False, f"{field_name}只能包含数字、横线和空格", f"建议使用纯数字格式，如138******00"
        
        if len(digits_only) < 7 or len(digits_only) > 20:
            return False, f"{field_name}长度应在7-20位之间", f"当前{len(digits_only)}位，请检查"
        
        return True, None, None

    @staticmethod
    def validate_date(date_str: str, field_name: str = "date") -> Tuple[bool, Optional[str], Optional[datetime]]:
        if not date_str or not date_str.strip():
            return True, None, None
        
        date_str = date_str.strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%m-%d-%Y",
        ]
        
        for fmt in formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return True, None, parsed
            except ValueError:
                continue
        
        return False, f"{field_name}格式不正确", None

    @staticmethod
    def validate_hazard_level(level: str) -> Tuple[bool, Optional[str], Optional[HazardLevel]]:
        if not level:
            return True, None, HazardLevel.MEDIUM
        
        level = level.strip().lower()
        level_map = {
            "低": HazardLevel.LOW,
            "low": HazardLevel.LOW,
            "中": HazardLevel.MEDIUM,
            "medium": HazardLevel.MEDIUM,
            "高": HazardLevel.HIGH,
            "high": HazardLevel.HIGH,
            "严重": HazardLevel.CRITICAL,
            "critical": HazardLevel.CRITICAL,
        }
        
        if level in level_map:
            return True, None, level_map[level]
        
        valid_options = ", ".join(level_map.keys())
        return False, f"隐患等级必须是以下值之一: {valid_options}", None

    @staticmethod
    def suggest_hazard_code(row_data: Dict[str, Any], row_num: int) -> str:
        dept = row_data.get('department', 'DEPT') or 'DEPT'
        date_str = row_data.get('discovered_at') or ''
        
        if date_str:
            try:
                if isinstance(date_str, str):
                    date_part = datetime.strptime(date_str[:10], "%Y-%m-%d").strftime("%Y%m%d")
                elif isinstance(date_str, datetime):
                    date_part = date_str.strftime("%Y%m%d")
                else:
                    date_part = datetime.now().strftime("%Y%m%d")
            except:
                date_part = datetime.now().strftime("%Y%m%d")
        else:
            date_part = datetime.now().strftime("%Y%m%d")
        
        return f"{dept[:4].upper()}{date_part}{row_num:03d}"

    @staticmethod
    def validate_hazard_row(row_data: Dict[str, Any], row_num: int) -> ValidationResult:
        errors: List[ValidationErrorDetail] = []
        cleaned_data = row_data.copy()
        
        hazard_code = row_data.get('hazard_code', '').strip()
        if not hazard_code:
            suggested = ValidationService.suggest_hazard_code(row_data, row_num)
            errors.append(ValidationErrorDetail(
                field="hazard_code",
                message="隐患编号不能为空",
                suggested_value=suggested
            ))
            cleaned_data['hazard_code'] = suggested
        else:
            cleaned_data['hazard_code'] = hazard_code
        
        title = row_data.get('title', '').strip()
        if not title:
            errors.append(ValidationErrorDetail(
                field="title",
                message="隐患标题不能为空",
                suggested_value=f"未命名隐患-{row_num}"
            ))
            cleaned_data['title'] = f"未命名隐患-{row_num}"
        else:
            cleaned_data['title'] = title
        
        level = row_data.get('level')
        if level:
            is_valid, err_msg, parsed_level = ValidationService.validate_hazard_level(level)
            if not is_valid:
                errors.append(ValidationErrorDetail(
                    field="level",
                    message=err_msg or "",
                    suggested_value="medium"
                ))
                cleaned_data['level'] = HazardLevel.MEDIUM
            else:
                cleaned_data['level'] = parsed_level
        
        phone = row_data.get('responsible_phone')
        if phone:
            is_valid, err_msg, _ = ValidationService.validate_phone(phone, "责任人电话")
            if not is_valid:
                errors.append(ValidationErrorDetail(
                    field="responsible_phone",
                    message=err_msg or "",
                    suggested_value=re.sub(r'[^\d\-\s]', '', phone)
                ))
        
        discovered_at = row_data.get('discovered_at')
        if discovered_at and isinstance(discovered_at, str):
            is_valid, err_msg, parsed = ValidationService.validate_date(discovered_at, "发现时间")
            if not is_valid:
                errors.append(ValidationErrorDetail(
                    field="discovered_at",
                    message=err_msg or "",
                    suggested_value=datetime.now().strftime("%Y-%m-%d")
                ))
            else:
                cleaned_data['discovered_at'] = parsed
        
        deadline = row_data.get('deadline')
        if deadline and isinstance(deadline, str):
            is_valid, err_msg, parsed = ValidationService.validate_date(deadline, "整改期限")
            if not is_valid:
                errors.append(ValidationErrorDetail(
                    field="deadline",
                    message=err_msg or "",
                    suggested_value=""
                ))
            else:
                cleaned_data['deadline'] = parsed
        
        try:
            hazard_schema = HazardCreate(**cleaned_data)
            cleaned_data = hazard_schema.model_dump()
        except ValidationError as e:
            for error in e.errors():
                field_name = str(error.get('loc', ('',))[0])
                msg = error.get('msg', '')
                errors.append(ValidationErrorDetail(
                    field=field_name,
                    message=msg
                ))
        
        is_valid = len(errors) == 0
        return ValidationResult(
            is_valid=is_valid,
            cleaned_data=cleaned_data if cleaned_data else None,
            errors=errors
        )

    @staticmethod
    def generate_suggested_fix(errors: List[ValidationErrorDetail]) -> str:
        if not errors:
            return ""
        
        suggestions = []
        for error in errors:
            if error.suggested_value:
                suggestions.append(f"{error.field}: 建议值 '{error.suggested_value}'")
            else:
                suggestions.append(f"{error.field}: {error.message}")
        
        return "; ".join(suggestions)

    @staticmethod
    def get_error_type(errors: List[ValidationErrorDetail]) -> str:
        if not errors:
            return "unknown"
        
        error_fields = [e.field for e in errors]
        
        if 'hazard_code' in error_fields or 'title' in error_fields:
            return "required_field_missing"
        elif 'responsible_phone' in error_fields:
            return "format_error"
        elif 'discovered_at' in error_fields or 'deadline' in error_fields:
            return "date_format_error"
        elif 'level' in error_fields:
            return "invalid_enum_value"
        else:
            return "validation_error"


validation_service = ValidationService()
