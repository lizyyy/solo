"""
开发者报表服务
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models import APIKey, CallLog, DecisionLog, QuotaBucket, SuspensionRecord, DecisionResult


def get_developer_dashboard(
    db: Session,
    developer_id: str,
    days: int = 7
) -> Dict[str, Any]:
    """
    开发者报表看板
    """
    since = datetime.utcnow() - timedelta(days=days)
    
    keys = db.query(APIKey).filter(APIKey.developer_id == developer_id).all()
    key_ids = [k.id for k in keys]
    
    if not key_ids:
        return {
            "period_days": days,
            "total_keys": 0,
            "active_keys": 0,
            "total_calls": 0,
            "success_rate": 0,
            "rejection_count": 0,
            "top_rejections": [],
            "quota_usage": [],
            "daily_stats": []
        }
    
    total_calls = db.query(func.count(CallLog.id)).filter(
        CallLog.api_key_id.in_(key_ids),
        CallLog.request_timestamp >= since
    ).scalar() or 0
    
    approved_count = db.query(func.count(DecisionLog.id)).filter(
        DecisionLog.api_key_id.in_(key_ids),
        DecisionLog.result == DecisionResult.APPROVED,
        DecisionLog.created_at >= since
    ).scalar() or 0
    
    total_decisions = db.query(func.count(DecisionLog.id)).filter(
        DecisionLog.api_key_id.in_(key_ids),
        DecisionLog.created_at >= since
    ).scalar() or 0
    
    success_rate = (approved_count / total_decisions * 100) if total_decisions > 0 else 0
    
    rejection_count = total_decisions - approved_count
    
    active_keys = sum(1 for k in keys if k.status.value == "active")
    
    quota_usage = get_quota_usage_summary(db, key_ids)
    
    top_rejections = get_top_rejection_reasons(db, key_ids, since)
    
    daily_stats = get_daily_call_stats(db, key_ids, since)
    
    return {
        "period_days": days,
        "total_keys": len(keys),
        "active_keys": active_keys,
        "total_calls": total_calls,
        "success_rate": round(success_rate, 2),
        "rejection_count": rejection_count,
        "top_rejections": top_rejections,
        "quota_usage": quota_usage,
        "daily_stats": daily_stats
    }


def get_quota_usage_summary(db: Session, key_ids: List[int]) -> List[Dict[str, Any]]:
    """获取配额使用摘要"""
    buckets = db.query(QuotaBucket).filter(QuotaBucket.api_key_id.in_(key_ids)).all()
    
    result = []
    for bucket in buckets:
        usage_percent = (bucket.used / bucket.limit * 100) if bucket.limit > 0 else 0
        result.append({
            "key_id": bucket.api_key_id,
            "period": str(bucket.period),
            "endpoint": bucket.api_endpoint,
            "used": bucket.used,
            "limit": bucket.limit,
            "usage_percent": round(usage_percent, 2),
            "reset_at": bucket.reset_at.isoformat() if bucket.reset_at else None,
            "is_high_usage": usage_percent >= 80
        })
    
    return result


def get_top_rejection_reasons(
    db: Session,
    key_ids: List[int],
    since: datetime
) -> List[Dict[str, Any]]:
    """获取主要拒绝原因"""
    from app.models import DecisionReason
    
    rejections = (
        db.query(
            DecisionLog.reason,
            func.count(DecisionLog.id).label('count')
        )
        .filter(
            DecisionLog.api_key_id.in_(key_ids),
            DecisionLog.result != DecisionResult.APPROVED,
            DecisionLog.created_at >= since
        )
        .group_by(DecisionLog.reason)
        .order_by(func.count(DecisionLog.id).desc())
        .limit(5)
        .all()
    )
    
    return [
        {
            "reason": str(r.reason),
            "count": r.count,
            "description": _get_reason_description(r.reason)
        }
        for r in rejections
    ]


def get_daily_call_stats(
    db: Session,
    key_ids: List[int],
    since: datetime
) -> List[Dict[str, Any]]:
    """获取每日调用统计"""
    from sqlalchemy import cast, Date
    
    stats = (
        db.query(
            cast(CallLog.request_timestamp, Date).label('date'),
            func.count(CallLog.id).label('total_calls'),
            func.count(CallLog.id).filter(CallLog.status_code >= 200).filter(CallLog.status_code < 300).label('success_calls')
        )
        .filter(
            CallLog.api_key_id.in_(key_ids),
            CallLog.request_timestamp >= since
        )
        .group_by(cast(CallLog.request_timestamp, Date))
        .order_by('date')
        .all()
    )
    
    return [
        {
            "date": str(s.date),
            "total_calls": s.total_calls,
            "success_calls": s.success_calls,
            "success_rate": round(s.success_calls / s.total_calls * 100, 2) if s.total_calls > 0 else 0
        }
        for s in stats
    ]


def get_suspension_history(
    db: Session,
    key_ids: List[int],
    limit: int = 20
) -> List[Dict[str, Any]]:
    """获取封禁历史记录"""
    records = (
        db.query(SuspensionRecord)
        .filter(SuspensionRecord.api_key_id.in_(key_ids))
        .order_by(SuspensionRecord.suspended_at.desc())
        .limit(limit)
        .all()
    )
    
    return [
        {
            "id": r.id,
            "key_id": r.api_key_id,
            "type": r.suspension_type,
            "reason": r.reason,
            "reason_code": r.reason_code,
            "suspended_by": r.suspended_by,
            "suspended_at": r.suspended_at.isoformat() if r.suspended_at else None,
            "lifted_at": r.lifted_at.isoformat() if r.lifted_at else None,
            "is_active": r.is_active
        }
        for r in records
    ]


def _get_reason_description(reason: DecisionReason) -> str:
    """获取拒绝原因的中文描述"""
    descriptions = {
        "quota_exceeded": "配额超限",
        "ip_blocked": "IP 被封禁",
        "ip_not_whitelisted": "IP 不在白名单",
        "key_inactive": "密钥未激活",
        "key_suspended": "密钥被临时封禁",
        "key_banned": "密钥被永久封禁",
        "suspicious_pattern": "异常调用模式",
        "manual_review_required": "需要人工复核"
    }
    return descriptions.get(reason.value, str(reason))
