from flask import request, jsonify
from app.routes import api
from app import db
from app.models import StampApplication, Stamp
from datetime import datetime
import pandas as pd
import json
from app.utils.risk_calculator import calculate_application_risk

@api.route('/applications', methods=['GET'])
def get_applications():
    """获取用印申请列表，支持筛选"""
    status = request.args.get('status')
    application_number = request.args.get('application_number')
    applicant_name = request.args.get('applicant_name')
    department = request.args.get('department')
    stamp_code = request.args.get('stamp_code')
    document_type = request.args.get('document_type')
    
    query = StampApplication.query
    
    if status:
        query = query.filter(StampApplication.status == status)
    if application_number:
        query = query.filter(StampApplication.application_number.contains(application_number))
    if applicant_name:
        query = query.filter(StampApplication.applicant_name.contains(applicant_name))
    if department:
        query = query.filter(StampApplication.department == department)
    if stamp_code:
        query = query.filter(StampApplication.stamp_code == stamp_code)
    if document_type:
        query = query.filter(StampApplication.document_type == document_type)
    
    sort_by = request.args.get('sort_by', 'application_date')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(StampApplication, sort_by).desc())
    else:
        query = query.order_by(getattr(StampApplication, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'applications': [app.to_dict() for app in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/applications/<int:application_id>', methods=['GET'])
def get_application(application_id):
    """获取单个用印申请详情"""
    application = StampApplication.query.get_or_404(application_id)
    return jsonify(application.to_dict())

@api.route('/applications/import', methods=['POST'])
def import_applications():
    """导入用印申请CSV"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        df = pd.read_csv(file)
        
        required_columns = ['application_number', 'applicant_id', 'applicant_name', 
                           'stamp_code', 'document_type', 'document_title', 
                           'application_date']
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                existing_app = StampApplication.query.filter_by(
                    application_number=str(row['application_number'])
                ).first()
                
                application_date = datetime.strptime(str(row['application_date']), '%Y-%m-%d')
                expected_use_date = None
                if 'expected_use_date' in row and pd.notna(row['expected_use_date']):
                    expected_use_date = datetime.strptime(str(row['expected_use_date']), '%Y-%m-%d')
                
                if existing_app:
                    existing_app.applicant_id = str(row['applicant_id'])
                    existing_app.applicant_name = row['applicant_name']
                    existing_app.department = row.get('department', existing_app.department)
                    existing_app.stamp_code = str(row['stamp_code'])
                    existing_app.document_type = row['document_type']
                    existing_app.document_title = row['document_title']
                    existing_app.usage_reason = row.get('usage_reason', existing_app.usage_reason)
                    existing_app.application_date = application_date
                    existing_app.expected_use_date = expected_use_date
                    updated_count += 1
                else:
                    new_app = StampApplication(
                        application_number=str(row['application_number']),
                        applicant_id=str(row['applicant_id']),
                        applicant_name=row['applicant_name'],
                        department=row.get('department'),
                        stamp_code=str(row['stamp_code']),
                        document_type=row['document_type'],
                        document_title=row['document_title'],
                        usage_reason=row.get('usage_reason'),
                        application_date=application_date,
                        expected_use_date=expected_use_date
                    )
                    db.session.add(new_app)
                    imported_count += 1
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        db.session.commit()
        
        if imported_count > 0 or updated_count > 0:
            applications = StampApplication.query.filter(StampApplication.status == 'pending').all()
            for app in applications:
                calculate_application_risk(app)
            db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/applications/<int:application_id>', methods=['PUT'])
def update_application(application_id):
    """更新用印申请信息"""
    application = StampApplication.query.get_or_404(application_id)
    data = request.get_json()
    
    if 'applicant_name' in data:
        application.applicant_name = data['applicant_name']
    if 'department' in data:
        application.department = data['department']
    if 'stamp_code' in data:
        application.stamp_code = data['stamp_code']
    if 'document_type' in data:
        application.document_type = data['document_type']
    if 'document_title' in data:
        application.document_title = data['document_title']
    if 'usage_reason' in data:
        application.usage_reason = data['usage_reason']
    if 'application_date' in data:
        application.application_date = datetime.strptime(data['application_date'], '%Y-%m-%d')
    if 'expected_use_date' in data:
        application.expected_use_date = datetime.strptime(data['expected_use_date'], '%Y-%m-%d') if data['expected_use_date'] else None
    if 'status' in data:
        application.status = data['status']
    
    calculate_application_risk(application)
    
    db.session.commit()
    
    return jsonify(application.to_dict())

@api.route('/applications/<int:application_id>/calculate-risk', methods=['POST'])
def calculate_application_risk_endpoint(application_id):
    """计算单个申请的风险"""
    application = StampApplication.query.get_or_404(application_id)
    
    calculate_application_risk(application)
    db.session.commit()
    
    return jsonify({
        'message': 'Risk calculation completed',
        'application': application.to_dict()
    })
