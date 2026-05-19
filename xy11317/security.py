import re
import json
import logging
from typing import Any, Dict, List, Union
from datetime import datetime, date

class SensitiveDataMasker:
    MOBILE_PATTERN = re.compile(r'(\d{3})\d{4}(\d{4})')
    ID_CARD_PATTERN = re.compile(r'(\d{6})\d{8,10}(\d{3}[\dXx])')
    NAME_PATTERN = re.compile(r'([\u4e00-\u9fa5]{1})([\u4e00-\u9fa5]+)')
    EMAIL_PATTERN = re.compile(r'(\w{1,3})\w*@(\w+\.\w+)')
    
    @classmethod
    def mask_mobile(cls, mobile: str) -> str:
        if not mobile:
            return mobile
        mobile = str(mobile).strip()
        return cls.MOBILE_PATTERN.sub(r'\1****\2', mobile)
    
    @classmethod
    def mask_name(cls, name: str) -> str:
        if not name or len(name) <= 1:
            return name
        name = str(name).strip()
        if len(name) == 2:
            return name[0] + '*'
        return name[0] + '*' * (len(name) - 2) + name[-1]
    
    @classmethod
    def mask_id_card(cls, id_card: str) -> str:
        if not id_card:
            return id_card
        id_card = str(id_card).strip()
        return cls.ID_CARD_PATTERN.sub(r'\1**********\2', id_card)
    
    @classmethod
    def mask_email(cls, email: str) -> str:
        if not email:
            return email
        email = str(email).strip()
        match = cls.EMAIL_PATTERN.match(email)
        if match:
            return f"{match.group(1)}***@{match.group(2)}"
        return email
    
    @classmethod
    def mask_value(cls, key: str, value: Any) -> Any:
        if value is None:
            return value
        
        key_lower = key.lower()
        
        if any(kw in key_lower for kw in ['phone', 'mobile', 'tel']):
            return cls.mask_mobile(str(value))
        
        if any(kw in key_lower for kw in ['idcard', 'id_card', 'identity']):
            return cls.mask_id_card(str(value))
        
        if any(kw in key_lower for kw in ['name', 'parent_name', 'student_name', 'driver_name']):
            return cls.mask_name(str(value))
        
        if 'email' in key_lower:
            return cls.mask_email(str(value))
        
        if isinstance(value, (dict, list)):
            return cls.mask_data(value)
        
        return value
    
    @classmethod
    def mask_data(cls, data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
        if isinstance(data, dict):
            return {k: cls.mask_value(k, v) for k, v in data.items()}
        
        if isinstance(data, list):
            return [cls.mask_data(item) for item in data]
        
        return data

class MaskedLogFormatter(logging.Formatter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.masker = SensitiveDataMasker()
    
    def format(self, record):
        message = super().format(record)
        
        patterns = [
            (r'phone["\s:]+["\']?(\d{11})["\']?', lambda m: f'phone: "{SensitiveDataMasker.mask_mobile(m.group(1))}"'),
            (r'mobile["\s:]+["\']?(\d{11})["\']?', lambda m: f'mobile: "{SensitiveDataMasker.mask_mobile(m.group(1))}"'),
        ]
        
        for pattern, repl in patterns:
            message = re.sub(pattern, repl, message)
        
        return message

def setup_logging():
    logger = logging.getLogger("bus_scheduler")
    logger.setLevel(logging.INFO)
    
    handler = logging.FileHandler("bus_scheduler.log")
    handler.setFormatter(MaskedLogFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    
    logger.addHandler(handler)
    return logger

def export_with_mask(data: List[Dict], fields_to_mask: List[str] = None) -> List[Dict]:
    if fields_to_mask is None:
        fields_to_mask = ['parent_name', 'parent_phone', 'student_name', 'driver_name']
    
    result = []
    for item in data:
        masked_item = item.copy()
        for field in fields_to_mask:
            if field in masked_item:
                masked_item[field] = SensitiveDataMasker.mask_value(field, masked_item[field])
        result.append(masked_item)
    
    return result
