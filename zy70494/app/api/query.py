from flask import request
from app import db
from app.api import bp
from app.models import (
    ExecutionBatch, CompressionExecution, Supplier,
    ErrorSample, ManualCorrection
)
from app.utils import ApiResponse, ErrorCode

@bp.route('/history/batches', methods=['GET'])
def query_batches():
    batch_id = request.args.get('batch_id')
    operator = request.args.get('operator')
    risk_type = request.args.get('risk_type')
    batch_type = request.args.get('batch_type')
    status = request.args.get('status')
    
    query = ExecutionBatch.query
    
    if batch_id:
        query = query.filter(ExecutionBatch.batch_id.like(f'%{batch_id}%'))
    if operator:
        query = query.filter(ExecutionBatch.operator.like(f'%{operator}%'))
    if risk_type:
        query = query.filter(ExecutionBatch.risk_type.like(f'%{risk_type}%'))
    if batch_type:
        query = query.filter(ExecutionBatch.batch_type == batch_type)
    if status:
        query = query.filter(ExecutionBatch.status == status)
    
    batches = query.order_by(ExecutionBatch.started_at.desc()).all()
    
    return ApiResponse.success({
        'count': len(batches),
        'batches': [b.to_dict() for b in batches]
    })

@bp.route('/history/executions', methods=['GET'])
def query_executions():
    batch_id = request.args.get('batch_id')
    supplier_code = request.args.get('supplier_code')
    status = request.args.get('status')
    has_error = request.args.get('has_error')
    
    query = CompressionExecution.query
    
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if supplier_code:
        query = query.filter(CompressionExecution.supplier_code.like(f'%{supplier_code}%'))
    if status:
        query = query.filter_by(status=status)
    if has_error == 'true':
        query = query.filter(CompressionExecution.error_code.isnot(None))
    elif has_error == 'false':
        query = query.filter(CompressionExecution.error_code.is_(None))
    
    executions = query.order_by(CompressionExecution.executed_at.desc()).all()
    
    return ApiResponse.success({
        'count': len(executions),
        'executions': [e.to_dict() for e in executions]
    })

@bp.route('/history/unified', methods=['GET'])
def unified_query():
    batch_id = request.args.get('batch_id')
    operator = request.args.get('operator')
    risk_type = request.args.get('risk_type')
    
    query = ExecutionBatch.query
    
    if batch_id:
        query = query.filter(ExecutionBatch.batch_id.like(f'%{batch_id}%'))
    if operator:
        query = query.filter(ExecutionBatch.operator.like(f'%{operator}%'))
    if risk_type:
        query = query.filter(ExecutionBatch.risk_type.like(f'%{risk_type}%'))
    
    batches = query.order_by(ExecutionBatch.started_at.desc()).all()
    
    result = []
    for batch in batches:
        executions = CompressionExecution.query.filter_by(batch_id=batch.batch_id).all()
        errors = ErrorSample.query.filter_by(batch_id=batch.batch_id).all()
        corrections = ManualCorrection.query.filter_by(batch_id=batch.batch_id).all()
        
        error_execution_ids = set(e.execution_id for e in errors)
        
        success_executions = [
            e for e in executions 
            if e.status == 'success' and e.id not in error_execution_ids
        ]
        failed_executions = [
            e for e in executions 
            if e.status != 'success' or e.id in error_execution_ids
        ]
        
        result.append({
            'batch': batch.to_dict(),
            'summary': {
                'total_executions': len(executions),
                'successful_executions': len(success_executions),
                'failed_executions': len(failed_executions),
                'error_samples': len(errors),
                'manual_corrections': len(corrections)
            },
            'successful_paths': [e.to_dict() for e in success_executions[:10]],
            'abnormal_paths': [e.to_dict() for e in failed_executions]
        })
    
    return ApiResponse.success({
        'count': len(result),
        'batches_detail': result
    })

@bp.route('/history/statistics', methods=['GET'])
def get_statistics():
    total_batches = ExecutionBatch.query.count()
    total_executions = CompressionExecution.query.count()
    total_errors = ErrorSample.query.count()
    total_corrections = ManualCorrection.query.count()
    
    batches_by_type = db.session.query(
        ExecutionBatch.batch_type,
        db.func.count(ExecutionBatch.id)
    ).group_by(ExecutionBatch.batch_type).all()
    
    batches_by_operator = db.session.query(
        ExecutionBatch.operator,
        db.func.count(ExecutionBatch.id)
    ).group_by(ExecutionBatch.operator).all()
    
    suppliers_by_risk = db.session.query(
        Supplier.risk_level,
        db.func.count(Supplier.id)
    ).group_by(Supplier.risk_level).all()
    
    return ApiResponse.success({
        'overview': {
            'total_batches': total_batches,
            'total_executions': total_executions,
            'total_errors': total_errors,
            'total_corrections': total_corrections
        },
        'batches_by_type': {bt: cnt for bt, cnt in batches_by_type},
        'batches_by_operator': {op: cnt for op, cnt in batches_by_operator},
        'suppliers_by_risk': {rl: cnt for rl, cnt in suppliers_by_risk}
    })
