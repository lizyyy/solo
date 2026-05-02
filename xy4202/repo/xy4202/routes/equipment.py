from flask import Blueprint, request, jsonify
from extensions import db
from models.models import EquipmentType, Equipment, Inventory, Site
from datetime import datetime

equipment = Blueprint('equipment', __name__)

# 设备类型相关路由
@equipment.route('/types', methods=['GET'])
def get_equipment_types():
    types = EquipmentType.query.all()
    return jsonify([t.to_dict() for t in types]), 200

@equipment.route('/types/<int:type_id>', methods=['GET'])
def get_equipment_type(type_id):
    eq_type = EquipmentType.query.get_or_404(type_id)
    return jsonify(eq_type.to_dict()), 200

@equipment.route('/types', methods=['POST'])
def create_equipment_type():
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': '设备类型名称不能为空'}), 400
    
    eq_type = EquipmentType(
        name=data['name'],
        description=data.get('description'),
        deposit_amount=data.get('deposit_amount', 0.0),
        daily_rental_fee=data.get('daily_rental_fee', 0.0),
        late_fee_per_day=data.get('late_fee_per_day', 0.0)
    )
    
    db.session.add(eq_type)
    db.session.commit()
    
    return jsonify(eq_type.to_dict()), 201

# 设备相关路由
@equipment.route('/items', methods=['GET'])
def get_equipment():
    eq_list = Equipment.query.all()
    return jsonify([eq.to_dict() for eq in eq_list]), 200

@equipment.route('/items/<int:equipment_id>', methods=['GET'])
def get_single_equipment(equipment_id):
    eq = Equipment.query.get_or_404(equipment_id)
    return jsonify(eq.to_dict()), 200

@equipment.route('/items', methods=['POST'])
def create_equipment():
    data = request.get_json()
    
    if not data.get('name') or not data.get('equipment_type_id'):
        return jsonify({'error': '设备名称和类型不能为空'}), 400
    
    eq_type = EquipmentType.query.get(data['equipment_type_id'])
    if not eq_type:
        return jsonify({'error': '设备类型不存在'}), 404
    
    # 解析日期
    purchase_date = None
    if data.get('purchase_date'):
        try:
            purchase_date = datetime.strptime(data['purchase_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    eq = Equipment(
        equipment_type_id=data['equipment_type_id'],
        serial_number=data.get('serial_number'),
        name=data['name'],
        status=data.get('status', 'available'),
        purchase_date=purchase_date,
        notes=data.get('notes')
    )
    
    db.session.add(eq)
    db.session.commit()
    
    return jsonify(eq.to_dict()), 201

@equipment.route('/items/<int:equipment_id>', methods=['PUT'])
def update_equipment(equipment_id):
    eq = Equipment.query.get_or_404(equipment_id)
    data = request.get_json()
    
    if 'name' in data:
        eq.name = data['name']
    if 'status' in data:
        eq.status = data['status']
    if 'notes' in data:
        eq.notes = data['notes']
    
    db.session.commit()
    
    return jsonify(eq.to_dict()), 200

# 库存相关路由
@equipment.route('/inventory', methods=['GET'])
def get_inventory():
    inventory_list = Inventory.query.all()
    return jsonify([inv.to_dict() for inv in inventory_list]), 200

@equipment.route('/inventory/<int:inventory_id>', methods=['GET'])
def get_inventory_item(inventory_id):
    inv = Inventory.query.get_or_404(inventory_id)
    return jsonify(inv.to_dict()), 200

@equipment.route('/inventory', methods=['POST'])
def create_inventory():
    data = request.get_json()
    
    if not data.get('site_id') or not data.get('equipment_id'):
        return jsonify({'error': '站点和设备不能为空'}), 400
    
    # 检查是否已存在
    existing = Inventory.query.filter_by(
        site_id=data['site_id'],
        equipment_id=data['equipment_id']
    ).first()
    
    if existing:
        return jsonify({'error': '该设备在该站点已有库存记录'}), 400
    
    inv = Inventory(
        site_id=data['site_id'],
        equipment_id=data['equipment_id'],
        quantity=data.get('quantity', 1),
        available_quantity=data.get('available_quantity', 1),
        location=data.get('location')
    )
    
    db.session.add(inv)
    db.session.commit()
    
    return jsonify(inv.to_dict()), 201

@equipment.route('/inventory/<int:inventory_id>', methods=['PUT'])
def update_inventory(inventory_id):
    inv = Inventory.query.get_or_404(inventory_id)
    data = request.get_json()
    
    if 'quantity' in data:
        inv.quantity = data['quantity']
    if 'available_quantity' in data:
        inv.available_quantity = data['available_quantity']
    if 'location' in data:
        inv.location = data['location']
    
    db.session.commit()
    
    return jsonify(inv.to_dict()), 200
