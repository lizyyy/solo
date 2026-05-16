from flask import request
from datetime import datetime
from app import db
from app.api import bp
from app.models import ManualCorrection, ErrorSample, CompressionExecution, Supplier
from app.utils import ApiResponse, ErrorCode

@bp.route('/corrections', methods=['POST'])
def create_correction():
    data = request.get_json()
    required_fields = ['error_sample_id', 'correction_note', 'corrected_by']
    if not data or not all(field in data for field in required_fields):
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    error_sample = ErrorSample.query.get(data['error_sample_id'])
    if not error_sample:
        return ApiResponse.error(ErrorCode.ERROR_SAMPLE_DETECTED, message='错误样本不存在')
    
    execution = CompressionExecution.query.filter_by(
        batch_id=error_sample.batch_id,
        supplier_code=error_sample.supplier_code
    ).first() if error_sample.execution_id else None
    
    supplier = Supplier.query.filter_by(supplier_code=error_sample.supplier_code).first()
    
    original_status = execution.status if execution else None
    original_risk_level = supplier.risk_level if supplier else None
    
    system_judgment = f"原始状态: {original_status}, 原始风险等级: {original_risk_level}, 错误类型: {error_sample.error_type}"
    
    correction = ManualCorrection(
        batch_id=error_sample.batch_id,
        supplier_code=error_sample.supplier_code,
        execution_id=error_sample.execution_id,
        error_sample_id=data['error_sample_id'],
        original_status=original_status,
        corrected_status=data.get('corrected_status'),
        original_risk_level=original_risk_level,
        corrected_risk_level=data.get('corrected_risk_level'),
        correction_note=data['correction_note'],
        corrected_by=data['corrected_by'],
        system_judgment_preserved=True,
        original_system_judgment=system_judgment
    )
    db.session.add(correction)
    db.session.commit()
    
    result = correction.to_dict()
    result['system_judgment_preserved_note'] = '系统原始状态已完整保留，未被覆盖。修正记录仅存储在人工修正表中，用于审计追溯。'
    
    return ApiResponse.success(result, '人工修正备注已记录，系统原始判断已完整保留未被覆盖')

@bp.route('/corrections/<correction_id>', methods=['GET'])
def get_correction(correction_id):
    correction = ManualCorrection.query.get(correction_id)
    if not correction:
        return ApiResponse.error(ErrorCode.CORRECTION_NOT_ALLOWED, message='修正记录不存在')
    
    return ApiResponse.success(correction.to_dict())

@bp.route('/corrections/batch/<batch_id>', methods=['GET'])
def get_corrections_by_batch(batch_id):
    corrections = ManualCorrection.query.filter_by(batch_id=batch_id).order_by(ManualCorrection.corrected_at.desc()).all()
    
    return ApiResponse.success({
        'batch_id': batch_id,
        'count': len(corrections),
        'corrections': [c.to_dict() for c in corrections]
    })

@bp.route('/corrections/supplier/<supplier_code>', methods=['GET'])
def get_corrections_by_supplier(supplier_code):
    corrections = ManualCorrection.query.filter_by(supplier_code=supplier_code).order_by(ManualCorrection.corrected_at.desc()).all()
    
    return ApiResponse.success({
        'supplier_code': supplier_code,
        'count': len(corrections),
        'corrections': [c.to_dict() for c in corrections]
    })
