from flask import Blueprint, request, jsonify
from app import db
from app.models import Scaffold, AcceptanceRecord, OverdueRecord, WorkPermit, ConflictRecord, RectificationRecord
from datetime import datetime, timedelta
from sqlalchemy import and_, or_

status_bp = Blueprint('status', __name__)

@status_bp.route('/check-overdue', methods=['POST'])
def check_overdue():
    today = datetime.utcnow().date()
    validity_days = 30
    
    overdue_count = 0
    updated_scaffolds = []
    
    scaffolds = Scaffold.query.filter(
        Scaffold.status.notin_(['disabled', 'closed'])
    ).all()
    
    for scaffold in scaffolds:
        latest_acceptance = AcceptanceRecord.query.filter_by(
            scaffold_id=scaffold.id
        ).order_by(AcceptanceRecord.next_reinspection_date.desc()).first()
        
        if not latest_acceptance or not latest_acceptance.next_reinspection_date:
            continue
        
        next_reinspection = latest_acceptance.next_reinspection_date.date()
        overdue_days = (today - next_reinspection).days
        
        if overdue_days > 0:
            existing_overdue = OverdueRecord.query.filter_by(
                scaffold_id=scaffold.id,
                resolved=False
            ).first()
            
            if not existing_overdue:
                overdue = OverdueRecord(
                    scaffold_id=scaffold.id,
                    acceptance_record_id=latest_acceptance.id,
                    overdue_days=overdue_days,
                    resolved=False
                )
                db.session.add(overdue)
                
                if scaffold.status not in ['rectifying', 'disabled']:
                    scaffold.status = 'overdue'
                
                overdue_count += 1
                updated_scaffolds.append({
                    'scaffold_no': scaffold.scaffold_no,
                    'area': scaffold.area,
                    'overdue_days': overdue_days,
                    'next_reinspection_date': next_reinspection.isoformat()
                })
            else:
                if existing_overdue.overdue_days != overdue_days:
                    existing_overdue.overdue_days = overdue_days
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'check_date': today.isoformat(),
        'new_overdue_count': overdue_count,
        'updated_scaffolds': updated_scaffolds
    })

@status_bp.route('/check-conflicts', methods=['POST'])
def check_conflicts():
    today = datetime.utcnow().date()
    conflict_types = {
        ('high_altitude', 'hot_work'): '高处作业与动火作业冲突',
        ('high_altitude', 'lifting'): '高处作业与吊装作业冲突',
        ('hot_work', 'high_altitude'): '动火作业与高处作业冲突',
        ('lifting', 'high_altitude'): '吊装作业与高处作业冲突',
        ('hot_work', 'confined_space'): '动火作业与有限空间作业冲突',
        ('confined_space', 'hot_work'): '有限空间作业与动火作业冲突'
    }
    
    new_conflicts = []
    conflict_count = 0
    
    active_permits = WorkPermit.query.filter(
        WorkPermit.status == 'active'
    ).all()
    
    for i in range(len(active_permits)):
        permit1 = active_permits[i]
        
        for j in range(i + 1, len(active_permits)):
            permit2 = active_permits[j]
            
            if permit1.area != permit2.area:
                continue
            
            type_pair = tuple(sorted([permit1.work_type, permit2.work_type]))
            
            if type_pair not in conflict_types:
                continue
            
            if not _is_time_overlapping(permit1, permit2):
                continue
            
            existing_conflict = ConflictRecord.query.filter(
                or_(
                    and_(
                        ConflictRecord.work_permit_1_id == permit1.id,
                        ConflictRecord.work_permit_2_id == permit2.id
                    ),
                    and_(
                        ConflictRecord.work_permit_1_id == permit2.id,
                        ConflictRecord.work_permit_2_id == permit1.id
                    )
                ),
                ConflictRecord.resolved == False
            ).first()
            
            if existing_conflict:
                continue
            
            conflict = ConflictRecord(
                conflict_type=conflict_types[type_pair],
                area=permit1.area,
                work_permit_1_id=permit1.id,
                work_permit_2_id=permit2.id,
                description=f"在{permit1.area}区域，{_get_work_type_name(permit1.work_type)}与{_get_work_type_name(permit2.work_type)}时间重叠，存在安全风险",
                resolved=False
            )
            db.session.add(conflict)
            
            new_conflicts.append({
                'conflict_type': conflict_types[type_pair],
                'area': permit1.area,
                'permit1_no': permit1.permit_no,
                'permit1_type': _get_work_type_name(permit1.work_type),
                'permit2_no': permit2.permit_no,
                'permit2_type': _get_work_type_name(permit2.work_type),
                'time_overlap': {
                    'permit1_start': permit1.start_time.isoformat() if permit1.start_time else None,
                    'permit1_end': permit1.end_time.isoformat() if permit1.end_time else None,
                    'permit2_start': permit2.start_time.isoformat() if permit2.start_time else None,
                    'permit2_end': permit2.end_time.isoformat() if permit2.end_time else None
                }
            })
            conflict_count += 1
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'check_date': today.isoformat(),
        'new_conflict_count': conflict_count,
        'conflicts': new_conflicts
    })

@status_bp.route('/update-scaffold-status', methods=['POST'])
def update_scaffold_status():
    data = request.get_json()
    
    scaffold_no = data.get('scaffold_no')
    new_status = data.get('status')
    reason = data.get('reason', '')
    operator = data.get('operator', '')
    
    if not scaffold_no or not new_status:
        return jsonify({'error': '脚手架编号和状态不能为空'}), 400
    
    valid_statuses = ['applied', 'accepted', 'inspected', 'overdue', 'rectifying', 'closed', 'disabled']
    
    if new_status not in valid_statuses:
        return jsonify({'error': f'无效的状态值，有效状态: {valid_statuses}'}), 400
    
    scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
    
    if not scaffold:
        return jsonify({'error': '未找到该脚手架'}), 404
    
    old_status = scaffold.status
    scaffold.status = new_status
    
    if new_status == 'closed':
        rectifications = RectificationRecord.query.filter_by(
            scaffold_id=scaffold.id,
            status='pending'
        ).all()
        for rec in rectifications:
            rec.status = 'closed'
            rec.rectification_date = datetime.utcnow()
        
        overdues = OverdueRecord.query.filter_by(
            scaffold_id=scaffold.id,
            resolved=False
        ).all()
        for od in overdues:
            od.resolved = True
            od.resolved_at = datetime.utcnow()
            od.resolution_notes = f'脚手架状态更新为已关闭，操作人: {operator}'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'脚手架 {scaffold_no} 状态已更新',
        'scaffold_no': scaffold_no,
        'old_status': old_status,
        'new_status': new_status,
        'reason': reason,
        'operator': operator,
        'updated_at': datetime.utcnow().isoformat()
    })

@status_bp.route('/resolve-conflict', methods=['POST'])
def resolve_conflict():
    data = request.get_json()
    
    conflict_id = data.get('conflict_id')
    resolution_notes = data.get('resolution_notes', '')
    operator = data.get('operator', '')
    
    if not conflict_id:
        return jsonify({'error': '冲突ID不能为空'}), 400
    
    conflict = ConflictRecord.query.get(conflict_id)
    
    if not conflict:
        return jsonify({'error': '未找到该冲突记录'}), 404
    
    if conflict.resolved:
        return jsonify({'error': '该冲突已经解决'}), 400
    
    conflict.resolved = True
    conflict.resolved_at = datetime.utcnow()
    conflict.resolution_notes = f'{resolution_notes} (操作人: {operator})'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '冲突已解决',
        'conflict_id': conflict_id,
        'conflict_type': conflict.conflict_type,
        'area': conflict.area,
        'resolved_at': conflict.resolved_at.isoformat(),
        'resolution_notes': conflict.resolution_notes
    })

@status_bp.route('/resolve-overdue', methods=['POST'])
def resolve_overdue():
    data = request.get_json()
    
    scaffold_no = data.get('scaffold_no')
    acceptance_no = data.get('acceptance_no')
    next_reinspection_date = data.get('next_reinspection_date')
    operator = data.get('operator', '')
    
    if not scaffold_no:
        return jsonify({'error': '脚手架编号不能为空'}), 400
    
    scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
    
    if not scaffold:
        return jsonify({'error': '未找到该脚手架'}), 404
    
    overdues = OverdueRecord.query.filter_by(
        scaffold_id=scaffold.id,
        resolved=False
    ).all()
    
    if not overdues:
        return jsonify({'error': '该脚手架没有未解决的超期记录'}), 400
    
    acceptance = None
    if acceptance_no:
        acceptance = AcceptanceRecord.query.filter_by(
            acceptance_no=acceptance_no
        ).first()
    
    if not acceptance:
        acceptance = AcceptanceRecord(
            scaffold_id=scaffold.id,
            acceptance_no=f'REINS-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}',
            acceptance_date=datetime.utcnow(),
            status='accepted'
        )
        db.session.add(acceptance)
    
    if next_reinspection_date:
        try:
            acceptance.next_reinspection_date = datetime.strptime(
                next_reinspection_date,
                '%Y-%m-%d'
            )
        except ValueError:
            acceptance.next_reinspection_date = datetime.utcnow() + timedelta(days=30)
    else:
        acceptance.next_reinspection_date = datetime.utcnow() + timedelta(days=30)
    
    for od in overdues:
        od.resolved = True
        od.resolved_at = datetime.utcnow()
        od.resolution_notes = f'已完成复验，下次复验日期: {acceptance.next_reinspection_date.date().isoformat()}，操作人: {operator}'
    
    if scaffold.status == 'overdue':
        scaffold.status = 'inspected'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'脚手架 {scaffold_no} 超期问题已解决',
        'scaffold_no': scaffold_no,
        'acceptance_no': acceptance.acceptance_no,
        'next_reinspection_date': acceptance.next_reinspection_date.date().isoformat(),
        'resolved_count': len(overdues),
        'new_status': scaffold.status
    })

def _is_time_overlapping(permit1, permit2):
    if not permit1.start_time or not permit1.end_time:
        return False
    if not permit2.start_time or not permit2.end_time:
        return False
    
    return permit1.start_time <= permit2.end_time and permit2.start_time <= permit1.end_time

def _get_work_type_name(work_type):
    type_names = {
        'high_altitude': '高处作业',
        'hot_work': '动火作业',
        'lifting': '吊装作业',
        'confined_space': '有限空间作业'
    }
    return type_names.get(work_type, work_type)
