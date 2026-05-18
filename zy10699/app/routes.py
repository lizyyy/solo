from datetime import datetime
from flask import Blueprint, request, jsonify, make_response
from app import db
from app.models import DataTable, QualityRule, RuleSilence, Alert
from app.services import SilenceService
import io
import csv
from openpyxl import Workbook

silence_bp = Blueprint('silence', __name__)
rule_bp = Blueprint('rule', __name__)
alert_bp = Blueprint('alert', __name__)

@silence_bp.route('/apply', methods=['POST'])
def apply_silence():
    data = request.get_json()
    required_fields = ['rule_id', 'table_id', 'applicant', 'reason', 'start_time', 'end_time']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    try:
        start_time = datetime.fromisoformat(data['start_time'])
        end_time = datetime.fromisoformat(data['end_time'])
    except ValueError:
        return jsonify({'error': 'Invalid datetime format. Use ISO format'}), 400
    
    if start_time >= end_time:
        return jsonify({'error': 'end_time must be after start_time'}), 400
    
    rule = QualityRule.query.get(data['rule_id'])
    if not rule:
        return jsonify({'error': 'Quality rule not found'}), 404
    
    table = DataTable.query.get(data['table_id'])
    if not table:
        return jsonify({'error': 'Data table not found'}), 404
    
    existing_active = RuleSilence.query.filter(
        RuleSilence.rule_id == data['rule_id'],
        RuleSilence.status.in_(['pending', 'approved']),
        RuleSilence.restore_status == 'pending',
        RuleSilence.start_time <= end_time,
        RuleSilence.end_time >= start_time
    ).first()
    
    if existing_active:
        return jsonify({'error': 'An active silence already exists for this rule in the requested time period'}), 400
    
    silence = RuleSilence(
        rule_id=data['rule_id'],
        table_id=data['table_id'],
        applicant=data['applicant'],
        reason=data['reason'],
        start_time=start_time,
        end_time=end_time,
        status='pending'
    )
    
    db.session.add(silence)
    db.session.commit()
    
    return jsonify({
        'message': 'Silence application submitted successfully',
        'silence_id': silence.id,
        'status': silence.status
    }), 201

@silence_bp.route('/approve/<int:silence_id>', methods=['POST'])
def approve_silence(silence_id):
    data = request.get_json() or {}
    approver = data.get('approver')
    
    if not approver:
        return jsonify({'error': 'Approver is required'}), 400
    
    silence = RuleSilence.query.get(silence_id)
    if not silence:
        return jsonify({'error': 'Silence application not found'}), 404
    
    if silence.status != 'pending':
        return jsonify({'error': f'Cannot approve silence with status: {silence.status}'}), 400
    
    silence.status = 'approved'
    silence.approver = approver
    silence.approved_at = datetime.utcnow()
    
    SilenceService.silence_alerts(silence)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Silence approved successfully',
        'silence_id': silence.id,
        'status': silence.status
    })

@silence_bp.route('/reject/<int:silence_id>', methods=['POST'])
def reject_silence(silence_id):
    data = request.get_json() or {}
    approver = data.get('approver')
    reason = data.get('reason')
    
    if not approver:
        return jsonify({'error': 'Approver is required'}), 400
    
    silence = RuleSilence.query.get(silence_id)
    if not silence:
        return jsonify({'error': 'Silence application not found'}), 404
    
    if silence.status != 'pending':
        return jsonify({'error': f'Cannot reject silence with status: {silence.status}'}), 400
    
    silence.status = 'rejected'
    silence.approver = approver
    silence.approved_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'message': 'Silence rejected successfully',
        'silence_id': silence.id,
        'status': silence.status
    })

@silence_bp.route('/check-expired', methods=['POST'])
def check_expired_silences():
    now = datetime.utcnow()
    expired_silences = RuleSilence.query.filter(
        RuleSilence.status == 'approved',
        RuleSilence.restore_status == 'pending',
        RuleSilence.end_time < now
    ).all()
    
    results = []
    for silence in expired_silences:
        silence.status = 'expired'
        silence.expired_at = now
        
        success = SilenceService.restore_alerts(silence)
        
        if success:
            silence.restore_status = 'auto_restored'
            silence.restored_at = datetime.utcnow()
            results.append({
                'silence_id': silence.id,
                'rule_id': silence.rule_id,
                'status': 'auto_restored',
                'message': 'Alerts automatically restored'
            })
        else:
            silence.restore_status = 'failed'
            results.append({
                'silence_id': silence.id,
                'rule_id': silence.rule_id,
                'status': 'restore_failed',
                'message': 'Automatic restore failed, manual intervention required'
            })
        
        silence.last_restore_attempt = now
        silence.restore_attempts += 1
    
    db.session.commit()
    
    return jsonify({
        'checked': len(expired_silences),
        'results': results
    })

@silence_bp.route('/failed-restore', methods=['GET'])
def get_failed_restore():
    failed_silences = RuleSilence.query.filter(
        RuleSilence.restore_status == 'failed'
    ).all()
    
    result = []
    for silence in failed_silences:
        rule = QualityRule.query.get(silence.rule_id)
        table = DataTable.query.get(silence.table_id)
        result.append({
            'silence_id': silence.id,
            'rule_id': silence.rule_id,
            'rule_name': rule.rule_name if rule else None,
            'rule_code': rule.rule_code if rule else None,
            'table_id': silence.table_id,
            'table_name': table.table_name if table else None,
            'reason': silence.reason,
            'end_time': silence.end_time.isoformat(),
            'restore_attempts': silence.restore_attempts,
            'restore_error': silence.restore_error
        })
    
    return jsonify({'count': len(result), 'silences': result})

@silence_bp.route('/restore/<int:silence_id>', methods=['POST'])
def manual_restore(silence_id):
    data = request.get_json() or {}
    restorer = data.get('restorer')
    
    if not restorer:
        return jsonify({'error': 'Restorer is required'}), 400
    
    silence = RuleSilence.query.get(silence_id)
    if not silence:
        return jsonify({'error': 'Silence not found'}), 404
    
    if silence.restore_status not in ['failed', 'pending']:
        return jsonify({'error': f'Cannot restore silence with status: {silence.restore_status}'}), 400
    
    success = SilenceService.restore_alerts(silence, manual=True)
    
    if success:
        silence.restore_status = 'manual_restored'
        silence.restored_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Alerts manually restored successfully',
            'silence_id': silence.id,
            'restore_status': silence.restore_status
        })
    else:
        return jsonify({
            'error': 'Manual restore failed',
            'restore_error': silence.restore_error
        }), 500

@silence_bp.route('/export', methods=['GET'])
def export_silences():
    format_type = request.args.get('format', 'csv')
    status_filter = request.args.get('status')
    
    query = RuleSilence.query
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    silences = query.all()
    
    if format_type == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            'ID', 'Rule ID', 'Rule Name', 'Table ID', 'Table Name',
            'Applicant', 'Approver', 'Reason', 'Start Time', 'End Time',
            'Status', 'Restore Status', 'Created At', 'Approved At', 'Restored At'
        ])
        
        for s in silences:
            rule = QualityRule.query.get(s.rule_id)
            table = DataTable.query.get(s.table_id)
            writer.writerow([
                s.id, s.rule_id, rule.rule_name if rule else '',
                s.table_id, table.table_name if table else '',
                s.applicant, s.approver or '', s.reason,
                s.start_time.isoformat(), s.end_time.isoformat(),
                s.status, s.restore_status,
                s.created_at.isoformat(),
                s.approved_at.isoformat() if s.approved_at else '',
                s.restored_at.isoformat() if s.restored_at else ''
            ])
        
        output.seek(0)
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename=rule_silences.csv'
        return response
    
    elif format_type == 'excel':
        output = io.BytesIO()
        wb = Workbook()
        ws = wb.active
        ws.title = 'Rule Silences'
        
        headers = [
            'ID', 'Rule ID', 'Rule Name', 'Table ID', 'Table Name',
            'Applicant', 'Approver', 'Reason', 'Start Time', 'End Time',
            'Status', 'Restore Status', 'Created At', 'Approved At', 'Restored At'
        ]
        ws.append(headers)
        
        for s in silences:
            rule = QualityRule.query.get(s.rule_id)
            table = DataTable.query.get(s.table_id)
            ws.append([
                s.id, s.rule_id, rule.rule_name if rule else '',
                s.table_id, table.table_name if table else '',
                s.applicant, s.approver or '', s.reason,
                s.start_time.isoformat(), s.end_time.isoformat(),
                s.status, s.restore_status,
                s.created_at.isoformat(),
                s.approved_at.isoformat() if s.approved_at else '',
                s.restored_at.isoformat() if s.restored_at else ''
            ])
        
        wb.save(output)
        output.seek(0)
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = 'attachment; filename=rule_silences.xlsx'
        return response
    
    else:
        return jsonify({'error': 'Unsupported format. Use csv or excel'}), 400

@silence_bp.route('', methods=['GET'])
def list_silences():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    
    query = RuleSilence.query
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(RuleSilence.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    result = []
    for s in pagination.items:
        rule = QualityRule.query.get(s.rule_id)
        table = DataTable.query.get(s.table_id)
        result.append({
            'id': s.id,
            'rule_id': s.rule_id,
            'rule_name': rule.rule_name if rule else None,
            'table_id': s.table_id,
            'table_name': table.table_name if table else None,
            'applicant': s.applicant,
            'approver': s.approver,
            'reason': s.reason,
            'start_time': s.start_time.isoformat(),
            'end_time': s.end_time.isoformat(),
            'status': s.status,
            'restore_status': s.restore_status,
            'is_active': s.is_active,
            'is_expired': s.is_expired
        })
    
    return jsonify({
        'items': result,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })

@silence_bp.route('/<int:silence_id>', methods=['GET'])
def get_silence(silence_id):
    silence = RuleSilence.query.get(silence_id)
    if not silence:
        return jsonify({'error': 'Silence not found'}), 404
    
    rule = QualityRule.query.get(silence.rule_id)
    table = DataTable.query.get(silence.table_id)
    
    return jsonify({
        'id': silence.id,
        'rule_id': silence.rule_id,
        'rule_name': rule.rule_name if rule else None,
        'table_id': silence.table_id,
        'table_name': table.table_name if table else None,
        'applicant': silence.applicant,
        'approver': silence.approver,
        'reason': silence.reason,
        'start_time': silence.start_time.isoformat(),
        'end_time': silence.end_time.isoformat(),
        'status': silence.status,
        'restore_status': silence.restore_status,
        'restore_attempts': silence.restore_attempts,
        'alert_history': silence.alert_history,
        'is_active': silence.is_active,
        'is_expired': silence.is_expired
    })

@rule_bp.route('/rename/<int:rule_id>', methods=['POST'])
def rename_rule(rule_id):
    data = request.get_json()
    new_name = data.get('new_name')
    renamed_by = data.get('renamed_by')
    
    if not new_name or not renamed_by:
        return jsonify({'error': 'new_name and renamed_by are required'}), 400
    
    rule = QualityRule.query.get(rule_id)
    if not rule:
        return jsonify({'error': 'Rule not found'}), 404
    
    old_name = rule.rule_name
    name_history = rule.name_history or []
    name_history.append({
        'old_name': old_name,
        'new_name': new_name,
        'renamed_by': renamed_by,
        'renamed_at': datetime.utcnow().isoformat()
    })
    
    rule.rule_name = new_name
    rule.name_history = name_history
    
    SilenceService.handle_rule_rename(rule_id, old_name, new_name)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Rule renamed successfully',
        'rule_id': rule_id,
        'old_name': old_name,
        'new_name': new_name
    })

@rule_bp.route('/migrate-table/<int:table_id>', methods=['POST'])
def migrate_table(table_id):
    data = request.get_json()
    new_database = data.get('new_database')
    new_schema = data.get('new_schema')
    new_table_name = data.get('new_table_name')
    migrated_by = data.get('migrated_by')
    
    if not all([new_database, new_table_name, migrated_by]):
        return jsonify({'error': 'new_database, new_table_name, and migrated_by are required'}), 400
    
    table = DataTable.query.get(table_id)
    if not table:
        return jsonify({'error': 'Table not found'}), 404
    
    old_database = table.database_name
    old_schema = table.schema_name
    old_table_name = table.table_name
    
    migration_history = table.migration_history or []
    migration_history.append({
        'old_database': old_database,
        'old_schema': old_schema,
        'old_table_name': old_table_name,
        'new_database': new_database,
        'new_schema': new_schema,
        'new_table_name': new_table_name,
        'migrated_by': migrated_by,
        'migrated_at': datetime.utcnow().isoformat()
    })
    
    table.database_name = new_database
    table.schema_name = new_schema
    table.table_name = new_table_name
    table.migration_history = migration_history
    
    affected_rules = SilenceService.handle_table_migration(
        table_id, old_database, old_schema, old_table_name,
        new_database, new_schema, new_table_name
    )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Table migrated successfully',
        'table_id': table_id,
        'affected_rules_count': len(affected_rules),
        'affected_rules': affected_rules
    })

@alert_bp.route('/merge', methods=['POST'])
def merge_alerts():
    data = request.get_json()
    source_alert_ids = data.get('source_alert_ids', [])
    target_alert_id = data.get('target_alert_id')
    merged_by = data.get('merged_by')
    
    if not source_alert_ids or not target_alert_id or not merged_by:
        return jsonify({'error': 'source_alert_ids, target_alert_id, and merged_by are required'}), 400
    
    if target_alert_id in source_alert_ids:
        return jsonify({'error': 'target_alert_id cannot be in source_alert_ids'}), 400
    
    target_alert = Alert.query.get(target_alert_id)
    if not target_alert:
        return jsonify({'error': 'Target alert not found'}), 404
    
    merged_count = SilenceService.handle_alert_merge(source_alert_ids, target_alert_id, merged_by)
    
    return jsonify({
        'message': f'Successfully merged {merged_count} alerts',
        'target_alert_id': target_alert_id,
        'merged_count': merged_count
    })

@rule_bp.route('', methods=['POST'])
def create_rule():
    data = request.get_json()
    required_fields = ['rule_code', 'rule_name', 'rule_type', 'table_id']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    if QualityRule.query.filter_by(rule_code=data['rule_code']).first():
        return jsonify({'error': 'Rule code already exists'}), 400
    
    rule = QualityRule(
        rule_code=data['rule_code'],
        rule_name=data['rule_name'],
        rule_type=data['rule_type'],
        table_id=data['table_id'],
        column_name=data.get('column_name'),
        expression=data.get('expression'),
        threshold=data.get('threshold'),
        severity=data.get('severity', 'warning')
    )
    
    db.session.add(rule)
    db.session.commit()
    
    return jsonify({'message': 'Rule created successfully', 'rule_id': rule.id}), 201

@rule_bp.route('', methods=['GET'])
def list_rules():
    rules = QualityRule.query.all()
    result = []
    for r in rules:
        result.append({
            'id': r.id,
            'rule_code': r.rule_code,
            'rule_name': r.rule_name,
            'rule_type': r.rule_type,
            'table_id': r.table_id,
            'status': r.status
        })
    return jsonify({'rules': result})

@alert_bp.route('', methods=['POST'])
def create_alert():
    data = request.get_json()
    required_fields = ['rule_id', 'table_id', 'alert_type']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    alert = Alert(
        rule_id=data['rule_id'],
        table_id=data['table_id'],
        alert_type=data['alert_type'],
        severity=data.get('severity', 'warning'),
        message=data.get('message')
    )
    
    db.session.add(alert)
    db.session.commit()
    
    return jsonify({'message': 'Alert created successfully', 'alert_id': alert.id}), 201

@alert_bp.route('', methods=['GET'])
def list_alerts():
    alerts = Alert.query.all()
    result = []
    for a in alerts:
        result.append({
            'id': a.id,
            'rule_id': a.rule_id,
            'table_id': a.table_id,
            'alert_type': a.alert_type,
            'status': a.status,
            'merged_into': a.merged_into,
            'silenced_by': a.silenced_by
        })
    return jsonify({'alerts': result})
