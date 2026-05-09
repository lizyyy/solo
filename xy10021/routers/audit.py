from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas import AuditLogResponse
from services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["审计日志"])


@router.get("")
def list_audit_logs(
    resource_type: Optional[str] = Query(None, description="资源类型"),
    resource_id: Optional[str] = Query(None, description="资源ID"),
    action: Optional[str] = Query(None, description="操作类型"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    result = AuditService.get_history(
        db=db,
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
        page=page,
        page_size=page_size
    )
    
    return {
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "data": result["data"]
    }
