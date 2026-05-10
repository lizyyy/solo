from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from ..database import get_db
from ..models.models import TermRule, RuleStatus, RuleType, ReviewRequest, GrayRelease, AuditLog
from ..schemas.schemas import (
    TermRuleCreate,
    TermRuleUpdate,
    TermRuleResponse,
    RuleWithHistoryResponse,
    SummaryResponse,
    AuditLogResponse,
    ReviewRequestResponse,
    GrayReleaseResponse
)
from ..services import (
    StateMachineService,
    RuleService,
    AuditService
)

router = APIRouter(prefix="/api/rules", tags=["规则管理"])

state_machine = StateMachineService()
rule_service = RuleService(state_machine)


@router.post("", response_model=TermRuleResponse, summary="创建规则")
def create_rule(data: TermRuleCreate, db: Session = Depends(get_db)):
    try:
        rule = rule_service.create_rule(db, data)
        db.commit()
        db.refresh(rule)
        return rule
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[TermRuleResponse], summary="获取规则列表")
def list_rules(
    library_id: Optional[int] = None,
    status: Optional[RuleStatus] = None,
    rule_type: Optional[RuleType] = None,
    term: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    return rule_service.list_rules(
        db=db,
        library_id=library_id,
        status=status,
        rule_type=rule_type.value if rule_type else None,
        term=term,
        limit=limit,
        offset=offset
    )


@router.get("/{rule_id}", response_model=RuleWithHistoryResponse, summary="获取规则详情（含历史）")
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = rule_service.get_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    audit_logs = AuditService.get_rule_history(db, rule_id, limit=50)
    reviews = (
        db.query(ReviewRequest)
        .filter(ReviewRequest.rule_id == rule_id)
        .order_by(ReviewRequest.requested_at.desc())
        .all()
    )
    gray_releases = (
        db.query(GrayRelease)
        .filter(GrayRelease.rule_id == rule_id)
        .order_by(GrayRelease.created_at.desc())
        .all()
    )
    
    return RuleWithHistoryResponse(
        id=rule.id,
        library_id=rule.library_id,
        version_id=rule.version_id,
        rule_type=rule.rule_type,
        term=rule.term,
        match_type=rule.match_type,
        priority=rule.priority,
        action=rule.action,
        reason=rule.reason,
        status=rule.status,
        created_by=rule.created_by,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        audit_logs=[AuditLogResponse.from_orm(log) for log in audit_logs],
        reviews=[ReviewRequestResponse.from_orm(r) for r in reviews],
        gray_releases=[GrayReleaseResponse.from_orm(g) for g in gray_releases]
    )


@router.put("/{rule_id}", response_model=TermRuleResponse, summary="更新规则")
def update_rule(rule_id: int, data: TermRuleUpdate, actor: str, db: Session = Depends(get_db)):
    try:
        rule = rule_service.update_rule(db, rule_id, data, actor)
        db.commit()
        db.refresh(rule)
        return rule
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{rule_id}/transition", response_model=TermRuleResponse, summary="状态流转")
def transition_status(
    rule_id: int,
    target_status: RuleStatus,
    actor: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        rule = rule_service.transition_status(
            db=db,
            rule_id=rule_id,
            target_status=target_status,
            actor=actor,
            reason=reason
        )
        db.commit()
        db.refresh(rule)
        return rule
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        error_code = getattr(e, 'error_code', 'UNKNOWN_ERROR')
        error_message = getattr(e, 'error_message', str(e))
        details = getattr(e, 'details', None)
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": error_code,
                "error_message": error_message,
                "details": details
            }
        )


@router.get("/{rule_id}/allowed-transitions", summary="获取允许的状态流转")
def get_allowed_transitions(rule_id: int, db: Session = Depends(get_db)):
    rule = rule_service.get_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    return {
        "current_status": rule.status.value,
        "current_status_display": state_machine._get_status_display(rule.status),
        "allowed_transitions": state_machine.get_allowed_transitions(rule.status)
    }


@router.get("/workflow/status", summary="获取状态机工作流说明")
def get_status_workflow():
    return state_machine.get_status_workflow()


@router.get("/summary/overview", response_model=SummaryResponse, summary="获取汇总统计")
def get_summary(db: Session = Depends(get_db)):
    total_rules = db.query(TermRule).count()
    
    by_status = {}
    for status in RuleStatus:
        count = db.query(TermRule).filter(TermRule.status == status).count()
        by_status[status.value] = count
    
    by_type = {
        "blacklist": db.query(TermRule).filter(TermRule.rule_type == RuleType.BLACKLIST).count(),
        "whitelist": db.query(TermRule).filter(TermRule.rule_type == RuleType.WHITELIST).count()
    }
    
    pending_reviews = db.query(TermRule).filter(TermRule.status == RuleStatus.PENDING_REVIEW).count()
    in_gray = db.query(TermRule).filter(TermRule.status == RuleStatus.IN_GRAY).count()
    in_production = db.query(TermRule).filter(TermRule.status == RuleStatus.PRODUCTION).count()
    
    cutoff_time = datetime.utcnow() - timedelta(hours=24)
    recent_changes = (
        db.query(AuditLog)
        .filter(AuditLog.timestamp >= cutoff_time)
        .count()
    )
    
    return SummaryResponse(
        total_rules=total_rules,
        by_status=by_status,
        by_type=by_type,
        pending_reviews=pending_reviews,
        in_gray=in_gray,
        in_production=in_production,
        recent_changes=recent_changes
    )
