import re
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from models import (
    Lead, LeadStatus, BlockReason, CallResult,
    CallbackSchedule, TimezoneRule, ComplianceRule, CheckResult
)
from storage import Storage


class PhoneValidator:
    CHINA_PATTERN = re.compile(r'^1[3-9]\d{9}$')
    
    @classmethod
    def normalize(cls, phone: str) -> str:
        cleaned = re.sub(r'[^\d+]', '', phone)
        if cleaned.startswith('+86'):
            cleaned = cleaned[3:]
        elif cleaned.startswith('86') and len(cleaned) == 13:
            cleaned = cleaned[2:]
        return cleaned

    @classmethod
    def is_valid_china_phone(cls, phone: str) -> bool:
        normalized = cls.normalize(phone)
        return bool(cls.CHINA_PATTERN.match(normalized))

    @classmethod
    def validate(cls, phone: str) -> Tuple[bool, str]:
        normalized = cls.normalize(phone)
        if not normalized:
            return False, "号码为空"
        if len(normalized) < 10:
            return False, f"号码太短: {len(normalized)}位"
        if not re.match(r'^[\d+]+$', normalized):
            return False, "号码包含非法字符"
        if not cls.is_valid_china_phone(normalized):
            return False, "不符合中国手机号格式"
        return True, normalized


@dataclass
class RuleCheckResult:
    passed: bool
    status: LeadStatus
    block_reason: Optional[BlockReason]
    details: str
    callback_info: Optional[Dict[str, Any]] = None


class BaseRule:
    name: str = "base_rule"
    description: str = "基础规则"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        raise NotImplementedError


class PhoneFormatRule(BaseRule):
    name = "phone_format"
    description = "电话号码格式校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        is_valid, msg = PhoneValidator.validate(lead.phone)
        if not is_valid:
            return RuleCheckResult(
                passed=False,
                status=LeadStatus.BLOCKED,
                block_reason=BlockReason.INVALID_NUMBER,
                details=f"号码格式错误: {msg}"
            )
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="号码格式有效"
        )


class BlacklistRule(BaseRule):
    name = "blacklist"
    description = "黑名单校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        normalized_phone = PhoneValidator.normalize(lead.phone)
        if storage.is_phone_in_blacklist(normalized_phone):
            entry = storage.get_blacklist_entry(normalized_phone)
            reason = entry.reason if entry else "用户拒呼"
            return RuleCheckResult(
                passed=False,
                status=LeadStatus.BLOCKED,
                block_reason=BlockReason.BLACKLIST,
                details=f"黑名单号码: {reason}"
            )
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="非黑名单号码"
        )


class UserRejectionRule(BaseRule):
    name = "user_rejection"
    description = "用户拒呼历史校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        normalized_phone = PhoneValidator.normalize(lead.phone)
        history = storage.get_call_history(normalized_phone)
        
        for record in history:
            if record.result == CallResult.REJECTED:
                return RuleCheckResult(
                    passed=False,
                    status=LeadStatus.BLOCKED,
                    block_reason=BlockReason.USER_REJECTED,
                    details=f"用户拒呼历史: {record.call_time.strftime('%Y-%m-%d %H:%M')}"
                )
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="无拒呼历史"
        )


class DuplicateRule(BaseRule):
    name = "duplicate"
    description = "重复号码校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        normalized_phone = PhoneValidator.normalize(lead.phone)
        existing = storage.get_leads_by_phone(normalized_phone)
        
        other_leads = [l for l in existing if l.id != lead.id]
        
        if other_leads:
            primary_lead = max(other_leads, key=lambda x: x.created_at)
            if primary_lead.status in [LeadStatus.CALLABLE, LeadStatus.PENDING, LeadStatus.MANUAL_RELEASED]:
                return RuleCheckResult(
                    passed=False,
                    status=LeadStatus.BLOCKED,
                    block_reason=BlockReason.DUPLICATE,
                    details=f"重复号码: 已有活跃线索 {primary_lead.name} ({primary_lead.type})"
                )
            elif primary_lead.status == LeadStatus.CONNECTED:
                return RuleCheckResult(
                    passed=False,
                    status=LeadStatus.BLOCKED,
                    block_reason=BlockReason.DUPLICATE,
                    details=f"重复号码: 已有已接通线索 {primary_lead.name} ({primary_lead.type})"
                )
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="无重复号码"
        )


class CallbackPriorityRule(BaseRule):
    name = "callback_priority"
    description = "预约回拨优先"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        normalized_phone = PhoneValidator.normalize(lead.phone)
        callbacks = storage.get_active_callbacks(normalized_phone)
        
        if callbacks:
            latest = max(callbacks, key=lambda x: x.scheduled_time)
            now = datetime.now()
            
            if latest.scheduled_time <= now:
                return RuleCheckResult(
                    passed=True,
                    status=LeadStatus.CALLABLE,
                    block_reason=None,
                    details=f"预约回拨到期: 优先处理 ({latest.scheduled_time.strftime('%Y-%m-%d %H:%M')})",
                    callback_info={
                        "callback_id": latest.id,
                        "scheduled_time": latest.scheduled_time,
                        "reason": latest.reason,
                        "created_by": latest.created_by
                    }
                )
            else:
                return RuleCheckResult(
                    passed=False,
                    status=LeadStatus.DEFERRED,
                    block_reason=BlockReason.INVALID_CALLBACK,
                    details=f"预约回拨未到期: 等待 {latest.scheduled_time.strftime('%Y-%m-%d %H:%M')}",
                    callback_info={
                        "callback_id": latest.id,
                        "scheduled_time": latest.scheduled_time,
                        "reason": latest.reason,
                        "created_by": latest.created_by
                    }
                )
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="无预约回拨"
        )


class TimezoneRuleEngine(BaseRule):
    name = "timezone"
    description = "时区规则校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        rule = storage.get_timezone_rule(lead.region)
        
        if not rule:
            return RuleCheckResult(
                passed=True,
                status=LeadStatus.PENDING,
                block_reason=None,
                details=f"无时区规则: {lead.region}"
            )
        
        try:
            import pytz
            now = datetime.now()
            tz = pytz.timezone(rule.timezone)
            local_time = now.astimezone(tz)
            local_hour = local_time.hour
            
            if rule.call_window_start <= local_hour < rule.call_window_end:
                return RuleCheckResult(
                    passed=True,
                    status=LeadStatus.PENDING,
                    block_reason=None,
                    details=f"符合通话时段: {local_time.strftime('%H:%M')} ({rule.timezone})"
                )
            else:
                return RuleCheckResult(
                    passed=False,
                    status=LeadStatus.DEFERRED,
                    block_reason=BlockReason.WRONG_TIMEZONE,
                    details=f"跨时区不可打: 当地时间 {local_time.strftime('%H:%M')}，允许时段 {rule.call_window_start}:00-{rule.call_window_end}:00"
                )
        except Exception as e:
            return RuleCheckResult(
                passed=True,
                status=LeadStatus.PENDING,
                block_reason=None,
                details=f"时区检查异常: {str(e)}"
            )


class ComplianceRuleEngine(BaseRule):
    name = "compliance"
    description = "合规规则校验"

    def check(self, lead: Lead, storage: Storage) -> RuleCheckResult:
        rules = storage.get_compliance_rules()
        
        for rule in rules:
            if rule.phone_pattern:
                if re.search(rule.phone_pattern, lead.phone):
                    now = datetime.now()
                    if not (rule.time_window_start <= now.hour < rule.time_window_end):
                        return RuleCheckResult(
                            passed=False,
                            status=LeadStatus.DEFERRED,
                            block_reason=BlockReason.COMPLIANCE,
                            details=f"合规限制: {rule.name} - {rule.description}"
                        )
        
        return RuleCheckResult(
            passed=True,
            status=LeadStatus.PENDING,
            block_reason=None,
            details="符合合规规则"
        )


class CleaningEngine:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.rules = [
            PhoneFormatRule(),
            BlacklistRule(),
            UserRejectionRule(),
            DuplicateRule(),
            CallbackPriorityRule(),
            TimezoneRuleEngine(),
            ComplianceRuleEngine(),
        ]

    def clean_single(self, lead: Lead) -> Dict[str, Any]:
        original_status = lead.status.value
        original_block_reason = lead.block_reason.value if lead.block_reason else None
        final_status = LeadStatus.CALLABLE
        final_block_reason = None
        final_details = []
        callback_info = None
        
        for rule in self.rules:
            result = rule.check(lead, self.storage)
            final_details.append(f"[{rule.name}] {result.details}")
            
            if result.callback_info:
                callback_info = result.callback_info
            
            if result.status == LeadStatus.BLOCKED:
                final_status = LeadStatus.BLOCKED
                final_block_reason = result.block_reason
                break
            elif result.status == LeadStatus.DEFERRED and final_status != LeadStatus.BLOCKED:
                final_status = LeadStatus.DEFERRED
                final_block_reason = result.block_reason
            elif result.status == LeadStatus.CALLABLE and final_status == LeadStatus.PENDING:
                final_status = LeadStatus.CALLABLE
        
        lead.status = final_status
        lead.block_reason = final_block_reason
        self.storage.save_lead(lead)
        
        status_changed = original_status != final_status.value
        reason_changed = original_block_reason != (final_block_reason.value if final_block_reason else None)
        
        if status_changed or reason_changed:
            self.storage.log_operation(
                operation_type="status_update",
                target_id=lead.id,
                target_type="lead",
                operator="system",
                previous_state=f"{original_status}/{original_block_reason}",
                new_state=f"{final_status.value}/{final_block_reason.value if final_block_reason else None}",
                reason=" | ".join(final_details)
            )
        
        return {
            "lead_id": lead.id,
            "phone": lead.phone,
            "name": lead.name,
            "type": lead.type,
            "status": final_status.value,
            "block_reason": final_block_reason.value if final_block_reason else None,
            "callback_info": callback_info,
            "details": final_details,
            "is_callable": final_status == LeadStatus.CALLABLE or final_status == LeadStatus.MANUAL_RELEASED
        }

    def clean_all(self) -> Dict[str, Any]:
        all_leads = self.storage.get_all_leads()
        results = []
        callable_leads = []
        deferred_leads = []
        blocked_leads = []
        
        for lead in all_leads:
            if lead.status in [LeadStatus.CONNECTED, LeadStatus.MANUAL_RELEASED]:
                continue
            
            result = self.clean_single(lead)
            results.append(result)
            
            if result["status"] == LeadStatus.CALLABLE.value:
                callable_leads.append(result)
            elif result["status"] == LeadStatus.DEFERRED.value:
                deferred_leads.append(result)
            elif result["status"] == LeadStatus.BLOCKED.value:
                blocked_leads.append(result)
        
        self.storage.record_check_session(
            total_leads=len(all_leads),
            callable_count=len(callable_leads),
            deferred_count=len(deferred_leads),
            blocked_count=len(blocked_leads)
        )
        
        return {
            "total": len(all_leads),
            "callable": callable_leads,
            "deferred": deferred_leads,
            "blocked": blocked_leads,
            "all_results": results
        }

    def manual_release(self, lead_id: str, operator: str, reason: str) -> Dict[str, Any]:
        lead = self.storage.get_lead(lead_id)
        if not lead:
            return {"success": False, "error": "线索不存在"}
        
        original_status = lead.status.value
        original_block_reason = lead.block_reason.value if lead.block_reason else None
        
        lead.status = LeadStatus.MANUAL_RELEASED
        lead.manual_release_reason = reason
        self.storage.save_lead(lead)
        
        self.storage.log_operation(
            operation_type="manual_release",
            target_id=lead.id,
            target_type="lead",
            operator=operator,
            previous_state=f"{original_status}/{original_block_reason}",
            new_state=f"{LeadStatus.MANUAL_RELEASED.value}/{reason}",
            reason=reason
        )
        
        return {
            "success": True,
            "lead_id": lead_id,
            "phone": lead.phone,
            "previous_status": original_status,
            "previous_block_reason": original_block_reason,
            "new_status": LeadStatus.MANUAL_RELEASED.value,
            "operator": operator,
            "release_reason": reason
        }
