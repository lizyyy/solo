import re
from typing import Any, Dict, List, Union
from app.config import settings


def mask_sensitive_value(value: str, field_name: str = None) -> str:
    if not value or not isinstance(value, str):
        return value
    
    if field_name and field_name.lower() in settings.sensitive_fields:
        if len(value) <= 4:
            return settings.mask_pattern
        return value[:2] + settings.mask_pattern + value[-2:]
    
    phone_pattern = r'1[3-9]\d{9}'
    if re.match(phone_pattern, value):
        return value[:3] + settings.mask_pattern + value[-4:]
    
    id_card_pattern = r'\d{17}[\dXx]'
    if re.match(id_card_pattern, value):
        return value[:4] + settings.mask_pattern + value[-4:]
    
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if re.match(email_pattern, value):
        parts = value.split('@')
        if len(parts[0]) > 2:
            return parts[0][:2] + settings.mask_pattern + '@' + parts[1]
        return settings.mask_pattern + '@' + parts[1]
    
    return value


def mask_sensitive_data(data: Union[Dict[str, Any], List[Any], Any]) -> Any:
    if isinstance(data, dict):
        return {
            k: mask_sensitive_value(v, k) if isinstance(v, str) else mask_sensitive_data(v)
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        return mask_sensitive_value(data)
    return data


def mask_log_message(message: str) -> str:
    phone_pattern = r'1[3-9]\d{9}'
    message = re.sub(phone_pattern, lambda m: m.group(0)[:3] + settings.mask_pattern + m.group(0)[-4:], message)
    
    id_card_pattern = r'\d{17}[\dXx]'
    message = re.sub(id_card_pattern, lambda m: m.group(0)[:4] + settings.mask_pattern + m.group(0)[-4:], message)
    
    return message
