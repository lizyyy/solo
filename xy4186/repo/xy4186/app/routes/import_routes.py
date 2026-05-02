from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, date
import os
import uuid

from app.services.import_service import ImportService
from app.services.storage_service import StorageService

import_bp = Blueprint('import', __name__)

ALLOWED_EXTENSIONS = {'csv', 'json'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@import_bp.route('/program', methods=['POST'])
def import_program():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': f'不支持的文件格式，仅支持: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"program_{timestamp}_{uuid.uuid4().hex[:8]}_{file.filename}"
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        batch = StorageService.create_import_batch('program', filename)
        
        programs, errors = ImportService.parse_program_csv(filepath)
        
        success_count = 0
        failed_count = 0
        
        for program_data in programs:
            try:
                program_data['batch_id'] = batch.id
                StorageService.create_program(program_data)
                success_count += 1
            except Exception as e:
                errors.append(f"创建节目失败: {str(e)}")
                failed_count += 1
        
        StorageService.update_import_batch(
            batch.id,
            total_records=len(programs),
            success_records=success_count,
            failed_records=failed_count,
            status='completed' if len(errors) == 0 else 'completed_with_errors'
        )
        
        return jsonify({
            'success': True,
            'message': f'节目单导入完成',
            'batch_id': batch.id,
            'total': len(programs),
            'success': success_count,
            'failed': failed_count,
            'errors': errors[:20]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/contract', methods=['POST'])
def import_contract():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400
    
    if not file.filename.endswith('.json'):
        return jsonify({'success': False, 'error': '合同文件仅支持JSON格式'}), 400
    
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"contract_{timestamp}_{uuid.uuid4().hex[:8]}_{file.filename}"
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        batch = StorageService.create_import_batch('contract', filename)
        
        contracts, errors = ImportService.parse_contract_json(filepath)
        
        success_count = 0
        failed_count = 0
        
        for contract_data in contracts:
            try:
                contract_data['batch_id'] = batch.id
                StorageService.create_contract(contract_data)
                success_count += 1
            except Exception as e:
                errors.append(f"创建合同失败: {str(e)}")
                failed_count += 1
        
        StorageService.update_import_batch(
            batch.id,
            total_records=len(contracts),
            success_records=success_count,
            failed_records=failed_count,
            status='completed' if len(errors) == 0 else 'completed_with_errors'
        )
        
        return jsonify({
            'success': True,
            'message': f'合同导入完成',
            'batch_id': batch.id,
            'total': len(contracts),
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors[:20]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/schedule', methods=['POST'])
def import_schedule():
    return _import_broadcast_events('schedule')

@import_bp.route('/log', methods=['POST'])
def import_log():
    return _import_broadcast_events('log')

def _import_broadcast_events(source_type: str):
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '未选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': f'不支持的文件格式'}), 400
    
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{source_type}_{timestamp}_{uuid.uuid4().hex[:8]}_{file.filename}"
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        
        batch = StorageService.create_import_batch(source_type, filename)
        
        events, errors = ImportService.parse_broadcast_log(filepath, source_type)
        
        target_date = request.form.get('date')
        if target_date:
            try:
                target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
                events = [e for e in events if e.get('broadcast_date') == target_date_obj]
            except:
                pass
        
        success_count = 0
        failed_count = 0
        
        for event_data in events:
            try:
                event_data['batch_id'] = batch.id
                StorageService.create_broadcast_event(event_data)
                success_count += 1
            except Exception as e:
                errors.append(f"创建播出事件失败: {str(e)}")
                failed_count += 1
        
        StorageService.update_import_batch(
            batch.id,
            total_records=len(events),
            success_records=success_count,
            failed_records=failed_count,
            status='completed' if len(errors) == 0 else 'completed_with_errors'
        )
        
        return jsonify({
            'success': True,
            'message': f'{"播出日志" if source_type == "log" else "排期表"}导入完成',
            'batch_id': batch.id,
            'source_type': source_type,
            'total': len(events),
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors[:20]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/blackout', methods=['POST'])
def import_blackout():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400
    
    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'success': False, 'error': '禁播规则仅支持JSON格式'}), 400
    
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        filepath = os.path.join(upload_folder, file.filename)
        file.save(filepath)
        
        rules, errors = ImportService.parse_blackout_rules(filepath)
        
        success_count = 0
        for rule_data in rules:
            try:
                StorageService.create_blackout_period(rule_data)
                success_count += 1
            except Exception as e:
                errors.append(f"创建禁播规则失败: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': '禁播规则导入完成',
            'total': len(rules),
            'success_count': success_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/conflict', methods=['POST'])
def import_conflict():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': '未上传文件'}), 400
    
    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'success': False, 'error': '冲突规则仅支持JSON格式'}), 400
    
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        
        filepath = os.path.join(upload_folder, file.filename)
        file.save(filepath)
        
        conflicts, errors = ImportService.parse_industry_conflicts(filepath)
        
        success_count = 0
        for conflict_data in conflicts:
            try:
                StorageService.create_industry_conflict(conflict_data)
                success_count += 1
            except Exception as e:
                errors.append(f"创建冲突规则失败: {str(e)}")
        
        return jsonify({
            'success': True,
            'message': '行业冲突规则导入完成',
            'total': len(conflicts),
            'success_count': success_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@import_bp.route('/batches', methods=['GET'])
def list_batches():
    batch_type = request.args.get('type')
    batches = StorageService.list_import_batches(batch_type=batch_type)
    
    return jsonify({
        'success': True,
        'batches': [
            {
                'id': b.id,
                'batch_type': b.batch_type,
                'file_name': b.file_name,
                'import_date': b.import_date.isoformat() if b.import_date else None,
                'total_records': b.total_records,
                'success_records': b.success_records,
                'failed_records': b.failed_records,
                'status': b.status
            }
            for b in batches
        ]
    })

@import_bp.route('/batch/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = StorageService.get_import_batch(batch_id)
    if not batch:
        return jsonify({'success': False, 'error': '批次不存在'}), 404
    
    return jsonify({
        'success': True,
        'batch': {
            'id': batch.id,
            'batch_type': batch.batch_type,
            'file_name': batch.file_name,
            'import_date': batch.import_date.isoformat() if batch.import_date else None,
            'total_records': batch.total_records,
            'success_records': batch.success_records,
            'failed_records': batch.failed_records,
            'status': batch.status
        }
    })
