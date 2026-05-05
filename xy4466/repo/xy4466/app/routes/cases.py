from flask import request, jsonify
from app.routes import api
from app import db
from app.models import Case
from datetime import datetime
import pandas as pd
import json
from app.utils.risk_calculator import calculate_case_risk

@api.route('/cases', methods=['GET'])
def get_cases():
    """获取病例列表，支持筛选"""
    # 获取查询参数
    status = request.args.get('status')
    case_number = request.args.get('case_number')
    patient_name = request.args.get('patient_name')
    product_type = request.args.get('product_type')
    
    # 构建查询
    query = Case.query
    
    if status:
        query = query.filter(Case.status == status)
    if case_number:
        query = query.filter(Case.case_number.contains(case_number))
    if patient_name:
        query = query.filter(Case.patient_name.contains(patient_name))
    if product_type:
        query = query.filter(Case.product_type == product_type)
    
    # 排序
    sort_by = request.args.get('sort_by', 'delivery_date')
    sort_order = request.args.get('sort_order', 'asc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(Case, sort_by).desc())
    else:
        query = query.order_by(getattr(Case, sort_by))
    
    # 分页
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'cases': [case.to_dict() for case in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/cases/<int:case_id>', methods=['GET'])
def get_case(case_id):
    """获取单个病例详情"""
    case = Case.query.get_or_404(case_id)
    return jsonify(case.to_dict())

@api.route('/cases/import', methods=['POST'])
def import_cases():
    """导入口扫订单CSV"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        # 读取CSV文件
        df = pd.read_csv(file)
        
        # 检查必要的列
        required_columns = ['case_number', 'patient_name', 'product_type', 
                           'dentist_name', 'order_date', 'delivery_date']
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        # 处理数据
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # 检查病例是否已存在
                existing_case = Case.query.filter_by(case_number=str(row['case_number'])).first()
                
                # 解析日期
                order_date = datetime.strptime(str(row['order_date']), '%Y-%m-%d')
                delivery_date = datetime.strptime(str(row['delivery_date']), '%Y-%m-%d')
                
                if existing_case:
                    # 更新现有病例
                    existing_case.patient_name = row['patient_name']
                    existing_case.product_type = row['product_type']
                    existing_case.dentist_name = row['dentist_name']
                    existing_case.clinic_name = row.get('clinic_name', existing_case.clinic_name)
                    existing_case.order_date = order_date
                    existing_case.delivery_date = delivery_date
                    updated_count += 1
                else:
                    # 创建新病例
                    new_case = Case(
                        case_number=str(row['case_number']),
                        patient_name=row['patient_name'],
                        product_type=row['product_type'],
                        dentist_name=row['dentist_name'],
                        clinic_name=row.get('clinic_name'),
                        order_date=order_date,
                        delivery_date=delivery_date
                    )
                    db.session.add(new_case)
                    imported_count += 1
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        db.session.commit()
        
        # 为新导入的病例计算风险
        if imported_count > 0 or updated_count > 0:
            cases = Case.query.filter(Case.status == 'pending').all()
            for case in cases:
                calculate_case_risk(case)
            db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/cases/<int:case_id>', methods=['PUT'])
def update_case(case_id):
    """更新病例信息"""
    case = Case.query.get_or_404(case_id)
    data = request.get_json()
    
    # 更新字段
    if 'patient_name' in data:
        case.patient_name = data['patient_name']
    if 'product_type' in data:
        case.product_type = data['product_type']
    if 'dentist_name' in data:
        case.dentist_name = data['dentist_name']
    if 'clinic_name' in data:
        case.clinic_name = data['clinic_name']
    if 'order_date' in data:
        case.order_date = datetime.strptime(data['order_date'], '%Y-%m-%d')
    if 'delivery_date' in data:
        case.delivery_date = datetime.strptime(data['delivery_date'], '%Y-%m-%d')
    if 'batch_id' in data:
        case.batch_id = data['batch_id']
    if 'sintering_log_id' in data:
        case.sintering_log_id = data['sintering_log_id']
    if 'shape_check' in data:
        case.shape_check = data['shape_check']
    if 'color_match' in data:
        case.color_match = data['color_match']
    if 'fit_test' in data:
        case.fit_test = data['fit_test']
    if 'express_tracking' in data:
        case.express_tracking = data['express_tracking']
    if 'express_company' in data:
        case.express_company = data['express_company']
    if 'pickup_time' in data:
        case.pickup_time = datetime.strptime(data['pickup_time'], '%Y-%m-%dT%H:%M:%S') if data['pickup_time'] else None
    
    # 重新计算风险
    calculate_case_risk(case)
    
    db.session.commit()
    
    return jsonify(case.to_dict())
