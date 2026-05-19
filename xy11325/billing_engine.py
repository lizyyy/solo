from datetime import datetime, date
from typing import Optional, Tuple, List
from models import (
    WorkRecord, ProcessedRecord, BillingRules,
    RecordStatus, ExceptionType, BillingType
)
import uuid


class BillingEngine:
    def __init__(self, rules: BillingRules = None):
        self.rules = rules or BillingRules()
        self._processed_records: List[ProcessedRecord] = []
        self._record_no_index: set = set()

    def calculate_amount(self, record: WorkRecord) -> float:
        amount = 0.0
        if record.billing_type == BillingType.HOUR:
            if record.work_hours and record.hourly_rate:
                amount = record.work_hours * record.hourly_rate
        elif record.billing_type == BillingType.AREA:
            if record.work_area and record.area_rate:
                amount = record.work_area * record.area_rate
        elif record.billing_type == BillingType.FUEL:
            if record.fuel_consumption and record.fuel_rate:
                amount = record.fuel_consumption * record.fuel_rate
        elif record.billing_type == BillingType.MIXED:
            if record.work_hours and record.hourly_rate:
                amount += record.work_hours * record.hourly_rate
            if record.work_area and record.area_rate:
                amount += record.work_area * record.area_rate
            if record.fuel_consumption and record.fuel_rate:
                amount += record.fuel_consumption * record.fuel_rate
        return round(amount, 2)

    def check_cross_day(self, record: WorkRecord) -> Tuple[bool, Optional[str]]:
        if not self.rules.cross_day_enabled:
            return False, None
        if record.start_time and record.end_time:
            if record.start_time.date() != record.end_time.date():
                return True, "作业跨天，请确认起止时间"
        return False, None

    def check_minimum_charge(self, amount: float) -> Tuple[bool, Optional[str]]:
        if amount < self.rules.minimum_charge:
            return True, f"金额 {amount} 低于最低收费 {self.rules.minimum_charge}"
        return False, None

    def check_duplicate(self, record: WorkRecord) -> Tuple[bool, Optional[str]]:
        if not self.rules.duplicate_check_enabled:
            return False, None
        if record.record_no in self._record_no_index:
            return True, f"记录编号 {record.record_no} 已存在"
        return False, None

    def check_bad_row(self, record: WorkRecord) -> Tuple[bool, Optional[str]]:
        if not self.rules.bad_row_isolation_enabled:
            return False, None
        missing_fields = []
        if not record.tractor_no:
            missing_fields.append("拖拉机号")
        if not record.operator:
            missing_fields.append("机手")
        if record.billing_type == BillingType.HOUR:
            if record.work_hours is None:
                missing_fields.append("工时")
            if record.hourly_rate is None:
                missing_fields.append("小时单价")
        elif record.billing_type == BillingType.AREA:
            if record.work_area is None:
                missing_fields.append("亩数")
            if record.area_rate is None:
                missing_fields.append("亩单价")
        elif record.billing_type == BillingType.FUEL:
            if record.fuel_consumption is None:
                missing_fields.append("油耗")
            if record.fuel_rate is None:
                missing_fields.append("油价")
        if missing_fields:
            return True, f"缺少必填字段: {', '.join(missing_fields)}"
        return False, None

    def process_record(self, record: WorkRecord) -> ProcessedRecord:
        record_id = record.id or str(uuid.uuid4())
        amount = self.calculate_amount(record)
        is_cross_day, cross_day_reason = self.check_cross_day(record)
        is_duplicate, duplicate_reason = self.check_duplicate(record)
        is_bad_row, bad_row_reason = self.check_bad_row(record)
        is_below_min, min_reason = self.check_minimum_charge(amount)
        status = RecordStatus.APPROVED
        exception_type = None
        exception_reasons = []
        if is_bad_row:
            status = RecordStatus.REJECTED
            exception_type = ExceptionType.BAD_ROW
            exception_reasons.append(bad_row_reason)
        elif is_duplicate:
            status = RecordStatus.REJECTED
            exception_type = ExceptionType.DUPLICATE
            exception_reasons.append(duplicate_reason)
        else:
            if is_cross_day:
                exception_type = ExceptionType.CROSS_DAY
                exception_reasons.append(cross_day_reason)
            if is_below_min:
                exception_type = ExceptionType.BELOW_MINIMUM
                exception_reasons.append(min_reason)
                amount = self.rules.minimum_charge
        if not exception_reasons:
            exception_reason = "记录正常，已放行"
        else:
            exception_reason = "; ".join(exception_reasons)
            if status == RecordStatus.APPROVED:
                exception_reason += "，已按规则处理"
        processed = ProcessedRecord(
            id=record_id,
            **record.model_dump(exclude={"id"}),
            status=status,
            amount=amount,
            exception_type=exception_type,
            exception_reason=exception_reason,
            is_cross_day=is_cross_day,
        )
        if status != RecordStatus.REJECTED:
            self._processed_records.append(processed)
            self._record_no_index.add(record.record_no)
        return processed

    def get_processed_records(self) -> List[ProcessedRecord]:
        return self._processed_records
