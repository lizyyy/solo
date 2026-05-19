from typing import List, Tuple
from schemas import DNSRecordDiffCreate, TTLRiskAssessment


class TTLRiskEvaluator:
    HIGH_RISK_THRESHOLD = 3600
    MEDIUM_RISK_THRESHOLD = 1800

    @classmethod
    def evaluate_record(cls, record: DNSRecordDiffCreate) -> TTLRiskAssessment:
        is_risky = False
        risk_reason = ""
        recommended_action = ""

        if record.old_ttl is None:
            is_risky = True
            risk_reason = "旧TTL未知，无法评估缓存残留风险"
            recommended_action = "建议先查询当前DNS记录，确认旧TTL值"
        elif record.old_ttl > cls.HIGH_RISK_THRESHOLD:
            is_risky = True
            risk_reason = f"旧TTL({record.old_ttl}秒)超过1小时，缓存残留风险高"
            recommended_action = f"建议提前至少{int(record.old_ttl/60)}分钟将TTL降至300秒"
        elif record.old_ttl > cls.MEDIUM_RISK_THRESHOLD:
            is_risky = True
            risk_reason = f"旧TTL({record.old_ttl}秒)超过30分钟，缓存残留风险中等"
            recommended_action = f"建议提前至少{int(record.old_ttl/60)}分钟将TTL降至300秒"

        if record.new_ttl > 300:
            is_risky = True
            risk_reason += f" 新TTL({record.new_ttl}秒)高于推荐值300秒"
            recommended_action += " 建议新TTL使用300秒以便快速回滚"

        if not is_risky:
            risk_reason = "TTL配置合理"
            recommended_action = "可正常执行切换"

        return TTLRiskAssessment(
            record_name=record.record_name,
            old_ttl=record.old_ttl,
            new_ttl=record.new_ttl,
            is_risky=is_risky,
            risk_reason=risk_reason.strip(),
            recommended_action=recommended_action.strip()
        )

    @classmethod
    def evaluate_batch(cls, records: List[DNSRecordDiffCreate]) -> Tuple[List[TTLRiskAssessment], str]:
        assessments = [cls.evaluate_record(r) for r in records]
        risky_count = sum(1 for a in assessments if a.is_risky)

        if risky_count == 0:
            overall_risk = "low"
        elif risky_count <= len(records) // 2:
            overall_risk = "medium"
        else:
            overall_risk = "high"

        return assessments, overall_risk


class StatusMachine:
    VALID_TRANSITIONS = {
        "draft": ["pending_audit", "closed"],
        "pending_audit": ["auditing", "closed"],
        "auditing": ["approved", "rejected", "closed"],
        "approved": ["executing", "closed"],
        "executing": ["completed", "rollback", "closed"],
        "completed": ["closed"],
        "rollback": ["rolled_back", "closed"],
        "rolled_back": ["closed"],
        "rejected": ["draft", "closed"],
        "closed": []
    }

    @classmethod
    def can_transition(cls, current_status: str, target_status: str) -> bool:
        return target_status in cls.VALID_TRANSITIONS.get(current_status, [])

    @classmethod
    def get_valid_next_statuses(cls, current_status: str) -> List[str]:
        return cls.VALID_TRANSITIONS.get(current_status, [])


class RecordDiffCalculator:
    @staticmethod
    def calculate_diff(old_value: str, new_value: str) -> str:
        if old_value == new_value:
            return "no_change"
        elif old_value is None or old_value == "":
            return "new"
        elif new_value is None or new_value == "":
            return "delete"
        else:
            return "update"

    @staticmethod
    def has_significant_change(old_value: str, new_value: str) -> bool:
        return old_value != new_value
