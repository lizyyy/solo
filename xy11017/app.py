from flask import Flask, request, jsonify
from datetime import datetime
import uuid
import re

app = Flask(__name__)

late_records = {}

REQUIRED_FIELDS = [
    'student_id',
    'student_name',
    'class_name',
    'route_number',
    'bus_plate',
    'driver_name',
    'late_date',
    'scheduled_arrival',
    'actual_arrival',
    'late_minutes',
    'reason_category'
]

VALID_STATUSES = ['pending', 'confirmed', 'archived']

STATUS_TRANSITIONS = {
    'pending': ['confirmed', 'archived'],
    'confirmed': ['archived'],
    'archived': []
}

ERROR_SUGGESTIONS = {
    'missing_field': '请检查必填字段是否完整，参考 README 中的字段说明',
    'invalid_date': '请使用 YYYY-MM-DD 格式，例如 2024-05-20',
    'invalid_time': '请使用 HH:MM 格式，例如 07:30',
    'negative_late_minutes': '请核对实际到达时间，重新计算迟到分钟数',
    'duplicate_record': '该记录已存在，如需修改请使用更新接口',
    'invalid_status': '有效状态为 pending, confirmed, archived',
    'invalid_status_transition': '请按照状态流转规则操作：pending → confirmed → archived',
    'record_not_found': '请检查记录ID是否正确'
}


def generate_record_id():
    return f'rec_{uuid.uuid4().hex[:8]}'


def validate_date(date_str):
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except ValueError:
        return False


def validate_time(time_str):
    pattern = r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
    return bool(re.match(pattern, time_str))


def generate_unique_key(record):
    return f"{record.get('student_id')}_{record.get('late_date')}_{record.get('route_number')}"


def validate_record(record):
    errors = []
    
    for field in REQUIRED_FIELDS:
        if field not in record or record[field] is None or str(record[field]).strip() == '':
            errors.append({
                'field': field,
                'reason': f'缺少必填字段: {field}',
                'suggestion': ERROR_SUGGESTIONS['missing_field']
            })
    
    if errors:
        return False, errors
    
    if not validate_date(record.get('late_date', '')):
        errors.append({
            'field': 'late_date',
            'reason': f'日期格式无效: {record.get("late_date")}',
            'suggestion': ERROR_SUGGESTIONS['invalid_date']
        })
    
    if not validate_time(record.get('scheduled_arrival', '')):
        errors.append({
            'field': 'scheduled_arrival',
            'reason': f'时间格式无效: {record.get("scheduled_arrival")}',
            'suggestion': ERROR_SUGGESTIONS['invalid_time']
        })
    
    if not validate_time(record.get('actual_arrival', '')):
        errors.append({
            'field': 'actual_arrival',
            'reason': f'时间格式无效: {record.get("actual_arrival")}',
            'suggestion': ERROR_SUGGESTIONS['invalid_time']
        })
    
    late_minutes = record.get('late_minutes')
    if not isinstance(late_minutes, int) or late_minutes < 0:
        errors.append({
            'field': 'late_minutes',
            'reason': f'迟到分钟数不能为负数: {late_minutes}',
            'suggestion': ERROR_SUGGESTIONS['negative_late_minutes']
        })
    
    if 'status' in record and record['status'] not in VALID_STATUSES:
        errors.append({
            'field': 'status',
            'reason': f'无效状态: {record.get("status")}',
            'suggestion': ERROR_SUGGESTIONS['invalid_status']
        })
    
    return len(errors) == 0, errors


def needs_manual_review(record):
    return record.get('is_driver_marked', False) or record.get('is_weekly_consistent', False)


def get_review_reason(record):
    reasons = []
    if record.get('is_driver_marked', False):
        reasons.append('司机手工标记上车，需确认学生实际乘车情况')
    if record.get('is_weekly_consistent', False):
        reasons.append('迟到周报一致性标记，需核对本周数据')
    return '；'.join(reasons)


@app.route('/api/late-records/import', methods=['POST'])
def import_late_records():
    data = request.get_json()
    
    if not data or 'records' not in data:
        return jsonify({
            'success': False,
            'error': '请求格式错误，缺少 records 字段',
            'suggestion': '请参考 README 中的请求格式示例'
        }), 400
    
    records = data['records']
    successful_records = []
    failed_records = []
    need_manual_review_records = []
    
    for record in records:
        is_valid, validation_errors = validate_record(record)
        
        if not is_valid:
            failed_records.append({
                'original_data': record,
                'error_reason': '; '.join([e['reason'] for e in validation_errors]),
                'suggestion': '; '.join([e['suggestion'] for e in validation_errors])
            })
            continue
        
        unique_key = generate_unique_key(record)
        existing_record = None
        for rec in late_records.values():
            if generate_unique_key(rec) == unique_key:
                existing_record = rec
                break
        
        if existing_record:
            failed_records.append({
                'original_data': record,
                'error_reason': ERROR_SUGGESTIONS['duplicate_record'],
                'suggestion': f'该学生{record["late_date"]}在{record["route_number"]}的迟到记录已存在'
            })
            continue
        
        record_id = generate_record_id()
        record['id'] = record_id
        record['status'] = record.get('status', 'pending')
        record['created_at'] = datetime.now().isoformat()
        record['updated_at'] = datetime.now().isoformat()
        
        if needs_manual_review(record):
            need_manual_review_records.append({
                'record_id': record_id,
                'original_data': record,
                'review_reason': get_review_reason(record),
                'current_status': record['status']
            })
        
        late_records[record_id] = record
        successful_records.append(record)
    
    return jsonify({
        'success': True,
        'total_count': len(records),
        'success_count': len(successful_records),
        'failed_count': len(failed_records),
        'need_manual_review_count': len(need_manual_review_records),
        'successful_records': successful_records,
        'failed_records': failed_records,
        'need_manual_review_records': need_manual_review_records
    }), 200


@app.route('/api/late-records/<record_id>/status', methods=['PUT'])
def update_record_status(record_id):
    data = request.get_json()
    
    if not data or 'status' not in data:
        return jsonify({
            'success': False,
            'error': '请求格式错误，缺少 status 字段',
            'suggestion': '请参考 README 中的请求格式示例'
        }), 400
    
    if record_id not in late_records:
        return jsonify({
            'success': False,
            'error': ERROR_SUGGESTIONS['record_not_found'],
            'original_data': data
        }), 404
    
    record = late_records[record_id]
    new_status = data['status']
    current_status = record['status']
    
    if new_status not in VALID_STATUSES:
        return jsonify({
            'success': False,
            'error': ERROR_SUGGESTIONS['invalid_status'],
            'original_data': record,
            'suggestion': ERROR_SUGGESTIONS['invalid_status']
        }), 400
    
    if new_status not in STATUS_TRANSITIONS.get(current_status, []):
        return jsonify({
            'success': False,
            'error': f'无法从 {current_status} 状态变更为 {new_status} 状态',
            'original_data': record,
            'suggestion': ERROR_SUGGESTIONS['invalid_status_transition']
        }), 400
    
    record['status'] = new_status
    record['updated_at'] = datetime.now().isoformat()
    
    if 'remark' in data:
        record['remark'] = data['remark']
    
    return jsonify({
        'success': True,
        'record': record
    }), 200


@app.route('/api/late-records', methods=['GET'])
def get_late_records():
    status = request.args.get('status')
    student_id = request.args.get('student_id')
    late_date = request.args.get('late_date')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    
    filtered_records = list(late_records.values())
    
    if status:
        filtered_records = [r for r in filtered_records if r.get('status') == status]
    if student_id:
        filtered_records = [r for r in filtered_records if r.get('student_id') == student_id]
    if late_date:
        filtered_records = [r for r in filtered_records if r.get('late_date') == late_date]
    
    start = (page - 1) * page_size
    end = start + page_size
    paginated_records = filtered_records[start:end]
    
    return jsonify({
        'success': True,
        'total': len(filtered_records),
        'page': page,
        'page_size': page_size,
        'records': paginated_records
    }), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
