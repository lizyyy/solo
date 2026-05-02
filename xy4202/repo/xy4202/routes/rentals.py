from flask import Blueprint, request, jsonify
from extensions import db
from models.models import Rental, Member, Equipment, Site, Inventory, EquipmentType, AuditLog
from datetime import datetime, timedelta

rentals = Blueprint('rentals', __name__)

def generate_rental_number():
    current_time = datetime.now()
    return f"R{current_time.strftime('%Y%m%d%H%M%S')}"

def calculate_rental_fee(start_date, end_date, daily_fee):
    days = (end_date - start_date).days + 1
    return days * daily_fee

def calculate_late_fee(expected_return_date, actual_return_date, late_fee_per_day):
    if actual_return_date <= expected_return_date:
        return 0.0
    days_overdue = (actual_return_date - expected_return_date).days
    return days_overdue * late_fee_per_day

def create_audit_log(action, target_type, target_id, details, operator='system'):
    audit = AuditLog(
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        operator=operator
    )
    db.session.add(audit)

@rentals.route('/', methods=['GET'])
def get_rentals():
    rental_list = Rental.query.all()
    return jsonify([r.to_dict() for r in rental_list]), 200

@rentals.route('/<int:rental_id>', methods=['GET'])
def get_rental(rental_id):
    rental = Rental.query.get_or_404(rental_id)
    return jsonify(rental.to_dict()), 200

@rentals.route('/', methods=['POST'])
def create_rental():
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['member_id', 'equipment_id', 'site_id', 'start_date', 'expected_return_date']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} 不能为空'}), 400
    
    # 验证会员存在
    member = Member.query.get(data['member_id'])
    if not member:
        return jsonify({'error': '会员不存在'}), 404
    
    # 检查会员黑名单
    if member.is_blacklisted:
        return jsonify({
            'error': '会员在黑名单中，无法借出',
            'reason': member.blacklist_reason
        }), 400
    
    # 验证设备存在
    equipment = Equipment.query.get(data['equipment_id'])
    if not equipment:
        return jsonify({'error': '设备不存在'}), 404
    
    # 检查设备状态
    if equipment.status != 'available':
        return jsonify({'error': f'设备状态为 {equipment.status}，无法借出'}), 400
    
    # 检查设备是否在维修封存中
    from models.models import Maintenance
    active_maintenance = Maintenance.query.filter(
        Maintenance.equipment_id == equipment.id,
        Maintenance.status == 'in_progress'
    ).first()
    
    if active_maintenance:
        return jsonify({
            'error': '设备正在维修或封存中',
            'maintenance_type': active_maintenance.maintenance_type,
            'reason': active_maintenance.reason
        }), 400
    
    # 验证站点存在
    site = Site.query.get(data['site_id'])
    if not site:
        return jsonify({'error': '站点不存在'}), 404
    
    # 检查库存
    inventory = Inventory.query.filter_by(
        site_id=data['site_id'],
        equipment_id=data['equipment_id']
    ).first()
    
    if not inventory:
        return jsonify({'error': '该站点没有此设备的库存记录'}), 400
    
    if inventory.available_quantity < 1:
        return jsonify({'error': '该设备库存不足'}), 400
    
    # 解析日期
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        expected_return_date = datetime.strptime(data['expected_return_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    # 验证归还日期不早于借出日期
    if expected_return_date < start_date:
        return jsonify({'error': '预计归还日期不能早于借出日期'}), 400
    
    # 获取设备类型的费用规则
    eq_type = EquipmentType.query.get(equipment.equipment_type_id)
    if not eq_type:
        return jsonify({'error': '设备类型不存在'}), 404
    
    # 校验押金
    expected_deposit = eq_type.deposit_amount
    deposit_paid = data.get('deposit_paid', 0.0)
    
    if deposit_paid < expected_deposit:
        return jsonify({
            'error': '押金金额不足',
            'expected_deposit': expected_deposit,
            'actual_deposit': deposit_paid
        }), 400
    
    # 计算租金
    rental_fee = calculate_rental_fee(start_date, expected_return_date, eq_type.daily_rental_fee)
    
    # 生成借出编号
    rental_number = generate_rental_number()
    
    rental = Rental(
        rental_number=rental_number,
        member_id=data['member_id'],
        equipment_id=data['equipment_id'],
        site_id=data['site_id'],
        booking_id=data.get('booking_id'),
        start_date=start_date,
        expected_return_date=expected_return_date,
        deposit_paid=deposit_paid,
        rental_fee=rental_fee,
        late_fee=0.0,
        total_fee=rental_fee,
        status='active',
        notes=data.get('notes')
    )
    
    # 更新库存和设备状态
    inventory.available_quantity -= 1
    equipment.status = 'in_use'
    
    db.session.add(rental)
    db.session.flush()  # 刷新以获取 rental.id
    
    # 创建审计日志
    details = f"借出设备: {equipment.name}, 会员: {member.name}, 押金: {deposit_paid}, 租金: {rental_fee}"
    create_audit_log('create', 'Rental', rental.id, details)
    
    db.session.commit()
    
    return jsonify(rental.to_dict()), 201

@rentals.route('/<int:rental_id>/return', methods=['POST'])
def return_equipment(rental_id):
    rental = Rental.query.get_or_404(rental_id)
    data = request.get_json()
    
    # 检查是否已归还
    if rental.status == 'returned':
        return jsonify({'error': '该借出记录已归还'}), 400
    
    # 解析实际归还日期
    if data.get('actual_return_date'):
        try:
            actual_return_date = datetime.strptime(data['actual_return_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    else:
        actual_return_date = datetime.now().date()
    
    # 获取设备类型的费用规则
    equipment = Equipment.query.get(rental.equipment_id)
    eq_type = EquipmentType.query.get(equipment.equipment_type_id)
    
    # 计算逾期费用
    late_fee = calculate_late_fee(
        rental.expected_return_date,
        actual_return_date,
        eq_type.late_fee_per_day
    )
    
    # 更新借出记录
    rental.actual_return_date = actual_return_date
    rental.late_fee = late_fee
    rental.total_fee = rental.rental_fee + late_fee
    rental.status = 'returned'
    
    # 更新设备状态和库存
    equipment.status = 'available'
    
    inventory = Inventory.query.filter_by(
        site_id=rental.site_id,
        equipment_id=rental.equipment_id
    ).first()
    
    if inventory:
        inventory.available_quantity += 1
    
    # 创建审计日志
    member = Member.query.get(rental.member_id)
    details = f"归还设备: {equipment.name}, 会员: {member.name}, 逾期天数: {(actual_return_date - rental.expected_return_date).days if actual_return_date > rental.expected_return_date else 0}, 逾期费用: {late_fee}"
    create_audit_log('return', 'Rental', rental.id, details)
    
    db.session.commit()
    
    return jsonify({
        'rental': rental.to_dict(),
        'summary': {
            'original_rental_fee': rental.rental_fee,
            'late_fee': late_fee,
            'total_fee': rental.total_fee,
            'deposit_paid': rental.deposit_paid,
            'refund_amount': rental.deposit_paid - rental.total_fee if rental.deposit_paid > rental.total_fee else 0
        }
    }), 200

@rentals.route('/overdue', methods=['GET'])
def get_overdue_rentals():
    today = datetime.now().date()
    overdue_rentals = Rental.query.filter(
        Rental.status == 'active',
        Rental.expected_return_date < today
    ).all()
    
    # 更新状态为overdue
    for rental in overdue_rentals:
        rental.status = 'overdue'
    
    db.session.commit()
    
    return jsonify([r.to_dict() for r in overdue_rentals]), 200
