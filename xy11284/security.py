import json
import logging
from typing import Any, Dict, List, Union
from config import settings


class SensitiveDataMasker:
    def __init__(self):
        self.sensitive_fields = set(settings.SENSITIVE_FIELDS)
        self.mask_pattern = settings.MASK_PATTERN
    
    def mask_phone(self, phone: str) -> str:
        if not phone or len(phone) < 7:
            return self.mask_pattern
        return phone[:3] + "****" + phone[-4:]
    
    def mask_id_card(self, id_card: str) -> str:
        if not id_card or len(id_card) < 10:
            return self.mask_pattern
        return id_card[:6] + "********" + id_card[-4:]
    
    def mask_email(self, email: str) -> str:
        if not email or "@" not in email:
            return self.mask_pattern
        username, domain = email.split("@", 1)
        if len(username) > 2:
            return username[:2] + "****@" + domain
        return "****@" + domain
    
    def mask_field(self, field_name: str, value: Any) -> Any:
        if value is None:
            return None
        
        field_lower = field_name.lower()
        
        if "phone" in field_lower or "mobile" in field_lower:
            return self.mask_phone(str(value))
        
        if "id_card" in field_lower or "idcard" in field_lower or "identity" in field_lower:
            return self.mask_id_card(str(value))
        
        if "email" in field_lower:
            return self.mask_email(str(value))
        
        if any(sensitive in field_lower for sensitive in ["birthday", "birth_date", "address"]):
            return self.mask_pattern
        
        return value
    
    def mask_data(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                key: (
                    self.mask_data(value)
                    if key not in self.sensitive_fields
                    else self.mask_field(key, value)
                )
                for key, value in data.items()
            }
        
        if isinstance(data, list):
            return [self.mask_data(item) for item in data]
        
        if isinstance(data, tuple):
            return tuple(self.mask_data(item) for item in data)
        
        return data
    
    def mask_json(self, json_str: str) -> str:
        try:
            data = json.loads(json_str)
            masked_data = self.mask_data(data)
            return json.dumps(masked_data, ensure_ascii=False)
        except (json.JSONDecodeError, TypeError):
            return json_str


class MaskedLogFilter(logging.Filter):
    def __init__(self):
        super().__init__()
        self.masker = SensitiveDataMasker()
    
    def filter(self, record):
        if hasattr(record, 'msg'):
            if isinstance(record.msg, (dict, list)):
                record.msg = self.masker.mask_data(record.msg)
            elif isinstance(record.msg, str):
                record.msg = self.masker.mask_json(record.msg)
        
        if hasattr(record, 'args') and record.args:
            args_list = list(record.args)
            for i, arg in enumerate(args_list):
                if isinstance(arg, (dict, list)):
                    args_list[i] = self.masker.mask_data(arg)
                elif isinstance(arg, str):
                    args_list[i] = self.masker.mask_json(arg)
            record.args = tuple(args_list)
        
        return True


def setup_logging():
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    
    console_handler.addFilter(MaskedLogFilter())
    
    root_logger.addHandler(console_handler)
    
    return root_logger


masker = SensitiveDataMasker()
