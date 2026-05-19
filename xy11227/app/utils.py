import hashlib
import json
import re
from datetime import datetime
from typing import Any, Dict, List
from app.config import get_settings

settings = get_settings()


def mask_sensitive_data(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: mask_sensitive_data(v) if k.lower() not in [f.lower() for f in settings.SENSITIVE_FIELDS] else settings.MASKING_PATTERN for k, v in data.items()}
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        for field in settings.SENSITIVE_FIELDS:
            if re.search(rf'\b{field}\b', data, re.IGNORECASE):
                return re.sub(r'\d{4,}', settings.MASKING_PATTERN, data)
    return data


def generate_request_key(endpoint: str, payload: Dict) -> str:
    payload_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    key_content = f"{endpoint}:{payload_str}"
    return hashlib.md5(key_content.encode('utf-8')).hexdigest()


def generate_response_hash(response: Dict) -> str:
    response_str = json.dumps(response, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(response_str.encode('utf-8')).hexdigest()


def generate_order_no() -> str:
    now = datetime.now()
    return f"WO{now.strftime('%Y%m%d%H%M%S')}{now.microsecond // 1000:03d}"


def is_abnormal_event(event_type: str, error_code: str = None) -> bool:
    abnormal_types = ['scan_fail', 'door_open_fail', 'door_close_fail']
    if event_type in abnormal_types:
        return True
    if error_code and error_code.startswith('ERR'):
        return True
    return False


def classify_issue_type(event_type: str, error_message: str = None) -> str:
    event_lower = event_type.lower() if event_type else ''
    error_lower = error_message.lower() if error_message else ''
    
    if 'door' in event_lower or '门' in error_lower:
        return 'door_failure'
    if 'scan' in event_lower or '扫码' in error_lower:
        return 'scan_failure'
    if 'empty' in event_lower or '空仓' in error_lower or '误报' in error_lower:
        return 'false_empty'
    return 'other'