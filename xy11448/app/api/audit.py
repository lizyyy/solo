from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user, allow_supervisor, allow_reviewer
from app.models import User, AuditLog

router = APIRouter()


@router.get("/", dependencies=[Depends(allow_reviewer)])
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    method: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if method:
        query = query.filter(AuditLog.method == method)
    if start_time:
        query = query.filter(AuditLog.timestamp >= start_time)
    if end_time:
        query = query.filter(AuditLog.timestamp <= end_time)
    
    logs = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "data": logs,
        "total": query.count()
    }


@router.get("/{log_id}", dependencies=[Depends(allow_reviewer)])
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="审计日志不存在")
    return {"success": True, "data": log}


@router.get("/summary", dependencies=[Depends(allow_reviewer)])
def get_audit_summary(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy import func
    
    query = db.query(AuditLog)
    if start_time:
        query = query.filter(AuditLog.timestamp >= start_time)
    if end_time:
        query = query.filter(AuditLog.timestamp <= end_time)
    
    total_count = query.count()
    
    action_stats = db.query(
        AuditLog.action,
        func.count(AuditLog.id)
    ).group_by(AuditLog.action).all()
    
    resource_stats = db.query(
        AuditLog.resource_type,
        func.count(AuditLog.id)
    ).group_by(AuditLog.resource_type).all()
    
    user_stats = db.query(
        AuditLog.user_id,
        func.count(AuditLog.id)
    ).group_by(AuditLog.user_id).all()
    
    return {
        "success": True,
        "data": {
            "total_count": total_count,
            "action_summary": {action: count for action, count in action_stats},
            "resource_summary": {resource: count for resource, count in resource_stats},
            "user_summary": {user_id: count for user_id, count in user_stats}
        }
    }


@router.get("/user/{user_id}", dependencies=[Depends(allow_reviewer)])
def get_user_audit_trail(
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == user_id
    ).order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "data": logs
    }
