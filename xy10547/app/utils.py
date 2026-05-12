import uuid
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timedelta
from config import Config


def generate_request_id():
    return f"req-{uuid.uuid4().hex[:12]}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y/%m/%d').date()
        except ValueError:
            return None


def parse_time(time_str):
    if not time_str:
        return None
    try:
        return datetime.strptime(time_str, '%H:%M').time()
    except ValueError:
        try:
            return datetime.strptime(time_str, '%H:%M:%S').time()
        except ValueError:
            return None


def get_current_user():
    return request.headers.get('X-User-Id', 'system'), request.headers.get('X-User-Name', '系统')


def is_within_missed_window(scheduled_datetime, check_datetime=None):
    if check_datetime is None:
        check_datetime = datetime.utcnow()
    
    window = timedelta(hours=Config.MISSED_DOSE_WINDOW_HOURS)
    return (check_datetime - scheduled_datetime) <= window


def success_response(data=None, message='操作成功', status_code=200):
    return jsonify({
        'success': True,
        'message': message,
        'data': data,
        'timestamp': datetime.utcnow().isoformat()
    }), status_code


def error_response(message='操作失败', status_code=400, error_code=None, details=None):
    response = {
        'success': False,
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    if error_code:
        response['error_code'] = error_code
    if details:
        response['details'] = details
    return jsonify(response), status_code


def validate_request(required_fields):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json(silent=True) or {}
            missing = [field for field in required_fields if field not in data]
            if missing:
                return error_response(
                    message=f'缺少必要字段: {", ".join(missing)}',
                    error_code='MISSING_FIELDS'
                )
            return f(*args, **kwargs)
        return decorated_function
    return decorator
