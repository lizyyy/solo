from flask import Blueprint, request, jsonify
from datetime import datetime

from app import db
from models import Pottery, SpliceGroup, PotteryGroupAssociation
from services import ImportParser, AuditService, VersionManager

import_bp = Blueprint('import', __name__)


@import_bp.route('/pottery', methods=['POST'])
def import_pottery():
    if 'file' not in request.files and not request.is_json:
        return jsonify({
            'success': False,
            'error': '请提供文件或 JSON 数据'
        }), 400
    
    import_type = request.args.get('format', 'auto')
    user = request.args.get('user') or request.form.get('user')
    
    content = None
    detected_format = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '未选择文件'
            }), 400
        
        if file:
            content = file.read().decode('utf-8')
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                detected_format = 'csv'
            elif filename.endswith('.json'):
                detected_format = 'json'
    else:
        data = request.get_json()
        if 'content' in data:
            content = data['content']
        else:
            content = json.dumps(data, ensure_ascii=False)
    
    if not content:
        return jsonify({
            'success': False,
            'error': '无法获取导入内容'
        }), 400
    
    if import_type == 'auto':
        if detected_format:
            import_type = detected_format
        else:
            detected = ImportParser.detect_format(content)
            import_type = detected if detected else 'json'
    
    try:
        if import_type == 'csv':
            records, errors = ImportParser.parse_csv(content, 'pottery')
        else:
            records, errors = ImportParser.parse_json(content, 'pottery')
        
        if errors and not records:
            return jsonify({
                'success': False,
                'error': '数据解析失败',
                'errors': errors
            }), 400
        
        created_count = 0
        updated_count = 0
        failed_records = []
        
        for record in records:
            try:
                pottery_id = record.get('pottery_id')
                if not pottery_id:
                    failed_records.append({
                        'record': record,
                        'error': '缺少 pottery_id'
                    })
                    continue
                
                existing = Pottery.query.filter_by(pottery_id=pottery_id).first()
                
                if existing:
                    old_values = existing.to_dict()
                    
                    for key, value in record.items():
                        if hasattr(existing, key) and key not in ['id', 'created_at', 'version']:
                            setattr(existing, key, value)
                    
                    VersionManager.create_version(
                        existing, 'pottery',
                        change_reason='导入更新',
                        created_by=user
                    )
                    
                    AuditService.log_pottery_update(existing, old_values, user=user)
                    updated_count += 1
                else:
                    pottery = Pottery(
                        pottery_id=pottery_id,
                        trench=record.get('trench'),
                        layer=record.get('layer'),
                        square=record.get('square'),
                        length=record.get('length'),
                        width=record.get('width'),
                        thickness=record.get('thickness'),
                        weight=record.get('weight'),
                        decoration=record.get('decoration'),
                        paste_type=record.get('paste_type'),
                        color=record.get('color'),
                        photo_path=record.get('photo_path'),
                        photo_hash=record.get('photo_hash'),
                        status=record.get('status', 'pending'),
                        notes=record.get('notes'),
                        created_by=user,
                        updated_by=user
                    )
                    
                    db.session.add(pottery)
                    db.session.flush()
                    
                    AuditService.log_pottery_create(pottery, user=user)
                    created_count += 1
                    
            except Exception as e:
                failed_records.append({
                    'record': record,
                    'error': str(e)
                })
        
        db.session.commit()
        
        AuditService.log_import(
            'pottery',
            len(records),
            created_count + updated_count,
            len(failed_records) + len(errors),
            user=user
        )
        
        return jsonify({
            'success': True,
            'message': '导入完成',
            'data': {
                'format': import_type,
                'total_records': len(records),
                'created': created_count,
                'updated': updated_count,
                'failed': len(failed_records) + len(errors),
                'errors': errors + failed_records
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'导入失败: {str(e)}'
        }), 500


@import_bp.route('/group', methods=['POST'])
def import_group():
    if 'file' not in request.files and not request.is_json:
        return jsonify({
            'success': False,
            'error': '请提供文件或 JSON 数据'
        }), 400
    
    import_type = request.args.get('format', 'auto')
    user = request.args.get('user') or request.form.get('user')
    
    content = None
    detected_format = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '未选择文件'
            }), 400
        
        if file:
            content = file.read().decode('utf-8')
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                detected_format = 'csv'
            elif filename.endswith('.json'):
                detected_format = 'json'
    else:
        data = request.get_json()
        if 'content' in data:
            content = data['content']
        else:
            content = json.dumps(data, ensure_ascii=False)
    
    if not content:
        return jsonify({
            'success': False,
            'error': '无法获取导入内容'
        }), 400
    
    if import_type == 'auto':
        if detected_format:
            import_type = detected_format
        else:
            detected = ImportParser.detect_format(content)
            import_type = detected if detected else 'json'
    
    try:
        if import_type == 'csv':
            records, errors = ImportParser.parse_csv(content, 'group')
        else:
            records, errors = ImportParser.parse_json(content, 'group')
        
        if errors and not records:
            return jsonify({
                'success': False,
                'error': '数据解析失败',
                'errors': errors
            }), 400
        
        created_count = 0
        updated_count = 0
        failed_records = []
        
        for record in records:
            try:
                group_id = record.get('group_id')
                if not group_id:
                    failed_records.append({
                        'record': record,
                        'error': '缺少 group_id'
                    })
                    continue
                
                existing = SpliceGroup.query.filter_by(group_id=group_id).first()
                
                if existing:
                    old_values = existing.to_dict()
                    
                    updatable = ['name', 'description', 'status', 'guess_evidence']
                    for key in updatable:
                        if key in record:
                            setattr(existing, key, record[key])
                    
                    pottery_ids = record.get('pottery_ids', [])
                    if pottery_ids:
                        if isinstance(pottery_ids, str):
                            pottery_ids = [pid.strip() for pid in pottery_ids.split(',') if pid.strip()]
                        
                        new_ids = set(pottery_ids)
                        current_ids = set(existing.get_pottery_ids())
                        
                        for assoc in existing.associations[:]:
                            if assoc.pottery and assoc.pottery.pottery_id not in new_ids:
                                db.session.delete(assoc)
                        
                        for pottery_id in new_ids - current_ids:
                            pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
                            if pottery:
                                assoc = PotteryGroupAssociation(
                                    pottery_id=pottery.id,
                                    group_id=existing.id
                                )
                                db.session.add(assoc)
                    
                    VersionManager.create_version(
                        existing, 'splice_group',
                        change_reason='导入更新',
                        created_by=user
                    )
                    
                    AuditService.log_group_update(existing, old_values, user=user)
                    updated_count += 1
                else:
                    group = SpliceGroup(
                        group_id=group_id,
                        name=record.get('name'),
                        description=record.get('description'),
                        status=record.get('status', 'draft'),
                        guess_evidence=record.get('guess_evidence'),
                        created_by=user,
                        updated_by=user
                    )
                    
                    db.session.add(group)
                    db.session.flush()
                    
                    pottery_ids = record.get('pottery_ids', [])
                    if pottery_ids:
                        if isinstance(pottery_ids, str):
                            pottery_ids = [pid.strip() for pid in pottery_ids.split(',') if pid.strip()]
                        
                        for pottery_id in pottery_ids:
                            pottery = Pottery.query.filter_by(pottery_id=pottery_id).first()
                            if pottery:
                                assoc = PotteryGroupAssociation(
                                    pottery_id=pottery.id,
                                    group_id=group.id
                                )
                                db.session.add(assoc)
                    
                    AuditService.log_group_create(group, user=user)
                    created_count += 1
                    
            except Exception as e:
                failed_records.append({
                    'record': record,
                    'error': str(e)
                })
        
        db.session.commit()
        
        AuditService.log_import(
            'group',
            len(records),
            created_count + updated_count,
            len(failed_records) + len(errors),
            user=user
        )
        
        return jsonify({
            'success': True,
            'message': '导入完成',
            'data': {
                'format': import_type,
                'total_records': len(records),
                'created': created_count,
                'updated': updated_count,
                'failed': len(failed_records) + len(errors),
                'errors': errors + failed_records
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'导入失败: {str(e)}'
        }), 500


@import_bp.route('/preview', methods=['POST'])
def preview_import():
    if 'file' not in request.files and not request.is_json:
        return jsonify({
            'success': False,
            'error': '请提供文件或 JSON 数据'
        }), 400
    
    import_type = request.args.get('format', 'auto')
    data_type = request.args.get('type', 'pottery')
    
    content = None
    detected_format = None
    
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': '未选择文件'
            }), 400
        
        if file:
            content = file.read().decode('utf-8')
            filename = file.filename.lower()
            if filename.endswith('.csv'):
                detected_format = 'csv'
            elif filename.endswith('.json'):
                detected_format = 'json'
    else:
        data = request.get_json()
        if 'content' in data:
            content = data['content']
        else:
            content = json.dumps(data, ensure_ascii=False)
    
    if not content:
        return jsonify({
            'success': False,
            'error': '无法获取导入内容'
        }), 400
    
    if import_type == 'auto':
        if detected_format:
            import_type = detected_format
        else:
            detected = ImportParser.detect_format(content)
            import_type = detected if detected else 'json'
    
    try:
        if import_type == 'csv':
            records, errors = ImportParser.parse_csv(content, data_type)
        else:
            records, errors = ImportParser.parse_json(content, data_type)
        
        return jsonify({
            'success': True,
            'data': {
                'format': import_type,
                'total_records': len(records),
                'records': records[:20],
                'errors': errors,
                'truncated': len(records) > 20
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'预览失败: {str(e)}'
        }), 500
