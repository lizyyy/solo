from datetime import date, datetime
from typing import Tuple, Dict, Optional
from models import Policy, SignRecord, FeeRecord



class CoolingOffCalculator:
    def __init__(self, cooling_off_days: int = 15):
        self.cooling_off_days = cooling_off_days

    def calculate_cooling_off_end(self, sign_date: date) -> date:
        from datetime import timedelta
        return sign_date + timedelta(days=self.cooling_off_days)

    def days_used(self, sign_date: date, apply_date: date) -> int:
        delta = apply_date - sign_date
        return max(0, delta.days)

    def is_within_cooling_off(self, sign_date: date, apply_date: date) -> Tuple[bool, int]:
        days_used = self.days_used(sign_date, apply_date)
        return days_used <= self.cooling_off_days, days_used

    def get_cooling_off_status(self, sign_date: date, apply_date: date) -> Dict:
        is_within, days_used = self.is_within_cooling_off(sign_date, apply_date)
        cooling_off_end = self.calculate_cooling_off_end(sign_date)
        return {
            "is_within_cooling_off": is_within,
            "days_used": days_used,
            "cooling_off_days": self.cooling_off_days,
            "remaining_days": max(0, self.cooling_off_days - days_used),
            "cooling_off_end_date": cooling_off_end,
            "sign_date": sign_date,
            "apply_date": apply_date
        }


class RefundCalculator:
    def __init__(self, initial_fee_rate: float = 0.10, management_fee_rate: float = 0.05):
        self.initial_fee_rate = initial_fee_rate
        self.management_fee_rate = management_fee_rate

    def calculate_full_refund(self, total_fees_paid: float) -> Tuple[float, float, Dict[str, float]]:
        deduction_detail = {
            "工本费": 10.0,
        }
        deduction_amount = sum(deduction_detail.values())
        refund_amount = max(0, total_fees_paid - deduction_amount)
        return refund_amount, deduction_amount, deduction_detail

    def calculate_partial_refund(
        self, 
        total_fees_paid: float, 
        days_used: int, 
        cooling_off_days: int
    ) -> Tuple[float, float, Dict[str, float]]:
        if days_used <= 0:
            return self.calculate_full_refund(total_fees_paid)

        usage_ratio = min(1.0, days_used / 365.0)
        initial_fee = total_fees_paid * self.initial_fee_rate
        management_fee = total_fees_paid * self.management_fee_rate * usage_ratio
        other_fees = 10.0

        deduction_detail = {
            "初始费用": initial_fee,
            "管理费用": round(management_fee, 2),
            "工本费": other_fees,
        }
        deduction_amount = sum(deduction_detail.values())
        refund_amount = max(0, total_fees_paid - deduction_amount)

        return round(refund_amount, 2), round(deduction_amount, 2), {
            k: round(v, 2) for k, v in deduction_detail.items()
        }

    def calculate_refund(
        self,
        total_fees_paid: float,
        is_within_cooling_off: bool,
        days_used: int = 0,
        cooling_off_days: int = 15
    ) -> Dict:
        if is_within_cooling_off:
            refund_amount, deduction_amount, deduction_detail = self.calculate_full_refund(total_fees_paid)
            refund_type = "犹豫期内全额退保"
        else:
            refund_amount, deduction_amount, deduction_detail = self.calculate_partial_refund(
                total_fees_paid, days_used, cooling_off_days
            )
            refund_type = "犹豫期后退保"

        return {
            "refund_type": refund_type,
            "total_fees_paid": total_fees_paid,
            "refund_amount": refund_amount,
            "deduction_amount": deduction_amount,
            "deduction_detail": deduction_detail,
            "refund_rate": round(refund_amount / total_fees_paid * 100, 2) if total_fees_paid > 0 else 0
        }


class IdempotencyChecker:
    def __init__(self):
        self.processed_applications = set()
        self.application_versions = {}

    def check_duplicate_application(self, apply_no: str, policy_no: str) -> Tuple[bool, Optional[str]]:
        key = f"{policy_no}_{apply_no}"
        if key in self.processed_applications:
            return True, self.application_versions.get(key)
        return False, None

    def register_application(self, apply_no: str, policy_no: str, version: str = "v1"):
        key = f"{policy_no}_{apply_no}"
        self.processed_applications.add(key)
        self.application_versions[key] = version

    def check_duplicate_policy_surrender(self, policy_no: str, existing_surrenders: list) -> bool:
        return len(existing_surrenders) > 0

    def get_application_version(self, apply_no: str, policy_no: str) -> Optional[str]:
        key = f"{policy_no}_{apply_no}"
        return self.application_versions.get(key)
