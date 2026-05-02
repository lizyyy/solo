from flask import Blueprint, request, jsonify
from datetime import datetime, date

from app.services.storage_service import StorageService

opinion_bp = Blueprint('opinion', __name__)

@opinion_bp.route('/add', methods=['POST'])
def add_opinion():
    data = request.get_json() if request.is_json else request.form
    
    def _get_int(value):
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    validation_result_id = _get_int(data.get('validation_result_id'))
    event_id = _get_int(data.get('event_id'))
    opinion_type = data.get('opinion_type')
    content = data.get('content')
    reviewer_name = data.get('reviewer_name')
    decision = data.get('decision')
    is_overruled = data.get('is_overruled', False)
    
    if not content:
        return jsonify({'success': False, 'error': '请提供意见内容'}), 400
    
    if not validation_result_id and not event_id:
        return jsonify({'success': False, 'error': '请提供校验结果ID或事件ID'}), 400
    
    try:
        opinion_data = {
            'validation_result_id': validation_result_id,
            'event_id': event_id,
            'opinion_type': opinion_type or 'comment',
            'content': content,
            'reviewer_name': reviewer_name,
            'decision': decision,
            'is_overruled': bool(is_overruled)
        }
        
        opinion = StorageService.create_human_opinion(opinion_data)
        
        return jsonify({
            'success': True,
            'message': '意见已添加',
            'opinion': {
                'id': opinion.id,
                'validation_result_id': opinion.validation_result_id,
                'event_id': opinion.event_id,
                'opinion_type': opinion.opinion_type,
                'content': opinion.content,
                'reviewer_name': opinion.reviewer_name,
                'decision': opinion.decision,
                'is_overruled': opinion.is_overruled,
                'created_at': opinion.created_at.isoformat() if opinion.created_at else None
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@opinion_bp.route('/validation/<int:validation_id>', methods=['GET'])
def get_opinions_by_validation(validation_id):
    try:
        opinions = StorageService.get_opinions_by_validation(validation_id)
        
        return jsonify({
            'success': True,
            'validation_result_id': validation_id,
            'count': len(opinions),
            'opinions': [
                {
                    'id': o.id,
                    'opinion_type': o.opinion_type,
                    'content': o.content,
                    'reviewer_name': o.reviewer_name,
                    'decision': o.decision,
                    'is_overruled': o.is_overruled,
                    'created_at': o.created_at.isoformat() if o.created_at else None
                }
                for o in opinions
            ]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@opinion_bp.route('/types', methods=['GET'])
def get_opinion_types():
    types = [
        {'code': 'comment', 'name': '备注说明', 'description': '一般性备注或说明'},
        {'code': 'approval', 'name': '审批通过', 'description': '人工审批通过'},
        {'code': 'rejection', 'name': '审批驳回', 'description': '人工审批驳回'},
        {'code': 'override', 'name': '规则豁免', 'description': '豁免规则校验'},
        {'code': 'clarification', 'name': '问题澄清', 'description': '对问题的澄清说明'},
        {'code': 'correction', 'name': '数据更正', 'description': '数据更正记录'}
    ]
    
    return jsonify({
        'success': True,
        'types': types
    })

@opinion_bp.route('/decisions', methods=['GET'])
def get_decision_options():
    decisions = [
        {'code': 'approve', 'name': '同意', 'description': '同意当前状态或处理方式'},
        {'code': 'reject', 'name': '拒绝', 'description': '拒绝当前状态或处理方式'},
        {'code': 'defer', 'name': '待议', 'description': '暂缓处理，待进一步确认'},
        {'code': 'escalate', 'name': '上报', 'description': '需要上报上级处理'}
    ]
    
    return jsonify({
        'success': True,
        'decisions': decisions
    })
