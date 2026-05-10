from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.rule import (
    RuleDefinitionCreate, RuleDefinitionUpdate, RuleDefinitionResponse,
    RuleListResponse, RuleTypeEnum, RuleStatusEnum, RuleApplicationRequest
)
from ..schemas.common import StandardResponse
from ..services.rule_engine import rule_engine
from ..models.rule import RuleType, RuleStatus


router = APIRouter(prefix="/api/rules", tags=["业务规则引擎"])


@router.post("", response_model=StandardResponse[RuleDefinitionResponse])
def create_rule(
    rule_data: RuleDefinitionCreate,
    db: Session = Depends(get_db)
):
    try:
        rule = rule_engine.create_rule(
            db=db,
            rule_code=rule_data.rule_code,
            rule_name=rule_data.rule_name,
            rule_type=RuleType(rule_data.rule_type.value),
            rule_description=rule_data.rule_description,
            rule_condition=rule_data.rule_condition,
            rule_action=rule_data.rule_action,
            priority=rule_data.priority,
            is_auto_apply=rule_data.is_auto_apply,
            created_by=rule_data.created_by
        )
        
        return StandardResponse(
            success=True,
            code=200,
            message=f"规则【{rule.rule_name}】创建成功，当前状态为【{rule.status.value}】",
            data=rule
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/{rule_code}", response_model=StandardResponse[RuleDefinitionResponse])
def get_rule(
    rule_code: str,
    db: Session = Depends(get_db)
):
    from ..models.rule import RuleDefinition
    
    rule = db.query(RuleDefinition).filter(
        RuleDefinition.rule_code == rule_code
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=f"规则【{rule_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"查找到规则【{rule.rule_name}】，类型：{rule.rule_type.value}，状态：{rule.status.value}",
        data=rule
    )


@router.get("", response_model=StandardResponse[RuleListResponse])
def list_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    rule_type: Optional[RuleTypeEnum] = Query(None),
    status: Optional[RuleStatusEnum] = Query(None),
    db: Session = Depends(get_db)
):
    from ..models.rule import RuleDefinition
    
    query = db.query(RuleDefinition)
    
    if rule_type:
        query = query.filter(RuleDefinition.rule_type == RuleType(rule_type.value))
    
    if status:
        query = query.filter(RuleDefinition.status == RuleStatus(status.value))
    
    total = query.count()
    total_pages = (total + page_size - 1) // page_size
    
    items = query.order_by(
        RuleDefinition.priority.desc(),
        RuleDefinition.created_at.desc()
    ).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    result = {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items
    }
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{total}条规则",
        data=result
    )


@router.put("/{rule_code}/activate", response_model=StandardResponse[RuleDefinitionResponse])
def activate_rule(
    rule_code: str,
    updated_by: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    rule = rule_engine.activate_rule(db, rule_code, updated_by)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=f"规则【{rule_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"规则【{rule.rule_name}】已启用",
        data=rule
    )


@router.put("/{rule_code}/deactivate", response_model=StandardResponse[RuleDefinitionResponse])
def deactivate_rule(
    rule_code: str,
    updated_by: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    rule = rule_engine.deactivate_rule(db, rule_code, updated_by)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=f"规则【{rule_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"规则【{rule.rule_name}】已停用",
        data=rule
    )


@router.post("/apply", response_model=StandardResponse[dict])
def apply_rules(
    request: RuleApplicationRequest,
    db: Session = Depends(get_db)
):
    result = rule_engine.apply_rules(
        db=db,
        rule_type=RuleType(request.rule_type.value),
        target_type=request.target_type,
        target_data=request.target_data,
        target_id=request.target_id,
        target_code=request.target_code,
        executed_by=request.executed_by,
        auto_save=request.auto_save
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=result["message"],
        data=result
    )


@router.get("/execution/history", response_model=StandardResponse[dict])
def get_rule_execution_history(
    rule_code: Optional[str] = Query(None),
    target_code: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    result = rule_engine.get_rule_execution_history(
        db=db,
        rule_code=rule_code,
        target_code=target_code,
        page=page,
        page_size=page_size
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=result["business_message"],
        data=result
    )
