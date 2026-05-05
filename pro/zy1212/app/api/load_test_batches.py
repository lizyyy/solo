from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Project, TrafficModel, LoadTestBatch, 
    MonitoringSnapshot, OptimizationAction
)
from app.schemas import (
    LoadTestBatch as LoadTestBatchSchema,
    LoadTestBatchCreate,
    LoadTestBatchRawDataImport,
    LoadTestBatchUpdate,
    LoadTestBatchList,
    LoadTestBatchDetail,
    BatchComparisonRequest,
    SLOEvaluationRequest,
    LoadTestMetrics,
)
from app.services import (
    MetricsCalculator,
    BaselineComparator,
    SLOEvaluator,
    BottleneckAnalyzer,
)

router = APIRouter(prefix="/load-test-batches", tags=["Load Test Batches"])


@router.post("/", response_model=LoadTestBatchSchema, status_code=201)
def create_load_test_batch(
    batch: LoadTestBatchCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == batch.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if batch.traffic_model_id:
        traffic_model = db.query(TrafficModel).filter(
            TrafficModel.id == batch.traffic_model_id
        ).first()
        if not traffic_model:
            raise HTTPException(status_code=404, detail="流量模型不存在")
    
    existing_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.project_id == batch.project_id,
        LoadTestBatch.batch_number == batch.batch_number,
    ).first()
    if existing_batch:
        raise HTTPException(
            status_code=400,
            detail=f"批次号 #{batch.batch_number} 已存在于该项目中"
        )
    
    db_batch = LoadTestBatch(
        project_id=batch.project_id,
        traffic_model_id=batch.traffic_model_id,
        name=batch.name,
        batch_number=batch.batch_number,
        description=batch.description,
        test_type=batch.test_type.value,
        environment=batch.environment.value,
        start_time=batch.start_time,
        end_time=batch.end_time,
        total_requests=batch.total_requests,
        failed_requests=batch.failed_requests,
        avg_response_time_ms=batch.avg_response_time_ms,
        min_response_time_ms=batch.min_response_time_ms,
        max_response_time_ms=batch.max_response_time_ms,
        p50_response_time_ms=batch.p50_response_time_ms,
        p95_response_time_ms=batch.p95_response_time_ms,
        p99_response_time_ms=batch.p99_response_time_ms,
        qps=batch.qps,
        tps=batch.tps,
        throughput_bytes_per_sec=batch.throughput_bytes_per_sec,
        error_rate=batch.error_rate,
        capacity_utilization_percent=batch.capacity_utilization_percent,
        raw_data_source=batch.raw_data_source,
        raw_data=batch.raw_data,
        is_baseline=batch.is_baseline,
        status=batch.status,
        notes=batch.notes,
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.post("/import-raw", response_model=LoadTestBatchSchema, status_code=201)
def import_raw_batch_data(
    import_data: LoadTestBatchRawDataImport,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == import_data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    existing_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.project_id == import_data.project_id,
        LoadTestBatch.batch_number == import_data.batch_number,
    ).first()
    if existing_batch:
        raise HTTPException(
            status_code=400,
            detail=f"批次号 #{import_data.batch_number} 已存在于该项目中"
        )
    
    response_times = import_data.response_times_ms
    
    if not response_times:
        raise HTTPException(status_code=400, detail="响应时间数据不能为空")
    
    if import_data.request_counts:
        total_requests = sum(import_data.request_counts.values())
    else:
        total_requests = len(response_times)
    
    if import_data.error_details:
        failed_requests = sum(import_data.error_details.values())
    else:
        failed_requests = 0
    
    duration_seconds = 60.0
    if import_data.start_time and import_data.end_time:
        duration_seconds = (import_data.end_time - import_data.start_time).total_seconds()
    
    metrics = MetricsCalculator.calculate_all_metrics(
        response_times_ms=response_times,
        total_requests=total_requests,
        failed_requests=failed_requests,
        duration_seconds=duration_seconds,
    )
    
    raw_data = {}
    if import_data.k6_summary:
        raw_data["k6_summary"] = import_data.k6_summary
    if import_data.jmeter_summary:
        raw_data["jmeter_summary"] = import_data.jmeter_summary
    if import_data.error_details:
        raw_data["error_details"] = import_data.error_details
    
    db_batch = LoadTestBatch(
        project_id=import_data.project_id,
        name=import_data.name,
        batch_number=import_data.batch_number,
        test_type=import_data.test_type.value,
        environment=import_data.environment.value,
        start_time=import_data.start_time,
        end_time=import_data.end_time,
        total_requests=metrics["total_requests"],
        failed_requests=metrics["failed_requests"],
        avg_response_time_ms=metrics["avg_response_time_ms"],
        min_response_time_ms=metrics["min_response_time_ms"],
        max_response_time_ms=metrics["max_response_time_ms"],
        p50_response_time_ms=metrics["p50_response_time_ms"],
        p95_response_time_ms=metrics["p95_response_time_ms"],
        p99_response_time_ms=metrics["p99_response_time_ms"],
        qps=metrics["qps"],
        tps=metrics["tps"],
        error_rate=metrics["error_rate"],
        capacity_utilization_percent=metrics["capacity_utilization_percent"],
        raw_data_source="raw_import",
        raw_data=raw_data if raw_data else None,
        notes=import_data.notes,
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.get("/", response_model=LoadTestBatchList)
def list_load_test_batches(
    project_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    test_type: Optional[str] = None,
    environment: Optional[str] = None,
    is_baseline: Optional[bool] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(LoadTestBatch)
    
    if project_id:
        query = query.filter(LoadTestBatch.project_id == project_id)
    
    if test_type:
        query = query.filter(LoadTestBatch.test_type == test_type)
    
    if environment:
        query = query.filter(LoadTestBatch.environment == environment)
    
    if is_baseline is not None:
        query = query.filter(LoadTestBatch.is_baseline == is_baseline)
    
    if status:
        query = query.filter(LoadTestBatch.status == status)
    
    total = query.count()
    batches = query.order_by(
        LoadTestBatch.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return LoadTestBatchList(
        total=total,
        items=batches,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{batch_id}", response_model=LoadTestBatchDetail)
def get_load_test_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == batch_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="压测批次不存在")
    
    snapshot_count = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.load_test_batch_id == batch_id
    ).count()
    
    related_actions = db.query(OptimizationAction).filter(
        OptimizationAction.related_batch_id == batch_id
    ).all()
    
    action_dicts = []
    for action in related_actions:
        action_dicts.append({
            "id": action.id,
            "title": action.title,
            "status": action.status,
            "priority": action.priority,
            "action_type": action.action_type,
        })
    
    return LoadTestBatchDetail(
        id=batch.id,
        project_id=batch.project_id,
        traffic_model_id=batch.traffic_model_id,
        name=batch.name,
        batch_number=batch.batch_number,
        description=batch.description,
        test_type=batch.test_type,
        environment=batch.environment,
        start_time=batch.start_time,
        end_time=batch.end_time,
        total_requests=batch.total_requests,
        failed_requests=batch.failed_requests,
        avg_response_time_ms=batch.avg_response_time_ms,
        min_response_time_ms=batch.min_response_time_ms,
        max_response_time_ms=batch.max_response_time_ms,
        p50_response_time_ms=batch.p50_response_time_ms,
        p95_response_time_ms=batch.p95_response_time_ms,
        p99_response_time_ms=batch.p99_response_time_ms,
        qps=batch.qps,
        tps=batch.tps,
        throughput_bytes_per_sec=batch.throughput_bytes_per_sec,
        error_rate=batch.error_rate,
        capacity_utilization_percent=batch.capacity_utilization_percent,
        raw_data_source=batch.raw_data_source,
        raw_data=batch.raw_data,
        is_baseline=batch.is_baseline,
        baseline_comparison=batch.baseline_comparison,
        slo_evaluation=batch.slo_evaluation,
        bottleneck_analysis=batch.bottleneck_analysis,
        status=batch.status,
        notes=batch.notes,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        monitoring_snapshot_count=snapshot_count,
        related_optimization_actions=action_dicts if action_dicts else None,
    )


@router.put("/{batch_id}", response_model=LoadTestBatchSchema)
def update_load_test_batch(
    batch_id: int,
    batch_update: LoadTestBatchUpdate,
    db: Session = Depends(get_db),
):
    batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == batch_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="压测批次不存在")
    
    update_data = batch_update.model_dump(exclude_unset=True)
    
    if 'batch_number' in update_data:
        existing_batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.project_id == batch.project_id,
            LoadTestBatch.batch_number == update_data['batch_number'],
            LoadTestBatch.id != batch_id,
        ).first()
        if existing_batch:
            raise HTTPException(
                status_code=400,
                detail=f"批次号 #{update_data['batch_number']} 已存在"
            )
    
    for key, value in update_data.items():
        if hasattr(batch, key):
            if key == 'test_type' and value:
                setattr(batch, key, value.value)
            elif key == 'environment' and value:
                setattr(batch, key, value.value)
            else:
                setattr(batch, key, value)
    
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}", status_code=204)
def delete_load_test_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == batch_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="压测批次不存在")
    
    db.delete(batch)
    db.commit()


@router.post("/compare")
def compare_batches(
    request: BatchComparisonRequest,
    db: Session = Depends(get_db),
):
    baseline_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == request.baseline_batch_id
    ).first()
    if not baseline_batch:
        raise HTTPException(status_code=404, detail="基线批次不存在")
    
    current_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == request.current_batch_id
    ).first()
    if not current_batch:
        raise HTTPException(status_code=404, detail="当前批次不存在")
    
    baseline_dict = {
        "id": baseline_batch.id,
        "qps": baseline_batch.qps,
        "tps": baseline_batch.tps,
        "avg_response_time_ms": baseline_batch.avg_response_time_ms,
        "p50_response_time_ms": baseline_batch.p50_response_time_ms,
        "p95_response_time_ms": baseline_batch.p95_response_time_ms,
        "p99_response_time_ms": baseline_batch.p99_response_time_ms,
        "error_rate": baseline_batch.error_rate,
        "throughput_bytes_per_sec": baseline_batch.throughput_bytes_per_sec,
        "capacity_utilization_percent": baseline_batch.capacity_utilization_percent,
    }
    
    current_dict = {
        "id": current_batch.id,
        "qps": current_batch.qps,
        "tps": current_batch.tps,
        "avg_response_time_ms": current_batch.avg_response_time_ms,
        "p50_response_time_ms": current_batch.p50_response_time_ms,
        "p95_response_time_ms": current_batch.p95_response_time_ms,
        "p99_response_time_ms": current_batch.p99_response_time_ms,
        "error_rate": current_batch.error_rate,
        "throughput_bytes_per_sec": current_batch.throughput_bytes_per_sec,
        "capacity_utilization_percent": current_batch.capacity_utilization_percent,
    }
    
    comparison_result = BaselineComparator.compare_batches(
        baseline_batch=baseline_dict,
        current_batch=current_dict,
        metrics_to_compare=request.metrics_to_compare,
    )
    
    current_batch.baseline_comparison = {
        "baseline_batch_id": comparison_result.baseline_batch_id,
        "current_batch_id": comparison_result.current_batch_id,
        "overall_status": comparison_result.overall_status,
        "summary": comparison_result.summary,
        "comparisons": [
            {
                "metric_name": c.metric_name,
                "baseline_value": c.baseline_value,
                "current_value": c.current_value,
                "change_percent": c.change_percent,
                "is_improvement": c.is_improvement,
            }
            for c in comparison_result.comparisons
        ],
    }
    db.commit()
    
    return {
        "success": True,
        "result": comparison_result,
    }


@router.post("/evaluate-slo")
def evaluate_slo(
    request: SLOEvaluationRequest,
    db: Session = Depends(get_db),
):
    batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == request.batch_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    snapshots = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.load_test_batch_id == request.batch_id
    ).all()
    
    cpu_util = None
    memory_util = None
    if snapshots:
        cpu_utils = [s.cpu_utilization_percent for s in snapshots if s.cpu_utilization_percent is not None]
        memory_utils = [s.memory_utilization_percent for s in snapshots if s.memory_utilization_percent is not None]
        
        if cpu_utils:
            cpu_util = sum(cpu_utils) / len(cpu_utils)
        if memory_utils:
            memory_util = sum(memory_utils) / len(memory_utils)
    
    batch_metrics = {
        "avg_response_time_ms": batch.avg_response_time_ms,
        "p50_response_time_ms": batch.p50_response_time_ms,
        "p95_response_time_ms": batch.p95_response_time_ms,
        "p99_response_time_ms": batch.p99_response_time_ms,
        "error_rate": batch.error_rate,
        "qps": batch.qps,
        "cpu_utilization_percent": cpu_util,
        "memory_utilization_percent": memory_util,
    }
    
    evaluation_result = SLOEvaluator.evaluate_batch(
        batch_metrics=batch_metrics,
        criteria=request.criteria,
    )
    
    batch.slo_evaluation = {
        "criteria": request.criteria.model_dump(),
        "passed": evaluation_result.passed,
        "status": evaluation_result.status.value,
        "violations": evaluation_result.violations,
        "warnings": evaluation_result.warnings,
        "summary": evaluation_result.summary,
    }
    db.commit()
    
    return {
        "success": True,
        "result": evaluation_result,
    }


@router.post("/{batch_id}/analyze-bottlenecks")
def analyze_bottlenecks(
    batch_id: int,
    db: Session = Depends(get_db),
):
    batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == batch_id
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    snapshots = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.load_test_batch_id == batch_id
    ).all()
    
    snapshot_dicts = []
    for snapshot in snapshots:
        snapshot_dicts.append({
            "cpu_utilization_percent": snapshot.cpu_utilization_percent,
            "memory_utilization_percent": snapshot.memory_utilization_percent,
            "database_query_latency_ms": snapshot.database_query_latency_ms,
            "cache_hit_rate": snapshot.cache_hit_rate,
        })
    
    batch_metrics = {
        "error_rate": batch.error_rate or 0,
        "p95_response_time_ms": batch.p95_response_time_ms or 0,
        "qps": batch.qps or 0,
    }
    
    bottlenecks = BottleneckAnalyzer.analyze_bottlenecks(
        batch_metrics=batch_metrics,
        monitoring_snapshots=snapshot_dicts,
        slo_evaluation=batch.slo_evaluation,
    )
    
    baseline_comparison_dict = None
    if batch.baseline_comparison:
        baseline_comparison_dict = {
            "overall_status": batch.baseline_comparison.get("overall_status"),
        }
    
    next_plan = BottleneckAnalyzer.generate_next_test_plan(
        batch_metrics=batch_metrics,
        bottlenecks=bottlenecks,
        baseline_comparison=baseline_comparison_dict,
        slo_evaluation=batch.slo_evaluation,
    )
    
    bottleneck_dicts = []
    for b in bottlenecks:
        bottleneck_dicts.append({
            "bottleneck_type": b.bottleneck_type,
            "severity": b.severity,
            "description": b.description,
            "affected_metrics": b.affected_metrics,
            "recommended_actions": b.recommended_actions,
        })
    
    batch.bottleneck_analysis = bottleneck_dicts
    db.commit()
    
    return {
        "success": True,
        "bottlenecks": bottleneck_dicts,
        "next_test_plan": {
            "suggested_changes": next_plan.suggested_changes,
            "expected_improvements": next_plan.expected_improvements,
            "recommended_test_type": next_plan.recommended_test_type,
            "estimated_duration_minutes": next_plan.estimated_duration_minutes,
            "notes": next_plan.notes,
        },
    }
