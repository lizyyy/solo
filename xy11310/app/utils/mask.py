from app.core.config import settings


def mask_sensitive_field(field_name: str, value: str) -> str:
    if not value or len(value) <= 4:
        return value
    
    if field_name in ["phone", "emergency_phone"]:
        return value[:3] + settings.MASK_CHAR * 4 + value[-4:] if len(value) > 7 else value[:3] + settings.MASK_CHAR * (len(value) - 3)
    
    if field_name == "id_card":
        return value[:6] + settings.MASK_CHAR * 8 + value[-4:]
    
    if field_name in ["address", "emergency_contact"]:
        return value[:2] + settings.MASK_CHAR * max(0, len(value) - 4) + value[-2:] if len(value) > 4 else value
    
    return value


def mask_sensitive_data(data: dict) -> dict:
    if not isinstance(data, dict):
        return data
    
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result[key] = mask_sensitive_data(value)
        elif isinstance(value, list):
            result[key] = [mask_sensitive_data(item) if isinstance(item, dict) else item for item in value]
        elif key in settings.SENSITIVE_FIELDS and isinstance(value, str):
            result[key] = mask_sensitive_field(key, value)
        else:
            result[key] = value
    return result
