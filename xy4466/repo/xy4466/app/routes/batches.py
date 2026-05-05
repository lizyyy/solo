from flask import request, jsonify
from app.routes import api
from app import db
from app.models import Batch, Case
from datetime import datetime
import json
from app.utils.risk_calculator import calculate_case_risk

@api.route('/batches', methods=['GET'])
def get_batches():
    """获取批次列表"""
    batches = Batch.query.order_by(Batch.print_date.desc()).all()
    return jsonify([batch.to_dict() for batch in batches])

@api.route('/batches/<int:batch_id>', methods=['GET'])
def get_batch(batch_id):
    """获取单个批次详情"""
    batch = Batch.query.get_or_404(batch_id)
    return jsonify(batch.to_dict())

@api.route('/batches/import', methods=['POST'])
def import_batches():
    """导入3D打印批次JSON"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # 支持单个批次或批次数组
        if isinstance(data, dict):
            batches_data = [data]
        elif isinstance(data, list):
            batches_data = data
        else:
            return jsonify({'error': 'Invalid JSON format'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for batch_data in batches_data:
            try:
                # 检查必要字段
                required_fields = ['batch_number', 'print_date', 'total_items']
                missing_fields = [field for field in required_fields if field not in batch_data]
                if missing_fields:
                    errors.append(f"Missing fields: {', '.join(missing_fields)}")
                    continue
                
                # 检查批次是否已存在
                existing_batch = Batch.query.filter_by(batch_number=batch_data['batch_number']).first()
                
                # 解析日期
                print_date = datetime.strptime(batch_data['print_date'], '%Y-%m-%dT%H:%M:%S') if 'T' in batch_data['print_date'] else datetime.strptime(batch_data['print_date'], '%Y-%m-%d')
                
                if existing_batch:
                    # 更新现有批次
                    existing_batch.printer_model = batch_data.get('printer_model', existing_batch.printer_model)
                    existing_batch.material_type = batch_data.get('material_type', existing_batch.material_type)
                    existing_batch.print_date = print_date
                    existing_batch.total_items = batch_data.get('total_items', existing_batch.total_items)
                    existing_batch.failed_items = batch_data.get('failed_items', existing_batch.failed_items)
                    existing_batch.notes = batch_data.get('notes', existing_batch.notes)
                    updated_count += 1
                else:
                    # 创建新批次
                    new_batch = Batch(
                        batch_number=batch_data['batch_number'],
                        printer_model=batch_data.get('printer_model'),
                        material_type=batch_data.get('material_type'),
                        print_date=print_date,
                        total_items=batch_data['total_items'],
                        failed_items=batch_data.get('failed_items', 0),
                        notes=batch_data.get('notes')
                    )
                    db.session.add(new_batch)
                    imported_count += 1
                
                # 关联病例并重新计算风险
                if 'case_numbers' in batch_data:
                    for case_number in batch_data['case_numbers']:
                        case = Case.query.filter_by(case_number=case_number).first()
                        if case:
                            case.batch_id = batch_data['batch_number']
                            calculate_case_risk(case)
                
            except Exception as e:
                errors.append(f"Error processing batch {batch_data.get('batch_number', 'unknown')}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/batches/<int:batch_id>/cases', methods=['GET'])
def get_batch_cases(batch_id):
    """获取批次中的所有病例"""
    batch = Batch.query.get_or_404(batch_id)
    cases = Case.query.filter_by(batch_id=batch.batch_number).all()
    return jsonify([case.to_dict() for case in cases])
