from flask import Blueprint, request, jsonify
from extensions import db
from models.models import Maintenance, Equipment, Site
from datetime import datetime

maintenance = Blueprint('maintenance', __name__)

@maintenance.route('/', methods=['GET'])
def get_maintenance():
    maintenance_list = Maintenance.query.all()
    return jsonify([m.to_dict() for m in maintenance_list]), 200

@maintenance.route('/<int:maintenance_id>', methods=['GET'])
def get_maintenance_item(maintenance_id):
    maintenance_item = Maintenance.query.get_or_404(maintenance_id)
    return jsonify(maintenance_item.to_dict()), 200

@maintenance.route('/', methods=['POST'])
def create_maintenance():
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['equipment_id', 'site_id', 'start_date', 'maintenance_type', 'reason']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} 不能为空'}), 400
    
    # 验证设备存在
    equipment = Equipment.query.get(data['equipment_id'])
    if not equipment:
        return jsonify({'error': '设备不存在'}), 404
    
    # 验证设备状态 - 只有可用状态的设备可以进入维修/封存
    if equipment.status != 'available':
        return jsonify({'error': f'设备当前状态为 {equipment.status}，无法进行维修/封存'}), 400
    
    # 检查是否已有进行中的维修/封存
    active_maintenance = Maintenance.query.filter(
        Maintenance.equipment_id == equipment.id,
        Maintenance.status == 'in_progress'
    ).first()
    
    if active_maintenance:
        return jsonify({
            'error': '设备已有进行中的维修/封存记录',
            'active_record': active_maintenance.to_dict()
        }), 400
    
    # 验证站点存在
    site = Site.query.get(data['site_id'])
    if not site:
        return jsonify({'error': '站点不存在'}), 404
    
    # 解析日期
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = None
        if data.get('end_date'):
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            if end_date < start_date:
                return jsonify({'error': '结束日期不能早于开始日期'}), 400
    except ValueError:
        return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    # 验证维修类型
    maintenance_type = data['maintenance_type']
    if maintenance_type not in ['maintenance', 'repair', 'storage']:
        return jsonify({'error': '维修类型必须是 maintenance, repair 或 storage'}), 400
    
    maintenance_item = Maintenance(
        equipment_id=data['equipment_id'],
        site_id=data['site_id'],
        maintenance_type=maintenance_type,
        start_date=start_date,
        end_date=end_date,
        reason=data['reason'],
        status=data.get('status', 'in_progress'),
        cost=data.get('cost', 0.0),
        notes=data.get('notes')
    )
    
    # 更新设备状态
    if maintenance_type == 'storage':
        equipment.status = 'maintenance'  # 封存也标记为维修状态
    else:
        equipment.status = 'maintenance'
    
    db.session.add(maintenance_item)
    db.session.commit()
    
    return jsonify(maintenance_item.to_dict()), 201

@maintenance.route('/<int:maintenance_id>', methods=['PUT'])
def update_maintenance(maintenance_id):
    maintenance_item = Maintenance.query.get_or_404(maintenance_id)
    data = request.get_json()
    
    if 'end_date' in data:
        try:
            maintenance_item.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    if 'status' in data:
        maintenance_item.status = data['status']
    
    if 'cost' in data:
        maintenance_item.cost = data['cost']
    
    if 'notes' in data:
        maintenance_item.notes = data['notes']
    
    # 如果状态更新为completed，更新设备状态
    if maintenance_item.status == 'completed':
        equipment = Equipment.query.get(maintenance_item.equipment_id)
        if equipment:
            equipment.status = 'available'
    
    db.session.commit()
    
    return jsonify(maintenance_item.to_dict()), 200

@maintenance.route('/active', methods=['GET'])
def get_active_maintenance():
    active = Maintenance.query.filter_by(status='in_progress').all()
    return jsonify([m.to_dict() for m in active]), 200
