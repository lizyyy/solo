import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from .config import settings


def mask_sensitive_value(value: str, field_type: str = None) -> str:
    if not value or not isinstance(value, str):
        return value
    
    if field_type in ["donor_phone", "operator_phone"]:
        if len(value) >= 7:
            return value[:3] + "****" + value[-4:]
        return "*" * len(value)
    
    elif field_type == "donor_idcard":
        if len(value) >= 10:
            return value[:6] + "********" + value[-4:]
        return "*" * len(value)
    
    else:
        if len(value) > 4:
            return value[:2] + "*" * (len(value) - 4) + value[-2:]
        return "*" * len(value)


def mask_sensitive_fields(data: Any) -> Any:
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if key in settings.SENSITIVE_FIELDS:
                result[key] = mask_sensitive_value(value, key)
            else:
                result[key] = mask_sensitive_fields(value)
        return result
    
    elif isinstance(data, list):
        return [mask_sensitive_fields(item) for item in data]
    
    return data


class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        record.msg = self._sanitize_message(record.msg)
        if hasattr(record, 'args'):
            record.args = self._sanitize_args(record.args)
        return True
    
    def _sanitize_message(self, msg):
        if not isinstance(msg, str):
            return msg
        
        phone_pattern = r'(1[3-9]\d)(\d{4})(\d{4})'
        msg = re.sub(phone_pattern, r'\1****\3', msg)
        
        idcard_pattern = r'(\d{6})(\d{8})(\d{4}|\d{3}[Xx])'
        msg = re.sub(idcard_pattern, r'\1********\3', msg)
        
        return msg
    
    def _sanitize_args(self, args):
        if isinstance(args, tuple):
            return tuple(self._sanitize_message(arg) if isinstance(arg, str) else arg for arg in args)
        elif isinstance(args, dict):
            return {k: self._sanitize_message(v) if isinstance(v, str) else v for k, v in args.items()}
        return args


def setup_logger():
    logger = logging.getLogger("book_library")
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    handler.addFilter(SensitiveDataFilter())
    
    logger.addHandler(handler)
    return logger


logger = setup_logger()


def is_valid_isbn(isbn: str) -> bool:
    if not isbn:
        return False
    isbn = isbn.replace("-", "").replace(" ", "")
    if len(isbn) == 10:
        return _is_valid_isbn10(isbn)
    elif len(isbn) == 13:
        return _is_valid_isbn13(isbn)
    return False


def _is_valid_isbn10(isbn: str) -> bool:
    try:
        total = 0
        for i in range(9):
            total += int(isbn[i]) * (10 - i)
        check = isbn[9]
        if check.upper() == 'X':
            total += 10
        else:
            total += int(check)
        return total % 11 == 0
    except:
        return False


def _is_valid_isbn13(isbn: str) -> bool:
    try:
        total = 0
        for i in range(12):
            digit = int(isbn[i])
            if i % 2 == 0:
                total += digit * 1
            else:
                total += digit * 3
        check = int(isbn[12])
        return (10 - (total % 10)) % 10 == check
    except:
        return False


def normalize_isbn(isbn: str) -> str:
    if not isbn:
        return ""
    return isbn.replace("-", "").replace(" ", "").upper()


ALLOWED_GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", 
                  "初一", "初二", "初三", "高一", "高二", "高三", "通用"]

ALLOWED_CONDITIONS = ["全新", "九成新", "八成新", "七成新", "六成新", "五成新及以下"]


def validate_grade(grade: str) -> tuple[bool, str]:
    if not grade:
        return False, "年级标签不能为空"
    
    normalized_grade = grade.strip()
    
    if normalized_grade not in ALLOWED_GRADES:
        return False, f"无效的年级标签: {grade}，允许值: {', '.join(ALLOWED_GRADES)}"
    
    return True, ""


def validate_condition(condition: str) -> tuple[bool, str]:
    if not condition:
        return False, "品相不能为空"
    
    normalized_condition = condition.strip()
    
    if normalized_condition not in ALLOWED_CONDITIONS:
        return False, f"无效的品相: {condition}，允许值: {', '.join(ALLOWED_CONDITIONS)}"
    
    return True, ""
