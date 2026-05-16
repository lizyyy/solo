from flask import request
from app import db
from app.api import bp
from app.models import Supplier, ExecutionBatch
from app.utils import ApiResponse, ErrorCode, generate_batch_id

@bp.route('/suppliers', methods=['POST'])
def add_suppliers():
    data = request.get_json()
    if not data or 'suppliers' not in data or 'operator' not in data:
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    batch_id = generate_batch_id()
    operator = data['operator']
    suppliers_data = data['suppliers']
    
    batch = ExecutionBatch(
        batch_id=batch_id,
        batch_type='supplier_import',
        operator=operator,
        total_count=len(suppliers_data),
        status='running'
    )
    db.session.add(batch)
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, supplier_data in enumerate(suppliers_data):
        try:
            if 'supplier_code' not in supplier_data or 'supplier_name' not in supplier_data:
                error_count += 1
                errors.append(f'第{idx+1}条数据缺少必要字段')
                continue
            
            existing = Supplier.query.filter_by(supplier_code=supplier_data['supplier_code']).first()
            if existing:
                error_count += 1
                errors.append(f'供应商代码{supplier_data["supplier_code"]}已存在')
                continue
            
            supplier = Supplier(
                batch_id=batch_id,
                supplier_code=supplier_data['supplier_code'],
                supplier_name=supplier_data['supplier_name'],
                contact_person=supplier_data.get('contact_person'),
                contact_phone=supplier_data.get('contact_phone'),
                contact_email=supplier_data.get('contact_email'),
                address=supplier_data.get('address'),
                risk_level=supplier_data.get('risk_level', 'medium'),
                created_by=operator,
                remarks=supplier_data.get('remarks')
            )
            db.session.add(supplier)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f'第{idx+1}条数据处理失败: {str(e)}')
    
    batch.success_count = success_count
    batch.error_count = error_count
    batch.status = 'completed' if error_count == 0 else 'partial'
    
    db.session.commit()
    
    result = {
        'batch_id': batch_id,
        'total_count': len(suppliers_data),
        'success_count': success_count,
        'error_count': error_count,
        'errors': errors
    }
    
    if error_count > 0 and success_count == 0:
        return ApiResponse.error_with_data(ErrorCode.EXECUTION_FAILED, result, '所有供应商数据导入失败')
    elif error_count > 0:
        return ApiResponse.error_with_data(ErrorCode.EXECUTION_FAILED, result, '部分供应商数据导入失败')
    
    return ApiResponse.success(result, '供应商目录补录成功')

@bp.route('/suppliers/<supplier_code>', methods=['GET'])
def get_supplier(supplier_code):
    supplier = Supplier.query.filter_by(supplier_code=supplier_code).first()
    if not supplier:
        return ApiResponse.error(ErrorCode.SUPPLIER_NOT_FOUND)
    return ApiResponse.success(supplier.to_dict())

@bp.route('/suppliers', methods=['GET'])
def list_suppliers():
    batch_id = request.args.get('batch_id')
    risk_level = request.args.get('risk_level')
    status = request.args.get('status')
    
    query = Supplier.query
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if risk_level:
        query = query.filter_by(risk_level=risk_level)
    if status:
        query = query.filter_by(status=status)
    
    suppliers = query.all()
    return ApiResponse.success([s.to_dict() for s in suppliers])
