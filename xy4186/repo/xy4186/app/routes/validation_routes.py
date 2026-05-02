from flask import Blueprint, request, jsonify
from datetime import datetime, date

from app.services.rules_engine import RulesEngine
from app.services.storage_service import StorageService
from app.services.state_machine import BroadcastStateMachine

validation_bp = Blueprint('validation', __name__)

@validation_bp.route('/daily', methods=['POST'])
def validate_daily():
    broadcast_date = request.json.get('date') if request.is_json else request.form.get('date')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        result = RulesEngine.validate_all(date_obj)
        
        failed_results = [r for r in result.get('results', []) if not r.get('passed')]
        for r in failed_results:
            try:
                affected_date = None
                if r.get('affected_date'):
                    affected_date = datetime.strptime(r['affected_date'], '%Y-%m-%d').date()
                
                affected_time = None
                if r.get('affected_time'):
                    affected_time = datetime.strptime(r['affected_time'], '%H:%M:%S').time()
                
                StorageService.create_validation_result({
                    'validation_type': 'daily_check',
                    'rule_code': r.get('rule_code'),
                    'severity': r.get('severity'),
                    'title': r.get('title'),
                    'description': r.get('description'),
                    'affected_date': affected_date,
                    'affected_time': affected_time,
                    'related_brand': r.get('related_brand'),
                    'status': 'open'
                })
            except Exception as e:
                pass
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'validation_summary': {
                'rule_count': result.get('validation_count', 0),
                'error_count': result.get('error_count', 0),
                'warning_count': result.get('warning_count', 0),
                'is_compliant': result.get('error_count', 0) == 0
            },
            'validation_details': result.get('results', [])
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@validation_bp.route('/reconcile', methods=['POST'])
def reconcile_schedule_log():
    broadcast_date = request.json.get('date') if request.is_json else request.form.get('date')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    try:
        result = RulesEngine.compare_schedule_vs_log(date_obj)
        
        return jsonify({
            'success': True,
            'date': str(date_obj),
            'reconciliation': {
                'schedule_count': result.get('schedule_count', 0),
                'log_count': result.get('log_count', 0),
                'matched_count': result.get('matched_count', 0),
                'consistent': result.get('consistent', False),
                'missing_in_log': result.get('missing_in_log', []),
                'missing_in_schedule': result.get('missing_in_schedule', []),
                'matched_details': result.get('matched', [])
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@validation_bp.route('/result/<int:result_id>', methods=['PUT'])
def update_validation_result(result_id):
    data = request.get_json() if request.is_json else request.form
    
    status = data.get('status')
    resolution_note = data.get('resolution_note')
    
    if not status and not resolution_note:
        return jsonify({'success': False, 'error': '请提供要更新的字段'}), 400
    
    try:
        updates = {}
        if status:
            updates['status'] = status
        if resolution_note:
            updates['resolution_note'] = resolution_note
        
        result = StorageService.update_validation_result(result_id, **updates)
        
        if not result:
            return jsonify({'success': False, 'error': '校验结果不存在'}), 404
        
        return jsonify({
            'success': True,
            'message': '校验结果已更新',
            'result': {
                'id': result.id,
                'status': result.status,
                'resolution_note': result.resolution_note
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@validation_bp.route('/event/<int:event_id>/status', methods=['PUT'])
def update_event_status(event_id):
    data = request.get_json() if request.is_json else request.form
    
    new_status = data.get('status')
    operator = data.get('operator')
    reason = data.get('reason')
    
    if not new_status:
        return jsonify({'success': False, 'error': '请提供新状态'}), 400
    
    try:
        result = BroadcastStateMachine.transition_event(
            event_id, new_status, operator=operator, reason=reason
        )
        
        if not result.get('success'):
            return jsonify(result), 400
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@validation_bp.route('/rules', methods=['GET'])
def list_rules():
    rules = [
        {
            'code': 'CONSECUTIVE_BRAND',
            'name': '同一品牌连播检查',
            'description': '检查同一品牌是否连续播出超过限制次数',
            'severity': 'error',
            'config': {
                'max_consecutive': RulesEngine.MAX_CONSECUTIVE_SAME_BRAND
            }
        },
        {
            'code': 'BRAND_FREQUENCY',
            'name': '品牌日播出频次检查',
            'description': '检查同一品牌日播出次数是否超过限制',
            'severity': 'error',
            'config': {
                'max_daily_frequency': RulesEngine.MAX_DAILY_FREQUENCY_PER_BRAND
            }
        },
        {
            'code': 'BRAND_INTERVAL',
            'name': '同品牌间隔检查',
            'description': '检查同一品牌两次播出间隔是否满足最小间隔',
            'severity': 'warning',
            'config': {
                'min_interval_seconds': RulesEngine.MIN_INTERVAL_SAME_BRAND_SECONDS
            }
        },
        {
            'code': 'INDUSTRY_CONFLICT',
            'name': '行业竞品间隔检查',
            'description': '检查竞品行业广告播出间隔是否满足要求',
            'severity': 'warning',
            'config': {}
        },
        {
            'code': 'BLACKOUT_PERIOD',
            'name': '禁播时段检查',
            'description': '检查广告是否在禁播时段播出',
            'severity': 'error',
            'config': {}
        },
        {
            'code': 'CHILDREN_PROGRAM',
            'name': '少儿节目限制检查',
            'description': '检查少儿节目时段是否插播受限品类广告',
            'severity': 'error',
            'config': {
                'restricted_categories': RulesEngine.CHILDREN_PROGRAM_RESTRICTED_CATEGORIES
            }
        },
        {
            'code': 'CONTRACT_BALANCE',
            'name': '合同余量检查',
            'description': '检查播出广告是否有足够的合同余量',
            'severity': 'error',
            'config': {}
        },
        {
            'code': 'RERUN_DUPLICATE',
            'name': '补播去重检查',
            'description': '检查补播广告是否存在重复计费风险',
            'severity': 'warning',
            'config': {}
        },
        {
            'code': 'DURATION_CONSISTENCY',
            'name': '时长一致性检查',
            'description': '检查广告时长是否为标准值',
            'severity': 'warning',
            'config': {
                'standard_durations': [5, 10, 15, 20, 30, 45, 60, 90, 120]
            }
        }
    ]
    
    return jsonify({
        'success': True,
        'rules': rules
    })
