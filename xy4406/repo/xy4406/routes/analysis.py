from datetime import datetime
from collections import defaultdict
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from config import Config
from models import (
    db, TrainingClass, Student, Group, CompressionData, AEDLog,
    CompressionResult, AEDResult, DeviceConflict, Retraining, Note
)

analysis_bp = Blueprint('analysis', __name__)

def map_device_to_student(class_id):
    device_student_map = {}
    device_to_group_map = defaultdict(list)
    
    groups = Group.query.filter_by(class_id=class_id).all()
    for group in groups:
        if group.device_id:
            for student in group.students:
                device_to_group_map[group.device_id].append(student.id)
            if group.students:
                device_student_map[group.device_id] = group.students[0].id
    
    compression_devices = db.session.query(CompressionData.device_id).filter(
        CompressionData.class_id == class_id
    ).distinct().all()
    
    for (device_id,) in compression_devices:
        if device_id and device_id not in device_student_map:
            student = Student.query.filter(
                Student.class_id == class_id,
                Student.student_id == device_id
            ).first()
            if student:
                device_student_map[device_id] = student.id
                device_to_group_map[device_id].append(student.id)
    
    return device_student_map, device_to_group_map

def analyze_compression(class_id):
    standards = Config.COMPRESSION_STANDARDS
    device_student_map, device_to_group_map = map_device_to_student(class_id)
    
    CompressionResult.query.filter_by(class_id=class_id).delete()
    db.session.commit()
    
    all_data = CompressionData.query.filter_by(class_id=class_id).order_by(
        CompressionData.device_id,
        CompressionData.session_id,
        CompressionData.timestamp,
        CompressionData.press_number
    ).all()
    
    device_data = defaultdict(list)
    for record in all_data:
        if record.device_id:
            device_data[record.device_id].append(record)
    
    student_data = defaultdict(list)
    for device_id, records in device_data.items():
        student_ids = device_to_group_map.get(device_id, [])
        if student_ids:
            primary_student_id = student_ids[0]
            for student_id in student_ids:
                student_data[student_id].extend(records)
            for record in records:
                if not record.student_id:
                    record.student_id = primary_student_id
        elif device_id in device_student_map:
            student_id = device_student_map[device_id]
            student_data[student_id].extend(records)
            for record in records:
                if not record.student_id:
                    record.student_id = student_id
    
    db.session.commit()
    
    results = []
    for student_id, records in student_data.items():
        if not records:
            continue
        
        total_presses = len(records)
        valid_presses = 0
        depth_pass_count = 0
        rate_pass_count = 0
        depths = []
        rates = []
        
        for record in records:
            depth_ok = False
            rate_ok = False
            
            if record.depth_cm is not None:
                depths.append(record.depth_cm)
                if standards['min_depth_cm'] <= record.depth_cm <= standards['max_depth_cm']:
                    depth_ok = True
                    depth_pass_count += 1
            
            if record.rate is not None and record.rate > 0:
                rates.append(record.rate)
                if standards['min_rate'] <= record.rate <= standards['max_rate']:
                    rate_ok = True
                    rate_pass_count += 1
            
            if depth_ok:
                valid_presses += 1
        
        avg_depth = sum(depths) / len(depths) if depths else 0
        avg_rate = sum(rates) / len(rates) if rates else 0
        min_depth = min(depths) if depths else None
        max_depth = max(depths) if depths else None
        min_rate = min(rates) if rates else None
        max_rate = max(rates) if rates else None
        
        depth_pass_rate = depth_pass_count / total_presses if total_presses > 0 else 0
        rate_pass_rate = rate_pass_count / total_presses if total_presses > 0 else 0
        
        consecutive_30_pass = False
        if total_presses >= standards['min_consecutive_presses']:
            max_consecutive = 0
            current = 0
            for record in records:
                depth_ok = (record.depth_cm is not None and 
                           standards['min_depth_cm'] <= record.depth_cm <= standards['max_depth_cm'])
                if depth_ok:
                    current += 1
                    max_consecutive = max(max_consecutive, current)
                else:
                    current = 0
            consecutive_30_pass = max_consecutive >= standards['min_consecutive_presses']
        
        overall_pass = (
            depth_pass_rate >= 0.7 and 
            rate_pass_rate >= 0.6 and 
            consecutive_30_pass
        )
        
        result = CompressionResult(
            class_id=class_id,
            student_id=student_id,
            total_presses=total_presses,
            valid_presses=valid_presses,
            depth_pass_count=depth_pass_count,
            depth_pass_rate=round(depth_pass_rate, 4),
            rate_pass_count=rate_pass_count,
            rate_pass_rate=round(rate_pass_rate, 4),
            avg_depth=round(avg_depth, 2) if avg_depth else 0,
            avg_rate=round(avg_rate, 2) if avg_rate else 0,
            min_depth=min_depth,
            max_depth=max_depth,
            min_rate=min_rate,
            max_rate=max_rate,
            consecutive_30_pass=consecutive_30_pass,
            overall_pass=overall_pass
        )
        db.session.add(result)
        results.append(result)
    
    db.session.commit()
    return results

def analyze_aed(class_id):
    expected_steps = Config.AED_EXPECTED_STEPS
    device_student_map, device_to_group_map = map_device_to_student(class_id)
    
    AEDResult.query.filter_by(class_id=class_id).delete()
    db.session.commit()
    
    all_logs = AEDLog.query.filter_by(class_id=class_id).order_by(
        AEDLog.device_id,
        AEDLog.session_id,
        AEDLog.timestamp
    ).all()
    
    session_logs = defaultdict(list)
    for log in all_logs:
        key = (log.device_id, log.session_id)
        session_logs[key].append(log)
    
    results = []
    processed_students = set()
    
    for (device_id, session_id), logs in session_logs.items():
        if not logs:
            continue
        
        primary_student_id = None
        student_ids = []
        
        if logs[0].student_id:
            primary_student_id = logs[0].student_id
            student_ids = [primary_student_id]
        else:
            student_ids = device_to_group_map.get(device_id, [])
            if student_ids:
                primary_student_id = student_ids[0]
            elif device_id in device_student_map:
                primary_student_id = device_student_map[device_id]
                student_ids = [primary_student_id]
        
        if not student_ids:
            continue
        
        for log in logs:
            if not log.student_id:
                log.student_id = primary_student_id
        
        actual_steps = [log.step_code for log in logs if log.success]
        steps_completed = len(actual_steps)
        
        steps_missed = []
        for step in expected_steps:
            if step not in actual_steps:
                steps_missed.append(step)
        
        wrong_order = []
        for i, expected_step in enumerate(expected_steps):
            if expected_step in actual_steps:
                actual_index = actual_steps.index(expected_step)
                if actual_index != i:
                    wrong_order.append({
                        'step': expected_step,
                        'expected_position': i + 1,
                        'actual_position': actual_index + 1
                    })
        
        successful_logs = [l for l in logs if l.success]
        durations = [l.duration_seconds for l in successful_logs if l.duration_seconds]
        avg_step_duration = sum(durations) / len(durations) if durations else 0
        total_duration = sum(durations) if durations else 0
        
        failed_steps = [
            {'step_code': l.step_code, 'step_name': l.step_name}
            for l in logs if not l.success
        ]
        
        overall_pass = (
            len(steps_missed) == 0 and
            len(wrong_order) == 0 and
            len(failed_steps) == 0
        )
        
        for student_id in student_ids:
            if student_id in processed_students:
                continue
            processed_students.add(student_id)
            
            result = AEDResult(
                class_id=class_id,
                student_id=student_id,
                session_id=session_id,
                steps_completed=steps_completed,
                steps_missed=str(steps_missed),
                steps_missed_count=len(steps_missed),
                steps_order_wrong_order=str(wrong_order),
                avg_step_duration=round(avg_step_duration, 2),
                total_duration=round(total_duration, 2),
                failed_steps=str(failed_steps),
                overall_pass=overall_pass
            )
            db.session.add(result)
            results.append(result)
    
    db.session.commit()
    return results

def analyze_device_conflicts(class_id):
    DeviceConflict.query.filter_by(class_id=class_id).delete()
    db.session.commit()
    
    conflicts = []
    
    compression_by_session = defaultdict(list)
    for record in CompressionData.query.filter_by(class_id=class_id).all():
        key = (record.device_id, record.session_id)
        compression_by_session[key].append(record)
    
    for (device_id, session_id), records in compression_by_session.items():
        if not records:
            continue
        
        records_sorted = sorted(records, key=lambda x: x.timestamp or datetime.min)
        student_ids = set(r.student_id for r in records_sorted if r.student_id)
        
        if len(student_ids) > 1:
            student_list = list(student_ids)
            time_start = records_sorted[0].timestamp
            time_end = records_sorted[-1].timestamp
            duration = 0
            if time_start and time_end:
                duration = (time_end - time_start).total_seconds() / 60
            
            conflict = DeviceConflict(
                class_id=class_id,
                device_id=device_id,
                conflict_type='multiple_students_same_session',
                student_1_id=student_list[0] if len(student_list) > 0 else None,
                student_2_id=student_list[1] if len(student_list) > 1 else None,
                time_start=time_start,
                time_end=time_end,
                duration_minutes=round(duration, 2),
                description=f'设备 {device_id} 在同一会话中被 {len(student_ids)} 个学员使用'
            )
            db.session.add(conflict)
            conflicts.append(conflict)
    
    aed_by_session = defaultdict(list)
    for log in AEDLog.query.filter_by(class_id=class_id).all():
        key = (log.device_id, log.session_id)
        aed_by_session[key].append(log)
    
    for (device_id, session_id), logs in aed_by_session.items():
        if not logs:
            continue
        
        logs_sorted = sorted(logs, key=lambda x: x.timestamp or datetime.min)
        student_ids = set(l.student_id for l in logs_sorted if l.student_id)
        
        if len(student_ids) > 1:
            student_list = list(student_ids)
            time_start = logs_sorted[0].timestamp
            time_end = logs_sorted[-1].timestamp
            duration = 0
            if time_start and time_end:
                duration = (time_end - time_start).total_seconds() / 60
            
            conflict = DeviceConflict(
                class_id=class_id,
                device_id=device_id,
                conflict_type='multiple_students_aed_session',
                student_1_id=student_list[0] if len(student_list) > 0 else None,
                student_2_id=student_list[1] if len(student_list) > 1 else None,
                time_start=time_start,
                time_end=time_end,
                duration_minutes=round(duration, 2),
                description=f'AED设备 {device_id} 在同一会话中被 {len(student_ids)} 个学员操作'
            )
            db.session.add(conflict)
            conflicts.append(conflict)
    
    db.session.commit()
    return conflicts

def determine_retraining(class_id):
    Retraining.query.filter_by(class_id=class_id).delete()
    db.session.commit()
    
    retraining_records = []
    students = Student.query.filter_by(class_id=class_id).all()
    
    for student in students:
        reasons = []
        retraining_items = []
        severity = 'normal'
        
        compression_result = CompressionResult.query.filter_by(
            class_id=class_id,
            student_id=student.id
        ).first()
        
        if compression_result:
            if not compression_result.overall_pass:
                reasons.append('胸外按压未达标')
                retraining_items.append('胸外按压技术')
                
                if compression_result.depth_pass_rate < 0.5:
                    severity = 'high'
                    reasons.append(f'按压深度合格率过低 ({compression_result.depth_pass_rate*100:.1f}%)')
                if compression_result.rate_pass_rate < 0.4:
                    severity = 'high'
                    reasons.append(f'按压频率合格率过低 ({compression_result.rate_pass_rate*100:.1f}%)')
                if not compression_result.consecutive_30_pass:
                    reasons.append('连续30次按压未全部达标')
        else:
            reasons.append('无按压数据')
            retraining_items.append('胸外按压技术')
            severity = 'high'
        
        aed_results = AEDResult.query.filter_by(
            class_id=class_id,
            student_id=student.id
        ).all()
        
        if aed_results:
            for result in aed_results:
                if not result.overall_pass:
                    reasons.append('AED操作存在问题')
                    retraining_items.append('AED操作流程')
                    
                    if result.steps_missed_count > 0:
                        reasons.append(f'遗漏 {result.steps_missed_count} 个关键步骤')
                    
                    try:
                        wrong_order = eval(result.steps_order_wrong_order)
                        if wrong_order:
                            reasons.append(f'{len(wrong_order)} 个步骤顺序错误')
                    except:
                        pass
                    
                    try:
                        failed_steps = eval(result.failed_steps)
                        if failed_steps:
                            reasons.append(f'{len(failed_steps)} 个步骤执行失败')
                    except:
                        pass
                    break
        else:
            pass
        
        if reasons:
            record = Retraining(
                class_id=class_id,
                student_id=student.id,
                reason='；'.join(reasons),
                reason_type='综合' if len(reasons) > 1 else ('按压' if '按压' in reasons[0] else 'AED'),
                severity=severity,
                retraining_items=','.join(retraining_items),
                completed=False
            )
            db.session.add(record)
            retraining_records.append(record)
    
    db.session.commit()
    return retraining_records

@analysis_bp.route('/run/<int:class_id>', methods=['POST'])
def run_analysis(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    try:
        compression_results = analyze_compression(class_id)
        aed_results = analyze_aed(class_id)
        device_conflicts = analyze_device_conflicts(class_id)
        retraining_records = determine_retraining(class_id)
        
        return jsonify({
            'message': '分析完成',
            'compression_analyzed': len(compression_results),
            'aed_analyzed': len(aed_results),
            'device_conflicts': len(device_conflicts),
            'retraining_needed': len(retraining_records)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'分析失败: {str(e)}'}), 500

@analysis_bp.route('/results/<int:class_id>', methods=['GET'])
def get_analysis_results(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    compression_results = CompressionResult.query.filter_by(class_id=class_id).all()
    aed_results = AEDResult.query.filter_by(class_id=class_id).all()
    device_conflicts = DeviceConflict.query.filter_by(class_id=class_id).all()
    retraining_records = Retraining.query.filter_by(class_id=class_id).all()
    
    compression_list = []
    for r in compression_results:
        student = Student.query.get(r.student_id)
        notes = [{'id': n.id, 'content': n.content, 'created_at': n.created_at.strftime('%Y-%m-%d %H:%M:%S')} 
                for n in r.notes]
        compression_list.append({
            'id': r.id,
            'student_id': r.student_id,
            'student_name': student.name if student else '未知',
            'total_presses': r.total_presses,
            'depth_pass_rate': round(r.depth_pass_rate * 100, 1),
            'rate_pass_rate': round(r.rate_pass_rate * 100, 1),
            'avg_depth': r.avg_depth,
            'avg_rate': r.avg_rate,
            'consecutive_30_pass': r.consecutive_30_pass,
            'overall_pass': r.overall_pass,
            'notes': notes
        })
    
    aed_list = []
    for r in aed_results:
        student = Student.query.get(r.student_id)
        notes = [{'id': n.id, 'content': n.content, 'created_at': n.created_at.strftime('%Y-%m-%d %H:%M:%S')} 
                for n in r.notes]
        try:
            steps_missed = eval(r.steps_missed)
        except:
            steps_missed = []
        aed_list.append({
            'id': r.id,
            'student_id': r.student_id,
            'student_name': student.name if student else '未知',
            'session_id': r.session_id,
            'steps_completed': r.steps_completed,
            'steps_missed': steps_missed,
            'steps_missed_count': r.steps_missed_count,
            'total_duration': r.total_duration,
            'overall_pass': r.overall_pass,
            'notes': notes
        })
    
    conflict_list = []
    for c in device_conflicts:
        student1 = Student.query.get(c.student_1_id)
        student2 = Student.query.get(c.student_2_id)
        conflict_list.append({
            'id': c.id,
            'device_id': c.device_id,
            'conflict_type': c.conflict_type,
            'student_1_name': student1.name if student1 else None,
            'student_2_name': student2.name if student2 else None,
            'duration_minutes': c.duration_minutes,
            'description': c.description,
            'resolved': c.resolved
        })
    
    retraining_list = []
    for r in retraining_records:
        student = Student.query.get(r.student_id)
        retraining_list.append({
            'id': r.id,
            'student_id': r.student_id,
            'student_name': student.name if student else '未知',
            'reason': r.reason,
            'reason_type': r.reason_type,
            'severity': r.severity,
            'retraining_items': r.retraining_items.split(',') if r.retraining_items else [],
            'completed': r.completed
        })
    
    return jsonify({
        'compression_results': compression_list,
        'aed_results': aed_list,
        'device_conflicts': conflict_list,
        'retraining_records': retraining_list
    })

@analysis_bp.route('/retraining/<int:retraining_id>/complete', methods=['POST'])
def mark_retraining_complete(retraining_id):
    record = Retraining.query.get_or_404(retraining_id)
    
    data = request.get_json() or {}
    record.completed = True
    record.completed_date = datetime.utcnow().date()
    
    db.session.commit()
    
    return jsonify({'message': '补训记录已标记为完成'})
