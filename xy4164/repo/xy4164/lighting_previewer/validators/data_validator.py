"""数据校验器 - 校验传感器缺测、灯具功率冲突、作物阈值越界和预算超限"""

from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
import uuid

from ..models import (
    CropZone, LEDSpectrum, SensorData, ElectricityPrice, LightPlan,
    ValidationResult, ValidationIssue, IssueSeverity, IssueCategory
)


class DataValidator:
    
    def __init__(self):
        pass
    
    def validate_all(
        self,
        zones: List[CropZone],
        spectra: List[LEDSpectrum],
        sensors: List[SensorData],
        prices: List[ElectricityPrice],
        light_plan: Optional[LightPlan] = None,
        budget_limit: Optional[float] = None,
        base_date: str = ""
    ) -> ValidationResult:
        
        validation_id = str(uuid.uuid4())
        validated_at = datetime.now().isoformat()
        
        result = ValidationResult(
            validation_id=validation_id,
            validated_at=validated_at,
            base_date=base_date
        )
        
        self._validate_sensors(sensors, result)
        self._validate_spectrum_references(zones, spectra, result)
        self._validate_sensor_references(zones, sensors, result)
        self._validate_power_conflicts(zones, result)
        self._validate_thresholds(zones, result)
        self._validate_electricity_prices(prices, result)
        
        if light_plan:
            self._validate_light_plan(light_plan, zones, result)
        
        if budget_limit is not None and light_plan:
            self._validate_budget(light_plan, budget_limit, result)
        
        return result
    
    def _validate_sensors(
        self,
        sensors: List[SensorData],
        result: ValidationResult
    ) -> None:
        
        for sensor in sensors:
            sensor_id = sensor.sensor_id
            result.sensor_validations[sensor_id] = {
                "total_readings": len(sensor.readings),
                "gaps": [],
                "anomalies": []
            }
            
            if len(sensor.readings) < 24:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.SENSOR_MISSING,
                    severity=IssueSeverity.WARNING,
                    message=f"传感器 {sensor_id} 读数不足，只有 {len(sensor.readings)} 条记录（需要至少24条）",
                    affected_sensor=sensor_id,
                    suggested_action="检查传感器数据采集是否完整，或补充插值数据"
                )
                result.add_issue(issue)
                result.sensor_validations[sensor_id]["status"] = "incomplete"
            
            gaps = sensor.check_gaps(max_interval_minutes=120)
            for gap_start, gap_end, gap_minutes in gaps:
                result.sensor_validations[sensor_id]["gaps"].append({
                    "start": gap_start.isoformat(),
                    "end": gap_end.isoformat(),
                    "duration_minutes": gap_minutes
                })
                
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.SENSOR_MISSING,
                    severity=IssueSeverity.WARNING if gap_minutes < 240 else IssueSeverity.CRITICAL,
                    message=f"传感器 {sensor_id} 存在数据缺口: {gap_start} 至 {gap_end}，时长 {gap_minutes:.0f} 分钟",
                    affected_sensor=sensor_id,
                    suggested_action="使用线性插值或历史数据填补缺口",
                    metadata={"gap_duration_minutes": gap_minutes}
                )
                result.add_issue(issue)
            
            self._check_sensor_anomalies(sensor, result)
    
    def _check_sensor_anomalies(
        self,
        sensor: SensorData,
        result: ValidationResult
    ) -> None:
        
        if not sensor.readings:
            return
        
        ppfd_values = [r.ppfd for r in sensor.readings if r.ppfd is not None]
        if not ppfd_values:
            return
        
        mean_ppfd = sum(ppfd_values) / len(ppfd_values)
        std_ppfd = (sum((x - mean_ppfd) ** 2 for x in ppfd_values) / len(ppfd_values)) ** 0.5
        
        for reading in sensor.readings:
            if reading.ppfd is None:
                continue
            
            if reading.ppfd < 0:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.SENSOR_ANOMALY,
                    severity=IssueSeverity.CRITICAL,
                    message=f"传感器 {sensor.sensor_id} 在 {reading.timestamp} 的PPFD值为负值: {reading.ppfd}",
                    affected_sensor=sensor.sensor_id,
                    suggested_action="检查传感器校准或修复异常值",
                    metadata={"value": reading.ppfd, "timestamp": reading.timestamp.isoformat()}
                )
                result.add_issue(issue)
                result.sensor_validations[sensor.sensor_id]["anomalies"].append({
                    "type": "negative_ppfd",
                    "timestamp": reading.timestamp.isoformat(),
                    "value": reading.ppfd
                })
            
            if std_ppfd > 0 and abs(reading.ppfd - mean_ppfd) > 3 * std_ppfd:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.SENSOR_ANOMALY,
                    severity=IssueSeverity.WARNING,
                    message=f"传感器 {sensor.sensor_id} 在 {reading.timestamp} 的PPFD值异常: {reading.ppfd} (均值: {mean_ppfd:.1f})",
                    affected_sensor=sensor.sensor_id,
                    suggested_action="确认是否为真实值，或考虑替换为相邻平均值",
                    metadata={"value": reading.ppfd, "mean": mean_ppfd, "std": std_ppfd}
                )
                result.add_issue(issue)
    
    def _validate_spectrum_references(
        self,
        zones: List[CropZone],
        spectra: List[LEDSpectrum],
        result: ValidationResult
    ) -> None:
        
        spectrum_ids = {s.spectrum_id for s in spectra}
        
        for zone in zones:
            if zone.led_spectrum_id not in spectrum_ids:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.DATA_INCONSISTENCY,
                    severity=IssueSeverity.CRITICAL,
                    message=f"分区 {zone.zone_id} 引用的灯谱ID '{zone.led_spectrum_id}' 不存在",
                    affected_zone=zone.zone_id,
                    affected_spectrum=zone.led_spectrum_id,
                    suggested_action="检查灯谱配置或更新分区引用"
                )
                result.add_issue(issue)
    
    def _validate_sensor_references(
        self,
        zones: List[CropZone],
        sensors: List[SensorData],
        result: ValidationResult
    ) -> None:
        
        sensor_ids = {s.sensor_id for s in sensors}
        
        for zone in zones:
            if zone.sensor_id not in sensor_ids:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.DATA_INCONSISTENCY,
                    severity=IssueSeverity.CRITICAL,
                    message=f"分区 {zone.zone_id} 引用的传感器ID '{zone.sensor_id}' 不存在",
                    affected_zone=zone.zone_id,
                    affected_sensor=zone.sensor_id,
                    suggested_action="检查传感器配置或更新分区引用"
                )
                result.add_issue(issue)
    
    def _validate_power_conflicts(
        self,
        zones: List[CropZone],
        result: ValidationResult
    ) -> None:
        
        for zone in zones:
            result.power_validations[zone.zone_id] = {
                "installed_power": zone.installed_power,
                "issues": []
            }
            
            if zone.installed_power <= 0:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.POWER_CONFLICT,
                    severity=IssueSeverity.CRITICAL,
                    message=f"分区 {zone.zone_id} 的安装功率 {zone.installed_power}W 无效",
                    affected_zone=zone.zone_id,
                    suggested_action="核实灯具实际功率并更新配置"
                )
                result.add_issue(issue)
                result.power_validations[zone.zone_id]["issues"].append("invalid_power")
            
            if zone.installed_power > 10000:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.POWER_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"分区 {zone.zone_id} 的安装功率 {zone.installed_power}W 异常偏高",
                    affected_zone=zone.zone_id,
                    suggested_action="确认功率配置是否正确（单分区功率通常在100-5000W）"
                )
                result.add_issue(issue)
    
    def _validate_thresholds(
        self,
        zones: List[CropZone],
        result: ValidationResult
    ) -> None:
        
        for zone in zones:
            threshold = zone.light_threshold
            result.threshold_validations[zone.zone_id] = {
                "min_dli": threshold.min_dli,
                "max_dli": threshold.max_dli,
                "target_dli": threshold.target_dli,
                "valid": True
            }
            
            if threshold.min_dli < 0:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.THRESHOLD_VIOLATION,
                    severity=IssueSeverity.CRITICAL,
                    message=f"分区 {zone.zone_id} 的最小DLI {threshold.min_dli} 不能为负值",
                    affected_zone=zone.zone_id,
                    suggested_action="检查作物阈值配置"
                )
                result.add_issue(issue)
                result.threshold_validations[zone.zone_id]["valid"] = False
            
            if threshold.max_dli <= threshold.min_dli:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.THRESHOLD_VIOLATION,
                    severity=IssueSeverity.CRITICAL,
                    message=f"分区 {zone.zone_id} 的最大DLI {threshold.max_dli} 必须大于最小DLI {threshold.min_dli}",
                    affected_zone=zone.zone_id,
                    suggested_action="调整作物阈值配置，确保max_dli > min_dli"
                )
                result.add_issue(issue)
                result.threshold_validations[zone.zone_id]["valid"] = False
            
            if threshold.target_dli < threshold.min_dli or threshold.target_dli > threshold.max_dli:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.THRESHOLD_VIOLATION,
                    severity=IssueSeverity.WARNING,
                    message=f"分区 {zone.zone_id} 的目标DLI {threshold.target_dli} 超出合理范围 [{threshold.min_dli}, {threshold.max_dli}]",
                    affected_zone=zone.zone_id,
                    suggested_action="调整目标DLI至合理范围内"
                )
                result.add_issue(issue)
    
    def _validate_electricity_prices(
        self,
        prices: List[ElectricityPrice],
        result: ValidationResult
    ) -> None:
        
        for price in prices:
            covered_hours = set()
            
            for tier in price.tiers:
                start_hour = tier.start_time.hour
                end_hour = tier.end_time.hour
                
                if start_hour <= end_hour:
                    for h in range(start_hour, end_hour):
                        covered_hours.add(h)
                else:
                    for h in range(start_hour, 24):
                        covered_hours.add(h)
                    for h in range(0, end_hour):
                        covered_hours.add(h)
            
            uncovered = []
            for h in range(24):
                if h not in covered_hours:
                    uncovered.append(h)
            
            if uncovered:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.DATA_INCONSISTENCY,
                    severity=IssueSeverity.CRITICAL,
                    message=f"电价方案 {price.price_id} 未覆盖以下小时: {uncovered}",
                    suggested_action="补充电价时段配置，确保24小时全覆盖"
                )
                result.add_issue(issue)
    
    def _validate_light_plan(
        self,
        light_plan: LightPlan,
        zones: List[CropZone],
        result: ValidationResult
    ) -> None:
        
        zone_ids = {z.zone_id for z in zones}
        
        for interval in light_plan.intervals:
            if interval.zone_id not in zone_ids:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.DATA_INCONSISTENCY,
                    severity=IssueSeverity.WARNING,
                    message=f"补光时段引用的分区ID '{interval.zone_id}' 不存在",
                    affected_zone=interval.zone_id,
                    suggested_action="检查补光方案的分区引用"
                )
                result.add_issue(issue)
            
            if interval.power_percentage < 0 or interval.power_percentage > 100:
                issue = ValidationIssue(
                    issue_id=str(uuid.uuid4()),
                    category=IssueCategory.POWER_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"分区 {interval.zone_id} 补光时段 {interval.start_hour}-{interval.end_hour} 的功率百分比 {interval.power_percentage}% 超出有效范围",
                    affected_zone=interval.zone_id,
                    suggested_action="功率百分比应在0-100之间"
                )
                result.add_issue(issue)
    
    def _validate_budget(
        self,
        light_plan: LightPlan,
        budget_limit: float,
        result: ValidationResult
    ) -> None:
        
        total_cost = light_plan.total_estimated_cost
        result.budget_validations = {
            "budget_limit": budget_limit,
            "total_cost": total_cost,
            "utilization": total_cost / budget_limit if budget_limit > 0 else 0
        }
        
        if total_cost > budget_limit:
            overage = total_cost - budget_limit
            overage_percent = (overage / budget_limit) * 100
            
            issue = ValidationIssue(
                issue_id=str(uuid.uuid4()),
                category=IssueCategory.BUDGET_EXCEEDED,
                severity=IssueSeverity.CRITICAL if overage_percent > 20 else IssueSeverity.WARNING,
                message=f"预算超限！总费用 {total_cost:.2f} 元超出预算 {budget_limit:.2f} 元，超限 {overage:.2f} 元 ({overage_percent:.1f}%)",
                suggested_action="优化补光方案：优先在谷电时段补光、降低功率、或缩短补光时长",
                metadata={
                    "budget_limit": budget_limit,
                    "actual_cost": total_cost,
                    "overage": overage,
                    "overage_percent": overage_percent
                }
            )
            result.add_issue(issue)
