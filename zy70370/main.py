from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, date
from enum import Enum
import uuid
from collections import defaultdict

app = FastAPI(title="服务目录健康 API", version="1.0.0")

class ServiceStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    PENDING_DELETION = "pending_deletion"
    OFFLINE = "offline"

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Environment(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    TEST = "test"
    DEVELOPMENT = "development"

class Owner(BaseModel):
    name: str
    email: str
    is_active: bool = True
    department: Optional[str] = None

class Service(BaseModel):
    service_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    owner: Owner
    repository_url: Optional[str] = None
    environment: Environment
    status: ServiceStatus = ServiceStatus.ACTIVE
    dependencies: List[str] = Field(default_factory=list)
    dependents: List[str] = Field(default_factory=list)
    last_health_check: Optional[datetime] = None
    health_status: HealthStatus = HealthStatus.UNKNOWN
    consecutive_health_failures: int = 0
    max_allowed_failures: int = 3
    health_check_endpoint: Optional[str] = None
    deprecation_date: Optional[date] = None
    deletion_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Owner
    repository_url: Optional[str] = None
    environment: Environment
    status: ServiceStatus = ServiceStatus.ACTIVE
    dependencies: List[str] = Field(default_factory=list)
    health_check_endpoint: Optional[str] = None
    max_allowed_failures: int = 3
    deprecation_date: Optional[date] = None
    deletion_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('服务名称不能为空')
        return v.strip()

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[Owner] = None
    repository_url: Optional[str] = None
    environment: Optional[Environment] = None
    status: Optional[ServiceStatus] = None
    dependencies: Optional[List[str]] = None
    health_check_endpoint: Optional[str] = None
    max_allowed_failures: Optional[int] = None
    deprecation_date: Optional[date] = None
    deletion_date: Optional[date] = None
    tags: Optional[List[str]] = None

class HealthCheckReport(BaseModel):
    service_id: str
    status: HealthStatus
    checked_at: datetime = Field(default_factory=datetime.now)
    details: Optional[str] = None

class RiskTag(BaseModel):
    tag: str
    level: RiskLevel
    description: str
    affected_services: List[str]

class CompletenessReport(BaseModel):
    total_services: int
    complete_services: int
    completeness_score: float
    missing_owner: List[str]
    missing_repository: List[str]
    missing_health_check: List[str]
    details: Dict[str, Any]

class ServiceHealthResponse(BaseModel):
    service: Service
    risk_tags: List[RiskTag]
    missing_info: List[str]
    dependency_topology: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime

services_db: Dict[str, Service] = {}
service_name_index: Dict[str, str] = {}

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", timestamp=datetime.now())

@app.post("/services", response_model=Service)
async def create_service(service_create: ServiceCreate):
    if service_create.name in service_name_index:
        raise HTTPException(
            status_code=409,
            detail=f"服务名称 '{service_create.name}' 已存在"
        )
    
    service = Service(
        name=service_create.name,
        description=service_create.description,
        owner=service_create.owner,
        repository_url=service_create.repository_url,
        environment=service_create.environment,
        status=service_create.status,
        dependencies=[],
        health_check_endpoint=service_create.health_check_endpoint,
        max_allowed_failures=service_create.max_allowed_failures,
        deprecation_date=service_create.deprecation_date,
        deletion_date=service_create.deletion_date,
        tags=service_create.tags
    )
    
    services_db[service.service_id] = service
    service_name_index[service.name] = service.service_id
    
    if service_create.dependencies:
        for dep_name in service_create.dependencies:
            await add_dependency(service.service_id, dep_name)
    
    return service

@app.get("/services", response_model=List[Service])
async def list_services(
    status: Optional[ServiceStatus] = None,
    environment: Optional[Environment] = None
):
    result = list(services_db.values())
    if status:
        result = [s for s in result if s.status == status]
    if environment:
        result = [s for s in result if s.environment == environment]
    return result

@app.get("/services/{service_identifier}", response_model=Service)
async def get_service(service_identifier: str):
    if service_identifier in services_db:
        return services_db[service_identifier]
    if service_identifier in service_name_index:
        return services_db[service_name_index[service_identifier]]
    raise HTTPException(status_code=404, detail="服务不存在")

@app.put("/services/{service_identifier}", response_model=Service)
async def update_service(service_identifier: str, update: ServiceUpdate):
    service = await get_service(service_identifier)
    
    update_data = update.model_dump(exclude_unset=True)
    
    if 'name' in update_data:
        new_name = update_data['name']
        if new_name in service_name_index and service_name_index[new_name] != service.service_id:
            raise HTTPException(
                status_code=409,
                detail=f"服务名称 '{new_name}' 已被其他服务使用"
            )
        if service.name in service_name_index:
            del service_name_index[service.name]
        service_name_index[new_name] = service.service_id
    
    for key, value in update_data.items():
        setattr(service, key, value)
    
    service.updated_at = datetime.now()
    return service

@app.delete("/services/{service_identifier}")
async def delete_service(service_identifier: str):
    service = await get_service(service_identifier)
    
    if service.dependents:
        raise HTTPException(
            status_code=400,
            detail=f"服务仍被其他服务依赖: {service.dependents}"
        )
    
    for dep_name in service.dependencies:
        if dep_name in service_name_index:
            dep_id = service_name_index[dep_name]
            if dep_id in services_db:
                dep = services_db[dep_id]
                if service.name in dep.dependents:
                    dep.dependents.remove(service.name)
    
    del services_db[service.service_id]
    if service.name in service_name_index:
        del service_name_index[service.name]
    
    return {"message": "服务已删除", "service_id": service.service_id}

@app.post("/services/{service_identifier}/dependencies")
async def add_dependency(
    service_identifier: str,
    dependency_name: str
):
    service = await get_service(service_identifier)
    
    if dependency_name not in service_name_index:
        raise HTTPException(
            status_code=404,
            detail=f"依赖服务 '{dependency_name}' 不存在"
        )
    
    if dependency_name in service.dependencies:
        return {"message": "依赖关系已存在"}
    
    service.dependencies.append(dependency_name)
    
    dep_id = service_name_index[dependency_name]
    if dep_id in services_db:
        dep_service = services_db[dep_id]
        if service.name not in dep_service.dependents:
            dep_service.dependents.append(service.name)
    
    service.updated_at = datetime.now()
    return {"message": "依赖关系已添加", "dependencies": service.dependencies}

@app.delete("/services/{service_identifier}/dependencies/{dependency_name}")
async def remove_dependency(
    service_identifier: str,
    dependency_name: str
):
    service = await get_service(service_identifier)
    
    if dependency_name not in service.dependencies:
        raise HTTPException(
            status_code=404,
            detail=f"依赖关系不存在"
        )
    
    service.dependencies.remove(dependency_name)
    
    if dependency_name in service_name_index:
        dep_id = service_name_index[dependency_name]
        if dep_id in services_db:
            dep_service = services_db[dep_id]
            if service.name in dep_service.dependents:
                dep_service.dependents.remove(service.name)
    
    service.updated_at = datetime.now()
    return {"message": "依赖关系已移除", "dependencies": service.dependencies}

@app.post("/health-check", response_model=Service)
async def report_health(report: HealthCheckReport):
    if report.service_id not in services_db:
        raise HTTPException(status_code=404, detail="服务不存在")
    
    service = services_db[report.service_id]
    service.health_status = report.status
    service.last_health_check = report.checked_at
    
    if report.status == HealthStatus.UNHEALTHY:
        service.consecutive_health_failures += 1
    else:
        service.consecutive_health_failures = 0
    
    if service.consecutive_health_failures >= service.max_allowed_failures:
        service.status = ServiceStatus.DEPRECATED
    
    service.updated_at = datetime.now()
    return service

@app.get("/services/{service_identifier}/health", response_model=ServiceHealthResponse)
async def get_service_health(service_identifier: str):
    service = await get_service(service_identifier)
    risk_tags = _calculate_service_risks(service)
    missing_info = _get_missing_information(service)
    topology = _build_dependency_topology(service.name)
    
    return ServiceHealthResponse(
        service=service,
        risk_tags=risk_tags,
        missing_info=missing_info,
        dependency_topology=topology
    )

@app.get("/dashboard/completeness", response_model=CompletenessReport)
async def get_completeness_report():
    total = len(services_db)
    
    if total == 0:
        return CompletenessReport(
            total_services=0,
            complete_services=0,
            completeness_score=100.0,
            missing_owner=[],
            missing_repository=[],
            missing_health_check=[],
            details={}
        )
    
    missing_owner = []
    missing_repository = []
    missing_health_check = []
    complete_services = 0
    
    for service in services_db.values():
        is_complete = True
        
        if not service.owner or not service.owner.is_active:
            missing_owner.append(service.name)
            is_complete = False
        
        if not service.repository_url:
            missing_repository.append(service.name)
            is_complete = False
        
        if not service.health_check_endpoint:
            missing_health_check.append(service.name)
            is_complete = False
        
        if is_complete:
            complete_services += 1
    
    completeness_score = (complete_services / total) * 100
    
    return CompletenessReport(
        total_services=total,
        complete_services=complete_services,
        completeness_score=round(completeness_score, 2),
        missing_owner=missing_owner,
        missing_repository=missing_repository,
        missing_health_check=missing_health_check,
        details={
            "missing_owner_count": len(missing_owner),
            "missing_repository_count": len(missing_repository),
            "missing_health_check_count": len(missing_health_check),
            "incomplete_services": total - complete_services
        }
    )

@app.get("/dashboard/risks", response_model=List[RiskTag])
async def get_all_risks():
    all_risks = []
    risk_services: Dict[str, Set[str]] = defaultdict(set)
    
    for service in services_db.values():
        risks = _calculate_service_risks(service)
        for risk in risks:
            risk_services[risk.tag].add(service.name)
    
    risk_descriptions = {
        "owner_inactive": {
            "level": RiskLevel.HIGH,
            "description": "负责人已离职或不在职状态，需要重新分配负责人"
        },
        "missing_repository": {
            "level": RiskLevel.MEDIUM,
            "description": "缺少代码仓库地址，无法追踪代码变更"
        },
        "dependency_offline": {
            "level": RiskLevel.CRITICAL,
            "description": "依赖的服务已下线，可能导致服务不可用"
        },
        "dependency_deprecated": {
            "level": RiskLevel.HIGH,
            "description": "依赖的服务已弃用，需要尽快迁移"
        },
        "health_failing": {
            "level": RiskLevel.HIGH,
            "description": "健康检查连续失败，服务可能不可用"
        },
        "deprecated_with_callers": {
            "level": RiskLevel.CRITICAL,
            "description": "服务已标记弃用但仍有调用方，需要通知调用方迁移"
        },
        "pending_deletion_with_callers": {
            "level": RiskLevel.CRITICAL,
            "description": "服务申请下线但仍被调用，存在严重风险"
        },
        "no_health_check": {
            "level": RiskLevel.MEDIUM,
            "description": "缺少健康检查配置，无法监控服务状态"
        },
        "deletion_overdue": {
            "level": RiskLevel.HIGH,
            "description": "服务已超过计划下线日期但仍在运行"
        }
    }
    
    for tag, services_list in risk_services.items():
        if tag in risk_descriptions:
            all_risks.append(RiskTag(
                tag=tag,
                level=risk_descriptions[tag]["level"],
                description=risk_descriptions[tag]["description"],
                affected_services=list(services_list)
            ))
    
    return sorted(all_risks, key=lambda x: x.level.value)

@app.get("/dashboard/topology")
async def get_topology():
    nodes = []
    edges = []
    
    for service in services_db.values():
        nodes.append({
            "id": service.service_id,
            "name": service.name,
            "status": service.status.value,
            "health": service.health_status.value,
            "environment": service.environment.value
        })
        
        for dep_name in service.dependencies:
            if dep_name in service_name_index:
                dep_id = service_name_index[dep_name]
                edges.append({
                    "source": service.service_id,
                    "target": dep_id,
                    "source_name": service.name,
                    "target_name": dep_name
                })
    
    return {"nodes": nodes, "edges": edges}

def _calculate_service_risks(service: Service) -> List[RiskTag]:
    risks = []
    
    if service.owner and not service.owner.is_active:
        risks.append(RiskTag(
            tag="owner_inactive",
            level=RiskLevel.HIGH,
            description="负责人已离职或不在职状态",
            affected_services=[service.name]
        ))
    
    if not service.repository_url:
        risks.append(RiskTag(
            tag="missing_repository",
            level=RiskLevel.MEDIUM,
            description="缺少代码仓库地址",
            affected_services=[service.name]
        ))
    
    if not service.health_check_endpoint:
        risks.append(RiskTag(
            tag="no_health_check",
            level=RiskLevel.MEDIUM,
            description="缺少健康检查配置",
            affected_services=[service.name]
        ))
    
    for dep_name in service.dependencies:
        if dep_name in service_name_index:
            dep_id = service_name_index[dep_name]
            if dep_id in services_db:
                dep_service = services_db[dep_id]
                if dep_service.status == ServiceStatus.OFFLINE:
                    risks.append(RiskTag(
                        tag="dependency_offline",
                        level=RiskLevel.CRITICAL,
                        description=f"依赖服务 '{dep_name}' 已下线",
                        affected_services=[service.name]
                    ))
                elif dep_service.status == ServiceStatus.DEPRECATED:
                    risks.append(RiskTag(
                        tag="dependency_deprecated",
                        level=RiskLevel.HIGH,
                        description=f"依赖服务 '{dep_name}' 已弃用",
                        affected_services=[service.name]
                    ))
    
    if service.consecutive_health_failures > 0:
        risks.append(RiskTag(
            tag="health_failing",
            level=RiskLevel.HIGH,
            description=f"健康检查连续失败 {service.consecutive_health_failures} 次",
            affected_services=[service.name]
        ))
    
    if service.status == ServiceStatus.DEPRECATED and service.dependents:
        risks.append(RiskTag(
            tag="deprecated_with_callers",
            level=RiskLevel.CRITICAL,
            description=f"服务已弃用但仍被 {len(service.dependents)} 个服务调用",
            affected_services=[service.name]
        ))
    
    if service.status == ServiceStatus.PENDING_DELETION and service.dependents:
        risks.append(RiskTag(
            tag="pending_deletion_with_callers",
            level=RiskLevel.CRITICAL,
            description=f"服务申请下线但仍被 {len(service.dependents)} 个服务调用",
            affected_services=[service.name]
        ))
    
    if service.deletion_date and service.deletion_date < date.today():
        if service.status != ServiceStatus.OFFLINE:
            risks.append(RiskTag(
                tag="deletion_overdue",
                level=RiskLevel.HIGH,
                description="已超过计划下线日期",
                affected_services=[service.name]
            ))
    
    return risks

def _get_missing_information(service: Service) -> List[str]:
    missing = []
    
    if not service.owner or not service.owner.name:
        missing.append("缺少负责人信息")
    elif not service.owner.is_active:
        missing.append("负责人状态异常")
    
    if not service.repository_url:
        missing.append("缺少代码仓库地址")
    
    if not service.health_check_endpoint:
        missing.append("缺少健康检查端点")
    
    if service.status in [ServiceStatus.PENDING_DELETION, ServiceStatus.DEPRECATED]:
        if not service.deletion_date:
            missing.append("缺少下线计划日期")
    
    return missing

def _build_dependency_topology(service_name: str) -> Dict[str, Any]:
    if service_name not in service_name_index:
        return {"error": "服务不存在"}
    
    visited = set()
    levels = defaultdict(list)
    
    def traverse(name: str, level: int):
        if name in visited:
            return
        visited.add(name)
        levels[level].append(name)
        
        if name in service_name_index:
            service = services_db[service_name_index[name]]
            for dep_name in service.dependencies:
                traverse(dep_name, level + 1)
    
    traverse(service_name, 0)
    
    max_level = max(levels.keys()) if levels else 0
    return {
        "service": service_name,
        "levels": {str(k): v for k, v in levels.items()},
        "total_dependencies": len(visited) - 1,
        "max_depth": max_level
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
