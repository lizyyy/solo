"""
分区水量平衡计算
计算分区入流与用户表差值，识别可疑漏损
"""

from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from ..parsers.meters_parser import MetersParser, Meter, MeterReading
from ..parsers.pipes_parser import Zone
from ..parsers.repair_orders_parser import RepairOrdersParser


@dataclass
class ZoneBalanceResult:
    """分区水量平衡结果"""
    zone_id: str
    zone_name: str
    period_start: datetime
    period_end: datetime
    
    total_inflow: float = 0.0
    total_user_consumption: float = 0.0
    unaccounted_water: float = 0.0
    loss_rate: float = 0.0
    
    inflow_details: List[Tuple[str, float]] = field(default_factory=list)
    user_details: List[Tuple[str, float]] = field(default_factory=list)
    
    is_suspicious: bool = False
    suspicion_reasons: List[str] = field(default_factory=list)
    
    excluded_reasons: Dict[str, str] = field(default_factory=dict)


class ZoneBalanceCalculator:
    """分区水量平衡计算器"""
    
    def __init__(
        self,
        meters_parser: MetersParser,
        repair_parser: Optional[RepairOrdersParser] = None
    ):
        self.meters_parser = meters_parser
        self.repair_parser = repair_parser
        self._date_format = "%Y-%m-%d %H:%M:%S"
    
    def calculate_zone_balance(
        self,
        zone: Zone,
        start_time: datetime,
        end_time: datetime
    ) -> ZoneBalanceResult:
        """计算单个分区的水量平衡"""
        result = ZoneBalanceResult(
            zone_id=zone.id,
            zone_name=zone.name,
            period_start=start_time,
            period_end=end_time
        )
        
        inflow_meters = self._get_zone_inflow_meters(zone)
        user_meters = self._get_zone_user_meters(zone)
        
        for meter in inflow_meters:
            consumption = self._calculate_meter_consumption(meter, start_time, end_time)
            if consumption is not None:
                result.total_inflow += consumption
                result.inflow_details.append((meter.id, consumption))
        
        for meter in user_meters:
            consumption = self._calculate_meter_consumption(meter, start_time, end_time)
            if consumption is not None:
                result.total_user_consumption += consumption
                result.user_details.append((meter.id, consumption))
        
        result.unaccounted_water = result.total_inflow - result.total_user_consumption
        
        if result.total_inflow > 0:
            result.loss_rate = result.unaccounted_water / result.total_inflow
        
        if self.repair_parser:
            self._check_valve_closures(result, start_time, end_time)
        
        self._evaluate_suspicion(result)
        
        return result
    
    def _get_zone_inflow_meters(self, zone: Zone) -> List[Meter]:
        """获取分区的入流表"""
        inflow_meters = []
        for meter_id in zone.meter_ids:
            if meter_id in self.meters_parser.meters:
                meter = self.meters_parser.meters[meter_id]
                if meter.is_inflow:
                    inflow_meters.append(meter)
        
        all_inflows = self.meters_parser.get_inflow_meters()
        for meter in all_inflows:
            if meter.zone_id == zone.id:
                if meter not in inflow_meters:
                    inflow_meters.append(meter)
        
        return inflow_meters
    
    def _get_zone_user_meters(self, zone: Zone) -> List[Meter]:
        """获取分区的用户表"""
        user_meters = []
        for meter_id in zone.meter_ids:
            if meter_id in self.meters_parser.meters:
                meter = self.meters_parser.meters[meter_id]
                if not meter.is_inflow:
                    user_meters.append(meter)
        
        all_users = self.meters_parser.get_user_meters()
        for meter in all_users:
            if meter.zone_id == zone.id:
                if meter not in user_meters:
                    user_meters.append(meter)
        
        return user_meters
    
    def _calculate_meter_consumption(
        self,
        meter: Meter,
        start_time: datetime,
        end_time: datetime
    ) -> Optional[float]:
        """计算水表在指定时间段的用水量"""
        if not meter.readings:
            return None
        
        start_reading = self._find_closest_reading(meter.readings, start_time, 'before')
        end_reading = self._find_closest_reading(meter.readings, end_time, 'after')
        
        if start_reading is None or end_reading is None:
            return None
        
        consumption = end_reading.cumulative - start_reading.cumulative
        
        if consumption < 0:
            if self._is_valid_midnight_rollover(start_reading, end_reading):
                max_possible = self._get_meter_max_value(meter)
                consumption = (max_possible - start_reading.cumulative) + end_reading.cumulative
            else:
                return None
        
        return max(0.0, consumption)
    
    def _find_closest_reading(
        self,
        readings: List[MeterReading],
        target_time: datetime,
        direction: str = 'before'
    ) -> Optional[MeterReading]:
        """查找最接近目标时间的读数"""
        if direction == 'before':
            candidates = [r for r in readings if r.timestamp <= target_time]
            if candidates:
                return max(candidates, key=lambda x: x.timestamp)
        else:
            candidates = [r for r in readings if r.timestamp >= target_time]
            if candidates:
                return min(candidates, key=lambda x: x.timestamp)
        
        return None
    
    def _is_valid_midnight_rollover(
        self,
        start_reading: MeterReading,
        end_reading: MeterReading
    ) -> bool:
        """验证是否为有效的跨午夜读数"""
        start_time = start_reading.timestamp
        end_time = end_reading.timestamp
        
        is_start_late = time(22, 0) <= start_time.time() <= time(23, 59, 59)
        is_end_early = time(0, 0) <= end_time.time() <= time(6, 0)
        
        days_diff = (end_time.date() - start_time.date()).days
        
        return is_start_late and is_end_early and days_diff >= 1
    
    def _get_meter_max_value(self, meter: Meter) -> float:
        """获取水表最大量程"""
        if meter.meter_type == 'zone':
            return 1000000.0
        return 99999.9
    
    def _check_valve_closures(
        self,
        result: ZoneBalanceResult,
        start_time: datetime,
        end_time: datetime
    ):
        """检查阀门关闭对水量平衡的影响"""
        if not self.repair_parser:
            return
        
        closed_valves = self.repair_parser.get_closed_valves_during(start_time, end_time)
        
        for valve_id, periods in closed_valves.items():
            for period_start, period_end in periods:
                overlap_start = max(start_time, period_start)
                overlap_end = min(end_time, period_end)
                
                if overlap_start < overlap_end:
                    overlap_hours = (overlap_end - overlap_start).total_seconds() / 3600
                    total_hours = (end_time - start_time).total_seconds() / 3600
                    overlap_ratio = overlap_hours / total_hours
                    
                    result.excluded_reasons[valve_id] = (
                        f"阀门 {valve_id} 关闭，影响时段占比 {overlap_ratio:.1%}"
                    )
    
    def _evaluate_suspicion(self, result: ZoneBalanceResult):
        """评估是否为可疑漏损"""
        if result.total_inflow <= 0:
            return
        
        if result.loss_rate > 0.3:
            result.is_suspicious = True
            result.suspicion_reasons.append(
                f"漏损率过高: {result.loss_rate:.1%} (阈值30%)"
            )
        
        if result.unaccounted_water > 10:
            result.is_suspicious = True
            result.suspicion_reasons.append(
                f"不明水量过大: {result.unaccounted_water:.2f} m³ (阈值10 m³)"
            )
        
        if result.excluded_reasons:
            result.is_suspicious = False
            result.suspicion_reasons.append(
                f"存在阀门关闭等操作，排除分析"
            )
    
    def calculate_all_zones(
        self,
        zones: Dict[str, Zone],
        start_time: datetime,
        end_time: datetime
    ) -> List[ZoneBalanceResult]:
        """计算所有分区的水量平衡"""
        results = []
        for zone_id, zone in zones.items():
            result = self.calculate_zone_balance(zone, start_time, end_time)
            results.append(result)
        return results
