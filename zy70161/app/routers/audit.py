from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..schemas.schemas import AuditLogResponse
from ..services import AuditService

router = APIRouter(prefix="/api/audit", tags=["审计日志"])


@router.get("/rules/{rule_id}", response_model=List[dict], summary="获取规则的操作历史")
def get_rule_history(rule_id: int, limit: int = 50, db: Session = Depends(get_db)):
    logs = AuditService.get_rule_history(db, rule_id, limit)
    if not logs:
        return []
    return [AuditService.format_audit_log_for_display(log) for log in logs]


@router.get("/actors/{actor}", response_model=List[dict], summary="获取操作人的历史记录")
def get_actor_history(actor: str, limit: int = 50, db: Session = Depends(get_db)):
    logs = AuditService.get_actor_history(db, actor, limit)
    if not logs:
        return []
    return [AuditService.format_audit_log_for_display(log) for log in logs]


@router.get("/recent", response_model=List[dict], summary="获取近期变更记录")
def get_recent_changes(hours: int = 24, db: Session = Depends(get_db)):
    if hours <= 0 or hours > 720:
        raise HTTPException(status_code=400, detail="时间范围应在1-720小时之间")
    
    logs = AuditService.get_recent_changes(db, hours)
    return [AuditService.format_audit_log_for_display(log) for log in logs]


@router.get("/actions/descriptions", summary="获取操作类型说明")
def get_action_descriptions():
    return {
        "actions": [
            {"code": "CREATE", "name": "创建规则", "description": "创建新的搜索词规则"},
            {"code": "UPDATE", "name": "更新规则", "description": "修改规则的基本信息"},
            {"code": "SUBMIT_REVIEW", "name": "提交审核", "description": "将规则提交审核"},
            {"code": "APPROVE_REVIEW", "name": "审核通过", "description": "审核通过，进入待灰度状态"},
            {"code": "REJECT_REVIEW", "name": "审核驳回", "description": "审核驳回，返回草稿状态"},
            {"code": "START_GRAY", "name": "开始灰度", "description": "开始灰度发布"},
            {"code": "APPROVE_GRAY", "name": "灰度通过", "description": "灰度效果验证通过，全量发布"},
            {"code": "REJECT_GRAY", "name": "灰度不通过", "description": "灰度效果验证不通过"},
            {"code": "ROLLBACK", "name": "回滚", "description": "停止灰度或回滚生产规则"},
            {"code": "DEPRECATE", "name": "废弃", "description": "废弃规则，不再使用"},
            {"code": "EXPORT", "name": "导出", "description": "导出规则或历史数据"}
        ]
    }
