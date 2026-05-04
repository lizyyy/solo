import os
import json
from datetime import datetime
from flask import Blueprint, jsonify, make_response, current_app
from config import generate_unique_filename
from models import (
    TrainingClass, Student, Group, CompressionResult, AEDResult, 
    DeviceConflict, Retraining, Note
)

export_bp = Blueprint('export', __name__)

def generate_markdown_report(class_id):
    training_class = TrainingClass.query.get_or_404(class_id)
    
    students = Student.query.filter_by(class_id=class_id).all()
    compression_results = CompressionResult.query.filter_by(class_id=class_id).all()
    aed_results = AEDResult.query.filter_by(class_id=class_id).all()
    device_conflicts = DeviceConflict.query.filter_by(class_id=class_id).all()
    retraining_records = Retraining.query.filter_by(class_id=class_id).all()
    
    total_students = len(students)
    pass_compression = sum(1 for r in compression_results if r.overall_pass)
    pass_aed = sum(1 for r in aed_results if r.overall_pass)
    
    report = f"""# 急救培训复盘报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 班级名称 | {training_class.name} |
| 培训日期 | {training_class.training_date.strftime('%Y-%m-%d') if training_class.training_date else '未填写'} |
| 讲师 | {training_class.instructor or '未填写'} |
| 地点 | {training_class.location or '未填写'} |
| 生成时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |

## 统计概览

| 统计项 | 数值 |
|--------|------|
| 学员总数 | {total_students} |
| 按压达标人数 | {pass_compression} / {len(compression_results)} |
| AED操作达标人数 | {pass_aed} / {len(aed_results)} |
| 需要补训人数 | {len(retraining_records)} |
| 设备冲突数 | {len(device_conflicts)} |

---

## 一、胸外按压达标情况

"""
    
    if compression_results:
        report += """| 学员 | 总按压数 | 深度达标率 | 频率达标率 | 平均深度(cm) | 平均频率(次/分) | 连续30次达标 | 总体达标 | 备注 |
|------|----------|------------|------------|--------------|-----------------|--------------|----------|------|
"""
        for r in compression_results:
            student = Student.query.get(r.student_id)
            notes = Note.query.filter_by(compression_result_id=r.id).all()
            note_text = '；'.join(n.content for n in notes) if notes else '-'
            
            report += f"| {student.name if student else '未知'} | {r.total_presses} | {r.depth_pass_rate*100:.1f}% | {r.rate_pass_rate*100:.1f}% | {r.avg_depth:.1f} | {r.avg_rate:.0f} | {'✓' if r.consecutive_30_pass else '✗'} | {'✓' if r.overall_pass else '✗'} | {note_text} |\n"
    else:
        report += "> 暂无按压数据\n\n"
    
    report += """
---

## 二、AED操作情况

"""
    
    if aed_results:
        report += """| 学员 | 完成步骤数 | 遗漏步骤 | 步骤顺序错误 | 总耗时(秒) | 总体达标 | 备注 |
|------|------------|----------|--------------|------------|----------|------|
"""
        for r in aed_results:
            student = Student.query.get(r.student_id)
            notes = Note.query.filter_by(aed_result_id=r.id).all()
            note_text = '；'.join(n.content for n in notes) if notes else '-'
            
            try:
                steps_missed = eval(r.steps_missed)
                steps_missed_text = '、'.join(steps_missed) if steps_missed else '-'
            except:
                steps_missed_text = '-' if r.steps_missed_count == 0 else str(r.steps_missed_count) + '个'
            
            try:
                wrong_order = eval(r.steps_order_wrong_order)
                wrong_order_text = str(len(wrong_order)) + '个' if wrong_order else '-'
            except:
                wrong_order_text = '-'
            
            report += f"| {student.name if student else '未知'} | {r.steps_completed} | {steps_missed_text} | {wrong_order_text} | {r.total_duration:.1f} | {'✓' if r.overall_pass else '✗'} | {note_text} |\n"
    else:
        report += "> 暂无AED操作数据\n\n"
    
    report += """
---

## 三、设备冲突记录

"""
    
    if device_conflicts:
        report += """| 设备ID | 冲突类型 | 涉及学员 | 持续时间(分钟) | 描述 | 是否已解决 |
|--------|----------|----------|----------------|------|------------|
"""
        for c in device_conflicts:
            student1 = Student.query.get(c.student_1_id)
            student2 = Student.query.get(c.student_2_id)
            students_text = f"{student1.name if student1 else '未知'}"
            if student2:
                students_text += f"、{student2.name}"
            
            conflict_type_text = {
                'multiple_students_same_session': '同一设备多人使用',
                'multiple_students_aed_session': 'AED设备多人操作'
            }.get(c.conflict_type, c.conflict_type)
            
            report += f"| {c.device_id} | {conflict_type_text} | {students_text} | {c.duration_minutes:.1f} | {c.description} | {'✓' if c.resolved else '✗'} |\n"
    else:
        report += "> 无设备冲突记录\n\n"
    
    report += """
---

## 四、需要补训人员

"""
    
    if retraining_records:
        high_severity = [r for r in retraining_records if r.severity == 'high' and not r.completed]
        normal_severity = [r for r in retraining_records if r.severity == 'normal' and not r.completed]
        completed = [r for r in retraining_records if r.completed]
        
        if high_severity:
            report += "### 高优先级（需尽快补训）\n\n"
            report += """| 学员 | 原因 | 补训内容 |
|------|------|----------|
"""
            for r in high_severity:
                student = Student.query.get(r.student_id)
                report += f"| {student.name if student else '未知'} | {r.reason} | {r.retraining_items} |\n"
            report += "\n"
        
        if normal_severity:
            report += "### 普通优先级\n\n"
            report += """| 学员 | 原因 | 补训内容 |
|------|------|----------|
"""
            for r in normal_severity:
                student = Student.query.get(r.student_id)
                report += f"| {student.name if student else '未知'} | {r.reason} | {r.retraining_items} |\n"
            report += "\n"
        
        if completed:
            report += "### 已完成补训\n\n"
            report += """| 学员 | 完成日期 |
|------|----------|
"""
            for r in completed:
                student = Student.query.get(r.student_id)
                report += f"| {student.name if student else '未知'} | {r.completed_date.strftime('%Y-%m-%d') if r.completed_date else '-'} |\n"
    else:
        report += "> 所有学员均达标，无需补训\n\n"
    
    if training_class.notes:
        report += f"""
---

## 五、其他备注

{training_class.notes}

"""
    
    report += f"""
---

*报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    return report

def generate_json_audit(class_id):
    training_class = TrainingClass.query.get_or_404(class_id)
    
    students = Student.query.filter_by(class_id=class_id).all()
    groups = Group.query.filter_by(class_id=class_id).all()
    compression_results = CompressionResult.query.filter_by(class_id=class_id).all()
    aed_results = AEDResult.query.filter_by(class_id=class_id).all()
    device_conflicts = DeviceConflict.query.filter_by(class_id=class_id).all()
    retraining_records = Retraining.query.filter_by(class_id=class_id).all()
    notes = Note.query.join(CompressionResult).filter(CompressionResult.class_id == class_id).all()
    notes += Note.query.join(AEDResult).filter(AEDResult.class_id == class_id).all()
    
    audit_data = {
        'export_metadata': {
            'export_time': datetime.now().isoformat(),
            'version': '1.0'
        },
        'class_info': {
            'id': training_class.id,
            'name': training_class.name,
            'training_date': training_class.training_date.isoformat() if training_class.training_date else None,
            'instructor': training_class.instructor,
            'location': training_class.location,
            'notes': training_class.notes
        },
        'students': [],
        'groups': [],
        'compression_results': [],
        'aed_results': [],
        'device_conflicts': [],
        'retraining_records': [],
        'notes': []
    }
    
    for s in students:
        audit_data['students'].append({
            'id': s.id,
            'student_id': s.student_id,
            'name': s.name,
            'gender': s.gender,
            'age': s.age,
            'group_id': s.group_id
        })
    
    for g in groups:
        audit_data['groups'].append({
            'id': g.id,
            'group_number': g.group_number,
            'group_name': g.group_name,
            'device_id': g.device_id,
            'students': [s.id for s in g.students]
        })
    
    for r in compression_results:
        audit_data['compression_results'].append({
            'id': r.id,
            'student_id': r.student_id,
            'total_presses': r.total_presses,
            'valid_presses': r.valid_presses,
            'depth_pass_count': r.depth_pass_count,
            'depth_pass_rate': r.depth_pass_rate,
            'rate_pass_count': r.rate_pass_count,
            'rate_pass_rate': r.rate_pass_rate,
            'avg_depth': r.avg_depth,
            'avg_rate': r.avg_rate,
            'min_depth': r.min_depth,
            'max_depth': r.max_depth,
            'min_rate': r.min_rate,
            'max_rate': r.max_rate,
            'consecutive_30_pass': r.consecutive_30_pass,
            'overall_pass': r.overall_pass
        })
    
    for r in aed_results:
        try:
            steps_missed = eval(r.steps_missed)
            wrong_order = eval(r.steps_order_wrong_order)
            failed_steps = eval(r.failed_steps)
        except:
            steps_missed = []
            wrong_order = []
            failed_steps = []
        
        audit_data['aed_results'].append({
            'id': r.id,
            'student_id': r.student_id,
            'session_id': r.session_id,
            'steps_completed': r.steps_completed,
            'steps_missed': steps_missed,
            'steps_missed_count': r.steps_missed_count,
            'steps_order_wrong': wrong_order,
            'avg_step_duration': r.avg_step_duration,
            'total_duration': r.total_duration,
            'failed_steps': failed_steps,
            'overall_pass': r.overall_pass
        })
    
    for c in device_conflicts:
        audit_data['device_conflicts'].append({
            'id': c.id,
            'device_id': c.device_id,
            'conflict_type': c.conflict_type,
            'student_1_id': c.student_1_id,
            'student_2_id': c.student_2_id,
            'time_start': c.time_start.isoformat() if c.time_start else None,
            'time_end': c.time_end.isoformat() if c.time_end else None,
            'duration_minutes': c.duration_minutes,
            'description': c.description,
            'resolved': c.resolved
        })
    
    for r in retraining_records:
        audit_data['retraining_records'].append({
            'id': r.id,
            'student_id': r.student_id,
            'reason': r.reason,
            'reason_type': r.reason_type,
            'severity': r.severity,
            'retraining_items': r.retraining_items.split(',') if r.retraining_items else [],
            'completed': r.completed,
            'completed_date': r.completed_date.isoformat() if r.completed_date else None
        })
    
    note_ids = set()
    for n in notes:
        if n.id not in note_ids:
            note_ids.add(n.id)
            audit_data['notes'].append({
                'id': n.id,
                'compression_result_id': n.compression_result_id,
                'aed_result_id': n.aed_result_id,
                'note_type': n.note_type,
                'content': n.content,
                'created_by': n.created_by,
                'created_at': n.created_at.isoformat() if n.created_at else None,
                'updated_at': n.updated_at.isoformat() if n.updated_at else None
            })
    
    return json.dumps(audit_data, ensure_ascii=False, indent=2)

@export_bp.route('/markdown/<int:class_id>', methods=['GET'])
def export_markdown(class_id):
    try:
        report = generate_markdown_report(class_id)
        
        training_class = TrainingClass.query.get(class_id)
        filename = f"培训复盘报告_{training_class.name}_{datetime.now().strftime('%Y%m%d')}.md"
        safe_filename = generate_unique_filename(filename, 'report')
        file_path = os.path.join(current_app.config['EXPORT_FOLDER'], safe_filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        response = make_response(report)
        response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        return jsonify({'error': f'导出失败: {str(e)}'}), 500

@export_bp.route('/json/<int:class_id>', methods=['GET'])
def export_json(class_id):
    try:
        audit_data = generate_json_audit(class_id)
        
        training_class = TrainingClass.query.get(class_id)
        filename = f"审计数据包_{training_class.name}_{datetime.now().strftime('%Y%m%d')}.json"
        safe_filename = generate_unique_filename(filename, 'audit')
        file_path = os.path.join(current_app.config['EXPORT_FOLDER'], safe_filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(audit_data)
        
        response = make_response(audit_data)
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        return jsonify({'error': f'导出失败: {str(e)}'}), 500

@export_bp.route('/preview/markdown/<int:class_id>', methods=['GET'])
def preview_markdown(class_id):
    try:
        report = generate_markdown_report(class_id)
        return jsonify({'content': report})
    except Exception as e:
        return jsonify({'error': f'生成预览失败: {str(e)}'}), 500
