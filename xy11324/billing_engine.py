from datetime import datetime, timedelta
from typing import Tuple, List, Dict, Any
from models import WorkOrder, BillingType

class BillingResult:
    def __init__(self):
        self.hourly_amount = 0.0
        self.area_amount = 0.0
        self.fuel_amount = 0.0
        self.subtotal = 0.0
        self.final_amount = 0.0
        self.cross_day_adjustment = 0.0
        self.minimum_charge_applied = False
        self.details = []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hourly_amount": self.hourly_amount,
            "area_amount": self.area_amount,
            "fuel_amount": self.fuel_amount,
            "subtotal": self.subtotal,
            "final_amount": self.final_amount,
            "cross_day_adjustment": self.cross_day_adjustment,
            "minimum_charge_applied": self.minimum_charge_applied,
            "details": self.details
        }

class BillingEngine:
    @staticmethod
    def calculate_hours(start_time: datetime, end_time: datetime) -> Tuple[float, List[Dict[str, Any]]]:
        if not end_time or not start_time:
            return 0.0, []
        
        delta = end_time - start_time
        total_hours = delta.total_seconds() / 3600.0
        
        days_info = []
        current = start_time
        while current < end_time:
            day_end = datetime(current.year, current.month, current.day, 23, 59, 59)
            if day_end > end_time:
                day_end = end_time
            day_hours = (day_end - current).total_seconds() / 3600.0
            days_info.append({
                "date": current.date().isoformat(),
                "hours": round(day_hours, 2)
            })
            current = day_end + timedelta(seconds=1)
            if current.hour == 0 and current.minute == 0 and current.second == 1:
                current = datetime(current.year, current.month, current.day)
        
        return round(total_hours, 2), days_info
    
    @staticmethod
    def detect_cross_day(start_time: datetime, end_time: datetime) -> Tuple[bool, int]:
        if not start_time or not end_time:
            return False, 0
        days_diff = (end_time.date() - start_time.date()).days
        return days_diff > 0, days_diff
    
    @classmethod
    def calculate_work_order(cls, work_order: WorkOrder) -> BillingResult:
        result = BillingResult()
        
        actual_hours, days_info = cls.calculate_hours(
            work_order.start_time, work_order.end_time
        )
        work_order.work_hours = actual_hours
        
        is_cross_day, days_count = cls.detect_cross_day(
            work_order.start_time, work_order.end_time
        )
        
        billing_type = work_order.billing_type or BillingType.MIXED
        
        if billing_type in [BillingType.BY_HOUR, BillingType.MIXED]:
            if actual_hours > 0 and work_order.hourly_rate > 0:
                result.hourly_amount = round(actual_hours * work_order.hourly_rate, 2)
                result.details.append(f"计时费用: {actual_hours}小时 × {work_order.hourly_rate}元/小时 = {result.hourly_amount}元")
        
        if billing_type in [BillingType.BY_AREA, BillingType.MIXED]:
            if work_order.work_area > 0 and work_order.area_rate > 0:
                result.area_amount = round(work_order.work_area * work_order.area_rate, 2)
                result.details.append(f"计亩费用: {work_order.work_area}亩 × {work_order.area_rate}元/亩 = {result.area_amount}元")
        
        if work_order.fuel_used > 0 and work_order.fuel_price > 0:
            result.fuel_amount = round(work_order.fuel_used * work_order.fuel_price, 2)
            result.details.append(f"油费: {work_order.fuel_used}升 × {work_order.fuel_price}元/升 = {result.fuel_amount}元")
        
        result.subtotal = round(result.hourly_amount + result.area_amount + result.fuel_amount, 2)
        result.details.append(f"小计: {result.subtotal}元")
        
        if is_cross_day:
            result.details.append(f"注意: 跨天作业，共跨越 {days_count} 天")
            result.details.append(f"每日明细: {days_info}")
        
        result.final_amount = result.subtotal
        
        if work_order.minimum_charge > 0 and result.final_amount < work_order.minimum_charge:
            result.details.append(f"低于最低收费 {work_order.minimum_charge}元，按最低收费计算")
            result.final_amount = work_order.minimum_charge
            result.minimum_charge_applied = True
        
        work_order.calculated_amount = result.subtotal
        work_order.final_amount = result.final_amount
        
        return result
