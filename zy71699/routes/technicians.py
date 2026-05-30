from flask import Blueprint, request, jsonify
from models import db, Technician, TechnicianSchedule
from schemas import TechnicianSchema, TechnicianScheduleSchema
from datetime import datetime

bp = Blueprint('technicians', __name__, url_prefix='/api/technicians')

tech_schema = TechnicianSchema()
tech_schemas = TechnicianSchema(many=True)
sched_schema = TechnicianScheduleSchema()
sched_schemas = TechnicianScheduleSchema(many=True)


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
def list_technicians():
    is_active = request.args.get('is_active')
    specialty = request.args.get('specialty')
    query = Technician.query
    if is_active is not None:
        query = query.filter_by(is_active=(is_active.lower() == 'true'))
    if specialty:
        query = query.filter(Technician.specialty.like(f'%{specialty}%'))
    items = query.order_by(Technician.name.asc()).all()
    result = tech_schemas.dump(items)
    for i, item in enumerate(result):
        item['active_repair_count'] = items[i].repair_orders.filter(
            Technician.status.notin_(['已归还', '已取消'])
        ).count()
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_technician():
    data = request.get_json()
    item = tech_schema.load(data, session=db.session)
    db.session.add(item)
    db.session.commit()
    return jsonify(tech_schema.dump(item)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_technician(id):
    item = Technician.query.get_or_404(id)
    result = tech_schema.dump(item)
    result['repair_orders'] = [{'id': ro.id, 'order_no': ro.order_no, 'status': ro.status.value,
                                'instrument': ro.instrument.name if ro.instrument else None,
                                'created_at': str(ro.created_at)}
                               for ro in item.repair_orders.order_by('created_at').all()]
    result['schedules'] = [{'id': s.id, 'schedule_date': str(s.schedule_date), 'shift_type': s.shift_type,
                            'is_on_leave': s.is_on_leave}
                           for s in item.schedules.order_by('schedule_date').all()]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_technician(id):
    item = Technician.query.get_or_404(id)
    data = request.get_json()
    item = tech_schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(tech_schema.dump(item))


@bp.route('/<int:id>', methods=['DELETE'])
def delete_technician(id):
    item = Technician.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@bp.route('/schedules', methods=['GET'])
def list_schedules():
    technician_id = request.args.get('technician_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    query = TechnicianSchedule.query
    if technician_id:
        query = query.filter_by(technician_id=technician_id)
    if start_date:
        query = query.filter(TechnicianSchedule.schedule_date >= parse_date(start_date))
    if end_date:
        query = query.filter(TechnicianSchedule.schedule_date <= parse_date(end_date))
    items = query.order_by(TechnicianSchedule.schedule_date.asc()).all()
    result = sched_schemas.dump(items)
    for i, item in enumerate(result):
        item['technician_name'] = items[i].technician.name if items[i].technician else None
    return jsonify(result)


@bp.route('/schedules', methods=['POST'])
def create_schedule():
    data = request.get_json()
    data['schedule_date'] = parse_date(data.get('schedule_date'))
    data['start_time'] = parse_time(data.get('start_time'))
    data['end_time'] = parse_time(data.get('end_time'))
    item = sched_schema.load(data, session=db.session)
    db.session.add(item)
    db.session.commit()
    return jsonify(sched_schema.dump(item)), 201


@bp.route('/schedules/<int:id>', methods=['PUT'])
def update_schedule(id):
    item = TechnicianSchedule.query.get_or_404(id)
    data = request.get_json()
    if 'schedule_date' in data:
        data['schedule_date'] = parse_date(data.get('schedule_date'))
    if 'start_time' in data:
        data['start_time'] = parse_time(data.get('start_time'))
    if 'end_time' in data:
        data['end_time'] = parse_time(data.get('end_time'))
    item = sched_schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(sched_schema.dump(item))
