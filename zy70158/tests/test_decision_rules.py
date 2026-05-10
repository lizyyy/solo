"""
核心决策规则单元测试

这些测试验证文档中描述的所有重要判断逻辑
"""
import pytest
from datetime import datetime, timedelta
from app.services.decision_rules import (
    check_key_status,
    check_ip_rules,
    check_quota,
    check_suspicious_pattern,
    evaluate_request,
    is_auto_approvable,
    requires_manual_review,
    get_checkpoint_order,
    KeyState,
    QuotaInfo,
    IPRuleInfo,
    DecisionResult,
    DecisionReason
)


class TestCheckKeyStatus:
    """密钥状态检查测试"""

    def test_active_key_returns_none(self):
        """成功条件: 状态为 active 时通过"""
        key_state = KeyState(status="active", is_ip_restricted=False)
        result = check_key_status(key_state)
        assert result is None

    def test_inactive_key_rejected(self):
        """失败条件: 未激活密钥被拒绝"""
        key_state = KeyState(status="inactive", is_ip_restricted=False)
        result = check_key_status(key_state)
        assert result is not None
        assert result.result == DecisionResult.REJECTED
        assert result.reason == DecisionReason.KEY_INVALID

    def test_suspended_key_rejected(self):
        """失败条件: 被临时封禁密钥被拒绝"""
        key_state = KeyState(status="suspended", is_ip_restricted=False)
        result = check_key_status(key_state)
        assert result.result == DecisionResult.REJECTED
        assert result.reason == DecisionReason.KEY_SUSPENDED

    def test_banned_key_rejected(self):
        """失败条件: 被永久封禁密钥被拒绝"""
        key_state = KeyState(status="banned", is_ip_restricted=False)
        result = check_key_status(key_state)
        assert result.result == DecisionResult.REJECTED
        assert result.reason == DecisionReason.KEY_BANNED

    def test_unknown_status_rejected(self):
        """失败条件: 未知状态被拒绝"""
        key_state = KeyState(status="unknown", is_ip_restricted=False)
        result = check_key_status(key_state)
        assert result.result == DecisionResult.REJECTED


class TestCheckIPRules:
    """IP 规则检查测试"""

    def test_no_rules_and_no_restriction_passes(self):
        """成功条件: 无规则且未启用限制时通过"""
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=False,
            ip_rules=[]
        )
        assert result is None

    def test_blacklisted_ip_rejected(self):
        """失败条件: IP 在黑名单中被拒绝"""
        rules = [
            IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=None)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=False,
            ip_rules=rules
        )
        assert result is not None
        assert result.reason == DecisionReason.IP_BLOCKED

    def test_whitelist_restriction_not_in_list_rejected(self):
        """失败条件: 启用白名单限制但 IP 不在列表中被拒绝"""
        rules = [
            IPRuleInfo(ip_address="10.0.0.1", action="whitelist", expires_at=None)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=True,
            ip_rules=rules
        )
        assert result.reason == DecisionReason.IP_NOT_WHITELISTED

    def test_whitelist_restriction_in_list_passes(self):
        """成功条件: 启用白名单且 IP 在列表中通过"""
        rules = [
            IPRuleInfo(ip_address="192.168.1.1", action="whitelist", expires_at=None)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=True,
            ip_rules=rules
        )
        assert result is None

    def test_expired_blacklist_ignored(self):
        """已过期的黑名单规则被忽略"""
        past = datetime.utcnow() - timedelta(hours=1)
        rules = [
            IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=past)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=False,
            ip_rules=rules
        )
        assert result is None

    def test_blacklist_priority_over_whitelist(self):
        """黑名单优先级高于白名单"""
        rules = [
            IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=None),
            IPRuleInfo(ip_address="192.168.1.1", action="whitelist", expires_at=None)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=True,
            ip_rules=rules
        )
        assert result.reason == DecisionReason.IP_BLOCKED


class TestCheckQuota:
    """配额检查测试"""

    def test_under_quota_passes(self):
        """成功条件: 配额未用尽时通过"""
        now = datetime.utcnow()
        buckets = [
            QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1))
        ]
        result, refreshed = check_quota(buckets, current_time=now)
        assert result is None
        assert len(refreshed) == 1

    def test_quota_exceeded_rejected(self):
        """失败条件: 配额用尽时被拒绝"""
        now = datetime.utcnow()
        buckets = [
            QuotaInfo(period="minute", limit=100, used=100, reset_at=now + timedelta(minutes=1))
        ]
        result, refreshed = check_quota(buckets, current_time=now)
        assert result is not None
        assert result.reason == DecisionReason.QUOTA_EXCEEDED

    def test_expired_quota_reset(self):
        """已过期配额自动重置"""
        past = datetime.utcnow() - timedelta(hours=1)
        buckets = [
            QuotaInfo(period="hour", limit=100, used=100, reset_at=past)
        ]
        result, refreshed = check_quota(buckets)
        assert result is None
        assert refreshed[0].used == 0

    def test_multiple_buckets_one_exceeded(self):
        """任一配额桶用尽即拒绝"""
        now = datetime.utcnow()
        buckets = [
            QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1)),
            QuotaInfo(period="hour", limit=1000, used=1000, reset_at=now + timedelta(hours=1))
        ]
        result, refreshed = check_quota(buckets, current_time=now)
        assert result is not None
        assert result.reason == DecisionReason.QUOTA_EXCEEDED


class TestCheckSuspiciousPattern:
    """可疑模式检测测试"""

    def test_normal_pattern_passes(self):
        """成功条件: 正常模式通过"""
        result = check_suspicious_pattern(recent_rejections=0, unique_ips=1, auto_approve_limit=5)
        assert result is None

    def test_too_many_rejections_needs_review(self):
        """人工复核条件: 短时间多次拒绝"""
        result = check_suspicious_pattern(recent_rejections=10, unique_ips=1, auto_approve_limit=5)
        assert result is not None
        assert result.result == DecisionResult.PENDING_REVIEW
        assert result.reason == DecisionReason.SUSPICIOUS_PATTERN

    def test_too_many_ips_needs_review(self):
        """人工复核条件: 单一密钥同时从多个 IP 访问"""
        result = check_suspicious_pattern(recent_rejections=0, unique_ips=15, auto_approve_limit=5)
        assert result.result == DecisionResult.PENDING_REVIEW

    def test_at_limit_passes(self):
        """成功条件: 刚好在限制内通过"""
        result = check_suspicious_pattern(recent_rejections=5, unique_ips=1, auto_approve_limit=5)
        assert result is None


class TestEvaluateRequest:
    """完整请求评估流程测试"""

    def test_normal_request_approved(self):
        """成功条件: 所有检查通过"""
        now = datetime.utcnow()
        decision, _ = evaluate_request(
            key_state=KeyState(status="active", is_ip_restricted=False),
            ip_address="192.168.1.1",
            quota_buckets=[
                QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1))
            ],
            ip_rules=[],
            recent_rejections=0,
            unique_ips=1,
            auto_approve_limit=5,
            current_time=now
        )
        assert decision.result == DecisionResult.APPROVED
        assert decision.reason == DecisionReason.NORMAL

    def test_key_status_check_first(self):
        """检查顺序: 密钥状态是第一个检查点"""
        now = datetime.utcnow()
        decision, _ = evaluate_request(
            key_state=KeyState(status="banned", is_ip_restricted=False),
            ip_address="192.168.1.1",
            quota_buckets=[
                QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1))
            ],
            ip_rules=[
                IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=None)
            ],
            recent_rejections=100,
            unique_ips=100,
            auto_approve_limit=5,
            current_time=now
        )
        assert decision.reason == DecisionReason.KEY_BANNED

    def test_ip_check_second(self):
        """检查顺序: IP 规则在密钥状态之后"""
        now = datetime.utcnow()
        decision, _ = evaluate_request(
            key_state=KeyState(status="active", is_ip_restricted=False),
            ip_address="192.168.1.1",
            quota_buckets=[
                QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1))
            ],
            ip_rules=[
                IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=None)
            ],
            recent_rejections=100,
            unique_ips=100,
            auto_approve_limit=5,
            current_time=now
        )
        assert decision.reason == DecisionReason.IP_BLOCKED

    def test_quota_check_third(self):
        """检查顺序: 配额在 IP 规则之后"""
        now = datetime.utcnow()
        decision, _ = evaluate_request(
            key_state=KeyState(status="active", is_ip_restricted=False),
            ip_address="192.168.1.1",
            quota_buckets=[
                QuotaInfo(period="minute", limit=100, used=100, reset_at=now + timedelta(minutes=1))
            ],
            ip_rules=[],
            recent_rejections=100,
            unique_ips=100,
            auto_approve_limit=5,
            current_time=now
        )
        assert decision.reason == DecisionReason.QUOTA_EXCEEDED

    def test_suspicious_pattern_last(self):
        """检查顺序: 可疑模式在最后"""
        now = datetime.utcnow()
        decision, _ = evaluate_request(
            key_state=KeyState(status="active", is_ip_restricted=False),
            ip_address="192.168.1.1",
            quota_buckets=[
                QuotaInfo(period="minute", limit=100, used=50, reset_at=now + timedelta(minutes=1))
            ],
            ip_rules=[],
            recent_rejections=10,
            unique_ips=1,
            auto_approve_limit=5,
            current_time=now
        )
        assert decision.reason == DecisionReason.SUSPICIOUS_PATTERN


class TestHelperFunctions:
    """辅助函数测试"""

    def test_is_auto_approvable(self):
        """验证通过的判断"""
        from app.services.decision_rules import DecisionOutput
        approved = DecisionOutput(
            result=DecisionResult.APPROVED,
            reason=DecisionReason.NORMAL,
            details="",
            next_step=""
        )
        assert is_auto_approvable(approved) is True

        rejected = DecisionOutput(
            result=DecisionResult.REJECTED,
            reason=DecisionReason.QUOTA_EXCEEDED,
            details="",
            next_step=""
        )
        assert is_auto_approvable(rejected) is False

    def test_requires_manual_review(self):
        """验证需要人工复核的判断"""
        from app.services.decision_rules import DecisionOutput
        pending = DecisionOutput(
            result=DecisionResult.PENDING_REVIEW,
            reason=DecisionReason.SUSPICIOUS_PATTERN,
            details="",
            next_step=""
        )
        assert requires_manual_review(pending) is True

        approved = DecisionOutput(
            result=DecisionResult.APPROVED,
            reason=DecisionReason.NORMAL,
            details="",
            next_step=""
        )
        assert requires_manual_review(approved) is False

    def test_checkpoint_order(self):
        """验证检查点顺序"""
        order = get_checkpoint_order()
        assert len(order) == 4
        assert order[0] == "密钥状态检查"
        assert order[1] == "IP 规则检查"
        assert order[2] == "配额检查"
        assert order[3] == "可疑模式检测"


class TestNextStepGuidance:
    """下一步操作指引测试"""

    def test_quota_exceeded_next_step(self):
        """配额超限的下一步指引"""
        now = datetime.utcnow()
        buckets = [
            QuotaInfo(period="minute", limit=100, used=100, reset_at=now + timedelta(minutes=1))
        ]
        result, _ = check_quota(buckets, current_time=now)
        assert "配额台账" in result.next_step

    def test_ip_blocked_next_step(self):
        """IP 封禁的下一步指引"""
        rules = [
            IPRuleInfo(ip_address="192.168.1.1", action="blacklist", expires_at=None)
        ]
        result = check_ip_rules(
            ip_address="192.168.1.1",
            is_ip_restricted=False,
            ip_rules=rules
        )
        assert "管理员" in result.next_step

    def test_manual_review_next_step(self):
        """人工复核的下一步指引"""
        result = check_suspicious_pattern(recent_rejections=10, unique_ips=1, auto_approve_limit=5)
        assert "人工复核工单" in result.next_step
