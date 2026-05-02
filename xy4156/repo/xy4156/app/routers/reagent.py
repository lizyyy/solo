from flask import Blueprint, request, jsonify
from app import db
from app.models import ReagentLedger, Batch, Bottle, Cabinet, HazardClass
from app.rules import CompatibilityRule, ValidationResult
from app.audit_log import AuditLogger
from datetime import datetime
import json

bp = Blueprint('reagent', __name__, url_prefix='/api/reagent')


@bp.route('/ledger', methods=['GET'])
def get_ledgers():
    ledgers = ReagentLedger.query.all()
    return jsonify([{
        'id': l.id,
        'reagent_name': l.reagent_name,
        'cas_number': l.cas_number,
        'hazard_class': l.hazard_class.value,
        'hazard_details': l.hazard_details,
        'incompatible_with': l.incompatible_with,
        'is_low_temp': l.is_low_temp,
        'min_temp': l.min_temp,
        'max_temp': l.max_temp,
        'created_at': l.created_at.isoformat() if l.created_at else None,
        'updated_at': l.updated_at.isoformat() if l.updated_at else None
    } for l in ledgers])


@bp.route('/ledger', methods=['POST'])
def create_ledger():
    data = request.get_json()
    
    try:
        hazard_class = HazardClass(data['hazard_class']) if 'hazard_class' in data else HazardClass.ORDINARY
    except ValueError:
        hazard_class = HazardClass.ORDINARY
    
    ledger = ReagentLedger(
        reagent_name=data['reagent_name'],
        cas_number=data.get('cas_number'),
        hazard_class=hazard_class,
        hazard_details=data.get('hazard_details'),
        incompatible_with=data.get('incompatible_with'),
        is_low_temp=data.get('is_low_temp', False),
        min_temp=data.get('min_temp'),
        max_temp=data.get('max_temp')
    )
    
    db.session.add(ledger)
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_LEDGER',
        resource_type='ReagentLedger',
        resource_id=str(ledger.id),
        user_name=data.get('created_by', 'system'),
        details=json.dumps({
            'reagent_name': ledger.reagent_name,
            'hazard_class': hazard_class.value
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '试剂台账创建成功',
        'id': ledger.id,
        'reagent_name': ledger.reagent_name
    }), 201


@bp.route('/ledger/<int:ledger_id>', methods=['GET'])
def get_ledger(ledger_id):
    ledger = ReagentLedger.query.get_or_404(ledger_id)
    
    batches = Batch.query.filter_by(ledger_id=ledger_id).all()
    bottles = Bottle.query.filter_by(ledger_id=ledger_id).all()
    
    return jsonify({
        'id': ledger.id,
        'reagent_name': ledger.reagent_name,
        'cas_number': ledger.cas_number,
        'hazard_class': ledger.hazard_class.value,
        'hazard_details': ledger.hazard_details,
        'incompatible_with': ledger.incompatible_with,
        'is_low_temp': ledger.is_low_temp,
        'min_temp': ledger.min_temp,
        'max_temp': ledger.max_temp,
        'batches': [{
            'id': b.id,
            'batch_number': b.batch_number,
            'total_volume': b.total_volume,
            'remaining_volume': b.remaining_volume,
            'unit': b.unit,
            'supplier': b.supplier
        } for b in batches],
        'bottles': [{
            'id': b.id,
            'bottle_code': b.bottle_code,
            'volume': b.volume,
            'cabinet_id': b.cabinet_id,
            'status': b.status
        } for b in bottles]
    })


@bp.route('/batch', methods=['GET'])
def get_batches():
    batches = Batch.query.all()
    return jsonify([{
        'id': b.id,
        'batch_number': b.batch_number,
        'ledger_id': b.ledger_id,
        'ledger_name': b.ledger.reagent_name if b.ledger else None,
        'total_volume': b.total_volume,
        'remaining_volume': b.remaining_volume,
        'unit': b.unit,
        'supplier': b.supplier,
        'manufactured_date': b.manufactured_date.isoformat() if b.manufactured_date else None,
        'expiry_date': b.expiry_date.isoformat() if b.expiry_date else None
    } for b in batches])


@bp.route('/batch', methods=['POST'])
def create_batch():
    data = request.get_json()
    
    ledger = ReagentLedger.query.get(data['ledger_id'])
    if not ledger:
        return jsonify({'error': '试剂台账不存在'}), 404
    
    total_volume = float(data['total_volume'])
    batch = Batch(
        batch_number=data['batch_number'],
        ledger_id=ledger.id,
        total_volume=total_volume,
        remaining_volume=total_volume,
        unit=data.get('unit', 'mL'),
        supplier=data.get('supplier'),
        manufactured_date=datetime.strptime(data['manufactured_date'], '%Y-%m-%d').date() if data.get('manufactured_date') else None,
        expiry_date=datetime.strptime(data['expiry_date'], '%Y-%m-%d').date() if data.get('expiry_date') else None
    )
    
    db.session.add(batch)
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_BATCH',
        resource_type='Batch',
        resource_id=batch.batch_number,
        user_name=data.get('created_by', 'system'),
        details=json.dumps({
            'ledger_name': ledger.reagent_name,
            'total_volume': total_volume,
            'unit': batch.unit
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '批次创建成功',
        'id': batch.id,
        'batch_number': batch.batch_number
    }), 201


@bp.route('/bottle', methods=['GET'])
def get_bottles():
    bottles = Bottle.query.all()
    return jsonify([{
        'id': b.id,
        'bottle_code': b.bottle_code,
        'ledger_id': b.ledger_id,
        'ledger_name': b.ledger.reagent_name if b.ledger else None,
        'batch_id': b.batch_id,
        'batch_number': b.batch.batch_number if b.batch else None,
        'cabinet_id': b.cabinet_id,
        'cabinet_code': b.cabinet.cabinet_code if b.cabinet else None,
        'volume': b.volume,
        'unit': b.unit,
        'status': b.status
    } for b in bottles])


@bp.route('/bottle', methods=['POST'])
def create_bottle():
    data = request.get_json()
    
    batch = Batch.query.get(data['batch_id'])
    if not batch:
        return jsonify({'error': '批次不存在'}), 404
    
    volume = float(data['volume'])
    
    bottle = Bottle(
        bottle_code=data['bottle_code'],
        ledger_id=batch.ledger_id,
        batch_id=batch.id,
        volume=volume,
        unit=data.get('unit', 'mL'),
        status='在库'
    )
    
    if 'cabinet_id' in data:
        cabinet = Cabinet.query.get(data['cabinet_id'])
        if cabinet:
            bottle.cabinet_id = cabinet.id
            
            compat_check = CompatibilityRule.check_bottle_placement(bottle, cabinet)
            if not compat_check.valid:
                db.session.rollback()
                return jsonify({
                    'error': '柜位相容性检查失败',
                    'details': compat_check.to_dict()
                }), 400
    
    db.session.add(bottle)
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_BOTTLE',
        resource_type='Bottle',
        resource_id=bottle.bottle_code,
        user_name=data.get('created_by', 'system'),
        details=json.dumps({
            'batch_number': batch.batch_number,
            'volume': volume,
            'unit': bottle.unit,
            'cabinet_id': bottle.cabinet_id
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '瓶码创建成功',
        'id': bottle.id,
        'bottle_code': bottle.bottle_code
    }), 201


@bp.route('/bottle/<int:bottle_id>/place', methods=['POST'])
def place_bottle(bottle_id):
    data = request.get_json()
    
    bottle = Bottle.query.get_or_404(bottle_id)
    cabinet = Cabinet.query.get_or_404(data['cabinet_id'])
    
    compat_check = CompatibilityRule.check_bottle_placement(bottle, cabinet)
    if not compat_check.valid:
        return jsonify({
            'error': '柜位相容性检查失败',
            'details': compat_check.to_dict()
        }), 400
    
    bottle.cabinet_id = cabinet.id
    db.session.commit()
    
    AuditLogger.log(
        action='PLACE_BOTTLE',
        resource_type='Bottle',
        resource_id=bottle.bottle_code,
        user_name=data.get('placed_by', 'system'),
        details=json.dumps({
            'cabinet_code': cabinet.cabinet_code,
            'cabinet_name': cabinet.name
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '瓶码已放置到柜位',
        'bottle_code': bottle.bottle_code,
        'cabinet_code': cabinet.cabinet_code
    })


@bp.route('/cabinet', methods=['GET'])
def get_cabinets():
    cabinets = Cabinet.query.all()
    return jsonify([{
        'id': c.id,
        'cabinet_code': c.cabinet_code,
        'name': c.name,
        'location': c.location,
        'hazard_class': c.hazard_class.value if c.hazard_class else None,
        'is_low_temp': c.is_low_temp,
        'min_temp': c.min_temp,
        'max_temp': c.max_temp
    } for c in cabinets])


@bp.route('/cabinet', methods=['POST'])
def create_cabinet():
    data = request.get_json()
    
    try:
        hazard_class = HazardClass(data['hazard_class']) if 'hazard_class' in data else None
    except ValueError:
        hazard_class = None
    
    cabinet = Cabinet(
        cabinet_code=data['cabinet_code'],
        name=data['name'],
        location=data.get('location'),
        hazard_class=hazard_class,
        is_low_temp=data.get('is_low_temp', False),
        min_temp=data.get('min_temp'),
        max_temp=data.get('max_temp')
    )
    
    db.session.add(cabinet)
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_CABINET',
        resource_type='Cabinet',
        resource_id=cabinet.cabinet_code,
        user_name=data.get('created_by', 'system'),
        details=json.dumps({
            'name': cabinet.name,
            'hazard_class': hazard_class.value if hazard_class else None,
            'is_low_temp': cabinet.is_low_temp
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '柜位创建成功',
        'id': cabinet.id,
        'cabinet_code': cabinet.cabinet_code
    }), 201
