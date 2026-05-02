from flask import Blueprint, request, jsonify
from extensions import db
from models.models import Booking, Member, EquipmentType, Site
from datetime import datetime

bookings = Blueprint('bookings', __name__)

def generate_booking_number():
    current_time = datetime.now()
    return f"B{current_time.strftime('%Y%m%d%H%M%S')}"

@bookings.route('/', methods=['GET'])
def get_bookings():
    booking_list = Booking.query.all()
    return jsonify([b.to_dict() for b in booking_list]), 200

@bookings.route('/<int:booking_id>', methods=['GET'])
def get_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    return jsonify(booking.to_dict()), 200

@bookings.route('/', methods=['POST'])
def create_booking():
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['member_id', 'equipment_type_id', 'site_id', 'start_date', 'end_date']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} 不能为空'}), 400
    
    # 验证会员存在
    member = Member.query.get(data['member_id'])
    if not member:
        return jsonify({'error': '会员不存在'}), 404
    
    # 验证设备类型存在
    eq_type = EquipmentType.query.get(data['equipment_type_id'])
    if not eq_type:
        return jsonify({'error': '设备类型不存在'}), 404
    
    # 验证站点存在
    site = Site.query.get(data['site_id'])
    if not site:
        return jsonify({'error': '站点不存在'}), 404
    
    # 解析日期
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    # 验证结束日期不早于开始日期
    if end_date < start_date:
        return jsonify({'error': '结束日期不能早于开始日期'}), 400
    
    # 检查预约时间重叠
    overlapping = Booking.query.filter(
        Booking.equipment_type_id == data['equipment_type_id'],
        Booking.site_id == data['site_id'],
        Booking.status.in_(['pending', 'confirmed']),
        Booking.start_date <= end_date,
        Booking.end_date >= start_date
    ).first()
    
    if overlapping:
        return jsonify({
            'error': '预约时间冲突',
            'conflicting_booking': overlapping.to_dict()
        }), 400
    
    # 生成预约编号
    booking_number = generate_booking_number()
    
    booking = Booking(
        booking_number=booking_number,
        member_id=data['member_id'],
        equipment_type_id=data['equipment_type_id'],
        site_id=data['site_id'],
        start_date=start_date,
        end_date=end_date,
        status=data.get('status', 'pending'),
        notes=data.get('notes')
    )
    
    db.session.add(booking)
    db.session.commit()
    
    return jsonify(booking.to_dict()), 201

@bookings.route('/<int:booking_id>', methods=['PUT'])
def update_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    data = request.get_json()
    
    if 'status' in data:
        booking.status = data['status']
    if 'notes' in data:
        booking.notes = data['notes']
    
    db.session.commit()
    
    return jsonify(booking.to_dict()), 200

@bookings.route('/<int:booking_id>/cancel', methods=['POST'])
def cancel_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    
    if booking.status == 'completed':
        return jsonify({'error': '已完成的预约不能取消'}), 400
    
    booking.status = 'cancelled'
    db.session.commit()
    
    return jsonify(booking.to_dict()), 200
