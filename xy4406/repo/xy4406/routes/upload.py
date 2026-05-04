import os
import csv
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from config import allowed_file, generate_unique_filename
from models import db, TrainingClass, Student, Group, CompressionData, AEDLog, UploadRecord

upload_bp = Blueprint('upload', __name__)

def parse_students_csv(file_path, class_id):
    students = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            student = Student(
                class_id=class_id,
                student_id=row.get('学号', row.get('student_id', row.get('id', ''))),
                name=row.get('姓名', row.get('name', '')),
                gender=row.get('性别', row.get('gender')),
                age=int(row.get('年龄', row.get('age', 0))) if row.get('年龄', row.get('age')) else None
            )
            students.append(student)
    return students

def parse_groups_csv(file_path, class_id):
    groups = []
    student_group_map = {}
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            group_number = int(row.get('组号', row.get('group_number', row.get('组编号', 1))))
            student_id = row.get('学号', row.get('student_id', ''))
            
            if group_number not in student_group_map:
                student_group_map[group_number] = {
                    'group_name': row.get('组名', row.get('group_name', f'第{group_number}组')),
                    'device_id': row.get('设备ID', row.get('device_id', row.get('假人ID', row.get('aed_id')))),
                    'students': []
                }
            student_group_map[group_number]['students'].append(student_id)
    
    for group_number, group_data in student_group_map.items():
        group = Group(
            class_id=class_id,
            group_number=group_number,
            group_name=group_data['group_name'],
            device_id=group_data['device_id']
        )
        groups.append((group, group_data['students']))
    
    return groups

def parse_compression_csv(file_path, class_id):
    compression_records = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            timestamp_str = row.get('时间戳', row.get('timestamp', row.get('时间')))
            timestamp = None
            if timestamp_str:
                try:
                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                except:
                    try:
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                    except:
                        pass
            
            record = CompressionData(
                class_id=class_id,
                device_id=row.get('设备ID', row.get('device_id', row.get('假人ID'))),
                press_number=int(row.get('按压序号', row.get('press_number', row.get('序号', 0)))) if row.get('按压序号', row.get('press_number', row.get('序号'))) else None,
                depth_cm=float(row.get('深度(cm)', row.get('depth_cm', row.get('深度', 0))) or 0),
                rate=float(row.get('频率(次/分)', row.get('rate', row.get('频率', 0))) or 0) if row.get('频率(次/分)', row.get('rate', row.get('频率'))) else None,
                timestamp=timestamp,
                session_id=row.get('会话ID', row.get('session_id', row.get('训练ID')))
            )
            compression_records.append(record)
    
    return compression_records

def parse_aed_json(file_path, class_id):
    aed_records = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    logs = data.get('logs', data.get('operations', data.get('steps', [data] if isinstance(data, dict) else [])))
    
    for item in logs:
        timestamp_str = item.get('timestamp', item.get('时间戳', item.get('time')))
        timestamp = None
        if timestamp_str:
            try:
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
            except:
                try:
                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
                except:
                    pass
        
        record = AEDLog(
            class_id=class_id,
            device_id=item.get('device_id', item.get('设备ID', item.get('aed_id'))),
            step_code=item.get('step_code', item.get('步骤代码', item.get('code', 'unknown'))),
            step_name=item.get('step_name', item.get('步骤名称', item.get('name', item.get('step_code')))),
            timestamp=timestamp,
            duration_seconds=float(item.get('duration', item.get('持续时间', item.get('duration_seconds', 0))) or 0),
            success=item.get('success', item.get('成功', True)),
            session_id=item.get('session_id', item.get('会话ID', item.get('训练ID')))
        )
        aed_records.append(record)
    
    return aed_records

@upload_bp.route('/students/<int:class_id>', methods=['POST'])
def upload_students(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename, 'students'):
        return jsonify({'error': '文件格式不支持，请上传 CSV 文件'}), 400
    
    filename = secure_filename(file.filename)
    stored_filename = generate_unique_filename(filename, 'students')
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(file_path)
    
    upload_record = UploadRecord(
        class_id=class_id,
        file_type='students',
        original_filename=filename,
        stored_filename=stored_filename,
        file_path=file_path
    )
    db.session.add(upload_record)
    
    try:
        students = parse_students_csv(file_path, class_id)
        
        for student in students:
            db.session.add(student)
        
        upload_record.row_count = len(students)
        upload_record.processed = True
        upload_record.processed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': '学员名单导入成功',
            'count': len(students)
        })
        
    except Exception as e:
        db.session.rollback()
        upload_record.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@upload_bp.route('/groups/<int:class_id>', methods=['POST'])
def upload_groups(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename, 'group'):
        return jsonify({'error': '文件格式不支持，请上传 CSV 文件'}), 400
    
    filename = secure_filename(file.filename)
    stored_filename = generate_unique_filename(filename, 'groups')
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(file_path)
    
    upload_record = UploadRecord(
        class_id=class_id,
        file_type='groups',
        original_filename=filename,
        stored_filename=stored_filename,
        file_path=file_path
    )
    db.session.add(upload_record)
    
    try:
        groups_data = parse_groups_csv(file_path, class_id)
        
        for group, student_ids in groups_data:
            db.session.add(group)
            db.session.flush()
            
            for student_id in student_ids:
                student = Student.query.filter_by(
                    class_id=class_id,
                    student_id=student_id
                ).first()
                if student:
                    student.group_id = group.id
        
        upload_record.row_count = len(groups_data)
        upload_record.processed = True
        upload_record.processed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': '分组表导入成功',
            'count': len(groups_data)
        })
        
    except Exception as e:
        db.session.rollback()
        upload_record.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@upload_bp.route('/compression/<int:class_id>', methods=['POST'])
def upload_compression(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename, 'compression'):
        return jsonify({'error': '文件格式不支持，请上传 CSV 文件'}), 400
    
    filename = secure_filename(file.filename)
    stored_filename = generate_unique_filename(filename, 'compression')
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(file_path)
    
    upload_record = UploadRecord(
        class_id=class_id,
        file_type='compression',
        original_filename=filename,
        stored_filename=stored_filename,
        file_path=file_path
    )
    db.session.add(upload_record)
    
    try:
        records = parse_compression_csv(file_path, class_id)
        
        for record in records:
            db.session.add(record)
        
        upload_record.row_count = len(records)
        upload_record.processed = True
        upload_record.processed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': '按压数据导入成功',
            'count': len(records)
        })
        
    except Exception as e:
        db.session.rollback()
        upload_record.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@upload_bp.route('/aed/<int:class_id>', methods=['POST'])
def upload_aed(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename, 'aed'):
        return jsonify({'error': '文件格式不支持，请上传 JSON 文件'}), 400
    
    filename = secure_filename(file.filename)
    stored_filename = generate_unique_filename(filename, 'aed')
    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
    file.save(file_path)
    
    upload_record = UploadRecord(
        class_id=class_id,
        file_type='aed',
        original_filename=filename,
        stored_filename=stored_filename,
        file_path=file_path
    )
    db.session.add(upload_record)
    
    try:
        records = parse_aed_json(file_path, class_id)
        
        for record in records:
            db.session.add(record)
        
        upload_record.row_count = len(records)
        upload_record.processed = True
        upload_record.processed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'AED操作日志导入成功',
            'count': len(records)
        })
        
    except Exception as e:
        db.session.rollback()
        upload_record.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@upload_bp.route('/status/<int:class_id>', methods=['GET'])
def get_upload_status(class_id):
    TrainingClass.query.get_or_404(class_id)
    
    records = UploadRecord.query.filter_by(class_id=class_id).all()
    
    result = []
    for r in records:
        result.append({
            'id': r.id,
            'file_type': r.file_type,
            'original_filename': r.original_filename,
            'row_count': r.row_count,
            'processed': r.processed,
            'error_message': r.error_message,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return jsonify(result)
