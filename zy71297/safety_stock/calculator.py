import math
from typing import List, Dict, Tuple
from datetime import date

from .models import (
    SalesRecord,
    LeadTimeRecord,
    DemandStatistics,
    LeadTimeStatistics,
    SafetyStockResult,
    SensitivityAnalysis,
    SensitivityPoint,
)


Z_SCORE_TABLE: Dict[float, float] = {
    0.50: 0.00,
    0.75: 0.67,
    0.80: 0.84,
    0.85: 1.04,
    0.90: 1.28,
    0.95: 1.64,
    0.97: 1.88,
    0.98: 2.05,
    0.99: 2.33,
    0.995: 2.58,
    0.999: 3.09,
}


def get_z_score(service_level: float) -> float:
    if service_level <= 0 or service_level >= 1:
        raise ValueError(f"Service level must be between 0 and 1, got {service_level}")
    
    closest_level = min(Z_SCORE_TABLE.keys(), key=lambda x: abs(x - service_level))
    return Z_SCORE_TABLE[closest_level]


def calculate_demand_statistics(
    sku: str,
    sales_records: List[SalesRecord],
    exclude_outliers: bool = True,
    iqr_multiplier: float = 1.5
) -> DemandStatistics:
    if not sales_records:
        raise ValueError(f"No sales records found for SKU {sku}")
    
    quantities = [r.quantity for r in sales_records if r.quantity > 0]
    
    if not quantities:
        raise ValueError(f"No valid positive demand data for SKU {sku}")
    
    if exclude_outliers and len(quantities) >= 4:
        quantities = _remove_outliers(quantities, iqr_multiplier)
    
    n = len(quantities)
    mean = sum(quantities) / n
    variance = sum((x - mean) ** 2 for x in quantities) / n
    std = math.sqrt(variance)
    cv = std / mean if mean > 0 else float('inf')
    
    return DemandStatistics(
        sku=sku,
        mean_daily_demand=mean,
        std_daily_demand=std,
        variance_daily_demand=variance,
        max_demand=max(quantities),
        min_demand=min(quantities),
        data_points=n,
        cv=cv
    )


def _remove_outliers(data: List[int], iqr_multiplier: float) -> List[int]:
    sorted_data = sorted(data)
    n = len(sorted_data)
    q1 = sorted_data[int(n * 0.25)]
    q3 = sorted_data[int(n * 0.75)]
    iqr = q3 - q1
    
    lower_bound = q1 - iqr_multiplier * iqr
    upper_bound = q3 + iqr_multiplier * iqr
    
    return [x for x in data if lower_bound <= x <= upper_bound]


def calculate_lead_time_statistics(
    sku: str,
    supplier: str,
    lead_time_records: List[LeadTimeRecord]
) -> LeadTimeStatistics:
    if not lead_time_records:
        raise ValueError(f"No lead time records found for SKU {sku}, supplier {supplier}")
    
    lead_times = [r.lead_time_days for r in lead_time_records if r.lead_time_days > 0]
    
    if not lead_times:
        raise ValueError(f"No valid lead time data for SKU {sku}, supplier {supplier}")
    
    n = len(lead_times)
    mean = sum(lead_times) / n
    variance = sum((x - mean) ** 2 for x in lead_times) / n
    std = math.sqrt(variance)
    
    return LeadTimeStatistics(
        sku=sku,
        supplier=supplier,
        mean_lead_time_days=mean,
        std_lead_time_days=std,
        min_lead_time_days=min(lead_times),
        max_lead_time_days=max(lead_times),
        data_points=n
    )


def calculate_safety_stock(
    sku: str,
    supplier: str,
    demand_stats: DemandStatistics,
    lead_time_stats: LeadTimeStatistics,
    service_level: float
) -> SafetyStockResult:
    if service_level <= 0 or service_level >= 1:
        raise ValueError(f"Service level must be between 0 and 1, got {service_level}")
    
    z = get_z_score(service_level)
    
    mean_lead_time = lead_time_stats.mean_lead_time_days
    std_lead_time = lead_time_stats.std_lead_time_days
    mean_demand = demand_stats.mean_daily_demand
    std_demand = demand_stats.std_daily_demand
    
    demand_variance_during_lead_time = mean_lead_time * (std_demand ** 2)
    lead_time_variance_impact = (std_lead_time ** 2) * (mean_demand ** 2)
    total_variance = demand_variance_during_lead_time + lead_time_variance_impact
    total_std = math.sqrt(total_variance)
    
    safety_stock = z * total_std
    
    demand_during_lead_time = mean_demand * mean_lead_time
    reorder_point = demand_during_lead_time + safety_stock
    
    stockout_risk = (1 - service_level) * 100
    fill_rate = service_level * 100
    
    return SafetyStockResult(
        sku=sku,
        supplier=supplier,
        service_level=service_level,
        z_score=z,
        safety_stock_units=int(math.ceil(safety_stock)),
        reorder_point=int(math.ceil(reorder_point)),
        average_demand_during_lead_time=demand_during_lead_time,
        stockout_risk_percentage=stockout_risk,
        fill_rate_percentage=fill_rate
    )


def calculate_sensitivity_analysis(
    sku: str,
    demand_stats: DemandStatistics,
    lead_time_stats: LeadTimeStatistics,
    base_service_level: float,
    service_level_range: List[float] = None
) -> SensitivityAnalysis:
    if service_level_range is None:
        service_level_range = [0.75, 0.80, 0.85, 0.90, 0.95, 0.97, 0.98, 0.99]
    
    supplier = lead_time_stats.supplier
    points = []
    prev_ss = 0
    
    for sl in sorted(service_level_range):
        result = calculate_safety_stock(
            sku=sku,
            supplier=supplier,
            demand_stats=demand_stats,
            lead_time_stats=lead_time_stats,
            service_level=sl
        )
        
        marginal = result.safety_stock_units - prev_ss
        points.append(SensitivityPoint(
            service_level=sl,
            safety_stock_units=result.safety_stock_units,
            marginal_increase=marginal
        ))
        prev_ss = result.safety_stock_units
    
    return SensitivityAnalysis(sku=sku, points=points)


def get_recommended_action(
    current_inventory: int,
    safety_stock: int,
    reorder_point: int,
    data_quality_issues: bool
) -> str:
    if data_quality_issues:
        return "REQUIRES_MANUAL_REVIEW"
    
    if current_inventory <= 0:
        return "URGENT_REORDER"
    elif current_inventory < safety_stock:
        return "PLACE_ORDER_SOON"
    elif current_inventory < reorder_point:
        return "MONITOR_CLOSELY"
    elif current_inventory > reorder_point * 2:
        return "REDUCE_INVENTORY"
    else:
        return "MAINTAIN_CURRENT"
