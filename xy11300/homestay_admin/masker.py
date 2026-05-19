import re
import json
from typing import Any, Dict, List, Union, Optional
from functools import wraps
import logging


class SensitiveMasker:
    PHONE_PATTERN = re.compile(r'(\d{3})\d{4}(\d{4})')
    ID_CARD_PATTERN = re.compile(r'(\d{6})\d{8,10}(\d{3}[\dXx])')
    BANK_CARD_PATTERN = re.compile(r'(\d{4})\d{8,12}(\d{4})')
    EMAIL_PATTERN = re.compile(r'(\w{1,3})\w*@(\w+\.\w+)')

    SENSITIVE_FIELDS = {
        'phone', 'telephone', 'mobile', '手机号', '电话',
        'id_card', 'idcard', '身份证', '身份证号',
        'bank_card', 'bankcard', '银行卡', '银行卡号',
        'email', '邮箱', '电子邮箱',
        'address', '地址', '住址',
        'name', '姓名', '名称',
        'handler_phone', 'cleaner_phone',
        'operator', 'handler', 'cleaner_name'
    }

    @classmethod
    def mask_phone(cls, phone: str) -> str:
        if not phone or len(phone) < 7:
            return phone
        return cls.PHONE_PATTERN.sub(r'\1****\2', phone)

    @classmethod
    def mask_id_card(cls, id_card: str) -> str:
        if not id_card or len(id_card) < 10:
            return id_card
        return cls.ID_CARD_PATTERN.sub(r'\1********\2', id_card)

    @classmethod
    def mask_bank_card(cls, bank_card: str) -> str:
        if not bank_card or len(bank_card) < 10:
            return bank_card
        return cls.BANK_CARD_PATTERN.sub(r'\1********\2', bank_card)

    @classmethod
    def mask_email(cls, email: str) -> str:
        if not email or '@' not in email:
            return email
        return cls.EMAIL_PATTERN.sub(r'\1***@\2', email)

    @classmethod
    def mask_name(cls, name: str) -> str:
        if not name:
            return name
        if len(name) == 2:
            return name[0] + '*'
        elif len(name) > 2:
            return name[0] + '*' * (len(name) - 2) + name[-1]
        return name

    @classmethod
    def mask_address(cls, address: str) -> str:
        if not address or len(address) < 6:
            return address
        return address[:3] + '****' + address[-3:] if len(address) > 6 else address

    @classmethod
    def mask_by_field_name(cls, field_name: str, value: Any) -> Any:
        if value is None:
            return value
        if not isinstance(value, str):
            return value

        field_lower = field_name.lower()
        
        if any(kw in field_lower for kw in ['phone', 'mobile', 'telephone', '手机号', '电话']):
            return cls.mask_phone(value)
        elif any(kw in field_lower for kw in ['id_card', 'idcard', '身份证']):
            return cls.mask_id_card(value)
        elif any(kw in field_lower for kw in ['bank_card', 'bankcard', '银行卡']):
            return cls.mask_bank_card(value)
        elif any(kw in field_lower for kw in ['email', '邮箱', '电子邮箱']):
            return cls.mask_email(value)
        elif any(kw in field_lower for kw in ['name', '姓名', 'handler', 'cleaner', 'operator']):
            return cls.mask_name(value)
        elif any(kw in field_lower for kw in ['address', '地址', '住址']):
            return cls.mask_address(value)
        
        return value

    @classmethod
    def mask_dict(cls, data: Dict[str, Any], fields: Optional[List[str]] = None) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return data

        result = {}
        for key, value in data.items():
            if isinstance(value, dict):
                result[key] = cls.mask_dict(value, fields)
            elif isinstance(value, list):
                result[key] = [
                    cls.mask_dict(item, fields) if isinstance(item, dict) 
                    else cls.mask_by_field_name(key, item) 
                    for item in value
                ]
            else:
                if fields is None:
                    result[key] = cls.mask_by_field_name(key, value)
                elif key in fields:
                    result[key] = cls.mask_by_field_name(key, value)
                else:
                    result[key] = value
        return result

    @classmethod
    def mask_model(cls, model_instance) -> Dict[str, Any]:
        if hasattr(model_instance, '__dict__'):
            data = {k: v for k, v in model_instance.__dict__.items() if not k.startswith('_')}
            return cls.mask_dict(data)
        return {}

    @classmethod
    def mask_model_list(cls, model_list: List[Any]) -> List[Dict[str, Any]]:
        return [cls.mask_model(model) for model in model_list]

    @classmethod
    def mask_log(cls, message: str) -> str:
        message = cls.PHONE_PATTERN.sub(r'\1****\2', message)
        message = cls.ID_CARD_PATTERN.sub(r'\1********\2', message)
        message = cls.BANK_CARD_PATTERN.sub(r'\1********\2', message)
        return message

    @classmethod
    def mask_export_row(cls, row: Dict[str, Any]) -> Dict[str, Any]:
        return cls.mask_dict(row)


class MaskedLoggingFilter(logging.Filter):
    def filter(self, record):
        record.msg = SensitiveMasker.mask_log(str(record.msg))
        if record.args:
            record.args = tuple(
                SensitiveMasker.mask_log(str(arg)) if isinstance(arg, str) else arg
                for arg in record.args
            )
        return True


def mask_response(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        if isinstance(result, dict):
            return SensitiveMasker.mask_dict(result)
        elif isinstance(result, list):
            return [
                SensitiveMasker.mask_dict(item) if isinstance(item, dict) else item
                for item in result
            ]
        return result
    return wrapper


def get_masked_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.addFilter(MaskedLoggingFilter())
    return logger
