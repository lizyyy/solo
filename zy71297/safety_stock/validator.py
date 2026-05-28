from typing import List, Tuple, Dict
from datetime import date, timedelta
import statistics

from .models import (
    SalesRecord,
    LeadTimeRecord,
    AnomalyRecord,
    AnomalyType,
    DataQualityStatus,
)


MIN_DATA_POINTS = 10
MIN_LEAD_TIME_POINTS = 3
MAX_SERVICE_LEVEL = 0.999
MIN_SERVICE_LEVEL = 0.75


class DataValidator:
    def __init__(self):
        self.anomalies: List[AnomalyRecord] = []
    
    def validate_all(
        self,
        sku: str,
        sales_records: List[SalesRecord],
        lead_time_records: List[LeadTimeRecord],
        service_level: float,
        current_inventory: int
    ) -> Tuple[DataQualityStatus, List[AnomalyRecord]]:
        self.anomalies = []
        
        self._check_service_level(sku, service_level)
        self._check_sales_data_quality(sku, sales_records)
        self._check_promotion_anomalies(sku, sales_records)
        self._check_lead_time_quality(sku, lead_time_records)
        self._check_inventory_reasonability(sku, current_inventory, sales_records)
        
        status = self._determine_overall_status()
        return status, self.anomalies
    
    def _check_service_level(self, sku: str, service_level: float):
        if service_level < MIN_SERVICE_LEVEL:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.INVALID_SERVICE_LEVEL,
                description=f"服务水平过低: {service_level:.2%}, 建议不低于 {MIN_SERVICE_LEVEL:.0%}",
                severity="critical",
                affected_data={"service_level": service_level, "minimum_required": MIN_SERVICE_LEVEL}
            ))
        elif service_level > MAX_SERVICE_LEVEL:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.INVALID_SERVICE_LEVEL,
                description=f"服务水平过高: {service_level:.2%}, 建议不超过 {MAX_SERVICE_LEVEL:.1%}",
                severity="warning",
                affected_data={"service_level": service_level, "maximum_allowed": MAX_SERVICE_LEVEL}
            ))
    
    def _check_sales_data_quality(self, sku: str, sales_records: List[SalesRecord]):
        if not sales_records:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description="没有销售历史数据",
                severity="critical",
                affected_data={"data_points": 0, "minimum_required": MIN_DATA_POINTS}
            ))
            return
        
        valid_records = [r for r in sales_records if r.quantity > 0]
        
        if len(valid_records) < MIN_DATA_POINTS:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description=f"有效销售数据不足: {len(valid_records)} 条, 建议至少 {MIN_DATA_POINTS} 条",
                severity="warning",
                affected_data={"data_points": len(valid_records), "minimum_required": MIN_DATA_POINTS}
            ))
        
        if len(valid_records) < len(sales_records) * 0.5:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description="超过50%的日期销量为0，可能存在数据缺失或新品上市",
                severity="warning",
                affected_data={
                    "zero_sales_days": len(sales_records) - len(valid_records),
                    "total_days": len(sales_records)
                }
            ))
        
        self._check_date_continuity(sku, sales_records)
    
    def _check_date_continuity(self, sku: str, sales_records: List[SalesRecord]):
        if len(sales_records) < 2:
            return
        
        sorted_dates = sorted(set(r.date for r in sales_records))
        gaps = []
        
        for i in range(1, len(sorted_dates)):
            gap = (sorted_dates[i] - sorted_dates[i-1]).days
            if gap > 7:
                gaps.append({
                    "from": sorted_dates[i-1].isoformat(),
                    "to": sorted_dates[i].isoformat(),
                    "days_missing": gap - 1
                })
        
        if gaps:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description=f"发现 {len(gaps)} 处超过7天的数据断层",
                severity="warning",
                affected_data={"gaps": gaps}
            ))
    
    def _check_promotion_anomalies(self, sku: str, sales_records: List[SalesRecord]):
        normal_sales = [r.quantity for r in sales_records if not r.is_promotion and r.quantity > 0]
        promotion_sales = [r.quantity for r in sales_records if r.is_promotion and r.quantity > 0]
        
        if not normal_sales or not promotion_sales:
            return
        
        avg_normal = statistics.mean(normal_sales)
        avg_promotion = statistics.mean(promotion_sales)
        
        if avg_promotion > avg_normal * 2:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.PROMOTION,
                description=f"促销期间销量显著偏高: 促销日均 {avg_promotion:.1f} vs 平日 {avg_normal:.1f}",
                severity="warning",
                affected_data={
                    "avg_normal_sales": round(avg_normal, 2),
                    "avg_promotion_sales": round(avg_promotion, 2),
                    "uplift_percentage": round((avg_promotion / avg_normal - 1) * 100, 1)
                }
            ))
        
        quantities = [r.quantity for r in sales_records if r.quantity > 0]
        if len(quantities) >= 4:
            sorted_q = sorted(quantities)
            n = len(sorted_q)
            q1 = sorted_q[int(n * 0.25)]
            q3 = sorted_q[int(n * 0.75)]
            iqr = q3 - q1
            upper_bound = q3 + 2 * iqr
            
            outliers = [q for q in quantities if q > upper_bound]
            if outliers and len(outliers) / len(quantities) > 0.1:
                self.anomalies.append(AnomalyRecord(
                    sku=sku,
                    anomaly_type=AnomalyType.OUTLIER,
                    description=f"发现 {len(outliers)} 个异常高销量值（超过 {upper_bound:.0f}）",
                    severity="warning",
                    affected_data={
                        "outlier_count": len(outliers),
                        "upper_bound": round(upper_bound, 0),
                        "max_outlier": max(outliers)
                    }
                ))
    
    def _check_lead_time_quality(self, sku: str, lead_time_records: List[LeadTimeRecord]):
        if not lead_time_records:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description="没有到货周期数据",
                severity="critical",
                affected_data={"data_points": 0, "minimum_required": MIN_LEAD_TIME_POINTS}
            ))
            return
        
        valid_records = [r for r in lead_time_records if r.lead_time_days > 0]
        
        if len(valid_records) < MIN_LEAD_TIME_POINTS:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description=f"到货周期数据不足: {len(valid_records)} 条, 建议至少 {MIN_LEAD_TIME_POINTS} 条",
                severity="critical",
                affected_data={"data_points": len(valid_records), "minimum_required": MIN_LEAD_TIME_POINTS}
            ))
        
        if valid_records:
            lead_times = [r.lead_time_days for r in valid_records]
            max_lt = max(lead_times)
            min_lt = min(lead_times)
            
            if max_lt > min_lt * 3:
                self.anomalies.append(AnomalyRecord(
                    sku=sku,
                    anomaly_type=AnomalyType.OUTLIER,
                    description=f"到货周期波动过大: 最长 {max_lt} 天 vs 最短 {min_lt} 天",
                    severity="warning",
                    affected_data={
                        "max_lead_time": max_lt,
                        "min_lead_time": min_lt,
                        "ratio": round(max_lt / min_lt, 1)
                    }
                ))
    
    def _check_inventory_reasonability(
        self,
        sku: str,
        current_inventory: int,
        sales_records: List[SalesRecord]
    ):
        if current_inventory < 0:
            self.anomalies.append(AnomalyRecord(
                sku=sku,
                anomaly_type=AnomalyType.MISSING_DATA,
                description=f"库存余额为负: {current_inventory}",
                severity="critical",
                affected_data={"current_inventory": current_inventory}
            ))
        
        valid_sales = [r.quantity for r in sales_records if r.quantity > 0]
        if valid_sales and current_inventory > 0:
            avg_daily = statistics.mean(valid_sales)
            days_cover = current_inventory / avg_daily
            
            if days_cover > 180:
                self.anomalies.append(AnomalyRecord(
                    sku=sku,
                    anomaly_type=AnomalyType.OUTLIER,
                    description=f"库存水平异常偏高，可覆盖 {days_cover:.0f} 天销售",
                    severity="warning",
                    affected_data={
                        "days_cover": round(days_cover, 0),
                        "current_inventory": current_inventory,
                        "avg_daily_sales": round(avg_daily, 1)
                    }
                ))
    
    def _determine_overall_status(self) -> DataQualityStatus:
        if not self.anomalies:
            return DataQualityStatus.CLEAN
        
        critical_count = sum(1 for a in self.anomalies if a.severity == "critical")
        warning_count = sum(1 for a in self.anomalies if a.severity == "warning")
        
        if critical_count > 0:
            return DataQualityStatus.ERROR
        elif warning_count > 0:
            return DataQualityStatus.WARNING
        else:
            return DataQualityStatus.CLEAN


def filter_clean_sales_data(
    sales_records: List[SalesRecord],
    exclude_promotions: bool = True,
    exclude_outliers: bool = True
) -> List[SalesRecord]:
    filtered = sales_records
    
    if exclude_promotions:
        filtered = [r for r in filtered if not r.is_promotion]
    
    if exclude_outliers and len(filtered) >= 4:
        quantities = [r.quantity for r in filtered if r.quantity > 0]
        if quantities:
            sorted_q = sorted(quantities)
            n = len(sorted_q)
            q1 = sorted_q[int(n * 0.25)]
            q3 = sorted_q[int(n * 0.75)]
            iqr = q3 - q1
            upper_bound = q3 + 1.5 * iqr
            lower_bound = q1 - 1.5 * iqr
            
            filtered = [
                r for r in filtered
                if lower_bound <= r.quantity <= upper_bound or r.quantity == 0
            ]
    
    return filtered
