from flask import Blueprint, request, jsonify
from datetime import datetime

from app import db
from models import SpliceGroup, Pottery, PotteryGroupAssociation
from services import VersionManager, AuditService, RuleEngine, StateMachine

group_bp = Blueprint('group', __name__)
rule_engine = RuleEngine()
state_machine = StateMachine()


@group_bp.route('', methods=['GET'])
def list_groups():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    
    query = SpliceGroup.query
    
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(SpliceGroup.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'success': True,
        'data': {
            'groups': [g.to_dict() for g in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }
    })


@group_bp.route('/<group_id>', methods=['GET'])
def get_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    include_potteries = request.args.get('include_potteries', 'false').lower() == 'true'
    include_issues = request.args.get('include_issues', 'false').lower() == 'true'
    
    return jsonify({
        'success': True,
        'data': group.to_dict(include_potteries=include_potteries, include_issues=include_issues)
    })


@group_bp.route('', methods=['POST'])
def create_group():
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '请求数据为空'
        }), 400
    
    if 'group_id' not in data or not data['group_id']:
        return jsonify({
            'success': False,
            'error': '缺少必填字段: group_id'
        }), 400
    
    existing = SpliceGroup.query.filter_by(group_id=data['group_id']).first()
    if existing:
        return jsonify({
            'success': False,
            'error': '拼接组编号已存在',
            'group_id': data['group_id']
        }), 409
    
    try:
        group = SpliceGroup(
            group_id=data['group_id'],
            name=data.get('name'),
            description=data.get('description'),
            status=data.get('status', 'draft'),
            guess_evidence=data.get('guess_evidence'),
            created_by=data.get('created_by'),
            updated_by=data.get('updated_by')
        )
        
        db.session.add(group)
        db.session.flush()
        
        pottery_ids = data.get('pottery_ids', [])
        if pottery_ids:
            for pottery_id in pottery_ids:
                pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
                if pottery:
                    assoc = PotteryGroupAssociation(
                        pottery_id=pottery.id,
                        group_id=group.id
                    )
                    db.session.add(assoc)
        
        AuditService.log_group_create(
            group,
            user=data.get('created_by')
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组创建成功',
            'data': group.to_dict(include_potteries=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'创建拼接组失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>', methods=['PUT'])
def update_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '请求数据为空'
        }), 400
    
    old_values = group.to_dict()
    
    try:
        updatable_fields = [
            'name', 'description', 'status', 'guess_evidence'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(group, field, data[field])
        
        if 'updated_by' in data:
            group.updated_by = data['updated_by']
        
        if 'pottery_ids' in data:
            new_ids = set(data['pottery_ids'])
            current_ids = set(group.get_pottery_ids())
            
            for assoc in group.associations[:]:
                if assoc.pottery and assoc.pottery.pottery_id not in new_ids:
                    db.session.delete(assoc)
            
            for pottery_id in new_ids - current_ids:
                pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
                if pottery:
                    assoc = PotteryGroupAssociation(
                        pottery_id=pottery.id,
                        group_id=group.id
                    )
                    db.session.add(assoc)
        
        VersionManager.create_version(
            group, 'splice_group',
            change_reason=data.get('change_reason', '更新拼接组信息'),
            created_by=data.get('updated_by')
        )
        
        AuditService.log_group_update(
            group, old_values,
            user=data.get('updated_by')
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组更新成功',
            'data': group.to_dict(include_potteries=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'更新拼接组失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    if group.status in ['submitted', 'under_review']:
        return jsonify({
            'success': False,
            'error': '拼接组已提交或正在复核，无法删除',
            'group_id': group_id
        }), 400
    
    try:
        for assoc in group.associations:
            db.session.delete(assoc)
        
        db.session.delete(group)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组删除成功',
            'group_id': group_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'删除拼接组失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>/submit', methods=['POST'])
def submit_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    
    result = state_machine.transition_group(group.status, 'submit')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        group.status = result.new_state
        group.guess_submitted_by = user
        group.guess_submitted_at = datetime.utcnow()
        
        if 'guess_evidence' in data:
            group.guess_evidence = data['guess_evidence']
        
        AuditService.log_group_submit(group, user=user)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组提交成功',
            'data': group.to_dict(include_potteries=True)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'提交拼接组失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>/withdraw', methods=['POST'])
def withdraw_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    
    result = state_machine.transition_group(group.status, 'withdraw')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        group.status = result.new_state
        
        AuditService.log_group_withdraw(group, user=user)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组撤回成功',
            'data': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'撤回拼接组失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>/validate', methods=['POST'])
def validate_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    result = rule_engine.validate_group(group)
    
    data = request.get_json() or {}
    save_issues = data.get('save_issues', False)
    
    if save_issues and result.issues:
        from models import Issue
        for issue_data in result.issues:
            issue = Issue(
                issue_type=issue_data.get('issue_type'),
                severity=issue_data.get('severity'),
                title=issue_data.get('title'),
                description=issue_data.get('description'),
                group_id=group.id,
                rule_name=issue_data.get('rule_name'),
                rule_details=issue_data.get('rule_details')
            )
            db.session.add(issue)
        
        AuditService.log_validation(
            'splice_group', group.group_id,
            result.issues
        )
        
        db.session.commit()
    
    return jsonify({
        'success': True,
        'data': result.to_dict()
    })


@group_bp.route('/<group_id>/potteries', methods=['POST'])
def add_pottery_to_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json()
    
    if not data or 'pottery_id' not in data:
        return jsonify({
            'success': False,
            'error': '缺少必填字段: pottery_id'
        }), 400
    
    pottery = Pottery.query.filter_by(pottery_id=data['pottery_id']).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': data['pottery_id']
        }), 404
    
    existing = PotteryGroupAssociation.query.filter_by(
        pottery_id=pottery.id,
        group_id=group.id
    ).first()
    
    if existing:
        return jsonify({
            'success': False,
            'error': '陶片已在拼接组中',
            'pottery_id': data['pottery_id']
        }), 409
    
    try:
        assoc = PotteryGroupAssociation(
            pottery_id=pottery.id,
            group_id=group.id,
            edge_position=data.get('edge_position'),
            edge_length=data.get('edge_length'),
            match_confidence=data.get('match_confidence'),
            match_notes=data.get('match_notes')
        )
        
        db.session.add(assoc)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '陶片已添加到拼接组',
            'data': assoc.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'添加陶片失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>/potteries/<pottery_id>', methods=['DELETE'])
def remove_pottery_from_group(group_id, pottery_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
    
    if not pottery:
        return jsonify({
            'success': False,
            'error': '陶片不存在',
            'pottery_id': pottery_id
        }), 404
    
    assoc = PotteryGroupAssociation.query.filter_by(
        pottery_id=pottery.id,
        group_id=group.id
    ).first()
    
    if not assoc:
        return jsonify({
            'success': False,
            'error': '陶片不在拼接组中',
            'pottery_id': pottery_id
        }), 404
    
    try:
        db.session.delete(assoc)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '陶片已从拼接组移除'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'移除陶片失败: {str(e)}'
        }), 500


@group_bp.route('/<group_id>/versions', methods=['GET'])
def get_group_versions(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    versions = VersionManager.get_version_history('splice_group', group_id)
    
    return jsonify({
        'success': True,
        'data': {
            'group_id': group_id,
            'versions': versions
        }
    })


@group_bp.route('/stats', methods=['GET'])
def get_group_stats():
    from sqlalchemy import func
    
    total = SpliceGroup.query.count()
    
    status_stats = db.session.query(
        SpliceGroup.status, func.count(SpliceGroup.id)
    ).group_by(SpliceGroup.status).all()
    
    return jsonify({
        'success': True,
        'data': {
            'total': total,
            'by_status': {status: count for status, count in status_stats}
        }
    })
