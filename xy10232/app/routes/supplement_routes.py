from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app import db
from app.models import SupplementRequest, CheckinEvent, Caregiver
from app.errors import SupplementError

supplement_bp = Blueprint('supplement', __name__)


@supplement_bp.route('', methods=['GET'])
def list_supplements():
    status = request.args.get('status')
    requester_id = request.args.get('requester_id', type=int)
    
    query = SupplementRequest.query
    
    if status:
        query = query.filter_by(status=status)
    if requester_id:
        query = query.filter_by(requester_id=requester_id)
    
    supplements = query.order_by(SupplementRequest.requested_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [s.to_dict() for s in supplements]
    })


@supplement_bp.route('/<int:supplement_id>', methods=['GET'])
def get_supplement(supplement_id):
    supplement = SupplementRequest.query.get_or_404(supplement_id)
    return jsonify({
        'success': True,
        'data': supplement.to_dict()
    })


@supplement_bp.route('', methods=['POST'])
def create_supplement():
    data = request.get_json()
    
    required_fields = ['checkin_id', 'requester_id', 'reason']
    for field in required_fields:
        if not data.get(field):
            raise SupplementError(f'缺少必要字段: {field}')
    
    checkin = CheckinEvent.query.get(data['checkin_id'])
    if not checkin:
        raise SupplementError(
            '打卡记录不存在',
            {'checkin_id': data['checkin_id']}
        )
    
    existing = SupplementRequest.query.filter_by(
        checkin_id=data['checkin_id'],
        status='pending'
    ).first()
    
    if existing:
        raise SupplementError(
            '该打卡记录已有待审核的补录申请',
            {'existing_supplement_id': existing.id}
        )
    
    requester = Caregiver.query.get(data['requester_id'])
    if not requester or requester.status != 'active':
        raise SupplementError(
            '申请人不存在或未激活',
            {'requester_id': data['requester_id']}
        )
    
    if checkin.caregiver_id != data['requester_id']:
        raise SupplementError(
            '只能为自己的打卡记录申请补录',
            {'checkin_caregiver_id': checkin.caregiver_id, 'requester_id': data['requester_id']}
        )
    
    supplement = SupplementRequest(
        checkin_id=data['checkin_id'],
        requester_id=data['requester_id'],
        reason=data['reason'],
        evidence=data.get('evidence', ''),
        status='pending'
    )
    
    db.session.add(supplement)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': supplement.to_dict(),
        'message': '补录申请已提交，等待审核'
    }), 201


@supplement_bp.route('/<int:supplement_id>/approve', methods=['POST'])
def approve_supplement(supplement_id):
    data = request.get_json()
    reviewer_id = data.get('reviewer_id')
    review_comment = data.get('review_comment', '')
    
    if not reviewer_id:
        raise SupplementError('缺少审核人ID')
    
    reviewer = Caregiver.query.get(reviewer_id)
    if not reviewer or reviewer.status != 'active':
        raise SupplementError(
            '审核人不存在或未激活',
            {'reviewer_id': reviewer_id}
        )
    
    supplement = SupplementRequest.query.get_or_404(supplement_id)
    
    try:
        supplement.transition_to('approved', reviewer_id, review_comment)
        checkin = supplement.checkin
        if checkin:
            checkin.checkin_type = 'supplement'
            checkin.notes = (checkin.notes or '') + f'\n[补录审核通过] {review_comment}'
    except Exception as e:
        db.session.rollback()
        raise SupplementError(str(e))
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': supplement.to_dict(),
        'message': '补录申请已批准'
    })


@supplement_bp.route('/<int:supplement_id>/reject', methods=['POST'])
def reject_supplement(supplement_id):
    data = request.get_json()
    reviewer_id = data.get('reviewer_id')
    review_comment = data.get('review_comment')
    
    if not reviewer_id:
        raise SupplementError('缺少审核人ID')
    
    if not review_comment:
        raise SupplementError('拒绝申请必须提供审核意见')
    
    reviewer = Caregiver.query.get(reviewer_id)
    if not reviewer or reviewer.status != 'active':
        raise SupplementError(
            '审核人不存在或未激活',
            {'reviewer_id': reviewer_id}
        )
    
    supplement = SupplementRequest.query.get_or_404(supplement_id)
    
    try:
        supplement.transition_to('rejected', reviewer_id, review_comment)
    except Exception as e:
        db.session.rollback()
        raise SupplementError(str(e))
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': supplement.to_dict(),
        'message': '补录申请已拒绝'
    })


@supplement_bp.route('/pending', methods=['GET'])
def list_pending_supplements():
    supplements = SupplementRequest.query.filter_by(status='pending').all()
    return jsonify({
        'success': True,
        'count': len(supplements),
        'data': [s.to_dict() for s in supplements]
    })
