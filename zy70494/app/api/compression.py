from flask import request
from datetime import datetime
from app import db
from app.api import bp
from app.models import (
    CompressionStrategy, CompressionExecution, Supplier, 
    ExecutionBatch, EvidenceChain
)
from app.utils import (
    ApiResponse, ErrorCode, generate_batch_id, 
    calculate_hash, generate_rerun_flag
)

@bp.route('/compression/strategies', methods=['POST'])
def create_strategy():
    data = request.get_json()
    if not data or 'strategy_code' not in data or 'strategy_name' not in data:
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    existing = CompressionStrategy.query.filter_by(strategy_code=data['strategy_code']).first()
    if existing:
        return ApiResponse.error(ErrorCode.PARAM_ERROR, message='策略代码已存在')
    
    strategy = CompressionStrategy(
        strategy_code=data['strategy_code'],
        strategy_name=data['strategy_name'],
        risk_threshold=data.get('risk_threshold', 0.7),
        compression_level=data.get('compression_level', 5),
        applicable_risk_types=data.get('applicable_risk_types'),
        explanation_before=data.get('explanation_before'),
        explanation_after=data.get('explanation_after'),
        created_by=data.get('created_by')
    )
    db.session.add(strategy)
    db.session.commit()
    
    return ApiResponse.success(strategy.to_dict(), '压缩策略创建成功')

@bp.route('/compression/strategies', methods=['GET'])
def list_strategies():
    strategies = CompressionStrategy.query.filter_by(is_active=True).all()
    return ApiResponse.success([s.to_dict() for s in strategies])

@bp.route('/compression/execute', methods=['POST'])
def execute_compression():
    data = request.get_json()
    if not data or 'supplier_codes' not in data or 'strategy_code' not in data or 'operator' not in data:
        return ApiResponse.error(ErrorCode.PARAM_MISSING)
    
    strategy = CompressionStrategy.query.filter_by(strategy_code=data['strategy_code'], is_active=True).first()
    if not strategy:
        return ApiResponse.error(ErrorCode.STRATEGY_NOT_FOUND)
    
    batch_id = generate_batch_id('COMP')
    operator = data['operator']
    supplier_codes = data['supplier_codes']
    rerun_flag = data.get('rerun_flag')
    parent_batch_id = data.get('parent_batch_id')
    
    batch = ExecutionBatch(
        batch_id=batch_id,
        batch_type='compression',
        operator=operator,
        risk_type=strategy.applicable_risk_types,
        total_count=len(supplier_codes),
        status='running'
    )
    db.session.add(batch)
    
    success_count = 0
    error_count = 0
    execution_results = []
    
    for supplier_code in supplier_codes:
        supplier = Supplier.query.filter_by(supplier_code=supplier_code).first()
        if not supplier:
            error_count += 1
            execution_results.append({
                'supplier_code': supplier_code,
                'status': 'failed',
                'error_code': ErrorCode.SUPPLIER_NOT_FOUND,
                'error_message': '供应商不存在'
            })
            continue
        
        try:
            original_data = f"{supplier.supplier_code}_{supplier.supplier_name}_{supplier.address}"
            original_size = len(original_data.encode('utf-8'))
            original_hash = calculate_hash(original_data)
            
            compression_ratio = 1 - (strategy.compression_level * 0.08)
            compressed_size = int(original_size * compression_ratio)
            compressed_hash = calculate_hash(f"compressed_{original_hash}")
            
            risk_score = 0.3 if supplier.risk_level == 'low' else 0.6 if supplier.risk_level == 'medium' else 0.9
            
            execution = CompressionExecution(
                batch_id=batch_id,
                supplier_code=supplier_code,
                strategy_code=strategy.strategy_code,
                original_data_hash=original_hash,
                compressed_data_hash=compressed_hash,
                original_size=original_size,
                compressed_size=compressed_size,
                compression_ratio=compression_ratio,
                risk_score=risk_score,
                status='success',
                executed_by=operator,
                rerun_flag=rerun_flag,
                parent_execution_id=data.get('parent_execution_id')
            )
            db.session.add(execution)
            db.session.flush()
            
            evidence_types = ['input_validation', 'strategy_selection', 'compression_execution', 'hash_verification']
            for idx, ev_type in enumerate(evidence_types):
                evidence = EvidenceChain(
                    batch_id=batch_id,
                    supplier_code=supplier_code,
                    execution_id=execution.id,
                    chain_order=idx + 1,
                    evidence_type=ev_type,
                    evidence_content=f'执行{ev_type}，风险分数: {risk_score}',
                    evidence_hash=calculate_hash(f'{ev_type}_{execution.id}_{idx}')
                )
                db.session.add(evidence)
            
            supplier.status = 'compressed'
            success_count += 1
            execution_results.append({
                'supplier_code': supplier_code,
                'execution_id': execution.id,
                'status': 'success',
                'compression_ratio': compression_ratio,
                'risk_score': risk_score
            })
            
        except Exception as e:
            error_count += 1
            execution_results.append({
                'supplier_code': supplier_code,
                'status': 'failed',
                'error_code': ErrorCode.EXECUTION_FAILED,
                'error_message': str(e)
            })
    
    batch.success_count = success_count
    batch.error_count = error_count
    batch.status = 'completed' if error_count == 0 else 'partial'
    batch.completed_at = datetime.utcnow()
    
    db.session.commit()
    
    result = {
        'batch_id': batch_id,
        'strategy_code': strategy.strategy_code,
        'total_count': len(supplier_codes),
        'success_count': success_count,
        'error_count': error_count,
        'execution_results': execution_results
    }
    
    return ApiResponse.success(result, '压缩策略执行完成')

@bp.route('/compression/executions/<execution_id>/explanation', methods=['GET'])
def get_strategy_explanation(execution_id):
    execution = CompressionExecution.query.get(execution_id)
    if not execution:
        return ApiResponse.error(ErrorCode.EXECUTION_FAILED, message='执行记录不存在')
    
    strategy = CompressionStrategy.query.filter_by(strategy_code=execution.strategy_code).first()
    if not strategy:
        return ApiResponse.error(ErrorCode.STRATEGY_NOT_FOUND)
    
    explanation = {
        'execution_id': execution_id,
        'supplier_code': execution.supplier_code,
        'strategy_code': strategy.strategy_code,
        'strategy_name': strategy.strategy_name,
        'explanation_before': strategy.explanation_before,
        'explanation_after': strategy.explanation_after,
        'compression_details': {
            'original_size': execution.original_size,
            'compressed_size': execution.compressed_size,
            'compression_ratio': execution.compression_ratio,
            'risk_score': execution.risk_score,
            'risk_threshold': strategy.risk_threshold
        }
    }
    
    return ApiResponse.success(explanation)
