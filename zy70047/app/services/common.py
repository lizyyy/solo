import json
import uuid
from datetime import datetime, timedelta
from app import db
from app.models import IdempotentRequest, OperationLog


def generate_id(prefix=''):
    return f"{prefix}{uuid.uuid4().hex[:16].upper()}"


def log_operation(operation_type, order_no=None, part_code=None, 
                  before_state=None, after_state=None, 
                  change_qty=None, change_amount=None,
                  operator=None, note=None):
    log = OperationLog(
        log_id=generate_id('LOG'),
        operation_type=operation_type,
        order_no=order_no,
        part_code=part_code,
        before_state=json.dumps(before_state, ensure_ascii=False) if before_state else None,
        after_state=json.dumps(after_state, ensure_ascii=False) if after_state else None,
        change_qty=change_qty,
        change_amount=change_amount or 0.0,
        operator=operator or 'system',
        note=note
    )
    db.session.add(log)
    db.session.flush()
    return log


def check_idempotent(request_key):
    from config import Config
    cutoff_time = datetime.utcnow() - timedelta(minutes=Config.IDEMPOTENT_WINDOW_MINUTES)
    
    existing = IdempotentRequest.query.filter(
        IdempotentRequest.request_key == request_key,
        IdempotentRequest.created_at >= cutoff_time
    ).first()
    
    if existing:
        return json.loads(existing.response_body) if existing.response_body else None
    
    return None


def save_idempotent(request_key, endpoint, request_body, response_body):
    existing = IdempotentRequest.query.filter_by(request_key=request_key).first()
    if existing:
        existing.response_body = json.dumps(response_body, ensure_ascii=False)
        existing.created_at = datetime.utcnow()
    else:
        record = IdempotentRequest(
            request_key=request_key,
            endpoint=endpoint,
            request_body=json.dumps(request_body, ensure_ascii=False) if request_body else None,
            response_body=json.dumps(response_body, ensure_ascii=False) if response_body else None
        )
        db.session.add(record)
    db.session.flush()
