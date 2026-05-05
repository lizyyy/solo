from flask import request, jsonify
from app.routes import api
from app import db
from app.models import StampCabinetLog, Stamp
from datetime import datetime
import pandas as pd
import json

@api.route('/cabinet-logs', methods=['GET'])
def get_cabinet_logs():
    """获取印章柜开关日志列表，支持筛选"""
    log_number = request.args.get('log_number')
    stamp_code = request.args.get('stamp_code')
    operation_type = request.args.get('operation_type')
    operator_id = request.args.get('operator_id')
    operator_name = request.args.get('operator_name')
    cabinet_id = request.args.get('cabinet_id')
    
    query = StampCabinetLog.query
    
    if log_number:
        query = query.filter(StampCabinetLog.log_number.contains(log_number))
    if stamp_code:
        query = query.filter(StampCabinetLog.stamp_code == stamp_code)
    if operation_type:
        query = query.filter(StampCabinetLog.operation_type == operation_type)
    if operator_id:
        query = query.filter(StampCabinetLog.operator_id == operator_id)
    if operator_name:
        query = query.filter(StampCabinetLog.operator_name.contains(operator_name))
    if cabinet_id:
        query = query.filter(StampCabinetLog.cabinet_id == cabinet_id)
    
    sort_by = request.args.get('sort_by', 'operation_time')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(StampCabinetLog, sort_by).desc())
    else:
        query = query.order_by(getattr(StampCabinetLog, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'cabinet_logs': [log.to_dict() for log in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/cabinet-logs/<int:log_id>', methods=['GET'])
def get_cabinet_log(log_id):
    """获取单个印章柜日志详情"""
    log = StampCabinetLog.query.get_or_404(log_id)
    return jsonify(log.to_dict())

@api.route('/cabinet-logs/import', methods=['POST'])
def import_cabinet_logs():
    """导入印章柜开关日志JSON"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        if file.filename.endswith('.json'):
            data = json.load(file)
        else:
            return jsonify({'error': 'Unsupported file format. Please use JSON.'}), 400
        
        imported_count = 0
        errors = []
        
        logs = data if isinstance(data, list) else data.get('logs', [])
        
        for index, item in enumerate(logs):
            try:
                required_fields = ['log_number', 'stamp_code', 'operation_type', 
                                  'operator_id', 'operator_name', 'operation_time']
                
                missing_fields = [field for field in required_fields if field not in item]
                if missing_fields:
                    errors.append(f"Item {index + 1}: Missing required fields: {', '.join(missing_fields)}")
                    continue
                
                existing_log = StampCabinetLog.query.filter_by(
                    log_number=str(item['log_number'])
                ).first()
                
                if existing_log:
                    errors.append(f"Item {index + 1}: Log number {item['log_number']} already exists")
                    continue
                
                operation_time = datetime.strptime(str(item['operation_time']), '%Y-%m-%dT%H:%M:%S')
                
                new_log = StampCabinetLog(
                    log_number=str(item['log_number']),
                    stamp_code=str(item['stamp_code']),
                    operation_type=item['operation_type'],
                    operator_id=str(item['operator_id']),
                    operator_name=item['operator_name'],
                    operation_time=operation_time,
                    cabinet_id=item.get('cabinet_id'),
                    notes=item.get('notes')
                )
                
                db.session.add(new_log)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Item {index + 1}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/cabinet-logs', methods=['POST'])
def create_cabinet_log():
    """创建新的印章柜日志"""
    data = request.get_json()
    
    required_fields = ['log_number', 'stamp_code', 'operation_type', 
                      'operator_id', 'operator_name', 'operation_time']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    existing_log = StampCabinetLog.query.filter_by(
        log_number=data['log_number']
    ).first()
    
    if existing_log:
        return jsonify({'error': 'Log number already exists'}), 400
    
    operation_time = datetime.strptime(data['operation_time'], '%Y-%m-%dT%H:%M:%S')
    
    new_log = StampCabinetLog(
        log_number=data['log_number'],
        stamp_code=data['stamp_code'],
        operation_type=data['operation_type'],
        operator_id=data['operator_id'],
        operator_name=data['operator_name'],
        operation_time=operation_time,
        cabinet_id=data.get('cabinet_id'),
        notes=data.get('notes')
    )
    
    db.session.add(new_log)
    db.session.commit()
    
    return jsonify(new_log.to_dict()), 201
