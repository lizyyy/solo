from flask import Blueprint, request, jsonify
from models import db, RepairOrder, SparePartUsage
from schemas import RepairOrderSchema, SparePartUsageSchema, StatusHistorySchema
from datetime import datetime
from services.repair_service import RepairService
from services.status_service import StatusService
from services.confirmation_service import ConfirmationService
from services.exception_service import ExceptionService

bp = Blueprint('repair_orders', __name__, url_prefix='/api/repair-orders')

schema = RepairOrderSchema()
schemas = RepairOrderSchema(many=True)
usage_schema = SparePartUsageSchema()
history_schema = StatusHistorySchema()


def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str


@bp.route('', methods=['GET'])
def list_repair_orders():
    status = request.args.get('status')
    instrument_id = request.args.get('instrument_id', type=int)
    technician_id = request.args.get('technician_id', type=int)
    priority = request.args.get('priority')
    query = RepairOrder.query
    if status:
        query = query.filter_by(status=status)
    if instrument_id:
        query = query.filter_by(instrument_id=instrument_id)
    if technician_id:
        query = query.filter_by(technician_id=technician_id)
    if priority:
        query = query.filter_by(priority=priority)
    items = query.order_by(RepairOrder.created_at.desc()).all()
    result = schemas.dump(items)
    for i, item in enumerate(result):
        item['instrument_name'] = items[i].instrument.name if items[i].instrument else None
        item['technician_name'] = items[i].technician.name if items[i].technician else None
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_repair_order():
    data = request.get_json()
    operated_by = data.get('operated_by')
    order = RepairService.create_repair_order(data, created_by=operated_by)
    db.session.commit()
    return jsonify(schema.dump(order)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_repair_order(id):
    item = RepairOrder.query.get_or_404(id)
    result = schema.dump(item)
    result['instrument_name'] = item.instrument.name if item.instrument else None
    result['technician_name'] = item.technician.name if item.technician else None
    result['fault_record'] = {
        'id': item.fault_record.id,
        'description': item.fault_record.description,
        'fault_date': str(item.fault_record.fault_date),
        'reporter': item.fault_record.reporter
    } if item.fault_record else None

    confirmations = ConfirmationService.get_confirmation_history(repair_order_id=id)
    result['confirmations'] = [{
        'id': c.id,
        'confirmation_type': c.confirmation_type.value,
        'confirmed_at': str(c.confirmed_at),
        'confirmed_by': c.confirmed_by,
        'confirmation_note': c.confirmation_note,
        'has_snapshot': c.before_snapshot is not None and c.after_snapshot is not None
    } for c in confirmations]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_repair_order(id):
    item = RepairOrder.query.get_or_404(id)
    data = request.get_json()
    if 'scheduled_start_date' in data:
        data['scheduled_start_date'] = parse_date(data.get('scheduled_start_date'))
    if 'scheduled_complete_date' in data:
        data['scheduled_complete_date'] = parse_date(data.get('scheduled_complete_date'))
    if 'actual_start_date' in data:
        data['actual_start_date'] = parse_date(data.get('actual_start_date'))
    if 'actual_complete_date' in data:
        data['actual_complete_date'] = parse_date(data.get('actual_complete_date'))
    if 'return_deadline' in data:
        data['return_deadline'] = parse_date(data.get('return_deadline'))
    if 'actual_return_date' in data:
        data['actual_return_date'] = parse_date(data.get('actual_return_date'))
    item = schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(schema.dump(item))


@bp.route('/<int:id>/status', methods=['PUT'])
def change_status(id):
    item = RepairOrder.query.get_or_404(id)
    data = request.get_json()
    new_status = data.get('status')
    change_reason = data.get('change_reason', '更新工单状态')
    operated_by = data.get('operated_by')
    StatusService.change_repair_order_status(item, new_status, change_reason, operated_by)
    db.session.commit()
    return jsonify(schema.dump(item))


@bp.route('/<int:id>/assign', methods=['POST'])
def assign_technician(id):
    data = request.get_json()
    technician_id = data.get('technician_id')
    scheduled_start = parse_date(data.get('scheduled_start_date'))
    scheduled_complete = parse_date(data.get('scheduled_complete_date'))
    operated_by = data.get('operated_by')
    order = RepairService.assign_technician(id, technician_id, scheduled_start, scheduled_complete, operated_by)
    db.session.commit()
    return jsonify(schema.dump(order))


@bp.route('/<int:id>/start', methods=['POST'])
def start_repair(id):
    data = request.get_json()
    operated_by = data.get('operated_by')
    order = RepairService.start_repair(id, operated_by)
    db.session.commit()
    return jsonify(schema.dump(order))


@bp.route('/<int:id>/spare-usage', methods=['POST'])
def add_spare_usage(id):
    data = request.get_json()
    spare_part_id = data.get('spare_part_id')
    quantity = data.get('quantity')
    used_by = data.get('used_by')
    remarks = data.get('remarks')
    usage = RepairService.add_spare_part_usage(id, spare_part_id, quantity, used_by, remarks)
    db.session.commit()
    return jsonify(usage_schema.dump(usage)), 201


@bp.route('/<int:id>/spare-order', methods=['POST'])
def create_spare_order(id):
    data = request.get_json()
    spare_part_id = data.get('spare_part_id')
    quantity = data.get('quantity')
    expected_arrival_date = parse_date(data.get('expected_arrival_date'))
    supplier = data.get('supplier')
    operated_by = data.get('operated_by')
    spare_order = RepairService.create_spare_part_order_for_repair(
        id, spare_part_id, quantity, expected_arrival_date, supplier, operated_by)
    db.session.commit()
    return jsonify({'id': spare_order.id, 'order_no': spare_order.order_no}), 201


@bp.route('/<int:id>/complete', methods=['POST'])
def complete_repair(id):
    data = request.get_json()
    confirmed_by = data.get('confirmed_by')
    quality_check_note = data.get('quality_check_note')
    conf = ConfirmationService.confirm_repair_completion(id, confirmed_by, quality_check_note)
    db.session.commit()
    return jsonify({'status': 'success', 'confirmation_id': conf.id})


@bp.route('/<int:id>/return', methods=['POST'])
def return_instrument(id):
    data = request.get_json()
    confirmed_by = data.get('confirmed_by')
    return_note = data.get('return_note')
    conf = ConfirmationService.confirm_instrument_return(id, confirmed_by, return_note)
    db.session.commit()
    return jsonify({'status': 'success', 'confirmation_id': conf.id})


@bp.route('/<int:id>/cancel', methods=['POST'])
def cancel_order(id):
    data = request.get_json()
    cancel_reason = data.get('cancel_reason')
    operated_by = data.get('operated_by')
    order = RepairService.cancel_repair_order(id, cancel_reason, operated_by)
    db.session.commit()
    return jsonify(schema.dump(order))


@bp.route('/<int:id>/history', methods=['GET'])
def get_history(id):
    histories = StatusService.get_entity_history('RepairOrder', id)
    return jsonify([{
        'id': h.id,
        'from_status': h.from_status,
        'to_status': h.to_status,
        'change_reason': h.change_reason,
        'operated_by': h.operated_by,
        'created_at': str(h.created_at)
    } for h in histories])


@bp.route('/<int:id>/exceptions', methods=['GET'])
def get_exceptions(id):
    item = RepairOrder.query.get_or_404(id)
    return jsonify([{
        'id': e.id,
        'exception_type': e.exception_type.value,
        'status': e.status.value,
        'description': e.description,
        'detected_at': str(e.detected_at),
        'acknowledged_by': e.acknowledged_by,
        'acknowledged_at': str(e.acknowledged_at) if e.acknowledged_at else None,
        'acknowledge_note': e.acknowledge_note
    } for e in item.exceptions])
