from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import models, schemas
from ..utils import mask_sensitive_fields

router = APIRouter()


@router.get("/operations", response_model=List[schemas.OperationLogBase], summary="获取操作日志")
def get_operation_logs(
    skip: int = 0,
    limit: int = 100,
    operation_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.OperationLog).order_by(models.OperationLog.created_at.desc())
    
    if operation_type:
        query = query.filter(models.OperationLog.operation_type == operation_type)
    
    logs = query.offset(skip).limit(limit).all()
    
    masked_logs = [mask_sensitive_fields(schemas.OperationLogBase.model_validate(log).model_dump()) for log in logs]
    return masked_logs


@router.get("/operations/{log_id}", summary="获取单条操作日志详情")
def get_operation_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.OperationLog).filter(models.OperationLog.id == log_id).first()
    if not log:
        return {"success": False, "message": "日志不存在"}
    
    return mask_sensitive_fields({
        "id": log.id,
        "operation_type": log.operation_type,
        "operator_name": log.operator_name,
        "operator_phone": log.operator_phone,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "change_reason": log.change_reason,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "created_at": log.created_at
    })
