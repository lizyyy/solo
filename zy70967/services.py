import hashlib
import json
from datetime import datetime
from dateutil import parser as date_parser
from models import RawMaterial, QualityCheckRecord


def generate_material_hash(raw_content):
    """根据原始材料的关键字段生成唯一 hash，用于去重识别"""
    key_fields = []

    appeal_number = raw_content.get('appeal_number', '')
    agent_id = raw_content.get('agent_id', '')
    call_time = raw_content.get('call_time', '')

    if appeal_number:
        key_fields.append(str(appeal_number))
    if agent_id:
        key_fields.append(str(agent_id))
    if call_time:
        key_fields.append(str(call_time))

    if not key_fields:
        content_str = json.dumps(raw_content, sort_keys=True, ensure_ascii=False)
        key_fields.append(content_str)

    hash_input = '|'.join(key_fields)
    return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()


def find_duplicate(material_hash, exclude_batch_id=None):
    """查找是否已有相同 hash 的材料，返回原始记录"""
    query = RawMaterial.query.filter_by(material_hash=material_hash, is_duplicate=False)
    if exclude_batch_id:
        query = query.filter(RawMaterial.batch_id != exclude_batch_id)
    return query.first()


def validate_raw_content(raw_content, line_number):
    """校验原始材料的字段完整性和时间逻辑"""
    errors = []

    required_fields = ['appeal_number', 'agent_id', 'call_time']
    missing_fields = [f for f in required_fields if not raw_content.get(f)]
    if missing_fields:
        errors.append({
            'type': 'missing_fields',
            'line_number': line_number,
            'fields': missing_fields,
            'message': f'缺少必填字段: {", ".join(missing_fields)}'
        })

    call_time_str = raw_content.get('call_time', '')
    if call_time_str:
        try:
            call_time = date_parser.parse(str(call_time_str))
            if call_time > datetime.utcnow():
                errors.append({
                    'type': 'time_conflict',
                    'line_number': line_number,
                    'field': 'call_time',
                    'value': str(call_time_str),
                    'message': '通话时间不能晚于当前时间'
                })

            appeal_time_str = raw_content.get('appeal_time', '')
            if appeal_time_str:
                appeal_time = date_parser.parse(str(appeal_time_str))
                if appeal_time < call_time:
                    errors.append({
                        'type': 'time_conflict',
                        'line_number': line_number,
                        'field': 'appeal_time',
                        'value': str(appeal_time_str),
                        'message': '申诉时间不能早于通话时间'
                    })
        except Exception as e:
            errors.append({
                'type': 'invalid_format',
                'line_number': line_number,
                'field': 'call_time',
                'value': str(call_time_str),
                'message': f'时间格式解析失败: {str(e)}'
            })

    return errors


def parse_raw_content(raw_content):
    """从原始材料解析生成质检记录字段"""
    call_time = None
    call_time_str = raw_content.get('call_time', '')
    if call_time_str:
        try:
            call_time = date_parser.parse(str(call_time_str))
        except Exception:
            call_time = None

    appeal_number = str(raw_content.get('appeal_number', ''))
    agent_id = str(raw_content.get('agent_id', ''))
    agent_name = raw_content.get('agent_name', '')
    team_name = raw_content.get('team_name', '')
    call_duration = raw_content.get('call_duration')
    appeal_type = raw_content.get('appeal_type', '')
    appeal_reason = raw_content.get('appeal_reason', '')
    original_score = raw_content.get('original_score')
    original_conclusion = raw_content.get('original_conclusion', '')

    return {
        'appeal_number': appeal_number,
        'agent_id': agent_id,
        'agent_name': agent_name,
        'team_name': team_name,
        'call_time': call_time,
        'call_duration': call_duration,
        'appeal_type': appeal_type,
        'appeal_reason': appeal_reason,
        'original_score': original_score,
        'original_conclusion': original_conclusion,
        'current_score': original_score,
        'current_conclusion': original_conclusion,
        'final_score': original_score,
        'final_conclusion': original_conclusion,
    }


def check_duplicate_appeal_number(appeal_number, exclude_record_id=None):
    """检查申诉编号是否重复"""
    if not appeal_number:
        return None
    query = QualityCheckRecord.query.filter_by(appeal_number=appeal_number)
    if exclude_record_id:
        query = query.filter(QualityCheckRecord.id != exclude_record_id)
    return query.first()
