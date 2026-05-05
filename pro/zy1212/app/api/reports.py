from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Project, LoadTestBatch, MonitoringSnapshot, 
    OptimizationAction, MachineCapacity
)
from app.schemas import (
    ReportGenerateRequest,
    ReportExportResult,
    SLOCriteria,
)
from app.services import (
    MetricsCalculator,
    BaselineComparator,
    SLOEvaluator,
    ReportGenerator,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/generate", response_model=ReportExportResult)
def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
):
    from app.schemas.report import ReportTypeEnum, ReportFormatEnum
    
    report_type = request.report_type
    format = request.format
    
    if report_type == ReportTypeEnum.batch_summary:
        return generate_batch_summary_report(request, db, format)
    
    elif report_type == ReportTypeEnum.baseline_comparison:
        return generate_baseline_comparison_report(request, db, format)
    
    elif report_type == ReportTypeEnum.project_summary:
        return generate_project_summary_report(request, db, format)
    
    elif report_type == ReportTypeEnum.optimization_tracking:
        return generate_optimization_tracking_report(request, db, format)
    
    elif report_type == ReportTypeEnum.full_review:
        return generate_full_review_report(request, db, format)
    
    raise HTTPException(status_code=400, detail=f"不支持的报告类型: {report_type}")


def generate_batch_summary_report(
    request: ReportGenerateRequest,
    db: Session,
    format: str,
) -> ReportExportResult:
    if not request.batch_ids or len(request.batch_ids) == 0:
        raise HTTPException(status_code=400, detail="需要提供批次ID")
    
    batch_id = request.batch_ids[0]
    batch = db.query(LoadTestBatch).filter(LoadTestBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
    
    project = db.query(Project).filter(Project.id == batch.project_id).first()
    project_name = project.name if project else "Unknown"
    
    snapshots = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.load_test_batch_id == batch_id
    ).all()
    
    snapshot_dicts = []
    for snapshot in snapshots:
        snapshot_dicts.append({
            "name": snapshot.name,
            "snapshot_time": snapshot.snapshot_time,
            "cpu_utilization_percent": snapshot.cpu_utilization_percent,
            "memory_utilization_percent": snapshot.memory_utilization_percent,
            "disk_utilization_percent": snapshot.disk_utilization_percent,
            "network_utilization_percent": snapshot.network_utilization_percent,
            "database_query_latency_ms": snapshot.database_query_latency_ms,
            "cache_hit_rate": snapshot.cache_hit_rate,
        })
    
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
            "description": action.description,
            "assigned_to": action.assigned_to,
        })
    
    bottleneck_analysis = []
    if batch.bottleneck_analysis:
        bottleneck_analysis = batch.bottleneck_analysis
    
    recommendations = []
    for b in bottleneck_analysis:
        if isinstance(b, dict) and "recommended_actions" in b:
            recommendations.extend(b["recommended_actions"])
    
    if not recommendations:
        recommendations = [
            "建议验证当前性能是否稳定",
            "考虑进行更长时间的稳定性测试",
            "持续监控关键性能指标"
        ]
    
    batch_dict = {
        "id": batch.id,
        "name": batch.name,
        "batch_number": batch.batch_number,
        "description": batch.description,
        "test_type": batch.test_type,
        "environment": batch.environment,
        "start_time": batch.start_time,
        "end_time": batch.end_time,
        "total_requests": batch.total_requests,
        "failed_requests": batch.failed_requests,
        "avg_response_time_ms": batch.avg_response_time_ms,
        "min_response_time_ms": batch.min_response_time_ms,
        "max_response_time_ms": batch.max_response_time_ms,
        "p50_response_time_ms": batch.p50_response_time_ms,
        "p95_response_time_ms": batch.p95_response_time_ms,
        "p99_response_time_ms": batch.p99_response_time_ms,
        "qps": batch.qps,
        "tps": batch.tps,
        "throughput_bytes_per_sec": batch.throughput_bytes_per_sec,
        "error_rate": batch.error_rate,
        "capacity_utilization_percent": batch.capacity_utilization_percent,
        "status": batch.status,
        "notes": batch.notes,
    }
    
    slo_evaluation_dict = None
    if batch.slo_evaluation:
        slo_evaluation_dict = batch.slo_evaluation
    
    if format == "markdown":
        content = ReportGenerator.generate_markdown_batch_report(
            project_name=project_name,
            batch=batch_dict,
            monitoring_snapshots=snapshot_dicts,
            slo_evaluation=slo_evaluation_dict,
            bottleneck_analysis=bottleneck_analysis,
            related_actions=action_dicts,
            recommendations=recommendations,
        )
        filename = f"batch_report_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    else:
        report_data = {
            "project_name": project_name,
            "batch": batch_dict,
            "monitoring_snapshots": snapshot_dicts,
            "slo_evaluation": slo_evaluation_dict,
            "bottleneck_analysis": bottleneck_analysis,
            "related_actions": action_dicts,
            "recommendations": recommendations,
            "generated_at": datetime.now().isoformat(),
        }
        content = ReportGenerator.to_json(report_data)
        filename = f"batch_report_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return ReportExportResult(
        success=True,
        format=format,
        content=content,
        filename=filename,
        generated_at=datetime.now(),
    )


def generate_baseline_comparison_report(
    request: ReportGenerateRequest,
    db: Session,
    format: str,
) -> ReportExportResult:
    if not request.baseline_batch_id or not request.current_batch_id:
        raise HTTPException(status_code=400, detail="需要提供基线批次ID和当前批次ID")
    
    baseline_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == request.baseline_batch_id
    ).first()
    if not baseline_batch:
        raise HTTPException(status_code=404, detail=f"基线批次 {request.baseline_batch_id} 不存在")
    
    current_batch = db.query(LoadTestBatch).filter(
        LoadTestBatch.id == request.current_batch_id
    ).first()
    if not current_batch:
        raise HTTPException(status_code=404, detail=f"当前批次 {request.current_batch_id} 不存在")
    
    project = db.query(Project).filter(Project.id == baseline_batch.project_id).first()
    project_name = project.name if project else "Unknown"
    
    baseline_dict = {
        "id": baseline_batch.id,
        "name": baseline_batch.name,
        "batch_number": baseline_batch.batch_number,
        "test_type": baseline_batch.test_type,
        "environment": baseline_batch.environment,
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
        "name": current_batch.name,
        "batch_number": current_batch.batch_number,
        "test_type": current_batch.test_type,
        "environment": current_batch.environment,
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
    
    comparison_report = BaselineComparator.generate_comparison_report(comparison_result)
    
    if format == "markdown":
        content = ReportGenerator.generate_markdown_baseline_comparison(
            project_name=project_name,
            baseline_batch=baseline_dict,
            current_batch=current_dict,
            comparison_result=comparison_report,
        )
        filename = f"baseline_comparison_{request.baseline_batch_id}_{request.current_batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    else:
        report_data = {
            "project_name": project_name,
            "baseline_batch": baseline_dict,
            "current_batch": current_dict,
            "comparison": comparison_report,
            "generated_at": datetime.now().isoformat(),
        }
        content = ReportGenerator.to_json(report_data)
        filename = f"baseline_comparison_{request.baseline_batch_id}_{request.current_batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return ReportExportResult(
        success=True,
        format=format,
        content=content,
        filename=filename,
        generated_at=datetime.now(),
    )


def generate_project_summary_report(
    request: ReportGenerateRequest,
    db: Session,
    format: str,
) -> ReportExportResult:
    if not request.project_id:
        raise HTTPException(status_code=400, detail="需要提供项目ID")
    
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"项目 {request.project_id} 不存在")
    
    batches = db.query(LoadTestBatch).filter(
        LoadTestBatch.project_id == request.project_id
    ).order_by(LoadTestBatch.batch_number).all()
    
    machine_capacities = db.query(MachineCapacity).filter(
        MachineCapacity.project_id == request.project_id,
        MachineCapacity.is_active == True,
    ).all()
    
    optimization_actions = db.query(OptimizationAction).filter(
        OptimizationAction.project_id == request.project_id
    ).all()
    
    project_dict = {
        "id": project.id,
        "name": project.name,
        "service_name": project.service_name,
        "environment": project.environment,
        "description": project.description,
    }
    
    batches_dicts = []
    for batch in batches:
        batches_dicts.append({
            "id": batch.id,
            "name": batch.name,
            "batch_number": batch.batch_number,
            "test_type": batch.test_type,
            "environment": batch.environment,
            "qps": batch.qps,
            "avg_response_time_ms": batch.avg_response_time_ms,
            "p95_response_time_ms": batch.p95_response_time_ms,
            "error_rate": batch.error_rate,
            "is_baseline": batch.is_baseline,
            "created_at": batch.created_at,
        })
    
    machine_dicts = []
    for mc in machine_capacities:
        machine_dicts.append({
            "id": mc.id,
            "name": mc.name,
            "machine_type": mc.machine_type,
            "cpu_cores": mc.cpu_cores,
            "memory_gb": mc.memory_gb,
            "max_qps_estimated": mc.max_qps_estimated,
        })
    
    action_dicts = []
    for action in optimization_actions:
        action_dicts.append({
            "id": action.id,
            "title": action.title,
            "status": action.status,
            "priority": action.priority,
            "action_type": action.action_type,
            "assigned_to": action.assigned_to,
            "created_at": action.created_at,
        })
    
    if format == "markdown":
        content = ReportGenerator.generate_full_review_report(
            project_name=project.name,
            project=project_dict,
            batches=batches_dicts,
            machine_capacities=machine_dicts,
            optimization_actions=action_dicts,
        )
        filename = f"project_summary_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    else:
        report_data = {
            "project": project_dict,
            "batches": batches_dicts,
            "machine_capacities": machine_dicts,
            "optimization_actions": action_dicts,
            "generated_at": datetime.now().isoformat(),
        }
        content = ReportGenerator.to_json(report_data)
        filename = f"project_summary_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return ReportExportResult(
        success=True,
        format=format,
        content=content,
        filename=filename,
        generated_at=datetime.now(),
    )


def generate_optimization_tracking_report(
    request: ReportGenerateRequest,
    db: Session,
    format: str,
) -> ReportExportResult:
    if not request.project_id:
        raise HTTPException(status_code=400, detail="需要提供项目ID")
    
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"项目 {request.project_id} 不存在")
    
    actions = db.query(OptimizationAction).filter(
        OptimizationAction.project_id == request.project_id
    ).order_by(OptimizationAction.created_at.desc()).all()
    
    pending_actions = [a for a in actions if a.status == "pending"]
    in_progress_actions = [a for a in actions if a.status == "in_progress"]
    completed_actions = [a for a in actions if a.status == "implemented"]
    verified_actions = [a for a in actions if a.status == "verified"]
    
    def action_to_dict(action):
        return {
            "id": action.id,
            "title": action.title,
            "description": action.description,
            "action_type": action.action_type,
            "priority": action.priority,
            "status": action.status,
            "assigned_to": action.assigned_to,
            "proposed_solution": action.proposed_solution,
            "expected_improvement": action.expected_improvement,
            "root_cause_analysis": action.root_cause_analysis,
            "implemented_at": action.implemented_at,
            "verified_at": action.verified_at,
            "actual_improvement": action.actual_improvement,
            "created_at": action.created_at,
        }
    
    summary = {
        "total": len(actions),
        "pending": len(pending_actions),
        "in_progress": len(in_progress_actions),
        "completed": len(completed_actions),
        "verified": len(verified_actions),
    }
    
    if format == "markdown":
        action_dicts = [action_to_dict(a) for a in actions]
        
        content = ReportGenerator.generate_full_review_report(
            project_name=project.name,
            project={"name": project.name, "service_name": project.service_name},
            batches=[],
            machine_capacities=[],
            optimization_actions=action_dicts,
        )
        
        filename = f"optimization_tracking_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    else:
        report_data = {
            "project_name": project.name,
            "summary": summary,
            "pending_actions": [action_to_dict(a) for a in pending_actions],
            "in_progress_actions": [action_to_dict(a) for a in in_progress_actions],
            "completed_actions": [action_to_dict(a) for a in completed_actions],
            "verified_actions": [action_to_dict(a) for a in verified_actions],
            "all_actions": [action_to_dict(a) for a in actions],
            "generated_at": datetime.now().isoformat(),
        }
        content = ReportGenerator.to_json(report_data)
        filename = f"optimization_tracking_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return ReportExportResult(
        success=True,
        format=format,
        content=content,
        filename=filename,
        generated_at=datetime.now(),
    )


def generate_full_review_report(
    request: ReportGenerateRequest,
    db: Session,
    format: str,
) -> ReportExportResult:
    if not request.project_id:
        raise HTTPException(status_code=400, detail="需要提供项目ID")
    
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"项目 {request.project_id} 不存在")
    
    batches = db.query(LoadTestBatch).filter(
        LoadTestBatch.project_id == request.project_id
    ).order_by(LoadTestBatch.batch_number).all()
    
    machine_capacities = db.query(MachineCapacity).filter(
        MachineCapacity.project_id == request.project_id,
        MachineCapacity.is_active == True,
    ).all()
    
    optimization_actions = db.query(OptimizationAction).filter(
        OptimizationAction.project_id == request.project_id
    ).all()
    
    project_dict = {
        "id": project.id,
        "name": project.name,
        "service_name": project.service_name,
        "environment": project.environment,
        "description": project.description,
    }
    
    batches_dicts = []
    for batch in batches:
        batches_dicts.append({
            "id": batch.id,
            "name": batch.name,
            "batch_number": batch.batch_number,
            "test_type": batch.test_type,
            "environment": batch.environment,
            "qps": batch.qps,
            "avg_response_time_ms": batch.avg_response_time_ms,
            "p95_response_time_ms": batch.p95_response_time_ms,
            "error_rate": batch.error_rate,
            "is_baseline": batch.is_baseline,
            "created_at": batch.created_at,
        })
    
    machine_dicts = []
    for mc in machine_capacities:
        machine_dicts.append({
            "id": mc.id,
            "name": mc.name,
            "machine_type": mc.machine_type,
            "cpu_cores": mc.cpu_cores,
            "memory_gb": mc.memory_gb,
            "max_qps_estimated": mc.max_qps_estimated,
        })
    
    action_dicts = []
    for action in optimization_actions:
        action_dicts.append({
            "id": action.id,
            "title": action.title,
            "status": action.status,
            "priority": action.priority,
            "action_type": action.action_type,
            "assigned_to": action.assigned_to,
            "description": action.description,
            "created_at": action.created_at,
        })
    
    if format == "markdown":
        content = ReportGenerator.generate_full_review_report(
            project_name=project.name,
            project=project_dict,
            batches=batches_dicts,
            machine_capacities=machine_dicts,
            optimization_actions=action_dicts,
        )
        filename = f"full_review_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    else:
        report_data = {
            "project": project_dict,
            "batches": batches_dicts,
            "machine_capacities": machine_dicts,
            "optimization_actions": action_dicts,
            "generated_at": datetime.now().isoformat(),
        }
        content = ReportGenerator.to_json(report_data)
        filename = f"full_review_{request.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return ReportExportResult(
        success=True,
        format=format,
        content=content,
        filename=filename,
        generated_at=datetime.now(),
    )


@router.get("/download/{filename}")
def download_report(filename: str):
    raise HTTPException(status_code=501, detail="文件下载功能尚未实现")
