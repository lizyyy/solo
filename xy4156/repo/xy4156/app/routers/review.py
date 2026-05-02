from flask import Blueprint, request, jsonify
from app import db
from app.models import DispenseRecord, WasteRecord, ReviewStatus
from app.rules import ReviewRule
from app.audit_log import AuditLogger
from datetime import datetime
import json

bp = Blueprint('review', __name__, url_prefix='/api/review')


@bp.route('/dispense/<int:record_id>', methods=['POST'])
def review_dispense(record_id):
    data = request.get_json()
    
    record = DispenseRecord.query.get_or_404(record_id)
    
    if record.review_status != ReviewStatus.PENDING:
        return jsonify({
            'error': '记录已被复核',
            'current_status': record.review_status.value if record.review_status else None
        }), 400
    
    reviewed_by = data.get('reviewed_by')
    review_comment = data.get('review_comment', '')
    approved = data.get('approved', True)
    
    signature_check = ReviewRule.check_signature(reviewed_by, review_comment)
    if not signature_check.valid:
        return jsonify({
            'error': '复核签名校验失败',
            'details': signature_check.to_dict()
        }), 400
    
    record.review_status = ReviewStatus.APPROVED if approved else ReviewStatus.REJECTED
    record.reviewed_by = reviewed_by
    record.reviewed_at = datetime.utcnow()
    record.review_comment = review_comment
    
    db.session.commit()
    
    AuditLogger.log(
        action='REVIEW_DISPENSE',
        resource_type='DispenseRecord',
        resource_id=record.record_id,
        user_name=reviewed_by,
        details=json.dumps({
            'approved': approved,
            'comment': review_comment,
            'dispensed_volume': record.dispensed_volume,
            'batch_number': record.batch.batch_number if record.batch else None
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '分装记录复核完成',
        'record_id': record.record_id,
        'review_status': record.review_status.value,
        'reviewed_by': reviewed_by
    })


@bp.route('/waste/<int:record_id>', methods=['POST'])
def review_waste(record_id):
    data = request.get_json()
    
    record = WasteRecord.query.get_or_404(record_id)
    
    if record.review_status != ReviewStatus.PENDING:
        return jsonify({
            'error': '记录已被复核',
            'current_status': record.review_status.value if record.review_status else None
        }), 400
    
    reviewed_by = data.get('reviewed_by')
    review_comment = data.get('review_comment', '')
    approved = data.get('approved', True)
    
    signature_check = ReviewRule.check_signature(reviewed_by, review_comment)
    if not signature_check.valid:
        return jsonify({
            'error': '复核签名校验失败',
            'details': signature_check.to_dict()
        }), 400
    
    record.review_status = ReviewStatus.APPROVED if approved else ReviewStatus.REJECTED
    record.reviewed_by = reviewed_by
    record.reviewed_at = datetime.utcnow()
    record.review_comment = review_comment
    
    db.session.commit()
    
    AuditLogger.log(
        action='REVIEW_WASTE',
        resource_type='WasteRecord',
        resource_id=record.record_id,
        user_name=reviewed_by,
        details=json.dumps({
            'approved': approved,
            'comment': review_comment,
            'volume': record.volume,
            'bucket_code': record.bucket.bucket_code if record.bucket else None
        }, ensure_ascii=False)
    )
    
    return jsonify({
        'message': '废液记录复核完成',
        'record_id': record.record_id,
        'review_status': record.review_status.value,
        'reviewed_by': reviewed_by
    })


@bp.route('/pending', methods=['GET'])
def get_pending_reviews():
    dispense_pending = DispenseRecord.query.filter_by(
        review_status=ReviewStatus.PENDING
    ).all()
    
    waste_pending = WasteRecord.query.filter_by(
        review_status=ReviewStatus.PENDING
    ).all()
    
    return jsonify({
        'dispense_records': [{
            'id': r.id,
            'record_id': r.record_id,
            'batch_number': r.batch.batch_number if r.batch else None,
            'dispensed_volume': r.dispensed_volume,
            'unit': r.unit,
            'experiment_name': r.experiment_name,
            'user_name': r.user_name,
            'dispense_time': r.dispense_time.isoformat() if r.dispense_time else None
        } for r in dispense_pending],
        'waste_records': [{
            'id': r.id,
            'record_id': r.record_id,
            'bucket_code': r.bucket.bucket_code if r.bucket else None,
            'waste_name': r.waste_name,
            'volume': r.volume,
            'unit': r.unit,
            'user_name': r.user_name,
            'record_time': r.record_time.isoformat() if r.record_time else None
        } for r in waste_pending],
        'total_pending': len(dispense_pending) + len(waste_pending)
    })
