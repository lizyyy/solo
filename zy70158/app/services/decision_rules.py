"""
决策规则引擎 - 核心判断逻辑
这些规则被编写为纯函数，便于独立单元测试
"""
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum


class DecisionResult(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING_REVIEW = "pending_review"


class DecisionReason(str, Enum):
    QUOTA_EXCEEDED = "quota_exceeded"
    IP_BLOCKED = "ip_blocked"
    IP_NOT_WHITELISTED = "ip_not_whitelisted"
    KEY_INVALID = "key_inactive"
    KEY_SUSPENDED = "key_suspended"
    KEY_BANNED = "key_banned"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    NORMAL = "normal"


@dataclass
class DecisionOutput:
    result: DecisionResult
    reason: DecisionReason
    details: str
    next_step: str
    should_log: bool = True


@dataclass
class KeyState:
    status: str
    is_ip_restricted: bool


@dataclass
class QuotaInfo:
    period: str
    limit: int
    used: int
    reset_at: datetime


@dataclass
class IPRuleInfo:
    ip_address: str
    action: str
    expires_at: Optional[datetime]


MANUAL_REVIEW_REASONS = {
    DecisionReason.SUSPICIOUS_PATTERN: "异常调用模式检测",
    DecisionReason.MANUAL_REVIEW_REQUIRED: "需要人工复核",
}

SUCCESS_CONDITIONS = {
    DecisionResult.APPROVED: "请求通过所有检查",
}


def check_key_status(key_state: KeyState) -> Optional[DecisionOutput]:
    """
    检查密钥状态
    
    成功条件: status == 'active'
    失败条件: 
        - inactive -> 直接拒绝
        - suspended -> 直接拒绝
        - banned -> 直接拒绝
    """
    if key_state.status == "active":
        return None
    
    status_reason_map = {
        "inactive": (DecisionReason.KEY_INVALID, "密钥未激活，请在控制台激活后重试"),
        "suspended": (DecisionReason.KEY_SUSPENDED, "密钥已被临时封禁，请提交申诉或等待自动解封"),
        "banned": (DecisionReason.KEY_BANNED, "密钥已被永久封禁，请联系客服"),
    }
    
    reason, details = status_reason_map.get(key_state.status, (DecisionReason.KEY_INVALID, "密钥状态异常"))
    
    return DecisionOutput(
        result=DecisionResult.REJECTED,
        reason=reason,
        details=details,
        next_step=_get_next_step_for_rejection(reason)
    )


def check_ip_rules(
    ip_address: str,
    is_ip_restricted: bool,
    ip_rules: List[IPRuleInfo],
    current_time: Optional[datetime] = None
) -> Optional[DecisionOutput]:
    """
    检查 IP 规则
    
    优先级: 黑名单 > 白名单
    成功条件: 
        1. 不在黑名单中
        2. 如果启用白名单限制，则必须在白名单中
    """
    current_time = current_time or datetime.utcnow()
    
    active_rules = [
        r for r in ip_rules 
        if r.expires_at is None or r.expires_at > current_time
    ]
    
    blacklisted = any(
        r.ip_address == ip_address and r.action == "blacklist" 
        for r in active_rules
    )
    if blacklisted:
        return DecisionOutput(
            result=DecisionResult.REJECTED,
            reason=DecisionReason.IP_BLOCKED,
            details=f"IP {ip_address} 在黑名单中",
            next_step=_get_next_step_for_rejection(DecisionReason.IP_BLOCKED)
        )
    
    if is_ip_restricted:
        whitelisted = any(
            r.ip_address == ip_address and r.action == "whitelist"
            for r in active_rules
        )
        if not whitelisted:
            return DecisionOutput(
                result=DecisionResult.REJECTED,
                reason=DecisionReason.IP_NOT_WHITELISTED,
                details=f"密钥启用了 IP 白名单限制，但 IP {ip_address} 不在白名单中",
                next_step=_get_next_step_for_rejection(DecisionReason.IP_NOT_WHITELISTED)
            )
    
    return None


def check_quota(
    quota_buckets: List[QuotaInfo],
    current_time: Optional[datetime] = None
) -> Tuple[Optional[DecisionOutput], List[QuotaInfo]]:
    """
    检查配额桶
    
    成功条件: 所有活跃配额桶的 used < limit
    失败条件: 任一配额桶已满 -> 直接拒绝
    
    返回: (决策结果, 刷新后的配额列表)
    """
    current_time = current_time or datetime.utcnow()
    refreshed_buckets = []
    quota_exceeded = False
    exceeded_details = []
    
    for bucket in quota_buckets:
        if current_time >= bucket.reset_at:
            refreshed_bucket = QuotaInfo(
                period=bucket.period,
                limit=bucket.limit,
                used=0,
                reset_at=_calculate_next_reset(bucket.period, current_time)
            )
            refreshed_buckets.append(refreshed_bucket)
            continue
        
        refreshed_buckets.append(bucket)
        
        if bucket.used >= bucket.limit:
            quota_exceeded = True
            remaining = (bucket.reset_at - current_time).total_seconds()
            exceeded_details.append(
                f"{bucket.period} 配额已满 (已用 {bucket.used}/{bucket.limit})，将在 {remaining:.0f} 秒后重置"
            )
    
    if quota_exceeded:
        return (
            DecisionOutput(
                result=DecisionResult.REJECTED,
                reason=DecisionReason.QUOTA_EXCEEDED,
                details="; ".join(exceeded_details),
                next_step=_get_next_step_for_rejection(DecisionReason.QUOTA_EXCEEDED)
            ),
            refreshed_buckets
        )
    
    return None, refreshed_buckets


def check_suspicious_pattern(
    recent_rejections: int,
    unique_ips: int,
    auto_approve_limit: int = 5
) -> Optional[DecisionOutput]:
    """
    检查可疑模式，决定是否需要人工复核
    
    成功条件: recent_rejections <= auto_approve_limit
    人工复核条件: 
        - 短时间内多次拒绝 (recent_rejections > auto_approve_limit)
        - 单一密钥同时从多个 IP 访问 (unique_ips > auto_approve_limit * 2)
    """
    if recent_rejections > auto_approve_limit:
        return DecisionOutput(
            result=DecisionResult.PENDING_REVIEW,
            reason=DecisionReason.SUSPICIOUS_PATTERN,
            details=f"短时间内被拒绝 {recent_rejections} 次，超过自动审批阈值 {auto_approve_limit}",
            next_step="系统已创建人工复核工单，请等待管理员审核",
            should_log=True
        )
    
    if unique_ips > auto_approve_limit * 2:
        return DecisionOutput(
            result=DecisionResult.PENDING_REVIEW,
            reason=DecisionReason.SUSPICIOUS_PATTERN,
            details=f"单一密钥同时从 {unique_ips} 个 IP 访问，触发异常模式检测",
            next_step="系统已创建人工复核工单，请等待管理员审核",
            should_log=True
        )
    
    return None


def evaluate_request(
    key_state: KeyState,
    ip_address: str,
    quota_buckets: List[QuotaInfo],
    ip_rules: List[IPRuleInfo],
    recent_rejections: int = 0,
    unique_ips: int = 1,
    auto_approve_limit: int = 5,
    current_time: Optional[datetime] = None
) -> Tuple[DecisionOutput, List[QuotaInfo]]:
    """
    完整的请求评估流程
    
    检查顺序: 
    1. 密钥状态 -> 不可逆
    2. IP 规则 -> 不可逆  
    3. 配额检查 -> 可逆（等重置）
    4. 可疑模式 -> 可能需要人工复核
    
    这是可测试的核心判断逻辑，独立于数据库和外部服务
    """
    current_time = current_time or datetime.utcnow()
    
    decision = check_key_status(key_state)
    if decision:
        return decision, quota_buckets
    
    decision = check_ip_rules(ip_address, key_state.is_ip_restricted, ip_rules, current_time)
    if decision:
        return decision, quota_buckets
    
    decision, refreshed_buckets = check_quota(quota_buckets, current_time)
    if decision:
        return decision, refreshed_buckets
    
    decision = check_suspicious_pattern(recent_rejections, unique_ips, auto_approve_limit)
    if decision:
        return decision, refreshed_buckets
    
    return (
        DecisionOutput(
            result=DecisionResult.APPROVED,
            reason=DecisionReason.NORMAL,
            details="请求通过所有检查",
            next_step="请求已放行，将记录到调用明细",
            should_log=True
        ),
        refreshed_buckets
    )


def _calculate_next_reset(period: str, current_time: datetime) -> datetime:
    """计算下一个重置时间"""
    period_map = {
        "minute": timedelta(minutes=1),
        "hour": timedelta(hours=1),
        "day": timedelta(days=1),
    }
    delta = period_map.get(period, timedelta(hours=1))
    return current_time + delta


def _get_next_step_for_rejection(reason: DecisionReason) -> str:
    """根据拒绝原因给出下一步操作指引"""
    next_steps = {
        DecisionReason.QUOTA_EXCEEDED: 
            "请查看配额台账，确认当前各周期已用/总量。如需提升配额，请在控制台提交申请。",
        DecisionReason.IP_BLOCKED:
            "请联系管理员，确认 IP 封禁原因。可提供近 30 分钟的调用记录辅助排查。",
        DecisionReason.IP_NOT_WHITELISTED:
            "请在密钥管理页面添加当前 IP 到白名单，或关闭 IP 白名单限制。",
        DecisionReason.KEY_INVALID:
            "请登录控制台查看密钥状态。如果是新创建的密钥，可能需要等待 1-2 分钟生效。",
        DecisionReason.KEY_SUSPENDED:
            "请查看封禁记录中的解封时间，或提交申诉工单。申诉时请提供业务说明。",
        DecisionReason.KEY_BANNED:
            "请联系客服人员，准备完整的业务说明和调用场景描述。",
    }
    return next_steps.get(reason, "请查看决策日志中的详细信息，或联系技术支持")


def is_auto_approvable(decision: DecisionOutput) -> bool:
    """判断决策是否可自动通过"""
    return decision.result == DecisionResult.APPROVED


def requires_manual_review(decision: DecisionOutput) -> bool:
    """判断决策是否需要人工复核"""
    return decision.result == DecisionResult.PENDING_REVIEW


def get_checkpoint_order() -> List[str]:
    """
    返回检查点顺序，用于排查时知道下一步该查哪里
    
    使用者遇到拒绝时，可按此顺序逐一排查
    """
    return [
        "密钥状态检查",
        "IP 规则检查", 
        "配额检查",
        "可疑模式检测",
    ]
