import re
import logging
from datetime import datetime
from typing import Any, Dict, List, Union
from app.config import settings


def mask_sensitive_data(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: mask_value(v) if any(f.lower() in k.lower() for f in settings.SENSITIVE_FIELDS) else mask_sensitive_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    return data


def mask_value(value: str) -> str:
    if not value or not isinstance(value, str):
        return value
    if len(value) <= 4:
        return settings.MASK_CHAR * len(value)
    if re.match(r'^1[3-9]\d{9}$', value):
        return value[:3] + settings.MASK_CHAR * 4 + value[-4:]
    if re.match(r'^\d{17}[\dXx]$', value):
        return value[:6] + settings.MASK_CHAR * 8 + value[-4:]
    return value[:2] + settings.MASK_CHAR * (len(value) - 4) + value[-2:]


class AuditLogger:
    def __init__(self):
        self.logger = logging.getLogger("audit")
        self.logger.setLevel(logging.INFO)
        handler = logging.FileHandler("audit.log")
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
    
    def log_action(self, user_id: str, action: str, entity_type: str, entity_id: str, details: Dict = None):
        log_msg = f"User: {mask_sensitive_data(user_id)} | Action: {action} | Entity: {entity_type} | ID: {entity_id}"
        if details:
            log_msg += f" | Details: {mask_sensitive_data(details)}"
        self.logger.info(log_msg)


audit_logger = AuditLogger()


def generate_batch_no(prefix: str = "B") -> str:
    now = datetime.now()
    return f"{prefix}{now.strftime('%Y%m%d%H%M%S')}"


def validate_batch_no(batch_no: str) -> bool:
    return bool(re.match(r'^[A-Z]\d{14}$', batch_no))
