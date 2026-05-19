import re
import hashlib
import json
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from functools import wraps


SENSITIVE_FIELDS = {
    "customer_phone": "phone",
    "customer_name": "name",
    "agent_name": "name",
    "phone": "phone",
    "name": "name",
    "email": "email",
    "id_card": "id_card",
    "address": "address",
    "raw_content": "partial",
    "original_text": "partial",
    "text": "partial",
}


def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 7:
        return "***"
    return phone[:3] + "****" + phone[-4:]


def mask_name(name: str) -> str:
    if not name or len(name) <= 1:
        return "*"
    return name[0] + "*" * (len(name) - 1)


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    username, domain = email.split("@", 1)
    if len(username) <= 2:
        masked_username = "*" * len(username)
    else:
        masked_username = username[0] + "*" * (len(username) - 2) + username[-1]
    return f"{masked_username}@{domain}"


def mask_id_card(id_card: str) -> str:
    if not id_card or len(id_card) < 10:
        return "***"
    return id_card[:6] + "********" + id_card[-4:]


def mask_address(address: str) -> str:
    if not address:
        return "***"
    if len(address) > 10:
        return address[:5] + "***" + address[-3:]
    return address[0] + "***" + address[-1] if len(address) > 3 else "***"


def mask_partial(text: str, keep_ratio: float = 0.3) -> str:
    if not text:
        return ""
    text_len = len(text)
    keep_chars = max(1, int(text_len * keep_ratio))
    keep_start = keep_chars // 2
    keep_end = keep_chars - keep_start
    return text[:keep_start] + "*" * (text_len - keep_chars) + text[-keep_end:]


MASK_FUNCTIONS = {
    "phone": mask_phone,
    "name": mask_name,
    "email": mask_email,
    "id_card": mask_id_card,
    "address": mask_address,
    "partial": mask_partial,
}


def mask_value(key: str, value: Any, field_types: Dict[str, str] = None) -> Any:
    field_types = field_types or SENSITIVE_FIELDS
    if key not in field_types:
        return value
    if value is None:
        return None
    mask_type = field_types[key]
    mask_func = MASK_FUNCTIONS.get(mask_type)
    if mask_func and isinstance(value, str):
        return mask_func(value)
    return value


def mask_dict(data: Dict[str, Any], field_types: Dict[str, str] = None) -> Dict[str, Any]:
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result[key] = mask_dict(value, field_types)
        elif isinstance(value, list):
            result[key] = mask_list(value, field_types)
        else:
            result[key] = mask_value(key, value, field_types)
    return result


def mask_list(data: List[Any], field_types: Dict[str, str] = None) -> List[Any]:
    result = []
    for item in data:
        if isinstance(item, dict):
            result.append(mask_dict(item, field_types))
        elif isinstance(item, list):
            result.append(mask_list(item, field_types))
        elif isinstance(item, str):
            result.append(mask_partial(item) if len(item) > 20 else item)
        else:
            result.append(item)
    return result


def mask_object(obj: Any, field_types: Dict[str, str] = None) -> Any:
    if hasattr(obj, 'dict'):
        data = obj.dict()
        masked = mask_dict(data, field_types)
        return masked
    elif isinstance(obj, dict):
        return mask_dict(obj, field_types)
    elif isinstance(obj, list):
        return mask_list(obj, field_types)
    elif isinstance(obj, str):
        return mask_partial(obj) if len(obj) > 50 else obj
    return obj


def generate_content_hash(content: Union[str, bytes, Dict]) -> str:
    if isinstance(content, dict):
        content = json.dumps(content, sort_keys=True, ensure_ascii=False)
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha256(content).hexdigest()


def mask_log_message(message: str) -> str:
    phone_pattern = r'1[3-9]\d{9}'
    message = re.sub(phone_pattern, lambda m: mask_phone(m.group()), message)
    
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    message = re.sub(email_pattern, lambda m: mask_email(m.group()), message)
    
    id_card_pattern = r'\d{17}[\dXx]'
    message = re.sub(id_card_pattern, lambda m: mask_id_card(m.group()), message)
    
    return message


class MaskedLogger:
    def __init__(self, original_logger):
        self._logger = original_logger
    
    def _mask_args(self, args, kwargs):
        masked_args = tuple(mask_log_message(str(arg)) for arg in args)
        masked_kwargs = {k: mask_log_message(str(v)) for k, v in kwargs.items()}
        return masked_args, masked_kwargs
    
    def debug(self, msg, *args, **kwargs):
        args, kwargs = self._mask_args(args, kwargs)
        self._logger.debug(msg, *args, **kwargs)
    
    def info(self, msg, *args, **kwargs):
        args, kwargs = self._mask_args(args, kwargs)
        self._logger.info(msg, *args, **kwargs)
    
    def warning(self, msg, *args, **kwargs):
        args, kwargs = self._mask_args(args, kwargs)
        self._logger.warning(msg, *args, **kwargs)
    
    def error(self, msg, *args, **kwargs):
        args, kwargs = self._mask_args(args, kwargs)
        self._logger.error(msg, *args, **kwargs)
    
    def critical(self, msg, *args, **kwargs):
        args, kwargs = self._mask_args(args, kwargs)
        self._logger.critical(msg, *args, **kwargs)


def mask_response(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        return mask_object(result)
    return wrapper
