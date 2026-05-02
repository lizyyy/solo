from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json

from app.database import get_db
from app.models import Dataset, BudgetLedger
from app.schemas import QueryRequest, QueryResponse, AggregationResult
from app.services.csv_parser import csv_parser
from app.services.privacy_engine import privacy_engine
from app.services.budget_manager import budget_manager
from app.services.audit_service import audit_service
from app.services.cache_manager import cache_manager

router = APIRouter(prefix="/datasets/{dataset_id}/queries", tags=["差分隐私查询"])


@router.post("/", response_model=QueryResponse)
def execute_query(
    dataset_id: int,
    query: QueryRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    执行差分隐私查询
    
    该接口会：
    1. 检查隐私预算是否充足
    2. 检查是否有缓存结果
    3. 执行差分隐私聚合查询
    4. 消耗隐私预算
    5. 记录审计日志
    6. 缓存结果（可选）
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    # 检查数据是否已导入
    df = csv_parser.load_dataset_data(dataset_id)
    if df is None:
        raise HTTPException(status_code=400, detail=f"数据集 {dataset_id} 尚未导入数据，请先调用 import 接口")
    
    # 获取预算账本
    ledger = db.query(BudgetLedger).filter(BudgetLedger.dataset_id == dataset_id).first()
    if not ledger:
        raise HTTPException(status_code=500, detail=f"数据集 {dataset_id} 缺少预算账本")
    
    # 检查请求的epsilon是否合理
    if query.epsilon <= 0:
        raise HTTPException(status_code=400, detail="Epsilon 必须为正数")
    
    # 检查是否使用缓存
    from_cache = False
    cached_result = None
    
    if query.use_cache:
        # 尝试从缓存获取
        cached_result = cache_manager.get_cached_result(
            db=db,
            dataset_id=dataset_id,
            group_by=query.group_by,
            aggregations=query.aggregations,
            filters=query.filters
        )
        
        if cached_result:
            # 从缓存获取结果
            from_cache = True
            cached_data = cache_manager.parse_cached_result(cached_result)
            
            # 转换为响应格式
            results = []
            suppressed_count = 0
            for item in cached_data:
                result = AggregationResult(
                    group=item.get('group', {}),
                    aggregations=item.get('aggregations', {}),
                    suppressed=item.get('suppressed', False),
                    noise_scale=item.get('noise_scale')
                )
                results.append(result)
                if result.suppressed:
                    suppressed_count += 1
            
            # 记录缓存命中的审计日志（不消耗预算）
            audit_service.create_log(
                db=db,
                dataset_id=dataset_id,
                query_type='aggregate',
                query_parameters={
                    'group_by': query.group_by,
                    'aggregations': query.aggregations,
                    'filters': query.filters,
                    'epsilon': query.epsilon
                },
                epsilon_used=0,  # 缓存命中不消耗预算
                status='success',
                result={'from_cache': True, 'results': cached_data},
                client_info=f"{request.client.host if request.client else 'unknown'} (cache hit)"
            )
            
            return QueryResponse(
                dataset_id=dataset_id,
                query_hash=cached_result.query_hash,
                epsilon_used=0,
                from_cache=True,
                results=results,
                suppressed_count=suppressed_count,
                total_groups=len(results)
            )
    
    # 检查预算是否充足
    has_budget, remaining, error_msg = budget_manager.check_budget(
        db=db,
        dataset_id=dataset_id,
        epsilon_requested=query.epsilon
    )
    
    if not has_budget:
        # 记录拒绝的审计日志
        audit_service.create_log(
            db=db,
            dataset_id=dataset_id,
            query_type='aggregate',
            query_parameters={
                'group_by': query.group_by,
                'aggregations': query.aggregations,
                'filters': query.filters,
                'epsilon': query.epsilon
            },
            epsilon_used=0,
            status='rejected',
            error_message=error_msg,
            client_info=f"{request.client.host if request.client else 'unknown'}"
        )
        raise HTTPException(status_code=403, detail=error_msg)
    
    # 创建待处理的审计日志
    audit_log = audit_service.create_log(
        db=db,
        dataset_id=dataset_id,
        query_type='aggregate',
        query_parameters={
            'group_by': query.group_by,
            'aggregations': query.aggregations,
            'filters': query.filters,
            'epsilon': query.epsilon
        },
        epsilon_used=query.epsilon,
        status='pending',
        client_info=f"{request.client.host if request.client else 'unknown'}"
    )
    
    try:
        # 执行差分隐私查询
        raw_results = privacy_engine.execute_query(
            df=df,
            group_by=query.group_by,
            aggregations=query.aggregations,
            epsilon=query.epsilon,
            suppression_threshold=ledger.suppression_threshold,
            filters=query.filters
        )
        
        # 转换结果格式
        results = []
        suppressed_count = 0
        serializable_results = []
        
        for raw in raw_results:
            result = AggregationResult(
                group=raw.group,
                aggregations=raw.aggregations,
                suppressed=raw.suppressed,
                noise_scale=raw.noise_scale
            )
            results.append(result)
            
            # 构建可序列化的版本用于缓存
            serializable_results.append({
                'group': raw.group,
                'aggregations': raw.aggregations,
                'suppressed': raw.suppressed,
                'noise_scale': raw.noise_scale
            })
            
            if raw.suppressed:
                suppressed_count += 1
        
        # 消耗预算
        budget_transaction = budget_manager.consume_budget(
            db=db,
            dataset_id=dataset_id,
            epsilon_used=query.epsilon,
            reason=f"差分隐私查询: group_by={query.group_by}, aggregations={len(query.aggregations)} 个",
            query_id=audit_log.id
        )
        
        # 更新审计日志状态
        audit_service.update_log_status(
            db=db,
            log_id=audit_log.id,
            status='success',
            result={'results': serializable_results}
        )
        
        # 缓存结果
        if query.use_cache:
            cache_manager.cache_result(
                db=db,
                dataset_id=dataset_id,
                group_by=query.group_by,
                aggregations=query.aggregations,
                filters=query.filters,
                result=serializable_results,
                epsilon_used=query.epsilon
            )
        
        # 生成查询哈希
        query_hash = cache_manager._generate_query_hash(
            dataset_id=dataset_id,
            group_by=query.group_by,
            aggregations=query.aggregations,
            filters=query.filters
        )
        
        return QueryResponse(
            dataset_id=dataset_id,
            query_hash=query_hash,
            epsilon_used=query.epsilon,
            from_cache=False,
            results=results,
            suppressed_count=suppressed_count,
            total_groups=len(results)
        )
        
    except Exception as e:
        # 更新审计日志为失败状态
        audit_service.update_log_status(
            db=db,
            log_id=audit_log.id,
            status='failed',
            error_message=str(e)
        )
        # 退回预算
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{query_hash}/invalidate")
def invalidate_query_cache(
    dataset_id: int,
    query_hash: str,
    db: Session = Depends(get_db)
):
    """使指定查询的缓存失效"""
    count = cache_manager.invalidate_cache(
        db=db,
        dataset_id=dataset_id,
        query_hash=query_hash
    )
    
    return {
        "success": True,
        "dataset_id": dataset_id,
        "query_hash": query_hash,
        "invalidated_count": count
    }


@router.get("/cache/stats")
def get_cache_stats(
    dataset_id: int,
    db: Session = Depends(get_db)
):
    """获取数据集的缓存统计信息"""
    stats = cache_manager.get_cache_stats(db=db, dataset_id=dataset_id)
    return stats
