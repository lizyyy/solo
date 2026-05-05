from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime
import json

from app.database import get_db, init_db, Service, Route, HealthCheck, Issue
from app.schemas import (
    ServiceCreate, ServiceResponse, RouteResponse,
    HealthCheckResponse, IssueResponse, SampleRequestCreate,
    HealthCheckSummary, FixSuggestion, ExportResponse
)
from app.analyzer import RouteHealthAnalyzer
from app.exporter import JSONExporter, MarkdownExporter

app = FastAPI(
    title="FastAPI 路由体检服务",
    description="检测 FastAPI 路由冲突的服务，包括动态参数截获、重复路径、方法冲突和不可达路由",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/services", response_model=ServiceResponse, status_code=201)
def create_service(service_data: ServiceCreate, db: Session = Depends(get_db)):
    existing = db.query(Service).filter(Service.name == service_data.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"服务名称 '{service_data.name}' 已存在"
        )
    
    service = Service(name=service_data.name)
    db.add(service)
    db.flush()
    
    for route_data in service_data.routes:
        route = Route(
            service_id=service.id,
            path=route_data.path,
            method=route_data.method.upper(),
            order_index=route_data.order_index
        )
        db.add(route)
    
    db.commit()
    db.refresh(service)
    
    return _build_service_response(service)


@app.get("/services", response_model=List[ServiceResponse])
def list_services(db: Session = Depends(get_db)):
    services = db.query(Service).order_by(Service.created_at.desc()).all()
    return [_build_service_response(service) for service in services]


@app.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail=f"服务 ID {service_id} 不存在")
    return _build_service_response(service)


@app.delete("/services/{service_id}", status_code=204)
def delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail=f"服务 ID {service_id} 不存在")
    
    db.delete(service)
    db.commit()


@app.post("/services/{service_id}/health-check", response_model=HealthCheckResponse, status_code=201)
def run_health_check(
    service_id: int,
    sample_requests: Optional[SampleRequestCreate] = None,
    db: Session = Depends(get_db)
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail=f"服务 ID {service_id} 不存在")
    
    health_check = HealthCheck(
        service_id=service_id,
        status="in_progress"
    )
    db.add(health_check)
    db.flush()
    
    routes_data = [
        {
            "path": route.path,
            "method": route.method,
            "order_index": route.order_index
        }
        for route in service.routes
    ]
    
    analyzer = RouteHealthAnalyzer(routes_data)
    issues = analyzer.run_all_checks()
    
    for issue_data in issues:
        affected_routes_json = None
        if issue_data.get("affected_routes"):
            affected_routes_json = json.dumps(issue_data["affected_routes"], ensure_ascii=False)
        
        issue = Issue(
            health_check_id=health_check.id,
            issue_type=issue_data["issue_type"],
            severity=issue_data["severity"],
            path=issue_data["path"],
            method=issue_data.get("method"),
            affected_routes=affected_routes_json,
            description=issue_data.get("description"),
            suggestion=issue_data.get("suggestion")
        )
        db.add(issue)
    
    health_check.status = "completed"
    health_check.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(health_check)
    
    return _build_health_check_response(health_check)


@app.get("/services/{service_id}/health-checks", response_model=List[HealthCheckResponse])
def list_health_checks(
    service_id: int,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail=f"服务 ID {service_id} 不存在")
    
    health_checks = (
        db.query(HealthCheck)
        .filter(HealthCheck.service_id == service_id)
        .order_by(HealthCheck.created_at.desc())
        .limit(limit)
        .all()
    )
    
    return [_build_health_check_response(hc) for hc in health_checks]


@app.get("/health-checks/{health_check_id}", response_model=HealthCheckResponse)
def get_health_check(health_check_id: int, db: Session = Depends(get_db)):
    health_check = db.query(HealthCheck).filter(HealthCheck.id == health_check_id).first()
    if not health_check:
        raise HTTPException(status_code=404, detail=f"体检记录 ID {health_check_id} 不存在")
    
    return _build_health_check_response(health_check)


@app.get("/health-checks/{health_check_id}/summary", response_model=HealthCheckSummary)
def get_health_check_summary(health_check_id: int, db: Session = Depends(get_db)):
    health_check = db.query(HealthCheck).filter(HealthCheck.id == health_check_id).first()
    if not health_check:
        raise HTTPException(status_code=404, detail=f"体检记录 ID {health_check_id} 不存在")
    
    service = db.query(Service).filter(Service.id == health_check.service_id).first()
    total_routes = db.query(Route).filter(Route.service_id == service.id).count()
    
    issues = health_check.issues
    critical = sum(1 for i in issues if i.severity == "critical")
    high = sum(1 for i in issues if i.severity == "high")
    medium = sum(1 for i in issues if i.severity == "medium")
    low = sum(1 for i in issues if i.severity == "low")
    
    issues_by_type = {}
    for issue in issues:
        if issue.issue_type not in issues_by_type:
            issues_by_type[issue.issue_type] = 0
        issues_by_type[issue.issue_type] += 1
    
    return HealthCheckSummary(
        service_name=service.name,
        total_routes=total_routes,
        total_issues=len(issues),
        critical_issues=critical,
        high_issues=high,
        medium_issues=medium,
        low_issues=low,
        issues_by_type=issues_by_type
    )


@app.get("/health-checks/{health_check_id}/fix-suggestions", response_model=List[FixSuggestion])
def get_fix_suggestions(health_check_id: int, db: Session = Depends(get_db)):
    health_check = db.query(HealthCheck).filter(HealthCheck.id == health_check_id).first()
    if not health_check:
        raise HTTPException(status_code=404, detail=f"体检记录 ID {health_check_id} 不存在")
    
    service = db.query(Service).filter(Service.id == health_check.service_id).first()
    routes_data = [
        {
            "path": route.path,
            "method": route.method,
            "order_index": route.order_index
        }
        for route in service.routes
    ]
    
    issues_data = []
    for issue in health_check.issues:
        affected_routes = None
        if issue.affected_routes:
            affected_routes = json.loads(issue.affected_routes)
        
        issues_data.append({
            "issue_type": issue.issue_type,
            "severity": issue.severity,
            "path": issue.path,
            "method": issue.method,
            "affected_routes": affected_routes,
            "description": issue.description,
            "suggestion": issue.suggestion
        })
    
    analyzer = RouteHealthAnalyzer(routes_data)
    suggestions = analyzer.get_fix_order(issues_data)
    
    return [
        FixSuggestion(
            priority=s["priority"],
            issue_type=s["issue_type"],
            description=s["description"],
            affected_paths=s["affected_paths"],
            suggested_action=s["suggested_action"]
        )
        for s in suggestions
    ]


@app.get("/health-checks/{health_check_id}/export", response_model=ExportResponse)
def export_health_check(
    health_check_id: int,
    format: str = Query("json", regex="^(json|markdown)$"),
    db: Session = Depends(get_db)
):
    health_check = db.query(HealthCheck).filter(HealthCheck.id == health_check_id).first()
    if not health_check:
        raise HTTPException(status_code=404, detail=f"体检记录 ID {health_check_id} 不存在")
    
    service = db.query(Service).filter(Service.id == health_check.service_id).first()
    total_routes = db.query(Route).filter(Route.service_id == service.id).count()
    
    routes_data = [
        {
            "path": route.path,
            "method": route.method,
            "order_index": route.order_index
        }
        for route in service.routes
    ]
    
    issues_data = []
    for issue in health_check.issues:
        affected_routes = None
        if issue.affected_routes:
            affected_routes = json.loads(issue.affected_routes)
        
        issues_data.append({
            "issue_type": issue.issue_type,
            "severity": issue.severity,
            "path": issue.path,
            "method": issue.method,
            "affected_routes": affected_routes,
            "description": issue.description,
            "suggestion": issue.suggestion
        })
    
    analyzer = RouteHealthAnalyzer(routes_data)
    fix_suggestions = analyzer.get_fix_order(issues_data)
    
    if format == "json":
        content = JSONExporter.export_health_check(
            service_name=service.name,
            service_id=service.id,
            health_check_id=health_check.id,
            total_routes=total_routes,
            issues=issues_data,
            fix_suggestions=fix_suggestions
        )
    else:
        content = MarkdownExporter.export_health_check(
            service_name=service.name,
            service_id=service.id,
            health_check_id=health_check.id,
            total_routes=total_routes,
            issues=issues_data,
            fix_suggestions=fix_suggestions
        )
    
    return ExportResponse(format=format, content=content)


def _build_service_response(service: Service) -> ServiceResponse:
    routes = [
        RouteResponse(
            id=route.id,
            path=route.path,
            method=route.method,
            order_index=route.order_index
        )
        for route in sorted(service.routes, key=lambda r: r.order_index)
    ]
    
    return ServiceResponse(
        id=service.id,
        name=service.name,
        created_at=service.created_at,
        updated_at=service.updated_at,
        routes=routes
    )


def _build_health_check_response(health_check: HealthCheck) -> HealthCheckResponse:
    issues = []
    for issue in health_check.issues:
        affected_routes = None
        if issue.affected_routes:
            affected_routes = json.loads(issue.affected_routes)
        
        issues.append(IssueResponse(
            id=issue.id,
            issue_type=issue.issue_type,
            severity=issue.severity,
            path=issue.path,
            method=issue.method,
            affected_routes=affected_routes,
            description=issue.description,
            suggestion=issue.suggestion,
            created_at=issue.created_at
        ))
    
    return HealthCheckResponse(
        id=health_check.id,
        service_id=health_check.service_id,
        status=health_check.status,
        created_at=health_check.created_at,
        completed_at=health_check.completed_at,
        issues=issues
    )
