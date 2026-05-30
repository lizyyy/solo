from flask import Blueprint, request, jsonify
from models import db, RepairException
from services.exception_service import ExceptionService
from services.confirmation_service import ConfirmationService
from services.status_service import StatusService

bp = Blueprint('exceptions', __name__, url_prefix='/api/exceptions')


@bp.route('', methods=['GET'])
def list_exceptions():
    exception_type = request.args.get('exception_type')
    status = request.args.get('status')
    repair_order_id = request.args.get('repair_order_id', type=int)
    query = RepairException.query
    if exception_type:
        query = query.filter_by(exception_type=exception_type)
    if status:
        query = query.filter_by(status=status)
    if repair_order_id:
        query = query.filter_by(repair_order_id=repair_order_id)
    items = query.order_by(RepairException.detected_at.desc()).all()
    return jsonify([{
        'id': e.id,
        'exception_type': e.exception_type.value,
        'status': e.status.value,
        'repair_order_id': e.repair_order_id,
        'spare_part_order_id': e.spare_part_order_id,
        'performance_id': e.performance_id,
        'description': e.description,
        'detected_at': str(e.detected_at),
        'acknowledged_by': e.acknowledged_by,
        'acknowledged_at': str(e.acknowledged_at) if e.acknowledged_at else None
    } for e in items])


@bp.route('/<int:id>', methods=['GET'])
def get_exception(id):
    e = RepairException.query.get_or_404(id)
    confirmations = ConfirmationService.get_confirmation_history(exception_id=id)
    histories = StatusService.get_entity_history('RepairException', id)
    return jsonify({
        'id': e.id,
        'exception_type': e.exception_type.value,
        'status': e.status.value,
        'repair_order_id': e.repair_order_id,
        'spare_part_order_id': e.spare_part_order_id,
        'performance_id': e.performance_id,
        'description': e.description,
        'detected_at': str(e.detected_at),
        'acknowledged_by': e.acknowledged_by,
        'acknowledged_at': str(e.acknowledged_at) if e.acknowledged_at else None,
        'acknowledge_note': e.acknowledge_note,
        'resolved_by': e.resolved_by,
        'resolved_at': str(e.resolved_at) if e.resolved_at else None,
        'resolution_note': e.resolution_note,
        'confirmations': [{
            'id': c.id,
            'confirmation_type': c.confirmation_type.value,
            'confirmed_at': str(c.confirmed_at),
            'confirmed_by': c.confirmed_by,
            'confirmation_note': c.confirmation_note,
            'has_snapshot': c.before_snapshot is not None
        } for c in confirmations],
        'status_history': [{
            'id': h.id,
            'from_status': h.from_status,
            'to_status': h.to_status,
            'change_reason': h.change_reason,
            'operated_by': h.operated_by,
            'created_at': str(h.created_at)
        } for h in histories]
    })


@bp.route('/<int:id>/confirm', methods=['POST'])
def confirm_exception(id):
    data = request.get_json()
    confirmed_by = data.get('confirmed_by')
    confirmation_note = data.get('confirmation_note')
    resolve_exception = data.get('resolve_exception', False)
    resolution_note = data.get('resolution_note')
    conf = ConfirmationService.confirm_exception(
        id, confirmed_by, confirmation_note,
        resolve_exception, resolution_note
    )
    db.session.commit()
    return jsonify({
        'status': 'success',
        'confirmation_id': conf.id,
        'exception_status': '已确认' if not resolve_exception else '已解决'
    })


@bp.route('/<int:id>/resolve', methods=['POST'])
def resolve_exception(id):
    data = request.get_json()
    resolved_by = data.get('resolved_by')
    resolution_note = data.get('resolution_note')
    exc = RepairException.query.get_or_404(id)
    StatusService.change_exception_status(
        exc,
        '已解决',
        change_reason=resolution_note or '例外已解决',
        operated_by=resolved_by
    )
    exc.resolved_at = datetime.now()
    exc.resolved_by = resolved_by
    exc.resolution_note = resolution_note
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/check', methods=['POST'])
def run_exception_checks():
    results = ExceptionService.run_all_exception_checks()
    db.session.commit()
    return jsonify({
        'spare_part_delays': len(results['spare_part_delays']),
        'duplicate_repairs': len(results['duplicate_repairs']),
        'not_returned_before_performance': len(results['not_returned_before_performance'])
    })


@bp.route('/check/spare-delay/<int:spare_order_id>', methods=['POST'])
def check_spare_delay(spare_order_id):
    exc = ExceptionService.detect_spare_part_delay(spare_order_id)
    db.session.commit()
    if exc:
        return jsonify({
            'status': 'exception_detected',
            'exception_id': exc.id,
            'description': exc.description
        })
    return jsonify({'status': 'no_exception'})


@bp.route('/check/duplicate-repair/<int:instrument_id>', methods=['POST'])
def check_duplicate_repair(instrument_id):
    result = ExceptionService.detect_duplicate_repair(instrument_id)
    db.session.commit()
    if result:
        return jsonify({
            'status': 'exception_detected',
            'count': len(result),
            'orders': [{'id': o.id, 'order_no': o.order_no, 'status': o.status.value} for o in result]
        })
    return jsonify({'status': 'no_exception'})


@bp.route('/check/performance-return', methods=['POST'])
def check_performance_return():
    results = ExceptionService.detect_not_returned_before_performance()
    db.session.commit()
    return jsonify({
        'count': len(results),
        'exceptions': [
            {'id': e.id, 'description': e.description} for e in results
        ]
    })


from datetime import datetime
