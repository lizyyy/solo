from flask import Blueprint, request
from app import db
from app.models import (
    MedicationInventory, InventoryDeduction, Nurse, ManualCorrection
)
from app.utils import (
    success_response, error_response, validate_request,
    generate_request_id, get_current_user, parse_date
)
from datetime import datetime

bp = Blueprint('inventory', __name__)


@bp.route('', methods=['GET'])
def list_inventory():
    medication_name = request.args.get('medication_name')
    
    query = MedicationInventory.query
    if medication_name:
        query = query.filter(MedicationInventory.medication_name.contains(medication_name))
    
    items = query.all()
    return success_response([i.to_dict() for i in items])


@bp.route('/<inventory_id>', methods=['GET'])
def get_inventory(inventory_id):
    inventory = MedicationInventory.query.get(inventory_id)
    if not inventory:
        return error_response('库存记录不存在', 404, 'NOT_FOUND')
    
    include_history = request.args.get('history', 'false').lower() == 'true'
    return success_response(inventory.to_dict(include_history=include_history))


@bp.route('', methods=['POST'])
@validate_request(['id', 'medication_name', 'quantity', 'unit'])
def create_inventory():
    data = request.get_json()
    
    if MedicationInventory.query.get(data['id']):
        return error_response('库存ID已存在', 409, 'DUPLICATE_ID')
    
    inventory = MedicationInventory(
        id=data['id'],
        medication_name=data['medication_name'],
        batch_number=data.get('batch_number'),
        quantity=int(data['quantity']),
        unit=data['unit'],
        expiry_date=parse_date(data.get('expiry_date')),
        location=data.get('location')
    )
    
    db.session.add(inventory)
    db.session.commit()
    
    return success_response(inventory.to_dict(), '库存创建成功', 201)


@bp.route('/<inventory_id>/adjust', methods=['POST'])
@validate_request(['request_id', 'quantity', 'nurse_id', 'reason'])
def adjust_inventory(inventory_id):
    data = request.get_json()
    request_id = data['request_id']
    
    existing = InventoryDeduction.query.filter_by(request_id=request_id).first()
    if existing:
        return success_response({
            'is_idempotent': True,
            'existing_deduction': existing.to_dict()
        }, '重复请求，返回已存在的调整记录（幂等性保证）')
    
    inventory = MedicationInventory.query.get(inventory_id)
    if not inventory:
        return error_response('库存记录不存在', 404, 'NOT_FOUND')
    
    if not Nurse.query.get(data['nurse_id']):
        return error_response('护理员不存在', 400, 'NURSE_NOT_FOUND')
    
    quantity = int(data['quantity'])
    old_quantity = inventory.quantity
    
    if quantity < 0 and inventory.quantity + quantity < 0:
        return error_response(
            f'库存不足：当前 {inventory.quantity}，调整 {quantity} 后将为负数',
            400, 'INVENTORY_SHORTAGE'
        )
    
    deduction = InventoryDeduction(
        request_id=request_id,
        inventory_id=inventory_id,
        quantity=abs(quantity),
        nurse_id=data['nurse_id'],
        reason=f'{"出库" if quantity < 0 else "入库"}: {data["reason"]}'
    )
    db.session.add(deduction)
    
    inventory.quantity += quantity
    
    user_id, user_name = get_current_user()
    correction = ManualCorrection(
        request_id=generate_request_id(),
        corrected_by=user_id,
        corrected_by_name=user_name,
        target_model='MedicationInventory',
        target_id=inventory_id,
        field_name='quantity',
        old_value=str(old_quantity),
        new_value=str(inventory.quantity),
        reason=data['reason']
    )
    db.session.add(correction)
    
    db.session.commit()
    
    return success_response({
        'inventory': inventory.to_dict(),
        'adjustment': {
            'old_quantity': old_quantity,
            'new_quantity': inventory.quantity,
            'change': quantity
        },
        'deduction_record': deduction.to_dict()
    }, f'库存调整成功（{quantity:+}）')


@bp.route('/alerts', methods=['GET'])
def get_low_inventory():
    threshold = request.args.get('threshold', 5, type=int)
    items = MedicationInventory.query.filter(
        MedicationInventory.quantity <= threshold
    ).all()
    
    return success_response({
        'threshold': threshold,
        'items': [i.to_dict() for i in items]
    })
