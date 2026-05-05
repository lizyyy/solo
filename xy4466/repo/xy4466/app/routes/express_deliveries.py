from flask import request, jsonify
from app.routes import api
from app import db
from app.models import ExpressDelivery
from datetime import datetime
import pandas as pd
import json

@api.route('/express-deliveries', methods=['GET'])
def get_express_deliveries():
    """获取寄章快递列表，支持筛选"""
    delivery_number = request.args.get('delivery_number')
    stamp_code = request.args.get('stamp_code')
    express_company = request.args.get('express_company')
    tracking_number = request.args.get('tracking_number')
    sender_name = request.args.get('sender_name')
    receiver_name = request.args.get('receiver_name')
    status = request.args.get('status')
    delivery_type = request.args.get('delivery_type')
    
    query = ExpressDelivery.query
    
    if delivery_number:
        query = query.filter(ExpressDelivery.delivery_number.contains(delivery_number))
    if stamp_code:
        query = query.filter(ExpressDelivery.stamp_code == stamp_code)
    if express_company:
        query = query.filter(ExpressDelivery.express_company == express_company)
    if tracking_number:
        query = query.filter(ExpressDelivery.tracking_number.contains(tracking_number))
    if sender_name:
        query = query.filter(ExpressDelivery.sender_name.contains(sender_name))
    if receiver_name:
        query = query.filter(ExpressDelivery.receiver_name.contains(receiver_name))
    if status:
        query = query.filter(ExpressDelivery.status == status)
    if delivery_type:
        query = query.filter(ExpressDelivery.delivery_type == delivery_type)
    
    sort_by = request.args.get('sort_by', 'send_date')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(ExpressDelivery, sort_by).desc())
    else:
        query = query.order_by(getattr(ExpressDelivery, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'express_deliveries': [delivery.to_dict() for delivery in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/express-deliveries/<int:delivery_id>', methods=['GET'])
def get_express_delivery(delivery_id):
    """获取单个寄章快递详情"""
    delivery = ExpressDelivery.query.get_or_404(delivery_id)
    return jsonify(delivery.to_dict())

@api.route('/express-deliveries/import', methods=['POST'])
def import_express_deliveries():
    """导入寄章快递表"""
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
        
        required_columns = ['delivery_number', 'express_company', 'stamp_code', 
                           'sender_name', 'receiver_name', 'receiver_address', 'send_date']
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                existing_delivery = ExpressDelivery.query.filter_by(
                    delivery_number=str(row['delivery_number'])
                ).first()
                
                send_date = datetime.strptime(str(row['send_date']), '%Y-%m-%d')
                expected_return_date = None
                if 'expected_return_date' in row and pd.notna(row['expected_return_date']):
                    expected_return_date = datetime.strptime(str(row['expected_return_date']), '%Y-%m-%d')
                
                actual_return_date = None
                if 'actual_return_date' in row and pd.notna(row['actual_return_date']):
                    actual_return_date = datetime.strptime(str(row['actual_return_date']), '%Y-%m-%d')
                
                if existing_delivery:
                    existing_delivery.express_company = row['express_company']
                    existing_delivery.tracking_number = row.get('tracking_number', existing_delivery.tracking_number)
                    existing_delivery.stamp_code = str(row['stamp_code'])
                    existing_delivery.sender_name = row['sender_name']
                    existing_delivery.sender_department = row.get('sender_department', existing_delivery.sender_department)
                    existing_delivery.receiver_name = row['receiver_name']
                    existing_delivery.receiver_address = row['receiver_address']
                    existing_delivery.receiver_phone = row.get('receiver_phone', existing_delivery.receiver_phone)
                    existing_delivery.delivery_type = row.get('delivery_type', existing_delivery.delivery_type or 'send_out')
                    existing_delivery.send_date = send_date
                    existing_delivery.expected_return_date = expected_return_date
                    existing_delivery.actual_return_date = actual_return_date
                    existing_delivery.status = row.get('status', existing_delivery.status or 'in_transit')
                    existing_delivery.notes = row.get('notes', existing_delivery.notes)
                    updated_count += 1
                else:
                    new_delivery = ExpressDelivery(
                        delivery_number=str(row['delivery_number']),
                        express_company=row['express_company'],
                        tracking_number=row.get('tracking_number'),
                        stamp_code=str(row['stamp_code']),
                        sender_name=row['sender_name'],
                        sender_department=row.get('sender_department'),
                        receiver_name=row['receiver_name'],
                        receiver_address=row['receiver_address'],
                        receiver_phone=row.get('receiver_phone'),
                        delivery_type=row.get('delivery_type', 'send_out'),
                        send_date=send_date,
                        expected_return_date=expected_return_date,
                        actual_return_date=actual_return_date,
                        status=row.get('status', 'in_transit'),
                        notes=row.get('notes')
                    )
                    db.session.add(new_delivery)
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

@api.route('/express-deliveries', methods=['POST'])
def create_express_delivery():
    """创建新的寄章快递记录"""
    data = request.get_json()
    
    required_fields = ['delivery_number', 'express_company', 'stamp_code', 
                      'sender_name', 'receiver_name', 'receiver_address', 'send_date']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    existing_delivery = ExpressDelivery.query.filter_by(
        delivery_number=data['delivery_number']
    ).first()
    
    if existing_delivery:
        return jsonify({'error': 'Delivery number already exists'}), 400
    
    send_date = datetime.strptime(data['send_date'], '%Y-%m-%d')
    expected_return_date = None
    if 'expected_return_date' in data and data['expected_return_date']:
        expected_return_date = datetime.strptime(data['expected_return_date'], '%Y-%m-%d')
    
    actual_return_date = None
    if 'actual_return_date' in data and data['actual_return_date']:
        actual_return_date = datetime.strptime(data['actual_return_date'], '%Y-%m-%d')
    
    new_delivery = ExpressDelivery(
        delivery_number=data['delivery_number'],
        express_company=data['express_company'],
        tracking_number=data.get('tracking_number'),
        stamp_code=data['stamp_code'],
        sender_name=data['sender_name'],
        sender_department=data.get('sender_department'),
        receiver_name=data['receiver_name'],
        receiver_address=data['receiver_address'],
        receiver_phone=data.get('receiver_phone'),
        delivery_type=data.get('delivery_type', 'send_out'),
        send_date=send_date,
        expected_return_date=expected_return_date,
        actual_return_date=actual_return_date,
        status=data.get('status', 'in_transit'),
        notes=data.get('notes')
    )
    
    db.session.add(new_delivery)
    db.session.commit()
    
    return jsonify(new_delivery.to_dict()), 201

@api.route('/express-deliveries/<int:delivery_id>', methods=['PUT'])
def update_express_delivery(delivery_id):
    """更新寄章快递信息"""
    delivery = ExpressDelivery.query.get_or_404(delivery_id)
    data = request.get_json()
    
    if 'express_company' in data:
        delivery.express_company = data['express_company']
    if 'tracking_number' in data:
        delivery.tracking_number = data['tracking_number']
    if 'stamp_code' in data:
        delivery.stamp_code = data['stamp_code']
    if 'sender_name' in data:
        delivery.sender_name = data['sender_name']
    if 'sender_department' in data:
        delivery.sender_department = data['sender_department']
    if 'receiver_name' in data:
        delivery.receiver_name = data['receiver_name']
    if 'receiver_address' in data:
        delivery.receiver_address = data['receiver_address']
    if 'receiver_phone' in data:
        delivery.receiver_phone = data['receiver_phone']
    if 'delivery_type' in data:
        delivery.delivery_type = data['delivery_type']
    if 'send_date' in data:
        delivery.send_date = datetime.strptime(data['send_date'], '%Y-%m-%d')
    if 'expected_return_date' in data:
        delivery.expected_return_date = datetime.strptime(data['expected_return_date'], '%Y-%m-%d') if data['expected_return_date'] else None
    if 'actual_return_date' in data:
        delivery.actual_return_date = datetime.strptime(data['actual_return_date'], '%Y-%m-%d') if data['actual_return_date'] else None
    if 'status' in data:
        delivery.status = data['status']
    if 'notes' in data:
        delivery.notes = data['notes']
    
    db.session.commit()
    
    return jsonify(delivery.to_dict())
