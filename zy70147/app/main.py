from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import engine, Base, get_db
from app.models import ConfigVersion, GrayscaleRule, ApprovalRequest, InstanceAck, AuditLog
from app.schemas import (
    ConfigVersionCreate, ConfigVersionResponse,
    GrayscaleRuleCreate, GrayscaleRuleResponse,
    ApprovalRequestCreate, ApprovalRequestResponse,
    ApprovalAction, InstanceAckCreate, InstanceAckResponse,
    RollbackRequest, AuditLogResponse,
    ConfigResolveRequest, ConfigResolveResponse
)
from app.services import ConfigVersionService, GrayscaleRuleService, GrayscaleEngine
from app.workflow import ApprovalService, InstanceAckService, RollbackService, ConfigResolver

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="配置灰度审批系统",
    description="支持配置版本管理、灰度规则、审批流、实例回执、异常回滚、发布审计",
    version="1.0.0"
)

@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )

@app.post("/api/config/versions", response_model=ConfigVersionResponse)
def create_config_version(
    data: ConfigVersionCreate,
    db: Session = Depends(get_db)
):
    return ConfigVersionService.create(db, data)

@app.get("/api/config/versions/{config_key}", response_model=List[ConfigVersionResponse])
def list_config_versions(
    config_key: str,
    db: Session = Depends(get_db)
):
    versions = db.query(ConfigVersion).filter(
        ConfigVersion.config_key == config_key
    ).order_by(ConfigVersion.created_at.desc()).all()
    return versions

@app.post("/api/config/versions/{config_id}/activate")
def activate_config(
    config_id: int,
    operator: str,
    db: Session = Depends(get_db)
):
    try:
        ConfigVersionService.activate(db, config_id, operator)
        return {"status": "ok", "message": "激活成功"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/grayscale/rules", response_model=GrayscaleRuleResponse)
def create_grayscale_rule(
    data: GrayscaleRuleCreate,
    db: Session = Depends(get_db)
):
    return GrayscaleRuleService.create(db, data)

@app.get("/api/grayscale/rules", response_model=List[GrayscaleRuleResponse])
def list_grayscale_rules(
    status: Optional[str] = None,
    config_key: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(GrayscaleRule)
    
    if config_key:
        subquery = db.query(ConfigVersion.id).filter(
            ConfigVersion.config_key == config_key
        ).subquery()
        query = query.filter(GrayscaleRule.config_version_id.in_(subquery))
    
    if status:
        query = query.filter(GrayscaleRule.status == status)
    
    return query.order_by(GrayscaleRule.created_at.desc()).all()

@app.get("/api/grayscale/rules/{rule_id}", response_model=GrayscaleRuleResponse)
def get_grayscale_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    rule = db.query(GrayscaleRule).filter(
        GrayscaleRule.id == rule_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule

@app.post("/api/approval/requests", response_model=ApprovalRequestResponse)
def create_approval_request(
    data: ApprovalRequestCreate,
    db: Session = Depends(get_db)
):
    return ApprovalService.create_request(db, data)

@app.get("/api/approval/requests", response_model=List[ApprovalRequestResponse])
def list_approval_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalRequest)
    if status:
        query = query.filter(ApprovalRequest.status == status)
    return query.order_by(ApprovalRequest.created_at.desc()).all()

@app.post("/api/approval/process")
def process_approval(
    action: ApprovalAction,
    db: Session = Depends(get_db)
):
    try:
        approval = ApprovalService.process_approval(db, action)
        return {"status": "ok", "approval_id": approval.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/instance/ack", response_model=InstanceAckResponse)
def record_instance_ack(
    data: InstanceAckCreate,
    db: Session = Depends(get_db)
):
    return InstanceAckService.record_ack(db, data)

@app.get("/api/instance/stats/{rule_id}")
def get_instance_stats(
    rule_id: int,
    db: Session = Depends(get_db)
):
    return InstanceAckService.get_stats(db, rule_id)

@app.post("/api/rollback")
def trigger_rollback(
    data: RollbackRequest,
    db: Session = Depends(get_db)
):
    try:
        RollbackService.trigger_rollback(db, data)
        return {"status": "ok", "message": "回滚成功"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/config/resolve", response_model=ConfigResolveResponse)
def resolve_config(
    data: ConfigResolveRequest,
    db: Session = Depends(get_db)
):
    try:
        return ConfigResolver.resolve(
            db,
            config_key=data.config_key,
            idc=data.idc,
            tenant=data.tenant,
            instance_id=data.instance_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/audit/logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    rule_id: Optional[int] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
                      
    if rule_id:
        query = query.filter(AuditLog.rule_id == rule_id)
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    return query.order_by(AuditLog.created_at.desc()).limit(200).all()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
