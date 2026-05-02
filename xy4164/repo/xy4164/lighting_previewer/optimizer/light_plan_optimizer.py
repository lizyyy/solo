"""补光方案优化器 - 根据DLI需求、电价时段和预算生成最优补光方案"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime
import uuid

from ..models import (
    CropZone, LEDSpectrum, SensorData, ElectricityPrice,
    LightPlan, SupplementInterval, PriorityLevel, LightThreshold
)
from ..calculators import DLICalculator, EnergyCostCalculator


class OptimizationResult:
    
    def __init__(self):
        self.light_plan: Optional[LightPlan] = None
        self.original_plan: Optional[LightPlan] = None
        self.savings_percentage: float = 0.0
        self.energy_savings_kwh: float = 0.0
        self.cost_savings: float = 0.0
        self.improvements: List[str] = []
        self.warnings: List[str] = []


class LightPlanOptimizer:
    
    PPFD_TO_DLI_FACTOR = 0.0036
    
    def __init__(self):
        self.dli_calculator = DLICalculator()
        self.energy_calculator = EnergyCostCalculator()
    
    def optimize(
        self,
        zones: List[CropZone],
        spectra: List[LEDSpectrum],
        sensors: List[SensorData],
        electricity_price: ElectricityPrice,
        budget_limit: Optional[float] = None,
        base_date: str = "",
        existing_plan: Optional[LightPlan] = None
    ) -> OptimizationResult:
        
        result = OptimizationResult()
        result.original_plan = existing_plan
        
        spectrum_map = {s.spectrum_id: s for s in spectra}
        sensor_map = {s.sensor_id: s for s in sensors}
        
        intervals: List[SupplementInterval] = []
        
        zones_by_priority = self._prioritize_zones(zones, sensor_map)
        
        for priority, zone_list in zones_by_priority.items():
            for zone in zone_list:
                zone_intervals = self._generate_zone_intervals(
                    zone,
                    spectrum_map.get(zone.led_spectrum_id),
                    sensor_map.get(zone.sensor_id),
                    electricity_price,
                    priority
                )
                intervals.extend(zone_intervals)
        
        plan_id = str(uuid.uuid4())
        plan_name = f"优化方案_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        created_at = datetime.now().isoformat()
        
        light_plan = LightPlan(
            plan_id=plan_id,
            plan_name=plan_name,
            created_at=created_at,
            base_date=base_date,
            intervals=intervals,
            budget_limit=budget_limit
        )
        
        self._calculate_plan_metrics(light_plan, zones, electricity_price)
        
        if budget_limit is not None:
            light_plan = self._apply_budget_constraint(
                light_plan, zones, spectra, sensors, electricity_price, budget_limit
            )
        
        result.light_plan = light_plan
        
        if existing_plan:
            self._calculate_savings(result, zones, electricity_price)
        
        self._generate_improvements(result, zones, sensors)
        
        return result
    
    def _prioritize_zones(
        self,
        zones: List[CropZone],
        sensor_map: Dict[str, SensorData]
    ) -> Dict[PriorityLevel, List[CropZone]]:
        
        priority_groups: Dict[PriorityLevel, List[CropZone]] = {
            PriorityLevel.HIGH: [],
            PriorityLevel.MEDIUM: [],
            PriorityLevel.LOW: []
        }
        
        for zone in zones:
            priority = self._determine_zone_priority(zone, sensor_map.get(zone.sensor_id))
            priority_groups[priority].append(zone)
        
        return priority_groups
    
    def _determine_zone_priority(
        self,
        zone: CropZone,
        sensor: Optional[SensorData]
    ) -> PriorityLevel:
        
        if sensor is None:
            return PriorityLevel.HIGH
        
        natural_dli = self.dli_calculator.calculate_natural_dli_from_sensor(
            sensor,
            photoperiod_start_hour=zone.photoperiod_start.hour,
            photoperiod_end_hour=zone.photoperiod_end.hour
        )
        
        threshold = zone.light_threshold
        dli_deficit = max(0, threshold.target_dli - natural_dli)
        
        deficit_percentage = dli_deficit / threshold.target_dli if threshold.target_dli > 0 else 0
        
        if deficit_percentage > 0.3:
            return PriorityLevel.HIGH
        elif deficit_percentage > 0.1:
            return PriorityLevel.MEDIUM
        else:
            return PriorityLevel.LOW
    
    def _generate_zone_intervals(
        self,
        zone: CropZone,
        spectrum: Optional[LEDSpectrum],
        sensor: Optional[SensorData],
        electricity_price: ElectricityPrice,
        priority: PriorityLevel
    ) -> List[SupplementInterval]:
        
        intervals: List[SupplementInterval] = []
        
        if spectrum is None:
            return intervals
        
        threshold = zone.light_threshold
        
        natural_dli = 0.0
        if sensor:
            natural_dli = self.dli_calculator.calculate_natural_dli_from_sensor(
                sensor,
                photoperiod_start_hour=zone.photoperiod_start.hour,
                photoperiod_end_hour=zone.photoperiod_end.hour
            )
        
        dli_needed = max(0, threshold.target_dli - natural_dli)
        
        if dli_needed <= 0:
            return intervals
        
        available_hours = self._get_available_hours(zone, electricity_price)
        
        current_dli = natural_dli
        remaining_dli = dli_needed
        
        for hour_info in available_hours:
            if remaining_dli <= 0:
                break
            
            hour = hour_info["hour"]
            is_cheapest = hour_info["is_cheapest"]
            is_in_photoperiod = hour_info["in_photoperiod"]
            
            max_ppfd = spectrum.photon_flux_density
            max_dli_per_hour = max_ppfd * 1.0 * self.PPFD_TO_DLI_FACTOR
            
            dli_this_hour = min(remaining_dli, max_dli_per_hour)
            power_percentage = (dli_this_hour / max_dli_per_hour) * 100
            
            if power_percentage < 10:
                continue
            
            estimated_ppfd = self.dli_calculator.calculate_supplemental_ppfd(
                spectrum, power_percentage
            )
            
            interval = SupplementInterval(
                zone_id=zone.zone_id,
                start_hour=hour,
                end_hour=hour + 1,
                power_percentage=power_percentage,
                priority=PriorityLevel.HIGH if is_cheapest else priority,
                estimated_ppfd=estimated_ppfd,
                estimated_dli_contribution=dli_this_hour,
                estimated_energy=0.0,
                estimated_cost=0.0,
                notes=f"{'谷电时段' if is_cheapest else '峰电时段'}补光"
            )
            
            intervals.append(interval)
            current_dli += dli_this_hour
            remaining_dli -= dli_this_hour
        
        merged_intervals = self._merge_adjacent_intervals(intervals)
        
        return merged_intervals
    
    def _get_available_hours(
        self,
        zone: CropZone,
        electricity_price: ElectricityPrice
    ) -> List[Dict]:
        
        hours_info = []
        cheapest_price = electricity_price.off_peak_price
        
        for hour in range(24):
            is_in_photoperiod = self._is_in_photoperiod(hour, zone)
            price = electricity_price.get_price_for_hour(hour)
            is_cheapest = abs(price - cheapest_price) < 0.001
            
            hours_info.append({
                "hour": hour,
                "price_per_kwh": price,
                "is_cheapest": is_cheapest,
                "in_photoperiod": is_in_photoperiod
            })
        
        def sort_key(h: Dict) -> tuple:
            return (
                not h["is_cheapest"],
                not h["in_photoperiod"],
                h["price_per_kwh"],
                h["hour"]
            )
        
        hours_info.sort(key=sort_key)
        
        return hours_info
    
    def _is_in_photoperiod(
        self,
        hour: int,
        zone: CropZone
    ) -> bool:
        
        start_hour = zone.photoperiod_start.hour
        end_hour = zone.photoperiod_end.hour
        
        if start_hour <= end_hour:
            return start_hour <= hour < end_hour
        else:
            return hour >= start_hour or hour < end_hour
    
    def _merge_adjacent_intervals(
        self,
        intervals: List[SupplementInterval]
    ) -> List[SupplementInterval]:
        
        if not intervals:
            return []
        
        sorted_intervals = sorted(intervals, key=lambda x: x.start_hour)
        merged: List[SupplementInterval] = []
        
        current = sorted_intervals[0]
        
        for interval in sorted_intervals[1:]:
            if (interval.zone_id == current.zone_id and
                interval.power_percentage == current.power_percentage and
                interval.start_hour == current.end_hour):
                
                current.end_hour = interval.end_hour
                current.estimated_dli_contribution += interval.estimated_dli_contribution
                current.estimated_ppfd = (
                    current.estimated_ppfd + interval.estimated_ppfd
                ) / 2
            else:
                merged.append(current)
                current = interval
        
        merged.append(current)
        
        return merged
    
    def _calculate_plan_metrics(
        self,
        light_plan: LightPlan,
        zones: List[CropZone],
        electricity_price: ElectricityPrice
    ) -> None:
        
        for interval in light_plan.intervals:
            zone = next((z for z in zones if z.zone_id == interval.zone_id), None)
            if zone:
                interval.estimated_energy = self.energy_calculator.calculate_interval_energy(
                    zone, interval
                )
                interval.estimated_cost = self.energy_calculator.calculate_interval_cost(
                    interval.estimated_energy,
                    interval.start_hour,
                    electricity_price
                )
        
        light_plan.total_estimated_energy = self.energy_calculator.calculate_total_energy(
            zones, light_plan.intervals
        )
        light_plan.total_estimated_cost = self.energy_calculator.calculate_total_cost(
            zones, light_plan.intervals, electricity_price
        )
    
    def _apply_budget_constraint(
        self,
        light_plan: LightPlan,
        zones: List[CropZone],
        spectra: List[LEDSpectrum],
        sensors: List[SensorData],
        electricity_price: ElectricityPrice,
        budget_limit: float
    ) -> LightPlan:
        
        if light_plan.total_estimated_cost <= budget_limit:
            return light_plan
        
        intervals_by_priority: Dict[PriorityLevel, List[SupplementInterval]] = {
            PriorityLevel.LOW: [],
            PriorityLevel.MEDIUM: [],
            PriorityLevel.HIGH: []
        }
        
        for interval in light_plan.intervals:
            intervals_by_priority[interval.priority].append(interval)
        
        new_intervals: List[SupplementInterval] = []
        remaining_budget = budget_limit
        
        for priority in [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW]:
            for interval in intervals_by_priority[priority]:
                if interval.estimated_cost <= remaining_budget:
                    new_intervals.append(interval)
                    remaining_budget -= interval.estimated_cost
                else:
                    max_power_percentage = int(
                        (remaining_budget / interval.estimated_cost) * interval.power_percentage
                    )
                    
                    if max_power_percentage >= 20:
                        zone = next((z for z in zones if z.zone_id == interval.zone_id), None)
                        if zone:
                            spectrum = next((s for s in spectra if s.spectrum_id == zone.led_spectrum_id), None)
                            if spectrum:
                                reduced_interval = SupplementInterval(
                                    zone_id=interval.zone_id,
                                    start_hour=interval.start_hour,
                                    end_hour=interval.end_hour,
                                    power_percentage=max_power_percentage,
                                    priority=interval.priority,
                                    estimated_ppfd=self.dli_calculator.calculate_supplemental_ppfd(
                                        spectrum, max_power_percentage
                                    ),
                                    estimated_dli_contribution=interval.estimated_dli_contribution * (
                                        max_power_percentage / interval.power_percentage
                                    ),
                                    estimated_energy=0.0,
                                    estimated_cost=0.0,
                                    notes=f"预算限制-功率降至{max_power_percentage}%"
                                )
                                new_intervals.append(reduced_interval)
                                remaining_budget = 0
                                break
            
            if remaining_budget <= 0:
                break
        
        new_plan = LightPlan(
            plan_id=light_plan.plan_id,
            plan_name=light_plan.plan_name + " (预算调整)",
            created_at=light_plan.created_at,
            base_date=light_plan.base_date,
            intervals=new_intervals,
            budget_limit=budget_limit
        )
        
        self._calculate_plan_metrics(new_plan, zones, electricity_price)
        
        return new_plan
    
    def _calculate_savings(
        self,
        result: OptimizationResult,
        zones: List[CropZone],
        electricity_price: ElectricityPrice
    ) -> None:
        
        if not result.original_plan or not result.light_plan:
            return
        
        original_cost = result.original_plan.total_estimated_cost
        new_cost = result.light_plan.total_estimated_cost
        
        result.cost_savings = original_cost - new_cost
        result.energy_savings_kwh = (
            result.original_plan.total_estimated_energy -
            result.light_plan.total_estimated_energy
        )
        
        if original_cost > 0:
            result.savings_percentage = (result.cost_savings / original_cost) * 100
    
    def _generate_improvements(
        self,
        result: OptimizationResult,
        zones: List[CropZone],
        sensors: List[SensorData]
    ) -> None:
        
        if not result.light_plan:
            return
        
        sensor_map = {s.sensor_id: s for s in sensors}
        
        cheap_hour_count = 0
        expensive_hour_count = 0
        
        for interval in result.light_plan.intervals:
            if "谷电" in interval.notes or interval.priority == PriorityLevel.HIGH:
                cheap_hour_count += 1
            else:
                expensive_hour_count += 1
        
        if cheap_hour_count > 0:
            result.improvements.append(
                f"优先使用谷电时段补光，共 {cheap_hour_count} 个时段"
            )
        
        if expensive_hour_count > 0:
            result.warnings.append(
                f"仍有 {expensive_hour_count} 个时段在峰电时段补光，建议优化"
            )
        
        for zone in zones:
            sensor = sensor_map.get(zone.sensor_id)
            if sensor:
                gaps = sensor.check_gaps(max_interval_minutes=120)
                if gaps:
                    result.warnings.append(
                        f"分区 {zone.zone_id} 的传感器 {sensor.sensor_id} 存在数据缺口"
                    )
    
    def adjust_interval(
        self,
        light_plan: LightPlan,
        zone_id: str,
        old_start_hour: int,
        new_start_hour: Optional[int] = None,
        new_end_hour: Optional[int] = None,
        new_power_percentage: Optional[float] = None
    ) -> LightPlan:
        
        new_intervals = []
        
        for interval in light_plan.intervals:
            if interval.zone_id == zone_id and interval.start_hour == old_start_hour:
                updated = SupplementInterval(
                    zone_id=interval.zone_id,
                    start_hour=new_start_hour if new_start_hour is not None else interval.start_hour,
                    end_hour=new_end_hour if new_end_hour is not None else interval.end_hour,
                    power_percentage=(
                        new_power_percentage if new_power_percentage is not None
                        else interval.power_percentage
                    ),
                    priority=interval.priority,
                    estimated_ppfd=interval.estimated_ppfd,
                    estimated_dli_contribution=interval.estimated_dli_contribution,
                    estimated_energy=interval.estimated_energy,
                    estimated_cost=interval.estimated_cost,
                    notes=interval.notes + " (手动调整)"
                )
                new_intervals.append(updated)
            else:
                new_intervals.append(interval)
        
        new_plan = LightPlan(
            plan_id=light_plan.plan_id,
            plan_name=light_plan.plan_name + " (调整)",
            created_at=light_plan.created_at,
            base_date=light_plan.base_date,
            intervals=new_intervals,
            budget_limit=light_plan.budget_limit,
            notes=light_plan.notes,
            custom_attributes=light_plan.custom_attributes
        )
        
        return new_plan
    
    def add_interval(
        self,
        light_plan: LightPlan,
        zone_id: str,
        start_hour: int,
        end_hour: int,
        power_percentage: float,
        priority: PriorityLevel = PriorityLevel.MEDIUM
    ) -> LightPlan:
        
        new_interval = SupplementInterval(
            zone_id=zone_id,
            start_hour=start_hour,
            end_hour=end_hour,
            power_percentage=power_percentage,
            priority=priority,
            notes="手动添加"
        )
        
        new_intervals = light_plan.intervals.copy()
        new_intervals.append(new_interval)
        
        merged_intervals = self._merge_adjacent_intervals(new_intervals)
        
        new_plan = LightPlan(
            plan_id=light_plan.plan_id,
            plan_name=light_plan.plan_name + " (新增时段)",
            created_at=light_plan.created_at,
            base_date=light_plan.base_date,
            intervals=merged_intervals,
            budget_limit=light_plan.budget_limit
        )
        
        return new_plan
    
    def remove_interval(
        self,
        light_plan: LightPlan,
        zone_id: str,
        start_hour: int
    ) -> LightPlan:
        
        new_intervals = [
            i for i in light_plan.intervals
            if not (i.zone_id == zone_id and i.start_hour == start_hour)
        ]
        
        new_plan = LightPlan(
            plan_id=light_plan.plan_id,
            plan_name=light_plan.plan_name + " (删除时段)",
            created_at=light_plan.created_at,
            base_date=light_plan.base_date,
            intervals=new_intervals,
            budget_limit=light_plan.budget_limit
        )
        
        return new_plan
