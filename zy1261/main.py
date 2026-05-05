from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import tempfile

from database import get_db, init_db, engine, Base
from models import (
    PolicyVersion, PolicyStatus, RouteConfig, ProtectionPolicy,
    CircuitBreakerRecord, CircuitBreakerState, RequestDecision,
    DependencyHealth, RequestSample
)
from schemas import (
    PolicyVersionCreate, CanaryReleaseStart, CanaryPercentageUpdate,
    PolicyRollback, RequestEvaluate, RequestResult, HealthReport,
    CircuitBreakerAction, ReportExportRequest
)
from config_importer import (
    import_all_configs, import_routes, import_protection_policy,
    import_dependency_health, import_request_samples
)
from policy_version_manager import (
    create_policy_version, get_policy_version, get_policy_version_by_version,
    list_policy_versions, activate_policy_version, start_canary_release,
    update_canary_percentage, rollback_policy_version, get_active_policy_version,
    get_canary_policy_versions, get_policy_versions_summary
)
from protection_engine import ProtectionEngine
from health_manager import HealthManager
from report_exporter import ReportExporter


app = FastAPI(
    title="接口保护策略验证服务",
    description="用于团队验证接口限流、熔断、降级策略的本地后端 API 服务",
    version="1.0.0"
)

engine_instance = None

@app.on_event("startup")
async def startup_event():
    global engine_instance
    init_db()
    engine_instance = engine


@app.get("/")
async def root():
    return {
        "service": "接口保护策略验证服务",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "config": "/api/v1/config",
            "policy": "/api/v1/policy",
            "evaluate": "/api/v1/evaluate",
            "health": "/api/v1/health",
            "report": "/api/v1/report"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/v1/config/routes")
async def list_routes(db: Session = Depends(get_db)):
    routes = db.query(RouteConfig).all()
    return [
        {
            "id": r.id,
            "route_key": r.route_key,
            "path": r.path,
            "method": r.method,
            "service_name": r.service_name,
            "endpoint_name": r.endpoint_name,
            "policy_version_id": r.policy_version_id
        }
        for r in routes
    ]


@app.get("/api/v1/config/routes/{route_key}")
async def get_route(route_key: str, db: Session = Depends(get_db)):
    route = db.query(RouteConfig).filter(RouteConfig.route_key == route_key).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route not found: {route_key}")
    return {
        "id": route.id,
        "route_key": route.route_key,
        "path": route.path,
        "method": route.method,
        "service_name": route.service_name,
        "endpoint_name": route.endpoint_name,
        "policy_version_id": route.policy_version_id
    }


@app.get("/api/v1/config/policies")
async def list_policies(db: Session = Depends(get_db)):
    policies = db.query(ProtectionPolicy).all()
    return [
        {
            "id": p.id,
            "policy_key": p.policy_key,
            "route_key": p.route_key,
            "policy_version_id": p.policy_version_id,
            "rate_limit": {
                "enabled": p.rate_limit_enabled,
                "type": p.rate_limit_type,
                "threshold": p.rate_limit_threshold,
                "window_seconds": p.rate_limit_window_seconds,
                "burst": p.rate_limit_burst
            },
            "circuit_breaker": {
                "enabled": p.circuit_breaker_enabled,
                "failure_threshold": p.cb_failure_threshold,
                "min_requests": p.cb_min_requests,
                "half_open_max_requests": p.cb_half_open_max_requests,
                "open_duration_seconds": p.cb_open_duration_seconds,
                "sliding_window_size": p.cb_sliding_window_size
            },
            "degradation": {
                "enabled": p.degradation_enabled,
                "fallback_type": p.degradation_fallback_type,
                "fallback_value": p.degradation_fallback_value
            }
        }
        for p in policies
    ]


@app.get("/api/v1/config/policies/{policy_key}")
async def get_policy(policy_key: str, db: Session = Depends(get_db)):
    policy = db.query(ProtectionPolicy).filter(ProtectionPolicy.policy_key == policy_key).first()
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy not found: {policy_key}")
    return {
        "id": policy.id,
        "policy_key": policy.policy_key,
        "route_key": policy.route_key,
        "policy_version_id": policy.policy_version_id,
        "rate_limit": {
            "enabled": policy.rate_limit_enabled,
            "type": policy.rate_limit_type,
            "threshold": policy.rate_limit_threshold,
            "window_seconds": policy.rate_limit_window_seconds,
            "burst": policy.rate_limit_burst
        },
        "circuit_breaker": {
            "enabled": policy.circuit_breaker_enabled,
            "failure_threshold": policy.cb_failure_threshold,
            "min_requests": policy.cb_min_requests,
            "half_open_max_requests": policy.cb_half_open_max_requests,
            "open_duration_seconds": policy.cb_open_duration_seconds,
            "sliding_window_size": policy.cb_sliding_window_size
        },
        "degradation": {
            "enabled": policy.degradation_enabled,
            "fallback_type": policy.degradation_fallback_type,
            "fallback_value": policy.degradation_fallback_value
        }
    }


@app.post("/api/v1/config/import")
async def import_config(
    routes_file: Optional[UploadFile] = File(None),
    protection_policy_file: Optional[UploadFile] = File(None),
    dependency_health_file: Optional[UploadFile] = File(None),
    request_samples_file: Optional[UploadFile] = File(None),
    create_version: bool = True,
    version_description: str = "Imported configuration",
    db: Session = Depends(get_db)
):
    temp_files = {}
    
    try:
        if routes_file:
            temp_fd, temp_path = tempfile.mkstemp(suffix='.yaml')
            os.close(temp_fd)
            with open(temp_path, 'wb') as f:
                f.write(await routes_file.read())
            temp_files['routes'] = temp_path
        
        if protection_policy_file:
            temp_fd, temp_path = tempfile.mkstemp(suffix='.yaml')
            os.close(temp_fd)
            with open(temp_path, 'wb') as f:
                f.write(await protection_policy_file.read())
            temp_files['protection'] = temp_path
        
        if dependency_health_file:
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jsonl')
            os.close(temp_fd)
            with open(temp_path, 'wb') as f:
                f.write(await dependency_health_file.read())
            temp_files['dependency_health'] = temp_path
        
        if request_samples_file:
            temp_fd, temp_path = tempfile.mkstemp(suffix='.jsonl')
            os.close(temp_fd)
            with open(temp_path, 'wb') as f:
                f.write(await request_samples_file.read())
            temp_files['request_samples'] = temp_path
        
        result = import_all_configs(
            db,
            routes_file=temp_files.get('routes'),
            protection_policy_file=temp_files.get('protection'),
            dependency_health_file=temp_files.get('dependency_health'),
            request_samples_file=temp_files.get('request_samples'),
            create_version=create_version,
            version_description=version_description
        )
        
        return {
            "message": "Configuration imported successfully",
            "routes_count": len(result["routes"]),
            "policies_count": len(result["policies"]),
            "dependencies_count": len(result["dependencies"]),
            "samples_count": len(result["samples"]),
            "policy_version": {
                "id": result["policy_version"].id,
                "version": result["policy_version"].version
            } if result["policy_version"] else None
        }
    
    finally:
        for temp_path in temp_files.values():
            if os.path.exists(temp_path):
                os.remove(temp_path)


@app.get("/api/v1/policy/versions")
async def list_policy_versions_endpoint(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_policy_versions_summary(db)


@app.get("/api/v1/policy/versions/{version_id}")
async def get_policy_version_endpoint(version_id: int, db: Session = Depends(get_db)):
    version = get_policy_version(db, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Policy version not found: {version_id}")
    return {
        "id": version.id,
        "version": version.version,
        "description": version.description,
        "status": version.status,
        "canary_percentage": version.canary_percentage,
        "created_at": version.created_at.isoformat() if version.created_at else None,
        "updated_at": version.updated_at.isoformat() if version.updated_at else None
    }


@app.get("/api/v1/policy/versions/by-version/{version}")
async def get_policy_version_by_version_endpoint(version: str, db: Session = Depends(get_db)):
    policy_version = get_policy_version_by_version(db, version)
    if not policy_version:
        raise HTTPException(status_code=404, detail=f"Policy version not found: {version}")
    return {
        "id": policy_version.id,
        "version": policy_version.version,
        "description": policy_version.description,
        "status": policy_version.status,
        "canary_percentage": policy_version.canary_percentage,
        "created_at": policy_version.created_at.isoformat() if policy_version.created_at else None
    }


@app.post("/api/v1/policy/versions")
async def create_policy_version_endpoint(
    request: PolicyVersionCreate,
    db: Session = Depends(get_db)
):
    try:
        version = create_policy_version(
            db,
            version=request.version,
            description=request.description,
            routes_config=request.routes_config,
            protection_config=request.protection_config,
            auto_apply=request.auto_apply
        )
        return {
            "message": "Policy version created successfully",
            "id": version.id,
            "version": version.version,
            "status": version.status
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/policy/versions/{version_id}/activate")
async def activate_policy_version_endpoint(version_id: int, db: Session = Depends(get_db)):
    try:
        version = activate_policy_version(db, version_id)
        return {
            "message": "Policy version activated successfully",
            "id": version.id,
            "version": version.version,
            "status": version.status
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/policy/canary/start")
async def start_canary_release_endpoint(
    request: CanaryReleaseStart,
    db: Session = Depends(get_db)
):
    try:
        version = start_canary_release(
            db,
            version_id=request.version_id,
            canary_percentage=request.canary_percentage,
            keep_old_active=request.keep_old_active
        )
        return {
            "message": "Canary release started successfully",
            "id": version.id,
            "version": version.version,
            "status": version.status,
            "canary_percentage": version.canary_percentage
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/policy/canary/update")
async def update_canary_percentage_endpoint(
    request: CanaryPercentageUpdate,
    db: Session = Depends(get_db)
):
    try:
        version = update_canary_percentage(
            db,
            version_id=request.version_id,
            canary_percentage=request.canary_percentage
        )
        return {
            "message": "Canary percentage updated successfully",
            "id": version.id,
            "version": version.version,
            "status": version.status,
            "canary_percentage": version.canary_percentage
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/policy/rollback")
async def rollback_policy_version_endpoint(
    request: PolicyRollback,
    db: Session = Depends(get_db)
):
    try:
        result = rollback_policy_version(
            db,
            from_version_id=request.from_version_id,
            to_version_id=request.to_version_id
        )
        return {
            "message": "Policy rolled back successfully",
            **result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/policy/active")
async def get_active_policy(db: Session = Depends(get_db)):
    version = get_active_policy_version(db)
    if not version:
        return {"active_version": None}
    return {
        "active_version": {
            "id": version.id,
            "version": version.version,
            "description": version.description,
            "status": version.status,
            "canary_percentage": version.canary_percentage
        }
    }


@app.post("/api/v1/evaluate")
async def evaluate_request(
    request: RequestEvaluate,
    db: Session = Depends(get_db)
):
    engine = ProtectionEngine(db)
    result = engine.evaluate_request(
        path=request.path,
        method=request.method,
        request_id=request.request_id,
        headers=request.headers,
        query_params=request.query_params,
        body=request.body,
        is_dry_run=request.is_dry_run,
        request_identifier=request.request_identifier
    )
    return result


@app.post("/api/v1/evaluate/result")
async def record_request_result(
    request: RequestResult,
    db: Session = Depends(get_db)
):
    engine = ProtectionEngine(db)
    result = engine.record_request_result(
        request_id=request.request_id,
        is_success=request.is_success,
        response_status=request.response_status,
        response_time_ms=request.response_time_ms
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/v1/evaluate/logs/{request_id}")
async def get_request_log(request_id: str, db: Session = Depends(get_db)):
    engine = ProtectionEngine(db)
    log = engine.get_request_log(request_id)
    if not log:
        raise HTTPException(status_code=404, detail=f"Request log not found: {request_id}")
    return log


@app.post("/api/v1/health/report")
async def report_health(
    request: HealthReport,
    db: Session = Depends(get_db)
):
    manager = HealthManager(db)
    health = manager.report_health(
        dependency_key=request.dependency_key,
        is_healthy=request.is_healthy,
        error_rate=request.error_rate,
        latency_p99_ms=request.latency_p99_ms,
        success_count=request.success_count,
        failure_count=request.failure_count,
        total_requests=request.total_requests,
        service_name=request.service_name,
        endpoint=request.endpoint
    )
    return {
        "message": "Health reported successfully",
        "dependency_key": health.dependency_key,
        "is_healthy": health.is_healthy
    }


@app.get("/api/v1/health/dependencies")
async def list_dependencies_health(
    healthy_only: bool = False,
    unhealthy_only: bool = False,
    db: Session = Depends(get_db)
):
    manager = HealthManager(db)
    return manager.list_dependencies_health(
        healthy_only=healthy_only,
        unhealthy_only=unhealthy_only
    )


@app.get("/api/v1/health/dependencies/{dependency_key}")
async def get_dependency_health(dependency_key: str, db: Session = Depends(get_db)):
    manager = HealthManager(db)
    health = manager.get_dependency_health(dependency_key)
    if not health:
        raise HTTPException(status_code=404, detail=f"Dependency not found: {dependency_key}")
    return health


@app.get("/api/v1/health/circuit-breakers")
async def list_circuit_breakers(
    route_key: Optional[str] = None,
    db: Session = Depends(get_db)
):
    manager = HealthManager(db)
    return manager.get_circuit_breaker_status(route_key)


@app.get("/api/v1/health/circuit-breakers/open")
async def get_open_circuits(db: Session = Depends(get_db)):
    manager = HealthManager(db)
    return manager.get_open_circuits()


@app.post("/api/v1/health/circuit-breakers/open")
async def force_circuit_open(
    request: CircuitBreakerAction,
    db: Session = Depends(get_db)
):
    manager = HealthManager(db)
    return manager.force_circuit_open(
        route_key=request.route_key,
        reason=request.reason
    )


@app.post("/api/v1/health/circuit-breakers/closed")
async def force_circuit_closed(
    request: CircuitBreakerAction,
    db: Session = Depends(get_db)
):
    manager = HealthManager(db)
    return manager.force_circuit_closed(
        route_key=request.route_key,
        reason=request.reason
    )


@app.get("/api/v1/health/summary")
async def get_health_summary(db: Session = Depends(get_db)):
    manager = HealthManager(db)
    return manager.get_health_summary()


@app.get("/api/v1/report/json")
async def export_json_report(
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    include_samples: bool = False,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    
    start_dt = None
    end_dt = None
    
    if start_time:
        try:
            start_dt = datetime.fromisoformat(start_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_time format. Use ISO format.")
    
    if end_time:
        try:
            end_dt = datetime.fromisoformat(end_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_time format. Use ISO format.")
    
    report = exporter.export_json_report(
        start_time=start_dt,
        end_time=end_dt,
        include_samples=include_samples
    )
    
    return JSONResponse(content=eval(report))


@app.get("/api/v1/report/markdown")
async def export_markdown_report(
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    
    start_dt = None
    end_dt = None
    
    if start_time:
        try:
            start_dt = datetime.fromisoformat(start_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_time format. Use ISO format.")
    
    if end_time:
        try:
            end_dt = datetime.fromisoformat(end_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_time format. Use ISO format.")
    
    report = exporter.export_markdown_report(
        start_time=start_dt,
        end_time=end_dt
    )
    
    return PlainTextResponse(content=report, media_type="text/markdown")


@app.get("/api/v1/report/bad-samples")
async def export_bad_samples_report(db: Session = Depends(get_db)):
    exporter = ReportExporter(db)
    report = exporter.export_bad_samples_report()
    return PlainTextResponse(content=report, media_type="text/markdown")


@app.post("/api/v1/admin/reset-rate-limiter")
async def reset_rate_limiter(
    route_key: Optional[str] = None,
    db: Session = Depends(get_db)
):
    engine = ProtectionEngine(db)
    engine.reset_rate_limiter(route_key)
    return {
        "message": "Rate limiter reset successfully",
        "route_key": route_key or "all"
    }


if __name__ == "__main__":
    import uvicorn
    from database import settings
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
