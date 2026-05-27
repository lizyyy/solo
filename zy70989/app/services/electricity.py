from typing import List, Tuple
from app.models import ElectricityTier


def calculate_electricity_cost(usage_kwh: float, tiers: List[ElectricityTier]) -> Tuple[float, str]:
    if usage_kwh < 0:
        return 0.0, "用电量为负数，数据异常"
    
    total_cost = 0.0
    remaining_kwh = usage_kwh
    breakdown = []
    
    for tier in sorted(tiers, key=lambda t: t.min_kwh):
        if remaining_kwh <= 0:
            break
            
        tier_min = tier.min_kwh
        tier_max = tier.max_kwh if tier.max_kwh is not None else float('inf')
        tier_span = tier_max - tier_min
        
        if usage_kwh <= tier_min:
            continue
            
        applicable_kwh = min(remaining_kwh, tier_span)
        tier_cost = applicable_kwh * tier.price_per_kwh
        total_cost += tier_cost
        breakdown.append(f"{tier_min}-{tier_max if tier_max != float('inf') else '∞'}度: {applicable_kwh:.2f}度 × {tier.price_per_kwh:.2f}元/度 = {tier_cost:.2f}元")
        remaining_kwh -= applicable_kwh
    
    rule_detail = f"阶梯电价计算: {usage_kwh:.2f}度, 明细: {'; '.join(breakdown)}"
    return round(total_cost, 2), rule_detail


def validate_meter_reading(start: float, end: float) -> Tuple[bool, str]:
    if end < start:
        return False, f"抄表异常: 结束读数({end})小于起始读数({start})"
    if start < 0 or end < 0:
        return False, "抄表读数不能为负数"
    usage = end - start
    if usage > 5000:
        return False, f"用电量({usage:.2f}度)超出合理范围，需人工确认"
    return True, "正常"
