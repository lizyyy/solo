from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import uuid

from models import (
    TimelineEvent, TankStatus, RiskIssue, RiskLevel, RiskType,
    VoyagePlan, ZoneRule, SensorReading, ManualRecord
)
from config import TIMEZONES, BALLAST_TANKS


class RiskDetector:
    MAX_GAP_HOURS = 12
    CRITICAL_GAP_HOURS = 24
    
    def __init__(self):
        self.issues: List[RiskIssue] = []
        self.voyage_plan: Optional[VoyagePlan] = None
        self.zone_rules: List[ZoneRule] = []
    
    def set_voyage_plan(self, voyage_plan: VoyagePlan):
        self.voyage_plan = voyage_plan
    
    def set_zone_rules(self, zone_rules: List[ZoneRule]):
        self.zone_rules = zone_rules
    
    def detect_risks(
        self,
        tank_statuses: Dict[str, TankStatus],
        sensor_readings: List[SensorReading],
        manual_records: List[ManualRecord]
    ) -> List[RiskIssue]:
        self.issues = []
        
        for tank_id, tank_status in tank_statuses.items():
            tank_issues = self._detect_tank_risks(tank_id, tank_status)
            self.issues.extend(tank_issues)
        
        self._detect_zone_violations(tank_statuses)
        self._detect_manual_conflicts(tank_statuses, manual_records)
        self._detect_missing_sensors(tank_statuses)
        self._detect_timezone_issues(sensor_readings, manual_records)
        
        return self.issues
    
    def _detect_tank_risks(self, tank_id: str, tank_status: TankStatus) -> List[RiskIssue]:
        issues = []
        
        for event in tank_status.history:
            if event.event_type == "SENSOR_GAP":
                gap_issue = self._create_gap_issue(tank_id, event)
                if gap_issue:
                    issues.append(gap_issue)
            
            if event.event_type in ["DISCHARGE", "DISCHARGE_START", "DISCHARGE_STOP"]:
                volume_issue = self._check_volume_exceeded(tank_id, event)
                if volume_issue:
                    issues.append(volume_issue)
        
        return issues
    
    def _create_gap_issue(self, tank_id: str, event: TimelineEvent) -> Optional[RiskIssue]:
        gap_hours = event.details.get("gap_duration_hours", 0)
        
        if gap_hours >= self.CRITICAL_GAP_HOURS:
            risk_level = RiskLevel.CRITICAL
        elif gap_hours >= self.MAX_GAP_HOURS:
            risk_level = RiskLevel.HIGH
        else:
            return None
        
        location = self._get_location_at_time(event.timestamp)
        
        return RiskIssue(
            issue_id=str(uuid.uuid4())[:8],
            tank_id=tank_id,
            risk_type=RiskType.SENSOR_GAP,
            risk_level=risk_level,
            timestamp=event.timestamp,
            description=f"传感器断采 {gap_hours:.1f} 小时，超过阈值",
            affected_volume=abs(event.volume_change),
            location=location,
            source_data={
                "event_id": event.event_id,
                "gap_hours": gap_hours,
                "last_reading": event.details.get("last_reading_time"),
                "next_reading": event.details.get("next_reading_time")
            }
        )
    
    def _check_volume_exceeded(self, tank_id: str, event: TimelineEvent) -> Optional[RiskIssue]:
        location = self._get_location_at_time(event.timestamp)
        
        for zone in self.zone_rules:
            if zone.is_in_zone(location.get("lat", 0), location.get("lon", 0)):
                if zone.is_prohibited:
                    return RiskIssue(
                        issue_id=str(uuid.uuid4())[:8],
                        tank_id=tank_id,
                        risk_type=RiskType.ZONE_VIOLATION,
                        risk_level=RiskLevel.CRITICAL,
                        timestamp=event.timestamp,
                        description=f"在禁止排放区域 '{zone.zone_name}' 进行排放操作",
                        affected_volume=abs(event.volume_change),
                        location=location,
                        source_data={
                            "event_id": event.event_id,
                            "zone_id": zone.zone_id,
                            "zone_name": zone.zone_name,
                            "is_prohibited": zone.is_prohibited
                        }
                    )
                
                if abs(event.volume_change) > zone.max_discharge_volume:
                    return RiskIssue(
                        issue_id=str(uuid.uuid4())[:8],
                        tank_id=tank_id,
                        risk_type=RiskType.VOLUME_EXCEEDED,
                        risk_level=RiskLevel.HIGH,
                        timestamp=event.timestamp,
                        description=f"排放量 {abs(event.volume_change):.0f} m³ 超过区域 '{zone.zone_name}' 限制 {zone.max_discharge_volume:.0f} m³",
                        affected_volume=abs(event.volume_change),
                        location=location,
                        source_data={
                            "event_id": event.event_id,
                            "zone_id": zone.zone_id,
                            "zone_name": zone.zone_name,
                            "allowed_volume": zone.max_discharge_volume,
                            "actual_volume": abs(event.volume_change)
                        }
                    )
        
        return None
    
    def _detect_zone_violations(self, tank_statuses: Dict[str, TankStatus]):
        for tank_id, tank_status in tank_statuses.items():
            for event in tank_status.history:
                if event.event_type in ["DISCHARGE", "DISCHARGE_START"]:
                    location = self._get_location_at_time(event.timestamp)
                    
                    for zone in self.zone_rules:
                        if zone.is_in_zone(location.get("lat", 0), location.get("lon", 0)):
                            if zone.is_prohibited:
                                existing = [i for i in self.issues if 
                                    i.tank_id == tank_id and 
                                    i.timestamp == event.timestamp and
                                    i.risk_type == RiskType.ZONE_VIOLATION]
                                
                                if not existing:
                                    issue = RiskIssue(
                                        issue_id=str(uuid.uuid4())[:8],
                                        tank_id=tank_id,
                                        risk_type=RiskType.ZONE_VIOLATION,
                                        risk_level=RiskLevel.CRITICAL,
                                        timestamp=event.timestamp,
                                        description=f"在禁止排放区域 '{zone.zone_name}' 进行排放操作",
                                        affected_volume=abs(event.volume_change),
                                        location=location,
                                        source_data={
                                            "event_id": event.event_id,
                                            "zone_id": zone.zone_id,
                                            "zone_name": zone.zone_name,
                                            "is_prohibited": zone.is_prohibited
                                        }
                                    )
                                    self.issues.append(issue)
    
    def _detect_manual_conflicts(
        self,
        tank_statuses: Dict[str, TankStatus],
        manual_records: List[ManualRecord]
    ):
        records_by_tank = defaultdict(list)
        for record in manual_records:
            records_by_tank[record.tank_id].append(record)
        
        for tank_id, records in records_by_tank.items():
            if tank_id not in tank_statuses:
                continue
            
            tank_status = tank_statuses[tank_id]
            
            for record in records:
                matching_events = [e for e in tank_status.history 
                    if abs((e.timestamp - record.timestamp).total_seconds()) < 300]
                
                for event in matching_events:
                    if event.source == "SENSOR":
                        if record.operation_type in ["DISCHARGE_START", "DISCHARGE_STOP"]:
                            sensor_change = event.volume_change
                            
                            if record.operation_type == "DISCHARGE_START" and sensor_change >= 0:
                                location = self._get_location_at_time(record.timestamp)
                                issue = RiskIssue(
                                    issue_id=str(uuid.uuid4())[:8],
                                    tank_id=tank_id,
                                    risk_type=RiskType.MANUAL_CONFLICT,
                                    risk_level=RiskLevel.HIGH,
                                    timestamp=record.timestamp,
                                    description=f"人工记录显示开始排放，但传感器数据显示液位变化为 {sensor_change:.0f} m³（非负值）",
                                    affected_volume=abs(sensor_change),
                                    location=location,
                                    source_data={
                                        "record_id": record.record_id,
                                        "operation_type": record.operation_type,
                                        "sensor_change": sensor_change,
                                        "operator": record.operator
                                    }
                                )
                                self.issues.append(issue)
                        
                        if record.pump_status == "RUNNING" and event.event_type not in ["DISCHARGE", "FILL"]:
                            location = self._get_location_at_time(record.timestamp)
                            issue = RiskIssue(
                                issue_id=str(uuid.uuid4())[:8],
                                tank_id=tank_id,
                                risk_type=RiskType.PUMP_STATUS_CONFLICT,
                                risk_level=RiskLevel.MEDIUM,
                                timestamp=record.timestamp,
                                description=f"人工记录显示泵运行，但传感器数据无显著变化",
                                affected_volume=0.0,
                                location=location,
                                source_data={
                                    "record_id": record.record_id,
                                    "pump_status": record.pump_status,
                                    "valve_status": record.valve_status,
                                    "sensor_event_type": event.event_type
                                }
                            )
                            self.issues.append(issue)
    
    def _detect_missing_sensors(self, tank_statuses: Dict[str, TankStatus]):
        expected_tanks = set(BALLAST_TANKS)
        actual_tanks = set(tank_statuses.keys())
        
        missing_tanks = expected_tanks - actual_tanks
        
        for tank_id in missing_tanks:
            issue = RiskIssue(
                issue_id=str(uuid.uuid4())[:8],
                tank_id=tank_id,
                risk_type=RiskType.MISSING_SENSOR,
                risk_level=RiskLevel.HIGH,
                timestamp=datetime.now(),
                description=f"压载舱 {tank_id} 无任何传感器数据",
                affected_volume=0.0,
                location={"lat": 0.0, "lon": 0.0},
                source_data={
                    "expected_tank": tank_id,
                    "has_sensor_data": False,
                    "has_manual_records": False
                }
            )
            self.issues.append(issue)
        
        for tank_id, tank_status in tank_statuses.items():
            if len(tank_status.history) == 0:
                issue = RiskIssue(
                    issue_id=str(uuid.uuid4())[:8],
                    tank_id=tank_id,
                    risk_type=RiskType.MISSING_SENSOR,
                    risk_level=RiskLevel.HIGH,
                    timestamp=datetime.now(),
                    description=f"压载舱 {tank_id} 无有效时间线事件",
                    affected_volume=0.0,
                    location={"lat": 0.0, "lon": 0.0},
                    source_data={
                        "tank_id": tank_id,
                        "event_count": 0
                    }
                )
                self.issues.append(issue)
    
    def _detect_timezone_issues(
        self,
        sensor_readings: List[SensorReading],
        manual_records: List[ManualRecord]
    ):
        all_timezones = set()
        for reading in sensor_readings:
            all_timezones.add(reading.timezone)
        for record in manual_records:
            all_timezones.add(record.timezone)
        
        if len(all_timezones) > 1:
            for tank_id in set([r.tank_id for r in sensor_readings] + [r.tank_id for r in manual_records]):
                tank_readings = [r for r in sensor_readings if r.tank_id == tank_id]
                tank_records = [r for r in manual_records if r.tank_id == tank_id]
                
                tank_timezones = set()
                for r in tank_readings:
                    tank_timezones.add(r.timezone)
                for r in tank_records:
                    tank_timezones.add(r.timezone)
                
                if len(tank_timezones) > 1:
                    earliest_time = min(
                        [r.timestamp for r in tank_readings] + [r.timestamp for r in tank_records]
                    ) if tank_readings or tank_records else datetime.now()
                    
                    issue = RiskIssue(
                        issue_id=str(uuid.uuid4())[:8],
                        tank_id=tank_id,
                        risk_type=RiskType.TIMEZONE_ISSUE,
                        risk_level=RiskLevel.MEDIUM,
                        timestamp=earliest_time,
                        description=f"压载舱 {tank_id} 存在多时区数据: {', '.join(tank_timezones)}",
                        affected_volume=0.0,
                        location={"lat": 0.0, "lon": 0.0},
                        source_data={
                            "tank_id": tank_id,
                            "timezones": list(tank_timezones),
                            "sensor_count": len(tank_readings),
                            "manual_count": len(tank_records)
                        }
                    )
                    self.issues.append(issue)
    
    def _get_location_at_time(self, timestamp: datetime) -> Dict[str, float]:
        if not self.voyage_plan or not self.voyage_plan.waypoints:
            return {"lat": 0.0, "lon": 0.0}
        
        waypoints = self.voyage_plan.waypoints
        
        if len(waypoints) < 2:
            return {
                "lat": waypoints[0].get("lat", 0.0),
                "lon": waypoints[0].get("lon", 0.0)
            }
        
        for i in range(len(waypoints) - 1):
            wp1 = waypoints[i]
            wp2 = waypoints[i + 1]
            
            t1 = datetime.fromisoformat(wp1["time"].replace('Z', '+00:00'))
            t2 = datetime.fromisoformat(wp2["time"].replace('Z', '+00:00'))
            
            if t1 <= timestamp <= t2:
                total_seconds = (t2 - t1).total_seconds()
                elapsed_seconds = (timestamp - t1).total_seconds()
                ratio = elapsed_seconds / total_seconds if total_seconds > 0 else 0
                
                lat = wp1["lat"] + (wp2["lat"] - wp1["lat"]) * ratio
                lon = wp1["lon"] + (wp2["lon"] - wp1["lon"]) * ratio
                
                return {"lat": lat, "lon": lon}
        
        if timestamp < datetime.fromisoformat(waypoints[0]["time"].replace('Z', '+00:00')):
            return {"lat": waypoints[0]["lat"], "lon": waypoints[0]["lon"]}
        
        return {"lat": waypoints[-1]["lat"], "lon": waypoints[-1]["lon"]}
    
    def get_issues_by_tank(self, tank_id: str) -> List[RiskIssue]:
        return [i for i in self.issues if i.tank_id == tank_id]
    
    def get_issues_by_type(self, risk_type: RiskType) -> List[RiskIssue]:
        return [i for i in self.issues if i.risk_type == risk_type]
    
    def get_issues_by_level(self, risk_level: RiskLevel) -> List[RiskIssue]:
        return [i for i in self.issues if i.risk_level == risk_level]
    
    def get_unconfirmed_issues(self) -> List[RiskIssue]:
        return [i for i in self.issues if not i.is_confirmed]
    
    def confirm_issue(self, issue_id: str, confirmed_by: str, notes: str = "") -> bool:
        for issue in self.issues:
            if issue.issue_id == issue_id:
                issue.is_confirmed = True
                issue.confirmed_by = confirmed_by
                issue.confirmed_time = datetime.now()
                issue.notes = notes
                return True
        return False
