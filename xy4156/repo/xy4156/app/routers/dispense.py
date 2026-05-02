from flask import Blueprint, request, jsonify
from app import db
from app.models import DispenseRecord, Batch, Bottle, ReviewStatus
from app.rules import InventoryRule
from app.audit_log import AuditLogger
from datetime import datetime
import json
import uuid

bp = Blueprint('dispense', __name__, url_prefix='/api/dispense')


@bp.route('/', methods=['GET'])
def get_records():
    records = DispenseRecord.query.all()
    return jsonify([{
        'id': r.id,
        'record_id': r.record_id,
        'batch_id': r.batch_id,
        'batch_number': r.batch.batch_number if r.batch else None,
        'bottle_id': r.bottle_id,
        'bottle_code': r.bottle.bottle_code if r.bottle else None,
        'dispensed_volume': r.dispensed_volume,
        'unit': r.unit,
        'experiment_name': r.experiment_name,
        'user_name': r.user_name,
        'dispense_time': r.dispense_time.isoformat() if r.dispense_time else None,
        'review_status': r.review_status.value if r.review_status else None,
        'reviewed_by': r.reviewed_by,
        'reviewed_at': r.reviewed_at.isoformat() if r.reviewed_at else None
    } for r in records])


@bp.route('/', methods=['POST'])
def create_record():
    data = request.get_json()
    
    batch = Batch.query.get(data['batch_id'])
    if not batch:
        return jsonify({'error': '批次不存在'}), 404
    
    dispense_volume = float(data['dispensed_volume'])
    
    inventory_check = InventoryRule.check_batch_volume(batch, dispense_volume)
    if not inventory_check.valid:
        return jsonify({
            'error': '库存校验失败',
            'details': inventory_check.to_dict()
        }), 400
    
    record_id = f"DR-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    dispense_time = datetime.utcnow()
    if 'dispense_time' in data:
        try:
            dispense_time = datetime.strptime(data['dispense_time'], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                dispense_time = datetime.fromisoformat(data['dispense_time'])
            except ValueError:
                pass
    
    record = DispenseRecord(
        record_id=record_id,
        batch_id=batch.id,
        bottle_id=data.get('bottle_id'),
        dispensed_volume=dispense_volume,
        unit=data.get('unit', 'mL'),
        experiment_name=data.get('experiment_name'),
        user_name=data.get('user_name'),
        dispense_time=dispense_time,
        review_status=ReviewStatus.PENDING
    )
    
    db.session.add(record)
    
    InventoryRule.update_batch_volume(batch, dispense_volume)
    
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_DISPENSE',
        resource_type='DispenseRecord',
        resource_id=record_id,
        user_name=data.get('user_name', 'system'),
        details=json.dumps({
            'batch_number': batch.batch_number,
            'dispensed_volume': dispense_volume,
            'unit': record.unit,
            'experiment_name': record.experiment_name
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '分装记录创建成功',
        'record_id': record_id,
        'inventory_check': inventory_check.to_dict()
    }), 201


@bp.route('/pending', methods=['GET'])
def get_pending_records():
    records = DispenseRecord.query.filter_by(
        review_status=ReviewStatus.PENDING
    ).all()
    
    return jsonify([{
        'id': r.id,
        'record_id': r.record_id,
        'batch_number': r.batch.batch_number if r.batch else None,
        'dispensed_volume': r.dispensed_volume,
        'unit': r.unit,
        'experiment_name': r.experiment_name,
        'user_name': r.user_name,
        'dispense_time': r.dispense_time.isoformat() if r.dispense_time else None
    } for r in records])
