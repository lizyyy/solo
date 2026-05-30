from flask import Blueprint, request, jsonify
from models import db, SparePart, SparePartOrder
from schemas import SparePartSchema, SparePartOrderSchema
from datetime import datetime
from services.status_service import StatusService

bp = Blueprint('spare_parts', __name__, url_prefix='/api/spare-parts')

sp_schema = SparePartSchema()
sp_schemas = SparePartSchema(many=True)
spo_schema = SparePartOrderSchema()
spo_schemas = SparePartOrderSchema(many=True)


def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, str):
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_str


@bp.route('', methods=['GET'])
def list_spare_parts():
    category = request.args.get('category')
    low_stock = request.args.get('low_stock')
    query = SparePart.query
    if category:
        query = query.filter_by(category=category)
    if low_stock and low_stock.lower() == 'true':
        query = query.filter(SparePart.stock_quantity <= SparePart.safety_stock)
    items = query.order_by(SparePart.updated_at.desc()).all()
    result = sp_schemas.dump(items)
    for i, item in enumerate(result):
        item['pending_order_count'] = items[i].orders.filter(
            SparePartOrder.status.in_(['已下单', '运输中', '已延误'])
        ).count()
    return jsonify(result)


@bp.route('', methods=['POST'])
def create_spare_part():
    data = request.get_json()
    item = sp_schema.load(data, session=db.session)
    db.session.add(item)
    db.session.commit()
    return jsonify(sp_schema.dump(item)), 201


@bp.route('/<int:id>', methods=['GET'])
def get_spare_part(id):
    item = SparePart.query.get_or_404(id)
    result = sp_schema.dump(item)
    result['orders'] = [{'id': o.id, 'order_no': o.order_no, 'quantity': o.quantity,
                         'status': o.status.value, 'expected_arrival_date': str(o.expected_arrival_date)}
                        for o in item.orders.order_by('order_date').all()]
    return jsonify(result)


@bp.route('/<int:id>', methods=['PUT'])
def update_spare_part(id):
    item = SparePart.query.get_or_404(id)
    data = request.get_json()
    item = sp_schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(sp_schema.dump(item))


@bp.route('/<int:id>', methods=['DELETE'])
def delete_spare_part(id):
    item = SparePart.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@bp.route('/orders', methods=['GET'])
def list_spare_part_orders():
    status = request.args.get('status')
    repair_order_id = request.args.get('repair_order_id', type=int)
    query = SparePartOrder.query
    if status:
        query = query.filter_by(status=status)
    if repair_order_id:
        query = query.filter_by(repair_order_id=repair_order_id)
    items = query.order_by(SparePartOrder.order_date.desc()).all()
    result = spo_schemas.dump(items)
    for i, item in enumerate(result):
        item['spare_part_name'] = items[i].spare_part.name if items[i].spare_part else None
    return jsonify(result)


@bp.route('/orders', methods=['POST'])
def create_spare_part_order():
    data = request.get_json()
    data['order_date'] = parse_date(data.get('order_date')) or datetime.now().date()
    data['expected_arrival_date'] = parse_date(data.get('expected_arrival_date'))
    data['actual_arrival_date'] = parse_date(data.get('actual_arrival_date'))
    item = spo_schema.load(data, session=db.session)
    db.session.add(item)
    db.session.flush()

    StatusService._record_history(
        entity_type="SparePartOrder",
        entity_id=item.id,
        from_status=None,
        to_status=item.status.value,
        change_reason="创建备件订单",
        operated_by=data.get('operated_by')
    )

    db.session.commit()
    return jsonify(spo_schema.dump(item)), 201


@bp.route('/orders/<int:id>', methods=['GET'])
def get_spare_part_order(id):
    item = SparePartOrder.query.get_or_404(id)
    result = spo_schema.dump(item)
    result['spare_part_name'] = item.spare_part.name if item.spare_part else None
    result['status_history'] = [{'id': h.id, 'from_status': h.from_status,
                                 'to_status': h.to_status, 'change_reason': h.change_reason,
                                 'created_at': str(h.created_at), 'operated_by': h.operated_by}
                                for h in item.status_histories.order_by('created_at').all()]
    return jsonify(result)


@bp.route('/orders/<int:id>', methods=['PUT'])
def update_spare_part_order(id):
    item = SparePartOrder.query.get_or_404(id)
    data = request.get_json()
    old_status = item.status.value

    if 'expected_arrival_date' in data:
        data['expected_arrival_date'] = parse_date(data.get('expected_arrival_date'))
    if 'actual_arrival_date' in data:
        data['actual_arrival_date'] = parse_date(data.get('actual_arrival_date'))
    if 'order_date' in data:
        data['order_date'] = parse_date(data.get('order_date'))

    if 'status' in data and data['status'] != old_status:
        StatusService.change_spare_part_order_status(
            item,
            data['status'],
            change_reason=data.get('change_reason', '更新订单状态'),
            operated_by=data.get('operated_by')
        )
        del data['status']

    item = spo_schema.load(data, instance=item, session=db.session, partial=True)
    db.session.commit()
    return jsonify(spo_schema.dump(item))


@bp.route('/orders/<int:id>/status', methods=['PUT'])
def change_order_status(id):
    item = SparePartOrder.query.get_or_404(id)
    data = request.get_json()
    new_status = data.get('status')
    change_reason = data.get('change_reason', '更新订单状态')
    operated_by = data.get('operated_by')

    from services.exception_service import ExceptionService
    result = StatusService.change_spare_part_order_status(
        item, new_status, change_reason, operated_by
    )

    if new_status in ['已到货', '已领用']:
        item.actual_arrival_date = item.actual_arrival_date or datetime.now().date()
        if new_status == '已领用' and item.spare_part_id:
            item.spare_part.stock_quantity += item.quantity

    ExceptionService.detect_spare_part_delay(id)
    db.session.commit()
    return jsonify(spo_schema.dump(item))


@bp.route('/orders/<int:id>/history', methods=['GET'])
def get_order_history(id):
    histories = StatusService.get_entity_history('SparePartOrder', id)
    return jsonify([{
        'id': h.id,
        'from_status': h.from_status,
        'to_status': h.to_status,
        'change_reason': h.change_reason,
        'operated_by': h.operated_by,
        'created_at': str(h.created_at)
    } for h in histories])
