from flask import Blueprint, request, jsonify
from datetime import datetime

from app import db
from models import SpliceGroup, Pottery, Issue, AuditLog
from services import StateMachine, RuleEngine, VersionManager, AuditService

review_bp = Blueprint('review', __name__)
state_machine = StateMachine()
rule_engine = RuleEngine()


@review_bp.route('/rules', methods=['GET'])
def list_rules():
    rules = rule_engine.list_rules()
    
    return jsonify({
        'success': True,
        'data': {
            'rules': rules,
            'count': len(rules)
        }
    })


@review_bp.route('/rules/<rule_name>', methods=['GET'])
def get_rule_info(rule_name):
    rule = rule_engine.get_rule(rule_name)
    
    if not rule:
        return jsonify({
            'success': False,
            'error': '规则不存在',
            'rule_name': rule_name
        }), 404
    
    return jsonify({
        'success': True,
        'data': {
            'name': rule.rule_name,
            'description': rule.description,
            'severity': rule.severity.value,
            'issue_type': rule.issue_type.value
        }
    })


@review_bp.route('/validate/group/<group_id>', methods=['POST'])
def validate_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    save_issues = data.get('save_issues', False)
    
    result = rule_engine.validate_group(group)
    
    if save_issues and result.issues:
        for issue_data in result.issues:
            issue = Issue(
                issue_type=issue_data.get('issue_type'),
                severity=issue_data.get('severity'),
                title=issue_data.get('title'),
                description=issue_data.get('description'),
                group_id=group.id,
                rule_name=issue_data.get('rule_name'),
                rule_details=issue_data.get('rule_details'),
                detected_by='system'
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


@review_bp.route('/validate/all', methods=['POST'])
def validate_all():
    data = request.get_json() or {}
    save_issues = data.get('save_issues', False)
    
    all_potteries = Pottery.query.all()
    all_groups = SpliceGroup.query.all()
    
    results = rule_engine.validate_all(all_potteries, all_groups)
    
    if save_issues:
        pottery_results = results.get('pottery_results', {})
        for pottery_id, result in pottery_results.items():
            issues = result.get('issues', [])
            if issues:
                pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
                if pottery:
                    for issue_data in issues:
                        issue = Issue(
                            issue_type=issue_data.get('issue_type'),
                            severity=issue_data.get('severity'),
                            title=issue_data.get('title'),
                            description=issue_data.get('description'),
                            pottery_id=pottery.id,
                            rule_name=issue_data.get('rule_name'),
                            rule_details=issue_data.get('rule_details'),
                            detected_by='system'
                        )
                        db.session.add(issue)
        
        group_results = results.get('group_results', {})
        for group_id, result in group_results.items():
            issues = result.get('issues', [])
            if issues:
                group = SpliceGroup.query.filter_by(group_id=group_id).first()
                if group:
                    for issue_data in issues:
                        issue = Issue(
                            issue_type=issue_data.get('issue_type'),
                            severity=issue_data.get('severity'),
                            title=issue_data.get('title'),
                            description=issue_data.get('description'),
                            group_id=group.id,
                            rule_name=issue_data.get('rule_name'),
                            rule_details=issue_data.get('rule_details'),
                            detected_by='system'
                        )
                        db.session.add(issue)
        
        db.session.commit()
    
    return jsonify({
        'success': True,
        'data': results
    })


@review_bp.route('/group/<group_id>/start', methods=['POST'])
def start_review(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    
    result = state_machine.transition_group(group.status, 'start_review')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        old_values = group.to_dict()
        group.status = result.new_state
        
        VersionManager.create_version(
            group, 'splice_group',
            change_reason='开始复核',
            created_by=user
        )
        
        AuditService.log_group_update(
            group, old_values, user=user,
            notes='开始复核拼接组'
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '复核已开始',
            'data': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'开始复核失败: {str(e)}'
        }), 500


@review_bp.route('/group/<group_id>/approve', methods=['POST'])
def approve_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    review_notes = data.get('review_notes', '')
    
    result = state_machine.transition_group(group.status, 'approve')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        old_values = group.to_dict()
        group.status = result.new_state
        group.review_result = 'approved'
        group.review_notes = review_notes
        group.reviewed_by = user
        group.reviewed_at = datetime.utcnow()
        
        VersionManager.create_version(
            group, 'splice_group',
            change_reason='复核通过',
            created_by=user
        )
        
        AuditService.log_group_approve(group, user=user)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组审核通过',
            'data': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'审核失败: {str(e)}'
        }), 500


@review_bp.route('/group/<group_id>/reject', methods=['POST'])
def reject_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    review_notes = data.get('review_notes', '')
    
    result = state_machine.transition_group(group.status, 'reject')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        old_values = group.to_dict()
        group.status = result.new_state
        group.review_result = 'rejected'
        group.review_notes = review_notes
        group.reviewed_by = user
        group.reviewed_at = datetime.utcnow()
        
        VersionManager.create_version(
            group, 'splice_group',
            change_reason='复核驳回',
            created_by=user
        )
        
        AuditService.log_group_reject(group, user=user)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组审核驳回',
            'data': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'审核失败: {str(e)}'
        }), 500


@review_bp.route('/group/<group_id>/send-back', methods=['POST'])
def send_back_group(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    review_notes = data.get('review_notes', '')
    
    result = state_machine.transition_group(group.status, 'send_back')
    
    if not result.success:
        return jsonify({
            'success': False,
            'error': result.message,
            'errors': result.errors
        }), 400
    
    try:
        old_values = group.to_dict()
        group.status = result.new_state
        group.review_notes = review_notes
        
        VersionManager.create_version(
            group, 'splice_group',
            change_reason='退回修改',
            created_by=user
        )
        
        AuditService.log_group_update(
            group, old_values, user=user,
            notes='退回修改拼接组'
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '拼接组已退回修改',
            'data': group.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'退回失败: {str(e)}'
        }), 500


@review_bp.route('/issues', methods=['GET'])
def list_issues():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    severity = request.args.get('severity')
    group_id = request.args.get('group_id')
    pottery_id = request.args.get('pottery_id')
    
    query = Issue.query
    
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    
    if group_id:
        group = SpliceGroup.query.filter_by(group_id=group_id).first()
        if group:
            query = query.filter_by(group_id=group.id)
    
    if pottery_id:
        pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
        if pottery:
            query = query.filter_by(pottery_id=pottery.id)
    
    pagination = query.order_by(Issue.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'success': True,
        'data': {
            'issues': [i.to_dict() for i in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }
    })


@review_bp.route('/issues/<int:issue_id>/resolve', methods=['POST'])
def resolve_issue(issue_id):
    issue = Issue.query.get(issue_id)
    
    if not issue:
        return jsonify({
            'success': False,
            'error': '问题不存在',
            'issue_id': issue_id
        }), 404
    
    data = request.get_json() or {}
    user = data.get('user')
    resolution_notes = data.get('resolution_notes', '')
    
    try:
        issue.status = 'resolved'
        issue.resolved_at = datetime.utcnow()
        issue.resolved_by = user
        issue.resolution_notes = resolution_notes
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '问题已标记为已解决',
            'data': issue.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'解决问题失败: {str(e)}'
        }), 500


@review_bp.route('/audit-logs', methods=['GET'])
def get_audit_logs():
    entity_type = request.args.get('entity_type')
    entity_id = request.args.get('entity_id')
    action = request.args.get('action')
    user = request.args.get('user')
    limit = request.args.get('limit', 100, type=int)
    
    try:
        start_time = None
        end_time = None
        
        start_date_str = request.args.get('start_date')
        if start_date_str:
            start_time = datetime.strptime(start_date_str, '%Y-%m-%d')
        
        end_date_str = request.args.get('end_date')
        if end_date_str:
            end_time = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        logs = AuditService.get_logs(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user=user,
            start_time=start_time,
            end_time=end_time,
            limit=limit
        )
        
        return jsonify({
            'success': True,
            'data': {
                'logs': [log.to_dict() for log in logs],
                'count': len(logs)
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取审计日志失败: {str(e)}'
        }), 500


@review_bp.route('/audit-stats', methods=['GET'])
def get_audit_stats():
    try:
        start_time = None
        end_time = None
        
        start_date_str = request.args.get('start_date')
        if start_date_str:
            start_time = datetime.strptime(start_date_str, '%Y-%m-%d')
        
        end_date_str = request.args.get('end_date')
        if end_date_str:
            end_time = datetime.strptime(end_date_str, '%Y-%m-%d')
        
        stats = AuditService.get_audit_stats(
            start_time=start_time,
            end_time=end_time
        )
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'获取审计统计失败: {str(e)}'
        }), 500


@review_bp.route('/state-flow', methods=['GET'])
def get_state_flow():
    entity_type = request.args.get('type', 'group')
    
    if entity_type == 'pottery':
        state_flow = state_machine.get_pottery_state_flow()
        states = state_machine.get_all_pottery_states()
    else:
        state_flow = state_machine.get_group_state_flow()
        states = state_machine.get_all_group_states()
    
    return jsonify({
        'success': True,
        'data': {
            'entity_type': entity_type,
            'states': states,
            'transitions': state_flow
        }
    })


@review_bp.route('/group/<group_id>/available-actions', methods=['GET'])
def get_available_actions(group_id):
    group = SpliceGroup.query.filter_by(group_id=group_id).first()
    
    if not group:
        return jsonify({
            'success': False,
            'error': '拼接组不存在',
            'group_id': group_id
        }), 404
    
    actions = state_machine.get_available_group_actions(group.status)
    
    return jsonify({
        'success': True,
        'data': {
            'group_id': group.group_id,
            'current_status': group.status,
            'available_actions': actions
        }
    })
