from datetime import datetime
from typing import List, Set, Optional, Dict
from collections import defaultdict

from .models import (
    SuppressionRule,
    ReviewStatus,
    ProcessedData,
    ReviewResult,
)


class RuleEngine:
    def __init__(
        self,
        warning_days: int = 7,
        critical_days: int = 3,
    ):
        self.warning_days = warning_days
        self.critical_days = critical_days
        self.processed_rule_ids: Set[str] = set()
        self.reviewer_stats: Dict[str, int] = defaultdict(int)

    def process_rules(
        self,
        processed_data: ProcessedData,
        reviewer: str = "system",
        check_time: Optional[datetime] = None,
    ) -> ProcessedData:
        check_time = check_time or datetime.now()
        sorted_rules = sorted(processed_data.valid_rules, key=lambda r: r.rule_id)

        for rule in sorted_rules:
            if rule.rule_id in self.processed_rule_ids:
                continue

            result = self._process_single_rule(rule, reviewer, check_time)
            if result:
                processed_data.review_results.append(result)

            self.processed_rule_ids.add(rule.rule_id)
            if result:
                self.reviewer_stats[result.reviewer] += 1

        processed_data.valid_rules = sorted_rules
        return processed_data

    def _process_single_rule(
        self,
        rule: SuppressionRule,
        reviewer: str,
        check_time: datetime,
    ) -> Optional[ReviewResult]:
        original_status = rule.review_status
        risk_flags = []

        new_status, flags = self._determine_status(rule, check_time)
        risk_flags.extend(flags)

        if new_status != original_status:
            rule.review_status = new_status
            if new_status in [ReviewStatus.EXPIRED, ReviewStatus.NEEDS_REVIEW]:
                rule.reviewed_at = check_time
                rule.reviewer = reviewer

            return ReviewResult(
                rule_id=rule.rule_id,
                original_status=original_status,
                new_status=new_status,
                reviewer=reviewer,
                review_comment=self._get_review_comment(new_status, flags),
                reviewed_at=check_time,
                risk_flags=risk_flags,
            )
        elif risk_flags:
            return ReviewResult(
                rule_id=rule.rule_id,
                original_status=original_status,
                new_status=new_status,
                reviewer=reviewer,
                review_comment="风险标识更新",
                reviewed_at=check_time,
                risk_flags=risk_flags,
            )

        return None

    def _determine_status(
        self, rule: SuppressionRule, check_time: datetime
    ) -> tuple:
        risk_flags = []

        if rule.is_expired(check_time):
            risk_flags.append("已过期")
            return ReviewStatus.EXPIRED, risk_flags

        days = rule.days_until_expiry(check_time)
        if days <= self.critical_days:
            risk_flags.append(f"即将过期({days}天)")
            return ReviewStatus.NEEDS_REVIEW, risk_flags

        if days <= self.warning_days:
            risk_flags.append(f"临近过期({days}天)")

        if not rule.reviewer and rule.review_status == ReviewStatus.PENDING:
            risk_flags.append("未分配复核人")

        if len(rule.samples) == 0:
            risk_flags.append("无证据样本")

        if len(rule.reason) < 10:
            risk_flags.append("压制理由过短")

        return rule.review_status, risk_flags

    def _get_review_comment(self, status: ReviewStatus, flags: List[str]) -> str:
        if status == ReviewStatus.EXPIRED:
            return "压制规则已过期，需重新评估"
        elif status == ReviewStatus.NEEDS_REVIEW:
            return f"规则需要立即复核: {', '.join(flags)}"
        else:
            return f"风险检查: {', '.join(flags)}" if flags else ""

    def get_statistics(self) -> Dict[str, int]:
        return dict(self.reviewer_stats)
