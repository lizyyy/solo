from flask import Blueprint, request, jsonify
from app import db
from app.models import WasteBucket, WasteRecord, WasteStatus, ReviewStatus, HazardClass
from app.rules import WasteBucketRule
from app.audit_log import AuditLogger
from datetime import datetime, timedelta
import json
import uuid

bp = Blueprint('waste', __name__, url_prefix='/api/waste')


@bp.route('/bucket', methods=['GET'])
def get_buckets():
    buckets = WasteBucket.query.all()
    
    for bucket in buckets:
        WasteBucketRule.update_bucket_status(bucket)
    
    return jsonify([{
        'id': b.id,
        'bucket_code': b.bucket_code,
        'waste_type': b.waste_type,
        'hazard_class': b.hazard_class.value if b.hazard_class else None,
        'max_volume': b.max_volume,
        'current_volume': b.current_volume,
        'unit': b.unit,
        'status': b.status.value if b.status else None,
        'start_date': b.start_date.isoformat() if b.start_date else None,
        'expiry_days': b.expiry_days,
        'expiry_date': (b.start_date + timedelta(days=b.expiry_days)).isoformat() if b.start_date else None,
        'disposal_date': b.disposal_date.isoformat() if b.disposal_date else None
    } for b in buckets])


@bp.route('/bucket', methods=['POST'])
def create_bucket():
    data = request.get_json()
    
    try:
        hazard_class = HazardClass(data['hazard_class']) if 'hazard_class' in data else None
    except ValueError:
        hazard_class = None
    
    start_date = datetime.utcnow().date()
    if 'start_date' in data:
        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        except ValueError:
            pass
    
    bucket = WasteBucket(
        bucket_code=data['bucket_code'],
        waste_type=data['waste_type'],
        hazard_class=hazard_class,
        max_volume=float(data['max_volume']),
        current_volume=float(data.get('current_volume', 0)),
        unit=data.get('unit', 'L'),
        start_date=start_date,
        expiry_days=int(data.get('expiry_days', 90)),
        status=WasteStatus.ACTIVE
    )
    
    db.session.add(bucket)
    db.session.commit()
    
    expiry_check = WasteBucketRule.check_expiry(bucket)
    
    AuditLogger.log(
        action='CREATE_WASTE_BUCKET',
        resource_type='WasteBucket',
        resource_id=bucket.bucket_code,
        user_name=data.get('created_by', 'system'),
        details=json.dumps({
            'waste_type': bucket.waste_type,
            'max_volume': bucket.max_volume,
            'unit': bucket.unit,
            'expiry_days': bucket.expiry_days
        }, ensure_ascii=False)
    )
    
    response_data = {
        'message': '废液桶创建成功',
        'id': bucket.id,
        'bucket_code': bucket.bucket_code,
        'expiry_check': expiry_check.to_dict()
    }
    
    if not expiry_check.valid:
        response_data['warning'] = '废液桶已逾期'
    
    return jsonify(response_data), 201


@bp.route('/bucket/<int:bucket_id>/dispose', methods=['POST'])
def dispose_bucket(bucket_id):
    data = request.get_json()
    
    bucket = WasteBucket.query.get_or_404(bucket_id)
    
    disposal_date = datetime.utcnow().date()
    if 'disposal_date' in data:
        try:
            disposal_date = datetime.strptime(data['disposal_date'], '%Y-%m-%d').date()
        except ValueError:
            pass
    
    bucket.status = WasteStatus.DISPOSED
    bucket.disposal_date = disposal_date
    db.session.commit()
    
    AuditLogger.log(
        action='DISPOSE_WASTE_BUCKET',
        resource_type='WasteBucket',
        resource_id=bucket.bucket_code,
        user_name=data.get('disposed_by', 'system'),
        details=json.dumps({
            'current_volume': bucket.current_volume,
            'disposal_date': disposal_date.isoformat()
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '废液桶已标记为已处置',
        'bucket_code': bucket.bucket_code,
        'disposal_date': disposal_date.isoformat()
    })


@bp.route('/record', methods=['GET'])
def get_records():
    records = WasteRecord.query.all()
    return jsonify([{
        'id': r.id,
        'record_id': r.record_id,
        'bucket_id': r.bucket_id,
        'bucket_code': r.bucket.bucket_code if r.bucket else None,
        'waste_name': r.waste_name,
        'volume': r.volume,
        'unit': r.unit,
        'user_name': r.user_name,
        'record_time': r.record_time.isoformat() if r.record_time else None,
        'review_status': r.review_status.value if r.review_status else None,
        'reviewed_by': r.reviewed_by
    } for r in records])


@bp.route('/record', methods=['POST'])
def create_record():
    data = request.get_json()
    
    bucket = WasteBucket.query.get(data['bucket_id'])
    if not bucket:
        return jsonify({'error': '废液桶不存在'}), 404
    
    volume = float(data['volume'])
    unit = data.get('unit', 'mL')
    
    if bucket.status in [WasteStatus.FULL, WasteStatus.EXPIRED, WasteStatus.DISPOSED]:
        return jsonify({
            'error': '废液桶不可用',
            'details': {
                'bucket_code': bucket.bucket_code,
                'current_status': bucket.status.value if bucket.status else None
            }
        }), 400
    
    volume_check = WasteBucketRule.check_volume(bucket, volume, unit)
    expiry_check = WasteBucketRule.check_expiry(bucket)
    
    if not volume_check.valid:
        return jsonify({
            'error': '废液桶容量不足',
            'details': volume_check.to_dict()
        }), 400
    
    record_id = f"WR-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    record_time = datetime.utcnow()
    if 'record_time' in data:
        try:
            record_time = datetime.strptime(data['record_time'], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                record_time = datetime.fromisoformat(data['record_time'])
            except ValueError:
                pass
    
    record = WasteRecord(
        record_id=record_id,
        bucket_id=bucket.id,
        waste_name=data.get('waste_name'),
        volume=volume,
        unit=unit,
        user_name=data.get('user_name'),
        record_time=record_time,
        review_status=ReviewStatus.PENDING
    )
    
    unit_factor = 0.001 if unit == "mL" else 1.0 if unit == "L" else 1.0
    bucket.current_volume += volume * unit_factor
    
    db.session.add(record)
    
    WasteBucketRule.update_bucket_status(bucket)
    db.session.commit()
    
    AuditLogger.log(
        action='CREATE_WASTE_RECORD',
        resource_type='WasteRecord',
        resource_id=record_id,
        user_name=data.get('user_name', 'system'),
        details=json.dumps({
            'bucket_code': bucket.bucket_code,
            'volume': volume,
            'unit': unit,
            'waste_name': record.waste_name
        }, ensure_ascii=False)
    )
    
    warnings = []
    if not expiry_check.valid:
        warnings.append(expiry_check.to_dict())
    if 'warnings' in volume_check.details:
        warnings.append({'type': 'volume_warning', 'details': volume_check.details['warnings']})
    
    response_data = {
        'message': '废液记录创建成功',
        'record_id': record_id,
        'bucket_code': bucket.bucket_code,
        'bucket_status': bucket.status.value if bucket.status else None,
        'volume_check': volume_check.to_dict(),
        'expiry_check': expiry_check.to_dict()
    }
    
    if warnings:
        response_data['warnings'] = warnings
    
    return jsonify(response_data), 201


@bp.route('/expired', methods=['GET'])
def get_expired_buckets():
    now = datetime.utcnow().date()
    
    buckets = WasteBucket.query.filter(
        WasteBucket.status != WasteStatus.DISPOSED
    ).all()
    
    expired_buckets = []
    for bucket in buckets:
        expiry_check = WasteBucketRule.check_expiry(bucket)
        if not expiry_check.valid:
            expired_buckets.append({
                'id': bucket.id,
                'bucket_code': bucket.bucket_code,
                'waste_type': bucket.waste_type,
                'current_volume': bucket.current_volume,
                'max_volume': bucket.max_volume,
                'start_date': bucket.start_date.isoformat() if bucket.start_date else None,
                'expiry_days': bucket.expiry_days,
                'days_overdue': expiry_check.details.get('days_overdue', 0)
            })
    
    return jsonify(expired_buckets)
