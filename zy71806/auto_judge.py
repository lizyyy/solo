from datetime import datetime
from typing import Optional
from models import SaleFeeRecord, RecordStatus, AutoJudgement
from utils import is_close


class AutoJudge:
    def __init__(self):
        self.rules = [
            self.rule_zero_tail_diff,
            self.rule_small_tail_diff_within_tolerance,
            self.rule_negative_tail_diff,
            self.rule_large_tail_diff,
        ]

    def judge(self, record: SaleFeeRecord) -> AutoJudgement:
        for rule in self.rules:
            result = rule(record)
            if result:
                judgement, reason, confidence = result
                auto_judgement = AutoJudgement(
                    judged_at=datetime.now(),
                    judgement=judgement,
                    reason=reason,
                    rule_applied=rule.__name__,
                    confidence=confidence
                )
                record.auto_judgement = auto_judgement
                
                if judgement == "自动通过":
                    record.status = RecordStatus.AUTO_APPROVED
                elif judgement == "自动拒绝":
                    record.status = RecordStatus.AUTO_REJECTED
                else:
                    record.status = RecordStatus.MANUAL_REVIEW
                
                record.updated_at = datetime.now()
                return auto_judgement
        
        return AutoJudgement(
            judged_at=datetime.now(),
            judgement="需人工复核",
            reason="无匹配规则，默认进入人工复核",
            rule_applied="default_review",
            confidence=0.0
        )

    @staticmethod
    def rule_zero_tail_diff(record: SaleFeeRecord) -> Optional[tuple]:
        if is_close(record.tail_diff, 0.0, tolerance=0.01):
            return (
                "自动通过",
                f"尾差为{record.tail_diff}元，在0.01元容差范围内，符合自动通过。"
                f"【计算依据：预期费用{record.expected_fee}元 - 实际费用{record.actual_fee}元 = 尾差{record.tail_diff}元",
                0.99
            )
        return None

    @staticmethod
    def rule_small_tail_diff_within_tolerance(record: SaleFeeRecord) -> Optional[tuple]:
        if 0.01 < abs(record.tail_diff) <= 1.00:
            return (
                "自动通过",
                f"尾差为{record.tail_diff}元，在1.00元容差范围内，符合自动通过。"
                f"尾差小于1元属于系统正常尾差范围。"
                f"【计算依据：预期费用{record.expected_fee}元 - 实际费用{record.actual_fee}元 = 尾差{record.tail_diff}元",
                0.95
            )
        return None

    @staticmethod
    def rule_negative_tail_diff(record: SaleFeeRecord) -> Optional[tuple]:
        if record.tail_diff < -1.00:
            return (
                "需人工复核",
                f"尾差为{record.tail_diff}元，实际费用超出预期费用超过1元，需人工复核。"
                f"【风险提示】实际费用高于预期，可能存在费用计算错误或业务变更。"
                f"【计算依据】预期费用{record.expected_fee}元 - 实际费用{record.actual_fee}元 = 尾差{record.tail_diff}元",
                0.80
            )
        return None

    @staticmethod
    def rule_large_tail_diff(record: SaleFeeRecord) -> Optional[tuple]:
        if record.tail_diff > 100.00:
            return (
                "需人工复核",
                f"尾差为{record.tail_diff}元，尾差超过100元，需人工复核。"
                f"【风险提示】大额尾差可能涉及重大业务异常，请核查。"
                f"【计算依据】预期费用{record.expected_fee}元 - 实际费用{record.actual_fee}元 = 尾差{record.tail_diff}元",
                0.90
            )
        return None

    def apply_judgement_with_reason(self, record: SaleFeeRecord, judgement: str, reason: str,
                                  rule_applied: str, confidence: float,
                                  next_step: str) -> AutoJudgement:
        auto_judgement = AutoJudgement(
            judged_at=datetime.now(),
            judgement=judgement,
            reason=reason,
            rule_applied=rule_applied,
            confidence=confidence
        )
        record.auto_judgement = auto_judgement
        record.review_reason = reason
        record.next_step = next_step
        
        if judgement == "自动通过":
            record.status = RecordStatus.AUTO_APPROVED
        elif judgement == "自动拒绝":
            record.status = RecordStatus.AUTO_REJECTED
        else:
            record.status = RecordStatus.MANUAL_REVIEW
        
        record.updated_at = datetime.now()
        return auto_judgement
