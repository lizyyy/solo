from flask import Blueprint, request, jsonify
from models import db, FaultRecord
from schemas import FaultRecordSchema
from datetime import datetime

bp = Blueprint('fault_records', __name__, url_prefix='/api/fault-records')

schema = FaultRecordSchema()
schemas = FaultRecordSchema(many=True)


def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str


@bp.route('', methods=['GET'])
def list_fault_records():
    instrument_id = request.args.get('instrument_id', type=int)
    is_resolved = request.args.get('is_resolved')
    query = FaultRecord.query
    if instrument_id:
        query = query.filter_by(instrument_id=instrument_id)
    if is_resolved is not None:
        query = query.filter_by(is_resolved=(is_resolved.lower() == 'true'))
    items = query.order_by(FaultRecord.fault_date.desc()).all()
    result = schemas.dump(items)
    for i, item in enumerate(result):
        item['instrument_name'] = items[i].instrument.name if items[i].instrument else None
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_fault_record():
    data = request.get_json()
    data['fault_date'] = parse_date(data.get('fault_date')) or datetime.now().date()
    item = schema.load(data, session=db.session)
    db.session.add(item)
    db.session.commit()
    return jsonify(schema.dump(item)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_fault_record(id):
    item = FaultRecord.query.get_or_404(id)
    result = schema.dump(item)
    result['instrument_name'] = item.instrument.name if item.instrument else None
    result['repair_orders'] = [{'id': ro.id, 'order_no': ro.order_no, 'status': ro.status.value}
                               for ro in item.repair_orders.all()]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_fault_record(id):
    item = FaultRecord.query.get_or_404(id)
    data = request.get_json()
    data['fault_date'] = parse_date(data.get('fault_date'))
    item = schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(schema.dump(item))


@bp.route('/<int:id>', methods=['DELETE'])
def delete_fault_record(id):
    item = FaultRecord.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204
