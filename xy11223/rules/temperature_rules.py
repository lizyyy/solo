from typing import List
from datetime import datetime, timedelta
from sqlalchemy import and_
from rules.base import BaseRule
from models import RuleResult, TemperatureRecord, ExceptionType, RecordStatus


class TemperatureAbnormalRule(BaseRule):
    def __init__(self, db):
        super().__init__(db)
        self.rule_name = "温度异常检查"
        self.rule_code = "RULE_TEMP_ABNORMAL"
        self.blocked = False

    def should_apply(self, record) -> bool:
        return isinstance(record, TemperatureRecord)

    def apply(self, record: TemperatureRecord) -> List[RuleResult]:
        results = []

        if not self.should_apply(record):
            return results

        if record.temperature < record.min_temperature:
            self.exception_type = ExceptionType.TEMPERATURE_LOW
            reason = f"温度低于下限，当前温度: {record.temperature}°C，下限: {record.min_temperature}°C"
            details = f"偏差: {record.temperature - record.min_temperature:.1f}°C, 冰箱: {record.fridge_name or '未知'}"
            result = self._create_rule_result(record, reason, details, severity="high")
            results.append(result)

        elif record.temperature > record.max_temperature:
            self.exception_type = ExceptionType.TEMPERATURE_HIGH
            reason = f"温度高于上限，当前温度: {record.temperature}°C，上限: {record.max_temperature}°C"
            details = f"偏差: {record.temperature - record.max_temperature:.1f}°C, 冰箱: {record.fridge_name or '未知'}"
            result = self._create_rule_result(record, reason, details, severity="high")
            results.append(result)

        return results


class TemperatureGapRule(BaseRule):
    def __init__(self, db):
        super().__init__(db)
        self.rule_name = "温度缺口检查"
        self.rule_code = "RULE_TEMP_GAP"
        self.exception_type = ExceptionType.TEMPERATURE_GAP
        self.blocked = False
        self.max_gap_hours = 4

    def should_apply(self, record) -> bool:
        return isinstance(record, TemperatureRecord)

    def apply(self, record: TemperatureRecord) -> List[RuleResult]:
        results = []

        if not self.should_apply(record):
            return results

        check_start = record.record_time - timedelta(hours=self.max_gap_hours)

        prev_records = self.db.query(TemperatureRecord).filter(
            and_(
                TemperatureRecord.store_id == record.store_id,
                TemperatureRecord.fridge_id == record.fridge_id,
                TemperatureRecord.record_time < record.record_time,
                TemperatureRecord.record_time >= check_start,
                TemperatureRecord.id != record.id
            )
        ).order_by(TemperatureRecord.record_time.desc()).first()

        if not prev_records:
            check_prev_day = record.record_time - timedelta(hours=24)
            day_before_records = self.db.query(TemperatureRecord).filter(
                and_(
                    TemperatureRecord.store_id == record.store_id,
                    TemperatureRecord.fridge_id == record.fridge_id,
                    TemperatureRecord.record_time < record.record_time,
                    TemperatureRecord.record_time >= check_prev_day,
                    TemperatureRecord.id != record.id
                )
            ).order_by(TemperatureRecord.record_time.desc()).first()

            if not day_before_records:
                gap_hours = (record.record_time - check_prev_day).total_seconds() / 3600
                reason = f"超过{self.max_gap_hours}小时无温度记录，当前缺口: {gap_hours:.1f}小时"
                details = f"冰箱: {record.fridge_name or record.fridge_id or '未知'}, 检查时间: {record.record_time.strftime('%Y-%m-%d %H:%M')}"
                result = self._create_rule_result(record, reason, details, severity="medium")
                results.append(result)

        return results
