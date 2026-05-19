import re
import hashlib
import json
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
from functools import wraps


SENSITIVE_FIELDS = {
    'rectifier_phone': 'phone',
    'phone': 'phone',
    'operator_id': 'mask_id',
    'registered_by_id': 'mask_id',
    'assigned_by_id': 'mask_id',
    'rectified_by_id': 'mask_id',
    'rechecked_by_id': 'mask_id',
    'archived_by_id': 'mask_id',
    'user_id': 'mask_id',
}


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return phone
    if len(phone) == 11:
        return phone[:3] + '****' + phone[-4:]
    elif len(phone) > 4:
        return phone[:1] + '*' * (len(phone) - 2) + phone[-1:]
    return '*' * len(phone)


def mask_id(id_str: Optional[str]) -> Optional[str]:
    if not id_str:
        return id_str
    if len(id_str) > 4:
        return id_str[:1] + '*' * (len(id_str) - 2) + id_str[-1:]
    return '*' * len(id_str)


def mask_sensitive_data(data: Any) -> Any:
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if key in SENSITIVE_FIELDS:
                mask_type = SENSITIVE_FIELDS[key]
                if mask_type == 'phone':
                    result[key] = mask_phone(value)
                elif mask_type == 'mask_id':
                    result[key] = mask_id(value)
            else:
                result[key] = mask_sensitive_data(value)
        return result
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    elif hasattr(data, '__dict__'):
        obj_dict = data.__dict__.copy()
        return mask_sensitive_data(obj_dict)
    return data


def generate_hash(*args, **kwargs) -> str:
    content = '|'.join(str(arg) for arg in args)
    content += '|' + '|'.join(f"{k}={v}" for k, v in sorted(kwargs.items()))
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def generate_request_key(operation_type: str, operator_id: str, unique_identifier: str) -> str:
    return generate_hash(operation_type, operator_id, unique_identifier)


class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        if hasattr(record, 'msg') and isinstance(record.msg, dict):
            record.msg = mask_sensitive_data(record.msg)
        if hasattr(record, 'args'):
            record.args = tuple(mask_sensitive_data(arg) for arg in record.args)
        return True


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        return logger

    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    file_handler = logging.FileHandler('hazard_management.log')
    file_handler.setFormatter(formatter)
    file_handler.addFilter(SensitiveDataFilter())

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.addFilter(SensitiveDataFilter())

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, 'value'):
        return obj.value
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def to_json(data: Any) -> str:
    return json.dumps(data, default=json_serializer, ensure_ascii=False)


def parse_json(json_str: str) -> Any:
    return json.loads(json_str)


def hazard_to_dict(hazard) -> Dict:
    return {
        'id': hazard.id,
        'hazard_no': hazard.hazard_no,
        'title': hazard.title,
        'description': hazard.description,
        'location': hazard.location,
        'level': hazard.level,
        'status': hazard.status.value if hazard.status else None,
        'photo_path': hazard.photo_path,
        'rectifier_id': hazard.rectifier_id,
        'rectifier_name': hazard.rectifier_name,
        'rectifier_phone': hazard.rectifier_phone,
        'rectifier_dept': hazard.rectifier_dept,
        'deadline': hazard.deadline.isoformat() if hazard.deadline else None,
        'rectification_desc': hazard.rectification_desc,
        'rectification_photo_path': hazard.rectification_photo_path,
        'rectification_time': hazard.rectification_time.isoformat() if hazard.rectification_time else None,
        'recheck_result': hazard.recheck_result,
        'recheck_opinion': hazard.recheck_opinion,
        'recheck_photo_path': hazard.recheck_photo_path,
        'recheck_time': hazard.recheck_time.isoformat() if hazard.recheck_time else None,
        'registered_by_id': hazard.registered_by_id,
        'registered_by_name': hazard.registered_by_name,
        'registered_time': hazard.registered_time.isoformat() if hazard.registered_time else None,
        'assigned_by_id': hazard.assigned_by_id,
        'assigned_by_name': hazard.assigned_by_name,
        'assigned_time': hazard.assigned_time.isoformat() if hazard.assigned_time else None,
        'rectified_by_id': hazard.rectified_by_id,
        'rectified_by_name': hazard.rectified_by_name,
        'rechecked_by_id': hazard.rechecked_by_id,
        'rechecked_by_name': hazard.rechecked_by_name,
        'archived_by_id': hazard.archived_by_id,
        'archived_by_name': hazard.archived_by_name,
        'archived_time': hazard.archived_time.isoformat() if hazard.archived_time else None,
        'created_at': hazard.created_at.isoformat() if hazard.created_at else None,
        'updated_at': hazard.updated_at.isoformat() if hazard.updated_at else None,
    }


def operation_log_to_dict(log) -> Dict:
    return {
        'id': log.id,
        'hazard_id': log.hazard_id,
        'operation_type': log.operation_type.value if log.operation_type else None,
        'operator_id': log.operator_id,
        'operator_name': log.operator_name,
        'operator_role': log.operator_role.value if log.operator_role else None,
        'operation_time': log.operation_time.isoformat() if log.operation_time else None,
        'remark': log.remark,
        'old_values': log.old_values,
        'new_values': log.new_values,
        'ip_address': log.ip_address,
        'user_agent': log.user_agent,
    }


logger = setup_logger('hazard_management')
