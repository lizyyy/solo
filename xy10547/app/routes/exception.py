from flask import Blueprint, request
from app import db
from app.models import (
    ExceptionRecord, ExceptionType, ExceptionStatus, Nurse,
    ManualCorrection
)
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user
)
from datetime import datetime

bp = Blueprint('exception', __name__)


@bp.route('', methods=['GET'])
def list_exceptions():
    status = request.args.get('status')
    exception_type = request.args.get('type')
    resident_id = request.args.get('resident_id')
    
    query = ExceptionRecord.query
    
    if status:
        try:
            status_enum = ExceptionStatus(status)
            query = query.filter_by(status=status_enum)
        except ValueError:
            pass
    if exception_type:
        try:
            type_enum = ExceptionType(exception_type)
            query = query.filter_by(exception_type=type_enum)
        except ValueError:
            pass
    if resident_id:
        query = query.filter_by(resident_id=resident_id)
    
    exceptions = query.order_by(ExceptionRecord.created_at.desc()).all()
    return success_response([e.to_dict() for e in exceptions])


@bp.route('/<exception_id>', methods=['GET'])
def get_exception(exception_id):
    exception = ExceptionRecord.query.get(exception_id)
    if not exception:
        return error_response('异常记录不存在', 404, 'NOT_FOUND')
    
    return success_response(exception.to_dict())


@bp.route('/<exception_id>/resolve', methods=['POST'])
@validate_request(['nurse_id', 'resolution_notes'])
def resolve_exception(exception_id):
    data = request.get_json()
    
    exception = ExceptionRecord.query.get(exception_id)
    if not exception:
        return error_response('异常记录不存在', 404, 'NOT_FOUND')
    
    if exception.status == ExceptionStatus.RESOLVED:
        return error_response('异常已处理', 400, 'ALREADY_RESOLVED')
    
    nurse = Nurse.query.get(data['nurse_id'])
    
    old_status = exception.status.value
    exception.status = ExceptionStatus.RESOLVED
    exception.resolved_at = datetime.utcnow()
    exception.resolved_by = nurse.name if nurse else data['nurse_id']
    exception.resolution_notes = data['resolution_notes']
    
    user_id, user_name = get_current_user()
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='ExceptionRecord',
        target_id=str(exception_id),
        field_name='status',
        old_value=old_status,
        new_value=ExceptionStatus.RESOLVED.value,
        reason=f'异常处理: {data["resolution_notes"]}'
    )
    db.session.add(correction)
    
    db.session.commit()
    
    return success_response(exception.to_dict(), '异常已处理')


@bp.route('/<exception_id>/ignore', methods=['POST'])
@validate_request(['nurse_id', 'reason'])
def ignore_exception(exception_id):
    data = request.get_json()
    
    exception = ExceptionRecord.query.get(exception_id)
    if not exception:
        return error_response('异常记录不存在', 404, 'NOT_FOUND')
    
    if exception.status != ExceptionStatus.OPEN:
        return error_response('异常已处理或已忽略', 400, 'INVALID_STATUS')
    
    nurse = Nurse.query.get(data['nurse_id'])
    
    old_status = exception.status.value
    exception.status = ExceptionStatus.IGNORED
    exception.resolved_at = datetime.utcnow()
    exception.resolved_by = nurse.name if nurse else data['nurse_id']
    exception.resolution_notes = f'忽略: {data["reason"]}'
    
    user_id, user_name = get_current_user()
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='ExceptionRecord',
        target_id=str(exception_id),
        field_name='status',
        old_value=old_status,
        new_value=ExceptionStatus.IGNORED.value,
        reason=f'忽略异常: {data["reason"]}'
    )
    db.session.add(correction)
    
    db.session.commit()
    
    return success_response(exception.to_dict(), '异常已忽略')


@bp.route('/stats', methods=['GET'])
def get_exception_stats():
    total = ExceptionRecord.query.count()
    open_count = ExceptionRecord.query.filter_by(status=ExceptionStatus.OPEN).count()
    resolved_count = ExceptionRecord.query.filter_by(status=ExceptionStatus.RESOLVED).count()
    ignored_count = ExceptionRecord.query.filter_by(status=ExceptionStatus.IGNORED).count()
    
    by_type = db.session.query(
        ExceptionRecord.exception_type,
        db.func.count(ExceptionRecord.id)
    ).group_by(ExceptionRecord.exception_type).all()
    
    type_stats = {}
    for t, count in by_type:
        type_stats[t.value] = count
    
    return success_response({
        'total': total,
        'open': open_count,
        'resolved': resolved_count,
        'ignored': ignored_count,
        'by_type': type_stats
    })
