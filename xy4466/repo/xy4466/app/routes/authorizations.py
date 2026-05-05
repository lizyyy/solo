from flask import request, jsonify
from app.routes import api
from app import db
from app.models import Authorization, Stamp
from datetime import datetime
import pandas as pd
import json

@api.route('/authorizations', methods=['GET'])
def get_authorizations():
    """获取授权名单列表，支持筛选"""
    employee_id = request.args.get('employee_id')
    employee_name = request.args.get('employee_name')
    department = request.args.get('department')
    stamp_code = request.args.get('stamp_code')
    is_active = request.args.get('is_active')
    authorization_type = request.args.get('authorization_type')
    
    query = Authorization.query
    
    if employee_id:
        query = query.filter(Authorization.employee_id == employee_id)
    if employee_name:
        query = query.filter(Authorization.employee_name.contains(employee_name))
    if department:
        query = query.filter(Authorization.department == department)
    if stamp_code:
        query = query.filter(Authorization.stamp_code == stamp_code)
    if is_active is not None:
        query = query.filter(Authorization.is_active == (is_active.lower() == 'true'))
    if authorization_type:
        query = query.filter(Authorization.authorization_type == authorization_type)
    
    sort_by = request.args.get('sort_by', 'employee_name')
    sort_order = request.args.get('sort_order', 'asc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(Authorization, sort_by).desc())
    else:
        query = query.order_by(getattr(Authorization, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'authorizations': [auth.to_dict() for auth in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/authorizations/<int:authorization_id>', methods=['GET'])
def get_authorization(authorization_id):
    """获取单个授权详情"""
    authorization = Authorization.query.get_or_404(authorization_id)
    return jsonify(authorization.to_dict())

@api.route('/authorizations/import', methods=['POST'])
def import_authorizations():
    """导入授权名单"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith('.json'):
            df = pd.read_json(file)
        else:
            return jsonify({'error': 'Unsupported file format. Please use CSV or JSON.'}), 400
        
        required_columns = ['employee_id', 'employee_name', 'stamp_code', 'start_date']
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                existing_auth = Authorization.query.filter_by(
                    employee_id=str(row['employee_id']),
                    stamp_code=str(row['stamp_code'])
                ).first()
                
                start_date = datetime.strptime(str(row['start_date']), '%Y-%m-%d')
                end_date = None
                if 'end_date' in row and pd.notna(row['end_date']):
                    end_date = datetime.strptime(str(row['end_date']), '%Y-%m-%d')
                
                if existing_auth:
                    existing_auth.employee_name = row['employee_name']
                    existing_auth.department = row.get('department', existing_auth.department)
                    existing_auth.authorization_type = row.get('authorization_type', existing_auth.authorization_type or 'use')
                    existing_auth.start_date = start_date
                    existing_auth.end_date = end_date
                    existing_auth.is_active = row.get('is_active', existing_auth.is_active) if 'is_active' in row else True
                    updated_count += 1
                else:
                    new_auth = Authorization(
                        employee_id=str(row['employee_id']),
                        employee_name=row['employee_name'],
                        department=row.get('department'),
                        stamp_code=str(row['stamp_code']),
                        authorization_type=row.get('authorization_type', 'use'),
                        start_date=start_date,
                        end_date=end_date,
                        is_active=row.get('is_active', True)
                    )
                    db.session.add(new_auth)
                    imported_count += 1
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/authorizations', methods=['POST'])
def create_authorization():
    """创建新授权"""
    data = request.get_json()
    
    required_fields = ['employee_id', 'employee_name', 'stamp_code', 'start_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
    end_date = None
    if 'end_date' in data and data['end_date']:
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
    
    new_auth = Authorization(
        employee_id=data['employee_id'],
        employee_name=data['employee_name'],
        department=data.get('department'),
        stamp_code=data['stamp_code'],
        authorization_type=data.get('authorization_type', 'use'),
        start_date=start_date,
        end_date=end_date,
        is_active=data.get('is_active', True)
    )
    
    db.session.add(new_auth)
    db.session.commit()
    
    return jsonify(new_auth.to_dict()), 201

@api.route('/authorizations/<int:authorization_id>', methods=['PUT'])
def update_authorization(authorization_id):
    """更新授权信息"""
    authorization = Authorization.query.get_or_404(authorization_id)
    data = request.get_json()
    
    if 'employee_name' in data:
        authorization.employee_name = data['employee_name']
    if 'department' in data:
        authorization.department = data['department']
    if 'stamp_code' in data:
        authorization.stamp_code = data['stamp_code']
    if 'authorization_type' in data:
        authorization.authorization_type = data['authorization_type']
    if 'start_date' in data:
        authorization.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
    if 'end_date' in data:
        authorization.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d') if data['end_date'] else None
    if 'is_active' in data:
        authorization.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify(authorization.to_dict())

@api.route('/authorizations/<int:authorization_id>', methods=['DELETE'])
def delete_authorization(authorization_id):
    """删除授权"""
    authorization = Authorization.query.get_or_404(authorization_id)
    
    db.session.delete(authorization)
    db.session.commit()
    
    return jsonify({'message': 'Authorization deleted successfully'})
