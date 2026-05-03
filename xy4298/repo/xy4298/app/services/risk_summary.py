from app import db
from app.models import Scaffold, RectificationRecord, ConflictRecord, OverdueRecord, WorkPermit, AcceptanceRecord, DailySummary
from datetime import datetime, date, timedelta
from collections import defaultdict
from sqlalchemy.orm import aliased

def generate_daily_summary(summary_date=None):
    if summary_date is None:
        summary_date = date.today()
    
    total_scaffolds = Scaffold.query.count()
    
    disabled_scaffolds = Scaffold.query.filter(
        Scaffold.status == 'disabled'
    ).count()
    
    overdue_scaffolds = db.session.query(Scaffold).join(
        OverdueRecord, Scaffold.id == OverdueRecord.scaffold_id
    ).filter(
        OverdueRecord.resolved == False
    ).count()
    
    pending_rectifications = RectificationRecord.query.filter(
        RectificationRecord.status == 'pending'
    ).count()
    
    closed_rectifications = RectificationRecord.query.filter(
        RectificationRecord.status == 'closed'
    ).count()
    
    active_conflicts = ConflictRecord.query.filter(
        ConflictRecord.resolved == False
    ).count()
    
    high_risk_areas = _identify_high_risk_areas()
    
    return {
        'total_scaffolds': total_scaffolds,
        'disabled_scaffolds': disabled_scaffolds,
        'overdue_scaffolds': overdue_scaffolds,
        'pending_rectifications': pending_rectifications,
        'closed_rectifications': closed_rectifications,
        'active_conflicts': active_conflicts,
        'high_risk_areas': high_risk_areas
    }

def generate_export_summary(summary_date=None):
    if summary_date is None:
        summary_date = date.today()
    
    basic_summary = generate_daily_summary(summary_date)
    
    disabled_details = _get_disabled_details()
    overdue_details = _get_overdue_details()
    pending_rectifications = _get_pending_rectifications()
    active_conflicts = _get_active_conflicts_details()
    scaffold_status_overview = _get_scaffold_status_overview()
    
    return {
        'basic_summary': basic_summary,
        'disabled_scaffolds': disabled_details,
        'overdue_scaffolds': overdue_details,
        'pending_rectifications': pending_rectifications,
        'active_conflicts': active_conflicts,
        'scaffold_status_overview': scaffold_status_overview,
        'export_time': datetime.now().isoformat()
    }

def save_daily_summary(summary_date=None):
    if summary_date is None:
        summary_date = date.today()
    
    existing = DailySummary.query.filter_by(summary_date=summary_date).first()
    
    summary_data = generate_daily_summary(summary_date)
    
    if existing:
        existing.total_scaffolds = summary_data['total_scaffolds']
        existing.disabled_scaffolds = summary_data['disabled_scaffolds']
        existing.overdue_scaffolds = summary_data['overdue_scaffolds']
        existing.pending_rectifications = summary_data['pending_rectifications']
        existing.closed_rectifications = summary_data['closed_rectifications']
        existing.active_conflicts = summary_data['active_conflicts']
        existing.high_risk_areas = summary_data['high_risk_areas']
    else:
        daily_summary = DailySummary(
            summary_date=summary_date,
            total_scaffolds=summary_data['total_scaffolds'],
            disabled_scaffolds=summary_data['disabled_scaffolds'],
            overdue_scaffolds=summary_data['overdue_scaffolds'],
            pending_rectifications=summary_data['pending_rectifications'],
            closed_rectifications=summary_data['closed_rectifications'],
            active_conflicts=summary_data['active_conflicts'],
            high_risk_areas=summary_data['high_risk_areas']
        )
        db.session.add(daily_summary)
    
    db.session.commit()
    
    return summary_data

def _identify_high_risk_areas():
    areas_risk = defaultdict(lambda: {
        'overdue_count': 0,
        'pending_rectifications': 0,
        'active_conflicts': 0,
        'risk_score': 0
    })
    
    overdue_records = db.session.query(Scaffold, OverdueRecord).join(
        OverdueRecord, Scaffold.id == OverdueRecord.scaffold_id
    ).filter(
        OverdueRecord.resolved == False
    ).all()
    
    for scaffold, overdue in overdue_records:
        area = scaffold.area or '未知区域'
        areas_risk[area]['overdue_count'] += 1
        areas_risk[area]['risk_score'] += 3
    
    pending_records = db.session.query(Scaffold, RectificationRecord).outerjoin(
        Scaffold, RectificationRecord.scaffold_id == Scaffold.id
    ).filter(
        RectificationRecord.status == 'pending'
    ).all()
    
    for scaffold, rectification in pending_records:
        area = scaffold.area if scaffold else '未知区域'
        areas_risk[area]['pending_rectifications'] += 1
        areas_risk[area]['risk_score'] += 2
    
    active_conflicts = ConflictRecord.query.filter(
        ConflictRecord.resolved == False
    ).all()
    
    for conflict in active_conflicts:
        area = conflict.area or '未知区域'
        areas_risk[area]['active_conflicts'] += 1
        areas_risk[area]['risk_score'] += 5
    
    high_risk_areas = []
    for area, data in areas_risk.items():
        if data['risk_score'] >= 5:
            risk_level = '高' if data['risk_score'] >= 10 else '中'
            high_risk_areas.append({
                'area': area,
                'overdue_count': data['overdue_count'],
                'pending_rectifications': data['pending_rectifications'],
                'active_conflicts': data['active_conflicts'],
                'risk_score': data['risk_score'],
                'risk_level': risk_level
            })
    
    high_risk_areas.sort(key=lambda x: x['risk_score'], reverse=True)
    
    return high_risk_areas

def _get_disabled_details():
    disabled = db.session.query(
        Scaffold, AcceptanceRecord
    ).outerjoin(
        AcceptanceRecord, Scaffold.id == AcceptanceRecord.scaffold_id
    ).filter(
        Scaffold.status == 'disabled'
    ).all()
    
    return [{
        'scaffold_no': s.scaffold_no,
        'area': s.area,
        'location': s.location,
        'height': s.height,
        'acceptance_date': a.acceptance_date.isoformat() if a and a.acceptance_date else None
    } for s, a in disabled]

def _get_overdue_details():
    overdue = db.session.query(
        Scaffold, OverdueRecord, AcceptanceRecord
    ).join(
        OverdueRecord, Scaffold.id == OverdueRecord.scaffold_id
    ).outerjoin(
        AcceptanceRecord, OverdueRecord.acceptance_record_id == AcceptanceRecord.id
    ).filter(
        OverdueRecord.resolved == False
    ).all()
    
    return [{
        'scaffold_no': s.scaffold_no,
        'area': s.area,
        'location': s.location,
        'overdue_days': od.overdue_days,
        'detected_at': od.detected_at.isoformat(),
        'next_reinspection_date': ar.next_reinspection_date.isoformat() if ar and ar.next_reinspection_date else None
    } for s, od, ar in overdue]

def _get_pending_rectifications():
    pending = db.session.query(
        RectificationRecord, Scaffold
    ).outerjoin(
        Scaffold, RectificationRecord.scaffold_id == Scaffold.id
    ).filter(
        RectificationRecord.status == 'pending'
    ).all()
    
    return [{
        'rectification_no': r.rectification_no,
        'scaffold_no': s.scaffold_no if s else None,
        'area': s.area if s else None,
        'issue_description': r.issue_description,
        'issue_date': r.issue_date.isoformat() if r.issue_date else None,
        'deadline': r.deadline.isoformat() if r.deadline else None,
        'responsible_person': r.responsible_person
    } for r, s in pending]

def _get_active_conflicts_details():
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
    
    return [{
        'conflict_type': c.conflict_type,
        'area': c.area,
        'description': c.description,
        'detection_time': c.detection_time.isoformat(),
        'permit1': {
            'no': p1.permit_no if p1 else None,
            'type': p1.work_type if p1 else None,
            'start': p1.start_time.isoformat() if p1 and p1.start_time else None,
            'end': p1.end_time.isoformat() if p1 and p1.end_time else None
        },
        'permit2': {
            'no': p2.permit_no if p2 else None,
            'type': p2.work_type if p2 else None,
            'start': p2.start_time.isoformat() if p2 and p2.start_time else None,
            'end': p2.end_time.isoformat() if p2 and p2.end_time else None
        }
    } for c, p1, p2 in conflicts]

def _get_scaffold_status_overview():
    status_counts = db.session.query(
        Scaffold.status,
        db.func.count(Scaffold.id)
    ).group_by(Scaffold.status).all()
    
    status_map = {
        'applied': '已申请',
        'accepted': '已验收',
        'inspected': '已复验',
        'overdue': '超期未复验',
        'rectifying': '整改中',
        'closed': '已闭环',
        'disabled': '已禁用'
    }
    
    overview = {}
    for status, count in status_counts:
        overview[status_map.get(status, status)] = count
    
    return overview
