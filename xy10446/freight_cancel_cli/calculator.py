"""费用计算引擎"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from .models import (
    Booking, CancellationRecord, CancellationStatus, CancellationType,
    CustomerLevel, ScheduleRule
)
from .datastore import DataStore


class CalculationResult:
    def __init__(self):
        self.is_free: bool = False
        self.is_charged: bool = False
        self.is_compensation: bool = False
        self.original_fee: float = 0.0
        self.charged_fee: float = 0.0
        self.status: CancellationStatus = CancellationStatus.FREE
        self.reason: str = ""
        self.details: Dict[str, Any] = {}


class FeeCalculator:
    def __init__(self, store: DataStore):
        self.store = store

    def calculate(self, record: CancellationRecord) -> CalculationResult:
        result = CalculationResult()
        
        booking = self.store.get_booking(record.booking_no)
        if not booking:
            result.status = CancellationStatus.EXCEPTION
            result.reason = "订舱记录不存在"
            return result

        schedule = self.store.get_schedule_rule(booking.vessel_name, booking.voyage_no)
        if not schedule:
            result.status = CancellationStatus.EXCEPTION
            result.reason = "船期规则不存在"
            return result

        result.details = {
            "booking_no": record.booking_no,
            "vessel": f"{booking.vessel_name} {booking.voyage_no}",
            "etd": schedule.etd,
            "cutoff_time": schedule.cutoff_time,
            "cancellation_time": record.cancellation_time,
            "customer_level": booking.customer_level.value,
            "container_qty": booking.container_qty,
            "freight_rate": booking.freight_rate,
        }

        if record.cancellation_type == CancellationType.CHANGE:
            return self._calculate_change(record, booking, schedule, result)
        else:
            return self._calculate_cancel(record, booking, schedule, result)

    def _calculate_cancel(self, record: CancellationRecord, 
                          booking: Booking, schedule: ScheduleRule,
                          result: CalculationResult) -> CalculationResult:
        
        hours_to_cutoff = (schedule.cutoff_time - record.cancellation_time).total_seconds() / 3600
        result.details["hours_to_cutoff"] = hours_to_cutoff

        free_cancel_threshold = schedule.free_cancel_hours
        extra_free_hours = self._get_free_hours_bonus(booking.customer_level)
        total_free_hours = free_cancel_threshold + extra_free_hours
        result.details["base_free_hours"] = free_cancel_threshold
        result.details["bonus_free_hours"] = extra_free_hours
        result.details["total_free_hours"] = total_free_hours

        if hours_to_cutoff >= total_free_hours:
            result.is_free = True
            result.status = CancellationStatus.FREE
            result.reason = f"截关前{total_free_hours}小时以上取消，享受免费取消"
            return result

        result.is_charged = True
        
        base_fee = booking.container_qty * booking.freight_rate
        charge_percent = schedule.charge_rate
        
        result.original_fee = base_fee * charge_percent
        result.charged_fee = result.original_fee
        result.details["base_fee"] = base_fee
        result.details["charge_rate"] = charge_percent

        if hours_to_cutoff < 0:
            result.is_compensation = True
            result.status = CancellationStatus.COMPENSATION
            compensation_fee = base_fee * schedule.compensation_rate
            result.original_fee += compensation_fee
            result.charged_fee = result.original_fee
            result.details["compensation_rate"] = schedule.compensation_rate
            result.details["compensation_fee"] = compensation_fee
            result.reason = f"截关后取消，需收取消费{result.original_fee:.2f}元（含赔付）"
        else:
            result.status = CancellationStatus.CHARGED
            result.reason = f"截关前{hours_to_cutoff:.1f}小时取消，需收取消费{result.original_fee:.2f}元"

        return result

    def _calculate_change(self, record: CancellationRecord,
                          booking: Booking, schedule: ScheduleRule,
                          result: CalculationResult) -> CalculationResult:
        
        result.details["change_type"] = "改船"
        result.details["original_vessel_released"] = record.original_vessel_released

        if not record.original_vessel_released:
            result.status = CancellationStatus.EXCEPTION
            result.reason = "改船后原舱位未释放"
            return result

        hours_to_cutoff = (schedule.cutoff_time - record.cancellation_time).total_seconds() / 3600
        result.details["hours_to_cutoff"] = hours_to_cutoff

        change_free_threshold = 72
        if booking.customer_level in [CustomerLevel.VIP, CustomerLevel.GOLD]:
            change_free_threshold = 96

        result.details["change_free_threshold"] = change_free_threshold

        if hours_to_cutoff >= change_free_threshold:
            result.is_free = True
            result.status = CancellationStatus.FREE
            result.reason = f"截关前{change_free_threshold}小时以上改船，免费"
            return result

        result.is_charged = True
        base_fee = booking.container_qty * booking.freight_rate
        change_charge_rate = schedule.charge_rate * 0.5
        result.original_fee = base_fee * change_charge_rate
        result.charged_fee = result.original_fee
        result.details["base_fee"] = base_fee
        result.details["change_charge_rate"] = change_charge_rate
        result.status = CancellationStatus.CHARGED
        result.reason = f"截关前{hours_to_cutoff:.1f}小时改船，需收取改船费{result.original_fee:.2f}元"

        return result

    def _get_free_hours_bonus(self, level: CustomerLevel) -> int:
        bonus_map = {
            CustomerLevel.VIP: 24,
            CustomerLevel.GOLD: 12,
            CustomerLevel.SILVER: 6,
            CustomerLevel.NORMAL: 0,
        }
        return bonus_map.get(level, 0)
