from flask import Blueprint, request, jsonify
from models import db, Performance, PerformanceInstrument
from schemas import PerformanceSchema
from datetime import datetime

bp = Blueprint('performances', __name__, url_prefix='/api/performances')

schema = PerformanceSchema()
schemas = PerformanceSchema(many=True)


def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str


def parse_time(time_str):
    if not time_str:
        return None
    if isinstance(time_str, str):
        for fmt in ['%H:%M', '%H:%M:%S']:
            try:
                return datetime.strptime(time_str, fmt).time()
            except ValueError:
                continue
    return time_str


@bp.route('', methods=['GET'])
def list_performances():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    city = request.args.get('city')
    query = Performance.query
    if start_date:
        query = query.filter(Performance.performance_date >= parse_date(start_date))
    if end_date:
        query = query.filter(Performance.performance_date <= parse_date(end_date))
    if city:
        query = query.filter_by(city=city)
    items = query.order_by(Performance.performance_date.asc()).all()
    result = schemas.dump(items)
    for i, item in enumerate(result):
        item['required_instrument_count'] = items[i].required_instruments.count()
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_performance():
    data = request.get_json()
    data['performance_date'] = parse_date(data.get('performance_date'))
    data['performance_time'] = parse_time(data.get('performance_time'))

    instruments_data = data.pop('required_instruments', [])

    performance = Performance(
        name=data['name'],
        performance_date=data['performance_date'],
        performance_time=data.get('performance_time'),
        venue=data.get('venue', ''),
        city=data.get('city'),
        program=data.get('program'),
        conductor=data.get('conductor'),
        remarks=data.get('remarks')
    )
    db.session.add(performance)
    db.session.flush()

    for inst in instruments_data:
        pi = PerformanceInstrument(
            performance_id=performance.id,
            instrument_id=inst['instrument_id'],
            player=inst.get('player'),
            call_time=parse_time(inst.get('call_time')),
            remarks=inst.get('remarks')
        )
        db.session.add(pi)

    db.session.commit()
    return jsonify(schema.dump(performance)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_performance(id):
    item = Performance.query.get_or_404(id)
    result = schema.dump(item)
    result['required_instruments'] = [
        {
            'id': pi.id,
            'instrument_id': pi.instrument_id,
            'instrument_name': pi.instrument.name if pi.instrument else None,
            'instrument_status': pi.instrument.status.value if pi.instrument else None,
            'player': pi.player,
            'call_time': str(pi.call_time) if pi.call_time else None,
            'remarks': pi.remarks
        }
        for pi in item.required_instruments.all()
    ]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_performance(id):
    item = Performance.query.get_or_404(id)
    data = request.get_json()
    if 'performance_date' in data:
        data['performance_date'] = parse_date(data.get('performance_date'))
    if 'performance_time' in data:
        data['performance_time'] = parse_time(data.get('performance_time'))

    if 'required_instruments' in data:
        instruments_data = data.pop('required_instruments')
        PerformanceInstrument.query.filter_by(performance_id=id).delete()
        for inst in instruments_data:
            pi = PerformanceInstrument(
                performance_id=id,
                instrument_id=inst['instrument_id'],
                player=inst.get('player'),
                call_time=parse_time(inst.get('call_time')),
                remarks=inst.get('remarks')
            )
            db.session.add(pi)

    item = schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(schema.dump(item))


@bp.route('/<int:id>', methods=['DELETE'])
def delete_performance(id):
    item = Performance.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204
