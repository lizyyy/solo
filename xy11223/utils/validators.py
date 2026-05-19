from datetime import datetime
from typing import Optional, List, Dict, Any
from .date_utils import parse_datetime


def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> tuple[bool, List[str]]:
    missing_fields = []
    for field in required_fields:
        if field not in data or data[field] is None or data[field] == "":
            missing_fields.append(field)
    return len(missing_fields) == 0, missing_fields


def validate_datetime(value: Any, field_name: str) -> tuple[bool, Optional[str]]:
    if value is None or value == "":
        return True, None
    parsed = parse_datetime(value)
    if parsed is None:
        return False, f"{field_name}: 无效的日期时间格式"
    return True, None


def validate_store_id(store_id: str) -> tuple[bool, Optional[str]]:
    if not store_id or len(store_id) < 2:
        return False, "门店ID格式不正确"
    return True, None


def validate_temperature(temp: Any) -> tuple[bool, Optional[str]]:
    if temp is None or temp == "":
        return False, "温度不能为空"
    try:
        temp_value = float(temp)
        if temp_value < -50 or temp_value > 100:
            return False, f"温度值 {temp_value} 超出合理范围 (-50 ~ 100)"
        return True, None
    except (ValueError, TypeError):
        return False, f"温度值 {temp} 不是有效的数字"


def validate_weight(weight: Any) -> tuple[bool, Optional[str]]:
    if weight is None or weight == "":
        return True, None
    try:
        weight_value = float(weight)
        if weight_value < 0:
            return False, "重量不能为负数"
        return True, None
    except (ValueError, TypeError):
        return False, f"重量值 {weight} 不是有效的数字"
