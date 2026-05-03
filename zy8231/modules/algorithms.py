from datetime import datetime, time, date, timedelta
from typing import List, Dict, Optional, Set, Tuple
import math

from .data_models import (
    Layout, Zone, ZoneType, Schedule, Shift, 
    Heatmap, HeatmapPoint, CheckinLog, CheckinRecord, Rules,
    Issue, IssueType, RiskLevel, ZoneCoverage, AnalysisResult
)


class TimeSlotHelper:
    @staticmethod
    def is_time_in_slot(t: time, slot_start: time, slot_end: time) -> bool:
        if slot_end >= slot_start:
            return slot_start <= t < slot_end
        else:
            return t >= slot_start or t < slot_end
    
    @staticmethod
    def time_to_minutes(t: time) -> int:
        return t.hour * 60 + t.minute
    
    @staticmethod
    def minutes_to_time(minutes: int) -> time:
        minutes = minutes % (24 * 60)
        return time(hour=minutes // 60, minute=minutes % 60)
    
    @staticmethod
    def get_slot_key(slot_start: time, slot_end: time) -> str:
        return f"{slot_start.strftime('%H:%M')}-{slot_end.strftime('%H:%M')}"
    
    @staticmethod
    def get_shifts_in_slot(shifts: List[Shift], slot_start: time, slot_end: time) -> List[Shift]:
        result = []
        for shift in shifts:
            if shift.is_cross_midnight:
                if TimeSlotHelper.time_to_minutes(shift.end_time) < TimeSlotHelper.time_to_minutes(shift.start_time):
                    shift_end = TimeSlotHelper.time_to_minutes(shift.end_time) + 24 * 60
                else:
                    shift_end = TimeSlotHelper.time_to_minutes(shift.end_time)
                shift_start = TimeSlotHelper.time_to_minutes(shift.start_time)
                
                slot_start_m = TimeSlotHelper.time_to_minutes(slot_start)
                slot_end_m = TimeSlotHelper.time_to_minutes(slot_end)
                
                if slot_end_m < slot_start_m:
                    slot_end_m += 24 * 60
                
                if shift_start <= slot_end_m and shift_end > slot_start_m:
                    result.append(shift)
            else:
                shift_start = TimeSlotHelper.time_to_minutes(shift.start_time)
                shift_end = TimeSlotHelper.time_to_minutes(shift.end_time)
                slot_start_m = TimeSlotHelper.time_to_minutes(slot_start)
                slot_end_m = TimeSlotHelper.time_to_minutes(slot_end)
                
                if shift_start <= slot_end_m and shift_end > slot_start_m:
                    result.append(shift)
        return result


class BlindSpotDetector:
    def __init__(self, layout: Layout):
        self.layout = layout
    
    def calculate_distance(self, pos1: Dict[str, float], pos2: Dict[str, float]) -> float:
        x1, y1 = pos1.get('x', 0), pos1.get('y', 0)
        x2, y2 = pos2.get('x', 0), pos2.get('y', 0)
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    
    def is_zone_covered(self, zone: Zone, covered_positions: List[Dict[str, float]], 
                       coverage_radius: float = 5.0) -> bool:
        zone_pos = zone.position
        for cover_pos in covered_positions:
            distance = self.calculate_distance(zone_pos, cover_pos)
            if distance <= coverage_radius:
                return True
        return False
    
    def detect_blind_spots(self, shifts_in_slot: List[Shift], rules: Rules) -> List[Issue]:
        issues = []
        covered_positions = []
        
        for shift in shifts_in_slot:
            zone = self.layout.zones.get(shift.assigned_zone_id)
            if zone:
                covered_positions.append(zone.position)
        
        for zone_id, zone in self.layout.zones.items():
            is_covered = self.is_zone_covered(zone, covered_positions)
            
            if not is_covered:
                issue = Issue(
                    issue_type=IssueType.BLIND_SPOT,
                    timestamp=None,
                    zone_id=zone_id,
                    lifeguard_name=None,
                    description=f"区域 '{zone.name}' 存在盯防盲区，无救生员覆盖",
                    severity=RiskLevel.HIGH if zone.is_high_risk else RiskLevel.MEDIUM,
                    details={
                        "zone_name": zone.name,
                        "zone_type": zone.zone_type.value,
                        "is_high_risk": zone.is_high_risk,
                        "position": zone.position
                    }
                )
                issues.append(issue)
        
        return issues
    
    def check_zone_coverage_requirement(self, zone: Zone, assigned_lifeguards: List[str], 
                                         rules: Rules) -> List[Issue]:
        issues = []
        min_lifeguards = zone.min_lifeguards
        
        if zone.zone_type == ZoneType.CHILDREN_AREA:
            min_lifeguards = rules.children_area_min_lifeguards
        
        if zone.is_high_risk:
            min_lifeguards = max(min_lifeguards, rules.high_risk_zone_min_lifeguards)
        
        if len(assigned_lifeguards) < min_lifeguards:
            issue = Issue(
                issue_type=IssueType.BLIND_SPOT,
                timestamp=None,
                zone_id=zone.id,
                lifeguard_name=None,
                description=f"区域 '{zone.name}' 救生员数量不足，需要 {min_lifeguards} 人，当前 {len(assigned_lifeguards)} 人",
                severity=RiskLevel.HIGH if zone.is_high_risk else RiskLevel.MEDIUM,
                details={
                    "zone_name": zone.name,
                    "min_required": min_lifeguards,
                    "current_count": len(assigned_lifeguards),
                    "assigned_lifeguards": assigned_lifeguards
                }
            )
            issues.append(issue)
        
        return issues


class FatigueDetector:
    def __init__(self, rules: Rules):
        self.rules = rules
    
    def detect_fatigue_overtime(self, shifts: List[Shift]) -> List[Issue]:
        issues = []
        
        for shift in shifts:
            duration = shift.get_duration_minutes()
            
            if duration > self.rules.fatigue_alert_threshold_minutes:
                if duration > self.rules.max_shift_duration_minutes:
                    severity = RiskLevel.CRITICAL
                    description = (f"救生员 '{shift.lifeguard_name}' 班次严重超时，"
                                  f"时长 {duration:.1f} 分钟，超过最大时长 {self.rules.max_shift_duration_minutes} 分钟")
                else:
                    severity = RiskLevel.MEDIUM
                    description = (f"救生员 '{shift.lifeguard_name}' 接近疲劳阈值，"
                                  f"时长 {duration:.1f} 分钟，超过预警阈值 {self.rules.fatigue_alert_threshold_minutes} 分钟")
                
                issue = Issue(
                    issue_type=IssueType.FATIGUE_OVERTIME,
                    timestamp=None,
                    zone_id=shift.assigned_zone_id,
                    lifeguard_name=shift.lifeguard_name,
                    description=description,
                    severity=severity,
                    details={
                        "shift_id": shift.id,
                        "start_time": shift.start_time.strftime("%H:%M"),
                        "end_time": shift.end_time.strftime("%H:%M"),
                        "duration_minutes": duration,
                        "max_allowed": self.rules.max_shift_duration_minutes,
                        "alert_threshold": self.rules.fatigue_alert_threshold_minutes,
                        "is_cross_midnight": shift.is_cross_midnight
                    }
                )
                issues.append(issue)
        
        return issues


class ChildrenAreaMonitor:
    def __init__(self, layout: Layout, rules: Rules):
        self.layout = layout
        self.rules = rules
    
    def get_children_zones(self) -> List[Zone]:
        return [zone for zone in self.layout.zones.values() 
                if zone.zone_type == ZoneType.CHILDREN_AREA]
    
    def check_children_area_coverage(self, shifts_in_slot: List[Shift]) -> List[Issue]:
        issues = []
        children_zones = self.get_children_zones()
        
        for zone in children_zones:
            assigned_lifeguards = [
                shift.lifeguard_name for shift in shifts_in_slot 
                if shift.assigned_zone_id == zone.id
            ]
            
            min_required = self.rules.children_area_min_lifeguards
            
            if len(assigned_lifeguards) < min_required:
                issue = Issue(
                    issue_type=IssueType.CHILDREN_AREA_ABSENT,
                    timestamp=None,
                    zone_id=zone.id,
                    lifeguard_name=None,
                    description=f"儿童区域 '{zone.name}' 救生员不足，需要 {min_required} 人，当前 {len(assigned_lifeguards)} 人",
                    severity=RiskLevel.CRITICAL,
                    details={
                        "zone_name": zone.name,
                        "min_required": min_required,
                        "current_count": len(assigned_lifeguards),
                        "assigned_lifeguards": assigned_lifeguards
                    }
                )
                issues.append(issue)
        
        return issues


class CheckinValidator:
    def __init__(self, rules: Rules):
        self.rules = rules
    
    def validate_checkins(self, checkin_log: CheckinLog, shifts: List[Shift]) -> List[Issue]:
        issues = []
        
        lifeguard_shifts: Dict[str, List[Shift]] = {}
        for shift in shifts:
            if shift.lifeguard_name not in lifeguard_shifts:
                lifeguard_shifts[shift.lifeguard_name] = []
            lifeguard_shifts[shift.lifeguard_name].append(shift)
        
        for lifeguard_name, lg_shifts in lifeguard_shifts.items():
            for shift in lg_shifts:
                checkin_found = False
                expected_checkin_time = TimeSlotHelper.time_to_minutes(shift.start_time)
                grace_period = self.rules.checkin_grace_minutes
                
                for record in checkin_log.records:
                    if record.lifeguard_name == lifeguard_name and record.is_checkin:
                        record_time = TimeSlotHelper.time_to_minutes(record.timestamp.time())
                        
                        if abs(record_time - expected_checkin_time) <= grace_period:
                            checkin_found = True
                            break
                
                if not checkin_found:
                    issue = Issue(
                        issue_type=IssueType.MISSING_CHECKIN,
                        timestamp=None,
                        zone_id=shift.assigned_zone_id,
                        lifeguard_name=lifeguard_name,
                        description=f"救生员 '{lifeguard_name}' 班次 {shift.id} 缺少打卡记录",
                        severity=RiskLevel.MEDIUM,
                        details={
                            "shift_id": shift.id,
                            "expected_checkin": shift.start_time.strftime("%H:%M"),
                            "grace_period_minutes": grace_period,
                            "zone_id": shift.assigned_zone_id
                        }
                    )
                    issues.append(issue)
        
        return issues


class CrossMidnightDetector:
    def detect_cross_midnight_shifts(self, shifts: List[Shift]) -> List[Issue]:
        issues = []
        
        for shift in shifts:
            if shift.is_cross_midnight:
                issue = Issue(
                    issue_type=IssueType.CROSS_MIDNIGHT_SHIFT,
                    timestamp=None,
                    zone_id=shift.assigned_zone_id,
                    lifeguard_name=shift.lifeguard_name,
                    description=f"班次 {shift.id} 为跨午夜班次，从 {shift.start_time.strftime('%H:%M')} 到 {shift.end_time.strftime('%H:%M')}",
                    severity=RiskLevel.LOW,
                    details={
                        "shift_id": shift.id,
                        "start_time": shift.start_time.strftime("%H:%M"),
                        "end_time": shift.end_time.strftime("%H:%M"),
                        "lifeguard_name": shift.lifeguard_name,
                        "duration_minutes": shift.get_duration_minutes()
                    }
                )
                issues.append(issue)
        
        return issues


class AnalysisEngine:
    def __init__(self, layout: Layout, schedule: Schedule, heatmap: Heatmap, 
                 checkin_log: CheckinLog, rules: Rules):
        self.layout = layout
        self.schedule = schedule
        self.heatmap = heatmap
        self.checkin_log = checkin_log
        self.rules = rules
        
        self.blind_spot_detector = BlindSpotDetector(layout)
        self.fatigue_detector = FatigueDetector(rules)
        self.children_area_monitor = ChildrenAreaMonitor(layout, rules)
        self.checkin_validator = CheckinValidator(rules)
        self.cross_midnight_detector = CrossMidnightDetector()
    
    def get_visitor_count_for_zone_slot(self, zone_id: str, 
                                         slot_start: time, slot_end: time) -> int:
        slot_start_m = TimeSlotHelper.time_to_minutes(slot_start)
        slot_end_m = TimeSlotHelper.time_to_minutes(slot_end)
        
        total_visitors = 0
        count = 0
        
        for point in self.heatmap.points:
            if point.zone_id == zone_id:
                point_time_m = TimeSlotHelper.time_to_minutes(point.timestamp.time())
                
                if slot_end_m >= slot_start_m:
                    if slot_start_m <= point_time_m < slot_end_m:
                        total_visitors += point.visitor_count
                        count += 1
                else:
                    if point_time_m >= slot_start_m or point_time_m < slot_end_m:
                        total_visitors += point.visitor_count
                        count += 1
        
        return total_visitors // max(1, count) if count > 0 else 0
    
    def calculate_risk_level(self, zone: Zone, visitor_count: int, 
                             is_covered: bool, issues: List[Issue]) -> RiskLevel:
        if not is_covered:
            return RiskLevel.HIGH if zone.is_high_risk else RiskLevel.MEDIUM
        
        for issue in issues:
            if issue.issue_type == IssueType.CHILDREN_AREA_ABSENT:
                return RiskLevel.CRITICAL
            if issue.issue_type == IssueType.BLIND_SPOT:
                return RiskLevel.HIGH
        
        if zone.is_high_risk and visitor_count > 10:
            return RiskLevel.HIGH
        elif visitor_count > 20:
            return RiskLevel.HIGH
        elif visitor_count > 10:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    def run_analysis(self) -> AnalysisResult:
        time_slots = self.rules.get_time_slots()
        time_slot_keys = [TimeSlotHelper.get_slot_key(slot['start'], slot['end']) for slot in time_slots]
        
        zone_coverages: Dict[str, List[ZoneCoverage]] = {}
        all_issues: List[Issue] = []
        
        all_issues.extend(self.cross_midnight_detector.detect_cross_midnight_shifts(self.schedule.shifts))
        all_issues.extend(self.fatigue_detector.detect_fatigue_overtime(self.schedule.shifts))
        all_issues.extend(self.checkin_validator.validate_checkins(self.checkin_log, self.schedule.shifts))
        
        for slot in time_slots:
            slot_key = TimeSlotHelper.get_slot_key(slot['start'], slot['end'])
            shifts_in_slot = TimeSlotHelper.get_shifts_in_slot(self.schedule.shifts, slot['start'], slot['end'])
            
            slot_issues: List[Issue] = []
            slot_issues.extend(self.blind_spot_detector.detect_blind_spots(shifts_in_slot, self.rules))
            slot_issues.extend(self.children_area_monitor.check_children_area_coverage(shifts_in_slot))
            all_issues.extend(slot_issues)
            
            for zone_id, zone in self.layout.zones.items():
                assigned_lifeguards = [
                    shift.lifeguard_name for shift in shifts_in_slot 
                    if shift.assigned_zone_id == zone_id
                ]
                
                visitor_count = self.get_visitor_count_for_zone_slot(zone_id, slot['start'], slot['end'])
                
                zone_slot_issues = [
                    issue for issue in slot_issues 
                    if issue.zone_id == zone_id
                ]
                
                is_covered = len(assigned_lifeguards) > 0
                risk_level = self.calculate_risk_level(zone, visitor_count, is_covered, zone_slot_issues)
                
                zone_coverage = ZoneCoverage(
                    zone_id=zone_id,
                    zone_name=zone.name,
                    zone_type=zone.zone_type,
                    time_slot=slot_key,
                    assigned_lifeguards=assigned_lifeguards,
                    visitor_count=visitor_count,
                    risk_level=risk_level,
                    is_covered=is_covered,
                    issues=zone_slot_issues
                )
                
                if zone_id not in zone_coverages:
                    zone_coverages[zone_id] = []
                zone_coverages[zone_id].append(zone_coverage)
        
        summary = {
            "total_issues": len(all_issues),
            "issue_by_type": {},
            "issue_by_severity": {},
            "total_zones": len(self.layout.zones),
            "total_shifts": len(self.schedule.shifts),
            "time_slots": time_slot_keys
        }
        
        for issue in all_issues:
            issue_type = issue.issue_type.value
            severity = issue.severity.value
            
            if issue_type not in summary["issue_by_type"]:
                summary["issue_by_type"][issue_type] = 0
            summary["issue_by_type"][issue_type] += 1
            
            if severity not in summary["issue_by_severity"]:
                summary["issue_by_severity"][severity] = 0
            summary["issue_by_severity"][severity] += 1
        
        return AnalysisResult(
            time_slots=time_slot_keys,
            zone_coverages=zone_coverages,
            all_issues=all_issues,
            summary=summary
        )
