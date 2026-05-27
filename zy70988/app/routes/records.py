from flask import Blueprint, request, jsonify
from datetime import datetime
from app import db
from app.models import SettlementRecord, ElectricityTierDetail, RefundReversal, Evidence
from app.utils import log_operation, calculate_electricity_tier

bp = Blueprint('records', __name__, url_prefix='/api/records')

@bp.route('', methods=['GET'])
def list_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    property_id = request.args.get('property_id')
    deposit_receipt_no = request.args.get('deposit_receipt_no')
    checkout_start = request.args.get('checkout_start')
    checkout_end = request.args.get('checkout_end')
    status = request.args.get('status')
    batch_id = request.args.get('batch_id', type=int)
    
    query = SettlementRecord.query
    
    if property_id:
        query = query.filter_by(property_id=property_id)
    if deposit_receipt_no:
        query = query.filter_by(deposit_receipt_no=deposit_receipt_no)
    if checkout_start:
        query = query.filter(SettlementRecord.checkout_date >= datetime.strptime(checkout_start, '%Y-%m-%d').date())
    if checkout_end:
        query = query.filter(SettlementRecord.checkout_date <= datetime.strptime(checkout_end, '%Y-%m-%d').date())
    if status:
        query = query.filter_by(status=status)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    pagination = query.order_by(SettlementRecord.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'code': 0,
        'data': {
            'items': [{
                'id': r.id,
                'record_no': r.record_no,
                'batch_id': r.batch_id,
                'property_id': r.property_id,
                'room_no': r.room_no,
                'tenant_name': r.tenant_name,
                'checkout_date': r.checkout_date.isoformat() if r.checkout_date else None,
                'deposit_receipt_no': r.deposit_receipt_no,
                'deposit_amount': float(r.deposit_amount) if r.deposit_amount else None,
                'actual_refund': float(r.actual_refund) if r.actual_refund else None,
                'status': r.status,
                'has_refund_reversal': r.has_refund_reversal,
                'created_at': r.created_at.isoformat()
            } for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page
        }
    })

@bp.route('/<int:record_id>', methods=['GET'])
def get_record(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    
    return jsonify({
        'code': 0,
        'data': {
            'id': record.id,
            'record_no': record.record_no,
            'batch_id': record.batch_id,
            'property_id': record.property_id,
            'room_no': record.room_no,
            'tenant_name': record.tenant_name,
            'checkin_date': record.checkin_date.isoformat() if record.checkin_date else None,
            'checkout_date': record.checkout_date.isoformat() if record.checkout_date else None,
            'deposit_receipt_no': record.deposit_receipt_no,
            'deposit_amount': float(record.deposit_amount) if record.deposit_amount else None,
            
            'water_start': float(record.water_start) if record.water_start else None,
            'water_end': float(record.water_end) if record.water_end else None,
            'water_usage': float(record.water_usage) if record.water_usage else None,
            'water_amount': float(record.water_amount) if record.water_amount else None,
            
            'electricity_start': float(record.electricity_start) if record.electricity_start else None,
            'electricity_end': float(record.electricity_end) if record.electricity_end else None,
            'electricity_usage': float(record.electricity_usage) if record.electricity_usage else None,
            'electricity_amount': float(record.electricity_amount) if record.electricity_amount else None,
            'electricity_tier': record.electricity_tier,
            
            'damage_amount': float(record.damage_amount) if record.damage_amount else None,
            'cleaning_fee': float(record.cleaning_fee) if record.cleaning_fee else None,
            'other_fees': float(record.other_fees) if record.other_fees else None,
            'refund_amount': float(record.refund_amount) if record.refund_amount else None,
            'actual_refund': float(record.actual_refund) if record.actual_refund else None,
            
            'status': record.status,
            'has_refund_reversal': record.has_refund_reversal,
            'created_at': record.created_at.isoformat(),
            'updated_at': record.updated_at.isoformat(),
            
            'tier_details': [{
                'tier_name': t.tier_name,
                'usage': float(t.usage),
                'unit_price': float(t.unit_price),
                'amount': float(t.amount)
            } for t in record.tier_details],
            
            'evidences': [{
                'id': e.id,
                'evidence_type': e.evidence_type,
                'file_name': e.file_name,
                'uploaded_by': e.uploaded_by,
                'uploaded_at': e.uploaded_at.isoformat(),
                'description': e.description
            } for e in record.evidences],
            
            'operation_logs': [{
                'operation': l.operation,
                'operator': l.operator,
                'reason': l.reason,
                'old_status': l.old_status,
                'new_status': l.new_status,
                'operated_at': l.operated_at.isoformat()
            } for l in record.operation_logs]
        }
    })

@bp.route('/<int:record_id>/approve', methods=['POST'])
def approve_record(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    reason = data.get('reason', '审核通过')
    
    old_status = record.status
    record.status = 'approved'
    record.actual_refund = record.refund_amount
    
    db.session.commit()
    
    log_operation(
        operation='审核通过',
        operator=operator,
        reason=reason,
        record_id=record.id,
        old_status=old_status,
        new_status=record.status
    )
    
    return jsonify({
        'code': 0,
        'message': '记录已审核通过',
        'data': {'status': record.status}
    })

@bp.route('/<int:record_id>/reject', methods=['POST'])
def reject_record(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    reason = data.get('reason', '')
    
    if not reason:
        return jsonify({'code': 400, 'message': '退回原因不能为空'}), 400
    
    old_status = record.status
    record.status = 'rejected'
    
    db.session.commit()
    
    log_operation(
        operation='退回修改',
        operator=operator,
        reason=reason,
        record_id=record.id,
        old_status=old_status,
        new_status=record.status
    )
    
    return jsonify({
        'code': 0,
        'message': '记录已退回',
        'data': {'status': record.status}
    })

@bp.route('/<int:record_id>/request_material', methods=['POST'])
def request_material(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    reason = data.get('reason', '')
    
    if not reason:
        return jsonify({'code': 400, 'message': '补材料原因不能为空'}), 400
    
    old_status = record.status
    record.status = 'need_material'
    
    db.session.commit()
    
    log_operation(
        operation='要求补材料',
        operator=operator,
        reason=reason,
        record_id=record.id,
        old_status=old_status,
        new_status=record.status
    )
    
    return jsonify({
        'code': 0,
        'message': '已要求补材料',
        'data': {'status': record.status}
    })

@bp.route('/<int:record_id>/resubmit', methods=['POST'])
def resubmit_record(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    
    old_status = record.status
    record.status = 'pending'
    
    db.session.commit()
    
    log_operation(
        operation='重新提交',
        operator=operator,
        reason=data.get('reason', ''),
        record_id=record.id,
        old_status=old_status,
        new_status=record.status
    )
    
    return jsonify({
        'code': 0,
        'message': '已重新提交',
        'data': {'status': record.status}
    })

@bp.route('/<int:record_id>/refund_reversal', methods=['POST'])
def refund_reversal(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    reversed_amount = data.get('reversed_amount', 0)
    reason = data.get('reason', '')
    
    if not reason:
        return jsonify({'code': 400, 'message': '冲正原因不能为空'}), 400
    
    original_refund = float(record.actual_refund or record.refund_amount or 0)
    new_refund = original_refund - float(reversed_amount)
    
    reversal = RefundReversal(
        record_id=record.id,
        original_refund=original_refund,
        reversed_amount=reversed_amount,
        new_refund=new_refund,
        reason=reason,
        operator=operator
    )
    
    record.actual_refund = new_refund
    record.has_refund_reversal = True
    
    db.session.add(reversal)
    db.session.commit()
    
    log_operation(
        operation='退款冲正',
        operator=operator,
        reason=f"{reason}, 冲正金额: {reversed_amount}",
        record_id=record.id
    )
    
    return jsonify({
        'code': 0,
        'message': '退款冲正成功',
        'data': {
            'original_refund': original_refund,
            'reversed_amount': reversed_amount,
            'new_refund': new_refund
        }
    })

@bp.route('/<int:record_id>/update_damage', methods=['POST'])
def update_damage(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    damage_amount = data.get('damage_amount', 0)
    reason = data.get('reason', '')
    
    if not reason:
        return jsonify({'code': 400, 'message': '损坏赔偿原因不能为空'}), 400
    
    old_damage = float(record.damage_amount or 0)
    record.damage_amount = damage_amount
    
    total_deduction = float(record.water_amount or 0) + \
                      float(record.electricity_amount or 0) + \
                      float(damage_amount) + \
                      float(record.cleaning_fee or 0) + \
                      float(record.other_fees or 0)
    
    record.refund_amount = max(0, float(record.deposit_amount or 0) - total_deduction)
    
    db.session.commit()
    
    log_operation(
        operation='更新损坏赔偿',
        operator=operator,
        reason=f"{reason}, 金额: {damage_amount}",
        record_id=record.id
    )
    
    return jsonify({
        'code': 0,
        'message': '损坏赔偿已更新',
        'data': {
            'old_damage': old_damage,
            'new_damage': damage_amount,
            'refund_amount': float(record.refund_amount)
        }
    })
