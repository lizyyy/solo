from flask import Blueprint, request, jsonify
from app import db
from app.models import Scaffold, RectificationRecord, ConflictRecord, OverdueRecord, WorkPermit, AcceptanceRecord, DailySummary
from datetime import datetime, date, timedelta
from sqlalchemy import and_, or_
from sqlalchemy.orm import aliased

query_bp = Blueprint('query', __name__)

@query_bp.route('/today-disabled', methods=['GET'])
def get_today_disabled():
    today = date.today()
    
    disabled_scaffolds = db.session.query(
        Scaffold,
        AcceptanceRecord,
        OverdueRecord
    ).outerjoin(
        AcceptanceRecord, Scaffold.id == AcceptanceRecord.scaffold_id
    ).outerjoin(
        OverdueRecord, Scaffold.id == OverdueRecord.scaffold_id
    ).filter(
        or_(
            Scaffold.status == 'disabled',
            and_(
                Scaffold.status == 'overdue',
                OverdueRecord.resolved == False
            )
        )
    ).all()
    
    result = []
    for scaffold, acceptance, overdue in disabled_scaffolds:
        item = {
            'scaffold_no': scaffold.scaffold_no,
            'area': scaffold.area,
            'location': scaffold.location,
            'status': scaffold.status,
            'height': scaffold.height,
            'type': scaffold.type
        }
        
        if acceptance:
            item['acceptance_date'] = acceptance.acceptance_date.isoformat() if acceptance.acceptance_date else None
            item['next_reinspection_date'] = acceptance.next_reinspection_date.isoformat() if acceptance.next_reinspection_date else None
        
        if overdue:
            item['overdue_days'] = overdue.overdue_days
            item['detected_at'] = overdue.detected_at.isoformat()
        
        result.append(item)
    
    return jsonify({
        'success': True,
        'today': today.isoformat(),
        'count': len(result),
        'data': result
    })

@query_bp.route('/rectification-closed', methods=['GET'])
def get_rectification_closed():
    status = request.args.get('status', 'all')
    
    query = db.session.query(
        RectificationRecord,
        Scaffold
    ).outerjoin(
        Scaffold, RectificationRecord.scaffold_id == Scaffold.id
    )
    
    if status == 'pending':
        query = query.filter(RectificationRecord.status == 'pending')
    elif status == 'closed':
        query = query.filter(RectificationRecord.status == 'closed')
    
    records = query.all()
    
    result = []
    for rectification, scaffold in records:
        item = {
            'rectification_no': rectification.rectification_no,
            'issue_description': rectification.issue_description,
            'issue_date': rectification.issue_date.isoformat() if rectification.issue_date else None,
            'responsible_person': rectification.responsible_person,
            'deadline': rectification.deadline.isoformat() if rectification.deadline else None,
            'rectification_date': rectification.rectification_date.isoformat() if rectification.rectification_date else None,
            'rectification_measures': rectification.rectification_measures,
            'verifier': rectification.verifier,
            'status': rectification.status
        }
        
        if scaffold:
            item['scaffold_no'] = scaffold.scaffold_no
            item['area'] = scaffold.area
        
        result.append(item)
    
    return jsonify({
        'success': True,
        'count': len(result),
        'filter': status,
        'data': result
    })

@query_bp.route('/active-conflicts', methods=['GET'])
def get_active_conflicts():
    wp1 = aliased(WorkPermit)
    wp2 = aliased(WorkPermit)
    
    conflicts = db.session.query(
        ConflictRecord,
        wp1,
        wp2
    ).outerjoin(
        wp1, ConflictRecord.work_permit_1_id == wp1.id
    ).outerjoin(
        wp2, ConflictRecord.work_permit_2_id == wp2.id
    ).filter(
        ConflictRecord.resolved == False
    ).all()
    
    result = []
    for conflict, permit1, permit2 in conflicts:
        item = {
            'conflict_id': conflict.id,
            'conflict_type': conflict.conflict_type,
            'area': conflict.area,
            'description': conflict.description,
            'detection_time': conflict.detection_time.isoformat()
        }
        
        if permit1:
            item['work_permit_1'] = {
                'permit_no': permit1.permit_no,
                'work_type': permit1.work_type,
                'start_time': permit1.start_time.isoformat() if permit1.start_time else None,
                'end_time': permit1.end_time.isoformat() if permit1.end_time else None,
                'applicant': permit1.applicant
            }
        
        if permit2:
            item['work_permit_2'] = {
                'permit_no': permit2.permit_no,
                'work_type': permit2.work_type,
                'start_time': permit2.start_time.isoformat() if permit2.start_time else None,
                'end_time': permit2.end_time.isoformat() if permit2.end_time else None,
                'applicant': permit2.applicant
            }
        
        result.append(item)
    
    return jsonify({
        'success': True,
        'count': len(result),
        'data': result
    })

@query_bp.route('/overdue-scaffolds', methods=['GET'])
def get_overdue_scaffolds():
    today = datetime.utcnow().date()
    
    overdue_records = db.session.query(
        OverdueRecord,
        Scaffold,
        AcceptanceRecord
    ).join(
        Scaffold, OverdueRecord.scaffold_id == Scaffold.id
    ).outerjoin(
        AcceptanceRecord, OverdueRecord.acceptance_record_id == AcceptanceRecord.id
    ).filter(
        OverdueRecord.resolved == False
    ).all()
    
    result = []
    for overdue, scaffold, acceptance in overdue_records:
        item = {
            'scaffold_no': scaffold.scaffold_no,
            'area': scaffold.area,
            'location': scaffold.location,
            'overdue_days': overdue.overdue_days,
            'detected_at': overdue.detected_at.isoformat()
        }
        
        if acceptance:
            item['acceptance_date'] = acceptance.acceptance_date.isoformat() if acceptance.acceptance_date else None
            item['next_reinspection_date'] = acceptance.next_reinspection_date.isoformat() if acceptance.next_reinspection_date else None
        
        result.append(item)
    
    return jsonify({
        'success': True,
        'today': today.isoformat(),
        'count': len(result),
        'data': result
    })

@query_bp.route('/daily-risk-summary', methods=['GET'])
def get_daily_risk_summary():
    summary_date_str = request.args.get('date', date.today().isoformat())
    
    try:
        if isinstance(summary_date_str, str):
            summary_date = datetime.strptime(summary_date_str, '%Y-%m-%d').date()
        else:
            summary_date = summary_date_str
    except ValueError:
        summary_date = date.today()
    
    summary = DailySummary.query.filter_by(summary_date=summary_date).first()
    
    if not summary:
        from app.services.risk_summary import generate_daily_summary
        summary_data = generate_daily_summary(summary_date)
        return jsonify({
            'success': True,
            'summary_date': summary_date.isoformat(),
            'data': summary_data
        })
    
    return jsonify({
        'success': True,
        'summary_date': summary_date.isoformat(),
        'data': {
            'total_scaffolds': summary.total_scaffolds,
            'disabled_scaffolds': summary.disabled_scaffolds,
            'overdue_scaffolds': summary.overdue_scaffolds,
            'pending_rectifications': summary.pending_rectifications,
            'closed_rectifications': summary.closed_rectifications,
            'active_conflicts': summary.active_conflicts,
            'high_risk_areas': summary.high_risk_areas
        }
    })

@query_bp.route('/export-risk-summary', methods=['GET'])
def export_risk_summary():
    summary_date_str = request.args.get('date', date.today().isoformat())
    
    try:
        if isinstance(summary_date_str, str):
            summary_date = datetime.strptime(summary_date_str, '%Y-%m-%d').date()
        else:
            summary_date = summary_date_str
    except ValueError:
        summary_date = date.today()
    
    from app.services.risk_summary import generate_export_summary
    export_data = generate_export_summary(summary_date)
    
    return jsonify({
        'success': True,
        'export_date': summary_date.isoformat(),
        'generated_at': datetime.now().isoformat(),
        'data': export_data
    })

@query_bp.route('/scaffold-status', methods=['GET'])
def get_scaffold_status():
    scaffold_no = request.args.get('scaffold_no')
    
    if not scaffold_no:
        return jsonify({'error': '请提供脚手架编号'}), 400
    
    scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
    
    if not scaffold:
        return jsonify({'error': '未找到该脚手架'}), 404
    
    acceptances = AcceptanceRecord.query.filter_by(scaffold_id=scaffold.id).order_by(
        AcceptanceRecord.acceptance_date.desc()
    ).all()
    
    rectifications = RectificationRecord.query.filter_by(scaffold_id=scaffold.id).order_by(
        RectificationRecord.issue_date.desc()
    ).all()
    
    overdues = OverdueRecord.query.filter_by(scaffold_id=scaffold.id).order_by(
        OverdueRecord.detected_at.desc()
    ).all()
    
    result = {
        'scaffold_no': scaffold.scaffold_no,
        'area': scaffold.area,
        'location': scaffold.location,
        'height': scaffold.height,
        'type': scaffold.type,
        'current_status': scaffold.status,
        'acceptance_history': [],
        'rectification_history': [],
        'overdue_history': []
    }
    
    for acc in acceptances:
        result['acceptance_history'].append({
            'acceptance_no': acc.acceptance_no,
            'acceptance_date': acc.acceptance_date.isoformat() if acc.acceptance_date else None,
            'next_reinspection_date': acc.next_reinspection_date.isoformat() if acc.next_reinspection_date else None,
            'inspector': acc.inspector,
            'issues_found': acc.issues_found,
            'status': acc.status
        })
    
    for rec in rectifications:
        result['rectification_history'].append({
            'rectification_no': rec.rectification_no,
            'issue_description': rec.issue_description,
            'issue_date': rec.issue_date.isoformat() if rec.issue_date else None,
            'deadline': rec.deadline.isoformat() if rec.deadline else None,
            'rectification_date': rec.rectification_date.isoformat() if rec.rectification_date else None,
            'status': rec.status
        })
    
    for od in overdues:
        result['overdue_history'].append({
            'overdue_days': od.overdue_days,
            'detected_at': od.detected_at.isoformat(),
            'resolved': od.resolved,
            'resolved_at': od.resolved_at.isoformat() if od.resolved_at else None
        })
    
    return jsonify({
        'success': True,
        'data': result
    })
