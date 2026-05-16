from flask import request
from datetime import datetime
from app import db
from app.api import bp
from app.models import EvidenceChain, ErrorSample, CompressionExecution
from app.utils import ApiResponse, ErrorCode, calculate_hash

@bp.route('/evidence/chain/<execution_id>/break', methods=['POST'])
def break_evidence_chain(execution_id):
    evidences = EvidenceChain.query.filter_by(execution_id=execution_id).order_by(EvidenceChain.chain_order).all()
    if not evidences:
        return ApiResponse.error(ErrorCode.BATCH_NOT_FOUND, message='执行记录不存在')
    
    if len(evidences) > 0:
        db.session.delete(evidences[-1])
        db.session.commit()
    
    return ApiResponse.success({
        'execution_id': execution_id,
        'message': '证据链已故意断开，删除了最后一个证据节点',
        'remaining_evidence_count': len(evidences) - 1
    }, '证据链已断开')

@bp.route('/evidence/chain/<batch_id>/validate', methods=['POST'])
def validate_evidence_chain(batch_id):
    executions = CompressionExecution.query.filter_by(batch_id=batch_id).all()
    if not executions:
        return ApiResponse.error(ErrorCode.BATCH_NOT_FOUND)
    
    broken_chains = []
    error_samples = []
    total_checked = 0
    
    for execution in executions:
        evidences = EvidenceChain.query.filter_by(
            batch_id=batch_id,
            execution_id=execution.id
        ).order_by(EvidenceChain.chain_order).all()
        
        total_checked += 1
        
        expected_order = list(range(1, 5))
        actual_order = [e.chain_order for e in evidences]
        
        if actual_order != expected_order:
            broken_chains.append({
                'execution_id': execution.id,
                'supplier_code': execution.supplier_code,
                'reason': '证据链顺序不完整',
                'expected': expected_order,
                'actual': actual_order
            })
            
            error_sample = ErrorSample(
                batch_id=batch_id,
                supplier_code=execution.supplier_code,
                execution_id=execution.id,
                error_type='evidence_chain_broken',
                error_code=ErrorCode.EVIDENCE_CHAIN_BROKEN,
                error_message='证据链顺序不完整',
                sample_data=f'expected: {expected_order}, actual: {actual_order}'
            )
            db.session.add(error_sample)
            db.session.flush()
            error_samples.append(error_sample.to_dict())
            
            execution.status = 'evidence_broken'
            continue
        
        previous_hash = None
        chain_valid = True
        for evidence in evidences:
            expected_hash = calculate_hash(f'{evidence.evidence_type}_{execution.id}_{evidence.chain_order - 1}')
            if evidence.evidence_hash != expected_hash:
                chain_valid = False
                broken_chains.append({
                    'execution_id': execution.id,
                    'supplier_code': execution.supplier_code,
                    'reason': '证据哈希验证失败',
                    'evidence_type': evidence.evidence_type,
                    'chain_order': evidence.chain_order
                })
                break
        
        if not chain_valid:
            for evidence in evidences:
                evidence.is_valid = False
                evidence.validation_message = '证据链断裂 - 哈希验证失败'
            
            error_sample = ErrorSample(
                batch_id=batch_id,
                supplier_code=execution.supplier_code,
                execution_id=execution.id,
                error_type='hash_validation_failed',
                error_code=ErrorCode.EVIDENCE_VALIDATION_FAILED,
                error_message='证据哈希验证失败',
                sample_data=f'previous_hash: {previous_hash}'
            )
            db.session.add(error_sample)
            db.session.flush()
            error_samples.append(error_sample.to_dict())
            
            execution.status = 'hash_invalid'
    
    db.session.commit()
    
    result = {
        'batch_id': batch_id,
        'total_checked': total_checked,
        'broken_chains_count': len(broken_chains),
        'error_samples_count': len(error_samples),
        'broken_chains': broken_chains,
        'error_samples': error_samples
    }
    
    if len(broken_chains) > 0:
        return ApiResponse.error_with_data(
            ErrorCode.EVIDENCE_CHAIN_BROKEN,
            result,
            f'检测到{len(broken_chains)}条证据链断裂'
        )
    
    return ApiResponse.success(result, '证据链验证通过')

@bp.route('/evidence/errors/<batch_id>', methods=['GET'])
def get_error_samples(batch_id):
    only_unreported = request.args.get('only_unreported', 'false').lower() == 'true'
    
    query = ErrorSample.query.filter_by(batch_id=batch_id)
    if only_unreported:
        query = query.filter_by(is_reported=False)
    
    error_samples = query.all()
    
    return ApiResponse.success({
        'batch_id': batch_id,
        'count': len(error_samples),
        'samples': [s.to_dict() for s in error_samples]
    })

@bp.route('/evidence/errors/<error_id>/mark-reported', methods=['POST'])
def mark_error_reported(error_id):
    error_sample = ErrorSample.query.get(error_id)
    if not error_sample:
        return ApiResponse.error(ErrorCode.ERROR_SAMPLE_DETECTED, message='错误样本不存在')
    
    error_sample.is_reported = True
    error_sample.reported_at = datetime.utcnow()
    db.session.commit()
    
    return ApiResponse.success({'error_id': error_id}, '错误样本已标记为已报告')

@bp.route('/evidence/chain/<execution_id>', methods=['GET'])
def get_evidence_chain(execution_id):
    evidences = EvidenceChain.query.filter_by(execution_id=execution_id).order_by(EvidenceChain.chain_order).all()
    
    chain_complete = len(evidences) == 4
    all_valid = all(e.is_valid for e in evidences)
    
    return ApiResponse.success({
        'execution_id': execution_id,
        'chain_complete': chain_complete,
        'all_valid': all_valid,
        'evidence_count': len(evidences),
        'evidences': [e.to_dict() for e in evidences]
    })
