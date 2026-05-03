from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Dict, Set, Optional, Tuple
from collections import defaultdict
import uuid

from freq_coordinator.models import (
    RiskItem,
    SupplyStation,
    RepeaterStation,
    VolunteerShift,
    Device,
    AssignedChannel,
    CommunicationPlan,
)
from freq_coordinator.scheduler.rules import (
    SchedulerRules,
    calculate_haversine_distance,
)


class RiskDetector(ABC):
    RISK_TYPE = "unknown"
    
    def __init__(self, rules: SchedulerRules, plan: CommunicationPlan = None):
        self.rules = rules
        self.plan = plan
        self.risks: List[RiskItem] = []
    
    @abstractmethod
    def detect(self) -> List[RiskItem]:
        pass
    
    def _create_risk(
        self,
        title: str,
        description: str,
        severity: str = "medium",
        affected_entities: List[str] = None,
        location: Dict[str, float] = None,
        time_window: Dict[str, datetime] = None,
        recommendation: str = None,
        confidence: float = 1.0,
    ) -> RiskItem:
        return RiskItem(
            id=f"{self.RISK_TYPE}-{uuid.uuid4().hex[:8]}",
            type=self.RISK_TYPE,
            severity=severity,
            title=title,
            description=description,
            affected_entities=affected_entities or [],
            location=location,
            time_window=time_window,
            recommendation=recommendation,
            confidence=confidence,
        )


class CoverageGapDetector(RiskDetector):
    RISK_TYPE = "coverage_gap"
    
    def __init__(self, rules: SchedulerRules, plan: CommunicationPlan = None):
        super().__init__(rules, plan)
        self.min_critical_station_coverage = 1
    
    def detect(self) -> List[RiskItem]:
        self.risks = []
        
        for station_id, station in self.rules.stations.items():
            if not station.required_coverage:
                continue
            
            is_covered, min_distance, covering_repeaters = self.rules.is_station_covered(station)
            
            if not is_covered:
                severity = self._determine_severity(station)
                risk = self._create_risk(
                    title=f"站点 '{station.name}' 无通信覆盖",
                    description=f"站点 '{station.name}' (ID: {station.id}) 不在任何中继台的覆盖范围内。"
                    f"最近的中继台距离约 {min_distance:.2f} km。",
                    severity=severity,
                    affected_entities=[station.id],
                    location={"latitude": station.latitude, "longitude": station.longitude},
                    recommendation=f"需要在该站点附近部署临时中继台或增加现有中继台功率。"
                    f"站点位于距离起点 {station.distance_from_start} km 处，海拔 {station.elevation} m。",
                )
                self.risks.append(risk)
            else:
                if len(covering_repeaters) < self.min_critical_station_coverage:
                    pass
        
        return self.risks
    
    def _determine_severity(self, station: SupplyStation) -> str:
        criticality_map = {
            "critical": "critical",
            "high": "high",
            "normal": "medium",
            "low": "low",
        }
        return criticality_map.get(station.criticality, "medium")


class FrequencyConflictDetector(RiskDetector):
    RISK_TYPE = "frequency_conflict"
    MIN_FREQUENCY_STEP_KHZ = 25.0
    
    def detect(self) -> List[RiskItem]:
        self.risks = []
        
        self._check_repeater_conflicts()
        self._check_station_channel_conflicts()
        self._check_time_based_conflicts()
        
        return self.risks
    
    def _check_repeater_conflicts(self):
        repeaters = list(self.rules.repeaters.values())
        
        for i, r1 in enumerate(repeaters):
            for j, r2 in enumerate(repeaters[i+1:], start=i+1):
                distance = calculate_haversine_distance(
                    r1.latitude, r1.longitude,
                    r2.latitude, r2.longitude
                )
                
                tx_conflict = self.rules.check_frequency_conflict(r1.tx_frequency, r2.tx_frequency)
                rx_conflict = self.rules.check_frequency_conflict(r1.rx_frequency, r2.rx_frequency)
                
                if tx_conflict and distance < r1.coverage_radius_km + r2.coverage_radius_km:
                    severity = "high" if distance < 5 else "medium"
                    risk = self._create_risk(
                        title=f"中继台发射频率冲突: {r1.tx_frequency} MHz",
                        description=f"中继台 '{r1.name}' 和 '{r2.name}' 使用相同的发射频率 "
                        f"{r1.tx_frequency} MHz，且距离仅 {distance:.2f} km，"
                        f"小于两者覆盖半径之和 ({r1.coverage_radius_km + r2.coverage_radius_km:.2f} km)。",
                        severity=severity,
                        affected_entities=[r1.id, r2.id],
                        recommendation="调整其中一个中继台的发射频率，建议间隔至少 25 kHz。",
                    )
                    self.risks.append(risk)
    
    def _check_station_channel_conflicts(self):
        if not self.plan:
            return
        
        for station_id, station in self.rules.stations.items():
            other_stations = [s for s in self.rules.stations.values() if s.id != station_id]
            
            for other_station in other_stations:
                distance = calculate_haversine_distance(
                    station.latitude, station.longitude,
                    other_station.latitude, other_station.longitude
                )
                
                if distance < 1.0:
                    station_channels = self.plan.channel_plan.get(station_id, [])
                    other_channels = self.plan.channel_plan.get(other_station.id, [])
                    
                    for ch1 in station_channels:
                        if ch1.is_repeater:
                            continue
                        for ch2 in other_channels:
                            if ch2.is_repeater:
                                continue
                            if self.rules.check_frequency_conflict(ch1.frequency, ch2.frequency):
                                risk = self._create_risk(
                                    title=f"邻近站点频率冲突: {ch1.frequency} MHz",
                                    description=f"站点 '{station.name}' 和 '{other_station.name}' "
                                    f"距离仅 {distance:.2f} km，但都使用频率 {ch1.frequency} MHz。",
                                    severity="medium",
                                    affected_entities=[station.id, other_station.id],
                                    location={"latitude": (station.latitude + other_station.latitude) / 2,
                                              "longitude": (station.longitude + other_station.longitude) / 2},
                                    recommendation="为其中一个站点分配不同的频率。",
                                )
                                self.risks.append(risk)
    
    def _check_time_based_conflicts(self):
        if not self.plan or not self.plan.schedule:
            return
        
        for i, entry1 in enumerate(self.plan.schedule):
            for j, entry2 in enumerate(self.plan.schedule[i+1:], start=i+1):
                if entry1.station_id == entry2.station_id:
                    continue
                
                shift1 = next((s for s in self.rules.shifts if s.id == entry1.shift_id), None)
                shift2 = next((s for s in self.rules.shifts if s.id == entry2.shift_id), None)
                
                if not shift1 or not shift2:
                    continue
                
                if not self.rules.check_time_overlap(shift1, shift2):
                    continue
                
                station1 = self.rules.stations.get(entry1.station_id)
                station2 = self.rules.stations.get(entry2.station_id)
                
                if not station1 or not station2:
                    continue
                
                distance = calculate_haversine_distance(
                    station1.latitude, station1.longitude,
                    station2.latitude, station2.longitude
                )
                
                if distance < 2.0:
                    for ch1 in entry1.assigned_channels:
                        for ch2 in entry2.assigned_channels:
                            if self.rules.check_frequency_conflict(ch1.frequency, ch2.frequency):
                                risk = self._create_risk(
                                    title=f"时间重叠的频率冲突: {ch1.frequency} MHz",
                                    description=f"班次 '{entry1.shift_id}' ({shift1.volunteer_name}) "
                                    f"和 '{entry2.shift_id}' ({shift2.volunteer_name}) "
                                    f"时间重叠且站点距离仅 {distance:.2f} km，"
                                    f"但都使用频率 {ch1.frequency} MHz。",
                                    severity="high",
                                    affected_entities=[entry1.shift_id, entry2.shift_id],
                                    time_window={"start": min(shift1.start_time, shift2.start_time),
                                                 "end": max(shift1.end_time, shift2.end_time)},
                                    recommendation="协调两个班次使用不同频率，或调整班次时间。",
                                )
                                self.risks.append(risk)


class HandoverGapDetector(RiskDetector):
    RISK_TYPE = "handover_gap"
    
    def __init__(self, rules: SchedulerRules, plan: CommunicationPlan = None, min_handover_minutes: int = 10):
        super().__init__(rules, plan)
        self.min_handover_minutes = min_handover_minutes
    
    def detect(self) -> List[RiskItem]:
        self.risks = []
        
        for station_id, shifts in self.rules._station_shifts.items():
            if len(shifts) < 2:
                continue
            
            station = self.rules.stations.get(station_id)
            if not station:
                continue
            
            sorted_shifts = sorted(shifts, key=lambda s: s.start_time)
            
            for i in range(len(sorted_shifts) - 1):
                prev_shift = sorted_shifts[i]
                next_shift = sorted_shifts[i + 1]
                
                is_sufficient, gap = self.rules.is_handover_sufficient(prev_shift, next_shift)
                
                if gap.total_seconds() > 0 and not is_sufficient:
                    gap_minutes = gap.total_seconds() // 60
                    severity = self._determine_severity(gap, station)
                    
                    risk = self._create_risk(
                        title=f"站点 '{station.name}' 交接间隔不足",
                        description=f"站点 '{station.name}' 的班次 '{prev_shift.volunteer_name}' "
                        f"(结束于 {prev_shift.end_time.strftime('%H:%M')}) 与 "
                        f"'{next_shift.volunteer_name}' "
                        f"(开始于 {next_shift.start_time.strftime('%H:%M')}) 之间"
                        f"仅有 {gap_minutes} 分钟交接时间，"
                        f"低于要求的 {self.min_handover_minutes} 分钟。",
                        severity=severity,
                        affected_entities=[prev_shift.id, next_shift.id],
                        location={"latitude": station.latitude, "longitude": station.longitude},
                        time_window={"start": prev_shift.end_time, "end": next_shift.start_time},
                        recommendation=f"建议提前 {next_shift.volunteer_name} 的到岗时间，"
                        f"或推迟 {prev_shift.volunteer_name} 的离岗时间，"
                        f"确保至少 {self.min_handover_minutes} 分钟交接时间。",
                    )
                    self.risks.append(risk)
                
                if gap.total_seconds() > 60:
                    gap_minutes = gap.total_seconds() // 60
                    risk = self._create_risk(
                        title=f"站点 '{station.name}' 存在值守空档",
                        description=f"站点 '{station.name}' 在 "
                        f"{prev_shift.end_time.strftime('%H:%M')} 到 "
                        f"{next_shift.start_time.strftime('%H:%M')} 之间"
                        f"存在 {gap_minutes} 分钟的值守空档。",
                        severity="critical" if gap_minutes > 30 else "high",
                        affected_entities=[prev_shift.id, next_shift.id],
                        location={"latitude": station.latitude, "longitude": station.longitude},
                        time_window={"start": prev_shift.end_time, "end": next_shift.start_time},
                        recommendation="需要调整班次时间或安排临时值守人员覆盖空档。",
                    )
                    self.risks.append(risk)
        
        return self.risks
    
    def _determine_severity(self, gap: timedelta, station: SupplyStation) -> str:
        gap_minutes = gap.total_seconds() // 60
        
        if gap_minutes < 5:
            base_severity = "low"
        elif gap_minutes < 8:
            base_severity = "medium"
        else:
            base_severity = "high"
        
        if station.criticality == "critical" and base_severity == "medium":
            return "high"
        if station.criticality == "low" and base_severity == "medium":
            return "low"
        
        return base_severity


class BatteryRiskDetector(RiskDetector):
    RISK_TYPE = "battery_risk"
    SAFETY_MARGIN_HOURS = 1.0
    
    def __init__(
        self,
        rules: SchedulerRules,
        plan: CommunicationPlan = None,
        safety_margin_hours: float = SAFETY_MARGIN_HOURS,
    ):
        super().__init__(rules, plan)
        self.safety_margin_hours = safety_margin_hours
    
    def detect(self) -> List[RiskItem]:
        self.risks = []
        
        if not self.plan:
            return self.risks
        
        for entry in self.plan.schedule:
            shift = next((s for s in self.rules.shifts if s.id == entry.shift_id), None)
            if not shift:
                continue
            
            device = self.rules.devices.get(entry.device_id)
            if not device:
                continue
            
            shift_duration_hours = shift.duration.total_seconds() / 3600.0
            
            runtime = device.estimated_runtime_hours
            standby = device.estimated_standby_hours
            
            required_runtime = shift_duration_hours + self.safety_margin_hours
            
            if runtime < required_runtime:
                deficit_hours = required_runtime - runtime
                
                station = self.rules.stations.get(entry.station_id)
                severity = self._determine_severity(deficit_hours, station)
                
                risk = self._create_risk(
                    title=f"设备 '{device.id}' 电量不足以支撑班次",
                    description=f"志愿者 '{shift.volunteer_name}' 的设备 "
                    f"当前电量仅支持约 {runtime:.1f} 小时使用，"
                    f"但班次时长为 {shift_duration_hours:.1f} 小时，"
                    f"加上 {self.safety_margin_hours} 小时安全余量，"
                    f"缺少约 {deficit_hours:.1f} 小时电量。",
                    severity=severity,
                    affected_entities=[shift.id, device.id],
                    time_window={"start": shift.start_time, "end": shift.end_time},
                    recommendation=f"需要为设备 '{device.id}' 充满电，"
                    f"或更换更大容量的电池/设备。"
                    f"当前电量: {device.current_charge_percent}%, "
                    f"电池容量: {device.battery_capacity_mah} mAh。",
                )
                self.risks.append(risk)
            
            if device.current_charge_percent < 80:
                station = self.rules.stations.get(entry.station_id)
                if station and station.criticality in ["critical", "high"]:
                    risk = self._create_risk(
                        title=f"关键站点设备电量低于 80%",
                        description=f"关键站点 '{station.name}' 的设备 '{device.id}' "
                        f"当前电量仅为 {device.current_charge_percent}%。",
                        severity="medium",
                        affected_entities=[shift.id, device.id],
                        recommendation="建议在赛前为关键站点的所有设备充满电。",
                    )
                    self.risks.append(risk)
        
        return self.risks
    
    def _determine_severity(self, deficit_hours: float, station: SupplyStation = None) -> str:
        if deficit_hours > 2.0:
            severity = "critical"
        elif deficit_hours > 1.0:
            severity = "high"
        else:
            severity = "medium"
        
        if station:
            if station.criticality == "critical" and severity == "medium":
                severity = "high"
            if station.criticality == "critical" and severity == "high":
                severity = "critical"
        
        return severity
