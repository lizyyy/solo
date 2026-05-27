from flask import Blueprint, request, jsonify
from app import db
from app.models import Batch, SettlementRecord
from app.utils import generate_no, log_operation

bp = Blueprint('batches', __name__, url_prefix='/api/batches')

@bp.route('', methods=['POST'])
def create_batch():
    data = request.get_json()
    batch_no = generate_no('B')
    
    batch = Batch(
        batch_no=batch_no,
        name=data.get('name', f'批次{batch_no}'),
        created_by=data.get('operator', 'system'),
        remark=data.get('remark', '')
    )
    
    db.session.add(batch)
    db.session.commit()
    
    log_operation(
        operation='创建批次',
        operator=data.get('operator', 'system'),
        reason=data.get('remark', ''),
        batch_id=batch.id
    )
    
    return jsonify({
        'code': 0,
        'message': '创建成功',
        'data': {
            'id': batch.id,
            'batch_no': batch.batch_no,
            'name': batch.name,
            'status': batch.status,
            'created_at': batch.created_at.isoformat()
        }
    }), 201

@bp.route('', methods=['GET'])
def list_batches():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    
    query = Batch.query
    
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(Batch.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'code': 0,
        'data': {
            'items': [{
                'id': b.id,
                'batch_no': b.batch_no,
                'name': b.name,
                'status': b.status,
                'record_count': len(b.records),
                'created_by': b.created_by,
                'created_at': b.created_at.isoformat(),
                'remark': b.remark
            } for b in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page
        }
    })

@bp.route('/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    
    return jsonify({
        'code': 0,
        'data': {
            'id': batch.id,
            'batch_no': batch.batch_no,
            'name': batch.name,
            'status': batch.status,
            'created_by': batch.created_by,
            'created_at': batch.created_at.isoformat(),
            'updated_at': batch.updated_at.isoformat(),
            'remark': batch.remark,
            'records': [{
                'id': r.id,
                'record_no': r.record_no,
                'property_id': r.property_id,
                'tenant_name': r.tenant_name,
                'checkout_date': r.checkout_date.isoformat() if r.checkout_date else None,
                'deposit_receipt_no': r.deposit_receipt_no,
                'status': r.status,
                'actual_refund': float(r.actual_refund) if r.actual_refund else None
            } for r in batch.records]
        }
    })

@bp.route('/<int:batch_id>/process', methods=['POST'])
def process_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    
    old_status = batch.status
    batch.status = 'processing'
    
    db.session.commit()
    
    log_operation(
        operation='开始处理批次',
        operator=operator,
        batch_id=batch.id,
        old_status=old_status,
        new_status=batch.status
    )
    
    return jsonify({
        'code': 0,
        'message': '批次已标记为处理中',
        'data': {'status': batch.status}
    })

@bp.route('/<int:batch_id>/complete', methods=['POST'])
def complete_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    data = request.get_json()
    operator = data.get('operator', 'system')
    
    pending_records = SettlementRecord.query.filter_by(
        batch_id=batch_id, 
        status='pending'
    ).count()
    
    if pending_records > 0:
        return jsonify({
            'code': 400,
            'message': f'还有{pending_records}条记录待处理，无法完成批次'
        }), 400
    
    old_status = batch.status
    batch.status = 'completed'
    
    db.session.commit()
    
    log_operation(
        operation='完成批次',
        operator=operator,
        reason=data.get('reason', ''),
        batch_id=batch.id,
        old_status=old_status,
        new_status=batch.status
    )
    
    return jsonify({
        'code': 0,
        'message': '批次已完成',
        'data': {'status': batch.status}
    })
