from flask import Blueprint, request, jsonify
from models import db, Instrument
from schemas import InstrumentSchema
from datetime import datetime

bp = Blueprint('instruments', __name__, url_prefix='/api/instruments')

instrument_schema = InstrumentSchema()
instruments_schema = InstrumentSchema(many=True)


def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str


@bp.route('', methods=['GET'])
def list_instruments():
    category = request.args.get('category')
    status = request.args.get('status')
    query = Instrument.query
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)
    items = query.order_by(Instrument.created_at.desc()).all()
    result = instruments_schema.dump(items)
    for i, item in enumerate(result):
        item['fault_record_count'] = items[i].fault_records.count()
        item['active_repair_count'] = items[i].repair_orders.filter(
            Instrument.status.notin_(['可用', '已归还', '已取消'])
        ).count() if items[i].repair_orders else 0
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_instrument():
    data = request.get_json()
    data['purchase_date'] = parse_date(data.get('purchase_date'))
    instrument = instrument_schema.load(data, session=db.session)
    db.session.add(instrument)
    db.session.commit()
    return jsonify(instrument_schema.dump(instrument)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_instrument(id):
    item = Instrument.query.get_or_404(id)
    result = instrument_schema.dump(item)
    result['fault_records'] = [{'id': fr.id, 'description': fr.description,
                                'fault_date': str(fr.fault_date), 'is_resolved': fr.is_resolved}
                               for fr in item.fault_records.order_by('fault_date').all()]
    result['repair_orders'] = [{'id': ro.id, 'order_no': ro.order_no,
                                'status': ro.status.value, 'created_at': str(ro.created_at)}
                               for ro in item.repair_orders.order_by('created_at').all()]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_instrument(id):
    item = Instrument.query.get_or_404(id)
    data = request.get_json()
    data['purchase_date'] = parse_date(data.get('purchase_date'))
    instrument = instrument_schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(instrument_schema.dump(instrument))


@bp.route('/<int:id>', methods=['DELETE'])
def delete_instrument(id):
    item = Instrument.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204
