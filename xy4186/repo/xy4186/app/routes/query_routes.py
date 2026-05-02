from collections import defaultdict
from flask import Blueprint, request, jsonify
from datetime import datetime, date

from app.services.storage_service import StorageService
from app.services.state_machine import BroadcastStateMachine

query_bp = Blueprint('query', __name__)

@query_bp.route('/programs', methods=['GET'])
def list_programs():
    broadcast_date = request.args.get('date')
    channel = request.args.get('channel')
    
    date_obj = None
    if broadcast_date:
        try:
            date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
        except:
            return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    programs = StorageService.list_programs(broadcast_date=date_obj, channel=channel)
    
    return jsonify({
        'success': True,
        'count': len(programs),
        'programs': [
            {
                'id': p.id,
                'program_code': p.program_code,
                'program_name': p.program_name,
                'category': p.category,
                'is_children_program': p.is_children_program,
                'broadcast_date': str(p.broadcast_date),
                'start_time': str(p.start_time) if p.start_time else None,
                'end_time': str(p.end_time) if p.end_time else None,
                'duration_seconds': p.duration_seconds,
                'channel': p.channel
            }
            for p in programs
        ]
    })

@query_bp.route('/program/<int:program_id>', methods=['GET'])
def get_program(program_id):
    from app.models.models import Program
    from app import db
    
    program = Program.query.get(program_id)
    if not program:
        return jsonify({'success': False, 'error': '节目不存在'}), 404
    
    return jsonify({
        'success': True,
        'program': {
            'id': program.id,
            'program_code': program.program_code,
            'program_name': program.program_name,
            'category': program.category,
            'is_children_program': program.is_children_program,
            'broadcast_date': str(program.broadcast_date),
            'start_time': str(program.start_time) if program.start_time else None,
            'end_time': str(program.end_time) if program.end_time else None,
            'duration_seconds': program.duration_seconds,
            'channel': program.channel
        }
    })

@query_bp.route('/contracts', methods=['GET'])
def list_contracts():
    status = request.args.get('status')
    
    contracts = StorageService.list_contracts(status=status)
    
    return jsonify({
        'success': True,
        'count': len(contracts),
        'contracts': [
            {
                'id': c.id,
                'contract_code': c.contract_code,
                'contract_name': c.contract_name,
                'advertiser_name': c.advertiser_name,
                'brand_name': c.brand_name,
                'industry_category': c.industry_category,
                'total_amount': c.total_amount,
                'total_duration_seconds': c.total_duration_seconds,
                'used_duration_seconds': c.used_duration_seconds,
                'remaining_duration_seconds': c.remaining_duration_seconds,
                'start_date': str(c.start_date),
                'end_date': str(c.end_date),
                'status': c.status
            }
            for c in contracts
        ]
    })

@query_bp.route('/contract/<int:contract_id>', methods=['GET'])
def get_contract(contract_id):
    from app.models.models import Contract
    from app import db
    
    contract = Contract.query.get(contract_id)
    if not contract:
        return jsonify({'success': False, 'error': '合同不存在'}), 404
    
    return jsonify({
        'success': True,
        'contract': {
            'id': contract.id,
            'contract_code': contract.contract_code,
            'contract_name': contract.contract_name,
            'advertiser_name': contract.advertiser_name,
            'brand_name': contract.brand_name,
            'industry_category': contract.industry_category,
            'total_amount': contract.total_amount,
            'total_duration_seconds': contract.total_duration_seconds,
            'used_duration_seconds': contract.used_duration_seconds,
            'remaining_duration_seconds': contract.remaining_duration_seconds,
            'start_date': str(contract.start_date),
            'end_date': str(contract.end_date),
            'status': contract.status
        }
    })

@query_bp.route('/events', methods=['GET'])
def list_events():
    broadcast_date = request.args.get('date')
    source_type = request.args.get('source_type')
    status = request.args.get('status')
    
    date_obj = None
    if broadcast_date:
        try:
            date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
        except:
            return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    events = StorageService.list_events(
        broadcast_date=date_obj,
        source_type=source_type,
        status=status
    )
    
    return jsonify({
        'success': True,
        'count': len(events),
        'events': [
            {
                'id': e.id,
                'event_code': e.event_code,
                'brand_name': e.brand_name,
                'ad_name': e.ad_name,
                'duration_seconds': e.duration_seconds,
                'industry_category': e.industry_category,
                'broadcast_date': str(e.broadcast_date),
                'broadcast_time': str(e.broadcast_time) if e.broadcast_time else None,
                'source_type': e.source_type,
                'status': e.status,
                'is_rerun': e.is_rerun,
                'log_verified': e.log_verified
            }
            for e in events
        ]
    })

@query_bp.route('/event/<int:event_id>', methods=['GET'])
def get_event(event_id):
    from app.models.models import BroadcastEvent
    from app import db
    
    event = BroadcastEvent.query.get(event_id)
    if not event:
        return jsonify({'success': False, 'error': '事件不存在'}), 404
    
    workflow = BroadcastStateMachine.get_event_workflow_status(event_id)
    
    return jsonify({
        'success': True,
        'event': {
            'id': event.id,
            'event_code': event.event_code,
            'brand_name': event.brand_name,
            'ad_name': event.ad_name,
            'duration_seconds': event.duration_seconds,
            'industry_category': event.industry_category,
            'broadcast_date': str(event.broadcast_date),
            'broadcast_time': str(event.broadcast_time) if event.broadcast_time else None,
            'source_type': event.source_type,
            'status': event.status,
            'is_rerun': event.is_rerun,
            'log_verified': event.log_verified
        },
        'workflow': workflow
    })

@query_bp.route('/events/brand/<brand_name>', methods=['GET'])
def get_events_by_brand(brand_name):
    broadcast_date = request.args.get('date')
    
    date_obj = None
    if broadcast_date:
        try:
            date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
        except:
            return jsonify({'success': False, 'error': '日期格式错误'}), 400
    
    events = StorageService.get_events_by_brand(brand_name, broadcast_date=date_obj)
    
    return jsonify({
        'success': True,
        'brand': brand_name,
        'count': len(events),
        'events': [
            {
                'id': e.id,
                'broadcast_date': str(e.broadcast_date),
                'broadcast_time': str(e.broadcast_time) if e.broadcast_time else None,
                'ad_name': e.ad_name,
                'duration_seconds': e.duration_seconds,
                'source_type': e.source_type,
                'status': e.status
            }
            for e in events
        ]
    })

@query_bp.route('/blackouts', methods=['GET'])
def list_blackouts():
    blackouts = StorageService.list_active_blackout_periods()
    
    return jsonify({
        'success': True,
        'count': len(blackouts),
        'blackout_periods': [
            {
                'id': b.id,
                'name': b.name,
                'description': b.description,
                'start_date': str(b.start_date) if b.start_date else None,
                'end_date': str(b.end_date) if b.end_date else None,
                'day_of_week': b.day_of_week,
                'start_time': str(b.start_time) if b.start_time else None,
                'end_time': str(b.end_time) if b.end_time else None,
                'restricted_categories': b.restricted_categories
            }
            for b in blackouts
        ]
    })

@query_bp.route('/conflicts', methods=['GET'])
def list_conflicts():
    conflicts = StorageService.list_active_conflicts()
    
    return jsonify({
        'success': True,
        'count': len(conflicts),
        'industry_conflicts': [
            {
                'id': c.id,
                'category_a': c.category_a,
                'category_b': c.category_b,
                'min_interval_seconds': c.min_interval_seconds,
                'description': c.description
            }
            for c in conflicts
        ]
    })

@query_bp.route('/validation/results', methods=['GET'])
def list_validation_results():
    event_id = request.args.get('event_id', type=int)
    status = request.args.get('status')
    validation_type = request.args.get('type')
    
    results = StorageService.get_validation_results(
        event_id=event_id,
        status=status,
        validation_type=validation_type
    )
    
    return jsonify({
        'success': True,
        'count': len(results),
        'validation_results': [
            {
                'id': r.id,
                'event_id': r.event_id,
                'validation_type': r.validation_type,
                'rule_code': r.rule_code,
                'severity': r.severity,
                'title': r.title,
                'description': r.description,
                'affected_date': str(r.affected_date) if r.affected_date else None,
                'affected_time': str(r.affected_time) if r.affected_time else None,
                'related_brand': r.related_brand,
                'status': r.status,
                'resolution_note': r.resolution_note
            }
            for r in results
        ]
    })

@query_bp.route('/stats/daily', methods=['GET'])
def get_daily_stats():
    broadcast_date = request.args.get('date')
    
    if not broadcast_date:
        return jsonify({'success': False, 'error': '请指定日期参数'}), 400
    
    try:
        date_obj = datetime.strptime(broadcast_date, '%Y-%m-%d').date()
    except:
        return jsonify({'success': False, 'error': '日期格式错误，请使用 YYYY-MM-DD'}), 400
    
    schedule_events = StorageService.list_events(
        broadcast_date=date_obj,
        source_type='schedule'
    )
    log_events = StorageService.list_events(
        broadcast_date=date_obj,
        source_type='log'
    )
    
    programs = StorageService.list_programs(broadcast_date=date_obj)
    children_programs = StorageService.get_children_programs(broadcast_date=date_obj)
    
    brand_stats = defaultdict(int)
    category_stats = defaultdict(int)
    
    for e in schedule_events:
        if e.brand_name:
            brand_stats[e.brand_name] += 1
        if e.industry_category:
                category_stats[e.industry_category] += 1
    
    return jsonify({
        'success': True,
        'date': str(date_obj),
        'stats': {
            'schedule_count': len(schedule_events),
            'log_count': len(log_events),
            'program_count': len(programs),
            'children_program_count': len(children_programs),
            'unique_brands': len(brand_stats),
            'brand_counts': dict(brand_stats),
            'category_counts': dict(category_stats)
        }
    })
