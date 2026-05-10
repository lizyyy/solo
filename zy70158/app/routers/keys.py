"""密钥管理 API"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid

from app.database import get_db
from app.models import KeyStatus, IPActionType
from app.services.key_service import (
    create_api_key,
    get_api_key_by_value,
    list_api_keys_by_developer,
    update_api_key_status,
    add_ip_rule,
    remove_ip_rule,
    check_and_consume_quota,
    get_decision_history
)

router = APIRouter(prefix="/keys", tags=["密钥管理"])


class CreateKeyRequest(BaseModel):
    app_id: str
    developer_id: str
    description: Optional[str] = None
    is_ip_restricted: bool = False
    minute_limit: Optional[int] = None
    hour_limit: Optional[int] = None
    day_limit: Optional[int] = None


class UpdateStatusRequest(BaseModel):
    status: str
    reason: Optional[str] = None
    operator: Optional[str] = None


class AddIPRuleRequest(BaseModel):
    ip_address: str
    action: str
    description: Optional[str] = None
    expires_in_minutes: Optional[int] = None


class CheckQuotaRequest(BaseModel):
    api_key: str
    api_endpoint: Optional[str] = None
    ip_address: str


class KeyResponse(BaseModel):
    id: int
    key_value: str
    app_id: str
    developer_id: str
    description: Optional[str]
    status: str
    is_ip_restricted: bool
    created_at: str
    last_used_at: Optional[str]


@router.post("", response_model=KeyResponse)
def create_key(request: CreateKeyRequest, db: Session = Depends(get_db)):
    """创建 API 密钥"""
    limits = {}
    from app.models import QuotaPeriod
    if request.minute_limit:
        limits[QuotaPeriod.MINUTE] = request.minute_limit
    if request.hour_limit:
        limits[QuotaPeriod.HOUR] = request.hour_limit
    if request.day_limit:
        limits[QuotaPeriod.DAY] = request.day_limit
    
    key = create_api_key(
        db=db,
        app_id=request.app_id,
        developer_id=request.developer_id,
        description=request.description,
        is_ip_restricted=request.is_ip_restricted,
        default_limits=limits if limits else None
    )
    
    return KeyResponse(
        id=key.id,
        key_value=key.key_value,
        app_id=key.app_id,
        developer_id=key.developer_id,
        description=key.description,
        status=str(key.status),
        is_ip_restricted=key.is_ip_restricted,
        created_at=key.created_at.isoformat(),
        last_used_at=key.last_used_at.isoformat() if key.last_used_at else None
    )


@router.get("/developer/{developer_id}", response_model=List[KeyResponse])
def list_keys(developer_id: str, db: Session = Depends(get_db)):
    """获取开发者的所有密钥"""
    keys = list_api_keys_by_developer(db, developer_id)
    return [
        KeyResponse(
            id=k.id,
            key_value=k.key_value,
            app_id=k.app_id,
            developer_id=k.developer_id,
            description=k.description,
            status=str(k.status),
            is_ip_restricted=k.is_ip_restricted,
            created_at=k.created_at.isoformat(),
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None
        )
        for k in keys
    ]


@router.get("/{key_value}", response_model=KeyResponse)
def get_key(key_value: str, db: Session = Depends(get_db)):
    """获取单个密钥详情"""
    key = get_api_key_by_value(db, key_value)
    if not key:
        raise HTTPException(status_code=404, detail="密钥不存在")
    
    return KeyResponse(
        id=key.id,
        key_value=key.key_value,
        app_id=key.app_id,
        developer_id=key.developer_id,
        description=key.description,
        status=str(key.status),
        is_ip_restricted=key.is_ip_restricted,
        created_at=key.created_at.isoformat(),
        last_used_at=key.last_used_at.isoformat() if key.last_used_at else None
    )


@router.post("/{key_value}/status")
def update_status(
    key_value: str,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db)
):
    """更新密钥状态（封禁/解封）"""
    key = get_api_key_by_value(db, key_value)
    if not key:
        raise HTTPException(status_code=404, detail="密钥不存在")
    
    try:
        new_status = KeyStatus(request.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的状态值: {request.status}")
    
    key = update_api_key_status(
        db=db,
        api_key=key,
        new_status=new_status,
        reason=request.reason,
        operator=request.operator
    )
    
    return {
        "success": True,
        "key_value": key.key_value,
        "new_status": str(key.status)
    }


@router.post("/{key_value}/ip-rules")
def add_ip_rule_endpoint(
    key_value: str,
    request: AddIPRuleRequest,
    db: Session = Depends(get_db)
):
    """添加 IP 规则（白名单/黑名单）"""
    key = get_api_key_by_value(db, key_value)
    if not key:
        raise HTTPException(status_code=404, detail="密钥不存在")
    
    try:
        action = IPActionType(request.action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的动作值: {request.action}")
    
    rule = add_ip_rule(
        db=db,
        api_key=key,
        ip_address=request.ip_address,
        action=action,
        description=request.description,
        expires_in_minutes=request.expires_in_minutes
    )
    
    return {
        "id": rule.id,
        "ip_address": rule.ip_address,
        "action": str(rule.action),
        "description": rule.description,
        "expires_at": rule.expires_at.isoformat() if rule.expires_at else None
    }


@router.delete("/{key_value}/ip-rules/{rule_id}")
def remove_ip_rule_endpoint(
    key_value: str,
    rule_id: int,
    db: Session = Depends(get_db)
):
    """删除 IP 规则"""
    key = get_api_key_by_value(db, key_value)
    if not key:
        raise HTTPException(status_code=404, detail="密钥不存在")
    
    success = remove_ip_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="规则不存在")
    
    return {"success": True}


@router.post("/check-quota")
def check_quota_endpoint(request: CheckQuotaRequest, db: Session = Depends(get_db)):
    """
    检查并消耗配额
    
    这是核心网关调用接口，返回结果包含：
    - 是否通过
    - 当前卡点（如果被拒绝）
    - 前一次决策记录
    - 下一步操作指引
    """
    key = get_api_key_by_value(db, request.api_key)
    if not key:
        return {
            "approved": False,
            "decision": {
                "result": "rejected",
                "reason": "key_inactive",
                "details": "密钥不存在",
                "next_step": "请确认密钥是否正确，或在控制台重新生成密钥"
            },
            "current_checkpoint": "密钥状态检查",
            "previous_decision": None
        }
    
    request_id = uuid.uuid4().hex
    
    result = check_and_consume_quota(
        db=db,
        api_key=key,
        api_endpoint=request.api_endpoint,
        ip_address=request.ip_address,
        request_id=request_id
    )
    
    return result


@router.get("/{key_value}/decision-history")
def decision_history(key_value: str, limit: int = 10, db: Session = Depends(get_db)):
    """
    获取决策历史记录
    
    用于排查问题时查看历史拒绝记录
    """
    key = get_api_key_by_value(db, key_value)
    if not key:
        raise HTTPException(status_code=404, detail="密钥不存在")
    
    history = get_decision_history(db, key.id, limit)
    return {
        "key_value": key_value,
        "history": history
    }
