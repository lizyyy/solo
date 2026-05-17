from datetime import datetime, timedelta
from typing import List, Tuple
from ..models import CustomerRecord, RentRule, CalculationResult


class RentCalculator:
    def __init__(self, rule: RentRule):
        self.rule = rule

    def calculate_checkout_truncation(
        self, record: CustomerRecord
    ) -> Tuple[int, List[str]]:
        warnings = []
        truncated_days = 0

        if record.is_checked_out and record.checkout_date:
            checkout_hour = record.checkout_date.hour

            if checkout_hour < self.rule.checkout_truncation_hours:
                truncated_days = 1
                warnings.append(
                    f"退仓时间{checkout_hour}:00早于截断时间{self.rule.checkout_truncation_hours}:00，减免1天"
                )
            else:
                warnings.append(
                    f"退仓时间{checkout_hour}:00晚于截断时间{self.rule.checkout_truncation_hours}:00，正常计费"
                )

        return truncated_days, warnings

    def calculate_free_rent_deduction(
        self, effective_days: int, agreed_free_days: int
    ) -> Tuple[int, List[str]]:
        warnings = []

        if agreed_free_days > effective_days:
            applied_free_days = effective_days
            warnings.append(
                f"约定免租{agreed_free_days}天超过实际占用{effective_days}天，仅减免{effective_days}天"
            )
        else:
            applied_free_days = agreed_free_days
            if agreed_free_days > 0:
                warnings.append(f"正常减免免租期{agreed_free_days}天")

        return applied_free_days, warnings

    def calculate_single(self, record: CustomerRecord) -> CalculationResult:
        warnings = []

        truncated_days, truncation_warnings = self.calculate_checkout_truncation(record)
        warnings.extend(truncation_warnings)

        effective_occupancy_days = record.occupancy_days - truncated_days

        free_rent_applied, free_rent_warnings = self.calculate_free_rent_deduction(
            effective_occupancy_days, record.free_rent_days
        )
        warnings.extend(free_rent_warnings)

        billable_days = max(0, effective_occupancy_days - free_rent_applied)

        if billable_days == 0 and effective_occupancy_days > 0:
            warnings.append("计费天数为0，全部被免租覆盖")

        volume_tier_price = self.rule.get_volume_price(record.volume)
        days_discount_rate = self.rule.get_days_discount(effective_occupancy_days)

        daily_rate = volume_tier_price * days_discount_rate
        base_amount = record.volume * volume_tier_price * billable_days
        discount_amount = base_amount * (1 - days_discount_rate)
        final_amount = base_amount * days_discount_rate

        calculation_details = {
            "volume_tier_matching": f"体积{record.volume}m³匹配单价{volume_tier_price}元/m³/天",
            "days_tier_matching": f"天数{effective_occupancy_days}天匹配折扣率{days_discount_rate*100}%",
            "truncation_logic": f"原始天数{record.occupancy_days}天，退仓截断减免{truncated_days}天",
            "free_rent_logic": f"有效天数{effective_occupancy_days}天，免租减免{free_rent_applied}天",
            "final_billable_days": f"最终计费天数{billable_days}天",
        }

        return CalculationResult(
            customer_id=record.customer_id,
            customer_name=record.customer_name,
            warehouse_location=record.warehouse_location,
            volume=record.volume,
            raw_occupancy_days=record.occupancy_days,
            checkout_truncated_days=truncated_days,
            effective_occupancy_days=effective_occupancy_days,
            free_rent_days_applied=free_rent_applied,
            billable_days=billable_days,
            volume_tier_price=volume_tier_price,
            days_discount_rate=days_discount_rate,
            daily_rate=round(daily_rate, 4),
            base_amount=round(base_amount, 2),
            discount_amount=round(discount_amount, 2),
            final_amount=round(final_amount, 2),
            calculation_details=calculation_details,
            warnings=warnings,
        )

    def calculate_batch(
        self, records: List[CustomerRecord]
    ) -> List[CalculationResult]:
        return [self.calculate_single(record) for record in records]
