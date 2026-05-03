from flask import Blueprint, request, jsonify
from app import db
from app.models import Scaffold, ErectionApplication, AcceptanceRecord, RectificationRecord, WorkPermit
from datetime import datetime
import csv
import io
import json

import_bp = Blueprint('import', __name__)

@import_bp.route('/erection-csv', methods=['POST'])
def import_erection_csv():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        stream = io.StringIO(file.stream.read().decode('UTF-8'))
        reader = csv.DictReader(stream)
        count = 0
        
        for row in reader:
            scaffold_no = row.get('脚手架编号', row.get('scaffold_no', ''))
            if not scaffold_no:
                continue
            
            scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
            if not scaffold:
                scaffold = Scaffold(
                    scaffold_no=scaffold_no,
                    area=row.get('区域', row.get('area', '')),
                    location=row.get('位置', row.get('location', '')),
                    height=float(row.get('高度', row.get('height', 0)) or 0),
                    type=row.get('类型', row.get('type', '')),
                    status='applied'
                )
                db.session.add(scaffold)
                db.session.flush()
            
            application_no = row.get('申请单号', row.get('application_no', ''))
            if application_no:
                existing = ErectionApplication.query.filter_by(application_no=application_no).first()
                if not existing:
                    application = ErectionApplication(
                        scaffold_id=scaffold.id,
                        application_no=application_no,
                        applicant=row.get('申请人', row.get('applicant', '')),
                        department=row.get('部门', row.get('department', '')),
                        application_date=_parse_date(row.get('申请日期', row.get('application_date'))),
                        expected_erection_date=_parse_date(row.get('预计搭设日期', row.get('expected_erection_date'))),
                        description=row.get('描述', row.get('description', '')),
                        status='approved'
                    )
                    db.session.add(application)
                    count += 1
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条搭设申请记录',
            'imported_count': count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@import_bp.route('/acceptance-json', methods=['POST'])
def import_acceptance_json():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        data = json.load(file)
        records = data.get('records', [data]) if isinstance(data, dict) else data
        count = 0
        
        for item in records:
            scaffold_no = item.get('脚手架编号', item.get('scaffold_no', ''))
            if not scaffold_no:
                continue
            
            scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
            if not scaffold:
                scaffold = Scaffold(
                    scaffold_no=scaffold_no,
                    area=item.get('区域', item.get('area', '')),
                    location=item.get('位置', item.get('location', '')),
                    type=item.get('类型', item.get('type', '')),
                    status='accepted'
                )
                db.session.add(scaffold)
                db.session.flush()
            
            acceptance_no = item.get('验收单号', item.get('acceptance_no', ''))
            if acceptance_no:
                existing = AcceptanceRecord.query.filter_by(acceptance_no=acceptance_no).first()
                if not existing:
                    next_reinspection_date = _parse_date(item.get('下次复验日期', item.get('next_reinspection_date')))
                    acceptance = AcceptanceRecord(
                        scaffold_id=scaffold.id,
                        acceptance_no=acceptance_no,
                        acceptance_date=_parse_date(item.get('验收日期', item.get('acceptance_date'))),
                        next_reinspection_date=next_reinspection_date,
                        inspector=item.get('验收人', item.get('inspector', '')),
                        photos=item.get('照片列表', item.get('photos', [])),
                        issues_found=item.get('发现问题', item.get('issues_found', '')),
                        status='accepted'
                    )
                    db.session.add(acceptance)
                    
                    if scaffold.status not in ['overdue', 'rectifying', 'disabled']:
                        scaffold.status = 'accepted'
                    
                    count += 1
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条验收记录',
            'imported_count': count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@import_bp.route('/rectification-records', methods=['POST'])
def import_rectification_records():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        if file.filename.endswith('.json'):
            data = json.load(file)
            records = data.get('records', [data]) if isinstance(data, dict) else data
        else:
            stream = io.StringIO(file.stream.read().decode('UTF-8'))
            reader = csv.DictReader(stream)
            records = list(reader)
        
        count = 0
        
        for item in records:
            rectification_no = item.get('整改单号', item.get('rectification_no', ''))
            if not rectification_no:
                continue
            
            existing = RectificationRecord.query.filter_by(rectification_no=rectification_no).first()
            if existing:
                continue
            
            scaffold_no = item.get('脚手架编号', item.get('scaffold_no', ''))
            scaffold_id = None
            
            if scaffold_no:
                scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
                if scaffold:
                    scaffold_id = scaffold.id
                    if scaffold.status not in ['disabled']:
                        scaffold.status = 'rectifying'
            
            rectification_date = _parse_date(item.get('整改日期', item.get('rectification_date')))
            status = 'closed' if rectification_date else 'pending'
            
            rectification = RectificationRecord(
                scaffold_id=scaffold_id,
                rectification_no=rectification_no,
                issue_description=item.get('问题描述', item.get('issue_description', '')),
                issue_date=_parse_date(item.get('问题日期', item.get('issue_date'))),
                responsible_person=item.get('责任人', item.get('responsible_person', '')),
                deadline=_parse_date(item.get('整改期限', item.get('deadline'))),
                rectification_date=rectification_date,
                rectification_measures=item.get('整改措施', item.get('rectification_measures', '')),
                verifier=item.get('验证人', item.get('verifier', '')),
                status=status
            )
            db.session.add(rectification)
            count += 1
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条整改记录',
            'imported_count': count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@import_bp.route('/confined-space', methods=['POST'])
def import_confined_space():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        if file.filename.endswith('.json'):
            data = json.load(file)
            records = data.get('records', [data]) if isinstance(data, dict) else data
        else:
            stream = io.StringIO(file.stream.read().decode('UTF-8'))
            reader = csv.DictReader(stream)
            records = list(reader)
        
        count = 0
        
        for item in records:
            permit_no = item.get('作业单号', item.get('permit_no', ''))
            if not permit_no:
                continue
            
            existing = WorkPermit.query.filter_by(permit_no=permit_no).first()
            if existing:
                continue
            
            scaffold_no = item.get('脚手架编号', item.get('scaffold_no', ''))
            scaffold_id = None
            
            if scaffold_no:
                scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
                if scaffold:
                    scaffold_id = scaffold.id
            
            work_permit = WorkPermit(
                scaffold_id=scaffold_id,
                permit_no=permit_no,
                work_type='confined_space',
                area=item.get('区域', item.get('area', '')),
                location=item.get('位置', item.get('location', '')),
                start_time=_parse_date(item.get('开始时间', item.get('start_time'))),
                end_time=_parse_date(item.get('结束时间', item.get('end_time'))),
                applicant=item.get('申请人', item.get('applicant', '')),
                supervisor=item.get('监护人员', item.get('supervisor', '')),
                safety_measures=item.get('安全措施', item.get('safety_measures', '')),
                status='active'
            )
            db.session.add(work_permit)
            count += 1
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条有限空间作业记录',
            'imported_count': count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@import_bp.route('/work-permits', methods=['POST'])
def import_work_permits():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    try:
        if file.filename.endswith('.json'):
            data = json.load(file)
            records = data.get('records', [data]) if isinstance(data, dict) else data
        else:
            stream = io.StringIO(file.stream.read().decode('UTF-8'))
            reader = csv.DictReader(stream)
            records = list(reader)
        
        count = 0
        work_type_map = {
            '高处作业': 'high_altitude',
            '动火作业': 'hot_work',
            '吊装作业': 'lifting',
            '有限空间作业': 'confined_space'
        }
        
        for item in records:
            permit_no = item.get('作业单号', item.get('permit_no', ''))
            if not permit_no:
                continue
            
            existing = WorkPermit.query.filter_by(permit_no=permit_no).first()
            if existing:
                continue
            
            work_type = item.get('作业类型', item.get('work_type', ''))
            work_type = work_type_map.get(work_type, work_type)
            
            scaffold_no = item.get('脚手架编号', item.get('scaffold_no', ''))
            scaffold_id = None
            
            if scaffold_no:
                scaffold = Scaffold.query.filter_by(scaffold_no=scaffold_no).first()
                if scaffold:
                    scaffold_id = scaffold.id
            
            work_permit = WorkPermit(
                scaffold_id=scaffold_id,
                permit_no=permit_no,
                work_type=work_type,
                area=item.get('区域', item.get('area', '')),
                location=item.get('位置', item.get('location', '')),
                start_time=_parse_date(item.get('开始时间', item.get('start_time'))),
                end_time=_parse_date(item.get('结束时间', item.get('end_time'))),
                applicant=item.get('申请人', item.get('applicant', '')),
                supervisor=item.get('监护人员', item.get('supervisor', '')),
                safety_measures=item.get('安全措施', item.get('safety_measures', '')),
                status=item.get('状态', item.get('status', 'active'))
            )
            db.session.add(work_permit)
            count += 1
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'成功导入 {count} 条作业许可记录',
            'imported_count': count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

def _parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str
    
    formats = [
        '%Y-%m-%d',
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d',
        '%Y/%m/%d %H:%M:%S',
        '%Y年%m月%d日',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ'
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(str(date_str).strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None
