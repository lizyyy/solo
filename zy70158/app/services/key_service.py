"""
密钥管理服务
"""
import uuid
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    APIKey, QuotaBucket, IPRule, DecisionLog, CallLog, SuspensionRecord, ManualReview,
    KeyStatus, QuotaPeriod, DecisionResult, DecisionReason, ReviewStatus, IPActionType
)
from app.config import settings
from app.services.decision_rules import (
    evaluate_request, KeyState, QuotaInfo, IPRuleInfo, DecisionOutput, DecisionResult as RulesDecisionResult
)


def generate_api_key() -> str:
    """生成 API 密钥"""
    return "ak-" + uuid.uuid4().hex.upper()


def create_api_key(
    db: Session,
    app_id: str,
    developer_id: str,
    description: Optional[str] = None,
    is_ip_restricted: bool = False,
    default_limits: Optional[dict] = None
) -> APIKey:
    """创建 API 密钥"""
    key_value = generate_api_key()
    
    api_key = APIKey(
        key_value=key_value,
        app_id=app_id,
        developer_id=developer_id,
        description=description,
        status=KeyStatus.ACTIVE,
        is_ip_restricted=is_ip_restricted
    )
    db.add(api_key)
    db.flush()
    
    limits = default_limits or {
        QuotaPeriod.MINUTE: settings.DEFAULT_QUOTA_PER_MINUTE,
        QuotaPeriod.HOUR: settings.DEFAULT_QUOTA_PER_HOUR,
        QuotaPeriod.DAY: settings.DEFAULT_QUOTA_PER_DAY,
    }
    
    for period, limit in limits.items():
        bucket = QuotaBucket(
            api_key_id=api_key.id,
            api_endpoint=None,
            period=period,
            limit=limit,
            used=0,
            reset_at=_get_next_reset_time(period)
        )
        db.add(bucket)
    
    db.commit()
    db.refresh(api_key)
    return api_key


def get_api_key_by_value(db: Session, key_value: str) -> Optional[APIKey]:
    """通过密钥值查找密钥"""
    return db.query(APIKey).filter(APIKey.key_value == key_value).first()


def list_api_keys_by_developer(db: Session, developer_id: str) -> List[APIKey]:
    """获取开发者的所有密钥"""
    return db.query(APIKey).filter(APIKey.developer_id == developer_id).all()


def update_api_key_status(
    db: Session,
    api_key: APIKey,
    new_status: KeyStatus,
    reason: Optional[str] = None,
    operator: Optional[str] = None
) -> APIKey:
    """更新密钥状态"""
    old_status = api_key.status
    api_key.status = new_status
    
    if new_status in [KeyStatus.SUSPENDED, KeyStatus.BANNED]:
        suspension = SuspensionRecord(
            api_key_id=api_key.id,
            suspension_type=str(new_status),
            reason=reason,
            reason_code=f"status_change_{old_status}_to_{new_status}",
            suspended_by=operator or "system"
        )
        db.add(suspension)
    
    if old_status in [KeyStatus.SUSPENDED, KeyStatus.BANNED] and new_status == KeyStatus.ACTIVE:
        active_suspension = (
            db.query(SuspensionRecord)
            .filter(
                SuspensionRecord.api_key_id == api_key.id,
                SuspensionRecord.is_active == True
            )
            .order_by(SuspensionRecord.suspended_at.desc())
            .first()
        )
        if active_suspension:
            active_suspension.is_active = False
            active_suspension.lifted_by = operator or "system"
            active_suspension.lifted_at = datetime.utcnow()
            active_suspension.lift_reason = reason or "手动解封"
    
    db.commit()
    db.refresh(api_key)
    return api_key


def add_ip_rule(
    db: Session,
    api_key: APIKey,
    ip_address: str,
    action: IPActionType,
    description: Optional[str] = None,
    expires_in_minutes: Optional[int] = None
) -> IPRule:
    """添加 IP 规则"""
    expires_at = None
    if expires_in_minutes:
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
    
    rule = IPRule(
        api_key_id=api_key.id,
        ip_address=ip_address,
        action=action,
        description=description,
        expires_at=expires_at
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def remove_ip_rule(db: Session, rule_id: int) -> bool:
    """删除 IP 规则"""
    rule = db.query(IPRule).filter(IPRule.id == rule_id).first()
    if rule:
        db.delete(rule)
        db.commit()
        return True
    return False


def check_and_consume_quota(
    db: Session,
    api_key: APIKey,
    api_endpoint: Optional[str],
    ip_address: str,
    request_id: str
) -> dict:
    """
    检查并消耗配额
    
    核心流程:
    1. 收集决策所需信息
    2. 调用纯函数 evaluate_request 进行判断
    3. 根据决策结果执行操作（消耗配额/记录日志/创建工单）
    4. 返回结果，包含当前卡点和前一次决策记录
    """
    key_state = KeyState(
        status=str(api_key.status),
        is_ip_restricted=api_key.is_ip_restricted
    )
    
    quota_buckets_db = (
        db.query(QuotaBucket)
        .filter(
            QuotaBucket.api_key_id == api_key.id,
            (QuotaBucket.api_endpoint == api_endpoint) | (QuotaBucket.api_endpoint.is_(None))
        )
        .all()
    )
    
    quota_buckets = [
        QuotaInfo(
            period=str(b.period),
            limit=b.limit,
            used=b.used,
            reset_at=b.reset_at
        )
        for b in quota_buckets_db
    ]
    
    ip_rules_db = db.query(IPRule).filter(IPRule.api_key_id == api_key.id).all()
    ip_rules = [
        IPRuleInfo(
            ip_address=r.ip_address,
            action=str(r.action),
            expires_at=r.expires_at
        )
        for r in ip_rules_db
    ]
    
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    recent_rejections = (
        db.query(DecisionLog)
        .filter(
            DecisionLog.api_key_id == api_key.id,
            DecisionLog.result != DecisionResult.APPROVED,
            DecisionLog.created_at >= five_minutes_ago
        )
        .count()
    )
    
    unique_ips = (
        db.query(CallLog.ip_address)
        .filter(
            CallLog.api_key_id == api_key.id,
            CallLog.request_timestamp >= five_minutes_ago
        )
        .distinct()
        .count()
    )
    
    decision, refreshed_buckets = evaluate_request(
        key_state=key_state,
        ip_address=ip_address,
        quota_buckets=quota_buckets,
        ip_rules=ip_rules,
        recent_rejections=recent_rejections,
        unique_ips=unique_ips,
        auto_approve_limit=settings.AUTO_APPROVE_LIMIT
    )
    
    previous_decision = (
        db.query(DecisionLog)
        .filter(
            DecisionLog.api_key_id == api_key.id,
            DecisionLog.is_latest == True
        )
        .order_by(DecisionLog.created_at.desc())
        .first()
    )
    
    if previous_decision:
        previous_decision.is_latest = False
    
    decision_log = DecisionLog(
        api_key_id=api_key.id,
        request_id=request_id,
        result=DecisionResult(decision.result.value),
        reason=DecisionReason(decision.reason.value),
        details=decision.details,
        ip_address=ip_address,
        api_endpoint=api_endpoint,
        previous_decision_id=previous_decision.id if previous_decision else None,
        is_latest=True
    )
    db.add(decision_log)
    db.flush()
    
    if decision.result == RulesDecisionResult.APPROVED:
        for bucket_db, refreshed in zip(quota_buckets_db, refreshed_buckets):
            bucket_db.used = refreshed.used + 1
            bucket_db.reset_at = refreshed.reset_at
        
        api_key.last_used_at = datetime.utcnow()
        
        call_log = CallLog(
            api_key_id=api_key.id,
            api_endpoint=api_endpoint,
            ip_address=ip_address,
            status_code=200,
            response_time_ms=0
        )
        db.add(call_log)
    
    elif decision.result == RulesDecisionResult.PENDING_REVIEW:
        review = ManualReview(
            api_key_id=api_key.id,
            decision_log_id=decision_log.id,
            status=ReviewStatus.PENDING,
            reason=DecisionReason(decision.reason.value),
            details=decision.details,
            requested_by="system"
        )
        db.add(review)
    
    db.commit()
    
    return {
        "approved": decision.result == RulesDecisionResult.APPROVED,
        "decision": {
            "result": decision.result.value,
            "reason": decision.reason.value,
            "details": decision.details,
            "next_step": decision.next_step
        },
        "current_checkpoint": _get_current_checkpoint(decision),
        "previous_decision": _format_previous_decision(previous_decision),
        "decision_log_id": decision_log.id
    }


def get_decision_history(db: Session, api_key_id: int, limit: int = 10) -> List[dict]:
    """获取决策历史记录"""
    decisions = (
        db.query(DecisionLog)
        .filter(DecisionLog.api_key_id == api_key_id)
        .order_by(DecisionLog.created_at.desc())
        .limit(limit)
        .all()
    )
    
    return [
        {
            "id": d.id,
            "request_id": d.request_id,
            "result": str(d.result),
            "reason": str(d.reason),
            "details": d.details,
            "ip_address": d.ip_address,
            "api_endpoint": d.api_endpoint,
            "created_at": d.created_at.isoformat(),
            "previous_decision_id": d.previous_decision_id
        }
        for d in decisions
    ]


def review_manual_ticket(
    db: Session,
    review_id: int,
    approved: bool,
    reviewer: str,
    notes: Optional[str] = None
) -> Optional[ManualReview]:
    """处理人工复核工单"""
    review = db.query(ManualReview).filter(ManualReview.id == review_id).first()
    if not review or review.status != ReviewStatus.PENDING:
        return None
    
    review.status = ReviewStatus.APPROVED if approved else ReviewStatus.REJECTED
    review.reviewed_by = reviewer
    review.reviewed_at = datetime.utcnow()
    review.review_notes = notes
    review.decision_result = DecisionResult.APPROVED if approved else DecisionResult.REJECTED
    
    if approved:
        api_key = db.query(APIKey).filter(APIKey.id == review.api_key_id).first()
        if api_key and api_key.status == KeyStatus.SUSPENDED:
            api_key.status = KeyStatus.ACTIVE
    
    db.commit()
    db.refresh(review)
    return review


def _get_next_reset_time(period: QuotaPeriod) -> datetime:
    period_map = {
        QuotaPeriod.MINUTE: timedelta(minutes=1),
        QuotaPeriod.HOUR: timedelta(hours=1),
        QuotaPeriod.DAY: timedelta(days=1),
    }
    return datetime.utcnow() + period_map.get(period, timedelta(hours=1))


def _get_current_checkpoint(decision: DecisionOutput) -> str:
    """根据决策结果返回当前卡点名称"""
    checkpoint_map = {
        DecisionReason.KEY_INVALID: "密钥状态检查",
        DecisionReason.KEY_SUSPENDED: "密钥状态检查",
        DecisionReason.KEY_BANNED: "密钥状态检查",
        DecisionReason.IP_BLOCKED: "IP 规则检查",
        DecisionReason.IP_NOT_WHITELISTED: "IP 规则检查",
        DecisionReason.QUOTA_EXCEEDED: "配额检查",
        DecisionReason.SUSPICIOUS_PATTERN: "可疑模式检测",
        DecisionReason.MANUAL_REVIEW_REQUIRED: "人工复核",
    }
    return checkpoint_map.get(decision.reason, "正常通过")


def _format_previous_decision(previous: Optional[DecisionLog]) -> Optional[dict]:
    """格式化前一次决策记录"""
    if not previous:
        return None
    return {
        "id": previous.id,
        "request_id": previous.request_id,
        "result": str(previous.result),
        "reason": str(previous.reason),
        "details": previous.details,
        "created_at": previous.created_at.isoformat()
    }
