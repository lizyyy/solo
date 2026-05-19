from typing import List
from datetime import datetime
from rules.base import BaseRule
from models import RuleResult, FoodSample, ExceptionType, RecordStatus


class ExpiredSampleRule(BaseRule):
    def __init__(self, db):
        super().__init__(db)
        self.rule_name = "留样过期检查"
        self.rule_code = "RULE_EXPIRED_SAMPLE"
        self.exception_type = ExceptionType.EXPIRED_SAMPLE
        self.blocked = True

    def should_apply(self, record) -> bool:
        return isinstance(record, FoodSample) and record.status != RecordStatus.ISOLATED

    def apply(self, record: FoodSample) -> List[RuleResult]:
        results = []

        if not self.should_apply(record):
            return results

        if record.is_expired:
            reason = f"留样已过期，留样时间: {record.sample_time.strftime('%Y-%m-%d %H:%M')}，已超过48小时保质期"
            details = f"菜品: {record.dish_name}, 门店ID: {record.store_id}"
            result = self._create_rule_result(record, reason, details, severity="high")
            results.append(result)

            record.status = RecordStatus.ISOLATED

        retention_hours = record.retention_hours
        if retention_hours > 0 and retention_hours < 48:
            reason = f"留样保留时间不足48小时，当前保留时间: {retention_hours:.1f}小时"
            details = f"菜品: {record.dish_name}, 预计过期时间: {record.expire_time.strftime('%Y-%m-%d %H:%M')}"
            result = self._create_rule_result(record, reason, details, severity="medium")
            results.append(result)

        return results
