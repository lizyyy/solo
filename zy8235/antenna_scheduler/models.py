#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum


class IssueType(Enum):
    TIME_OVERLAP = 'time_overlap'
    MAINTENANCE_CONFLICT = 'maintenance_conflict'
    COOLDOWN_VIOLATION = 'cooldown_violation'
    SLEW_TIME_VIOLATION = 'slew_time_violation'
    VISIBILITY_VIOLATION = 'visibility_violation'
    PRIORITY_PREEMPTION = 'priority_preemption'
    SAME_SATELLITE_CONSECUTIVE = 'same_satellite_consecutive'


class IssueSeverity(Enum):
    CRITICAL = 'critical'
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'


@dataclass
class Antenna:
    id: str
    name: str
    azimuth_min: float
    azimuth_max: float
    elevation_min: float
    elevation_max: float
    slew_rate: float
    cooldown_minutes: int
    
    def can_see(self, azimuth: float, elevation: float) -> bool:
        az_ok = (self.azimuth_min <= azimuth <= self.azimuth_max)
        el_ok = (self.elevation_min <= elevation <= self.elevation_max)
        return az_ok and el_ok
    
    def calculate_slew_time(self, 
                           start_azimuth: float, 
                           start_elevation: float, 
                           end_azimuth: float, 
                           end_elevation: float) -> timedelta:
        az_diff = abs(end_azimuth - start_azimuth)
        az_diff = min(az_diff, 360 - az_diff)
        
        el_diff = abs(end_elevation - start_elevation)
        
        total_degrees = (az_diff ** 2 + el_diff ** 2) ** 0.5
        
        minutes_needed = total_degrees / self.slew_rate
        return timedelta(minutes=minutes_needed)


@dataclass
class Pass:
    pass_id: str
    satellite_name: str
    antenna_id: str
    start_time: datetime
    end_time: datetime
    azimuth_start: float
    elevation_start: float
    azimuth_end: float
    elevation_end: float
    mission_type: str
    priority_level: int = 999
    can_preempt: bool = False
    is_cross_midnight: bool = field(default=False, init=False)
    
    def __post_init__(self):
        self.is_cross_midnight = self._check_cross_midnight()
    
    def _check_cross_midnight(self) -> bool:
        start_day = self.start_time.date()
        end_day = self.end_time.date()
        return start_day != end_day
    
    def get_actual_end_time(self) -> datetime:
        if self.is_cross_midnight:
            return self.end_time
        return self.end_time
    
    def overlaps_with(self, other: 'Pass') -> bool:
        return not (self.end_time <= other.start_time or 
                   self.start_time >= other.end_time)
    
    def get_overlap_duration(self, other: 'Pass') -> timedelta:
        if not self.overlaps_with(other):
            return timedelta(0)
        
        overlap_start = max(self.start_time, other.start_time)
        overlap_end = min(self.end_time, other.end_time)
        return overlap_end - overlap_start
    
    def duration(self) -> timedelta:
        return self.end_time - self.start_time


@dataclass
class Maintenance:
    maintenance_id: str
    antenna_id: str
    start_time: datetime
    end_time: datetime
    reason: str
    
    def overlaps_with_pass(self, pass_obj: Pass) -> bool:
        if pass_obj.antenna_id != self.antenna_id:
            return False
        return not (self.end_time <= pass_obj.start_time or 
                   self.start_time >= pass_obj.end_time)
    
    def get_overlap_duration(self, pass_obj: Pass) -> timedelta:
        if not self.overlaps_with_pass(pass_obj):
            return timedelta(0)
        
        overlap_start = max(self.start_time, pass_obj.start_time)
        overlap_end = min(self.end_time, pass_obj.end_time)
        return overlap_end - overlap_start


@dataclass
class MissionPriority:
    mission_type: str
    priority_level: int
    can_preempt: bool
    description: str = ""
    
    def can_preempt_other(self, other: 'MissionPriority') -> bool:
        if not self.can_preempt:
            return False
        return self.priority_level < other.priority_level


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    pass_ids: List[str]
    antenna_id: str
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'issue_type': self.issue_type.value,
            'severity': self.severity.value,
            'message': self.message,
            'pass_ids': ','.join(self.pass_ids),
            'antenna_id': self.antenna_id,
            'details': str(self.details),
            'suggestion': self.suggestion
        }


@dataclass
class ScheduledPass:
    pass_obj: Pass
    status: str
    conflicts_with: List[str] = field(default_factory=list)
    is_preempted: bool = False
    preempted_by: str = ""
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'pass_id': self.pass_obj.pass_id,
            'satellite_name': self.pass_obj.satellite_name,
            'antenna_id': self.pass_obj.antenna_id,
            'start_time': self.pass_obj.start_time.strftime('%Y-%m-%d %H:%M:%S'),
            'end_time': self.pass_obj.end_time.strftime('%Y-%m-%d %H:%M:%S'),
            'mission_type': self.pass_obj.mission_type,
            'priority_level': self.pass_obj.priority_level,
            'status': self.status,
            'is_cross_midnight': self.pass_obj.is_cross_midnight,
            'conflicts_with': ','.join(self.conflicts_with),
            'is_preempted': self.is_preempted,
            'preempted_by': self.preempted_by,
            'notes': self.notes
        }


@dataclass
class ScheduleValidationResult:
    issues: List[Issue] = field(default_factory=list)
    scheduled_passes: List[ScheduledPass] = field(default_factory=list)
    antennas: Dict[str, Antenna] = field(default_factory=dict)
    passes: Dict[str, Pass] = field(default_factory=dict)
    maintenances: Dict[str, Maintenance] = field(default_factory=dict)
    priorities: Dict[str, MissionPriority] = field(default_factory=dict)
    
    def add_issue(self, issue: Issue):
        self.issues.append(issue)
    
    def get_issues_by_type(self, issue_type: IssueType) -> List[Issue]:
        return [i for i in self.issues if i.issue_type == issue_type]
    
    def get_issues_by_severity(self, severity: IssueSeverity) -> List[Issue]:
        return [i for i in self.issues if i.severity == severity]
    
    def get_issues_by_antenna(self, antenna_id: str) -> List[Issue]:
        return [i for i in self.issues if i.antenna_id == antenna_id]
    
    def has_critical_issues(self) -> bool:
        return any(i.severity == IssueSeverity.CRITICAL for i in self.issues)
