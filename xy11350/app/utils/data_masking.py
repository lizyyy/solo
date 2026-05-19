import json
from typing import Any, Dict, List
from app.config.settings import get_settings

settings = get_settings()


def mask_sensitive_data(data: Any, role: str = "operator") -> Any:
    if role == "admin":
        return data
    
    if isinstance(data, dict):
        return {
            key: mask_sensitive_data(value, role) 
            if key not in settings.SENSITIVE_FIELDS 
            else mask_value(value)
            for key, value in data.items()
        }
    
    if isinstance(data, list):
        return [mask_sensitive_data(item, role) for item in data]
    
    return data


def mask_value(value: Any) -> str:
    if value is None:
        return ""
    
    str_value = str(value)
    if len(str_value) <= 4:
        return settings.MASK_CHAR * len(str_value)
    
    if "@" in str_value:
        parts = str_value.split("@")
        username = parts[0]
        domain = parts[1]
        masked_username = username[:2] + settings.MASK_CHAR * max(0, len(username) - 2)
        return f"{masked_username}@{domain}"
    
    return str_value[:2] + settings.MASK_CHAR * (len(str_value) - 4) + str_value[-2:]


def mask_log_message(message: str) -> str:
    for field in settings.SENSITIVE_FIELDS:
        if field in message.lower():
            words = message.split()
            masked_words = []
            for word in words:
                if any(sensitive in word.lower() for sensitive in settings.SENSITIVE_FIELDS):
                    masked_words.append("[MASKED]")
                else:
                    masked_words.append(word)
            return " ".join(masked_words)
    return message


def mask_export_data(data: List[Dict], role: str) -> List[Dict]:
    return [mask_sensitive_data(row, role) for row in data]
