import uuid
from datetime import datetime, date, timedelta
from pathlib import Path
import sys
from typing import List, Optional, Dict, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.settings import HOLIDAY_CALENDAR
from src.models import (
    ForecastDataset,
    ForecastRecord,
    ConflictEvidence,
    ChangeHistory,
)


class HolidayDeferralValidator:
    def __init__(self):
        self.holiday_calendar = HOLIDAY_CALENDAR

    def _is_holiday(self, d: date) -> Tuple[bool, Optional[str]]:
        date_str = d.isoformat()
        if date_str in self.holiday_calendar:
            return True, self.holiday_calendar[date_str]
        if d.weekday() >= 5:
            weekday_names = {5: "周六", 6: "周日"}
            return True, weekday_names[d.weekday()]
        return False, None

    def _count_holidays_between(self, start: date, end: date) -> List[Tuple[date, str]]:
        holidays = []
        current = start
        while current <= end:
            is_holiday, holiday_name = self._is_holiday(current)
            if is_holiday:
                holidays.append((current, holiday_name))
            current += timedelta(days=1)
        return holidays

    def calculate_expected_arrival(self, invoice_date: date,
                                   settlement_cycle: str) -> Tuple[date, List[Tuple[date, str]]]:
        cycle_days = int(settlement_cycle.split("+")[1])
        expected_date = invoice_date + timedelta(days=cycle_days)

        holidays_affected = []
        while True:
            is_holiday, holiday_name = self._is_holiday(expected_date)
            if not is_holiday:
                break
            holidays_affected.append((expected_date, holiday_name))
            expected_date += timedelta(days=1)

        return expected_date, holidays_affected

    def validate_deferral_explanation(self, original_date: date,
                                      expected_date: date,
                                      explanation: str) -> bool:
        if expected_date <= original_date:
            return False

        holidays = self._count_holidays_between(original_date, expected_date)

        if not holidays:
            return False

        day_diff = (expected_date - original_date).days

        if day_diff > 2 and len(holidays) < day_diff:
            return False

        explanation_mentions_holiday = any(
            holiday_name in explanation
            for _, holiday_name in holidays
        )

        return explanation_mentions_holiday

    def validate_record_holiday_deferral(self, record: ForecastRecord) -> Tuple[bool, Optional[str], List[Tuple[date, str]]]:
        if not record.holiday_deferral_applies:
            return True, "未申请节假日顺延", []

        if not record.holiday_deferral_explanation:
            return False, "申请了节假日顺延但未提供说明", []

        holidays = self._count_holidays_between(
            record.original_arrival_date,
            record.expected_arrival_date
        )

        is_valid = self.validate_deferral_explanation(
            record.original_arrival_date,
            record.expected_arrival_date,
            record.holiday_deferral_explanation
        )

        if is_valid:
            return True, "节假日顺延说明有效", holidays
        else:
            return False, "节假日顺延说明与实际日期变化不符", holidays

    def detect_batch_holiday_conflicts(self, dataset: ForecastDataset) -> List[ConflictEvidence]:
        conflicts = []
        for record in dataset.records:
            if record.holiday_deferral_applies:
                is_valid, reason, holidays = self.validate_record_holiday_deferral(record)

                if not is_valid:
                    holiday_list = ", ".join([f"{d.isoformat()}({name})" for d, name in holidays])
                    conflict = ConflictEvidence(
                        conflict_id=f"conflict_{uuid.uuid4().hex[:8]}",
                        batch_id=record.batch_id,
                        record_id=record.record_id,
                        conflict_type="batch_vs_holiday_explanation",
                        evidence_description=(
                            f"清算批次号显示T+1到账被手工改为T+2，但节假日顺延说明存在矛盾：{reason}。"
                            f"涉及节假日: {holiday_list or '无'}"
                        ),
                        field_a_name="expected_arrival_date",
                        field_a_value=record.expected_arrival_date.isoformat(),
                        field_b_name="holiday_deferral_explanation",
                        field_b_value=record.holiday_deferral_explanation,
                        resolution_status="pending",
                        requires_manager_review=True,
                    )
                    conflicts.append(conflict)

        existing_conflict_ids = {c.conflict_id for c in dataset.conflicts}
        new_conflicts = [c for c in conflicts if c.conflict_id not in existing_conflict_ids]
        dataset.conflicts.extend(new_conflicts)

        return new_conflicts

    def review_holiday_deferral(self, dataset: ForecastDataset,
                                operator: str = "风控值班老秦") -> Dict:
        conflict_count = 0
        validated_count = 0

        for record in dataset.records:
            if record.holiday_deferral_applies:
                is_valid, reason, holidays = self.validate_record_holiday_deferral(record)
                validated_count += 1

                if not is_valid:
                    conflict_count += 1

                history = ChangeHistory(
                    history_id=f"hist_{uuid.uuid4().hex[:8]}",
                    record_id=record.record_id,
                    batch_id=record.batch_id,
                    field_changed="holiday_deferral_review",
                    old_value="未审核",
                    new_value="已审核" if is_valid else "审核不通过",
                    changed_by=operator,
                    change_timestamp=datetime.now(),
                    change_reason=reason,
                )

                if not any(h.record_id == record.record_id and h.field_changed == "holiday_deferral_review"
                           for h in dataset.change_history):
                    dataset.change_history.append(history)

        self.detect_batch_holiday_conflicts(dataset)

        return {
            "total_records_with_deferral": validated_count,
            "conflicts_found": conflict_count,
            "total_conflicts_in_dataset": len(dataset.conflicts),
        }

    def generate_holiday_explanation(self, invoice_date: date,
                                     cycle_days: int) -> Tuple[date, str, List[Tuple[date, str]]]:
        expected_date, holidays = self.calculate_expected_arrival(invoice_date, f"T+{cycle_days}")

        if holidays:
            holiday_desc = ", ".join([f"{d.isoformat()}({name})" for d, name in holidays])
            explanation = f"因{holiday_desc}节假日顺延，T+{cycle_days}到账日顺延至{expected_date.isoformat()}"
        else:
            explanation = f"T+{cycle_days}正常到账，无节假日顺延"

        return expected_date, explanation, holidays
