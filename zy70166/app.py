import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

app = FastAPI(title="内部包版本废弃管理系统", description="追踪 SDK 版本废弃、调用方迁移状态、豁免和风险分析")

class PackageStatus(str, Enum):
    ACTIVE = "活跃"
    DEPRECATED = "即将废弃"
    SUNSET = "已停止支持"

class CallerStatus(str, Enum):
    NOT_STARTED = "未开始"
    IN_PROGRESS = "迁移中"
    COMPLETED = "已完成"
    EXEMPTED = "已豁免"
    BLOCKED = "受阻"

class ExemptionStatus(str, Enum):
    PENDING = "待审批"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    REVOKED = "已撤销"
    EXPIRED = "已过期"

@dataclass
class PackageVersion:
    package_name: str
    version: str
    status: PackageStatus = PackageStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    deprecated_at: Optional[datetime] = None
    sunset_at: Optional[datetime] = None
    description: str = ""

@dataclass
class Caller:
    service_name: str
    package_name: str
    version: str
    last_seen_at: datetime
    contact_person: str = ""
    department: str = ""
    status: CallerStatus = CallerStatus.NOT_STARTED
    migration_notes: str = ""

@dataclass
class DeprecationPlan:
    package_name: str
    version: str
    phase: str
    deadline: datetime
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class Exemption:
    exemption_id: str
    service_name: str
    package_name: str
    version: str
    reason: str
    requested_by: str
    requested_at: datetime
    expires_at: datetime
    status: ExemptionStatus = ExemptionStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    retry_count: int = 0
    last_retry_at: Optional[datetime] = None

@dataclass
class MigrationConfirmation:
    service_name: str
    package_name: str
    old_version: str
    new_version: str
    confirmed_by: str
    confirmed_at: datetime
    notes: str = ""
    is_revoked: bool = False
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None

@dataclass
class OperationLog:
    operation_id: str
    operation_type: str
    entity_type: str
    entity_id: str
    operator: str
    description: str
    status: str
    timestamp: datetime = field(default_factory=datetime.now)
    conflict_details: Optional[str] = None

packages: Dict[str, PackageVersion] = {}
callers: List[Caller] = []
plans: List[DeprecationPlan] = []
exemptions: List[Exemption] = []
confirmations: List[MigrationConfirmation] = []
operation_logs: List[OperationLog] = []

def log_operation(
    operation_type: str,
    entity_type: str,
    entity_id: str,
    operator: str,
    description: str,
    status: str = "成功",
    conflict_details: Optional[str] = None
):
    operation_logs.append(OperationLog(
        operation_id=str(uuid.uuid4()),
        operation_type=operation_type,
        entity_type=entity_type,
        entity_id=entity_id,
        operator=operator,
        description=description,
        status=status,
        conflict_details=conflict_details
    ))

def get_package_key(package_name: str, version: str) -> str:
    return f"{package_name}@{version}"

def find_package(package_name: str, version: str) -> Optional[PackageVersion]:
    return packages.get(get_package_key(package_name, version))

def find_callers(package_name: str, version: str) -> List[Caller]:
    return [c for c in callers if c.package_name == package_name and c.version == version]

def find_active_exemption(service_name: str, package_name: str, version: str) -> Optional[Exemption]:
    now = datetime.now()
    for e in exemptions:
        if (e.service_name == service_name and 
            e.package_name == package_name and 
            e.version == version and
            e.status == ExemptionStatus.APPROVED and
            e.expires_at > now):
            return e
    return None

class CreatePackageRequest(BaseModel):
    package_name: str = Field(..., description="包名称，如 'user-auth-sdk'")
    version: str = Field(..., description="版本号，如 '1.0.0'")
    description: str = Field(default="", description="版本说明")

class UpdatePackageStatusRequest(BaseModel):
    package_name: str
    version: str
    new_status: PackageStatus
    operator: str = Field(..., description="操作人姓名")

class RegisterCallerRequest(BaseModel):
    service_name: str = Field(..., description="调用方服务名")
    package_name: str
    version: str
    contact_person: str = Field(..., description="负责人")
    department: str = Field(..., description="所属部门")

class UpdateCallerStatusRequest(BaseModel):
    service_name: str
    package_name: str
    version: str
    new_status: CallerStatus
    notes: str = ""
    operator: str

class CreateDeprecationPlanRequest(BaseModel):
    package_name: str
    version: str
    phase: str = Field(..., description="废弃阶段，如 '告警期'、'限制期'、'停止期'")
    deadline_days: int = Field(..., ge=1, description="距离截止的天数")
    description: str = ""

class ApplyExemptionRequest(BaseModel):
    service_name: str
    package_name: str
    version: str
    reason: str = Field(..., description="申请豁免的原因")
    requested_by: str = Field(..., description="申请人")
    extension_days: int = Field(default=30, ge=1, description="申请延长的天数")

class ApproveExemptionRequest(BaseModel):
    exemption_id: str
    approved_by: str = Field(..., description="审批人")
    approve: bool = Field(..., description="是否通过")

class RetryExemptionRequest(BaseModel):
    exemption_id: str
    reason: str
    operator: str

class ConfirmMigrationRequest(BaseModel):
    service_name: str
    package_name: str
    old_version: str
    new_version: str
    confirmed_by: str = Field(..., description="确认人")
    notes: str = ""

class RevokeMigrationRequest(BaseModel):
    service_name: str
    package_name: str
    old_version: str
    revoked_by: str
    reason: str

class ExportRiskRequest(BaseModel):
    package_name: Optional[str] = None
    version: Optional[str] = None

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "业务状态": "操作失败",
            "消息": str(exc.detail),
            "建议": "请检查输入参数或稍后重试"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    log_operation(
        operation_type="系统错误",
        entity_type="未知",
        entity_id="N/A",
        operator="系统",
        description=f"请求路径: {request.url.path}, 错误: {str(exc)}",
        status="失败"
    )
    return JSONResponse(
        status_code=500,
        content={
            "业务状态": "系统异常",
            "消息": f"操作过程中发生问题: {str(exc)}",
            "建议": "请稍后重试或联系管理员"
        }
    )

@app.post("/api/packages/register", summary="登记包版本")
async def register_package(req: CreatePackageRequest):
    key = get_package_key(req.package_name, req.version)
    if key in packages:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "登记冲突",
                "消息": f"包 {req.package_name} 版本 {req.version} 已存在，不可重复登记",
                "建议": "如需更新状态，请使用状态更新接口"
            }
        )
    
    pkg = PackageVersion(
        package_name=req.package_name,
        version=req.version,
        description=req.description
    )
    packages[key] = pkg
    
    log_operation(
        operation_type="登记包版本",
        entity_type="包版本",
        entity_id=key,
        operator="系统",
        description=f"登记 {req.package_name} {req.version}"
    )
    
    return {
        "业务状态": "登记成功",
        "消息": f"包 {req.package_name} 版本 {req.version} 已纳入管理",
        "当前状态": pkg.status.value,
        "登记时间": pkg.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }

@app.post("/api/packages/status", summary="更新包废弃状态")
async def update_package_status(req: UpdatePackageStatusRequest):
    pkg = find_package(req.package_name, req.version)
    if not pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "包不存在",
                "消息": f"未找到包 {req.package_name} 版本 {req.version}",
                "建议": "请先登记该版本"
            }
        )
    
    old_status = pkg.status.value
    pkg.status = req.new_status
    
    if req.new_status == PackageStatus.DEPRECATED:
        pkg.deprecated_at = datetime.now()
    elif req.new_status == PackageStatus.SUNSET:
        pkg.sunset_at = datetime.now()
    
    log_operation(
        operation_type="更新包状态",
        entity_type="包版本",
        entity_id=get_package_key(req.package_name, req.version),
        operator=req.operator,
        description=f"状态从 {old_status} 变更为 {req.new_status.value}"
    )
    
    return {
        "业务状态": "状态已更新",
        "消息": f"{req.package_name} {req.version} 状态已调整",
        "原状态": old_status,
        "新状态": req.new_status.value,
        "受影响调用方数量": len(find_callers(req.package_name, req.version))
    }

@app.get("/api/packages/list", summary="查询所有包版本")
async def list_packages():
    result = []
    for pkg in packages.values():
        caller_count = len(find_callers(pkg.package_name, pkg.version))
        result.append({
            "包名": pkg.package_name,
            "版本": pkg.version,
            "状态": pkg.status.value,
            "描述": pkg.description,
            "调用方数量": caller_count,
            "登记时间": pkg.created_at.strftime("%Y-%m-%d %H:%M:%S") if pkg.created_at else None
        })
    
    return {
        "业务状态": "查询成功",
        "包版本总数": len(result),
        "列表": result
    }

@app.post("/api/callers/register", summary="登记调用方")
async def register_caller(req: RegisterCallerRequest):
    pkg = find_package(req.package_name, req.version)
    if not pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "包不存在",
                "消息": f"包 {req.package_name} 版本 {req.version} 未登记",
                "建议": "请先登记包版本，或检查版本号是否正确"
            }
        )
    
    existing = [c for c in callers 
                if c.service_name == req.service_name 
                and c.package_name == req.package_name
                and c.version == req.version]
    
    if existing:
        caller = existing[0]
        caller.last_seen_at = datetime.now()
        caller.contact_person = req.contact_person
        caller.department = req.department
        
        log_operation(
            operation_type="更新调用方",
            entity_type="调用方",
            entity_id=f"{req.service_name}@{req.package_name}@{req.version}",
            operator="系统",
            description=f"更新调用方信息",
            status="已更新"
        )
        
        return {
            "业务状态": "信息已更新",
            "消息": f"调用方 {req.service_name} 的使用记录已刷新",
            "使用版本": f"{req.package_name} {req.version}",
            "当前迁移状态": caller.status.value
        }
    
    caller = Caller(
        service_name=req.service_name,
        package_name=req.package_name,
        version=req.version,
        last_seen_at=datetime.now(),
        contact_person=req.contact_person,
        department=req.department
    )
    callers.append(caller)
    
    log_operation(
        operation_type="新增调用方",
        entity_type="调用方",
        entity_id=f"{req.service_name}@{req.package_name}@{req.version}",
        operator="系统",
        description=f"新发现调用方使用 {req.package_name} {req.version}"
    )
    
    return {
        "业务状态": "登记成功",
        "消息": f"调用方 {req.service_name} 已被记录为 {req.package_name} {req.version} 的使用者",
        "负责人": req.contact_person,
        "部门": req.department,
        "迁移状态": "未开始"
    }

@app.get("/api/callers/scan", summary="扫描调用方")
async def scan_callers(package_name: Optional[str] = None, version: Optional[str] = None):
    filtered = callers
    if package_name:
        filtered = [c for c in filtered if c.package_name == package_name]
    if version:
        filtered = [c for c in filtered if c.version == version]
    
    status_count = defaultdict(int)
    for c in filtered:
        status_count[c.status.value] += 1
    
    result = []
    for c in filtered:
        active_exemption = find_active_exemption(c.service_name, c.package_name, c.version)
        result.append({
            "服务名": c.service_name,
            "使用包": c.package_name,
            "使用版本": c.version,
            "负责人": c.contact_person,
            "部门": c.department,
            "迁移状态": c.status.value,
            "是否有有效豁免": "是" if active_exemption else "否",
            "最后检测时间": c.last_seen_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    return {
        "业务状态": "扫描完成",
        "总调用方数量": len(filtered),
        "状态分布": dict(status_count),
        "调用方列表": result
    }

@app.post("/api/callers/status", summary="更新调用方迁移状态")
async def update_caller_status(req: UpdateCallerStatusRequest):
    targets = [c for c in callers 
               if c.service_name == req.service_name 
               and c.package_name == req.package_name
               and c.version == req.version]
    
    if not targets:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "调用方不存在",
                "消息": f"未找到调用方 {req.service_name} 使用 {req.package_name} {req.version}",
                "建议": "请先登记该调用方"
            }
        )
    
    caller = targets[0]
    old_status = caller.status.value
    
    if req.new_status == CallerStatus.COMPLETED:
        active_exemption = find_active_exemption(req.service_name, req.package_name, req.version)
        if active_exemption:
            raise HTTPException(
                status_code=409,
                detail={
                    "业务状态": "状态冲突",
                    "消息": "该调用方存在有效豁免，不能直接标记为已完成",
                    "建议": "请先撤销豁免，或确认迁移后豁免会自动失效"
                }
            )
    
    caller.status = req.new_status
    caller.migration_notes = req.notes
    
    log_operation(
        operation_type="更新迁移状态",
        entity_type="调用方",
        entity_id=f"{req.service_name}@{req.package_name}@{req.version}",
        operator=req.operator,
        description=f"迁移状态从 {old_status} 变更为 {req.new_status.value}"
    )
    
    return {
        "业务状态": "状态已更新",
        "消息": f"调用方 {req.service_name} 的迁移状态已更新",
        "原状态": old_status,
        "新状态": req.new_status.value,
        "备注": req.notes
    }

@app.post("/api/plans/create", summary="创建废弃计划")
async def create_deprecation_plan(req: CreateDeprecationPlanRequest):
    pkg = find_package(req.package_name, req.version)
    if not pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "包不存在",
                "消息": f"包 {req.package_name} 版本 {req.version} 未登记",
                "建议": "请先登记包版本"
            }
        )
    
    existing_plans = [p for p in plans 
                      if p.package_name == req.package_name 
                      and p.version == req.version
                      and p.phase == req.phase]
    
    if existing_plans:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "计划冲突",
                "消息": f"{req.package_name} {req.version} 已存在「{req.phase}」阶段计划",
                "建议": "如需修改截止时间，请先撤销原有计划"
            }
        )
    
    deadline = datetime.now() + timedelta(days=req.deadline_days)
    plan = DeprecationPlan(
        package_name=req.package_name,
        version=req.version,
        phase=req.phase,
        deadline=deadline,
        description=req.description
    )
    plans.append(plan)
    
    affected_callers = len(find_callers(req.package_name, req.version))
    
    log_operation(
        operation_type="创建废弃计划",
        entity_type="废弃计划",
        entity_id=f"{req.package_name}@{req.version}@{req.phase}",
        operator="系统",
        description=f"为 {req.package_name} {req.version} 创建 {req.phase} 计划"
    )
    
    return {
        "业务状态": "计划已创建",
        "消息": f"{req.package_name} {req.version} 的「{req.phase}」计划已生效",
        "截止时间": deadline.strftime("%Y-%m-%d %H:%M:%S"),
        "剩余天数": req.deadline_days,
        "受影响调用方数量": affected_callers,
        "阶段说明": req.description
    }

@app.get("/api/plans/list", summary="查询废弃计划")
async def list_plans(package_name: Optional[str] = None, version: Optional[str] = None):
    filtered = plans
    if package_name:
        filtered = [p for p in filtered if p.package_name == package_name]
    if version:
        filtered = [p for p in filtered if p.version == version]
    
    now = datetime.now()
    result = []
    for p in filtered:
        remaining = (p.deadline - now).days
        urgency = "正常" if remaining > 14 else ("紧急" if remaining > 0 else "已逾期")
        result.append({
            "包名": p.package_name,
            "版本": p.version,
            "阶段": p.phase,
            "截止时间": p.deadline.strftime("%Y-%m-%d %H:%M:%S"),
            "剩余天数": remaining,
            "紧迫程度": urgency,
            "说明": p.description
        })
    
    return {
        "业务状态": "查询成功",
        "计划总数": len(result),
        "计划列表": result
    }

@app.post("/api/exemptions/apply", summary="申请豁免")
async def apply_exemption(req: ApplyExemptionRequest):
    pkg = find_package(req.package_name, req.version)
    if not pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "包不存在",
                "消息": f"包 {req.package_name} 版本 {req.version} 未登记",
                "建议": "请检查包名和版本号"
            }
        )
    
    caller_exists = any(
        c.service_name == req.service_name 
        and c.package_name == req.package_name 
        and c.version == req.version 
        for c in callers
    )
    if not caller_exists:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "调用方未登记",
                "消息": f"调用方 {req.service_name} 未被记录为使用者",
                "建议": "请先完成调用方登记"
            }
        )
    
    active = find_active_exemption(req.service_name, req.package_name, req.version)
    if active:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "豁免冲突",
                "消息": f"该调用方已存在有效豁免，到期时间 {active.expires_at.strftime('%Y-%m-%d %H:%M:%S')}",
                "建议": "如需延长，请先撤销现有豁免后重新申请，或联系审批人调整"
            }
        )
    
    pending = [e for e in exemptions 
               if e.service_name == req.service_name 
               and e.package_name == req.package_name
               and e.version == req.version
               and e.status == ExemptionStatus.PENDING]
    if pending:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "申请冲突",
                "消息": "已有待审批的豁免申请",
                "建议": "请等待审批结果，或撤销未审批申请后重试"
            }
        )
    
    exemption_id = str(uuid.uuid4())[:8]
    expires_at = datetime.now() + timedelta(days=req.extension_days)
    
    exemption = Exemption(
        exemption_id=exemption_id,
        service_name=req.service_name,
        package_name=req.package_name,
        version=req.version,
        reason=req.reason,
        requested_by=req.requested_by,
        requested_at=datetime.now(),
        expires_at=expires_at
    )
    exemptions.append(exemption)
    
    log_operation(
        operation_type="申请豁免",
        entity_type="豁免申请",
        entity_id=exemption_id,
        operator=req.requested_by,
        description=f"申请 {req.extension_days} 天豁免，原因: {req.reason}"
    )
    
    return {
        "业务状态": "申请已提交",
        "消息": f"豁免申请已提交，等待审批",
        "申请编号": exemption_id,
        "申请方": req.service_name,
        "申请人": req.requested_by,
        "申请理由": req.reason,
        "申请延长期限": f"{req.extension_days} 天",
        "如获通过到期时间": expires_at.strftime("%Y-%m-%d %H:%M:%S")
    }

@app.post("/api/exemptions/approve", summary="审批豁免")
async def approve_exemption(req: ApproveExemptionRequest):
    target = [e for e in exemptions if e.exemption_id == req.exemption_id]
    if not target:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "申请不存在",
                "消息": f"未找到编号为 {req.exemption_id} 的豁免申请",
                "建议": "请检查申请编号"
            }
        )
    
    exemption = target[0]
    
    if exemption.status != ExemptionStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "审批冲突",
                "消息": f"该申请当前状态为「{exemption.status.value}」，不允许再次审批",
                "建议": "只有待审批的申请可以处理"
            }
        )
    
    if req.approve:
        exemption.status = ExemptionStatus.APPROVED
        exemption.approved_by = req.approved_by
        exemption.approved_at = datetime.now()
        
        caller_targets = [c for c in callers 
                          if c.service_name == exemption.service_name 
                          and c.package_name == exemption.package_name
                          and c.version == exemption.version]
        if caller_targets:
            caller_targets[0].status = CallerStatus.EXEMPTED
        
        log_operation(
            operation_type="审批通过",
            entity_type="豁免申请",
            entity_id=req.exemption_id,
            operator=req.approved_by,
            description="豁免申请已通过"
        )
        
        return {
            "业务状态": "审批通过",
            "消息": f"豁免申请已通过",
            "申请编号": req.exemption_id,
            "审批人": req.approved_by,
            "生效时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "到期时间": exemption.expires_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    else:
        exemption.status = ExemptionStatus.REJECTED
        exemption.approved_by = req.approved_by
        exemption.approved_at = datetime.now()
        
        log_operation(
            operation_type="审批驳回",
            entity_type="豁免申请",
            entity_id=req.exemption_id,
            operator=req.approved_by,
            description="豁免申请被驳回"
        )
        
        return {
            "业务状态": "审批驳回",
            "消息": f"豁免申请已被驳回",
            "申请编号": req.exemption_id,
            "审批人": req.approved_by,
            "建议": "请重新评估是否确实需要豁免，或联系审批人沟通"
        }

@app.post("/api/exemptions/revoke", summary="撤销豁免")
async def revoke_exemption(exemption_id: str, revoked_by: str):
    target = [e for e in exemptions if e.exemption_id == exemption_id]
    if not target:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "申请不存在",
                "消息": f"未找到编号为 {exemption_id} 的豁免申请",
                "建议": "请检查申请编号"
            }
        )
    
    exemption = target[0]
    
    if exemption.status == ExemptionStatus.REVOKED:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "撤销冲突",
                "消息": "该豁免已被撤销，无需重复操作",
                "建议": "无需处理"
            }
        )
    
    if exemption.status not in [ExemptionStatus.PENDING, ExemptionStatus.APPROVED]:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "状态异常",
                "消息": f"当前状态为「{exemption.status.value}」，无法撤销",
                "建议": "仅待审批和已通过的豁免可以撤销"
            }
        )
    
    old_status = exemption.status.value
    exemption.status = ExemptionStatus.REVOKED
    
    caller_targets = [c for c in callers 
                      if c.service_name == exemption.service_name 
                      and c.package_name == exemption.package_name
                      and c.version == exemption.version]
    if caller_targets and old_status == "已通过":
        caller_targets[0].status = CallerStatus.NOT_STARTED
    
    log_operation(
        operation_type="撤销豁免",
        entity_type="豁免申请",
        entity_id=exemption_id,
        operator=revoked_by,
        description=f"撤销状态为 {old_status} 的豁免"
    )
    
    return {
        "业务状态": "撤销成功",
        "消息": f"豁免已撤销",
        "申请编号": exemption_id,
        "撤销人": revoked_by,
        "撤销时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "原状态": old_status,
        "后续影响": "调用方状态已恢复，需要重新安排迁移"
    }

@app.post("/api/exemptions/retry", summary="超时后重试豁免")
async def retry_exemption(req: RetryExemptionRequest):
    target = [e for e in exemptions if e.exemption_id == req.exemption_id]
    if not target:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "申请不存在",
                "消息": f"未找到编号为 {req.exemption_id} 的豁免申请",
                "建议": "请检查申请编号"
            }
        )
    
    exemption = target[0]
    
    if exemption.status != ExemptionStatus.EXPIRED:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "重试条件不满足",
                "消息": f"当前状态为「{exemption.status.value}」，仅已过期的豁免可以重试",
                "建议": "如需调整，请使用其他操作"
            }
        )
    
    max_retries = 3
    if exemption.retry_count >= max_retries:
        raise HTTPException(
            status_code=429,
            detail={
                "业务状态": "重试次数超限",
                "消息": f"该豁免已重试 {exemption.retry_count} 次，达到上限 {max_retries} 次",
                "建议": "请直接联系审批人沟通特殊情况"
            }
        )
    
    exemption.retry_count += 1
    exemption.status = ExemptionStatus.PENDING
    exemption.reason = req.reason
    exemption.last_retry_at = datetime.now()
    
    log_operation(
        operation_type="重试豁免",
        entity_type="豁免申请",
        entity_id=req.exemption_id,
        operator=req.operator,
        description=f"第 {exemption.retry_count} 次重试豁免申请"
    )
    
    return {
        "业务状态": "重试已提交",
        "消息": f"豁免申请已重新进入待审批状态",
        "申请编号": req.exemption_id,
        "这是第几次重试": exemption.retry_count,
        "剩余重试次数": max_retries - exemption.retry_count,
        "新的申请理由": req.reason
    }

@app.get("/api/exemptions/list", summary="查询豁免申请")
async def list_exemptions(service_name: Optional[str] = None, status: Optional[str] = None):
    filtered = exemptions
    if service_name:
        filtered = [e for e in filtered if e.service_name == service_name]
    if status:
        status_map = {
            "待审批": ExemptionStatus.PENDING,
            "已通过": ExemptionStatus.APPROVED,
            "已驳回": ExemptionStatus.REJECTED,
            "已撤销": ExemptionStatus.REVOKED,
            "已过期": ExemptionStatus.EXPIRED
        }
        target_status = status_map.get(status)
        if target_status:
            filtered = [e for e in filtered if e.status == target_status]
    
    now = datetime.now()
    for e in filtered:
        if e.status == ExemptionStatus.APPROVED and e.expires_at <= now:
            e.status = ExemptionStatus.EXPIRED
    
    result = []
    for e in filtered:
        remaining = (e.expires_at - now).days if e.status == ExemptionStatus.APPROVED else 0
        result.append({
            "申请编号": e.exemption_id,
            "申请方": e.service_name,
            "目标包": f"{e.package_name} {e.version}",
            "状态": e.status.value,
            "申请人": e.requested_by,
            "申请理由": e.reason,
            "到期时间": e.expires_at.strftime("%Y-%m-%d %H:%M:%S"),
            "剩余有效天数": remaining if e.status == ExemptionStatus.APPROVED else None,
            "重试次数": e.retry_count
        })
    
    return {
        "业务状态": "查询成功",
        "申请总数": len(result),
        "列表": result
    }

@app.post("/api/migrations/confirm", summary="确认迁移完成")
async def confirm_migration(req: ConfirmMigrationRequest):
    old_pkg = find_package(req.package_name, req.old_version)
    if not old_pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "旧版本不存在",
                "消息": f"包 {req.package_name} 版本 {req.old_version} 未登记",
                "建议": "请检查旧版本号"
            }
        )
    
    new_pkg = find_package(req.package_name, req.new_version)
    if not new_pkg:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "新版本不存在",
                "消息": f"包 {req.package_name} 版本 {req.new_version} 未登记",
                "建议": "请先登记新版本，或确认新版本号正确"
            }
        )
    
    old_caller = [c for c in callers 
                  if c.service_name == req.service_name 
                  and c.package_name == req.package_name
                  and c.version == req.old_version]
    
    if not old_caller:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "调用记录不存在",
                "消息": f"未找到 {req.service_name} 使用 {req.package_name} {req.old_version} 的记录",
                "建议": "请先登记调用方"
            }
        )
    
    active_exemption = find_active_exemption(req.service_name, req.package_name, req.old_version)
    if active_exemption:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "存在冲突",
                "消息": f"该调用方存在有效豁免（编号 {active_exemption.exemption_id}）",
                "建议": "如需确认迁移，请先撤销豁免"
            }
        )
    
    existing = [c for c in confirmations 
                if c.service_name == req.service_name 
                and c.package_name == req.package_name
                and c.old_version == req.old_version
                and not c.is_revoked]
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "业务状态": "确认冲突",
                "消息": "该迁移已确认过，无需重复操作",
                "建议": "如需撤销，请使用撤销接口"
            }
        )
    
    old_caller[0].status = CallerStatus.COMPLETED
    
    new_caller_exists = [c for c in callers 
                         if c.service_name == req.service_name 
                         and c.package_name == req.package_name
                         and c.version == req.new_version]
    if not new_caller_exists:
        callers.append(Caller(
            service_name=req.service_name,
            package_name=req.package_name,
            version=req.new_version,
            last_seen_at=datetime.now(),
            contact_person=old_caller[0].contact_person,
            department=old_caller[0].department,
            status=CallerStatus.COMPLETED
        ))
    else:
        new_caller_exists[0].last_seen_at = datetime.now()
        new_caller_exists[0].status = CallerStatus.COMPLETED
    
    confirmation = MigrationConfirmation(
        service_name=req.service_name,
        package_name=req.package_name,
        old_version=req.old_version,
        new_version=req.new_version,
        confirmed_by=req.confirmed_by,
        confirmed_at=datetime.now(),
        notes=req.notes
    )
    confirmations.append(confirmation)
    
    log_operation(
        operation_type="确认迁移",
        entity_type="迁移确认",
        entity_id=f"{req.service_name}@{req.package_name}",
        operator=req.confirmed_by,
        description=f"从 {req.old_version} 迁移至 {req.new_version}"
    )
    
    return {
        "业务状态": "迁移已确认",
        "消息": f"{req.service_name} 的迁移已登记完成",
        "从版本": req.old_version,
        "迁移至版本": req.new_version,
        "确认人": req.confirmed_by,
        "确认时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "备注": req.notes
    }

@app.post("/api/migrations/revoke", summary="撤销迁移确认")
async def revoke_migration(req: RevokeMigrationRequest):
    target = [c for c in confirmations 
              if c.service_name == req.service_name 
              and c.package_name == req.package_name
              and c.old_version == req.old_version
              and not c.is_revoked]
    
    if not target:
        raise HTTPException(
            status_code=404,
            detail={
                "业务状态": "确认记录不存在",
                "消息": f"未找到可撤销的迁移确认记录",
                "建议": "请检查服务名和旧版本号"
            }
        )
    
    confirmation = target[0]
    confirmation.is_revoked = True
    confirmation.revoked_at = datetime.now()
    confirmation.revoked_by = req.revoked_by
    
    old_caller = [c for c in callers 
                  if c.service_name == req.service_name 
                  and c.package_name == req.package_name
                  and c.version == req.old_version]
    if old_caller:
        old_caller[0].status = CallerStatus.NOT_STARTED
    
    new_caller = [c for c in callers 
                  if c.service_name == req.service_name 
                  and c.package_name == req.package_name
                  and c.version == confirmation.new_version]
    if new_caller:
        new_caller[0].status = CallerStatus.NOT_STARTED
    
    log_operation(
        operation_type="撤销迁移确认",
        entity_type="迁移确认",
        entity_id=f"{req.service_name}@{req.package_name}",
        operator=req.revoked_by,
        description=f"撤销从 {req.old_version} 开始的迁移确认",
        status="已撤销"
    )
    
    return {
        "业务状态": "撤销成功",
        "消息": f"迁移确认已撤销",
        "服务名": req.service_name,
        "原迁移版本": f"{req.old_version} → {confirmation.new_version}",
        "撤销人": req.revoked_by,
        "撤销时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "撤销原因": req.reason,
        "后续状态": "调用方状态已恢复为未开始"
    }

@app.get("/api/migrations/list", summary="查询迁移记录")
async def list_migrations(service_name: Optional[str] = None):
    filtered = confirmations
    if service_name:
        filtered = [c for c in filtered if c.service_name == service_name]
    
    result = []
    for c in filtered:
        result.append({
            "服务名": c.service_name,
            "包名": c.package_name,
            "从版本": c.old_version,
            "迁移至版本": c.new_version,
            "确认人": c.confirmed_by,
            "确认时间": c.confirmed_at.strftime("%Y-%m-%d %H:%M:%S"),
            "是否已撤销": "是" if c.is_revoked else "否",
            "撤销时间": c.revoked_at.strftime("%Y-%m-%d %H:%M:%S") if c.revoked_at else None
        })
    
    return {
        "业务状态": "查询成功",
        "记录总数": len(result),
        "列表": result
    }

@app.post("/api/risks/export", summary="导出风险分析")
async def export_risks(req: ExportRiskRequest):
    target_packages = packages.values()
    if req.package_name:
        target_packages = [p for p in target_packages if p.package_name == req.package_name]
    
    high_risk_packages = []
    medium_risk_packages = []
    low_risk_packages = []
    
    for pkg in target_packages:
        if req.version and pkg.version != req.version:
            continue
        
        pkg_callers = find_callers(pkg.package_name, pkg.version)
        uncompleted = [c for c in pkg_callers if c.status not in [CallerStatus.COMPLETED, CallerStatus.EXEMPTED]]
        exempted = [c for c in pkg_callers if c.status == CallerStatus.EXEMPTED]
        completed = [c for c in pkg_callers if c.status == CallerStatus.COMPLETED]
        
        related_plans = [p for p in plans if p.package_name == pkg.package_name and p.version == pkg.version]
        urgent_plan = None
        now = datetime.now()
        for p in related_plans:
            remaining = (p.deadline - now).days
            if remaining <= 7:
                urgent_plan = p
                break
        
        risk_level = "低"
        reason = "该版本当前状态正常"
        
        if pkg.status in [PackageStatus.DEPRECATED, PackageStatus.SUNSET]:
            if urgent_plan:
                risk_level = "高"
                reason = f"「{urgent_plan.phase}」阶段将在 {urgent_plan.deadline.strftime('%Y-%m-%d')} 到期，仅剩 {(urgent_plan.deadline - now).days} 天"
            elif uncompleted:
                risk_level = "中"
                reason = f"有 {len(uncompleted)} 个调用方尚未完成迁移"
        
        caller_detail = []
        for c in pkg_callers:
            active_exemption = find_active_exemption(c.service_name, c.package_name, c.version)
            caller_detail.append({
                "服务名": c.service_name,
                "负责人": c.contact_person,
                "部门": c.department,
                "迁移状态": c.status.value,
                "是否有豁免": "是" if active_exemption else "否",
                "豁免到期时间": active_exemption.expires_at.strftime("%Y-%m-%d") if active_exemption else None
            })
        
        pkg_info = {
            "包名": pkg.package_name,
            "版本": pkg.version,
            "包状态": pkg.status.value,
            "风险等级": risk_level,
            "风险说明": reason,
            "调用方统计": {
                "总数": len(pkg_callers),
                "已完成迁移": len(completed),
                "已豁免": len(exempted),
                "待迁移": len(uncompleted)
            },
            "调用方明细": caller_detail,
            "相关废弃计划": [
                {
                    "阶段": p.phase,
                    "截止时间": p.deadline.strftime("%Y-%m-%d"),
                    "剩余天数": (p.deadline - now).days
                } for p in related_plans
            ]
        }
        
        if risk_level == "高":
            high_risk_packages.append(pkg_info)
        elif risk_level == "中":
            medium_risk_packages.append(pkg_info)
        else:
            low_risk_packages.append(pkg_info)
    
    total_high = len(high_risk_packages)
    total_medium = len(medium_risk_packages)
    total_low = len(low_risk_packages)
    
    overall = "整体可控"
    if total_high > 0:
        overall = "需要关注"
        if total_high > 3:
            overall = "形势紧急"
    
    return {
        "业务状态": "导出完成",
        "整体判断": overall,
        "风险统计": {
            "高风险包数量": total_high,
            "中风险包数量": total_medium,
            "低风险包数量": total_low
        },
        "高风险包": high_risk_packages,
        "中风险包": medium_risk_packages,
        "低风险包": low_risk_packages,
        "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@app.get("/api/logs", summary="查看操作日志")
async def view_logs(limit: int = 50):
    recent = operation_logs[-limit:]
    result = []
    for log in recent:
        result.append({
            "操作时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "操作类型": log.operation_type,
            "操作人": log.operator,
            "对象类型": log.entity_type,
            "对象标识": log.entity_id,
            "结果": log.status,
            "描述": log.description,
            "冲突/异常详情": log.conflict_details
        })
    
    return {
        "业务状态": "查询成功",
        "日志数量": len(result),
        "日志列表": result
    }

@app.get("/health", summary="健康检查")
async def health():
    return {
        "业务状态": "运行正常",
        "系统名称": "内部包版本废弃管理系统",
        "当前时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def seed_demo_data():
    packages["user-auth-sdk@1.0.0"] = PackageVersion(
        package_name="user-auth-sdk",
        version="1.0.0",
        status=PackageStatus.DEPRECATED,
        created_at=datetime.now() - timedelta(days=180),
        deprecated_at=datetime.now() - timedelta(days=30),
        description="用户认证 SDK 旧版"
    )
    packages["user-auth-sdk@2.0.0"] = PackageVersion(
        package_name="user-auth-sdk",
        version="2.0.0",
        status=PackageStatus.ACTIVE,
        created_at=datetime.now() - timedelta(days=60),
        description="用户认证 SDK 新版"
    )
    packages["payment-gateway@0.9.0"] = PackageVersion(
        package_name="payment-gateway",
        version="0.9.0",
        status=PackageStatus.SUNSET,
        created_at=datetime.now() - timedelta(days=365),
        deprecated_at=datetime.now() - timedelta(days=90),
        sunset_at=datetime.now() - timedelta(days=7),
        description="支付网关旧版，已停止支持"
    )
    
    callers.append(Caller(
        service_name="用户中心",
        package_name="user-auth-sdk",
        version="1.0.0",
        last_seen_at=datetime.now(),
        contact_person="张三",
        department="用户事业部",
        status=CallerStatus.IN_PROGRESS
    ))
    callers.append(Caller(
        service_name="订单系统",
        package_name="user-auth-sdk",
        version="1.0.0",
        last_seen_at=datetime.now() - timedelta(days=2),
        contact_person="李四",
        department="交易事业部",
        status=CallerStatus.NOT_STARTED
    ))
    callers.append(Caller(
        service_name="商品详情",
        package_name="payment-gateway",
        version="0.9.0",
        last_seen_at=datetime.now() - timedelta(days=5),
        contact_person="王五",
        department="商品事业部",
        status=CallerStatus.NOT_STARTED
    ))
    
    plans.append(DeprecationPlan(
        package_name="user-auth-sdk",
        version="1.0.0",
        phase="限制期",
        deadline=datetime.now() + timedelta(days=5),
        description="调用频率限制为每分钟 100 次"
    ))
    
    print("示例数据已加载完成")

if __name__ == "__main__":
    import uvicorn
    seed_demo_data()
    uvicorn.run(app, host="0.0.0.0", port=8000)
