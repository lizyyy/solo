import logging
import json
from datetime import datetime
import os
from app.core.config import settings
from app.schemas.schemas import mask_id_card, mask_phone


class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        if hasattr(record, 'msg'):
            record.msg = self._mask_sensitive_data(str(record.msg))
        if hasattr(record, 'args'):
            record.args = tuple(
                self._mask_sensitive_data(str(arg)) if isinstance(arg, (str, dict)) else arg
                for arg in record.args
            )
        return True
    
    def _mask_sensitive_data(self, msg: str) -> str:
        if not settings.MASK_SENSITIVE_FIELDS:
            return msg
        
        import re
        
        id_card_pattern = r'\b\d{17}[\dXx]\b'
        msg = re.sub(id_card_pattern, lambda m: mask_id_card(m.group()), msg)
        
        phone_pattern = r'\b1[3-9]\d{9}\b'
        msg = re.sub(phone_pattern, lambda m: mask_phone(m.group()), msg)
        
        return msg


def setup_logging():
    log_file = os.path.join(settings.LOG_DIR, f"app_{datetime.now().strftime('%Y%m%d')}.log")
    
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    
    logger = logging.getLogger()
    logger.addFilter(SensitiveDataFilter())
    
    return logger


def log_audit(action: str, entity_type: str = None, entity_id: int = None,
              old_value: dict = None, new_value: dict = None,
              operator: str = None, ip_address: str = None):
    logger = logging.getLogger(__name__)
    
    log_data = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "operator": operator,
        "ip_address": ip_address
    }
    
    if old_value:
        log_data["old_value"] = _mask_dict_sensitive(old_value)
    if new_value:
        log_data["new_value"] = _mask_dict_sensitive(new_value)
    
    logger.info(json.dumps(log_data, ensure_ascii=False))


def _mask_dict_sensitive(data: dict) -> dict:
    if not settings.MASK_SENSITIVE_FIELDS:
        return data
    
    result = data.copy()
    for field in settings.SENSITIVE_FIELDS:
        if field in result:
            if field == "id_card":
                result[field] = mask_id_card(str(result[field]))
            elif field == "phone":
                result[field] = mask_phone(str(result[field]))
            elif field == "address":
                addr = str(result[field])
                if len(addr) > 6:
                    result[field] = addr[:3] + "****" + addr[-3:]
    return result
