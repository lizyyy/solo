import hashlib
import json
from datetime import datetime, date
from flask import jsonify

def generate_task_hash(dataset_id, rule_ids, check_date):
    content = f"{dataset_id}-{sorted(rule_ids)}-{check_date}"
    return hashlib.sha256(content.encode()).hexdigest()

def validate_threshold_config(rule_type, threshold_config):
    try:
        config = json.loads(threshold_config)
    except json.JSONDecodeError:
        return False, "阈值配置不是有效的 JSON 格式"
    
    validators = {
        'null_rate': lambda c: 'max_null_rate' in c and 0 <= c['max_null_rate'] <= 1,
        'uniqueness': lambda c: 'min_unique_ratio' in c and 0 <= c['min_unique_ratio'] <= 1,
        'value_range': lambda c: ('min_value' in c or 'max_value' in c),
        'daily_fluctuation': lambda c: ('max_increase_ratio' in c or 'max_decrease_ratio' in c),
        'cross_table_consistency': lambda c: 'max_diff_ratio' in c and 0 <= c['max_diff_ratio'] <= 1
    }
    
    validator = validators.get(rule_type)
    if not validator:
        return False, f"未知的规则类型: {rule_type}"
    
    if not validator(config):
        return False, f"{rule_type} 规则的阈值配置不完整或无效"
    
    return True, "配置有效"

def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def success_response(data=None, message="操作成功"):
    response = {
        "code": 0,
        "message": message,
        "data": data
    }
    return jsonify(response), 200

def error_response(message="操作失败", code=400, data=None):
    response = {
        "code": code,
        "message": message,
        "data": data
    }
    return jsonify(response), 200
